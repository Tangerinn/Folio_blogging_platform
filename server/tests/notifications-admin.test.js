const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/folio_test';
process.env.JWT_ACCESS_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_DAYS = '7';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');
const Bookmark = require('../src/models/Bookmark');
const Notification = require('../src/models/Notification');
const Report = require('../src/models/Report');
const RefreshToken = require('../src/models/RefreshToken');
const app = require('../src/app');

let usersStore = [];
let categoriesStore = [];
let postsStore = [];
let commentsStore = [];
let bookmarksStore = [];
let notificationsStore = [];
let reportsStore = [];
let refreshTokensStore = [];

function toStr(id) {
  return id ? id.toString() : '';
}

function matchesFilter(doc, filter = {}) {
  for (const [key, val] of Object.entries(filter)) {
    if (key === '$or') {
      const ok = val.some((clause) => matchesFilter(doc, clause));
      if (!ok) return false;
      continue;
    }
    if (val && typeof val === 'object' && !(val instanceof RegExp) && !(val instanceof mongoose.Types.ObjectId)) {
      if (val.$in) {
        const allowed = val.$in.map(toStr);
        if (!allowed.includes(toStr(doc[key]))) return false;
        continue;
      }
      if (val.$ne !== undefined) {
        if (toStr(doc[key]) === toStr(val.$ne)) return false;
        continue;
      }
    }
    if (val instanceof RegExp) {
      if (!val.test(String(doc[key] || ''))) return false;
      continue;
    }
    if (val === null) {
      if (doc[key] !== null && doc[key] !== undefined) return false;
      continue;
    }
    if (toStr(doc[key]) !== toStr(val)) return false;
  }
  return true;
}

function sortDocs(list, sortSpec = {}) {
  const entries = Object.entries(sortSpec);
  return [...list].sort((a, b) => {
    for (const [key, dir] of entries) {
      const av = a[key] instanceof Date ? a[key].getTime() : String(a[key] ?? '');
      const bv = b[key] instanceof Date ? b[key].getTime() : String(b[key] ?? '');
      if (av < bv) return dir < 0 ? 1 : -1;
      if (av > bv) return dir < 0 ? -1 : 1;
    }
    return 0;
  });
}

function wrapUserDoc(raw) {
  const doc = new User(raw);
  doc._id = raw._id;
  doc.isNew = false;
  doc.save = async () => {
    const idx = usersStore.findIndex((u) => toStr(u._id) === toStr(doc._id));
    if (idx >= 0) {
      usersStore[idx] = {
        ...usersStore[idx],
        name: doc.name,
        bio: doc.bio,
        role: doc.role,
        status: doc.status,
        updatedAt: new Date(),
      };
    }
    return doc;
  };
  return doc;
}

function wrapCategoryDoc(raw) {
  const doc = new Category(raw);
  doc._id = raw._id;
  doc.isNew = false;
  doc.save = async () => {
    const idx = categoriesStore.findIndex((c) => toStr(c._id) === toStr(doc._id));
    if (idx >= 0) {
      categoriesStore[idx] = {
        ...categoriesStore[idx],
        name: doc.name,
        description: doc.description,
        updatedAt: new Date(),
      };
    }
    return doc;
  };
  return doc;
}

function wrapNotificationDoc(raw) {
  const doc = new Notification(raw);
  doc._id = raw._id;
  doc.isNew = false;
  doc.save = async () => {
    const idx = notificationsStore.findIndex((n) => toStr(n._id) === toStr(doc._id));
    if (idx >= 0) {
      notificationsStore[idx] = {
        ...notificationsStore[idx],
        read: doc.read,
        updatedAt: new Date(),
      };
    }
    return doc;
  };
  return doc;
}

function wrapReportDoc(raw) {
  const doc = new Report(raw);
  doc._id = raw._id;
  doc.isNew = false;
  doc.save = async () => {
    const idx = reportsStore.findIndex((r) => toStr(r._id) === toStr(doc._id));
    if (idx >= 0) {
      reportsStore[idx] = {
        ...reportsStore[idx],
        status: doc.status,
        updatedAt: new Date(),
      };
    }
    return doc;
  };
  return doc;
}

