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
const { seedDatabase } = require('../src/scripts/seed');
const app = require('../src/app');

let usersStore = [];
let categoriesStore = [];
let postsStore = [];
let commentsStore = [];
let bookmarksStore = [];

function toStr(id) {
  return id ? id.toString() : '';
}

function matchesFilter(doc, filter = {}) {
  if (filter.status && doc.status !== filter.status) return false;
  if (filter.category && toStr(doc.category) !== toStr(filter.category)) return false;
  if (filter.author && toStr(doc.author) !== toStr(filter.author)) return false;
  if (filter.post && toStr(doc.post) !== toStr(filter.post)) return false;
  if (filter.postId) {
    if (filter.postId.$in) {
      const allowed = filter.postId.$in.map(toStr);
      if (!allowed.includes(toStr(doc.postId))) return false;
    } else if (toStr(doc.postId) !== toStr(filter.postId)) {
      return false;
    }
  }
  if (filter.userId && toStr(doc.userId) !== toStr(filter.userId)) return false;
  if (filter._id) {
    if (filter._id.$in) {
      const allowed = filter._id.$in.map(toStr);
      if (!allowed.includes(toStr(doc._id))) return false;
    } else if (toStr(doc._id) !== toStr(filter._id)) {
      return false;
    }
  }
  if (filter.$or) {
    const ok = filter.$or.some((clause) => {
      if (clause._id && toStr(doc._id) === toStr(clause._id)) return true;
      if (clause.title instanceof RegExp) return clause.title.test(doc.title || '');
      if (clause.searchText instanceof RegExp) return clause.searchText.test(doc.searchText || '');
      return false;
    });
    if (!ok) return false;
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
        updatedAt: new Date(),
      };
    }
    return doc;
  };
  return doc;
}

function makePostDoc(stored) {
  const doc = new Post(stored);
  doc._id = stored._id;
  doc.isNew = false;
  doc.save = async () => {
    const idx = postsStore.findIndex((p) => toStr(p._id) === toStr(doc._id));
    const updated = {
      _id: doc._id,
      title: doc.title,
      content: doc.content,
      searchText: 'updated text',
      author: doc.author,
      category: doc.category,
      status: doc.status,
      publishedAt: doc.publishedAt,
      createdAt: stored.createdAt || new Date(),
      updatedAt: new Date(),
    };
    if (idx >= 0) postsStore[idx] = updated;
    return doc;
  };
  return doc;
}

// User model stubs
User.findById = (id) => {
  const u = usersStore.find((x) => toStr(x._id) === toStr(id));
  return Promise.resolve(u ? wrapUserDoc(u) : null);
};

User.findOne = async (query) => {
  const email = query.email ? String(query.email).trim().toLowerCase() : null;
  return usersStore.find((u) => (email ? u.email === email : false)) || null;
};

