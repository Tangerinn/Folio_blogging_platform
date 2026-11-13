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
  if (filter._id && toStr(doc._id) !== toStr(filter._id)) return false;
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

function makePostDoc(stored) {
  const doc = new Post(stored);
  doc._id = stored._id;
  doc.createdAt = stored.createdAt;
  doc.updatedAt = stored.updatedAt;
  doc.isNew = false;
  doc.save = async () => {
    await doc.validate();
    const idx = postsStore.findIndex((p) => toStr(p._id) === toStr(doc._id));
    const updated = {
      _id: doc._id,
      title: doc.title,
      content: doc.content,
      searchText: doc.searchText,
      author: doc.author,
      category: doc.category || null,
      status: doc.status,
      publishedAt: doc.publishedAt || null,
      createdAt: doc.createdAt || new Date(),
      updatedAt: new Date(Date.now() + 10),
    };
    if (idx >= 0) postsStore[idx] = updated;
    return doc;
  };
  return doc;
}

User.findById = (id) => {
  const u = usersStore.find((x) => toStr(x._id) === toStr(id));
  if (!u) return Promise.resolve(null);
  const doc = new User(u);
  doc._id = u._id;
  return Promise.resolve(doc);
};

Category.findById = (id) => {
  const c = categoriesStore.find((x) => toStr(x._id) === toStr(id)) || null;
  return Promise.resolve(c);
};

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

Post.countDocuments = async (filter) => postsStore.filter((p) => matchesFilter(p, filter)).length;

Post.findById = (id) => {
  const populates = [];
  const resolveDoc = () => {
    const p = postsStore.find((x) => toStr(x._id) === toStr(id));
    return p ? makePostDoc(p) : null;
  };
  const resolveLean = () => {
    const p = postsStore.find((x) => toStr(x._id) === toStr(id));
    if (!p) return null;
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
  };

  return {
    populate(field) { populates.push(field); return this; },
    lean() { return Promise.resolve(resolveLean()); },
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveDoc()).then(onFulfilled, onRejected);
    },
  };
};

Post.create = async (data) => {
  const draftDoc = new Post(data);
  await draftDoc.validate();
  const now = new Date();
  const stored = {
    _id: draftDoc._id,
    title: draftDoc.title,
    content: draftDoc.content,
    searchText: draftDoc.searchText || extractText(draftDoc.content).replace(/\s+/g, ' ').trim(),
    author: draftDoc.author,
    category: draftDoc.category || null,
    status: draftDoc.status,
    publishedAt: draftDoc.publishedAt || null,
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

function request(path, { method = 'GET', body, headers = {} } = {}) {
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

function requestApp(method, path, opts = {}) {
  const cleanPath = path.startsWith('/api') ? path.slice(4) : path;
  return request(cleanPath, { method, ...opts });
}

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

const sampleDoc = (text = 'Structured paragraph body.', extraNodes = []) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }, ...extraNodes],
});

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

