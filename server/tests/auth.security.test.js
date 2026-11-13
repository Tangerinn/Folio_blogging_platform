const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PassThrough } = require('node:stream');
const http = require('node:http');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Provide test env vars before loading env/app
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/folio_test';
process.env.JWT_ACCESS_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_DAYS = '7';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const app = require('../src/app');

// In-memory store backing Mongoose User & RefreshToken static methods
let usersStore = [];
let tokensStore = [];

function wrapUserDoc(raw) {
  if (!raw) return null;
  const doc = new User(raw);
  doc._id = raw._id;
  doc.createdAt = raw.createdAt;
  doc.updatedAt = raw.updatedAt;
  doc.passwordHash = raw.passwordHash;
  return doc;
}

// Stub Mongoose DB operations so tests exercise real Express routes, middleware, bcrypt, JWT, and crypto offline
User.findOne = (query) => {
  const match = usersStore.find((u) => {
    if (query.email) return u.email === String(query.email).trim().toLowerCase();
    return false;
  });
  return {
    select(fields) {
      if (!match) return Promise.resolve(null);
      const doc = wrapUserDoc(match);
      if (!fields.includes('+passwordHash')) doc.passwordHash = undefined;
      return Promise.resolve(doc);
    },
    then(resolve, reject) {
      return Promise.resolve(match ? wrapUserDoc(match) : null).then(resolve, reject);
    },
  };
};

User.findById = (id) => {
  const match = usersStore.find((u) => u._id.toString() === String(id));
  return Promise.resolve(match ? wrapUserDoc(match) : null);
};

User.create = async (data) => {
  const now = new Date();
  const raw = {
    _id: new mongoose.Types.ObjectId(),
    name: String(data.name).trim(),
    email: String(data.email).trim().toLowerCase(),
    passwordHash: data.passwordHash,
    role: data.role || 'student',
    status: data.status || 'active',
    bio: data.bio || '',
    createdAt: now,
    updatedAt: now,
  };
  usersStore.push(raw);
  return wrapUserDoc(raw);
};

RefreshToken.create = async (data) => {
  const rec = {
    _id: new mongoose.Types.ObjectId(),
    userId: data.userId,
    tokenHash: data.tokenHash,
    expiresAt: data.expiresAt,
    createdAt: new Date(),
  };
  tokensStore.push(rec);
  return rec;
};

RefreshToken.findOneAndDelete = async (query) => {
  const idx = tokensStore.findIndex((t) => t.tokenHash === query.tokenHash);
  if (idx === -1) return null;
  const [removed] = tokensStore.splice(idx, 1);
  return removed;
};

RefreshToken.deleteOne = async (query) => {
  const beforeLen = tokensStore.length;
  tokensStore = tokensStore.filter((t) => t.tokenHash !== query.tokenHash);
  return { deletedCount: beforeLen - tokensStore.length };
};

// Invoke the full Express app pipeline in-process (avoids TCP socket restrictions in sandboxed/CI runs)
function request(path, { method = 'GET', body, rawBody, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const socket = new PassThrough();
    socket.remoteAddress = '127.0.0.1';

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = `/api${path}`;

    const reqHeaders = {};
    for (const [k, v] of Object.entries(headers)) reqHeaders[k.toLowerCase()] = v;

    let payload = null;
    if (rawBody !== undefined) {
      payload = Buffer.from(rawBody, 'utf8');
      reqHeaders['content-type'] = 'application/json';
      reqHeaders['content-length'] = String(payload.length);
    } else if (body !== undefined) {
      payload = Buffer.from(JSON.stringify(body), 'utf8');
      reqHeaders['content-type'] = 'application/json';
      reqHeaders['content-length'] = String(payload.length);
    }
    req.headers = reqHeaders;

    const res = new http.ServerResponse(req);
    const chunks = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);
    res.assignSocket(socket);

    res.write = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return origWrite(chunk, encoding, cb);
    };
    res.end = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      const result = origEnd(chunk, encoding, cb);
      // HTTP raw response headers are written to socket, whereas body chunks are captured above;
      // strip HTTP header block if ServerResponse flushed headers + body together on socket
      const full = Buffer.concat(chunks).toString('utf8');
      const sep = full.indexOf('\r\n\r\n');
      const text = sep !== -1 ? full.slice(sep + 4) : full;
      let json = null;
      if (text) {
        try { json = JSON.parse(text); } catch { json = text; }
      }
      resolve({ status: res.statusCode, json, text });
      return result;
    };
    res.on('error', reject);

    app(req, res);

    if (payload) req.push(payload);
    req.push(null);
  });
}

