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
const { extractText } = require('../src/utils/content');
const { seedDatabase } = require('../src/scripts/seed');
const app = require('../src/app');

let usersStore = [];
let categoriesStore = [];
let postsStore = [];

function toStr(id) {
  return id ? id.toString() : '';
}

function matchesFilter(doc, filter = {}) {
  if (filter.status && doc.status !== filter.status) return false;
  if (filter.category && toStr(doc.category) !== toStr(filter.category)) return false;
  if (filter.author && toStr(doc.author) !== toStr(filter.author)) return false;
  if (filter.title && doc.title !== filter.title) return false;
  if (filter.$or) {
    const ok = filter.$or.some((clause) => {
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

// Stub Mongoose static methods for deterministic offline testing of Express routes/services
User.findById = (id) => {
  const u = usersStore.find((x) => toStr(x._id) === toStr(id));
  if (!u) return Promise.resolve(null);
  const doc = new User(u);
  doc._id = u._id;
  return Promise.resolve(doc);
};

User.findOne = async (query) => {
  const email = query.email ? String(query.email).trim().toLowerCase() : null;
  return usersStore.find((u) => (email ? u.email === email : false)) || null;
};

User.create = async (data) => {
  const now = new Date();
  const doc = {
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
  usersStore.push(doc);
  return doc;
};

Category.find = () => {
  let sortSpec = {};
  const chain = {
    sort(s) { sortSpec = s; return chain; },
    lean() { return Promise.resolve(sortDocs(categoriesStore, sortSpec)); },
  };
  return chain;
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

const origPostFind = () => {
  return (filter = {}) => {
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
          if (populates.includes('author')) {
            const u = usersStore.find((x) => toStr(x._id) === toStr(p.author));
            out.author = u ? { _id: u._id, name: u.name, bio: u.bio } : null;
          }
          if (populates.includes('category')) {
            const c = categoriesStore.find((x) => toStr(x._id) === toStr(p.category));
            out.category = c ? { _id: c._id, name: c.name, description: c.description } : null;
          }
          return out;
        });
        return Promise.resolve(sliced);
      },
    };
    return chain;
  };
};

Post.find = origPostFind();
Post.findOne = async (filter) => postsStore.find((p) => matchesFilter(p, filter)) || null;
Post.countDocuments = async (filter) => postsStore.filter((p) => matchesFilter(p, filter)).length;

Post.findById = (id) => {
  const populates = [];
  const chain = {
    populate(field) { populates.push(field); return chain; },
    lean() {
      const p = postsStore.find((x) => toStr(x._id) === toStr(id));
      if (!p) return Promise.resolve(null);
      const out = { ...p };
      if (populates.includes('author')) {
        const u = usersStore.find((x) => toStr(x._id) === toStr(p.author));
        out.author = u ? { _id: u._id, name: u.name, bio: u.bio } : null;
      }
      if (populates.includes('category')) {
        const c = categoriesStore.find((x) => toStr(x._id) === toStr(p.category));
        out.category = c ? { _id: c._id, name: c.name, description: c.description } : null;
      }
      return Promise.resolve(out);
    },
  };
  return chain;
};

Post.aggregate = async () => {
  const counts = new Map();
  for (const p of postsStore) {
    if (p.status === 'published' && p.category) {
      const key = toStr(p.category);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).map(([id, postCount]) => ({ _id: id, postCount }));
};

Post.create = async (data) => {
  const now = new Date();
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    title: data.title.trim(),
    content: data.content,
    searchText: extractText(data.content).replace(/\s+/g, ' ').trim(),
    author: data.author,
    category: data.category || null,
    status: data.status || 'draft',
    publishedAt: data.publishedAt ?? null,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
  postsStore.push(doc);
  return doc;
};

function request(urlPath, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const socket = new PassThrough();
    socket.remoteAddress = '127.0.0.1';
    const req = new http.IncomingMessage(socket);
    req.method = 'GET';
    req.url = `/api${urlPath}`;
    req.headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));

    const res = new http.ServerResponse(req);
    const chunks = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);
    res.assignSocket(socket);
    res.write = (c, e, cb) => { if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c, e)); return origWrite(c, e, cb); };
    res.end = (c, e, cb) => {
      if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c, e));
      const out = origEnd(c, e, cb);
      const full = Buffer.concat(chunks).toString('utf8');
      const sep = full.indexOf('\r\n\r\n');
      const text = sep !== -1 ? full.slice(sep + 4) : full;
      let json = null;
      if (text) { try { json = JSON.parse(text); } catch { json = text; } }
      resolve({ status: res.statusCode, headers: res.getHeaders(), json });
      return out;
    };
    res.on('error', reject);
    app(req, res);
    req.push(null);
  });
}

