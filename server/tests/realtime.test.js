const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/folio_test';
process.env.JWT_ACCESS_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_DAYS = '7';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');
const Notification = require('../src/models/Notification');
const app = require('../src/app');
const { initRealtime, closeRealtime } = require('../src/realtime');

let usersStore = [];
let postsStore = [];
let commentsStore = [];
let notificationsStore = [];

function toStr(id) {
  return id ? id.toString() : '';
}

function makeQuery(result) {
  return {
    populate() {
      return this;
    },
    lean: async () => result,
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

function installModelStubs() {
  User.findById = (id) => {
    const found = usersStore.find((u) => toStr(u._id) === toStr(id)) || null;
    return makeQuery(found);
  };

  Post.findById = (id) => {
    const found = postsStore.find((p) => toStr(p._id) === toStr(id)) || null;
    return makeQuery(found);
  };

  Comment.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      post: data.post,
      author: data.author,
      parentId: data.parentId || null,
      content: data.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    commentsStore.push(doc);
    return doc;
  };

  Comment.findById = (id) => {
    const found = commentsStore.find((c) => toStr(c._id) === toStr(id)) || null;
    return {
      populate() {
        const author = found ? usersStore.find((u) => toStr(u._id) === toStr(found.author)) : null;
        const populated = found
          ? {
              ...found,
              author: author
                ? { _id: author._id, name: author.name, bio: author.bio || '' }
                : found.author,
            }
          : null;
        return makeQuery(populated);
      },
      then(resolve, reject) {
        return Promise.resolve(found).then(resolve, reject);
      },
    };
  };

  Notification.create = async (data) => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      recipient: data.recipient,
      type: data.type,
      message: data.message,
      post: data.post,
      comment: data.comment,
      read: Boolean(data.read),
      createdAt: new Date(),
    };
    notificationsStore.push(doc);
    return doc;
  };
}

function signAccessToken(userId, expiresIn = '15m') {
  return jwt.sign(
    { sub: toStr(userId), role: 'student' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn }
  );
}

function connectSocket(baseUrl, token) {
  return ioClient(baseUrl, {
    auth: token !== undefined ? { token } : {},
    reconnection: false,
    forceNew: true,
    extraHeaders: { origin: 'http://localhost:5173' },
  });
}

