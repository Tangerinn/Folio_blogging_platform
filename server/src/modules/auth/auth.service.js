const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const AppError = require('../../utils/AppError');

const BCRYPT_ROUNDS = 12;
let dummyHashPromise = null;

function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash('dummy-timing-guard', BCRYPT_ROUNDS);
  }
  return dummyHashPromise;
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function issueTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );

  const refreshToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
  );

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
  });

  return { accessToken, refreshToken };
}

async function register({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: 'student',
    status: 'active',
  });

  return user.toJSON();
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const candidateHash = user ? user.passwordHash : await getDummyHash();
  const valid = await bcrypt.compare(password, candidateHash);

  if (!user || !valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }
  if (user.status === 'suspended') {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
  }

  const tokens = await issueTokens(user);
  return { ...tokens, user: user.toJSON() };
}

async function refresh({ refreshToken }) {
  const record = await RefreshToken.findOneAndDelete({
    tokenHash: hashToken(refreshToken),
  });

  if (!record || record.expiresAt <= new Date()) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired refresh token.');
  }

  const user = await User.findById(record.userId);
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  }
  if (user.status === 'suspended') {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
  }

  return issueTokens(user);
}

async function logout({ refreshToken }) {
  await RefreshToken.deleteOne({ tokenHash: hashToken(refreshToken) });
}

module.exports = { register, login, refresh, logout };