function signToken(user) {
  return jwt.sign({ sub: toStr(user._id), role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

beforeEach(() => {
  usersStore = [];
  categoriesStore = [];
  postsStore = [];
  Post.find = origPostFind();
});

describe('Categories & Posts integration suite (Step 2)', () => {
  it('seeds idempotently without duplicating users, categories, or posts', async () => {
    const first = await seedDatabase({ UserModel: User, CategoryModel: Category, PostModel: Post });
    assert.deepEqual(first, { usersCreated: 5, categoriesCreated: 5, postsCreated: 6 });

    const second = await seedDatabase({ UserModel: User, CategoryModel: Category, PostModel: Post });
    assert.deepEqual(second, { usersCreated: 0, categoriesCreated: 0, postsCreated: 0 });
    assert.equal(usersStore.length, 5);
    assert.equal(categoriesStore.length, 5);
    assert.equal(postsStore.length, 6);
  });

  it('syncs searchText automatically via Mongoose pre-validate hook on Post', async () => {
    const doc = new Post({
      title: 'Hook test',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rayleigh scattering physics' }] }] },
      author: new mongoose.Types.ObjectId(),
    });
    await doc.validate();
    assert.equal(doc.searchText, 'Rayleigh scattering physics');
  });

  it('GET /api/categories returns sorted categories with published postCount and handles empty results', async () => {
    const emptyRes = await request('/categories');
    assert.equal(emptyRes.status, 200);
    assert.deepEqual(emptyRes.json, []);

    await seedDatabase({ UserModel: User, CategoryModel: Category, PostModel: Post });
    const res = await request('/categories');
    assert.equal(res.status, 200);
    assert.equal(res.json.length, 5);
    // Alphabetical order: Campus Life, Design, Programming, Science, Study Tips
    assert.deepEqual(res.json.map((c) => c.name), ['Campus Life', 'Design', 'Programming', 'Science', 'Study Tips']);
    // Programming has 1 published + 1 draft in seed -> postCount must be 1
    const programming = res.json.find((c) => c.name === 'Programming');
    assert.equal(programming.postCount, 1);
  });

  it('GET /api/posts supports public feed, pagination headers, filtering, sorting, and empty results', async () => {
    await seedDatabase({ UserModel: User, CategoryModel: Category, PostModel: Post });

    // Page 1, limit 2 (newest first; 5 published total, draft excluded)
    const p1 = await request('/posts?page=1&limit=2');
    assert.equal(p1.status, 200);
    assert.equal(p1.json.length, 2);
    assert.equal(p1.headers['x-total-count'], '5');
    assert.equal(p1.headers['x-page'], '1');
    assert.equal(p1.headers['x-limit'], '2');
    assert.equal(p1.headers['x-total-pages'], '3');
    assert.equal(p1.json[0].title, 'Surviving your first all-nighter (and why you should avoid the second)');

    // Page 3 -> 1 item
    const p3 = await request('/posts?page=3&limit=2');
    assert.equal(p3.status, 200);
    assert.equal(p3.json.length, 1);

    // Out-of-range page -> empty array
    const p4 = await request('/posts?page=4&limit=2');
    assert.equal(p4.status, 200);
    assert.deepEqual(p4.json, []);

    // Oldest sort
    const oldest = await request('/posts?sort=oldest&limit=1');
    assert.equal(oldest.status, 200);
    assert.equal(oldest.json[0].title, 'The two-pass method: how I stopped re-reading my notes');

    // Keyword search matching body text (searchText) + regex-safe query
    const bodyMatch = await request('/posts?q=Rayleigh');
    assert.equal(bodyMatch.status, 200);
    assert.equal(bodyMatch.json.length, 1);
    assert.equal(bodyMatch.json[0].title, 'Why the sky is blue, and why the sunset is not');

    const regexChars = await request('/posts?q=no-match(xyz)+[1]');
    assert.equal(regexChars.status, 200);
    assert.deepEqual(regexChars.json, []);

    // Filter by category and authorId
    const scienceCat = categoriesStore.find((c) => c.name === 'Science');
    const byCat = await request(`/posts?category=${toStr(scienceCat._id)}`);
    assert.equal(byCat.status, 200);
    assert.equal(byCat.json.length, 1);

    const tangerine = usersStore.find((u) => u.email === 'student@demo.com');
    const byAuthor = await request(`/posts?authorId=${toStr(tangerine._id)}`);
    assert.equal(byAuthor.status, 200);
    assert.equal(byAuthor.json.length, 2); // excludes draft
  });

  it('integrates optionalAuth on /posts and /posts/:id without blocking public visitors', async () => {
    await seedDatabase({ UserModel: User, CategoryModel: Category, PostModel: Post });
    const author = usersStore.find((u) => u.email === 'student@demo.com');
    const otherStudent = usersStore.find((u) => u.email === 'daniel@demo.com');
    const admin = usersStore.find((u) => u.email === 'admin@demo.com');
    const published = postsStore.find((p) => p.status === 'published');
    const draft = postsStore.find((p) => p.status === 'draft');

    // Public feed works with no token, invalid token, and valid token
    assert.equal((await request('/posts')).status, 200);
    assert.equal((await request('/posts', { headers: { Authorization: 'Bearer bad.token' } })).status, 200);
    assert.equal((await request('/posts', { headers: { Authorization: `Bearer ${signToken(author)}` } })).status, 200);

    // ?mine=true requires auth
    const mineUnauth = await request('/posts?mine=true');
    assert.equal(mineUnauth.status, 401);
    assert.equal(mineUnauth.json.error.code, 'UNAUTHENTICATED');

    const mineAuth = await request('/posts?mine=true', { headers: { Authorization: `Bearer ${signToken(author)}` } });
    assert.equal(mineAuth.status, 200);
    assert.equal(mineAuth.json.length, 3); // 2 published + 1 draft for Tangerine

    // Published post detail includes author and category details
    const pubDetail = await request(`/posts/${toStr(published._id)}`);
    assert.equal(pubDetail.status, 200);
    assert.ok(pubDetail.json.author.id);
    assert.ok(pubDetail.json.author.name);
    assert.ok(pubDetail.json.category.name);
    assert.equal(pubDetail.json.searchText, undefined);

    // Draft detail: hidden (404) for guest and other student, visible (200) for author and admin
    assert.equal((await request(`/posts/${toStr(draft._id)}`)).status, 404);
    assert.equal((await request(`/posts/${toStr(draft._id)}`, { headers: { Authorization: `Bearer ${signToken(otherStudent)}` } })).status, 404);
    assert.equal((await request(`/posts/${toStr(draft._id)}`, { headers: { Authorization: `Bearer ${signToken(author)}` } })).status, 200);
    assert.equal((await request(`/posts/${toStr(draft._id)}`, { headers: { Authorization: `Bearer ${signToken(admin)}` } })).status, 200);
  });

  it('handles invalid IDs, missing posts, malformed queries, and DB errors consistently', async () => {
    const invalidId = await request('/posts/not-an-object-id');
    assert.equal(invalidId.status, 400);
    assert.equal(invalidId.json.error.code, 'VALIDATION_ERROR');

    const missingId = new mongoose.Types.ObjectId().toString();
    const notFound = await request(`/posts/${missingId}`);
    assert.equal(notFound.status, 404);
    assert.equal(notFound.json.error.code, 'RESOURCE_NOT_FOUND');

    for (const badQuery of [
      '/posts?category=bad-id',
      '/posts?authorId=bad-id',
      '/posts?sort=popular',
      '/posts?page=0',
      '/posts?page=abc',
      '/posts?limit=51',
      '/posts?mine=maybe',
    ]) {
      const res = await request(badQuery);
      assert.equal(res.status, 400, `Expected 400 for ${badQuery}`);
      assert.equal(res.json.error.code, 'VALIDATION_ERROR');
    }

    // Simulated database error must return sanitized 500 INTERNAL_ERROR
    Post.find = () => { throw new Error('Simulated Atlas socket timeout'); };
    const dbErr = await request('/posts');
    assert.equal(dbErr.status, 500);
    assert.deepEqual(dbErr.json, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
  });
});