beforeEach(() => {
  usersStore = [];
  tokensStore = [];
});

describe('Auth & User security suite (Step 1)', () => {
  it('hashes passwords with bcrypt cost 12, hides passwordHash, and stores SHA-256 refresh hashes', async () => {
    const reg = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Ada Lovelace', email: 'Ada@Example.com', password: 'password123' },
    });

    assert.equal(reg.status, 201);
    assert.deepEqual(Object.keys(reg.json).sort(), ['bio', 'createdAt', 'email', 'id', 'name', 'role', 'status']);
    assert.equal(reg.json.email, 'ada@example.com');
    assert.equal(reg.json.passwordHash, undefined);
    assert.equal(reg.json._id, undefined);
    assert.equal(User.schema.path('passwordHash').options.select, false);

    const storedUser = usersStore[0];
    assert.match(storedUser.passwordHash, /^\$2[aby]\$12\$/);
    assert.equal(await bcrypt.compare('password123', storedUser.passwordHash), true);

    const login = await request('/auth/login', {
      method: 'POST',
      body: { email: 'ada@example.com', password: 'password123' },
    });
    assert.equal(login.status, 200);
    assert.ok(login.json.accessToken);
    assert.ok(login.json.refreshToken);
    assert.equal(login.json.user.passwordHash, undefined);

    const expectedSha256 = crypto.createHash('sha256').update(login.json.refreshToken).digest('hex');
    assert.equal(tokensStore.length, 1);
    assert.equal(tokensStore[0].tokenHash, expectedSha256);
    assert.notEqual(tokensStore[0].tokenHash, login.json.refreshToken);
  });

  it('enforces 15m access token expiry and rejects expired access tokens with 401', async () => {
    await request('/auth/register', {
      method: 'POST',
      body: { name: 'Grace Hopper', email: 'grace@example.com', password: 'password123' },
    });
    const login = await request('/auth/login', {
      method: 'POST',
      body: { email: 'grace@example.com', password: 'password123' },
    });

    const decoded = jwt.verify(login.json.accessToken, process.env.JWT_ACCESS_SECRET);
    assert.equal(decoded.exp - decoded.iat, 15 * 60);

    const expiredToken = jwt.sign(
      { sub: login.json.user.id, role: 'student' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: -10 }
    );
    const res = await request('/users/me', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(res.status, 401);
    assert.equal(res.json.error.code, 'UNAUTHENTICATED');
  });

  it('rotates refresh tokens, rejects reused old refresh tokens, and revokes sessions on logout', async () => {
    await request('/auth/register', {
      method: 'POST',
      body: { name: 'Alan Turing', email: 'alan@example.com', password: 'password123' },
    });

    const session1 = await request('/auth/login', {
      method: 'POST',
      body: { email: 'alan@example.com', password: 'password123' },
    });
    const session2 = await request('/auth/login', {
      method: 'POST',
      body: { email: 'alan@example.com', password: 'password123' },
    });
    assert.equal(tokensStore.length, 2);

    // Rotate session 1
    const rotated = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: session1.json.refreshToken },
    });
    assert.equal(rotated.status, 200);
    assert.notEqual(rotated.json.refreshToken, session1.json.refreshToken);
    assert.equal(tokensStore.length, 2);

    // Reusing old session 1 token fails
    const reuse = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: session1.json.refreshToken },
    });
    assert.equal(reuse.status, 401);
    assert.equal(reuse.json.error.code, 'UNAUTHENTICATED');

    // Logout rotated session 1 (204) then refresh fails (401), while session 2 still works
    const logout = await request('/auth/logout', {
      method: 'POST',
      body: { refreshToken: rotated.json.refreshToken },
    });
    assert.equal(logout.status, 204);
    assert.equal(logout.text, '');
    assert.equal(tokensStore.length, 1);

    const afterLogout = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: rotated.json.refreshToken },
    });
    assert.equal(afterLogout.status, 401);

    const s2Refresh = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: session2.json.refreshToken },
    });
    assert.equal(s2Refresh.status, 200);
  });

  it('ignores client-supplied role/status on register and blocks suspended users across login, refresh, and /users/me', async () => {
    const reg = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Sneaky Student',
        email: 'sneaky@example.com',
        password: 'password123',
        role: 'admin',
        status: 'suspended',
      },
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.json.role, 'student');
    assert.equal(reg.json.status, 'active');

    const login = await request('/auth/login', {
      method: 'POST',
      body: { email: 'sneaky@example.com', password: 'password123' },
    });
    assert.equal(login.status, 200);

    // Suspend user account
    usersStore[0].status = 'suspended';

    const meRes = await request('/users/me', {
      headers: { Authorization: `Bearer ${login.json.accessToken}` },
    });
    assert.equal(meRes.status, 403);
    assert.equal(meRes.json.error.code, 'ACCOUNT_SUSPENDED');

    const refreshRes = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: login.json.refreshToken },
    });
    assert.equal(refreshRes.status, 403);
    assert.equal(refreshRes.json.error.code, 'ACCOUNT_SUSPENDED');

    const loginBlocked = await request('/auth/login', {
      method: 'POST',
      body: { email: 'sneaky@example.com', password: 'password123' },
    });
    assert.equal(loginBlocked.status, 403);
    assert.equal(loginBlocked.json.error.code, 'ACCOUNT_SUSPENDED');
  });

  it('validates input, returns identical INVALID_CREDENTIALS for bad email/password, and rejects malformed tokens', async () => {
    // Registration validation
    const badName = await request('/auth/register', {
      method: 'POST',
      body: { name: '   ', email: 'u@example.com', password: 'password123' },
    });
    assert.equal(badName.status, 400);
    assert.equal(badName.json.error.code, 'VALIDATION_ERROR');

    const badEmail = await request('/auth/register', {
      method: 'POST',
      body: { name: 'User', email: 'not-an-email', password: 'password123' },
    });
    assert.equal(badEmail.status, 400);
    assert.equal(badEmail.json.error.code, 'VALIDATION_ERROR');

    const shortPw = await request('/auth/register', {
      method: 'POST',
      body: { name: 'User', email: 'u@example.com', password: 'short' },
    });
    assert.equal(shortPw.status, 400);
    assert.equal(shortPw.json.error.code, 'VALIDATION_ERROR');

    // Duplicate email (case-insensitive)
    await request('/auth/register', {
      method: 'POST',
      body: { name: 'User', email: 'dup@example.com', password: 'password123' },
    });
    const dup = await request('/auth/register', {
      method: 'POST',
      body: { name: 'User 2', email: '  DUP@EXAMPLE.COM ', password: 'password123' },
    });
    assert.equal(dup.status, 409);
    assert.equal(dup.json.error.code, 'EMAIL_TAKEN');

    // Identical INVALID_CREDENTIALS on wrong email vs wrong password
    const wrongEmail = await request('/auth/login', {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'password123' },
    });
    const wrongPassword = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dup@example.com', password: 'wrongpassword' },
    });
    assert.equal(wrongEmail.status, 401);
    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(wrongEmail.json, wrongPassword.json);
    assert.equal(wrongEmail.json.error.code, 'INVALID_CREDENTIALS');

    // Empty refreshToken & malformed JSON
    const emptyRefresh = await request('/auth/refresh', { method: 'POST', body: { refreshToken: '  ' } });
    assert.equal(emptyRefresh.status, 400);
    assert.equal(emptyRefresh.json.error.code, 'VALIDATION_ERROR');

    const badJson = await request('/auth/login', { method: 'POST', rawBody: '{invalid' });
    assert.equal(badJson.status, 400);
    assert.equal(badJson.json.error.code, 'VALIDATION_ERROR');

    // Malformed / invalid Bearer tokens
    const wrongSecret = jwt.sign({ sub: '123', role: 'student' }, 'wrong-secret', { expiresIn: '15m' });
    for (const authHeader of [undefined, 'Basic abc', 'Bearer ', 'Bearer not.a.jwt', `Bearer ${wrongSecret}`]) {
      const headers = authHeader ? { Authorization: authHeader } : {};
      const res = await request('/users/me', { headers });
      assert.equal(res.status, 401);
      assert.equal(res.json.error.code, 'UNAUTHENTICATED');
      assert.equal(res.json.stack, undefined);
    }
  });
});
