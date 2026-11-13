const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/User');
const Post = require('../models/Post');

let io = null;

function extractPostId(payload) {
  if (typeof payload === 'string') return payload.trim();
  if (payload && typeof payload === 'object' && typeof payload.postId === 'string') {
    return payload.postId.trim();
  }
  return '';
}

/**
 * Attaches Socket.IO to the HTTP server with CORS restricted to CORS_ORIGIN
 * and JWT handshake authentication.
 */
function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN || false,
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const rawToken = socket.handshake.auth && socket.handshake.auth.token;
      const token = typeof rawToken === 'string' ? rawToken.trim() : '';
      if (!token) {
        return next(new Error('UNAUTHENTICATED'));
      }

      let payload;
      try {
        payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      } catch {
        return next(new Error('UNAUTHENTICATED'));
      }

      const user = await User.findById(payload.sub);
      if (!user) {
        return next(new Error('UNAUTHENTICATED'));
      }
      if (user.status === 'suspended') {
        return next(new Error('ACCOUNT_SUSPENDED'));
      }

      socket.data.user = {
        id: user._id ? user._id.toString() : String(user.id),
        role: user.role,
      };
      return next();
    } catch {
      return next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user.id;
    socket.join(`user:${userId}`);

    socket.on('post:join', async (payload, ack) => {
      const postId = extractPostId(payload);
      if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'INVALID_ID' });
        return;
      }

      try {
        const post = await Post.findById(postId);
        if (!post || post.status !== 'published') {
          if (typeof ack === 'function') ack({ ok: false, error: 'RESOURCE_NOT_FOUND' });
          return;
        }
        socket.join(`post:${postId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch {
        if (typeof ack === 'function') ack({ ok: false, error: 'INTERNAL_ERROR' });
      }
    });

    socket.on('post:leave', (payload) => {
      const postId = extractPostId(payload);
      if (postId && mongoose.Types.ObjectId.isValid(postId)) {
        socket.leave(`post:${postId}`);
      }
    });

    socket.on('disconnect', () => {
      // Socket.IO automatically removes disconnected sockets from all rooms.
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitNotification(userId, notification) {
  try {
    if (!io || !userId || !notification) return;
    io.to(`user:${String(userId)}`).emit('notification:new', notification);
  } catch {
    // Real-time emit failures must never break REST requests.
  }
}

function emitComment(postId, comment) {
  try {
    if (!io || !postId || !comment) return;
    io.to(`post:${String(postId)}`).emit('comment:new', comment);
  } catch {
    // Real-time emit failures must never break REST requests.
  }
}

function closeRealtime() {
  if (!io) return Promise.resolve();
  const current = io;
  io = null;
  return new Promise((resolve) => {
    current.close(() => resolve());
  });
}

module.exports = {
  initRealtime,
  getIO,
  emitNotification,
  emitComment,
  closeRealtime,
};

