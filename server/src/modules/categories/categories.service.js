const Category = require('../../models/Category');
const Post = require('../../models/Post');

async function listCategories() {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    Post.aggregate([
      { $match: { status: 'published', category: { $ne: null } } },
      { $group: { _id: '$category', postCount: { $sum: 1 } } },
    ]),
  ]);

  const countMap = new Map(counts.map((c) => [c._id.toString(), c.postCount]));

  return categories.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    description: c.description || '',
    postCount: countMap.get(c._id.toString()) || 0,
  }));
}

module.exports = { listCategories };

