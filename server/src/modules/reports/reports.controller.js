const reportsService = require('./reports.service');

async function createReport(req, res) {
  const result = await reportsService.createReport(req.body, req.user);
  res.status(201).json(result);
}

module.exports = { createReport };

