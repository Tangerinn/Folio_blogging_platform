# API — REST Interface

## 1. Purpose

The backend exposes a RESTful JSON API via Node.js + Express under `/api` (plus `GET /health` at the server root). This document defines the contract shared by the React client (`client/src/services/api/realApi.js` and `mockApi.js`) and the Express backend.

## 2. Request Pipeline

```text
Request
  ↓
Route
  ↓
Rate limiter (strict on /auth/login, /auth/register, /uploads/image)
  ↓
Authentication middleware (`requireAuth` or `optionalAuth`, rejects suspended users)
  ↓
Request validation (Zod schemas for ObjectId params, query params, and JSON body)
  ↓
Role-based authorization (`requireAdmin` where required)
  ↓
Controller (thin HTTP adapter)
  ↓
Service (resource fetch, ownership authorization, business rules)
  ↓
Mongoose / MongoDB
  ↓
JSON response
```

Validation runs before any ownership check so malformed identifiers or invalid payloads fail immediately with `400 VALIDATION_ERROR` before database queries run. Coarse-grained role checks (`requireAdmin`) run after validation; resource ownership checks run inside the service layer once the target document is fetched.

## 3. Response & Error Conventions

- **Identifier normalization:** All serialized entities expose string `id` (not Mongo `_id`) and omit internal fields (`__v`, `passwordHash`, `searchText`, refresh token hashes).
- **Success payloads:** Endpoints return unwrapped JSON objects or arrays matching `realApi.js` / `mockApi.js`. `GET /posts` supports `page` and `limit` query parameters, returning a `Post[]` array body with pagination metadata in `X-Total-Count`, `X-Page`, `X-Limit`, and `X-Total-Pages` headers so array-expecting clients and paginated consumers both work cleanly.
- **Error envelope:**

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Post not found."
  }
}
```

Standard HTTP status mappings and error codes:

| HTTP Status | Code(s) | Meaning |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR`, `REPLY_TO_REPLY` | Invalid params/query/body, unsafe TipTap node/URL, self-role/status edit, or reply nested > 1 level |
| `401` | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | Missing/expired/invalid token or bad login credentials |
| `403` | `FORBIDDEN`, `ACCOUNT_SUSPENDED` | Insufficient role, failed resource ownership, or suspended account |
| `404` | `RESOURCE_NOT_FOUND` | Missing resource, hidden draft, or invalid target |
| `409` | `EMAIL_TAKEN`, `CONFLICT` | Duplicate email, duplicate category name, or deleting a category that still has posts |
| `413` | `PAYLOAD_TOO_LARGE` | Request body or uploaded image exceeds allowed byte ceiling |
| `429` | `RATE_LIMITED` | Too many requests |
| `500` | `INTERNAL_ERROR` | Unexpected server failure |

## 4. Endpoint Specifications

All `/api/*` routes below are prefixed by `VITE_API_URL` (default `http://localhost:5000/api`).

### Shared Response Shapes

- **PublicUser:** `{ id, name, email, role, status, bio, createdAt }` (`role`: `'student' | 'admin'`, `status`: `'active' | 'suspended'`)
- **AuthorSummary:** `{ id, name, bio }` (falls back to `{ id, name: "Deleted user", bio: "" }` if missing)
- **CategorySummary:** `{ id, name, description }`
- **Post (shaped):**
  ```json
  {
    "id": "string",
    "title": "string",
    "content": { "type": "doc", "content": [] },
    "status": "draft | published",
    "createdAt": "ISO8601",
    "publishedAt": "ISO8601 | null",
    "updatedAt": "ISO8601",
    "author": { "id": "string", "name": "string", "bio": "string" },
    "category": { "id": "string", "name": "string", "description": "string" },
    "categoryId": "string | null",
    "commentCount": 0,
    "bookmarked": false
  }
  ```
  (`category` is `null` when `categoryId` is `null` on a draft; `commentCount` is computed via aggregation; `bookmarked` is `false` for unauthenticated callers.)

---

### Authentication (`/api/auth`)