// User stubs
User.findById = (id) => {
  const u = usersStore.find((x) => toStr(x._id) === toStr(id));
  return Promise.resolve(u ? wrapUserDoc(u) : null);
};
User.find = (filter = {}) => {
  let sortSpec = {};
  let limitN = Infinity;
  const chain = {
    sort(s) { sortSpec = s; return chain; },
    limit(n) { limitN = n; return chain; },
    lean() {
      const matched = sortDocs(usersStore.filter((u) => matchesFilter(u, filter)), sortSpec).slice(0, limitN);
      return Promise.resolve(matched.map((u) => ({ ...u })));
    },
    then(onFulfilled, onRejected) {
      const matched = sortDocs(usersStore.filter((u) => matchesFilter(u, filter)), sortSpec).slice(0, limitN);
      return Promise.resolve(matched.map(wrapUserDoc)).then(onFulfilled, onRejected);
    },
  };
  return chain;
};
User.countDocuments = async (filter = {}) => usersStore.filter((u) => matchesFilter(u, filter)).length;

// Category stubs
Category.findById = (id) => {
  const c = categoriesStore.find((x) => toStr(x._id) === toStr(id));
  return Promise.resolve(c ? wrapCategoryDoc(c) : null);
};
Category.findOne = async (filter = {}) => {
  const c = categoriesStore.find((x) => matchesFilter(x, filter));
  return c ? wrapCategoryDoc(c) : null;
};
Category.create = async (data) => {
  const now = new Date();
  const raw = {
    _id: new mongoose.Types.ObjectId(),
    name: data.name.trim(),
    description: (data.description || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  categoriesStore.push(raw);
  return wrapCategoryDoc(raw);
};
Category.deleteOne = async (filter = {}) => {
  const before = categoriesStore.length;
  categoriesStore = categoriesStore.filter((c) => !matchesFilter(c, filter));
  return { deletedCount: before - categoriesStore.length };
};

// Post stubs
Post.find = (filter = {}) => {
  let sortSpec = {};
  let limitN = Infinity;
  const populates = [];
  const chain = {
    sort(s) { sortSpec = s; return chain; },
    limit(n) { limitN = n; return chain; },
    populate(field) { populates.push(field); return chain; },
    lean() {
      const matched = sortDocs(postsStore.filter((p) => matchesFilter(p, filter)), sortSpec).slice(0, limitN);
      return Promise.resolve(matched.map((p) => {
        const out = { ...p };
        if (populates.includes('author')) {
          const a = usersStore.find((u) => toStr(u._id) === toStr(p.author));
          out.author = a ? { _id: a._id, name: a.name, bio: a.bio } : null;
        }
        return out;
      }));
    },
    then(onFulfilled, onRejected) {
      return this.lean().then(onFulfilled, onRejected);
    },
  };
  return chain;
};
Post.findById = (id) => {
  const p = postsStore.find((x) => toStr(x._id) === toStr(id));
  const out = p ? { ...p } : null;
  return {
    populate() { return this; },
    lean() { return Promise.resolve(out); },
    then(onFulfilled, onRejected) { return Promise.resolve(out).then(onFulfilled, onRejected); },
  };
};
Post.countDocuments = async (filter = {}) => postsStore.filter((p) => matchesFilter(p, filter)).length;
Post.deleteOne = async (filter = {}) => {
  const before = postsStore.length;
  postsStore = postsStore.filter((p) => !matchesFilter(p, filter));
  return { deletedCount: before - postsStore.length };
};

// Comment stubs
Comment.find = (filter = {}) => {
  let sortSpec = {};
  let limitN = Infinity;
  const populates = [];
  const chain = {
    sort(s) { sortSpec = s; return chain; },
    limit(n) { limitN = n; return chain; },
    populate(field) { populates.push(field); return chain; },
    lean() {
      const matched = sortDocs(commentsStore.filter((c) => matchesFilter(c, filter)), sortSpec).slice(0, limitN);
      return Promise.resolve(matched.map((c) => {
        const out = { ...c };
        if (populates.includes('author')) {
          const a = usersStore.find((u) => toStr(u._id) === toStr(c.author));
          out.author = a ? { _id: a._id, name: a.name, bio: a.bio } : null;
        }
        if (populates.includes('post')) {
          const p = postsStore.find((post) => toStr(post._id) === toStr(c.post));
          out.post = p ? { _id: p._id, title: p.title } : null;
        }
        return out;
      }));
    },
    then(onFulfilled, onRejected) {
      return this.lean().then(onFulfilled, onRejected);
    },
  };
  return chain;
};
Comment.findById = (id) => {
  const populates = [];
  const resolveVal = () => {
    const c = commentsStore.find((x) => toStr(x._id) === toStr(id));
    if (!c) return null;
    const out = { ...c };
    if (populates.includes('author')) {
      const a = usersStore.find((u) => toStr(u._id) === toStr(c.author));
      out.author = a ? { _id: a._id, name: a.name, bio: a.bio } : null;
    }
    return out;
  };
  return {
    populate(field) { populates.push(field); return this; },
    lean() { return Promise.resolve(resolveVal()); },
    then(onFulfilled, onRejected) { return Promise.resolve(resolveVal()).then(onFulfilled, onRejected); },
  };
};
Comment.create = async (data) => {
  const now = new Date();
  const raw = {
    _id: new mongoose.Types.ObjectId(),
    post: data.post,
    author: data.author,
    parentId: data.parentId || null,
    content: data.content,
    createdAt: now,
    updatedAt: now,
  };
  commentsStore.push(raw);
  return raw;
};
Comment.countDocuments = async (filter = {}) => commentsStore.filter((c) => matchesFilter(c, filter)).length;
Comment.deleteMany = async (filter = {}) => {
  const before = commentsStore.length;
  commentsStore = commentsStore.filter((c) => !matchesFilter(c, filter));
  return { deletedCount: before - commentsStore.length };
};

// Bookmark stubs
Bookmark.deleteMany = async (filter = {}) => {
  const before = bookmarksStore.length;
  bookmarksStore = bookmarksStore.filter((b) => !matchesFilter(b, filter));
  return { deletedCount: before - bookmarksStore.length };
};

// Notification stubs
Notification.find = (filter = {}) => {
  let sortSpec = {};
  const chain = {
    sort(s) { sortSpec = s; return chain; },
    lean() {
      const matched = sortDocs(notificationsStore.filter((n) => matchesFilter(n, filter)), sortSpec);
      return Promise.resolve(matched.map((n) => ({ ...n })));
    },
    then(onFulfilled, onRejected) { return this.lean().then(onFulfilled, onRejected); },
  };
  return chain;
};
Notification.findById = (id) => {
  const n = notificationsStore.find((x) => toStr(x._id) === toStr(id));
  return Promise.resolve(n ? wrapNotificationDoc(n) : null);
};
Notification.create = async (data) => {
  const now = new Date();
  const raw = {
    _id: new mongoose.Types.ObjectId(),
    recipient: data.recipient,
    type: data.type,
    message: data.message,
    post: data.post,
    comment: data.comment || null,
    read: Boolean(data.read),
    createdAt: now,
    updatedAt: now,
  };
  notificationsStore.push(raw);
  return wrapNotificationDoc(raw);
};
Notification.deleteMany = async (filter = {}) => {
  const before = notificationsStore.length;
  notificationsStore = notificationsStore.filter((n) => !matchesFilter(n, filter));
  return { deletedCount: before - notificationsStore.length };
};

// Report stubs
Report.find = (filter = {}) => {
  let sortSpec = {};
  const populates = [];
  const chain = {
    sort(s) { sortSpec = s; return chain; },
    populate(field) { populates.push(field); return chain; },
    lean() {
      const matched = sortDocs(reportsStore.filter((r) => matchesFilter(r, filter)), sortSpec);
      return Promise.resolve(matched.map((r) => {
        const out = { ...r };
        if (populates.includes('reporter')) {
          const u = usersStore.find((x) => toStr(x._id) === toStr(r.reporter));
          out.reporter = u ? { _id: u._id, name: u.name } : null;
        }
        return out;
      }));
    },
    then(onFulfilled, onRejected) { return this.lean().then(onFulfilled, onRejected); },
  };
  return chain;
};
Report.findById = (id) => {
  const r = reportsStore.find((x) => toStr(x._id) === toStr(id));
  return Promise.resolve(r ? wrapReportDoc(r) : null);
};
Report.create = async (data) => {
  const now = new Date();
  const raw = {
    _id: new mongoose.Types.ObjectId(),
    reporter: data.reporter,
    targetType: data.targetType,
    targetId: data.targetId,
    reason: data.reason,
    status: data.status || 'pending',
    createdAt: now,
    updatedAt: now,
  };
  reportsStore.push(raw);
  return wrapReportDoc(raw);
};
Report.countDocuments = async (filter = {}) => reportsStore.filter((r) => matchesFilter(r, filter)).length;
Report.deleteMany = async (filter = {}) => {
  const before = reportsStore.length;
  reportsStore = reportsStore.filter((r) => !matchesFilter(r, filter));
  return { deletedCount: before - reportsStore.length };
};

// RefreshToken stubs
RefreshToken.updateMany = async (filter = {}, update = {}) => {
  let modified = 0;
  for (const rt of refreshTokensStore) {
    if (matchesFilter(rt, filter)) {
      if (update.$set) Object.assign(rt, update.$set);
      modified += 1;
    }
  }
  return { modifiedCount: modified };
};

function requestApp(method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const socket = new PassThrough();
    socket.remoteAddress = '127.0.0.1';

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = `/api${path}`;

    const reqHeaders = {};
    for (const [k, v] of Object.entries(headers)) reqHeaders[k.toLowerCase()] = v;

    let payload = null;
    if (body !== undefined) {
      payload = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
      reqHeaders['content-type'] = reqHeaders['content-type'] || 'application/json';
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
      const full = Buffer.concat(chunks).toString('utf8');
      const sep = full.indexOf('\r\n\r\n');
      const text = sep !== -1 ? full.slice(sep + 4) : full;
      let json = null;
      if (text) {
        try { json = JSON.parse(text); } catch { json = text; }
      }
      resolve({ status: res.statusCode, body: json, headers: res.getHeaders() });
      return result;
    };

    res.on('error', reject);
    app(req, res);

    if (payload) req.push(payload);
    req.push(null);
  });
}

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

