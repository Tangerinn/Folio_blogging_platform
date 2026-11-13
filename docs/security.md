# Security

## 1. Security Baseline

The intended security stack is:

- JWT authentication (short-lived access token + server-side refresh token)
- bcrypt password hashing
- environment variables for secrets/configuration
- input validation
- server-side role-based authorization
- rate limiting on authentication endpoints
- explicit CORS configuration

## 2. Authentication

### Registration

```text
Input
 ↓
Validate
 ↓
Apply account constraints
 ↓
Hash password with bcrypt
 ↓
Create User
```

### Login

```text
Input
 ↓
Validate
 ↓
Find User
 ↓
Verify password with bcrypt
 ↓
Issue access token + refresh token
```

Passwords must never be stored in plaintext.

## 3. JWT

Protected requests should be processed as:

```text
Request
 ↓
Read token
 ↓
Verify signature / claims
 ↓
Attach authenticated-user context
 ↓
Authorization / ownership check
 ↓
Controller
```

Input/param validation happens before the authorization/ownership check shown above (validation must run on a request's params before those params are used to fetch a resource for an ownership check) — see `api.md` §2 for the full request pipeline order.

Token transport is settled on **header-based Bearer tokens**: access tokens are sent in `Authorization: Bearer <accessToken>`, and refresh tokens are sent in the JSON request body to `POST /auth/refresh` and `POST /auth/logout` (matching `realApi.js` and `§13`).

Protected requests reject users whose `User.status === 'suspended'` (`403 ACCOUNT_SUSPENDED`) as well as missing, malformed, or expired tokens (`401 UNAUTHENTICATED`).

## 4. Authorization

The backend is the security boundary.

```text
Role authorization
    +
Resource ownership
    +
Business rules
```

Examples:

- Student can modify only their own content.
- Admin-only management/moderation routes require the admin role.
- Frontend-hidden buttons are not sufficient protection.
- **Profile update allowlist (`PATCH /users/me`):** Authenticated users can modify only their own `name` (`1..80` chars) and `bio` (`<= 300` chars). Client-supplied `role`, `status`, `email`, or password fields are strictly ignored/stripped, preventing privilege escalation.
- **Public author profiles (`GET /users/:id`):** Exposes only non-sensitive author details (`id`, `name`, `bio`, `createdAt`) and their published posts. Sensitive account fields (`email`, `role`, `status`, `passwordHash`) are never leaked. Suspended users return `404 RESOURCE_NOT_FOUND`.
- **Bookmark access control:** Adding a bookmark (`POST /posts/:id/bookmark`) verifies that the post is accessible to the user (published, or a draft authored by the caller / viewed by admin). Bookmarks are isolated per user and cannot be inspected by other non-admin users. Deleting a post cascades to remove all associated bookmarks.

## 5. Input and Data Safety

Validate user-controlled input at the API boundary before business logic executes, and apply safe output handling for user-generated content.

Request validation uses **Zod** schemas (params, query parameters, and request bodies). Rich-text/content-node and image-upload validation is specified in §10 below.

## 6. Secrets

Keep secrets outside source control using environment configuration.

Required secrets and environment configuration:

```text
MONGODB_URI
CORS_ORIGIN
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

See `development.md` §4 for the full backend/frontend variable list.

## 7. API Security Rules

- Do not trust client-supplied role values.
- Do not trust client-supplied ownership claims.
- Do not return password hashes, refresh tokens, or other credentials in normal user responses.
- Validate identifiers and payloads before database operations.
- Protect admin operations with backend authorization.
- Use HTTPS in deployed environments.
- Rate-limit `/auth/login` and `/auth/register` to mitigate brute-force and account-enumeration attempts.

## 8. Reporting / Moderation

Reports create a moderation record and admin actions update its moderation state.

```text
User report
 ↓
pending
 ↓
Admin review
 ├─ dismissed
 └─ resolved
```

Moderation actions should be authenticated and admin-authorized.

## 9. Security Scope

The current architecture does not define a full security/observability platform. Advanced controls should be added only when requirements justify them.

## 10. Content/Input security & Image Uploads

Post content is stored as structured TipTap/ProseMirror JSON. The server validates the document structure, allowed node types (`doc`, `paragraph`, `heading`, `text`, `bulletList`, `orderedList`, `listItem`, `blockquote`, `codeBlock`, `hardBreak`, `horizontalRule`, `image`), allowed marks (`bold`, `italic`, `strike`, `code`, `link` with `http`/`https` `attrs.href`), attributes, and URLs before storage. Arbitrary HTML, scripts, event handlers, and unsupported embedded content are rejected (`400 VALIDATION_ERROR`).

**Image storage and URL validation:**

- **External URLs and Cloudinary-hosted URLs:** In `Post.content`, `image.attrs.src` must be a valid `http://` or `https://` URL. On the Express backend, `data:` Base64 URIs, `javascript:` URIs, and relative paths are **rejected** (`400 VALIDATION_ERROR`). *(The frontend's `data:image/*` helper is an offline mock-mode fallback only.)*
- **Dedicated upload endpoint (`POST /api/uploads/image`):** Authenticated users upload image files via `multipart/form-data` (field `image`) rather than embedding Base64 payloads inside `POST /api/posts`.
  - Allowed MIME types and magic-byte verified formats: `image/png`, `image/jpeg`, `image/webp`, `image/gif`. SVG (`image/svg+xml`) and non-image files are strictly rejected to prevent stored XSS.
  - Server-side file size cap: **5 MB** per uploaded file (compatible with client pre-resize optimization in `imageUpload.js`).
  - Uploaded files are streamed directly to **Cloudinary** (folder `folio/posts/`), never written permanently to Express server disk or MongoDB, and the endpoint returns `{ url, publicId, width, height }` with a `https://` URL.
- **Express JSON limit:** `express.json()` retains a small JSON body limit (e.g., `100kb`–`256kb`), preventing large payload DoS on JSON routes since image binaries never pass through JSON endpoints.

## 11. JWT Expiration and Refresh

- Access tokens expire after 15 minutes.
- Refresh tokens are longer-lived and stored server-side, persisted as their own records (see `database.md`'s `RefreshToken` collection) — not embedded as a single field on `User` — so that multiple sessions/devices can be issued and revoked independently.
- Refresh tokens are stored hashed, never in plaintext, matching the treatment of passwords.
- A new access token is obtained via `POST /auth/refresh` (see `api.md` §4), which validates the presented refresh token against its stored hash and issues a new access token. An expired or revoked refresh token is rejected and requires re-login.
- Logout revokes the presented refresh token (marks it revoked in storage) and removes authentication tokens from the client.
- Expired or invalid tokens are rejected.

## 12. Rate Limiting

- Apply strict rate limiting (e.g., per-IP / per-account) to `POST /auth/login`, `POST /auth/register`, and `POST /uploads/image` to mitigate brute-force, account-enumeration, and Cloudinary upload-quota abuse.
- General `/api/` rate limits must preserve sufficient burst headroom for normal SPA navigation and `NotificationsContext.markAllRead` (which currently issues parallel `PATCH /notifications/:id/read` requests).

## 13. CORS

The API configures CORS to allow only the explicit frontend origin(s) from `CORS_ORIGIN` — never a wildcard (`*`).

Because Folio uses **header-based Bearer JWT transport** (`Authorization: Bearer <token>`, without cookie credentials):

- Standard CORS with an explicit `origin` allowlist is used; `credentials: true` is **not** required (and if `credentials` is disabled, `realApi.js` works cleanly with `CORS_ORIGIN` configured).
- If `CORS_ORIGIN` is unset, `app.js` fails closed (`origin: false`), so `CORS_ORIGIN` must be defined in `.env` for local and deployed environments.

## 14. Real-Time Socket.IO Security

- **Handshake authentication:** Every Socket.IO connection must supply a valid JWT access token in `socket.handshake.auth.token`. The server verifies the signature/expiry using `JWT_ACCESS_SECRET` and loads the user from MongoDB; missing, invalid, expired (`UNAUTHENTICATED`), or suspended (`ACCOUNT_SUSPENDED`) users are rejected before `connection` fires. Client-supplied user IDs are never trusted.
- **Room isolation:** On connection, the socket is automatically joined only to `user:<authenticatedUserId>`. Clients can join `post:<postId>` rooms only through the `post:join` event after the server validates the ObjectId and confirms the post has `status === 'published'` (drafts cannot be joined).
- **CORS:** Socket.IO restricts `cors.origin` to `CORS_ORIGIN` (failing closed when unset), matching Express.
- **Token expiry handling:** When a client receives a `connect_error` with `UNAUTHENTICATED`, it refreshes the access token once via `POST /api/auth/refresh` and reconnects without looping.
