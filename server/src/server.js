// src/server.js – Server startup
// Loads environment, connects to MongoDB, then starts the Express HTTP server.

require('dotenv').config(); // Load .env variables (if any)

const connectDB = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Establish MongoDB connection before listening
    await connectDB();
    console.log('MongoDB connection established');
    const server = app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
    // Graceful shutdown on termination signals
    const shutdown = (signal) => async () => {
      console.log(`\nReceived ${signal}, shutting down...`);
      server.close(() => {
        console.log('HTTP server closed');
        // Close mongoose connection
        const mongoose = require('mongoose');
        mongoose.disconnect().then(() => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      });
    };
    process.on('SIGINT', shutdown('SIGINT'));
    process.on('SIGTERM', shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    // Exit with failure – ensures invalid DB config is obvious
    process.exit(1);
  }
}

startServer();

