// src/app.js – Express application bootstrap
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: env.CORS_ORIGIN || false,
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit', 'X-Total-Pages'],
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    });
  },
});
app.use('/api/', apiLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api', apiRoutes);
app.use('/api', notFoundHandler);
app.use(errorHandler);

module.exports = app;
