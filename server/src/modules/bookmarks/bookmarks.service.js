const Bookmark = require('../../models/Bookmark');
const Post = require('../../models/Post');
const AppError = require('../../utils/AppError');
const { shapePost, getCommentCountsForPosts } = require('../posts/posts.service');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function canUserAccessPost(post, user) {
  if (!post) return false;
  if (post.status === 'published') return true;
  const authorId = post.author && post.author._id ? post.author._id.toString() : String(post.author);
  const userId = user ? (user.id || (user._id ? user._id.toString() : '')) : '';
  return Boolean(user && (userId === authorId || user.role === 'admin'));
}

async function addBookmark(postId, user) {
  const post = await Post.findById(postId);
  if (!canUserAccessPost(post, user)) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
  }

  await Bookmark.updateOne(
    { userId: user._id, postId: post._id },
    { $setOnInsert: { userId: user._id, postId: post._id } },
    { upsert: true }
  );

  return { ok: true };
}

async function removeBookmark(postId, user) {
  await Bookmark.deleteOne({ userId: user._id, postId });
  return { ok: true };
}

async function listBookmarks(query, user) {
  const { q, category, page, limit } = query;

  const allBookmarks = await Bookmark.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .lean();

  if (!allBookmarks || allBookmarks.length === 0) {
    return {
      posts: [],
      pagination: { total: 0, page, limit, totalPages: 0 },
    };
  }

  const bookmarkedPostIds = allBookmarks.map((b) => b.postId);
  const filter = { _id: { $in: bookmarkedPostIds }, status: 'published' };
  if (category) filter.category = category;
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: regex }, { searchText: regex }];
  }

  const matchingPosts = await Post.find(filter)
    .populate('author', 'name bio')
    .populate('category', 'name description')
    .lean();

  const orderMap = new Map(bookmarkedPostIds.map((id, index) => [id.toString(), index]));
  matchingPosts.sort((a, b) => {
    const orderA = orderMap.get(a._id.toString()) ?? 999999;
    const orderB = orderMap.get(b._id.toString()) ?? 999999;
    return orderA - orderB;
  });

  const total = matchingPosts.length;
  const skip = (page - 1) * limit;
  const paged = matchingPosts.slice(skip, skip + limit);

  const countMap = await getCommentCountsForPosts(paged.map((p) => p._id));
  const posts = paged.map((p) => shapePost(p, countMap.get(p._id.toString()) || 0, true));

  return {
    posts,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

module.exports = {
  addBookmark,
  removeBookmark,
  listBookmarks,
};