User.create = async (data) => {
  const now = new Date();
  const raw = {
    _id: new mongoose.Types.ObjectId(),
    name: data.name,
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

// Category model stubs
Category.findById = (id) => {
  const c = categoriesStore.find((x) => toStr(x._id) === toStr(id)) || null;
  return Promise.resolve(c);
};

Category.findOne = async (query) => categoriesStore.find((c) => c.name === query.name) || null;

Category.create = async (data) => {
  const now = new Date();
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    name: data.name.trim(),
    description: (data.description || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  categoriesStore.push(doc);
  return doc;
};

// Post model stubs
Post.find = (filter = {}) => {
  let sortSpec = {};
  let skipN = 0;
  let limitN = Infinity;
  const populates = [];
  const chain = {
    sort(s) { sortSpec = s; return chain; },
    skip(n) { skipN = n; return chain; },
    limit(n) { limitN = n; return chain; },
    populate(field) { populates.push(field); return chain; },
    lean() {
      const matched = sortDocs(postsStore.filter((p) => matchesFilter(p, filter)), sortSpec);
      const sliced = matched.slice(skipN, skipN + limitN).map((p) => {
        const out = { ...p };
        if (populates.includes('author') || populates.some((x) => x && x.path === 'author')) {
          const a = usersStore.find((u) => toStr(u._id) === toStr(p.author));
          out.author = a ? { _id: a._id, name: a.name, bio: a.bio } : null;
        }
        if (populates.includes('category') || populates.some((x) => x && x.path === 'category')) {
          const c = categoriesStore.find((cat) => toStr(cat._id) === toStr(p.category));
          out.category = c ? { _id: c._id, name: c.name, description: c.description } : null;
        }
        return out;
      });
      return Promise.resolve(sliced);
    },
    then(onFulfilled, onRejected) {
      return this.lean().then(onFulfilled, onRejected);
    },
  };
  return chain;
};

Post.findById = (id) => {
  const populates = [];
  const resolveDoc = () => {
    const raw = postsStore.find((p) => toStr(p._id) === toStr(id));
    if (!raw) return null;
    return makePostDoc(raw);
  };
  const resolveLean = () => {
    const raw = postsStore.find((p) => toStr(p._id) === toStr(id));
    if (!raw) return null;
    const out = { ...raw };
    if (populates.includes('author')) {
      const a = usersStore.find((u) => toStr(u._id) === toStr(raw.author));
      out.author = a ? { _id: a._id, name: a.name, bio: a.bio } : null;
    }
    if (populates.includes('category')) {
      const c = categoriesStore.find((cat) => toStr(cat._id) === toStr(raw.category));
      out.category = c ? { _id: c._id, name: c.name, description: c.description } : null;
    }
    return out;
  };

  return {
    populate(field) { populates.push(field); return this; },
    lean() { return Promise.resolve(resolveLean()); },
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveDoc()).then(onFulfilled, onRejected);
    },
  };
};

Post.findOne = async (query) => {
  const p = postsStore.find((x) => (query.title ? x.title === query.title : matchesFilter(x, query)));
  return p ? makePostDoc(p) : null;
};

Post.countDocuments = async (filter) => postsStore.filter((p) => matchesFilter(p, filter)).length;

Post.create = async (data) => {
  const now = new Date();
  const stored = {
    _id: new mongoose.Types.ObjectId(),
    title: data.title,
    content: data.content,
    searchText: `${data.title} sample content`,
    author: data.author,
    category: data.category || null,
    status: data.status || 'draft',
    publishedAt: data.publishedAt || null,
    createdAt: now,
    updatedAt: now,
  };
  postsStore.push(stored);
  return makePostDoc(stored);
};

Post.deleteOne = async (filter = {}) => {
  const before = postsStore.length;
  postsStore = postsStore.filter((p) => !matchesFilter(p, filter));
  return { deletedCount: before - postsStore.length };
};

// Comment model stubs
Comment.findOne = async (filter) => {
  const match = commentsStore.find((c) => {
    if (filter.post && toStr(c.post) !== toStr(filter.post)) return false;
    if (filter.author && toStr(c.author) !== toStr(filter.author)) return false;
    if (filter.content && c.content !== filter.content) return false;
    if (filter.parentId !== undefined && toStr(c.parentId) !== toStr(filter.parentId)) return false;
    return true;
  });
  return match ? { ...match } : null;
};

Comment.create = async (data) => {
  const now = new Date();
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    post: data.post,
    author: data.author,
    parentId: data.parentId || null,
    content: data.content,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
  commentsStore.push(doc);
  return doc;
};

Comment.deleteMany = async (filter = {}) => {
  const before = commentsStore.length;
  commentsStore = commentsStore.filter((c) => !matchesFilter(c, filter));
  return { deletedCount: before - commentsStore.length };
};

Comment.aggregate = async (pipeline = []) => {
  let list = [...commentsStore];
  const matchStage = pipeline.find((p) => p.$match);
  if (matchStage && matchStage.$match.post && matchStage.$match.post.$in) {
    const allowed = matchStage.$match.post.$in.map(toStr);
    list = list.filter((c) => allowed.includes(toStr(c.post)));
  }
  const groupStage = pipeline.find((p) => p.$group);
  if (groupStage) {
    const counts = new Map();
    for (const c of list) {
      const k = toStr(c.post);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([k, count]) => ({ _id: k, count }));
  }
  return [];
};

// Bookmark model stubs
Bookmark.findOne = (filter) => {
  const match = bookmarksStore.find((b) => matchesFilter(b, filter));
  return {
    lean: () => Promise.resolve(match ? { ...match } : null),
    then: (resolve, reject) => Promise.resolve(match ? { ...match } : null).then(resolve, reject),
  };
};

Bookmark.find = (filter = {}) => {
  let sortSpec = {};
  const chain = {
    sort(s) { sortSpec = s; return chain; },
    select() { return chain; },
    lean() {
      let matched = bookmarksStore.filter((b) => matchesFilter(b, filter));
      matched = sortDocs(matched, sortSpec);
      return Promise.resolve(matched.map((b) => ({ ...b })));
    },
    then(onFulfilled, onRejected) {
      return this.lean().then(onFulfilled, onRejected);
    },
  };
  return chain;
};

Bookmark.updateOne = async (filter, update, options = {}) => {
  const existingIdx = bookmarksStore.findIndex((b) => matchesFilter(b, filter));
  if (existingIdx >= 0) {
    return { acknowledged: true, modifiedCount: 0, matchedCount: 1 };
  }
  if (options.upsert) {
    const now = new Date();
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      userId: filter.userId,
      postId: filter.postId,
      createdAt: now,
      updatedAt: now,
    };
    bookmarksStore.push(doc);
    return { acknowledged: true, upsertedCount: 1, upsertedId: doc._id };
  }
  return { acknowledged: true, modifiedCount: 0, matchedCount: 0 };
};

