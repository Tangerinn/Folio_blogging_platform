const mongoose = require('mongoose');
const Post = require('../../models/Post');
const Category = require('../../models/Category');
const Comment = require('../../models/Comment');
const Bookmark = require('../../models/Bookmark');
const AppError = require('../../utils/AppError');
const { isEmptyDoc } = require('../../utils/content');
const { cascadeDeletePost } = require('../../utils/cascade');

function canQueryComment(methodName) {
  if (mongoose.connection && mongoose.connection.readyState === 1) return true;
  return Comment[methodName] !== mongoose.Model[methodName];
}

function canQueryBookmark(methodName) {
  if (mongoose.connection && mongoose.connection.readyState === 1) return true;
  return Bookmark[methodName] !== mongoose.Model[methodName];
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shapePost(post, commentCount = 0, bookmarked = false) {
  const authorDoc = post.author && typeof post.author === 'object' && post.author.name ? post.author : null;
  const authorId = authorDoc
    ? authorDoc._id.toString()
    : post.author
      ? post.author.toString()
      : '';

  const categoryDoc = post.category && typeof post.category === 'object' && post.category.name ? post.category : null;
  const categoryId = categoryDoc
    ? categoryDoc._id.toString()
    : post.category
      ? post.category.toString()
      : null;

  return {
    id: post._id.toString(),
    title: post.title,
    content: post.content,
    status: post.status,
    createdAt: post.createdAt,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    author: authorDoc
      ? { id: authorId, name: authorDoc.name, bio: authorDoc.bio || '' }
      : { id: authorId, name: 'Deleted user', bio: '' },
    category: categoryDoc
      ? { id: categoryId, name: categoryDoc.name, description: categoryDoc.description || '' }
      : null,
    categoryId,
    commentCount: typeof commentCount === 'number' ? commentCount : 0,
    bookmarked: Boolean(bookmarked),
  };
}

async function getCommentCountsForPosts(postIds) {
  if (!postIds || postIds.length === 0) return new Map();
  if (!canQueryComment('aggregate')) return new Map();
  try {
    const counts = await Comment.aggregate([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]);
    return new Map(counts.map((c) => [c._id ? c._id.toString() : '', c.count]));
  } catch {
    return new Map();
  }
}

async function getBookmarkedPostIdsForUser(userId, postIds) {
  if (!userId || !postIds || postIds.length === 0) return new Set();
  if (!canQueryBookmark('find')) return new Set();
  try {
    const list = await Bookmark.find({
      userId,
      postId: { $in: postIds },
    }).select('postId').lean();
    return new Set(list.map((b) => (b.postId ? b.postId.toString() : '')));
  } catch {
    return new Set();
  }
}

async function listPosts(query, user) {
  const { mine, q, category, authorId, sort, page, limit } = query;

  if (mine) {
    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    }

    const filter = { author: user._id };
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      Post.countDocuments(filter),
      Post.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'name bio')
        .populate('category', 'name description')
        .lean(),
    ]);

    const postIds = items.map((p) => p._id);
    const [countMap, bookmarkedSet] = await Promise.all([
      getCommentCountsForPosts(postIds),
      getBookmarkedPostIdsForUser(user?._id, postIds),
    ]);

    return {
      posts: items.map((p) =>
        shapePost(p, countMap.get(p._id.toString()) || 0, bookmarkedSet.has(p._id.toString()))
      ),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  const filter = { status: 'published' };
  if (category) filter.category = category;
  if (authorId) filter.author = authorId;
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: regex }, { searchText: regex }];
  }

  const skip = (page - 1) * limit;
  let total;
  let items;
  let countMap = new Map();

  if (sort === 'discussed') {
    let commentStats = [];
    if (canQueryComment('aggregate')) {
      try {
        commentStats = await Comment.aggregate([
          { $group: { _id: '$post', count: { $sum: 1 } } },
        ]);
      } catch {
        commentStats = [];
      }
    }
    countMap = new Map(commentStats.map((s) => [s._id ? s._id.toString() : '', s.count]));

    total = await Post.countDocuments(filter);
    const allMatching = await Post.find(filter)
      .populate('author', 'name bio')
      .populate('category', 'name description')
      .lean();

    allMatching.sort((a, b) => {
      const aCount = countMap.get(a._id.toString()) || 0;
      const bCount = countMap.get(b._id.toString()) || 0;
      if (bCount !== aCount) return bCount - aCount;
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });

    items = allMatching.slice(skip, skip + limit);
  } else {
    const sortSpec = sort === 'oldest' ? { publishedAt: 1, _id: 1 } : { publishedAt: -1, _id: -1 };
    [total, items] = await Promise.all([
      Post.countDocuments(filter),
      Post.find(filter)
        .sort(sortSpec)
        .skip(skip)
        .limit(limit)
        .populate('author', 'name bio')
        .populate('category', 'name description')
        .lean(),
    ]);

    const postIds = items.map((p) => p._id);
    countMap = await getCommentCountsForPosts(postIds);
  }

  const postIds = items.map((p) => p._id);
  const bookmarkedSet = await getBookmarkedPostIdsForUser(user?._id, postIds);

  return {
    posts: items.map((p) =>
      shapePost(p, countMap.get(p._id.toString()) || 0, bookmarkedSet.has(p._id.toString()))
    ),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

async function findPopulatedPost(id) {
  return Post.findById(id)
    .populate('author', 'name bio')
    .populate('category', 'name description')
    .lean();
}

async function assertCategoryExists(categoryId) {
  if (!categoryId) return;
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Selected category does not exist.');
  }
}

