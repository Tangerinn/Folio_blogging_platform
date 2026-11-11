# API — REST Interface

## 1. Purpose

The backend exposes RESTful APIs through Node.js + Express. Exact endpoint names and response contracts remain implementation decisions; the structure below follows the current product and architecture.

## 2. Request Pipeline

```text
Request
  ↓
Route
  ↓
Authentication middleware (when required)
  ↓
Request validation (schema/params/body)
  ↓
Role-based authorization
  ↓
Resource ownership authorization (resource-specific, after fetch)
  ↓
Controller
  ↓
Service
  ↓
Mongoose / MongoDB
  ↓
JSON response
```

Validation runs before any authorization step that needs to fetch a resource by ID — an ownership check requires a valid, already-parsed identifier, so it must follow validation rather than precede it. Coarse-grained role checks (e.g., "must be admin") don't need a fetched resource and may run immediately after authentication, but resource ownership checks happen after validation and typically inside the service layer once the resource has been fetched.

Controllers should stay thin. Business rules belong in services.

## 3. Endpoint Groups

```text
/auth
/users
/posts
/categories
/comments
/bookmarks
/notifications
/reports
/admin
```

## 4. Representative Endpoints

### Authentication

```http
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

`POST /auth/refresh` exchanges a valid, unrevoked refresh token for a new access token (see `security.md` §11 and `database.md`'s `RefreshToken` collection). `POST /auth/logout` revokes the presented refresh token.

### Posts

```http
GET    /posts
GET    /posts/:id
POST   /posts
PATCH  /posts/:id
DELETE /posts/:id
```

Used for browsing/searching, reading, creating, editing, and deleting posts.

CREATE/UPDATE POSTS:

- `content` is submitted as structured editor JSON.
- The server validates the document structure and only accepts supported node types and attributes (including image-node URLs) before storing it.

Responses for post lists scoped to the requesting user (e.g., "My Posts") include a `commentCount` per post, computed at read time via aggregation — it is not a stored field on the `Post` document (see `database.md` §7).

### Comments

```http
GET    /posts/:postId/comments
POST   /posts/:postId/comments
PATCH  /comments/:id
DELETE /comments/:id
POST   /comments/:id/replies
```

Replies are limited to one level. On `POST /comments/:id/replies`, the reply's `post` reference is derived server-side from the parent comment's `post` field — it is never taken from client input, which prevents a reply from being attached to the wrong post.

Deleting a top-level comment cascades to its replies (see `database.md` §7).

### Bookmarks

```http
POST   /posts/:postId/bookmark
DELETE /posts/:postId/bookmark
GET    /bookmarks
```

### Notifications

```http
GET   /notifications
PATCH /notifications/:id/read
```

Notifications are fetched normally; WebSockets are not required by the current product scope.

### Reports

```http
POST /reports
```

### Admin

```http
GET    /admin/stats
GET    /admin/users
PATCH  /admin/users/:id
GET    /admin/reports
PATCH  /admin/reports/:id
POST   /admin/categories
PATCH  /admin/categories/:id
DELETE /admin/categories/:id
```

`PATCH /admin/users/:id` may update a user's `role` (`student`/`admin`) and/or `status` (`active`/`suspended`). Both fields live on the `User` schema (see `database.md`).

## 5. Authentication Rules

The intended authentication stack is JWT (access + refresh) + bcrypt.

```text
Public
├─ registration
├─ login
├─ token refresh
└─ browsing/reading published posts and categories (GET /posts, GET /posts/:id where status=published, GET /categories)

Authenticated student
├─ profile
├─ own posts (including drafts)
├─ comments/replies
├─ bookmarks
├─ notifications
└─ reports

Admin
├─ user management
├─ content moderation
├─ category management
└─ platform statistics
```

Browsing and reading published posts is public; everything else — creating or editing content, commenting, bookmarking, reporting, and viewing notifications or drafts — requires authentication. Logout and refresh require a valid (refresh) token but not a full authenticated-user session in the same sense as the rest of the authenticated bucket.

## 6. Authorization Rules

Backend authorization is authoritative.

- A student may modify their own posts, not another user's posts.
- A student may edit/delete their own comments.
- Admin operations require the `admin` role.
- Role checks must not rely only on frontend visibility.
- Ownership checks are separate from role checks and run after request validation (§2).

## 7. Validation / Errors

Suggested HTTP semantics from the architecture:

```text
400 → invalid input
401 → unauthenticated / invalid authentication
403 → authenticated but forbidden
404 → resource not found
409 → conflict
500 → unexpected server error
```

Suggested error shape:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Post not found"
  }
}
```

This response shape is a recommendation, not a finalized API contract.

## 8. Search / Filtering

The API must support the product's discovery requirements:

- keyword search
- category filtering
- sorting
- recent/related content behavior

The implementation should not assume a recommendation engine.

## 9. Open Decisions

- Exact endpoint names.
- Request/response JSON schemas.
- JWT transport mechanism (header vs. cookie) — see `security.md` §3, §13.
- Pagination contract.
- Validation library and schemas.
- Fine-grained route boundaries for edge-case admin sub-resources not covered by §5's general public/authenticated split.
