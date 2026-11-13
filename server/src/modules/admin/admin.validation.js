const AppError = require('../../utils/AppError');

function parseAdminUsersQuery(query) {
  const q = typeof query?.q === 'string' ? query.q.trim() : '';
  return { q };
}

function parseAdminUpdateUser(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body.');
  }

  const updates = {};
  if (body.role !== undefined) {
    if (body.role !== 'student' && body.role !== 'admin') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Role must be "student" or "admin".');
    }
    updates.role = body.role;
  }

  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'suspended') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Status must be "active" or "suspended".');
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Provide role or status to update.');
  }

  return updates;
}

function parseAdminReportsQuery(query) {
  const raw = typeof query?.status === 'string' ? query.status.trim() : '';
  if (!raw) return { status: undefined };
  if (raw !== 'pending' && raw !== 'resolved' && raw !== 'dismissed') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Status must be "pending", "resolved", or "dismissed".');
  }
  return { status: raw };
}

function parseAdminUpdateReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body.');
  }
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (action !== 'dismiss' && action !== 'resolve') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Action must be "dismiss" or "resolve".');
  }
  return { action };
}

function parseAdminCategoryBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body.');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Category name is required.');
  }
  if (name.length > 60) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Category name must be 60 characters or fewer.');
  }

  let description = '';
  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Description must be a string.');
    }
    description = body.description.trim();
    if (description.length > 250) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Description must be 250 characters or fewer.');
    }
  }

  return { name, description };
}

module.exports = {
  parseAdminUsersQuery,
  parseAdminUpdateUser,
  parseAdminReportsQuery,
  parseAdminUpdateReport,
  parseAdminCategoryBody,
};

