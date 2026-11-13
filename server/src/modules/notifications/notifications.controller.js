const notificationsService = require('./notifications.service');

async function listNotifications(req, res) {
  const notifications = await notificationsService.listNotifications(req.user);
  res.status(200).json(notifications);
}

async function markNotificationRead(req, res) {
  const result = await notificationsService.markNotificationRead(req.params.id, req.user);
  res.status(200).json(result);
}

module.exports = {
  listNotifications,
  markNotificationRead,
};

