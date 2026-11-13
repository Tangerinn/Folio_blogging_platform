const categoriesService = require('./categories.service');

async function listCategories(_req, res) {
  const categories = await categoriesService.listCategories();
  res.status(200).json(categories);
}

module.exports = { listCategories };

