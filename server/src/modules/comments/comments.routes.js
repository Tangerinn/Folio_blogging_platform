const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { validateBody, validateObjectIdParam } = require('../../middleware/validate');
const { parseCreateReply, parseUpdateComment } = require('./comments.validation');
const commentsController = require('./comments.controller');

const router = express.Router();

router.post(
  '/:id/replies',
  requireAuth,
  validateObjectIdParam('id', 'comment ID'),
  validateBody(parseCreateReply),
  commentsController.createReply
);

router.patch(
  '/:id',
  requireAuth,
  validateObjectIdParam('id', 'comment ID'),
  validateBody(parseUpdateComment),
  commentsController.updateComment
);

router.delete(
  '/:id',
  requireAuth,
  validateObjectIdParam('id', 'comment ID'),
  commentsController.deleteComment
);

module.exports = router;

