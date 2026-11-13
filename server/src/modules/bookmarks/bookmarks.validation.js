const mongoose = require('mongoose');
const AppError = require('../../utils/AppError');

function singleString(val, name) {
  if (val === undefined) return '';
  if (typeof val !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${name} parameter.`);
  }
  return val.trim();
}

function parsePositiveInt(val, name, fallback, max = Infinity) {
  const str = singleString(val, name);
  if (!str) return fallback;
  if (!/^\d+$/.test(str)) {
    throw new AppError(400, 'VALIDATION_ERROR', `${name} must be a positive integer.`);
  }
  const num = Number(str);
  if (!Number.isSafeInteger(num) || num < 1 || num > max) {
    const bound = max < Infinity ? ` between 1 and ${max}` : ' >= 1';
    throw new AppError(400, 'VALIDATION_ERROR', `${name} must be an integer${bound}.`);
  }
  return num;
}

function parseObjectId(val, name) {
  const str = singleString(val, name);
  if (!str) return '';
  if (!mongoose.Types.ObjectId.isValid(str)) {
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid ${name} ID.`);
  }
  return str;
}

function parseListBookmarksQuery(query) {
  const q = singleString(query.q, 'q');
  if (q.length > 200) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Search query must be 200 characters or fewer.');
  }

  return {
    q,
    category: parseObjectId(query.category, 'category'),
    page: parsePositiveInt(query.page, 'page', 1),
    limit: parsePositiveInt(query.limit, 'limit', 20, 50),
  };
}

module.exports = { parseListBookmarksQuery };

