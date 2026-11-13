const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validate');
const { parseCreateReport } = require('./reports.validation');
const reportsController = require('./reports.controller');

const router = express.Router();

router.post('/', requireAuth, validateBody(parseCreateReport), reportsController.createReport);

module.exports = router;

