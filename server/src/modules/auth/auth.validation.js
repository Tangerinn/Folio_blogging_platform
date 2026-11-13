const AppError = require('../../utils/AppError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireEmail(value) {
  if (typeof value !== 'string' || !value.trim() || !EMAIL_RE.test(value.trim())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A valid email address is required.');
  }
  return value.trim().toLowerCase();
}

function parseRegister(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Name is required.');
  }
  const email = requireEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters.');
  }
  return { name, email, password };
}

function parseLogin(body) {
  const email = requireEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Password is required.');
  }
  return { email, password };
}

function parseRefresh(body) {
  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : '';
  if (!refreshToken) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Refresh token is required.');
  }
  return { refreshToken };
}

module.exports = { parseRegister, parseLogin, parseRefresh };

