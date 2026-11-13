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
const { seedDatabase } = require('../src/scripts/seed');
const app = require('../src/app');

let usersStore = [];
let categoriesStore = [];
let postsStore = [];
let commentsStore = [];

function toStr(id) {
  return id ? id.toString() : '';
}

function matchesFilter(doc, filter = {}) {
  if (filter.status && doc.status !== filter.status) return false;
  if (filter.category && toStr(doc.category) !== toStr(filter.category)) return false;
  if (filter.author && toStr(doc.author) !== toStr(filter.author)) return false;
  if (filter.post && toStr(doc.post) !== toStr(filter.post)) return false;
  if (filter.parentId !== undefined && toStr(doc.parentId) !== toStr(filter.parentId)) return false;
  if (filter._id && toStr(doc._id) !== toStr(filter._id)) return false;
  if (filter.$or) {
    const ok = filter.$or.some((clause) => {
      if (clause._id && toStr(doc._id) === toStr(clause._id)) return true;
      if (clause.parentId && toStr(doc.parentId) === toStr(clause.parentId)) return true;
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
  return doc;
}

function makeCommentDoc(stored) {
  const doc = new Comment(stored);
  doc._id = stored._id;
  doc.isNew = false;
  doc.save = async () => {
    const idx = commentsStore.findIndex((c) => toStr(c._id) === toStr(doc._id));
    const updated = {
      _id: doc._id,
      post: doc.post,
      author: doc.author,
      parentId: doc.parentId || null,
      content: doc.content,
      createdAt: stored.createdAt || new Date(),
      updatedAt: new Date(),
    };
    if (idx >= 0) commentsStore[idx] = updated;
    return doc;
  };
  return doc;
}

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

Post.findOne = async (filter) => postsStore.find((p) => matchesFilter(p, filter)) || null;

Post.findById = (id) => {
  const populates = [];
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
  const resolveDoc = () => {
    const p = postsStore.find((x) => toStr(x._id) === toStr(id));
    if (!p) return null;
    const doc = new Post(p);
    doc._id = p._id;
    return doc;
  };

  return {
    populate(field) { populates.push(field); return this; },
    lean() { return Promise.resolve(resolveLean()); },
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveDoc()).then(onFulfilled, onRejected);
    },
  };
};

Post.countDocuments = async (filter) => postsStore.filter((p) => matchesFilter(p, filter)).length;

Post.create = async (data) => {
  const now = new Date();
  const stored = {
    _id: new mongoose.Types.ObjectId(),
    title: data.title,
    content: data.content,
    searchText: 'test search text',
    author: data.author,
    category: data.category || null,
    status: data.status || 'draft',
    publishedAt: data.publishedAt || null,
    createdAt: now,
    updatedAt: now,
  };
  postsStore.push(stored);
  const doc = new Post(stored);
  doc._id = stored._id;
  return doc;
};

Post.deleteOne = async (filter = {}) => {
  const before = postsStore.length;
  postsStore = postsStore.filter((p) => !matchesFilter(p, filter));
  return { deletedCount: before - postsStore.length };
};

// Comment stubs
Comment.find = (filter = {}) => {
  let sortSpec = {};
  const populates = [];
  const chain = {
    sort(s) { sortSpec = s; return chain; },
    populate(field) { populates.push(field); return chain; },
    lean() {
      const matched = sortDocs(commentsStore.filter((c) => matchesFilter(c, filter)), sortSpec);
      const out = matched.map((c) => {
        const item = { ...c };
        if (populates.includes('author')) {
          const u = usersStore.find((x) => toStr(x._id) === toStr(c.author));
          item.author = u ? { _id: u._id, name: u.name, bio: u.bio } : null;
        }
        return item;
      });
      return Promise.resolve(out);
    },
  };
  return chain;
};

Comment.findOne = async (filter) => commentsStore.find((c) => matchesFilter(c, filter)) || null;

Comment.findById = (id) => {
  const populates = [];
  const resolveDoc = () => {
    const c = commentsStore.find((x) => toStr(x._id) === toStr(id));
    return c ? makeCommentDoc(c) : null;
  };
  const resolveLean = () => {
    const c = commentsStore.find((x) => toStr(x._id) === toStr(id));
    if (!c) return null;
    const item = { ...c };
    if (populates.includes('author')) {
      const u = usersStore.find((x) => toStr(x._id) === toStr(c.author));
      item.author = u ? { _id: u._id, name: u.name, bio: u.bio } : null;
    }
    return item;
  };

  return {
    populate(field) { populates.push(field); return this; },
    lean() { return Promise.resolve(resolveLean()); },
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveDoc()).then(onFulfilled, onRejected);
    },
  };
};