function assertAuthor(post, user, message) {
  const authorId = post.author && post.author._id ? post.author._id.toString() : String(post.author);
  const userId = user.id || (user._id ? user._id.toString() : '');
  if (authorId !== userId) {
    throw new AppError(403, 'FORBIDDEN', message);
  }
}

async function getPostById(id, user) {
  const post = await findPopulatedPost(id);

  if (!post) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
  }

  if (post.status === 'draft') {
    const authorId = post.author && post.author._id ? post.author._id.toString() : String(post.author);
    const canViewDraft = user && (user.id === authorId || user.role === 'admin');
    if (!canViewDraft) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
    }
  }

  const [commentCount, isBookmarked] = await Promise.all([
    canQueryComment('countDocuments') ? Comment.countDocuments({ post: post._id }) : Promise.resolve(0),
    user && canQueryBookmark('findOne')
      ? Bookmark.findOne({ userId: user._id, postId: post._id }).then(Boolean)
      : Promise.resolve(false),
  ]);
  return shapePost(post, commentCount, isBookmarked);
}

async function createPost(data, user) {
  await assertCategoryExists(data.categoryId);

  const publishedAt = data.status === 'published' ? new Date() : null;
  const created = await Post.create({
    title: data.title,
    content: data.content,
    author: user._id,
    category: data.categoryId || null,
    status: data.status,
    publishedAt,
  });

  const populated = await findPopulatedPost(created._id);
  return shapePost(populated, 0, false);
}

async function updatePost(id, data, user) {
  const existing = await Post.findById(id);
  if (!existing) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
  }

  assertAuthor(existing, user, 'You can only edit your own posts.');

  const nextStatus = data.status !== undefined ? data.status : existing.status;
  const nextCategoryId =
    data.categoryId !== undefined
      ? data.categoryId
      : existing.category
        ? existing.category.toString()
        : null;
  const nextContent = data.content !== undefined ? data.content : existing.content;

  await assertCategoryExists(nextCategoryId);

  if (nextStatus === 'published') {
    if (!nextCategoryId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Choose a category before publishing.');
    }
    if (isEmptyDoc(nextContent)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Write some content before publishing.');
    }
  }

  if (data.title !== undefined) existing.title = data.title;
  if (data.content !== undefined) {
    existing.content = data.content;
    if (typeof existing.markModified === 'function') {
      existing.markModified('content');
    }
  }
  if (data.categoryId !== undefined) existing.category = data.categoryId || null;
  existing.status = nextStatus;
  if (nextStatus === 'published' && !existing.publishedAt) {
    existing.publishedAt = new Date();
  }

  await existing.save();

  const populated = await findPopulatedPost(existing._id);
  const [commentCount, isBookmarked] = await Promise.all([
    canQueryComment('countDocuments') ? Comment.countDocuments({ post: existing._id }) : Promise.resolve(0),
    user && canQueryBookmark('findOne')
      ? Bookmark.findOne({ userId: user._id, postId: existing._id }).then(Boolean)
      : Promise.resolve(false),
  ]);
  return shapePost(populated, commentCount, isBookmarked);
}

async function deletePost(id, user) {
  const existing = await Post.findById(id);
  if (!existing) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
  }

  assertAuthor(existing, user, 'You can only delete your own posts.');

  await cascadeDeletePost(existing._id);

  return { ok: true };
}

module.exports = {
  listPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  shapePost,
  getCommentCountsForPosts,
  getBookmarkedPostIdsForUser,
};

