const bookmarksService = require('./bookmarks.service');

async function addBookmark(req, res) {
  const result = await bookmarksService.addBookmark(req.params.id, req.user);
  res.status(200).json(result);
}

async function removeBookmark(req, res) {
  const result = await bookmarksService.removeBookmark(req.params.id, req.user);
  res.status(200).json(result);
}

async function listBookmarks(req, res) {
  const { posts, pagination } = await bookmarksService.listBookmarks(req.validatedQuery, req.user);
  res.set({
    'X-Total-Count': String(pagination.total),
    'X-Page': String(pagination.page),
    'X-Limit': String(pagination.limit),
    'X-Total-Pages': String(pagination.totalPages),
  });
  res.status(200).json(posts);
}

module.exports = {
  addBookmark,
  removeBookmark,
  listBookmarks,
};

