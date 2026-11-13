const Post = require('../../models/Post');
const Comment = require('../../models/Comment');
const Report = require('../../models/Report');
const AppError = require('../../utils/AppError');

async function createReport({ targetType, targetId, reason }, user) {
  if (targetType === 'post') {
    const post = await Post.findById(targetId);
    if (!post) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
    }
    const authorId = post.author ? post.author.toString() : '';
    const userId = user.id || (user._id ? user._id.toString() : '');
    if (post.status !== 'published' && authorId !== userId && user.role !== 'admin') {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
    }
  } else {
    const comment = await Comment.findById(targetId);
    if (!comment) {
      throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Comment not found.');
    }
  }

  await Report.create({
    reporter: user._id,
    targetType,
    targetId,
    reason,
    status: 'pending',
  });

  return { ok: true };
}

module.exports = { createReport };

