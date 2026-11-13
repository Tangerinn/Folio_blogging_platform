const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

/**
 * Validates `req.body` with the given parser function and assigns normalized input to `req.body`.
 */
function validateBody(parser) {
  return (req, _res, next) => {
    try {
      req.body = parser(req.body || {});
      next();
    } catch (err) {
      next(err instanceof AppError ? err : new AppError(400, 'VALIDATION_ERROR', err.message));
    }
  };
}

/**
 * Validates `req.query` with the given parser function and assigns normalized values to `req.validatedQuery`.
 */
function validateQuery(parser) {
  return (req, _res, next) => {
    try {
      req.validatedQuery = parser(req.query || {});
      next();
    } catch (err) {
      next(err instanceof AppError ? err : new AppError(400, 'VALIDATION_ERROR', err.message));
    }
  };
}

/**
 * Validates that a route parameter is a valid MongoDB ObjectId.
 */
function validateObjectIdParam(paramName = 'id', label = 'resource ID') {
  return (req, _res, next) => {
    const value = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return next(new AppError(400, 'VALIDATION_ERROR', `Invalid ${label}.`));
    }
    next();
  };
}

module.exports = { validateBody, validateQuery, validateObjectIdParam };
