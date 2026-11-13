const Notification = require('../../models/Notification');
const AppError = require('../../utils/AppError');
const { canQueryModel } = require('../../utils/modelGuard');
const { emitNotification } = require('../../realtime');

function shapeNotification(n) {
  return {
    id: n._id.toString(),
    recipientId: n.recipient ? n.recipient.toString() : '',
    type: n.type,
    message: n.message,
    postId: n.post ? n.post.toString() : '',
    read: Boolean(n.read),
    createdAt: n.createdAt,
  };
}

async function createNotification({ recipient, actorId, type, message, post, comment }) {
  const recipientId = recipient && recipient._id ? recipient._id.toString() : String(recipient || '');
  if (!recipientId || recipientId === String(actorId || '')) {
    return null;
  }
  if (!canQueryModel(Notification, 'create')) {
    return null;
  }

  const created = await Notification.create({
    recipient,
    type,
    message,
    post,
    comment,
    read: false,
  });

  const shaped = shapeNotification(created);
  emitNotification(recipientId, shaped);
  return shaped;
}

async function listNotifications(user) {
  const list = await Notification.find({ recipient: user._id })
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  return list.map(shapeNotification);
}

async function markNotificationRead(id, user) {
  const notification = await Notification.findById(id);
  if (!notification) {
    throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Notification not found.');
  }

  const recipientId = notification.recipient ? notification.recipient.toString() : '';
  const userId = user.id || (user._id ? user._id.toString() : '');
  if (recipientId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only update your own notifications.');
  }

  if (!notification.read) {
    notification.read = true;
    await notification.save();
  }

  return { ok: true };
}

module.exports = {
  createNotification,
  listNotifications,
  markNotificationRead,
  shapeNotification,
};

