const express = require('express');
const { requireAuth, optionalAuth } = require('../../middleware/auth');
const { validateBody, validateQuery, validateObjectIdParam } = require('../../middleware/validate');
const { parseListPostsQuery, parseCreatePost, parseUpdatePost } = require('./posts.validation');
const { parseCreateComment } = require('../comments/comments.validation');
const postsController = require('./posts.controller');
const commentsController = require('../comments/comments.controller');
const bookmarksController = require('../bookmarks/bookmarks.controller');

const router = express.Router();

router.get('/', optionalAuth, validateQuery(parseListPostsQuery), postsController.listPosts);
router.post('/', requireAuth, validateBody(parseCreatePost), postsController.createPost);
router.get('/:id', optionalAuth, validateObjectIdParam('id', 'post ID'), postsController.getPostById);
router.patch(
  '/:id',
  requireAuth,
  validateObjectIdParam('id', 'post ID'),
  validateBody(parseUpdatePost),
  postsController.updatePost
);
router.delete('/:id', requireAuth, validateObjectIdParam('id', 'post ID'), postsController.deletePost);

router.get(
  '/:id/comments',
  optionalAuth,
  validateObjectIdParam('id', 'post ID'),
  commentsController.listComments
);
router.post(
  '/:id/comments',
  requireAuth,
  validateObjectIdParam('id', 'post ID'),
  validateBody(parseCreateComment),
  commentsController.createComment
);

router.post(
  '/:id/bookmark',
  requireAuth,
  validateObjectIdParam('id', 'post ID'),
  bookmarksController.addBookmark
);
router.delete(
  '/:id/bookmark',
  requireAuth,
  validateObjectIdParam('id', 'post ID'),
  bookmarksController.removeBookmark
);

module.exports = router;

