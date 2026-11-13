const AppError = require('../../utils/AppError');

function parseUpdateProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body.');
  }

  const updates = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Name cannot be empty.');
    }
    const cleanName = body.name.trim();
    if (cleanName.length > 80) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Name must be 80 characters or fewer.');
    }
    updates.name = cleanName;
  }

  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Bio must be a string.');
    }
    const cleanBio = body.bio.trim();
    if (cleanBio.length > 300) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Bio must be 300 characters or fewer.');
    }
    updates.bio = cleanBio;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Provide at least one updatable field.');
  }

  return updates;
}

module.exports = { parseUpdateProfile };

