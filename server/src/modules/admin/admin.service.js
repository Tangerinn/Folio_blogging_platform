const User = require('../../models/User');
const Post = require('../../models/Post');
const Comment = require('../../models/Comment');
const Category = require('../../models/Category');
const Report = require('../../models/Report');
const RefreshToken = require('../../models/RefreshToken');
const AppError = require('../../utils/AppError');
const { canQueryModel } = require('../../utils/modelGuard');
const { cascadeDeletePost, cascadeDeleteComment } = require('../../utils/cascade');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shapeCategory(c) {
  return {
    id: c._id.toString(),
    name: c.name,
    description: c.description || '',
  };
}

async function getStats() {
  const [users, publishedPosts, comments, pendingReports, recentPosts, recentComments, recentUsers] =
    await Promise.all([
      User.countDocuments(),
      Post.countDocuments({ status: 'published' }),
      Comment.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      Post.find({ status: 'published' })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(8)
        .populate('author', 'name')
        .lean(),
      Comment.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('author', 'name')
        .populate('post', 'title')
        .lean(),
      User.find().sort({ createdAt: -1 }).limit(8).lean(),
    ]);

  const events = [
    ...recentPosts.map((p) => ({
      id: `post-${p._id.toString()}`,
      text: `${p.author?.name || 'Someone'} published “${p.title}”`,
      at: p.publishedAt || p.createdAt,
    })),
    ...recentComments.map((c) => ({
      id: `comment-${c._id.toString()}`,
      text: `${c.author?.name || 'Someone'} commented on “${c.post?.title || 'a post'}”`,
      at: c.createdAt,
    })),
    ...recentUsers.map((u) => ({
      id: `user-${u._id.toString()}`,
      text: `${u.name} joined Folio`,
      at: u.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8);

  return { users, publishedPosts, comments, pendingReports, recent: events };
}

async function listUsers({ q }) {
  const filter = {};
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const users = await User.find(filter).sort({ createdAt: -1 });
  return users.map((u) => u.toJSON());
}

async function updateUser(id, patch, currentUser) {
  const selfId = currentUser.id || (currentUser._id ? currentUser._id.toString() : '');
  if (id === selfId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'You cannot modify your own role or status.');
  }

  const target = await User.findById(id);
  if (!target) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'User not found.');
  }

  if (patch.role !== undefined) target.role = patch.role;
  if (patch.status !== undefined) target.status = patch.status;
  await target.save();

  if (patch.status === 'suspended' && canQueryModel(RefreshToken, 'updateMany')) {
    await RefreshToken.updateMany(
      { userId: target._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  }

  return target.toJSON();
}

async function listReports({ status }) {
  const filter = status ? { status } : {};
  const reports = await Report.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .populate('reporter', 'name')
    .lean();

  if (reports.length === 0) return [];

  const postIds = reports.filter((r) => r.targetType === 'post').map((r) => r.targetId);
  const commentIds = reports.filter((r) => r.targetType === 'comment').map((r) => r.targetId);

  const [posts, comments] = await Promise.all([
    postIds.length > 0
      ? Post.find({ _id: { $in: postIds } }).populate('author', 'name').lean()
      : Promise.resolve([]),
    commentIds.length > 0
      ? Comment.find({ _id: { $in: commentIds } }).populate('author', 'name').lean()
      : Promise.resolve([]),
  ]);

  const postMap = new Map(posts.map((p) => [p._id.toString(), p]));
  const commentMap = new Map(comments.map((c) => [c._id.toString(), c]));

  return reports.map((r) => {
    const reporterDoc = r.reporter && typeof r.reporter === 'object' ? r.reporter : null;
    const targetIdStr = r.targetId ? r.targetId.toString() : '';

    let target = null;
    if (r.targetType === 'post') {
      const post = postMap.get(targetIdStr);
      if (post) {
        target = {
          id: post._id.toString(),
          title: post.title,
          author: post.author?.name || 'Deleted user',
          postId: post._id.toString(),
        };
      }
    } else if (r.targetType === 'comment') {
      const comment = commentMap.get(targetIdStr);
      if (comment) {
        const text = String(comment.content || '');
        const excerpt = text.length > 140 ? `${text.slice(0, 137)}...` : text;
        target = {
          id: comment._id.toString(),
          excerpt,
          author: comment.author?.name || 'Deleted user',
          postId: comment.post ? comment.post.toString() : '',
        };
      }
    }

    return {
      id: r._id.toString(),
      reporterId: reporterDoc ? reporterDoc._id.toString() : r.reporter ? r.reporter.toString() : '',
      reporter: reporterDoc?.name || 'Deleted user',
      targetType: r.targetType,
      targetId: targetIdStr,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      target,
    };
  });
}

async function updateReport(id, { action }) {
  const report = await Report.findById(id);
  if (!report) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Report not found.');
  }

  if (action === 'dismiss') {
    report.status = 'dismissed';
    await report.save();
    return { ok: true };
  }

  if (report.targetType === 'post') {
    await cascadeDeletePost(report.targetId, { excludeReportId: report._id });
  } else if (report.targetType === 'comment') {
    await cascadeDeleteComment(report.targetId, { excludeReportId: report._id });
  }

  report.status = 'resolved';
  await report.save();
  return { ok: true };
}

async function createCategory({ name, description }) {
  const existing = await Category.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'A category with this name already exists.');
  }

  const created = await Category.create({ name, description });
  return shapeCategory(created);
}

async function updateCategory(id, { name, description }) {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Category not found.');
  }

  const duplicate = await Category.findOne({
    _id: { $ne: category._id },
    name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
  });
  if (duplicate) {
    throw new AppError(409, 'CONFLICT', 'A category with this name already exists.');
  }

  category.name = name;
  category.description = description;
  await category.save();
  return shapeCategory(category);
}

async function deleteCategory(id) {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Category not found.');
  }

  const postCount = await Post.countDocuments({ category: category._id });
  if (postCount > 0) {
    throw new AppError(409, 'CONFLICT', 'Move or delete this category’s posts first.');
  }

  await Category.deleteOne({ _id: category._id });
  return { ok: true };
}

module.exports = {
  getStats,
  listUsers,
  updateUser,
  listReports,
  updateReport,
  createCategory,
  updateCategory,
  deleteCategory,
};

