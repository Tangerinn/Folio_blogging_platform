// src/server.js – Server startup
require('dotenv').config();

const http = require('http');
const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { initRealtime, closeRealtime } = require('./realtime');

async function startServer() {
  try {
    await connectDB();
    const server = http.createServer(app);
    initRealtime(server);

    server.listen(env.PORT, () => {
      console.log(`Server listening on http://localhost:${env.PORT}`);
    });

    const shutdown = (signal) => async () => {
      console.log(`\nReceived ${signal}, shutting down...`);
      await closeRealtime();
      server.close(() => {
        console.log('HTTP server closed');
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
    process.exit(1);
  }
}

startServer();
