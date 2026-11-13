const Comment = require('../../models/Comment');
const Post = require('../../models/Post');
const AppError = require('../../utils/AppError');
const { cascadeDeleteComment } = require('../../utils/cascade');
const { createNotification } = require('../notifications/notifications.service');
const { emitComment } = require('../../realtime');

function shapeAuthor(author) {
  if (author && typeof author === 'object' && author.name) {
    return {
      id: author._id ? author._id.toString() : author.id,
      name: author.name,
      bio: author.bio || '',
    };
  }
  return {
    id: author ? author.toString() : '',
    name: 'Deleted user',
    bio: '',
  };
}

function shapeComment(comment) {
  const author = shapeAuthor(comment.author);
  const postId = comment.post && comment.post._id
    ? comment.post._id.toString()
    : comment.post
      ? comment.post.toString()
      : (comment.postId || '');
  const parentId = comment.parentId
    ? (comment.parentId._id ? comment.parentId._id.toString() : comment.parentId.toString())
    : null;

  return {
    id: comment._id ? comment._id.toString() : comment.id,
    postId,
    parentId,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author,
  };
}

function shapeCommentTree(allComments) {
  const topLevel = [];
  const repliesByParent = new Map();

  for (const c of allComments) {
    const shaped = shapeComment(c);
    if (!shaped.parentId) {
      topLevel.push(shaped);
    } else {
      const list = repliesByParent.get(shaped.parentId) || [];
      list.push(shaped);
      repliesByParent.set(shaped.parentId, list);
    }
  }

  return topLevel.map((top) => ({
    ...top,
    replies: repliesByParent.get(top.id) || [],
  }));
}

function canAccessPost(post, user) {
  if (!post) return false;
  if (post.status === 'published') return true;
  const authorId = post.author && post.author._id ? post.author._id.toString() : String(post.author);
  const userId = user ? (user.id || (user._id ? user._id.toString() : '')) : '';
  return Boolean(user && (userId === authorId || user.role === 'admin'));
}

async function listComments(postId, user) {
  const post = await Post.findById(postId);
  if (!canAccessPost(post, user)) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
  }

  const comments = await Comment.find({ post: postId })
    .sort({ createdAt: 1 })
    .populate('author', 'name bio')
    .lean();

  return shapeCommentTree(comments);
}

async function createComment(postId, data, user) {
  const post = await Post.findById(postId);
  if (!canAccessPost(post, user)) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
  }

  const created = await Comment.create({
    post: post._id,
    author: user._id,
    parentId: null,
    content: data.content,
  });

  const actorId = user.id || (user._id ? user._id.toString() : '');
  await createNotification({
    recipient: post.author,
    actorId,
    type: 'comment',
    message: `${user.name} commented on "${post.title}"`,
    post: post._id,
    comment: created._id,
  });

  const populated = await Comment.findById(created._id).populate('author', 'name bio').lean();
  const shaped = { ...shapeComment(populated), replies: [] };
  emitComment(post._id.toString(), shaped);
  return shaped;
}

async function createReply(commentId, data, user) {
  const parent = await Comment.findById(commentId);
  if (!parent) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Comment not found.');
  }

  if (parent.parentId) {
    throw new AppError(400, 'REPLY_TO_REPLY', 'Replies can only be one level deep.');
  }

  const post = await Post.findById(parent.post);
  if (!canAccessPost(post, user)) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
  }

  const created = await Comment.create({
    post: parent.post,
    author: user._id,
    parentId: parent._id,
    content: data.content,
  });

  const actorId = user.id || (user._id ? user._id.toString() : '');
  await createNotification({
    recipient: parent.author,
    actorId,
    type: 'reply',
    message: `${user.name} replied to your comment on "${post.title}"`,
    post: post._id,
    comment: created._id,
  });

  const populated = await Comment.findById(created._id).populate('author', 'name bio').lean();
  const shaped = shapeComment(populated);
  emitComment(post._id.toString(), shaped);
  return shaped;
}

async function updateComment(id, data, user) {
  const comment = await Comment.findById(id);
  if (!comment) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Comment not found.');
  }

  const authorId = comment.author && comment.author._id ? comment.author._id.toString() : String(comment.author);
  const userId = user.id || (user._id ? user._id.toString() : '');
  if (authorId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only edit your own comments.');
  }

  comment.content = data.content;
  await comment.save();

  return { ok: true };
}

async function deleteComment(id, user) {
  const comment = await Comment.findById(id);
  if (!comment) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Comment not found.');
  }

  const authorId = comment.author && comment.author._id ? comment.author._id.toString() : String(comment.author);
  const userId = user.id || (user._id ? user._id.toString() : '');
  if (authorId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only delete your own comments.');
  }

  await cascadeDeleteComment(comment._id);

  return { ok: true };
}

module.exports = {
  listComments,
  createComment,
  createReply,
  updateComment,
  deleteComment,
  shapeComment,
  shapeCommentTree,
};