function waitForEvent(socket, eventName, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event: ${eventName}`));
    }, timeoutMs);
    socket.once(eventName, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function httpJson(baseUrl, method, path, body, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

describe('Real-time Socket.IO integration suite', () => {
  let httpServer;
  let baseUrl;
  const openSockets = [];

  function track(sock) {
    openSockets.push(sock);
    return sock;
  }

  before(async () => {
    installModelStubs();
    httpServer = http.createServer(app);
    initRealtime(httpServer);
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    for (const s of openSockets) {
      s.disconnect();
    }
    await closeRealtime();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  beforeEach(() => {
    usersStore = [];
    postsStore = [];
    commentsStore = [];
    notificationsStore = [];
    for (const s of openSockets) {
      s.disconnect();
    }
    openSockets.length = 0;
  });

  it('rejects connections without a token or with an invalid/expired token', async () => {
    const noToken = track(connectSocket(baseUrl, undefined));
    const err1 = await waitForEvent(noToken, 'connect_error');
    assert.equal(err1.message, 'UNAUTHENTICATED');

    const badToken = track(connectSocket(baseUrl, 'not.a.valid.jwt'));
    const err2 = await waitForEvent(badToken, 'connect_error');
    assert.equal(err2.message, 'UNAUTHENTICATED');

    const userId = new mongoose.Types.ObjectId();
    usersStore.push({ _id: userId, name: 'Alice', role: 'student', status: 'active' });
    const expiredToken = jwt.sign(
      { sub: toStr(userId), role: 'student' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: -10 }
    );
    const expiredSock = track(connectSocket(baseUrl, expiredToken));
    const err3 = await waitForEvent(expiredSock, 'connect_error');
    assert.equal(err3.message, 'UNAUTHENTICATED');
  });

  it('rejects suspended users in handshake authentication', async () => {
    const userId = new mongoose.Types.ObjectId();
    usersStore.push({ _id: userId, name: 'Suspended User', role: 'student', status: 'suspended' });
    const token = signAccessToken(userId);

    const sock = track(connectSocket(baseUrl, token));
    const err = await waitForEvent(sock, 'connect_error');
    assert.equal(err.message, 'ACCOUNT_SUSPENDED');
  });

  it('accepts valid tokens and delivers notification:new only to the recipient', async () => {
    const aliceId = new mongoose.Types.ObjectId();
    const bobId = new mongoose.Types.ObjectId();
    const postId = new mongoose.Types.ObjectId();

    usersStore.push(
      { _id: aliceId, name: 'Alice', role: 'student', status: 'active', bio: '' },
      { _id: bobId, name: 'Bob', role: 'student', status: 'active', bio: '' }
    );
    postsStore.push({
      _id: postId,
      title: 'Socket.IO Notes',
      author: aliceId,
      status: 'published',
    });

    const aliceToken = signAccessToken(aliceId);
    const bobToken = signAccessToken(bobId);

    const aliceSock = track(connectSocket(baseUrl, aliceToken));
    const bobSock = track(connectSocket(baseUrl, bobToken));
    await Promise.all([waitForEvent(aliceSock, 'connect'), waitForEvent(bobSock, 'connect')]);

    let bobGotNotification = false;
    bobSock.on('notification:new', () => {
      bobGotNotification = true;
    });

    const notifPromise = waitForEvent(aliceSock, 'notification:new');
    const res = await httpJson(
      baseUrl,
      'POST',
      `/api/posts/${toStr(postId)}/comments`,
      { content: 'Great writeup!' },
      bobToken
    );
    assert.equal(res.status, 201);

    const notif = await notifPromise;
    assert.equal(notif.recipientId, toStr(aliceId));
    assert.equal(notif.type, 'comment');
    assert.equal(notif.postId, toStr(postId));
    assert.equal(notif.read, false);

    // Give Bob's socket a moment to confirm no cross-user notification arrived
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(bobGotNotification, false);
  });

  it('broadcasts comment:new to joined published post rooms and ignores draft rooms', async () => {
    const aliceId = new mongoose.Types.ObjectId();
    const bobId = new mongoose.Types.ObjectId();
    const pubPostId = new mongoose.Types.ObjectId();
    const draftPostId = new mongoose.Types.ObjectId();

    usersStore.push(
      { _id: aliceId, name: 'Alice', role: 'student', status: 'active', bio: 'Writer' },
      { _id: bobId, name: 'Bob', role: 'student', status: 'active', bio: 'Reader' }
    );
    postsStore.push(
      { _id: pubPostId, title: 'Published Post', author: aliceId, status: 'published' },
      { _id: draftPostId, title: 'Draft Post', author: aliceId, status: 'draft' }
    );

    const aliceSock = track(connectSocket(baseUrl, signAccessToken(aliceId)));
    const bobToken = signAccessToken(bobId);
    const bobSock = track(connectSocket(baseUrl, bobToken));
    await Promise.all([waitForEvent(aliceSock, 'connect'), waitForEvent(bobSock, 'connect')]);

    // Joining a draft post room should be rejected
    const draftAck = await new Promise((resolve) => {
      bobSock.emit('post:join', { postId: toStr(draftPostId) }, resolve);
    });
    assert.equal(draftAck.ok, false);

    // Joining a published post room succeeds
    const pubAck = await new Promise((resolve) => {
      aliceSock.emit('post:join', { postId: toStr(pubPostId) }, resolve);
    });
    assert.equal(pubAck.ok, true);

    const commentPromise = waitForEvent(aliceSock, 'comment:new');
    const postRes = await httpJson(
      baseUrl,
      'POST',
      `/api/posts/${toStr(pubPostId)}/comments`,
      { content: 'Hello live room!' },
      bobToken
    );
    assert.equal(postRes.status, 201);

    const liveComment = await commentPromise;
    assert.equal(liveComment.id, postRes.data.id);
    assert.equal(liveComment.postId, toStr(pubPostId));
    assert.equal(liveComment.content, 'Hello live room!');
    assert.equal(liveComment.author.name, 'Bob');
    assert.deepEqual(liveComment.replies, []);
  });
});
