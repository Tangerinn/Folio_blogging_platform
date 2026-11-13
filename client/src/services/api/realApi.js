// Real backend client. Same method names as mockApi.js, so flipping VITE_USE_MOCK=false
// is the whole "stitching" step. Paths follow api.md; the ones marked (assumed) are not
// in api.md yet — add them to the backend or adjust here.
import { ApiError } from './mockApi.js';

const BASE = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'folio_access_token';
const REFRESH_KEY = 'folio_refresh_token';

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* ignore */ } };

const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v !== '' && v != null)).toString();
  return s ? `?${s}` : '';
};

async function raw(method, path, body, token) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server. Please check your connection.');
  }

  const text = res.status === 204 ? '' : await res.text().catch(() => '');
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (!res.ok) {
    const code = data?.error?.code || data?.code || 'ERROR';
    const message = data?.error?.message || data?.message || 'Something went wrong.';
    throw new ApiError(res.status, code, message);
  }
  return data;
}

let refreshing = null;
async function refresh() {
  const rt = get(REFRESH_KEY);
  if (!rt) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in.');
  refreshing ||= raw('POST', '/auth/refresh', { refreshToken: rt })
    .then((d) => { set(TOKEN_KEY, d.accessToken); if (d.refreshToken) set(REFRESH_KEY, d.refreshToken); return d.accessToken; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function request(method, path, body) {
  try {
    return await raw(method, path, body, get(TOKEN_KEY));
  } catch (e) {
    if (e.status === 401 && get(REFRESH_KEY) && !path.startsWith('/auth/')) {
      let nextToken;
      try {
        nextToken = await refresh();
      } catch (e2) {
        set(TOKEN_KEY, null);
        set(REFRESH_KEY, null);
        throw e2;
      }
      return raw(method, path, body, nextToken);
    }
    throw e;
  }
}

export const realApi = {
  async me() {
    if (!get(TOKEN_KEY) && !get(REFRESH_KEY)) return null;
    try { return await request('GET', '/users/me'); } catch { return null; } // (assumed)
  },
  register: (b) => request('POST', '/auth/register', b),
  async login(b) {
    const d = await request('POST', '/auth/login', b);
    set(TOKEN_KEY, d?.accessToken);
    set(REFRESH_KEY, d?.refreshToken);
    return d?.user || request('GET', '/users/me');
  },
  async logout() {
    try { await request('POST', '/auth/logout', { refreshToken: get(REFRESH_KEY) }); } catch { /* ignore */ }
    set(TOKEN_KEY, null); set(REFRESH_KEY, null);
    return { ok: true };
  },

  listCategories: () => request('GET', '/categories'), // (assumed)

  listPosts: (p) => request('GET', `/posts${qs(p)}`),
  myPosts: () => request('GET', '/posts?mine=true'), // (assumed)
  getPost: (id) => request('GET', `/posts/${id}`),
  createPost: (b) => request('POST', '/posts', b),
  updatePost: (id, b) => request('PATCH', `/posts/${id}`, b),
  deletePost: (id) => request('DELETE', `/posts/${id}`),

  listComments: (postId) => request('GET', `/posts/${postId}/comments`),
  addComment: (postId, b) => request('POST', `/posts/${postId}/comments`, b),
  addReply: (commentId, b) => request('POST', `/comments/${commentId}/replies`, b),
  editComment: (id, b) => request('PATCH', `/comments/${id}`, b),
  deleteComment: (id) => request('DELETE', `/comments/${id}`),

  addBookmark: (postId) => request('POST', `/posts/${postId}/bookmark`),
  removeBookmark: (postId) => request('DELETE', `/posts/${postId}/bookmark`),
  listBookmarks: (p) => request('GET', `/bookmarks${qs(p)}`),

  listNotifications: () => request('GET', '/notifications'),
  markNotificationRead: (id) => request('PATCH', `/notifications/${id}/read`),

  createReport: (b) => request('POST', '/reports', b),

  uploadImage: (file) => {
    const form = new FormData();
    form.append('image', file);
    return request('POST', '/uploads/image', form);
  },

  getProfile: (id) => request('GET', `/users/${id}`), // (assumed)
  updateProfile: (b) => request('PATCH', '/users/me', b), // (assumed)

  adminStats: () => request('GET', '/admin/stats'),
  adminListUsers: (p) => request('GET', `/admin/users${qs(p)}`),
  adminUpdateUser: (id, b) => request('PATCH', `/admin/users/${id}`, b),
  adminListReports: (p) => request('GET', `/admin/reports${qs(p)}`),
  adminUpdateReport: (id, b) => request('PATCH', `/admin/reports/${id}`, b),
  adminCreateCategory: (b) => request('POST', '/admin/categories', b),
  adminUpdateCategory: (id, b) => request('PATCH', `/admin/categories/${id}`, b),
  adminDeleteCategory: (id) => request('DELETE', `/admin/categories/${id}`),
};

export function getAccessToken() {
  return get(TOKEN_KEY);
}

export async function refreshAccessToken() {
  try {
    return await refresh();
  } catch (err) {
    set(TOKEN_KEY, null);
    set(REFRESH_KEY, null);
    throw err;
  }
}

export function getSocketUrl() {
  const explicit = import.meta.env?.VITE_SOCKET_URL;
  if (explicit) return explicit;
  try {
    return new URL(BASE).origin;
  } catch {
    return 'http://localhost:5000';
  }
}
