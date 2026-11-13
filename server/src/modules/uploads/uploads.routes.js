const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../../middleware/auth');
const AppError = require('../../utils/AppError');
const uploadsController = require('./uploads.controller');

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many uploads. Please try again later.' },
    });
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (!allowed.has(file.mimetype)) {
      return cb(new AppError(400, 'VALIDATION_ERROR', 'Only PNG, JPEG, WebP, and GIF images are allowed.'));
    }
    return cb(null, true);
  },
});

function handleUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(400, 'VALIDATION_ERROR', 'Image must be 5 MB or smaller.'));
      }
      return next(new AppError(400, 'VALIDATION_ERROR', err.message));
    }
    return next(err);
  });
}

router.post('/image', requireAuth, uploadLimiter, handleUpload, uploadsController.uploadImage);

module.exports = router;