describe('Notifications, Reports & Admin integration suite', () => {
  let studentA;
  let studentB;
  let admin;
  let catUsed;
  let catEmpty;
  let postA;
  let draftA;
  let tokenA;
  let tokenB;
  let tokenAdmin;

  beforeEach(() => {
    const now = new Date();
    studentA = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Alice Student',
      email: 'alice@example.com',
      passwordHash: 'hash',
      role: 'student',
      status: 'active',
      bio: '',
      createdAt: new Date(now - 90000),
      updatedAt: new Date(now - 90000),
    };
    studentB = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Bob Student',
      email: 'bob@example.com',
      passwordHash: 'hash',
      role: 'student',
      status: 'active',
      bio: '',
      createdAt: new Date(now - 70000),
      updatedAt: new Date(now - 70000),
    };
    admin = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Folio Admin',
      email: 'admin@example.com',
      passwordHash: 'hash',
      role: 'admin',
      status: 'active',
      bio: '',
      createdAt: new Date(now - 100000),
      updatedAt: new Date(now - 100000),
    };
    catUsed = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Study',
      description: 'Study habits',
      createdAt: now,
      updatedAt: now,
    };
    catEmpty = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Empty Cat',
      description: '',
      createdAt: now,
      updatedAt: now,
    };
    postA = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Alice Published Post',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
      searchText: 'Alice Published Post Hello',
      author: studentA._id,
      category: catUsed._id,
      status: 'published',
      publishedAt: new Date(now - 50000),
      createdAt: new Date(now - 50000),
      updatedAt: new Date(now - 50000),
    };
    draftA = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Alice Private Draft',
      content: { type: 'doc', content: [] },
      searchText: 'Alice Private Draft',
      author: studentA._id,
      category: catUsed._id,
      status: 'draft',
      publishedAt: null,
      createdAt: new Date(now - 30000),
      updatedAt: new Date(now - 30000),
    };

    usersStore = [studentA, studentB, admin];
    categoriesStore = [catUsed, catEmpty];
    postsStore = [postA, draftA];
    commentsStore = [];
    bookmarksStore = [];
    notificationsStore = [];
    reportsStore = [];
    refreshTokensStore = [
      { _id: new mongoose.Types.ObjectId(), userId: studentB._id, tokenHash: 'h1', revokedAt: null },
    ];

    tokenA = signToken(studentA);
    tokenB = signToken(studentB);
    tokenAdmin = signToken(admin);
  });

  it('1. Generates persistent notifications on comments and replies (excluding self-actions) and enforces ownership on read', async () => {
    // Student A comments on own post -> NO notification
    const selfComment = await requestApp('POST', `/posts/${postA._id}/comments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { content: 'My own note' },
    });
    assert.equal(selfComment.status, 201);
    assert.equal(notificationsStore.length, 0);

    // Student B comments on Student A's post -> Notification for Student A
    const bComment = await requestApp('POST', `/posts/${postA._id}/comments`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { content: 'Nice post!' },
    });
    assert.equal(bComment.status, 201);
    assert.equal(notificationsStore.length, 1);
    assert.equal(notificationsStore[0].type, 'comment');
    assert.equal(toStr(notificationsStore[0].recipient), toStr(studentA._id));

    // Student A replies to Student B's comment -> Notification for Student B
    const aReply = await requestApp('POST', `/comments/${bComment.body.id}/replies`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { content: 'Thanks Bob!' },
    });
    assert.equal(aReply.status, 201);
    assert.equal(notificationsStore.length, 2);

    // Student A lists notifications -> sees only Student A's notification
    const listA = await requestApp('GET', '/notifications', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(listA.status, 200);
    assert.equal(listA.body.length, 1);
    assert.equal(listA.body[0].type, 'comment');
    assert.equal(listA.body[0].read, false);
    assert.equal(listA.body[0].postId, postA._id.toString());

    // Student B cannot mark Student A's notification read -> 403
    const forbidRead = await requestApp('PATCH', `/notifications/${listA.body[0].id}/read`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(forbidRead.status, 403);
    assert.equal(forbidRead.body.error.code, 'FORBIDDEN');

    // Student A marks own notification read -> 200
    const okRead = await requestApp('PATCH', `/notifications/${listA.body[0].id}/read`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(okRead.status, 200);
    assert.deepEqual(okRead.body, { ok: true });
    assert.equal(notificationsStore[0].read, true);
  });

  it('2. POST /api/reports validates input, target visibility, and creates pending reports', async () => {
    const unauth = await requestApp('POST', '/reports', {
      body: { targetType: 'post', targetId: postA._id.toString(), reason: 'Spam' },
    });
    assert.equal(unauth.status, 401);

    // Report draft by non-author -> 404
    const draftRep = await requestApp('POST', '/reports', {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { targetType: 'post', targetId: draftA._id.toString(), reason: 'Hidden' },
    });
    assert.equal(draftRep.status, 404);

    // Empty reason -> 400
    const badReason = await requestApp('POST', '/reports', {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { targetType: 'post', targetId: postA._id.toString(), reason: '   ' },
    });
    assert.equal(badReason.status, 400);
    assert.equal(badReason.body.error.code, 'VALIDATION_ERROR');

    // Valid report on published post -> 201
    const okRep = await requestApp('POST', '/reports', {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { targetType: 'post', targetId: postA._id.toString(), reason: 'Off-topic spam' },
    });
    assert.equal(okRep.status, 201);
    assert.deepEqual(okRep.body, { ok: true });
    assert.equal(reportsStore.length, 1);
    assert.equal(reportsStore[0].status, 'pending');
  });

  it('3. Admin routes enforce requireAdmin (401 guest, 403 student)', async () => {
    const endpoints = [
      ['GET', '/admin/stats'],
      ['GET', '/admin/users'],
      ['PATCH', `/admin/users/${studentB._id}`],
      ['GET', '/admin/reports'],
      ['PATCH', `/admin/reports/${new mongoose.Types.ObjectId()}`],
      ['POST', '/admin/categories'],
      ['PATCH', `/admin/categories/${catUsed._id}`],
      ['DELETE', `/admin/categories/${catEmpty._id}`],
    ];

    for (const [method, path] of endpoints) {
      const guestRes = await requestApp(method, path);
      assert.equal(guestRes.status, 401, `${method} ${path} should return 401 for guest`);

      const studentRes = await requestApp(method, path, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(studentRes.status, 403, `${method} ${path} should return 403 for student`);
      assert.equal(studentRes.body.error.code, 'FORBIDDEN');
    }
  });

  it('4. Admin stats, user search/updates, self-protection, and token revocation on suspend', async () => {
    const statsRes = await requestApp('GET', '/admin/stats', {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(statsRes.status, 200);
    assert.equal(statsRes.body.users, 3);
    assert.equal(statsRes.body.publishedPosts, 1);
    assert.equal(statsRes.body.comments, 0);
    assert.equal(statsRes.body.pendingReports, 0);
    assert.ok(Array.isArray(statsRes.body.recent));

    const usersSearch = await requestApp('GET', '/admin/users?q=bob', {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(usersSearch.status, 200);
    assert.equal(usersSearch.body.length, 1);
    assert.equal(usersSearch.body[0].email, 'bob@example.com');

    // Admin cannot modify own role/status -> 400
    const selfMod = await requestApp('PATCH', `/admin/users/${admin._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: { role: 'student' },
    });
    assert.equal(selfMod.status, 400);
    assert.equal(selfMod.body.error.code, 'VALIDATION_ERROR');

    // Suspend Student B -> revokes refresh tokens
    const suspRes = await requestApp('PATCH', `/admin/users/${studentB._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: { status: 'suspended' },
    });
    assert.equal(suspRes.status, 200);
    assert.equal(suspRes.body.status, 'suspended');
    assert.ok(refreshTokensStore[0].revokedAt instanceof Date);
  });

  it('5. Admin category CRUD enforces uniqueness and non-empty deletion guard', async () => {
    // Duplicate case-insensitive -> 409
    const dupCreate = await requestApp('POST', '/admin/categories', {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: { name: 'study', description: 'dup' },
    });
    assert.equal(dupCreate.status, 409);
    assert.equal(dupCreate.body.error.code, 'CONFLICT');

    // Create valid -> 201
    const okCreate = await requestApp('POST', '/admin/categories', {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: { name: 'Physics', description: 'Physics notes' },
    });
    assert.equal(okCreate.status, 201);
    assert.equal(okCreate.body.name, 'Physics');

    // Update -> 200
    const okUpdate = await requestApp('PATCH', `/admin/categories/${okCreate.body.id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: { name: 'Astrophysics', description: 'Space' },
    });
    assert.equal(okUpdate.status, 200);
    assert.equal(okUpdate.body.name, 'Astrophysics');

    // Delete non-empty category -> 409
    const delUsed = await requestApp('DELETE', `/admin/categories/${catUsed._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(delUsed.status, 409);
    assert.equal(delUsed.body.error.code, 'CONFLICT');

    // Delete empty category -> 200
    const delEmpty = await requestApp('DELETE', `/admin/categories/${catEmpty._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(delEmpty.status, 200);
    assert.deepEqual(delEmpty.body, { ok: true });
  });

  it('6. Admin report moderation supports dismiss and resolve with cascade deletion & report retention', async () => {
    // Add comment, bookmark, notification, and 2 reports on postA
    const c1 = await Comment.create({ post: postA._id, author: studentB._id, content: 'Bad comment' });
    bookmarksStore.push({ _id: new mongoose.Types.ObjectId(), userId: studentB._id, postId: postA._id });
    await Notification.create({
      recipient: studentA._id,
      type: 'comment',
      message: 'Bob commented',
      post: postA._id,
      comment: c1._id,
    });
    const repDismiss = await Report.create({
      reporter: studentB._id,
      targetType: 'comment',
      targetId: c1._id,
      reason: 'Minor issue',
    });
    const repResolve = await Report.create({
      reporter: studentB._id,
      targetType: 'post',
      targetId: postA._id,
      reason: 'Severe violation',
    });

    // List pending reports
    const pendingList = await requestApp('GET', '/admin/reports?status=pending', {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(pendingList.status, 200);
    assert.equal(pendingList.body.length, 2);

    // Dismiss comment report -> comment remains, status becomes dismissed
    const dismissRes = await requestApp('PATCH', `/admin/reports/${repDismiss._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: { action: 'dismiss' },
    });
    assert.equal(dismissRes.status, 200);
    assert.equal(commentsStore.length, 1);

    // Resolve post report -> post, comment, bookmark, notification deleted; resolved report retained with target: null
    const resolveRes = await requestApp('PATCH', `/admin/reports/${repResolve._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: { action: 'resolve' },
    });
    assert.equal(resolveRes.status, 200);
    assert.equal(postsStore.some((p) => toStr(p._id) === toStr(postA._id)), false);
    assert.equal(commentsStore.length, 0);
    assert.equal(bookmarksStore.length, 0);
    assert.equal(notificationsStore.length, 0);

    const resolvedList = await requestApp('GET', '/admin/reports?status=resolved', {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert.equal(resolvedList.status, 200);
    assert.equal(resolvedList.body.length, 1);
    assert.equal(resolvedList.body[0].id, repResolve._id.toString());
    assert.equal(resolvedList.body[0].status, 'resolved');
    assert.equal(resolvedList.body[0].target, null);
  });
});