Comment.create = async (data) => {
  const now = new Date();
  const stored = {
    _id: new mongoose.Types.ObjectId(),
    post: data.post,
    author: data.author,
    parentId: data.parentId || null,
    content: data.content,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
  commentsStore.push(stored);
  return makeCommentDoc(stored);
};

Comment.countDocuments = async (filter) => commentsStore.filter((c) => matchesFilter(c, filter)).length;

Comment.deleteMany = async (filter = {}) => {
  const before = commentsStore.length;
  commentsStore = commentsStore.filter((c) => !matchesFilter(c, filter));
  return { deletedCount: before - commentsStore.length };
};

Comment.aggregate = async (pipeline = []) => {
  // Supports { $group: { _id: '$post', count: { $sum: 1 } } } and match
  let list = [...commentsStore];
  const matchStage = pipeline.find((p) => p.$match);
  if (matchStage) {
    list = list.filter((c) => {
      if (matchStage.$match.post && matchStage.$match.post.$in) {
        const allowed = matchStage.$match.post.$in.map(toStr);
        return allowed.includes(toStr(c.post));
      }
      return true;
    });
  }
  const groupStage = pipeline.find((p) => p.$group);
  if (groupStage) {
    const counts = new Map();
    for (const c of list) {
      const key = toStr(c.post);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([k, count]) => ({ _id: k, count }));
  }
  return [];
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

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

describe('Comments & Replies integration suite (Step 4)', () => {
  let author;
  let commenter;
  let otherStudent;
  let admin;
  let suspendedUser;
  let publishedPost;
  let draftPost;
  let authorToken;
  let commenterToken;
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
    commenter = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Daniel Okafor',
      email: 'daniel@demo.com',
      passwordHash: 'hash',
      role: 'student',
      status: 'active',
      bio: 'Physics major.',
      createdAt: now,
    };
    otherStudent = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Priya Nair',
      email: 'priya@demo.com',
      passwordHash: 'hash',
      role: 'student',
      status: 'active',
      bio: 'Design student.',
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
    usersStore = [author, commenter, otherStudent, admin, suspendedUser];

    publishedPost = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Published Article',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }] },
      searchText: 'Body',
      author: author._id,
      category: null,
      status: 'published',
      publishedAt: new Date(Date.now() - 3600000),
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3600000),
    };
    draftPost = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Secret Draft',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft body' }] }] },
      searchText: 'Draft body',
      author: author._id,
      category: null,
      status: 'draft',
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    postsStore = [publishedPost, draftPost];
    categoriesStore = [];
    commentsStore = [];

    authorToken = signToken(author);
    commenterToken = signToken(commenter);
    otherToken = signToken(otherStudent);
    adminToken = signToken(admin);
    suspendedToken = signToken(suspendedUser);
  });

  it('requires authentication for writing comments and replies, and blocks suspended users', async () => {
    const unauthComment = await request(`/posts/${publishedPost._id}/comments`, {
      method: 'POST',
      body: { content: 'Unauth comment' },
    });
    assert.equal(unauthComment.status, 401);
    assert.equal(unauthComment.body.error.code, 'UNAUTHENTICATED');

    const suspendedComment = await request(`/posts/${publishedPost._id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${suspendedToken}` },
      body: { content: 'Suspended comment' },
    });
    assert.equal(suspendedComment.status, 403);
    assert.equal(suspendedComment.body.error.code, 'ACCOUNT_SUSPENDED');
  });

  it('supports creating comments and 1-level replies, and lists them as a structured tree', async () => {
    // Top-level comment by Daniel
    const createCommentRes = await request(`/posts/${publishedPost._id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${commenterToken}` },
      body: { content: 'What about edge cases?' },
    });
    assert.equal(createCommentRes.status, 201);
    assert.equal(createCommentRes.body.postId, publishedPost._id.toString());
    assert.equal(createCommentRes.body.parentId, null);
    assert.equal(createCommentRes.body.content, 'What about edge cases?');
    assert.equal(createCommentRes.body.author.name, 'Daniel Okafor');
    assert.deepEqual(createCommentRes.body.replies, []);

    const parentId = createCommentRes.body.id;

    // Reply by post author Tangerine
    const replyRes = await request(`/comments/${parentId}/replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { content: 'Good point, we handle them carefully.' },
    });
    assert.equal(replyRes.status, 201);
    assert.equal(replyRes.body.postId, publishedPost._id.toString());
    assert.equal(replyRes.body.parentId, parentId);
    assert.equal(replyRes.body.content, 'Good point, we handle them carefully.');
    assert.equal(replyRes.body.author.name, 'Tangerine');

    const replyId = replyRes.body.id;

    // Second top-level comment by Priya
    const comment2Res = await request(`/posts/${publishedPost._id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { content: 'Loved reading this!' },
    });
    assert.equal(comment2Res.status, 201);

    // Public list of comments for published post
    const listRes = await request(`/posts/${publishedPost._id}/comments`);
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.length, 2);
    assert.equal(listRes.body[0].id, parentId);
    assert.equal(listRes.body[0].replies.length, 1);
    assert.equal(listRes.body[0].replies[0].id, replyId);
    assert.equal(listRes.body[1].id, comment2Res.body.id);
    assert.equal(listRes.body[1].replies.length, 0);

    // Dynamic commentCount on GET /api/posts and GET /api/posts/:id
    const postDetail = await request(`/posts/${publishedPost._id}`);
    assert.equal(postDetail.status, 200);
    assert.equal(postDetail.body.commentCount, 3); // 2 top-level + 1 reply

    const postList = await request('/posts');
    assert.equal(postList.status, 200);
    const found = postList.body.find((p) => p.id === publishedPost._id.toString());
    assert.equal(found.commentCount, 3);
  });

  it('rejects nested replies to replies with 400 REPLY_TO_REPLY', async () => {
    const commentRes = await request(`/posts/${publishedPost._id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${commenterToken}` },
      body: { content: 'Top-level' },
    });
    const parentId = commentRes.body.id;

    const replyRes = await request(`/comments/${parentId}/replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { content: 'First-level reply' },
    });
    const replyId = replyRes.body.id;

    // Attempt to reply to a reply (second-level nesting)
    const deepReplyRes = await request(`/comments/${replyId}/replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { content: 'Second-level reply attempt' },
    });
    assert.equal(deepReplyRes.status, 400);
    assert.equal(deepReplyRes.body.error.code, 'REPLY_TO_REPLY');
    assert.equal(deepReplyRes.body.error.message, 'Replies can only be one level deep.');
  });

  it('enforces author-only comment edits and deletions, and cascades deletion to child replies', async () => {
    const commentRes = await request(`/posts/${publishedPost._id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${commenterToken}` },
      body: { content: 'Original text' },
    });
    const parentId = commentRes.body.id;

    const replyRes = await request(`/comments/${parentId}/replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { content: 'Reply to original' },
    });
    const replyId = replyRes.body.id;

    // Other user and admin cannot edit
    const otherEdit = await request(`/comments/${parentId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { content: 'Hacked edit' },
    });
    assert.equal(otherEdit.status, 403);
    assert.equal(otherEdit.body.error.code, 'FORBIDDEN');

    const adminEdit = await request(`/comments/${parentId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { content: 'Admin edit attempt' },
    });
    assert.equal(adminEdit.status, 403);

    // Empty edit rejected
    const emptyEdit = await request(`/comments/${parentId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${commenterToken}` },
      body: { content: '   ' },
    });
    assert.equal(emptyEdit.status, 400);
    assert.equal(emptyEdit.body.error.code, 'VALIDATION_ERROR');

    // Author successfully edits
    const validEdit = await request(`/comments/${parentId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${commenterToken}` },
      body: { content: 'Corrected text' },
    });
    assert.equal(validEdit.status, 200);
    assert.deepEqual(validEdit.body, { ok: true });

    // Non-author and admin cannot delete
    const otherDelete = await request(`/comments/${parentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(otherDelete.status, 403);
    assert.equal(otherDelete.body.error.code, 'FORBIDDEN');

    const adminDelete = await request(`/comments/${parentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminDelete.status, 403);

    // Author deletes parent comment -> cascades and removes both parent and reply
    const validDelete = await request(`/comments/${parentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${commenterToken}` },
    });
    assert.equal(validDelete.status, 200);
    assert.deepEqual(validDelete.body, { ok: true });

    // Both parent and child reply are gone
    const listAfter = await request(`/posts/${publishedPost._id}/comments`);
    assert.equal(listAfter.body.length, 0);

    const postAfterDel = await request(`/posts/${publishedPost._id}`);
    assert.equal(postAfterDel.body.commentCount, 0);
  });

  it('enforces draft visibility on comments and replies', async () => {
    // Guest or other student cannot view or add comments on drafts
    const guestList = await request(`/posts/${draftPost._id}/comments`);
    assert.equal(guestList.status, 404);

    const otherList = await request(`/posts/${draftPost._id}/comments`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(otherList.status, 404);

    const otherPostComment = await request(`/posts/${draftPost._id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { content: 'Sneak into draft' },
    });
    assert.equal(otherPostComment.status, 404);

    // Draft author can view and comment on their draft
    const authorPostComment = await request(`/posts/${draftPost._id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { content: 'Author notes on draft' },
    });
    assert.equal(authorPostComment.status, 201);
    const draftCommentId = authorPostComment.body.id;

    const authorList = await request(`/posts/${draftPost._id}/comments`, {
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert.equal(authorList.status, 200);
    assert.equal(authorList.body.length, 1);

    // Admin can also view draft comments
    const adminList = await request(`/posts/${draftPost._id}/comments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body.length, 1);

    // Replying on a draft comment fails for other users
    const otherReplyOnDraft = await request(`/comments/${draftCommentId}/replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { content: 'Sneak reply' },
    });
    assert.equal(otherReplyOnDraft.status, 404);
  });

  it('handles invalid IDs, missing resources, and validates input formatting', async () => {
    const badPostId = await request('/posts/invalid-id/comments');
    assert.equal(badPostId.status, 400);

    const badCommentId = await request('/comments/invalid-id', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${commenterToken}` },
      body: { content: 'Valid' },
    });
    assert.equal(badCommentId.status, 400);

    const missingPost = await request(`/posts/${new mongoose.Types.ObjectId()}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${commenterToken}` },
      body: { content: 'Valid content' },
    });
    assert.equal(missingPost.status, 404);

    const missingComment = await request(`/comments/${new mongoose.Types.ObjectId()}/replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${commenterToken}` },
      body: { content: 'Valid content' },
    });
    assert.equal(missingComment.status, 404);

    const emptyContent = await request(`/posts/${publishedPost._id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${commenterToken}` },
      body: { content: '   ' },
    });
    assert.equal(emptyContent.status, 400);
    assert.equal(emptyContent.body.error.code, 'VALIDATION_ERROR');
  });

  it('cascades comments when a post is deleted', async () => {
    const commentRes = await request(`/posts/${publishedPost._id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${commenterToken}` },
      body: { content: 'Will be deleted with post' },
    });
    const commentId = commentRes.body.id;

    await request(`/comments/${commentId}/replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authorToken}` },
      body: { content: 'Child will also be deleted' },
    });

    assert.equal(commentsStore.length, 2);

    // Delete post
    const delPostRes = await request(`/posts/${publishedPost._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert.equal(delPostRes.status, 200);

    // All comments associated with that post should be deleted
    assert.equal(commentsStore.length, 0);
  });

  it('seeds sample comments idempotently', async () => {
    const summary1 = await seedDatabase({
      UserModel: User,
      CategoryModel: Category,
      PostModel: Post,
      CommentModel: Comment,
    });
    assert.ok(summary1.commentsCreated > 0);

    const summary2 = await seedDatabase({
      UserModel: User,
      CategoryModel: Category,
      PostModel: Post,
      CommentModel: Comment,
    });
    assert.equal(summary2.commentsCreated, 0);
  });
});

