const adminService = require('./admin.service');

async function getStats(_req, res) {
  const stats = await adminService.getStats();
  res.status(200).json(stats);
}

async function listUsers(req, res) {
  const users = await adminService.listUsers(req.validatedQuery || req.query);
  res.status(200).json(users);
}

async function updateUser(req, res) {
  const user = await adminService.updateUser(req.params.id, req.body, req.user);
  res.status(200).json(user);
}

async function listReports(req, res) {
  const reports = await adminService.listReports(req.validatedQuery || req.query);
  res.status(200).json(reports);
}

async function updateReport(req, res) {
  const result = await adminService.updateReport(req.params.id, req.body);
  res.status(200).json(result);
}

async function createCategory(req, res) {
  const category = await adminService.createCategory(req.body);
  res.status(201).json(category);
}

async function updateCategory(req, res) {
  const category = await adminService.updateCategory(req.params.id, req.body);
  res.status(200).json(category);
}

async function deleteCategory(req, res) {
  const result = await adminService.deleteCategory(req.params.id);
  res.status(200).json(result);
}

module.exports = {
  getStats,
  listUsers,
  updateUser,
  listReports,
  updateReport,
  createCategory,
  updateCategory,
  deleteCategory,
};

