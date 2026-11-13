# Database — MongoDB + Mongoose

## 1. Purpose

MongoDB is the persistent datastore. Mongoose provides schema/model access from the Node.js + Express backend.

## 2. Core Collections

The current product model defines eight collections:

- `User`
- `Post`
- `Category`
- `Comment`
- `Bookmark`
- `Notification`
- `Report`
- `RefreshToken` (authentication support — not a product-facing entity, but persisted)

## 3. Logical Schemas

### User

Purpose: identity, credentials metadata, profile information, role, and account status.

```text
User
├─ identity information
├─ credentials metadata
├─ profile information
├─ role
└─ status
```

Roles currently defined by the product: `student`, `admin`.

Status currently defined: `active`, `suspended` (default `active`). This backs `PATCH /admin/users/:id` (see `api.md` §4) — admin user management can change `role` and/or `status`. A suspended user's authentication should be rejected (or their sessions/refresh tokens revoked) at login/refresh time; the exact enforcement point is an implementation detail.

### Post

```text
Post
├─ title
├─ content
├─ searchText   (server-derived plain text for keyword search)
├─ author → User
├─ category → Category (nullable on drafts)
├─ status
├─ created timestamp
└─ updated / published timestamp data
```

Allowed product states: `draft`, `published`.

`content`: Structured JSON document produced by the rich-text editor (TipTap/ProseMirror format). Contains typed nodes for text, formatting marks, images, links, lists, headings, code blocks, blockquotes, hard breaks, and horizontal rules. Image nodes store an external or Cloudinary `https://` (`http(s)`) URL in `attrs.src`, optional `alt`, and optional `title` caption — **never** raw binary files or Base64 `data:` strings in MongoDB (`security.md` §10, `api.md` §4).

`searchText`: Plain text extracted server-side from `content` on post creation/update so keyword search can query `title` and body text without scanning nested JSON nodes (`§6`).

Comment counts shown on dashboards and feeds are **computed at read time** via aggregation (e.g., `Comment.countDocuments({ post })`), not stored as a denormalized field on `Post`.

### Category

```text
Category
├─ name
└─ description
```

Managed by administrators.

### Comment

```text
Comment
├─ post → Post
├─ author → User
├─ parentId → Comment (optional, null for top-level comments)
├─ content (string, trimmed, max 2000 chars)
├─ createdAt
└─ updatedAt
```

- `parentId = null` denotes a top-level comment. A populated `parentId` denotes a reply.
- Replies may not themselves have replies (`400 REPLY_TO_REPLY` enforced on `POST /comments/:id/replies`): the product strictly supports one reply level.
- On reply creation, `post` is derived server-side from the parent comment's `post` reference, never taken from client input.
- Deleting a top-level comment cascades to delete all child replies referencing it via `parentId`.
- Indexes: `{ post: 1, createdAt: 1 }` and `{ parentId: 1, createdAt: 1 }`.

### Bookmark

```text
Bookmark
├─ userId → User (ref: 'User', required)
├─ postId → Post (ref: 'Post', required)
└─ timestamps (createdAt, updatedAt)
```

- Enforces compound uniqueness on `{ userId: 1, postId: 1 }` to prevent duplicate bookmarks.
- Index `{ userId: 1, createdAt: -1 }` optimizes reverse-chronological saved post queries on `GET /api/bookmarks`.
- Index `{ postId: 1 }` optimizes cascade deletions when posts are deleted.
- Deleting a `Post` cascades deletion to all `Bookmark` records referencing that `postId`.

### Notification

```text
Notification
├─ recipient → User
├─ type
├─ message
├─ post → Post        (serialized as postId in API responses)
├─ comment → Comment  (optional, populated for comment/reply context)
├─ read               (boolean, default false)
└─ createdAt
```

Current notification types: `comment`, `reply`.

Because both `comment` and `reply` notifications navigate directly to `/posts/:postId` in the frontend (`Notifications.jsx`), `Notification` stores a direct `post` reference (`postId` in JSON responses) plus an optional `comment` reference instead of a polymorphic `targetType`/`targetId` sub-document. This guarantees consistent navigation links for both comments and replies and lets post deletion cascade directly to notifications via `post`.

