const AppError = require('../utils/AppError');

function notFoundHandler(_req, _res, next) {
  next(new AppError(404, 'RESOURCE_NOT_FOUND', 'Endpoint not found.'));
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON request body.' },
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid resource ID.' },
    });
  }

  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: first?.message || 'Validation failed.' },
    });
  }

  if (err.code === 11000) {
    if (err.keyPattern && err.keyPattern.email) {
      return res.status(409).json({
        error: { code: 'EMAIL_TAKEN', message: 'An account with that email already exists.' },
      });
    }
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'Resource already exists.' },
    });
  }

  console.error('Unhandled server error:', err.message);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
  });
}

module.exports = { notFoundHandler, errorHandler };

