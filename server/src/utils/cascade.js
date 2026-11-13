const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Bookmark = require('../models/Bookmark');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const { canQueryModel } = require('./modelGuard');

/**
 * Deletes a post and cascades to its comments, bookmarks, notifications, and targeting reports.
 * Optionally preserves a single resolved Report record for moderation history.
 */
async function cascadeDeletePost(postId, { excludeReportId = null } = {}) {
  let commentIds = [];
  if (canQueryModel(Comment, 'find')) {
    const comments = await Comment.find({ post: postId }).lean();
    if (Array.isArray(comments)) {
      commentIds = comments.map((c) => c._id);
    }
  }

  if (canQueryModel(Notification, 'deleteMany')) {
    await Notification.deleteMany({ post: postId });
  }

  if (canQueryModel(Report, 'deleteMany')) {
    const targetOr = [{ targetType: 'post', targetId: postId }];
    if (commentIds.length > 0) {
      targetOr.push({ targetType: 'comment', targetId: { $in: commentIds } });
    }
    const reportFilter = excludeReportId
      ? { _id: { $ne: excludeReportId }, $or: targetOr }
      : { $or: targetOr };
    await Report.deleteMany(reportFilter);
  }

  if (canQueryModel(Comment, 'deleteMany')) {
    await Comment.deleteMany({ post: postId });
  }
  if (canQueryModel(Bookmark, 'deleteMany')) {
    await Bookmark.deleteMany({ postId });
  }
  await Post.deleteOne({ _id: postId });
}

/**
 * Deletes a comment, its 1-level replies, related notifications, and targeting reports.
 * Optionally preserves a single resolved Report record for moderation history.
 */
async function cascadeDeleteComment(commentId, { excludeReportId = null } = {}) {
  let targetIds = [commentId];
  if (canQueryModel(Comment, 'find')) {
    const replies = await Comment.find({ parentId: commentId }).lean();
    if (Array.isArray(replies)) {
      targetIds = [commentId, ...replies.map((r) => r._id)];
    }
  }

  if (canQueryModel(Notification, 'deleteMany')) {
    await Notification.deleteMany({ comment: { $in: targetIds } });
  }

  if (canQueryModel(Report, 'deleteMany')) {
    const reportFilter = {
      targetType: 'comment',
      targetId: { $in: targetIds },
      ...(excludeReportId ? { _id: { $ne: excludeReportId } } : {}),
    };
    await Report.deleteMany(reportFilter);
  }

  await Comment.deleteMany({ $or: [{ _id: commentId }, { parentId: commentId }] });
}

module.exports = {
  cascadeDeletePost,
  cascadeDeleteComment,
};
