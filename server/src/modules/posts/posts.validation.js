const mongoose = require('mongoose');
const AppError = require('../../utils/AppError');
const { isEmptyDoc, validateTipTapDoc } = require('../../utils/content');

const ALLOWED_SORTS = new Set(['newest', 'oldest', 'discussed']);
const ALLOWED_STATUSES = new Set(['draft', 'published']);

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

function parseListPostsQuery(query) {
  const rawMine = singleString(query.mine, 'mine');
  if (rawMine && rawMine !== 'true' && rawMine !== 'false') {
    throw new AppError(400, 'VALIDATION_ERROR', 'mine must be "true" or "false".');
  }

  const q = singleString(query.q, 'q');
  if (q.length > 200) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Search query must be 200 characters or fewer.');
  }

  const sort = singleString(query.sort, 'sort') || 'newest';
  if (!ALLOWED_SORTS.has(sort)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'sort must be one of: newest, oldest, discussed.');
  }

  return {
    mine: rawMine === 'true',
    q,
    category: parseObjectId(query.category, 'category'),
    authorId: parseObjectId(query.authorId, 'authorId'),
    sort,
    page: parsePositiveInt(query.page, 'page', 1),
    limit: parsePositiveInt(query.limit, 'limit', 20, 50),
  };
}

function parseTitle(val) {
  if (typeof val !== 'string' || !val.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A title is required.');
  }
  const trimmed = val.trim();
  if (trimmed.length > 150) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Title must be 150 characters or fewer.');
  }
  return trimmed;
}

function parsePostStatus(val, fallback) {
  if (val === undefined) return fallback;
  if (typeof val !== 'string' || !ALLOWED_STATUSES.has(val.trim())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'status must be "draft" or "published".');
  }
  return val.trim();
}

function parseOptionalCategoryId(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val !== 'string' || !mongoose.Types.ObjectId.isValid(val.trim())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid category ID.');
  }
  return val.trim();
}

function parseContent(val) {
  return validateTipTapDoc(val, (message) => new AppError(400, 'VALIDATION_ERROR', message));
}

function parseCreatePost(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body.');
  }

  const title = parseTitle(body.title);
  const content = parseContent(body.content);
  const categoryId = parseOptionalCategoryId(body.categoryId);
  const status = parsePostStatus(body.status, 'draft');

  if (status === 'published') {
    if (!categoryId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Choose a category before publishing.');
    }
    if (isEmptyDoc(content)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Write some content before publishing.');
    }
  }

  return { title, content, categoryId, status };
}

function parseUpdatePost(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body.');
  }

  const updates = {};
  if (body.title !== undefined) updates.title = parseTitle(body.title);
  if (body.content !== undefined) updates.content = parseContent(body.content);
  if (body.categoryId !== undefined) updates.categoryId = parseOptionalCategoryId(body.categoryId);
  if (body.status !== undefined) updates.status = parsePostStatus(body.status);

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Provide at least one updatable field.');
  }

  return updates;
}

module.exports = { parseListPostsQuery, parseCreatePost, parseUpdatePost };

