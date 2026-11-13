const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const usersRoutes = require('../modules/users/users.routes');
const categoriesRoutes = require('../modules/categories/categories.routes');
const postsRoutes = require('../modules/posts/posts.routes');
const commentsRoutes = require('../modules/comments/comments.routes');
const bookmarksRoutes = require('../modules/bookmarks/bookmarks.routes');
const notificationsRoutes = require('../modules/notifications/notifications.routes');
const reportsRoutes = require('../modules/reports/reports.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const uploadsRoutes = require('../modules/uploads/uploads.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/categories', categoriesRoutes);
router.use('/posts', postsRoutes);
router.use('/comments', commentsRoutes);
router.use('/bookmarks', bookmarksRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/reports', reportsRoutes);
router.use('/admin', adminRoutes);
router.use('/uploads', uploadsRoutes);

module.exports = router;
