const AppError = require('../../utils/AppError');

function parseContent(body, emptyMessage) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body.');
  }

  const raw = typeof body.content === 'string' ? body.content.trim() : '';
  if (!raw) {
    throw new AppError(400, 'VALIDATION_ERROR', emptyMessage);
  }
  if (raw.length > 2000) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Content must be 2000 characters or fewer.');
  }

  return { content: raw };
}

function parseCreateComment(body) {
  return parseContent(body, 'Comment cannot be empty.');
}

function parseCreateReply(body) {
  return parseContent(body, 'Reply cannot be empty.');
}

function parseUpdateComment(body) {
  return parseContent(body, 'Comment cannot be empty.');
}

module.exports = {
  parseCreateComment,
  parseCreateReply,
  parseUpdateComment,
};

