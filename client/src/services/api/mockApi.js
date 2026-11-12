// In-browser mock backend. Same method names and rules as the real API (see api.md,
// database.md). Data persists in localStorage so you can click around freely.
// Reset it any time with:  localStorage.clear()  in the browser console.
import { seed } from './mockSeed.js';
import { isEmptyDoc, isSafeUrl } from '../../utils/content.js';

const DB_KEY = 'folio_mock_db_v1';
const SESSION_KEY = 'folio_mock_session';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const remove = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

let db;
try { const raw = read(DB_KEY); db = raw ? JSON.parse(raw) : seed(); } catch { db = seed(); }
const save = () => write(DB_KEY, JSON.stringify(db));
save();

let nextId = Date.now();
const newId = (prefix) => `${prefix}${(nextId++).toString(36)}`;
const now = () => new Date().toISOString();
const reply = (value) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), 120));

// ---------- helpers ----------
const publicUser = (u) => u && ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, bio: u.bio, createdAt: u.createdAt });
const authorOf = (id) => { const u = db.users.find((x) => x.id === id); return u ? { id: u.id, name: u.name, bio: u.bio } : { id, name: 'Deleted user', bio: '' }; };
const categoryOf = (id) => db.categories.find((c) => c.id === id) || null;
const commentCount = (postId) => db.comments.filter((c) => c.postId === postId).length;

const currentUser = () => {
  const id = read(SESSION_KEY);
  return id ? db.users.find((u) => u.id === id && u.status === 'active') || null : null;
};
const requireUser = () => {
  const u = currentUser();
  if (!u) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  return u;
};
const requireAdmin = () => {
  const u = requireUser();
  if (u.role !== 'admin') throw new ApiError(403, 'FORBIDDEN', 'Admin access required.');
  return u;
};

const shapePost = (p, me) => ({
  id: p.id, title: p.title, content: p.content, status: p.status,
  createdAt: p.createdAt, publishedAt: p.publishedAt, updatedAt: p.updatedAt,
  author: authorOf(p.authorId), category: categoryOf(p.categoryId), categoryId: p.categoryId,
  commentCount: commentCount(p.id),
  bookmarked: me ? db.bookmarks.some((b) => b.userId === me.id && b.postId === p.id) : false,
});

function removeComments(ids) {
  const set = new Set(ids);
  db.comments = db.comments.filter((c) => !set.has(c.id));
  db.reports = db.reports.filter((r) => !(r.targetType === 'comment' && set.has(r.targetId)));
}
function removeCommentCascade(commentId) {
  const replies = db.comments.filter((c) => c.parentId === commentId).map((c) => c.id);
  removeComments([commentId, ...replies]);
}
function removePostCascade(postId) {
  removeComments(db.comments.filter((c) => c.postId === postId).map((c) => c.id));
  db.bookmarks = db.bookmarks.filter((b) => b.postId !== postId);
  db.reports = db.reports.filter((r) => !(r.targetType === 'post' && r.targetId === postId));
  db.notifications = db.notifications.filter((n) => n.postId !== postId);
  db.posts = db.posts.filter((p) => p.id !== postId);
}

const validatePostInput = ({ title, content, categoryId }, publishing) => {
  if (!title || !title.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'A title is required.');
  if (title.length > 150) throw new ApiError(400, 'VALIDATION_ERROR', 'Title must be 150 characters or fewer.');
  if (publishing) {
    if (!categoryId || !categoryOf(categoryId)) throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a category before publishing.');
    if (isEmptyDoc(content)) throw new ApiError(400, 'VALIDATION_ERROR', 'Write something before publishing.');
  }
  // Mirrors the server rule: image nodes must be http(s) URLs (security.md §10)
  const walk = (n) => {
    if (!n) return;
    if (n.type === 'image' && !isSafeUrl(n.attrs?.src)) throw new ApiError(400, 'VALIDATION_ERROR', 'Images must use an http(s) URL.');
    (n.content || []).forEach(walk);
  };
  walk(content);
};

const matches = (text, q) => text.toLowerCase().includes(q.toLowerCase());
const postText = (p) => `${p.title} ${JSON.stringify(p.content).replace(/"[a-zA-Z]+":/g, ' ')}`;

