const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.userId = ret.userId.toString();
        ret.postId = ret.postId.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

bookmarkSchema.index({ userId: 1, postId: 1 }, { unique: true });
bookmarkSchema.index({ userId: 1, createdAt: -1 });
bookmarkSchema.index({ postId: 1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
