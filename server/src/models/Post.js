const mongoose = require('mongoose');
const { extractText } = require('../utils/content');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    searchText: {
      type: String,
      default: '',
      select: false,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.searchText;
        return ret;
      },
    },
  }
);

postSchema.pre('validate', function syncSearchText() {
  if (this.isModified('content') || this.isNew) {
    this.searchText = extractText(this.content).replace(/\s+/g, ' ').trim();
  }
});

postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ status: 1, category: 1, publishedAt: -1 });
postSchema.index({ status: 1, author: 1, publishedAt: -1 });
postSchema.index({ author: 1, updatedAt: -1 });
postSchema.index({ title: 'text', searchText: 'text' });

module.exports = mongoose.model('Post', postSchema);

