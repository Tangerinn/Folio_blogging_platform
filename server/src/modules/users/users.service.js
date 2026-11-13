const User = require('../../models/User');
const Post = require('../../models/Post');
const AppError = require('../../utils/AppError');
const {
  shapePost,
  getCommentCountsForPosts,
  getBookmarkedPostIdsForUser,
} = require('../posts/posts.service');

async function getUserProfile(userId, currentUser) {
  const targetUser = await User.findById(userId);
  if (!targetUser || targetUser.status === 'suspended') {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'User not found.');
  }

  const posts = await Post.find({
    author: targetUser._id,
    status: 'published',
  })
    .sort({ publishedAt: -1, _id: -1 })
    .populate('author', 'name bio')
    .populate('category', 'name description')
    .lean();

  const postIds = posts.map((p) => p._id);
  const [countMap, bookmarkedSet] = await Promise.all([
    getCommentCountsForPosts(postIds),
    getBookmarkedPostIdsForUser(currentUser?._id, postIds),
  ]);

  const shapedPosts = posts.map((p) =>
    shapePost(
      p,
      countMap.get(p._id.toString()) || 0,
      bookmarkedSet.has(p._id.toString())
    )
  );

  return {
    user: {
      id: targetUser._id.toString(),
      name: targetUser.name,
      bio: targetUser.bio || '',
      createdAt: targetUser.createdAt,
    },
    posts: shapedPosts,
  };
}

async function updateProfile(updates, currentUser) {
  if (updates.name !== undefined) {
    currentUser.name = updates.name;
  }
  if (updates.bio !== undefined) {
    currentUser.bio = updates.bio;
  }

  await currentUser.save();
  return currentUser.toJSON();
}

module.exports = {
  getUserProfile,
  updateProfile,
};

