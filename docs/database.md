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
├─ author → User
├─ category → Category
├─ status
├─ created timestamp
└─ updated / published timestamp data
```

Allowed product states: `draft`, `published`.

`content`: Structured JSON document produced by the rich-text editor. Contains typed nodes for text, formatting, images, links, lists, headings, code blocks, and other supported content. Image nodes store an external URL, alt text, and optional caption only — no uploaded file data (see `DESIGN.md`, `security.md` §10).

Comment counts shown on dashboards (e.g., My Posts) are **computed at read time** via aggregation (e.g., `Comment.countDocuments({ post })`), not stored as a denormalized field on `Post`.

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
├─ content
├─ timestamp
└─ parent comment → Comment (optional)
```

`parent comment = null` means a direct comment. A populated parent means a reply. Replies may not themselves have replies because the product supports one level only.

On reply creation, `post` is derived server-side from the parent comment's `post` field, never taken from client input (see `api.md` §4).

### Bookmark

```text
Bookmark
├─ user → User
└─ post → Post
```

Implementation recommendation: enforce uniqueness on `(user, post)` so a user cannot bookmark the same post twice.

### Notification

```text
Notification
├─ recipient → User
├─ type
├─ message
├─ target
│   ├─ targetType  ('post' | 'comment')
│   └─ targetId    (ObjectId, refPath by targetType)
├─ read state
└─ timestamp
```

Current notification types: `comment`, `reply`.

The `target` sub-document uses the same `targetType`/`targetId` (Mongoose `refPath`) pattern as `Report.target` below, since a notification about a comment or reply points at a `Comment`, while other notification types could point at a `Post`.

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
Post/Comment ──< Report        (via targetType/targetId)
Post/Comment ──< Notification  (via targetType/targetId)
```

## 5. Query / Index Considerations

The architecture identifies these likely query paths:

```text
Post         → author, category, status, timestamps
Comment      → post, parentComment
Bookmark     → user, user + post uniqueness
Notification → recipient, read state, timestamp
Report       → status, target (targetType + targetId), timestamp
RefreshToken → user, tokenHash lookup, expiresAt (TTL index candidate for automatic cleanup of expired tokens)
```

These are index candidates, not a finalized physical index plan. Final indexes should follow the implemented query patterns.

## 6. Search

Keyword search is required. The current sources do not prescribe the exact MongoDB search/index strategy.

Do not introduce a separate search service unless a later decision requires it.

## 7. Important Constraints

- Draft/published state is part of the post model.
- Comment nesting is limited to one reply level.
- Bookmark duplicates should be prevented.
- Notification types and report statuses should remain constrained to the product-defined values.
- The current database diagram is not considered a finalized physical schema.

**Deletion cascade rules:**

- Deleting a `Post` cascades to its `Comment`s, `Bookmark`s, and any `Report`s that target it.
- Deleting a top-level `Comment` cascades to its one-level `Reply` comments. (A reply cannot be deleted independently in a way that orphans it, since it has no children by definition.)
- `User` deletion behavior for their authored content (posts, comments, etc.) is not defined by current product decisions and should not be assumed; treat account deletion/deactivation as out of scope until a product decision is made (account **suspension** via `User.status` is in scope — see §3 above — but hard deletion of a user's authored content is not).

## 8. Open Decisions

- Exact Mongoose field names and BSON types.
- Exact physical indexes.
- Search implementation/index strategy.
