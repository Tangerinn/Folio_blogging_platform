const express = require('express');
const rateLimit = require('express-rate-limit');
const { validateBody } = require('../../middleware/validate');
const { parseRegister, parseLogin, parseRefresh } = require('./auth.validation');
const authController = require('./auth.controller');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Please try again later.' },
    });
  },
});

router.post('/register', authLimiter, validateBody(parseRegister), authController.register);
router.post('/login', authLimiter, validateBody(parseLogin), authController.login);
router.post('/refresh', validateBody(parseRefresh), authController.refresh);
router.post('/logout', validateBody(parseRefresh), authController.logout);

module.exports = router;

