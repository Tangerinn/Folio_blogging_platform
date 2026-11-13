const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.postId = ret.post ? ret.post.toString() : null;
        ret.parentId = ret.parentId ? ret.parentId.toString() : null;
        delete ret._id;
        delete ret.__v;
        delete ret.post;
        return ret;
      },
    },
  }
);

commentSchema.index({ post: 1, createdAt: 1 });
commentSchema.index({ parentId: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);

