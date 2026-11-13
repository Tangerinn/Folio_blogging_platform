const express = require('express');
const { optionalAuth } = require('../../middleware/auth');
const categoriesController = require('./categories.controller');

const router = express.Router();

router.get('/', optionalAuth, categoriesController.listCategories);

module.exports = router;

