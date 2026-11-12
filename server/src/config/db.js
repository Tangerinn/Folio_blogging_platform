const mongoose = require('mongoose');

/**
 * Connect to MongoDB using environment variables.
 * Supports two patterns:
 *   1. Full connection string in MONGODB_URI (may be quoted in .env).
 *   2. Separate USER, PASSWORD, and HOST variables – constructs the URI.
 * Any surrounding double quotes are stripped to avoid DNS lookup errors.
 */
const connectDB = async () => {
  // Prefer full URI
  let rawUri = process.env.MONGODB_URI;
  if (rawUri) {
    // Strip surrounding quotes that some .env editors add
    rawUri = rawUri.replace(/^\"|\"$/g, '');
    try {
      await mongoose.connect(rawUri);
      console.log('MongoDB connected successfully');
      return;
    } catch (err) {
      console.error('MongoDB connection failed:', err.message);
      throw err;
    }
  }

  // Fallback: build from components
  const user = process.env.MONGODB_USERNAME;
  const pass = process.env.MONGODB_PASSWORD;
  const host = process.env.MONGODB_HOST; // e.g. cluster0.galswba.mongodb.net
  const dbName = process.env.MONGODB_DB || 'admin';
  if (!user || !pass || !host) {
    throw new Error('MongoDB connection info missing (MONGODB_URI or USER/PASS/HOST)');
  }
  const uri = `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${dbName}?retryWrites=true&w=majority`;
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully (built from components)');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    throw err;
  }
};

module.exports = connectDB;