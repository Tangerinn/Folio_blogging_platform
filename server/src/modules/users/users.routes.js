const express = require('express');
const { requireAuth, optionalAuth } = require('../../middleware/auth');
const { validateBody, validateObjectIdParam } = require('../../middleware/validate');
const { parseUpdateProfile } = require('./users.validation');
const usersController = require('./users.controller');

const router = express.Router();

router.get('/me', requireAuth, usersController.getMe);
router.patch('/me', requireAuth, validateBody(parseUpdateProfile), usersController.updateMe);

router.get(
  '/:id',
  optionalAuth,
  validateObjectIdParam('id', 'user ID'),
  usersController.getUserProfile
);

module.exports = router;