Bookmark.deleteOne = async (filter) => {
  const before = bookmarksStore.length;
  bookmarksStore = bookmarksStore.filter((b) => !matchesFilter(b, filter));
  return { acknowledged: true, deletedCount: before - bookmarksStore.length };
};

Bookmark.deleteMany = async (filter = {}) => {
  const before = bookmarksStore.length;
  bookmarksStore = bookmarksStore.filter((b) => !matchesFilter(b, filter));
  return { acknowledged: true, deletedCount: before - bookmarksStore.length };
};

Bookmark.create = async (data) => {
  const now = new Date();
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    userId: data.userId,
    postId: data.postId,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
  bookmarksStore.push(doc);
  return doc;
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
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }
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

describe('Bookmarks & User Profiles integration suite (Step 5)', () => {
  let userA;
  let userB;
  let suspendedUser;
  let cat1;
  let cat2;
  let post1;
  let post2;
  let draftPost;
  let tokenA;
  let tokenB;

  beforeEach(() => {
    const now = new Date();
    userA = {
      _id: new mongoose.Types.ObjectId(),
      name: 'User A',
      email: 'usera@example.com',
      passwordHash: 'hashA',
      role: 'student',
      status: 'active',
      bio: 'Bio of User A',
      createdAt: new Date(now - 100000),
      updatedAt: new Date(now - 100000),
    };
    userB = {
      _id: new mongoose.Types.ObjectId(),
      name: 'User B',
      email: 'userb@example.com',
      passwordHash: 'hashB',
      role: 'student',
      status: 'active',
      bio: 'Bio of User B',
      createdAt: new Date(now - 80000),
      updatedAt: new Date(now - 80000),
    };
    suspendedUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Suspended User',
      email: 'suspended@example.com',
      passwordHash: 'hashSusp',
      role: 'student',
      status: 'suspended',
      bio: 'Suspended bio',
      createdAt: new Date(now - 50000),
      updatedAt: new Date(now - 50000),
    };
    cat1 = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Engineering',
      description: 'Engineering posts',
      createdAt: now,
      updatedAt: now,
    };
    cat2 = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Design',
      description: 'Design posts',
      createdAt: now,
      updatedAt: now,
    };
    post1 = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Post One Engineering',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Eng content' }] }] },
      searchText: 'Post One Engineering Eng content',
      author: userA._id,
      category: cat1._id,
      status: 'published',
      publishedAt: new Date(now - 60000),
      createdAt: new Date(now - 60000),
      updatedAt: new Date(now - 60000),
    };
    post2 = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Post Two Design',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Design content' }] }] },
      searchText: 'Post Two Design Design content',
      author: userB._id,
      category: cat2._id,
      status: 'published',
      publishedAt: new Date(now - 40000),
      createdAt: new Date(now - 40000),
      updatedAt: new Date(now - 40000),
    };
    draftPost = {
      _id: new mongoose.Types.ObjectId(),
      title: 'User A Draft',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft content' }] }] },
      searchText: 'User A Draft',
      author: userA._id,
      category: cat1._id,
      status: 'draft',
      publishedAt: null,
      createdAt: new Date(now - 20000),
      updatedAt: new Date(now - 20000),
    };

    usersStore = [userA, userB, suspendedUser];
    categoriesStore = [cat1, cat2];
    postsStore = [post1, post2, draftPost];
    commentsStore = [];
    bookmarksStore = [];

    tokenA = signToken(userA);
    tokenB = signToken(userB);
  });

  it('1. Bookmarking requires authentication, validates visibility, and is idempotent', async () => {
    // Unauthenticated -> 401
    const unauth = await requestApp('POST', `/posts/${post1._id}/bookmark`);
    assert.equal(unauth.status, 401);
    assert.equal(unauth.body.error.code, 'UNAUTHENTICATED');

    // Invalid ObjectId -> 400
    const invalidId = await requestApp('POST', '/posts/not-an-id/bookmark', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(invalidId.status, 400);
    assert.equal(invalidId.body.error.code, 'VALIDATION_ERROR');

    // Non-existent post -> 404
    const nonExistentId = new mongoose.Types.ObjectId();
    const notFound = await requestApp('POST', `/posts/${nonExistentId}/bookmark`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(notFound.status, 404);
    assert.equal(notFound.body.error.code, 'RESOURCE_NOT_FOUND');

    // User B attempting to bookmark User A's draft -> 404
    const draftForOther = await requestApp('POST', `/posts/${draftPost._id}/bookmark`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(draftForOther.status, 404);
    assert.equal(draftForOther.body.error.code, 'RESOURCE_NOT_FOUND');

    // Author bookmarking their own draft -> 200
    const authorDraft = await requestApp('POST', `/posts/${draftPost._id}/bookmark`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(authorDraft.status, 200);
    assert.deepEqual(authorDraft.body, { ok: true });

    // User A bookmarking published post2 -> 200
    const addRes1 = await requestApp('POST', `/posts/${post2._id}/bookmark`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(addRes1.status, 200);
    assert.deepEqual(addRes1.body, { ok: true });
    assert.equal(bookmarksStore.length, 2);

    // Repeated bookmark on post2 (idempotent) -> 200, no duplicates
    const addRes2 = await requestApp('POST', `/posts/${post2._id}/bookmark`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(addRes2.status, 200);
    assert.deepEqual(addRes2.body, { ok: true });
    assert.equal(bookmarksStore.length, 2);
  });

  it('2. DELETE /api/posts/:id/bookmark removes bookmarks idempotently', async () => {
    // Bookmark post2 first
    bookmarksStore.push({
      _id: new mongoose.Types.ObjectId(),
      userId: userA._id,
      postId: post2._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Unauthenticated -> 401
    const unauth = await requestApp('DELETE', `/posts/${post2._id}/bookmark`);
    assert.equal(unauth.status, 401);
    assert.equal(unauth.body.error.code, 'UNAUTHENTICATED');

    // Delete existing bookmark -> 200
    const delRes1 = await requestApp('DELETE', `/posts/${post2._id}/bookmark`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(delRes1.status, 200);
    assert.deepEqual(delRes1.body, { ok: true });
    assert.equal(bookmarksStore.length, 0);

    // Delete again (idempotent) -> 200
    const delRes2 = await requestApp('DELETE', `/posts/${post2._id}/bookmark`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(delRes2.status, 200);
    assert.deepEqual(delRes2.body, { ok: true });
  });

  it('3. GET /api/bookmarks returns paginated bookmarked posts with filters and ordering', async () => {
    // Unauthenticated -> 401
    const unauth = await requestApp('GET', '/bookmarks');
    assert.equal(unauth.status, 401);
    assert.equal(unauth.body.error.code, 'UNAUTHENTICATED');

    // Setup 2 bookmarks for User A: post1 (earlier) and post2 (later)
    const tEarly = new Date(Date.now() - 50000);
    const tLate = new Date(Date.now() - 10000);
    bookmarksStore.push({
      _id: new mongoose.Types.ObjectId(),
      userId: userA._id,
      postId: post1._id,
      createdAt: tEarly,
      updatedAt: tEarly,
    });
    bookmarksStore.push({
      _id: new mongoose.Types.ObjectId(),
      userId: userA._id,
      postId: post2._id,
      createdAt: tLate,
      updatedAt: tLate,
    });

    // Add a comment to post2 to verify dynamic commentCount
    commentsStore.push({
      _id: new mongoose.Types.ObjectId(),
      post: post2._id,
      author: userB._id,
      content: 'Great design',
    });

    const res = await requestApp('GET', '/bookmarks', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers['x-total-count'], '2');
    assert.equal(res.headers['x-page'], '1');
    assert.equal(res.headers['x-limit'], '20');
    assert.equal(res.headers['x-total-pages'], '1');
    assert.equal(res.body.length, 2);

    // Most recently bookmarked post (post2) comes first
    assert.equal(res.body[0].id, post2._id.toString());
    assert.equal(res.body[0].bookmarked, true);
    assert.equal(res.body[0].commentCount, 1);

    assert.equal(res.body[1].id, post1._id.toString());
    assert.equal(res.body[1].bookmarked, true);
    assert.equal(res.body[1].commentCount, 0);

    // Filtering by category: category 1 matches post1 only
    const catRes = await requestApp('GET', `/bookmarks?category=${cat1._id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(catRes.status, 200);
    assert.equal(catRes.headers['x-total-count'], '1');
    assert.equal(catRes.body.length, 1);
    assert.equal(catRes.body[0].id, post1._id.toString());

    // Filtering by keyword: 'design' matches post2
    const qRes = await requestApp('GET', '/bookmarks?q=design', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(qRes.status, 200);
    assert.equal(qRes.headers['x-total-count'], '1');
    assert.equal(qRes.body.length, 1);
    assert.equal(qRes.body[0].id, post2._id.toString());
  });

  it('4. User isolation: bookmarks are private and separated per user', async () => {
    // User A bookmarks post1
    bookmarksStore.push({
      _id: new mongoose.Types.ObjectId(),
      userId: userA._id,
      postId: post1._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // User B requests /bookmarks -> empty
    const bRes = await requestApp('GET', '/bookmarks', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(bRes.status, 200);
    assert.equal(bRes.headers['x-total-count'], '0');
    assert.deepEqual(bRes.body, []);
  });

  it('5. Dynamic bookmarked boolean reflects caller across feeds and post details', async () => {
    // User A has bookmarked post1
    bookmarksStore.push({
      _id: new mongoose.Types.ObjectId(),
      userId: userA._id,
      postId: post1._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Unauthenticated guest on GET /posts -> bookmarked: false for all
    const guestFeed = await requestApp('GET', '/posts');
    assert.equal(guestFeed.status, 200);
    for (const post of guestFeed.body) {
      assert.equal(post.bookmarked, false);
    }

    // Guest on GET /posts/:id -> bookmarked: false
    const guestDetail = await requestApp('GET', `/posts/${post1._id}`);
    assert.equal(guestDetail.status, 200);
    assert.equal(guestDetail.body.bookmarked, false);

    // User A on GET /posts -> post1 is bookmarked: true, post2 is bookmarked: false
    const userAFeed = await requestApp('GET', '/posts', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userAFeed.status, 200);
    const p1InFeedA = userAFeed.body.find((p) => p.id === post1._id.toString());
    const p2InFeedA = userAFeed.body.find((p) => p.id === post2._id.toString());
    assert.equal(p1InFeedA.bookmarked, true);
    assert.equal(p2InFeedA.bookmarked, false);

    // User A on GET /posts/:id -> bookmarked: true
    const userADetail = await requestApp('GET', `/posts/${post1._id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userADetail.status, 200);
    assert.equal(userADetail.body.bookmarked, true);

    // User B on GET /posts/:id -> bookmarked: false
    const userBDetail = await requestApp('GET', `/posts/${post1._id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(userBDetail.status, 200);
    assert.equal(userBDetail.body.bookmarked, false);
  });

  it('6. GET /api/users/:id returns public author profile, published posts, and omits sensitive fields', async () => {
    // Bookmark post1 as User B
    bookmarksStore.push({
      _id: new mongoose.Types.ObjectId(),
      userId: userB._id,
      postId: post1._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Invalid ObjectId -> 400
    const invRes = await requestApp('GET', '/users/not-valid-id');
    assert.equal(invRes.status, 400);
    assert.equal(invRes.body.error.code, 'VALIDATION_ERROR');

    // Non-existent user -> 404
    const notFoundId = new mongoose.Types.ObjectId();
    const nfRes = await requestApp('GET', `/users/${notFoundId}`);
    assert.equal(nfRes.status, 404);
    assert.equal(nfRes.body.error.code, 'RESOURCE_NOT_FOUND');

    // Suspended user -> 404
    const suspRes = await requestApp('GET', `/users/${suspendedUser._id}`);
    assert.equal(suspRes.status, 404);
    assert.equal(suspRes.body.error.code, 'RESOURCE_NOT_FOUND');

    // Public profile of User A accessed by User B
    const profileRes = await requestApp('GET', `/users/${userA._id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    assert.equal(profileRes.status, 200);
    const { user, posts } = profileRes.body;

    // Verify user object shape & sensitive field omission
    assert.equal(user.id, userA._id.toString());
    assert.equal(user.name, userA.name);
    assert.equal(user.bio, userA.bio);
    assert.ok(user.createdAt);
    assert.equal(user.email, undefined);
    assert.equal(user.role, undefined);
    assert.equal(user.status, undefined);
    assert.equal(user.passwordHash, undefined);

    // User A has 1 published post (post1) and 1 draft (draftPost).
    // Draft must NOT be included in public profile!
    assert.equal(posts.length, 1);
    assert.equal(posts[0].id, post1._id.toString());
    assert.equal(posts[0].title, post1.title);
    assert.equal(posts[0].bookmarked, true); // User B has bookmarked post1
  });

  it('7. PATCH /api/users/me updates name and bio with strict allowlist validation', async () => {
    // Unauthenticated -> 401
    const unauth = await requestApp('PATCH', '/users/me', {
      body: { name: 'New Name' },
    });
    assert.equal(unauth.status, 401);
    assert.equal(unauth.body.error.code, 'UNAUTHENTICATED');

    // Empty body -> 400
    const emptyRes = await requestApp('PATCH', '/users/me', {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {},
    });
    assert.equal(emptyRes.status, 400);
    assert.equal(emptyRes.body.error.code, 'VALIDATION_ERROR');

    // Empty name -> 400
    const blankName = await requestApp('PATCH', '/users/me', {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { name: '   ' },
    });
    assert.equal(blankName.status, 400);
    assert.equal(blankName.body.error.code, 'VALIDATION_ERROR');

    // Valid update with name and bio, and attempted privilege escalation
    const updateRes = await requestApp('PATCH', '/users/me', {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        name: 'Tangerine Updated',
        bio: 'Updated bio information',
        role: 'admin',
        status: 'suspended',
        email: 'hacked@example.com',
      },
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.id, userA._id.toString());
    assert.equal(updateRes.body.name, 'Tangerine Updated');
    assert.equal(updateRes.body.bio, 'Updated bio information');
    // Privilege escalation ignored
    assert.equal(updateRes.body.role, 'student');
    assert.equal(updateRes.body.status, 'active');
    assert.equal(updateRes.body.email, 'usera@example.com');
  });

  it('8. Post deletion cascades and deletes related bookmarks', async () => {
    // Bookmark post1
    bookmarksStore.push({
      _id: new mongoose.Types.ObjectId(),
      userId: userB._id,
      postId: post1._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assert.equal(bookmarksStore.length, 1);

    // Delete post1 as author User A
    const delRes = await requestApp('DELETE', `/posts/${post1._id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(delRes.status, 200);
    assert.deepEqual(delRes.body, { ok: true });

    // Bookmark was cascaded and removed
    assert.equal(bookmarksStore.length, 0);
  });

  it('9. seedDatabase creates demo bookmarks idempotently', async () => {
    // Clear and run seedDatabase with models
    usersStore = [];
    categoriesStore = [];
    postsStore = [];
    commentsStore = [];
    bookmarksStore = [];

    const res1 = await seedDatabase({
      UserModel: User,
      CategoryModel: Category,
      PostModel: Post,
      CommentModel: Comment,
      BookmarkModel: Bookmark,
    });

    assert.ok(res1.bookmarksCreated > 0);
    const countAfterFirst = bookmarksStore.length;

    // Second run should create 0 new bookmarks
    const res2 = await seedDatabase({
      UserModel: User,
      CategoryModel: Category,
      PostModel: Post,
      CommentModel: Comment,
      BookmarkModel: Bookmark,
    });

    assert.equal(res2.bookmarksCreated, 0);
    assert.equal(bookmarksStore.length, countAfterFirst);
  });
});
