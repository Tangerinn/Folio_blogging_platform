const mongoose = require('mongoose');
const AppError = require('../../utils/AppError');

function parseCreateReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body.');
  }

  const targetType = typeof body.targetType === 'string' ? body.targetType.trim() : '';
  if (targetType !== 'post' && targetType !== 'comment') {
    throw new AppError(400, 'VALIDATION_ERROR', 'targetType must be "post" or "comment".');
  }

  const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid targetId.');
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Reason is required.');
  }
  if (reason.length > 500) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Reason must be 500 characters or fewer.');
  }

  return { targetType, targetId, reason };
}

module.exports = { parseCreateReport };