describe('Post Management & Authorization integration suite (Step 3)', () => {
  let author;
  let otherStudent;
  let admin;
  let suspendedUser;
  let categoryScience;
  let categoryDesign;
  let authorToken;
  let otherToken;
  let adminToken;
  let suspendedToken;

  beforeEach(() => {
    const now = new Date();
    author = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Tangerine',
      email: 'student@demo.com',
      passwordHash: 'hash',
      role: 'student',
      status: 'active',
      bio: 'CS sophomore.',
      createdAt: now,
    };
    otherStudent = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Daniel Okafor',
      email: 'daniel@demo.com',
      passwordHash: 'hash',
      role: 'student',
      status: 'active',
      bio: 'Physics major.',
      createdAt: now,
    };
    admin = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Folio Admin',
      email: 'admin@demo.com',
      passwordHash: 'hash',
      role: 'admin',
      status: 'active',
      bio: '',
      createdAt: now,
    };
    suspendedUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Leo Brandt',
      email: 'leo@demo.com',
      passwordHash: 'hash',
      role: 'student',
      status: 'suspended',
      bio: '',
      createdAt: now,
    };
    usersStore = [author, otherStudent, admin, suspendedUser];

    categoryScience = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Science',
      description: 'Natural science.',
      createdAt: now,
      updatedAt: now,
    };
    categoryDesign = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Design',
      description: 'Visual craft.',
      createdAt: now,
      updatedAt: now,
    };
    categoriesStore = [categoryScience, categoryDesign];
    postsStore = [];

    authorToken = signToken(author);
    otherToken = signToken(otherStudent);
    adminToken = signToken(admin);
    suspendedToken = signToken(suspendedUser);
  });

  it('requires active authentication for POST, PATCH, and DELETE /api/posts', async () => {
    const existingId = new mongoose.Types.ObjectId();
    postsStore.push({
      _id: existingId,
      title: 'Existing',
      content: sampleDoc(),
      searchText: 'Existing body',
      author: author._id,
      category: categoryScience._id,
      status: 'published',
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const unauthCreate = await requestApp('POST', '/api/posts', {
      body: { title: 'Unauth', content: sampleDoc() },
    });
    assert.equal(unauthCreate.status, 401);
    assert.equal(unauthCreate.body.error.code, 'UNAUTHENTICATED');

    const unauthUpdate = await requestApp('PATCH', `/api/posts/${existingId}`, {
      body: { title: 'Tamper' },
    });
    assert.equal(unauthUpdate.status, 401);

    const unauthDelete = await requestApp('DELETE', `/api/posts/${existingId}`);
    assert.equal(unauthDelete.status, 401);

    const suspendedCreate = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${suspendedToken}` },
      body: { title: 'Suspended', content: sampleDoc() },
    });
    assert.equal(suspendedCreate.status, 403);
    assert.equal(suspendedCreate.body.error.code, 'ACCOUNT_SUSPENDED');
  });

  it('creates drafts and published posts, enforces publication visibility, and ignores protected fields', async () => {
    const createDraftRes = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: {
        title: '  Working Draft  ',
        content: emptyDoc,
        categoryId: null,
        author: otherStudent._id.toString(),
        authorId: otherStudent._id.toString(),
        publishedAt: '2020-01-01T00:00:00.000Z',
        role: 'admin',
      },
    });
    assert.equal(createDraftRes.status, 201);
    assert.equal(createDraftRes.body.title, 'Working Draft');
    assert.equal(createDraftRes.body.status, 'draft');
    assert.equal(createDraftRes.body.publishedAt, null);
    assert.equal(createDraftRes.body.category, null);
    assert.equal(createDraftRes.body.categoryId, null);
    assert.equal(createDraftRes.body.author.id, author._id.toString());

    const draftId = createDraftRes.body.id;

    // Draft hidden from public feed and guests/other students, visible to owner and admin
    const publicFeed = await requestApp('GET', '/api/posts');
    assert.equal(publicFeed.body.length, 0);

    const guestDetail = await requestApp('GET', `/api/posts/${draftId}`);
    assert.equal(guestDetail.status, 404);

    const otherDetail = await requestApp('GET', `/api/posts/${draftId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(otherDetail.status, 404);

    const ownerDetail = await requestApp('GET', `/api/posts/${draftId}`, {
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert.equal(ownerDetail.status, 200);

    const adminDetail = await requestApp('GET', `/api/posts/${draftId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminDetail.status, 200);

    // Create published post with image + link
    const createPubRes = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: {
        title: 'Published Guide',
        categoryId: categoryScience._id.toString(),
        status: 'published',
        content: sampleDoc('Optics and prisms.', [
          {
            type: 'image',
            attrs: { src: 'https://res.cloudinary.com/demo/image/upload/prism.jpg', alt: 'Prism' },
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Reference',
                marks: [{ type: 'link', attrs: { href: 'https://example.com/prism', target: '_blank' } }],
              },
            ],
          },
        ]),
      },
    });
    assert.equal(createPubRes.status, 201);
    assert.equal(createPubRes.body.status, 'published');
    assert.ok(createPubRes.body.publishedAt);
    assert.equal(createPubRes.body.category.name, 'Science');

    const storedPub = postsStore.find((p) => toStr(p._id) === createPubRes.body.id);
    assert.match(storedPub.searchText, /Optics and prisms/);

    const feedAfterPub = await requestApp('GET', '/api/posts');
    assert.equal(feedAfterPub.body.length, 1);
    assert.equal(feedAfterPub.body[0].id, createPubRes.body.id);
  });

  it('validates titles, categories, empty publish bodies, and rejects unsafe TipTap nodes or URIs', async () => {
    const missingTitle = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { title: '   ', content: sampleDoc() },
    });
    assert.equal(missingTitle.status, 400);
    assert.equal(missingTitle.body.error.code, 'VALIDATION_ERROR');

    const longTitle = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { title: 'a'.repeat(151), content: sampleDoc() },
    });
    assert.equal(longTitle.status, 400);

    const missingCatOnPublish = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { title: 'Ready', status: 'published', content: sampleDoc() },
    });
    assert.equal(missingCatOnPublish.status, 400);

    const nonexistentCat = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: {
        title: 'Bad category',
        categoryId: new mongoose.Types.ObjectId().toString(),
        status: 'draft',
        content: sampleDoc(),
      },
    });
    assert.equal(nonexistentCat.status, 400);

    const emptyPublish = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: {
        title: 'Blank publish',
        categoryId: categoryScience._id.toString(),
        status: 'published',
        content: emptyDoc,
      },
    });
    assert.equal(emptyPublish.status, 400);

    const base64Image = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: {
        title: 'Base64 rejected',
        content: sampleDoc('Hello', [
          { type: 'image', attrs: { src: 'data:image/png;base64,iVBORw0KGgo=' } },
        ]),
      },
    });
    assert.equal(base64Image.status, 400);

    const jsLink = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: {
        title: 'XSS link rejected',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }],
            },
          ],
        },
      },
    });
    assert.equal(jsLink.status, 400);

    const unsafeNode = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: {
        title: 'Script node rejected',
        content: { type: 'doc', content: [{ type: 'script', content: [] }] },
      },
    });
    assert.equal(unsafeNode.status, 400);
  });

  it('updates posts with author-only ownership, handles publish/revert transitions, and blocks admins/other users', async () => {
    const createRes = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { title: 'Draft One', content: emptyDoc, status: 'draft' },
    });
    const postId = createRes.body.id;

    // Empty/uncategorized draft cannot transition directly to published
    const invalidPublish = await requestApp('PATCH', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { status: 'published' },
    });
    assert.equal(invalidPublish.status, 400);

    // Cross-user and admin edit attempts return 403 FORBIDDEN (author-only policy)
    const otherEdit = await requestApp('PATCH', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { title: 'Stolen' },
    });
    assert.equal(otherEdit.status, 403);
    assert.equal(otherEdit.body.error.code, 'FORBIDDEN');

    const adminEdit = await requestApp('PATCH', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { title: 'Admin Edit' },
    });
    assert.equal(adminEdit.status, 403);
    assert.equal(adminEdit.body.error.code, 'FORBIDDEN');

    // Author populates content/category and publishes
    const publishRes = await requestApp('PATCH', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: {
        title: 'Published One',
        content: sampleDoc('Updated scientific notes.'),
        categoryId: categoryDesign._id.toString(),
        status: 'published',
        author: otherStudent._id.toString(),
      },
    });
    assert.equal(publishRes.status, 200);
    assert.equal(publishRes.body.status, 'published');
    assert.equal(publishRes.body.author.id, author._id.toString());
    assert.equal(publishRes.body.category.name, 'Design');
    const firstPublishedAt = publishRes.body.publishedAt;
    assert.ok(firstPublishedAt);

    // Subsequent edit preserves original publishedAt
    const editAgain = await requestApp('PATCH', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { title: 'Published Two', publishedAt: '1999-01-01T00:00:00.000Z' },
    });
    assert.equal(editAgain.status, 200);
    assert.equal(editAgain.body.title, 'Published Two');
    assert.equal(editAgain.body.publishedAt, firstPublishedAt);

    // Revert to draft hides post from public feed again
    const revertRes = await requestApp('PATCH', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { status: 'draft' },
    });
    assert.equal(revertRes.status, 200);
    assert.equal(revertRes.body.status, 'draft');

    const feed = await requestApp('GET', '/api/posts');
    assert.equal(feed.body.length, 0);

    // Invalid ID, missing post, empty update payload
    const badId = await requestApp('PATCH', '/api/posts/not-valid', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { title: 'X' },
    });
    assert.equal(badId.status, 400);

    const missingPost = await requestApp('PATCH', `/api/posts/${new mongoose.Types.ObjectId()}`, {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { title: 'X' },
    });
    assert.equal(missingPost.status, 404);

    const emptyPatch = await requestApp('PATCH', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { author: otherStudent._id.toString() },
    });
    assert.equal(emptyPatch.status, 400);
  });

  it('deletes own posts and enforces author-only ownership on DELETE /api/posts/:id', async () => {
    const createRes = await requestApp('POST', '/api/posts', {
      headers: { Authorization: `Bearer ${authorToken}` },
      body: {
        title: 'To Delete',
        categoryId: categoryScience._id.toString(),
        status: 'published',
        content: sampleDoc('Temporary article.'),
      },
    });
    const postId = createRes.body.id;

    const otherDel = await requestApp('DELETE', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(otherDel.status, 403);
    assert.equal(otherDel.body.error.code, 'FORBIDDEN');

    const adminDel = await requestApp('DELETE', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminDel.status, 403);
    assert.equal(adminDel.body.error.code, 'FORBIDDEN');

    const badIdDel = await requestApp('DELETE', '/api/posts/bad-id', {
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert.equal(badIdDel.status, 400);

    const ownDel = await requestApp('DELETE', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert.equal(ownDel.status, 200);
    assert.deepEqual(ownDel.body, { ok: true });

    const missingAfterDel = await requestApp('GET', `/api/posts/${postId}`);
    assert.equal(missingAfterDel.status, 404);

    const delAgain = await requestApp('DELETE', `/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert.equal(delAgain.status, 404);
  });
});

