// src/app.js – Express application bootstrap
// Loads environment, sets core middle‑wares, and registers placeholder route mounts.

// Environment variables are loaded in server.js before app import

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Create Express app
const app = express();

// Security & utility middle‑wares
app.use(helmet()); // Basic security headers
app.use(morgan('dev'));
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL‑encoded bodies

// CORS configuration – allow explicit origin if provided, otherwise block all for safety.
const allowedOrigin = process.env.CORS_ORIGIN || '';
app.use(
  cors({
    origin: allowedOrigin || false,
    credentials: true,
  })
);

// Rate limiting – generic limiter for all routes; specific limits can be applied per router later.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Health‑check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Placeholder route mounts – actual route files will be added later.
// Example: const authRouter = require('./routes/auth');
// app.use('/api/auth', authRouter);

module.exports = app;

