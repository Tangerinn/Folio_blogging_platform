const express = require('express');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { validateBody, validateQuery, validateObjectIdParam } = require('../../middleware/validate');
const {
  parseAdminUsersQuery,
  parseAdminUpdateUser,
  parseAdminReportsQuery,
  parseAdminUpdateReport,
  parseAdminCategoryBody,
} = require('./admin.validation');
const adminController = require('./admin.controller');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/stats', adminController.getStats);

router.get('/users', validateQuery(parseAdminUsersQuery), adminController.listUsers);
router.patch(
  '/users/:id',
  validateObjectIdParam('id', 'user ID'),
  validateBody(parseAdminUpdateUser),
  adminController.updateUser
);

router.get('/reports', validateQuery(parseAdminReportsQuery), adminController.listReports);
router.patch(
  '/reports/:id',
  validateObjectIdParam('id', 'report ID'),
  validateBody(parseAdminUpdateReport),
  adminController.updateReport
);

router.post('/categories', validateBody(parseAdminCategoryBody), adminController.createCategory);
router.patch(
  '/categories/:id',
  validateObjectIdParam('id', 'category ID'),
  validateBody(parseAdminCategoryBody),
  adminController.updateCategory
);
router.delete(
  '/categories/:id',
  validateObjectIdParam('id', 'category ID'),
  adminController.deleteCategory
);

module.exports = router;

