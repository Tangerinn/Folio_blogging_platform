const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { validateObjectIdParam } = require('../../middleware/validate');
const notificationsController = require('./notifications.controller');

const router = express.Router();

router.get('/', requireAuth, notificationsController.listNotifications);
router.patch(
  '/:id/read',
  requireAuth,
  validateObjectIdParam('id', 'notification ID'),
  notificationsController.markNotificationRead
);

module.exports = router;