| Method & Route | Auth | Notes |
| :--- | :--- | :--- |
| `POST /auth/register` | Public (rate-limited) | Creates a new `student` (`status: 'active'`) |
| `POST /auth/login` | Public (rate-limited) | Issues access + refresh tokens and user profile |
| `POST /auth/refresh` | Valid refresh token | Exchanges refresh token for a new access token |
| `POST /auth/logout` | Optional / refresh token | Revokes the presented refresh token |

- **`POST /auth/register`**
  - Body: `{ name, email, password }` (`name`: trimmed non-empty string, `<= 80` chars; `email`: valid email, trimmed/lowercased; `password`: `>= 8` chars). Server ignores any client-supplied `role` or `status`.
  - Response (`201`): `PublicUser`.
  - Errors: `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`.
- **`POST /auth/login`**
  - Body: `{ email, password }`.
  - Response (`200`): `{ accessToken, refreshToken, user: PublicUser }`.
  - Errors: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `403 ACCOUNT_SUSPENDED`.
- **`POST /auth/refresh`**
  - Body: `{ refreshToken }`. Verifies token against hashed `RefreshToken` record (`!revoked`, `expiresAt > now`) and confirms user `status === 'active'`.
  - Response (`200`): `{ accessToken, refreshToken? }` (if rotated, old refresh token is revoked and new `refreshToken` is returned).
  - Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 ACCOUNT_SUSPENDED`.
- **`POST /auth/logout`**
  - Body: `{ refreshToken? }`. Marks matching `RefreshToken` `revoked: true` when present.
  - Response (`200`): `{ ok: true }`.

---

### Users & Profiles (`/api/users`)

| Method & Route | Auth | Notes |
| :--- | :--- | :--- |
| `GET /users/me` | `requireAuth` | Returns current authenticated user |
| `PATCH /users/me` | `requireAuth` | Updates own `name` and `bio` |
| `GET /users/:id` | `optionalAuth` | Returns public author profile + published posts |

- **`GET /users/me`**
  - Response (`200`): `PublicUser`.
  - Errors: `401 UNAUTHENTICATED`, `403 ACCOUNT_SUSPENDED`.
- **`PATCH /users/me`**
  - Body: `{ name, bio? }` (`name`: trimmed non-empty `1..80` chars; `bio`: optional trimmed string `<= 300` chars, defaults to `""`). Client cannot change `email`, `role`, or `status`.
  - Response (`200`): updated `PublicUser`.
  - Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 ACCOUNT_SUSPENDED`.
- **`GET /users/:id`**
  - Params: `id` (valid `ObjectId`).
  - Response (`200`): `{ user: { id, name, bio, createdAt }, posts: Post[] }` where `posts` includes only that user's `published` posts sorted by `publishedAt` descending (`bookmarked` reflects authenticated caller or `false` for guests). Private fields (`email`, `role`, `status`) are omitted.
  - Errors: `400 VALIDATION_ERROR`, `404 RESOURCE_NOT_FOUND`.

---

### Categories (`/api/categories`)

- **`GET /categories`** *(Public)*
  - Response (`200`): `Array<{ id, name, description, postCount }>` where `postCount` counts `published` posts in each category via aggregation.

---

### Image Uploads (`/api/uploads`)

