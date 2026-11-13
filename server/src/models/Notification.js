const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['comment', 'reply'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.recipientId = ret.recipient ? ret.recipient.toString() : '';
        ret.postId = ret.post ? ret.post.toString() : '';
        delete ret._id;
        delete ret.__v;
        delete ret.recipient;
        delete ret.post;
        delete ret.comment;
        delete ret.updatedAt;
        return ret;
      },
    },
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ post: 1 });
notificationSchema.index({ comment: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