// ---------- API ----------
export const mockApi = {
  // auth
  async me() {
    return reply(publicUser(currentUser()));
  },
  async register({ name, email, password }) {
    const cleanName = name?.trim();
    const cleanEmail = email?.trim();
    if (!cleanName || !cleanEmail || !password) throw new ApiError(400, 'VALIDATION_ERROR', 'Name, email, and password are required.');
    if (password.length < 8) throw new ApiError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters.');
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail.toLowerCase())) throw new ApiError(409, 'EMAIL_TAKEN', 'An account with that email already exists.');
    const user = { id: newId('u'), name: cleanName, email: cleanEmail, password, role: 'student', status: 'active', bio: '', createdAt: now() };
    db.users.push(user); save();
    return reply(publicUser(user));
  },
  async login({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const u = db.users.find((x) => x.email.toLowerCase() === cleanEmail);
    if (!u || u.password !== password) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
    if (u.status === 'suspended') throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
    write(SESSION_KEY, u.id);
    return reply(publicUser(u));
  },
  async logout() {
    remove(SESSION_KEY);
    return reply({ ok: true });
  },

  // categories (public read)
  async listCategories() {
    return reply(db.categories.map((c) => ({ ...c, postCount: db.posts.filter((p) => p.categoryId === c.id && p.status === 'published').length })));
  },

  // posts
  async listPosts({ q = '', category = '', sort = 'newest', authorId = '', limit } = {}) {
    let list = db.posts.filter((p) => p.status === 'published');
    if (category) list = list.filter((p) => p.categoryId === category);
    if (authorId) list = list.filter((p) => p.authorId === authorId);
    if (q.trim()) list = list.filter((p) => matches(postText(p), q.trim()));
    const me = currentUser();
    let shaped = list.map((p) => shapePost(p, me));
    if (sort === 'oldest') shaped.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
    else if (sort === 'discussed') shaped.sort((a, b) => b.commentCount - a.commentCount);
    else shaped.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    if (limit) shaped = shaped.slice(0, limit);
    return reply(shaped);
  },
  async myPosts() {
    const me = requireUser();
    const list = db.posts.filter((p) => p.authorId === me.id).map((p) => shapePost(p, me));
    list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return reply(list);
  },
  async getPost(id) {
    const me = currentUser();
    const p = db.posts.find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
    if (p.status === 'draft' && !(me && (me.id === p.authorId || me.role === 'admin'))) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
    return reply(shapePost(p, me));
  },
  async createPost({ title, content, categoryId, status }) {
    const me = requireUser();
    const publishing = status === 'published';
    validatePostInput({ title, content, categoryId }, publishing);
    const t = now();
    const post = { id: newId('p'), authorId: me.id, categoryId: categoryId || null, title: title.trim(), content, status: publishing ? 'published' : 'draft', createdAt: t, publishedAt: publishing ? t : null, updatedAt: t };
    db.posts.push(post); save();
    return reply(shapePost(post, me));
  },
  async updatePost(id, { title, content, categoryId, status }) {
    const me = requireUser();
    const p = db.posts.find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
    if (p.authorId !== me.id) throw new ApiError(403, 'FORBIDDEN', 'You can only edit your own posts.');
    const publishing = (status || p.status) === 'published';
    validatePostInput({ title, content, categoryId }, publishing);
    p.title = title.trim(); p.content = content; p.categoryId = categoryId || null;
    if (publishing && !p.publishedAt) p.publishedAt = now();
    p.status = publishing ? 'published' : 'draft';
    p.updatedAt = now(); save();
    return reply(shapePost(p, me));
  },
  async deletePost(id) {
    const me = requireUser();
    const p = db.posts.find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
    if (p.authorId !== me.id) throw new ApiError(403, 'FORBIDDEN', 'You can only delete your own posts.');
    removePostCascade(id); save();
    return reply({ ok: true });
  },

  // comments
  async listComments(postId) {
    const all = db.comments.filter((c) => c.postId === postId);
    const shape = (c) => ({ id: c.id, postId: c.postId, parentId: c.parentId, content: c.content, createdAt: c.createdAt, author: authorOf(c.authorId) });
    const top = all.filter((c) => !c.parentId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return reply(top.map((c) => ({ ...shape(c), replies: all.filter((r) => r.parentId === c.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(shape) })));
  },
  async addComment(postId, { content }) {
    const me = requireUser();
    const post = db.posts.find((p) => p.id === postId && p.status === 'published');
    if (!post) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
    if (!content?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Comment cannot be empty.');
    const c = { id: newId('m'), postId, authorId: me.id, parentId: null, content: content.trim(), createdAt: now() };
    db.comments.push(c);
    if (post.authorId !== me.id) db.notifications.push({ id: newId('n'), recipientId: post.authorId, type: 'comment', message: `${me.name} commented on “${post.title}”`, postId, read: false, createdAt: now() });
    save();
    return reply({ ...c, author: authorOf(me.id), replies: [] });
  },
  async addReply(commentId, { content }) {
    const me = requireUser();
    const parent = db.comments.find((c) => c.id === commentId);
    if (!parent) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Comment not found.');
    if (parent.parentId) throw new ApiError(400, 'REPLY_TO_REPLY', 'Replies can only be one level deep.');
    if (!content?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Reply cannot be empty.');
    const post = db.posts.find((p) => p.id === parent.postId);
    // `post` is derived from the parent comment, never from the client (api.md §4)
    const c = { id: newId('m'), postId: parent.postId, authorId: me.id, parentId: parent.id, content: content.trim(), createdAt: now() };
    db.comments.push(c);
    if (parent.authorId !== me.id) db.notifications.push({ id: newId('n'), recipientId: parent.authorId, type: 'reply', message: `${me.name} replied to your comment on “${post?.title}”`, postId: parent.postId, read: false, createdAt: now() });
    save();
    return reply({ ...c, author: authorOf(me.id) });
  },
  async editComment(id, { content }) {
    const me = requireUser();
    const c = db.comments.find((x) => x.id === id);
    if (!c) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Comment not found.');
    if (c.authorId !== me.id) throw new ApiError(403, 'FORBIDDEN', 'You can only edit your own comments.');
    if (!content?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Comment cannot be empty.');
    c.content = content.trim(); save();
    return reply({ ok: true });
  },
  async deleteComment(id) {
    const me = requireUser();
    const c = db.comments.find((x) => x.id === id);
    if (!c) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Comment not found.');
    if (c.authorId !== me.id) throw new ApiError(403, 'FORBIDDEN', 'You can only delete your own comments.');
    removeCommentCascade(id); save();
    return reply({ ok: true });
  },

  // bookmarks
  async addBookmark(postId) {
    const me = requireUser();
    if (!db.posts.some((p) => p.id === postId && p.status === 'published')) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Post not found.');
    if (!db.bookmarks.some((b) => b.userId === me.id && b.postId === postId)) { db.bookmarks.push({ id: newId('b'), userId: me.id, postId, createdAt: now() }); save(); }
    return reply({ ok: true });
  },
  async removeBookmark(postId) {
    const me = requireUser();
    db.bookmarks = db.bookmarks.filter((b) => !(b.userId === me.id && b.postId === postId)); save();
    return reply({ ok: true });
  },
  async listBookmarks({ q = '', category = '' } = {}) {
    const me = requireUser();
    const posts = db.bookmarks.filter((b) => b.userId === me.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((b) => db.posts.find((p) => p.id === b.postId))
      .filter((p) => p && p.status === 'published')
      .filter((p) => !category || p.categoryId === category)
      .filter((p) => !q.trim() || matches(postText(p), q.trim()));
    return reply(posts.map((p) => shapePost(p, me)));
  },

  // notifications
  async listNotifications() {
    const me = requireUser();
    return reply(db.notifications.filter((n) => n.recipientId === me.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  },
  async markNotificationRead(id) {
    const me = requireUser();
    const n = db.notifications.find((x) => x.id === id && x.recipientId === me.id);
    if (n) { n.read = true; save(); }
    return reply({ ok: true });
  },

  // reports
  async createReport({ targetType, targetId, reason }) {
    const me = requireUser();
    if (!['post', 'comment'].includes(targetType)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid report target.');
    if (!reason?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Please give a reason.');
    const exists = targetType === 'post' ? db.posts.some((p) => p.id === targetId) : db.comments.some((c) => c.id === targetId);
    if (!exists) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'That content no longer exists.');
    db.reports.push({ id: newId('r'), reporterId: me.id, targetType, targetId, reason: reason.trim(), status: 'pending', createdAt: now() });
    save();
    return reply({ ok: true });
  },

  // profiles (assumed endpoints — see README "gaps in api.md")
  async getProfile(userId) {
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'User not found.');
    const me = currentUser();
    const posts = db.posts.filter((p) => p.authorId === userId && p.status === 'published').map((p) => shapePost(p, me));
    posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return reply({ user: { id: u.id, name: u.name, bio: u.bio, createdAt: u.createdAt }, posts });
  },
  async updateProfile({ name, bio }) {
    const me = requireUser();
    if (!name?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Name is required.');
    const cleanBio = (bio || '').trim();
    if (cleanBio.length > 300) throw new ApiError(400, 'VALIDATION_ERROR', 'Bio must be 300 characters or fewer.');
    me.name = name.trim(); me.bio = cleanBio; save();
    return reply(publicUser(me));
  },

  // admin
  async adminStats() {
    requireAdmin();
    const pending = db.reports.filter((r) => r.status === 'pending').length;
    const recent = [
      ...db.posts.filter((p) => p.status === 'published').map((p) => ({ id: p.id, text: `${authorOf(p.authorId).name} published “${p.title}”`, at: p.publishedAt })),
      ...db.comments.map((c) => ({ id: c.id, text: `${authorOf(c.authorId).name} commented`, at: c.createdAt })),
      ...db.users.map((u) => ({ id: u.id, text: `${u.name} joined`, at: u.createdAt })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);
    return reply({
      users: db.users.length,
      publishedPosts: db.posts.filter((p) => p.status === 'published').length,
      comments: db.comments.length,
      pendingReports: pending,
      recent,
    });
  },
  async adminListUsers({ q = '' } = {}) {
    requireAdmin();
    return reply(db.users.filter((u) => !q.trim() || matches(`${u.name} ${u.email}`, q.trim())).map(publicUser));
  },
  async adminUpdateUser(id, { role, status }) {
    const me = requireAdmin();
    const u = db.users.find((x) => x.id === id);
    if (!u) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'User not found.');
    if (u.id === me.id) throw new ApiError(400, 'VALIDATION_ERROR', 'You cannot change your own role or status.');
    if (role) { if (!['student', 'admin'].includes(role)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid role.'); u.role = role; }
    if (status) { if (!['active', 'suspended'].includes(status)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid status.'); u.status = status; }
    save();
    return reply(publicUser(u));
  },
  async adminListReports({ status = '' } = {}) {
    requireAdmin();
    const shape = (r) => {
      let target = null;
      if (r.targetType === 'post') { const p = db.posts.find((x) => x.id === r.targetId); target = p && { id: p.id, title: p.title, author: authorOf(p.authorId).name, postId: p.id }; }
      else { const c = db.comments.find((x) => x.id === r.targetId); target = c && { id: c.id, excerpt: c.content, author: authorOf(c.authorId).name, postId: c.postId }; }
      return { ...r, reporter: authorOf(r.reporterId).name, target };
    };
    return reply(db.reports.filter((r) => !status || r.status === status).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(shape));
  },
  async adminUpdateReport(id, { action }) {
    requireAdmin();
    const r = db.reports.find((x) => x.id === id);
    if (!r) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Report not found.');
    if (action === 'dismiss') { r.status = 'dismissed'; }
    else if (action === 'resolve') {
      // resolve = remove the content, then mark resolved
      const { targetType, targetId } = r;
      if (targetType === 'post') removePostCascade(targetId); else removeCommentCascade(targetId);
      const again = db.reports.find((x) => x.id === id);
      if (again) again.status = 'resolved';
      else db.reports.push({ ...r, status: 'resolved' });
    } else throw new ApiError(400, 'VALIDATION_ERROR', 'Unknown action.');
    save();
    return reply({ ok: true });
  },
  async adminCreateCategory({ name, description }) {
    requireAdmin();
    if (!name?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Name is required.');
    if (db.categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) throw new ApiError(409, 'CONFLICT', 'That category already exists.');
    const c = { id: newId('c'), name: name.trim(), description: (description || '').trim() };
    db.categories.push(c); save();
    return reply(c);
  },
  async adminUpdateCategory(id, { name, description }) {
    requireAdmin();
    const c = db.categories.find((x) => x.id === id);
    if (!c) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Category not found.');
    if (!name?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Name is required.');
    c.name = name.trim(); c.description = (description || '').trim(); save();
    return reply(c);
  },
  async adminDeleteCategory(id) {
    requireAdmin();
    // ASSUMPTION (not in the docs): a category that still has posts cannot be deleted.
    if (db.posts.some((p) => p.categoryId === id)) throw new ApiError(409, 'CONFLICT', 'Move or delete this category’s posts first.');
    db.categories = db.categories.filter((c) => c.id !== id); save();
    return reply({ ok: true });
  },
};
