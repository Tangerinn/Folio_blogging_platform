const stripQuotes = (v) => (typeof v === 'string' ? v.trim().replace(/^"|"$/g, '') : '');

const MONGODB_URI = stripQuotes(process.env.MONGODB_URI);
const JWT_ACCESS_SECRET = stripQuotes(process.env.JWT_ACCESS_SECRET);

if (!MONGODB_URI) {
  throw new Error('Fatal startup error: MONGODB_URI environment variable is missing.');
}
if (!JWT_ACCESS_SECRET) {
  throw new Error('Fatal startup error: JWT_ACCESS_SECRET environment variable is missing.');
}

const rawDays = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS);
const REFRESH_TOKEN_EXPIRES_DAYS = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 7;

module.exports = {
  PORT: Number(process.env.PORT) || 5000,
  CORS_ORIGIN: stripQuotes(process.env.CORS_ORIGIN),
  MONGODB_URI,
  JWT_ACCESS_SECRET,
  JWT_ACCESS_EXPIRES_IN: stripQuotes(process.env.JWT_ACCESS_EXPIRES_IN) || '15m',
  REFRESH_TOKEN_EXPIRES_DAYS,
  CLOUDINARY_CLOUD_NAME: stripQuotes(process.env.CLOUDINARY_CLOUD_NAME),
  CLOUDINARY_API_KEY: stripQuotes(process.env.CLOUDINARY_API_KEY),
  CLOUDINARY_API_SECRET: stripQuotes(process.env.CLOUDINARY_API_SECRET),
};