Notifications are fetched/refreshed through normal requests; real-time push is not a current product requirement.

### Report

```text
Report
├─ reporter → User
├─ target
│   ├─ targetType  ('post' | 'comment')
│   └─ targetId    (ObjectId, refPath by targetType)
├─ reason
├─ moderation status
└─ timestamp
```

Report statuses: `pending`, `resolved`, `dismissed`.

`target` is modeled as a `targetType` discriminator (`'post'` or `'comment'`) plus a single `targetId`, resolved via Mongoose's `refPath` — not two separate optional reference fields.

### RefreshToken

```text
RefreshToken
├─ user → User
├─ tokenHash
├─ expiresAt
├─ revoked (boolean, default false)
└─ created timestamp
```

Stores refresh tokens **hashed**, never in plaintext (same treatment as passwords). One `User` may have multiple `RefreshToken` documents (one per active session/device), so any single session can be revoked at logout without invalidating others. See `security.md` §11 and `api.md`'s `POST /auth/refresh` / `POST /auth/logout`.

## 4. Relationships

```text
User        ──< Post
User        ──< Comment
User        ──< Bookmark >── Post
User        ──< Notification
User        ──< Report
User        ──< RefreshToken
Category    ──< Post
Post        ──< Comment
Comment     ──< Comment   (one reply level only)
Post         ──< Notification
Comment      ──< Notification  (optional reference)
Post/Comment ──< Report        (via targetType/targetId)
```

## 5. Query / Index Considerations

The architecture identifies these likely query paths:

```text
Post         → author, category, status, publishedAt / updatedAt, title + searchText
Comment      → post, parentComment
Bookmark     → user, user + post uniqueness
Notification → recipient, post, read state, createdAt
Report       → status, target (targetType + targetId), createdAt
RefreshToken → user, tokenHash lookup, expiresAt (TTL index candidate for automatic cleanup of expired tokens)
```

These are index candidates, not a finalized physical index plan. Final indexes should follow the implemented query patterns.

## 6. Search

Keyword search is required across post titles and body text. To query structured TipTap JSON cleanly in MongoDB without introducing an external search service:

- The backend extracts plain text from `Post.content` into `Post.searchText` whenever a post is created or updated.
- Keyword queries (`q`) filter `published` posts by matching against `title` and `searchText` using database-backed queries (escaped case-insensitive regex for substring matching parity with the mock API, or a MongoDB text index if word-stemmed matching is preferred at scale).
- Do not introduce a separate search service unless a later decision requires it.

## 7. Important Constraints

- Draft/published state is part of the post model.
- Comment nesting is limited to one reply level.
- Bookmark duplicates should be prevented.
- Notification types and report statuses should remain constrained to the product-defined values.
- A `Category` cannot be deleted while any `Post` (`draft` or `published`) still references it (`409 CONFLICT` on `DELETE /admin/categories/:id`).
- The current database diagram is not considered a finalized physical schema.

**Deletion cascade rules:**

- Deleting a `Post` cascades to its `Comment`s, `Bookmark`s, `Notification`s (`post`), and `Report`s that target that post or its comments — **except** when deletion is triggered by `PATCH /admin/reports/:id` with `action: "resolve"`, in which case the resolved `Report` record itself is updated to `status: "resolved"` and retained for moderation history (while `target` serializes as `null` on `GET /admin/reports?status=resolved`).
- Deleting a top-level `Comment` cascades to its one-level `Reply` comments and `Report`s targeting them (preserving the active resolved `Report` record when deleted via moderation `resolve`). (A reply cannot be deleted independently in a way that orphans it, since it has no children by definition.)
- `User` deletion behavior for their authored content (posts, comments, etc.) is not defined by current product decisions and should not be assumed; treat account deletion/deactivation as out of scope until a product decision is made (account **suspension** via `User.status` is in scope — see §3 above — but hard deletion of a user's authored content is not).

## 8. Open Decisions

- Exact Mongoose field names (where internal, while JSON serialization follows `api.md`) and BSON types.
- Exact physical indexes (compound vs text index tuning).
