const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { validateQuery } = require('../../middleware/validate');
const { parseListBookmarksQuery } = require('./bookmarks.validation');
const bookmarksController = require('./bookmarks.controller');

const router = express.Router();

router.get('/', requireAuth, validateQuery(parseListBookmarksQuery), bookmarksController.listBookmarks);

module.exports = router;