- **`POST /uploads/image`** *(`requireAuth`, rate-limited)*
  - Request: `multipart/form-data` with field `image`.
  - Validation: Accepts `image/png`, `image/jpeg`, `image/webp`, and `image/gif` only (verified by MIME type and file signature/magic bytes; SVG rejected). Max file size **5 MB**.
  - Behavior: Streams image to **Cloudinary** (folder `folio/posts/`) rather than persisting binary data in MongoDB or local server disk.
  - Response (`201`): `{ url, publicId, width, height }` where `url` is the Cloudinary `https://` URL.
  - Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 ACCOUNT_SUSPENDED`, `413 PAYLOAD_TOO_LARGE`, `429 RATE_LIMITED`.
  - *Mock-mode note:* In offline mock mode (`VITE_USE_MOCK=true`), `imageUpload.js` embeds a raster `data:image/*` URI directly in browser `localStorage`; in production (`VITE_USE_MOCK=false`), device uploads use `POST /uploads/image` and `Post.content` accepts `http(s)` URLs only.

---

### Posts (`/api/posts`)

| Method & Route | Auth | Ownership |
| :--- | :--- | :--- |
| `GET /posts` | `optionalAuth` (**`requireAuth` when `mine=true`**) | Public published feed or caller's own posts |
| `GET /posts/:id` | `optionalAuth` | Drafts visible only to post author or `admin` |
| `POST /posts` | `requireAuth` | Author set server-side from `req.user.id` |
| `PATCH /posts/:id` | `requireAuth` | Author only (`403 FORBIDDEN` otherwise) |
| `DELETE /posts/:id` | `requireAuth` | Author only (`403 FORBIDDEN` otherwise) |

- **`GET /posts`**
  - Query parameters:
    - `mine` (`"true"` optional): Requires valid authentication (`401 UNAUTHENTICATED` if unauthenticated). Returns all `draft` and `published` posts authored by `req.user.id`, sorted by `updatedAt` descending.
    - When `mine` is omitted/false, returns `published` posts only with optional filters:
      - `q`: keyword string matched case-insensitively against `title` and `searchText` (plain text extracted from `content`).
      - `category`: `Category` ID (`ObjectId`).
      - `authorId`: `User` ID (`ObjectId`).
      - `sort`: `'newest'` *(default, `publishedAt` desc)* | `'discussed'` *(`commentCount` desc; falls back to `publishedAt` desc until Comments are implemented)* | `'oldest'` *(`publishedAt` asc)*.
      - `page`: positive integer `>= 1` (default `1`).
      - `limit`: positive integer `1..50` (default `20`, e.g., `limit=3` in the discovery sidebar).
  - Response (`200`): `Post[]` body plus headers `X-Total-Count`, `X-Page`, `X-Limit`, and `X-Total-Pages`. (`commentCount` reflects total comments and replies; `bookmarked` is a dynamic boolean reflecting whether the authenticated caller has bookmarked the post, or `false` for unauthenticated visitors).
  - Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED` (when `mine=true`), `403 ACCOUNT_SUSPENDED`.
- **`GET /posts/:id`**
  - Params: `id` (`ObjectId`).
  - Response (`200`): shaped `Post`. Returns `404 RESOURCE_NOT_FOUND` if missing, or if `status === 'draft'` and caller is neither the post author nor `admin`.
- **`POST /posts`**
  - Body: `{ title, content, categoryId?, status? }` (`status`: `'draft'` default or `'published'`; protected fields such as `author`/`authorId`/`publishedAt` are ignored and `author` is always set from `req.user.id`).
  - Validation:
    - Always required: `title` trimmed non-empty `1..150` chars; `content` valid TipTap JSON schema (`security.md` §10; `image.attrs.src` and `link` `attrs.href` must be valid `http://` or `https://` URLs — `data:` and `javascript:` URIs rejected); if provided, `categoryId` must reference an existing `Category`.
    - Additional rules when `status === 'published'`: `categoryId` must reference an existing `Category`, and `content` must not be empty (must contain text or a valid image node).
  - Side effects: Sets `publishedAt = now` if `status === 'published'`, else `null`; computes `searchText`.
  - Response (`201`): shaped `Post`.
  - Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 ACCOUNT_SUSPENDED`.
- **`PATCH /posts/:id`**
  - Body: `{ title?, content?, categoryId?, status? }` (at least one updatable field required; partial updates are merged against the stored post and validated against the same create/publish rules, ignoring protected fields such as `author`/`publishedAt`). Preserves existing `publishedAt` if already published; sets `publishedAt = now` on first publish; updates `updatedAt` and `searchText`.
  - Response (`200`): shaped `Post`.
  - Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `403 ACCOUNT_SUSPENDED`, `404 RESOURCE_NOT_FOUND`.
- **`DELETE /posts/:id`**
  - Deletes the post (cascade removal of its `Comment`s, `Bookmark`s, `Notification`s, and `Report`s applies as those modules are enabled).
  - Response (`200`): `{ ok: true }`.
  - Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `403 ACCOUNT_SUSPENDED`, `404 RESOURCE_NOT_FOUND`.

---

### Comments (`/api/posts/:postId/comments`, `/api/comments`)

| Method & Route | Auth | Ownership / Business Rule |
| :--- | :--- | :--- |
| `GET /posts/:postId/comments` | `optionalAuth` | Public on published posts; drafts restricted to author or admin; returns nested 1-level (`replies[]`) |
| `POST /posts/:postId/comments` | `requireAuth` | Published posts or own drafts |
| `POST /comments/:id/replies` | `requireAuth` | Top-level parent only (`400 REPLY_TO_REPLY`), server-derived `postId` |
| `PATCH /comments/:id` | `requireAuth` | Comment author only (`403 FORBIDDEN`) |
| `DELETE /comments/:id` | `requireAuth` | Comment author only (`403 FORBIDDEN`), cascades to replies |

- **`GET /posts/:postId/comments`**
  - Response (`200`): Top-level comments sorted `createdAt` asc:
    `Array<{ id, postId, parentId: null, content, createdAt, updatedAt, author: AuthorSummary, replies: Array<{ id, postId, parentId, content, createdAt, updatedAt, author: AuthorSummary }> }>` (replies sorted `createdAt` asc).
  - Errors: `400 VALIDATION_ERROR`, `404 RESOURCE_NOT_FOUND` (missing post or unpermitted draft).
- **`POST /posts/:postId/comments`**
  - Body: `{ content }` (trimmed non-empty, `<= 2000` chars).
  - Response (`201`): `{ id, postId, parentId: null, content, createdAt, updatedAt, author: AuthorSummary, replies: [] }`.
  - Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 ACCOUNT_SUSPENDED`, `404 RESOURCE_NOT_FOUND`.
- **`POST /comments/:id/replies`**
  - Body: `{ content }` (trimmed non-empty, `<= 2000` chars). Rejects if parent comment already has a `parentId` (`400 REPLY_TO_REPLY`). Derives `postId` server-side from parent.
  - Response (`201`): `{ id, postId, parentId, content, createdAt, updatedAt, author: AuthorSummary }`.
  - Errors: `400 VALIDATION_ERROR`, `400 REPLY_TO_REPLY`, `401 UNAUTHENTICATED`, `403 ACCOUNT_SUSPENDED`, `404 RESOURCE_NOT_FOUND`.
- **`PATCH /comments/:id`**
  - Body: `{ content }` (trimmed non-empty, `<= 2000` chars).
  - Response (`200`): `{ ok: true }`.
  - Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `403 ACCOUNT_SUSPENDED`, `404 RESOURCE_NOT_FOUND`.
- **`DELETE /comments/:id`**
  - Deletes comment and its 1-level child replies.
  - Response (`200`): `{ ok: true }`.
  - Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `403 ACCOUNT_SUSPENDED`, `404 RESOURCE_NOT_FOUND`.

---

### Bookmarks (`/api/bookmarks`, `/api/posts/:postId/bookmark`)

| Method & Route | Auth | Notes |
| :--- | :--- | :--- |
| `POST /posts/:postId/bookmark` | `requireAuth` | Published posts or own drafts; idempotent upsert |
| `DELETE /posts/:postId/bookmark` | `requireAuth` | Idempotent delete for `(req.user.id, postId)` |
| `GET /bookmarks` | `requireAuth` | Paginated (`page`, `limit`), supports `q` and `category` filters |

- **`POST /posts/:postId/bookmark`** -> `200 { ok: true }` (`404 RESOURCE_NOT_FOUND` if post missing or inaccessible draft).
- **`DELETE /posts/:postId/bookmark`** -> `200 { ok: true }`.
- **`GET /bookmarks`** -> Query `{ q?, category?, page?, limit? }`. Returns caller's bookmarked `published` posts ordered by bookmark `createdAt` desc with headers `X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages`. Each post includes `bookmarked: true` and dynamic `commentCount` -> `200 Post[]`.

---

### Notifications (`/api/notifications`)

| Method & Route | Auth | Ownership |
| :--- | :--- | :--- |
| `GET /notifications` | `requireAuth` | Scoped to `recipient === req.user.id` |
| `PATCH /notifications/:id/read` | `requireAuth` | Recipient only (`403 FORBIDDEN` / `404 RESOURCE_NOT_FOUND`) |

- **`GET /notifications`**
  - Response (`200`): `Array<{ id, recipientId, type: "comment" | "reply", message, postId, read, createdAt }>` sorted by `createdAt` desc.
  - *Note on `markAllRead` & live updates:* `GET /notifications` loads initial state on sign-in/navigation, and `NotificationsContext.jsx` also listens for `notification:new` over Socket.IO to prepend new notifications live. The frontend's `markAllRead` action sends parallel `PATCH /notifications/:id/read` calls for each unread ID; adding a batch `PATCH /notifications/read-all` endpoint later is backwards-compatible if unread volumes grow.
- **`PATCH /notifications/:id/read`**
  - Response (`200`): `{ ok: true }`.

---

### Real-Time Socket.IO Events

Socket.IO is attached to the HTTP server (same origin/port as the API, configured via `VITE_SOCKET_URL` or derived from `VITE_API_URL`'s origin) and requires a valid access token in `auth.token` during the handshake.

| Direction | Event | Room / Target | Payload |
| :--- | :--- | :--- | :--- |
| Server -> Client | `notification:new` | `user:<userId>` | `{ id, recipientId, type, message, postId, read, createdAt }` (same shape as `GET /notifications` items; never emitted to the actor) |
| Client -> Server | `post:join` | Socket joins `post:<postId>` | `{ postId }` (allowed only for `published` posts; ack `{ ok: true }` or `{ ok: false, error }`) |
| Client -> Server | `post:leave` | Socket leaves `post:<postId>` | `{ postId }` |
| Server -> Client | `comment:new` | `post:<postId>` | Same shaped comment/reply object returned by `POST /posts/:id/comments` or `POST /comments/:id/replies` (with `author`) |

---

### Reports (`/api/reports`)

- **`POST /reports`** *(`requireAuth`)*
  - Body: `{ targetType: "post" | "comment", targetId, reason }` (`reason`: trimmed non-empty `1..500` chars; target document must exist -> `404 RESOURCE_NOT_FOUND` otherwise).
  - Creates a `Report` with `status: 'pending'`.
  - Response (`201`): `{ ok: true }`.

---

### Admin (`/api/admin` — `requireAuth` + `requireAdmin`)

| Method & Route | Auth | Purpose |
| :--- | :--- | :--- |
| `GET /admin/stats` | `requireAdmin` | Dashboard counts + 8 recent activity items |
| `GET /admin/users` | `requireAdmin` | User list with optional `q` filter |
| `PATCH /admin/users/:id` | `requireAdmin` | Update another user's `role` or `status` |
| `GET /admin/reports` | `requireAdmin` | Moderation queue filtered by `status` |
| `PATCH /admin/reports/:id` | `requireAdmin` | Dismiss report or resolve (cascade delete target) |
| `POST /admin/categories` | `requireAdmin` | Create category |
| `PATCH /admin/categories/:id` | `requireAdmin` | Update category name/description |
| `DELETE /admin/categories/:id` | `requireAdmin` | Delete category if no posts reference it |

- **`GET /admin/stats`**: Returns `{ users, publishedPosts, comments, pendingReports, recent }` where `recent` is the 8 most recent events (`{ id, text, at }`) across published posts, comments, and user registrations sorted desc.
- **`GET /admin/users`**: Query `{ q? }` (case-insensitive match on `name` and `email`). Returns `PublicUser[]`.
- **`PATCH /admin/users/:id`**: Body `{ role?, status? }` (`role`: `'student' | 'admin'`, `status`: `'active' | 'suspended'`). Rejects modifying `req.user.id` (`400 VALIDATION_ERROR`). Returns updated `PublicUser`.
- **`GET /admin/reports`**: Query `{ status? }` (`'pending' | 'resolved' | 'dismissed'`). Sorted `createdAt` desc. Returns:
  ```json
  [{
    "id": "string",
    "reporterId": "string",
    "reporter": "string",
    "targetType": "post | comment",
    "targetId": "string",
    "reason": "string",
    "status": "pending | resolved | dismissed",
    "createdAt": "ISO8601",
    "target": {
      "id": "string",
      "title": "post only",
      "excerpt": "comment only",
      "author": "string",
      "postId": "string"
    }
  }]
  ```
  (`target` is `null` if the reported post/comment has already been removed.)
- **`PATCH /admin/reports/:id`**: Body `{ action: "dismiss" | "resolve" }`.
  - `dismiss`: updates report `status = 'dismissed'`.
  - `resolve`: executes full cascade deletion on the target (`Post` or `Comment` + children/bookmarks/notifications/other reports targeting it) while updating and retaining this report with `status = 'resolved'` so moderation history remains intact. Returns `{ ok: true }`.
- **`POST /admin/categories`**: Body `{ name, description? }` (`name` trimmed non-empty, unique case-insensitively -> `409 CONFLICT`). Returns `201 { id, name, description }`.
- **`PATCH /admin/categories/:id`**: Body `{ name, description? }` (`name` trimmed non-empty, unique case-insensitively across other categories -> `409 CONFLICT`). Returns `200 { id, name, description }`.
- **`DELETE /admin/categories/:id`**: Rejects with `409 CONFLICT` (`"Move or delete this category’s posts first."`) if any `Post` (`draft` or `published`) references `categoryId`. Returns `200 { ok: true }`.

## 5. Authentication & Authorization Rules

- **Token transport:** `Authorization: Bearer <accessToken>` header (`15m` expiry) + hashed multi-session `RefreshToken` persisted in MongoDB.
- **Role boundary:** Only `admin` may access `/admin/*` or view other users' drafts (`GET /posts/:id`). Suspended users (`status === 'suspended'`) cannot log in, refresh tokens, or pass `requireAuth`.
- **Ownership boundary:** Students can only edit/delete their own posts (`PATCH`/`DELETE /posts/:id`) and comments (`PATCH`/`DELETE /comments/:id`) and read/mark their own notifications (`GET`/`PATCH /notifications/*`). Admins do **not** bypass post/comment edit ownership; they remove violating content through `PATCH /admin/reports/:id` (`resolve`).

## 6. Search / Filtering

Keyword search (`q`), category filtering (`category`), author filtering (`authorId`), sorting (`newest`, `discussed`, `oldest`), and sidebar caps (`limit`) are executed via MongoDB queries against `published` posts and `Post.searchText` (without a recommendation engine or separate search infrastructure).

## 7. Resolved vs Remaining Open Decisions

- **Resolved:** Exact endpoint routes and HTTP methods (including `/users/me`, `/users/:id`, `/categories`, `/posts?mine=true`, `/uploads/image`), request/response JSON contracts, `{ error: { code, message } }` envelope, header-based Bearer JWT transport, request validation, header-based pagination (`page`/`limit` + `X-Total-*` headers on `GET /posts`), non-empty category deletion guard (`409 CONFLICT`), unified `Notification.postId` contract, Cloudinary image upload flow, and `resolve` report retention semantics.
- **Unresolved (deferred / non-blocking):**
  - Cursor-based pagination or wrapped `{ items, total }` envelopes for other list endpoints (if corpus scale outgrows array responses).
  - Orphaned Cloudinary image cleanup (for deleted posts or abandoned drafts — out of v1 scope unless a cleanup job is added later).
  - Batch `PATCH /notifications/read-all` endpoint (optional future optimization if unread volumes exceed individual `PATCH /notifications/:id/read` bursts).
  - Whether `POST /auth/refresh` always rotates refresh tokens on every refresh (`realApi.js` supports both rotated and non-rotated responses).
