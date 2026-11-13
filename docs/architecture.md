# Architecture — Student Blogging and Discussion Platform

## 1. Architecture Overview

The Student Blogging and Discussion Platform is a web application built around three core capabilities:

- **Create** — students create, edit, save, and publish blog posts.
- **Discover** — users browse, search, and filter published content.
- **Discuss** — users comment on posts and reply one level deep.

The architecture uses a conventional client-server model:

```text
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                        │
│                  React.js + Tailwind CSS                    │
│                                                             │
│  Student UI                         Admin UI                │
│  ├─ Home / Feed                     ├─ Dashboard            │
│  ├─ Explore / Search                ├─ Users                │
│  ├─ Blog Post                        ├─ Content Moderation   │
│  ├─ Create / Edit Blog              └─ Categories           │
│  ├─ My Posts / Profile                                        │
│  ├─ Saved Posts                                               │
│  └─ Notifications                                             │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Application Layer                     │
│                       Node.js + Express                     │
│                                                             │
│  Routes → Controllers → Services → Data Access              │
│                           │                                 │
│        ┌──────────────────┼──────────────────┐              │
│        │                  │                  │              │
│   Auth / RBAC        Content & Search    Moderation         │
│   Notifications      Bookmarks           Categories         │
│   Comments / Replies                                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         Data Layer                           │
│                      MongoDB + Mongoose                     │
│                                                             │
│ User · Post · Category · Comment · Bookmark                 │
│ Notification · Report · RefreshToken                        │
└─────────────────────────────────────────────────────────────┘

Supporting Infrastructure
├─ Docker + Docker Compose
├─ Git + GitHub
├─ GitHub Actions
└─ Postman
```

The architecture intentionally stays simple enough for the current product scope. Features that are not defined as product requirements—such as recommendations, private messaging, likes, following, or multi-level discussions—are not introduced as architectural dependencies. Real-time notifications and live post comments are layered on top of the REST API via **Socket.IO** attached to the HTTP server in `server.js` (REST endpoints remain the source of truth for initial loads and persistence). Uploaded post images are streamed to Cloudinary (`POST /api/uploads/image`) so MongoDB and Express avoid storing binary files.

---

## 2. Architectural Goals

The system should:

1. Keep student and administrator experiences clearly separated while using the same backend.
2. Enforce authentication and role-based authorization centrally.
3. Keep business logic independent from HTTP route handlers.
4. Persist the product's core entities in MongoDB.
5. Support drafts and published posts without requiring separate content systems.
6. Support one-level comment replies without creating arbitrarily deep threads.
7. Provide bookmark, notification, reporting, and moderation workflows.
8. Return notifications through normal page-load/fetch requests and push live updates (`notification:new`, `comment:new`) over authenticated Socket.IO connections.
9. Remain containerizable and straightforward to deploy through CI/CD.
10. Allow unresolved implementation choices to be changed without restructuring the entire application.

---

## 3. System Components

### 3.1 React Client

The frontend is a React.js single-page application styled with Tailwind CSS.

Responsibilities:

- Render student and admin views.
- Manage forms and local UI state.
- Call REST APIs.
- Store and expose authenticated-user state.
- Display authorization-sensitive actions.
- Handle loading, empty, validation, and error states.
- Render comments and one-level replies.
- Fetch notifications when the relevant page/application state is loaded.

The frontend must not be treated as the final security boundary. Permissions are enforced again by the backend.

### 3.2 State Management

The frontend uses **React Context API** (`AuthContext`, `NotificationsContext`) as its client state layer, avoiding Redux overhead for Folio's scope.

Suggested separation:

```text
Client State
├─ Authentication / current user
├─ Notification state
├─ Application/UI state
└─ Page-local state
```

Server-owned data such as posts, comments, saved posts, and admin tables should be fetched from the API rather than duplicated unnecessarily in global client state.

### 3.3 Express REST API

Node.js + Express.js provides the application/API layer.

Responsibilities:

- Authentication (including access/refresh token issuance and revocation).
- Authorization.
- Validation.
- CRUD operations.
- Content discovery.
- Comment and reply handling.
- Bookmark management.
- Notification generation/retrieval.
- Reporting and moderation.
- Category management.
- Basic activity statistics.

The API should expose resource-oriented endpoints and return consistent JSON responses.

### 3.4 Service Layer

Business rules should live in services rather than directly in route handlers.

Example service modules:

```text
AuthService
UserService
PostService
UploadService
CategoryService
CommentService
BookmarkService
NotificationService
ReportService
AdminService
```

This separation makes rules such as "a user may edit only their own post" independent of the HTTP transport.

### 3.5 Data Access Layer

Mongoose models provide access to MongoDB.

Each core product entity gets a corresponding model, plus a `RefreshToken` model that supports authentication:

```text
User
Post
Category
Comment
Bookmark
Notification
Report
RefreshToken
```

The data-access layer should handle model queries and persistence concerns while services handle application rules.

### 3.6 MongoDB

MongoDB is the primary persistent datastore.

It stores:

- User identities, profile information, credentials metadata, roles, and account status.
- Posts and their lifecycle state.
- Categories.
- Comments and optional parent-comment references.
- User/post bookmarks.
- Notifications.
- Reports and moderation status.
- Hashed refresh tokens (per session/device) supporting authentication.

The physical schema should remain consistent with the current product model while allowing implementation-level indexing and validation to be refined later.

---

## 4. Request Flow

A normal authenticated request follows this path:

```text
React Component
      │
      ▼
API Client
      │
      ▼
Express Route
      │
      ├── Authentication Middleware        (401 if missing/invalid token)
      │
      ├── Request Validation                (400 if invalid input/params)
      │
      ├── Role Authorization Middleware     (403 if wrong role)
      │
              ▼
          Controller
              │
              ▼
           Service
              │
              ├── Resource Ownership Check   (403 if not owner — runs here,
              │                               after the resource is fetched,
              │                               not as an earlier middleware)
              ▼
       Mongoose Model
              │
              ▼
           MongoDB
              │
              ▼
        Service Result
              │
              ▼
         Controller
              │
              ▼
       JSON Response
              │
              ▼
       React UI Update
```

Ownership checks are resource-specific and require fetching the record by a validated ID, so they run inside the service layer after request validation — not as an earlier, generic middleware step alongside the coarse-grained role check. Role checks (e.g., "must be admin") don't need a fetched resource and can run immediately after validation.

Controllers should remain thin: parse the request, invoke the relevant service, and format the response.

---

## 5. Authentication and Authorization

### 5.1 Authentication

The intended stack specifies:

- JWT (short-lived access token + server-side refresh token) for authentication.
- bcrypt for password hashing.
- Environment variables for secrets/configuration.
- Input validation.

The registration flow is:

```text
Registration
   │
   ├─ Validate input
   ├─ Check account constraints
   ├─ Hash password with bcrypt
   ├─ Create User
   └─ Return authentication result

Login
   │
   ├─ Validate input
   ├─ Locate User
   ├─ Verify password with bcrypt
   └─ Issue access token + refresh token
```

Passwords must never be stored in plaintext.

### 5.2 JWT Verification

Requests requiring authentication pass through JWT middleware:

```text
Request
  │
  ▼
Read JWT
  │
  ├─ Missing / invalid → 401 Unauthorized
  │
  ▼
Verify signature and claims
  │
  ▼
Attach authenticated user context
  │
  ▼
Continue to route
```

When the access token expires, the client calls `POST /auth/refresh` with its refresh token to obtain a new access token. The presented refresh token is checked against its stored hash (`RefreshToken` collection — see `database.md` §3); an expired or revoked refresh token is rejected and requires re-login. `POST /auth/logout` revokes the presented refresh token.

Token transport uses **header-based Bearer JWTs** (`Authorization: Bearer <accessToken>`, with refresh tokens sent in JSON bodies to `POST /auth/refresh` and `POST /auth/logout`), determining the non-cookie `CORS_ORIGIN` configuration in `security.md` §13. Suspended users (`status === 'suspended'`) are rejected during authentication middleware, login, and token refresh.

### 5.3 Role-Based Authorization

The current product defines at least two roles:

```text
student
admin
```

Authorization must be enforced server-side.

Examples:

```text
Student
├─ Create own posts
├─ Edit/delete own posts
├─ Comment/reply
├─ Bookmark posts
├─ Report content
└─ Manage own profile

Admin
├─ Manage users (role and account status)
├─ Moderate reports/content
├─ Manage categories
└─ Monitor platform activity
```

Ownership rules are separate from role rules. A student being authenticated does not automatically allow them to edit another student's post or comment.

---

## 6. Core Domain Model

The current product model defines seven core product entities, plus a `RefreshToken` collection that supports authentication but isn't a product-facing entity.

```text
User
 ├──────────────< Post
 ├──────────────< Comment
 ├──────────────< Bookmark >────────────── Post
 ├──────────────< Notification
 ├──────────────< Report
 └──────────────< RefreshToken

Category
 └──────────────< Post

Post
 ├──────────────< Comment
 ├──────────────< Bookmark
 ├──────────────< Notification
 └──────────────< Report            (via targetType/targetId)

Comment
 ├──────────────< Comment
 │     (parent comment, maximum one reply level)
 ├──────────────< Notification      (optional reference)
 └──────────────< Report            (via targetType/targetId)
```

### 6.1 User

Conceptual fields:

```text
User
├─ identity information
├─ credentials metadata
├─ profile information
├─ role
└─ status
```

`status` (`active` | `suspended`, default `active`) backs admin user management (`PATCH /admin/users/:id`).

### 6.2 Post

Conceptual fields:

```text
Post
├─ title
├─ content
├─ searchText
├─ author
├─ category (nullable on drafts)
├─ status
├─ created timestamp
└─ updated/published timestamp data
```

Allowed product states:

```text
draft
published
```

A draft is visible to its author (or an admin) according to the dashboard/editing workflow; published posts participate in public discovery.

`content` is structured TipTap editor JSON (storing external or Cloudinary `https://` image URLs only; see §7's Rich Content Flow and `database.md` §3). `searchText` stores server-extracted plain text for keyword search. Comment counts shown on dashboards and feeds are computed at read time via aggregation, not stored on `Post`.

### 6.3 Category

```text
Category
├─ name
└─ description
```

Categories are managed by administrators.

### 6.4 Comment

```text
Comment
├─ post
├─ author
├─ content
├─ timestamp
└─ parent comment (optional)
```

`parent comment = null` represents a direct comment.

A populated parent reference represents a reply.

The product permits one level of replies, so a reply must not itself become the parent of another reply.

### 6.5 Bookmark

A bookmark represents a user/post relationship:

```text
Bookmark
├─ user
└─ post
```

A uniqueness constraint should prevent the same user from bookmarking the same post more than once.

### 6.6 Notification

Conceptual fields:

```text
Notification
├─ recipient → User
├─ type
├─ message
├─ post → Post (serialized as postId)
├─ comment → Comment (optional)
├─ read state
└─ timestamp
```

Current notification types:

```text
comment
reply
```

Every `comment` and `reply` notification navigates directly to `/posts/:postId`, so `Notification` stores a direct `post` reference (`postId` in API responses) plus an optional `comment` reference rather than a polymorphic `targetType`/`targetId` sub-document (`database.md` §3).

Notifications are fetched/refreshed on page load or normal API fetch rather than delivered through required real-time push.

### 6.7 Report

Conceptual fields:

```text
Report
├─ reporter
├─ target
│   ├─ targetType  ('post' | 'comment')
│   └─ targetId
├─ reason
├─ moderation status
└─ timestamp
```

Report states:

```text
pending
resolved
dismissed
```

`target` is modeled as a `targetType` discriminator plus a single `targetId` (Mongoose `refPath`) rather than two separate optional reference fields — see `database.md` §3.

### 6.8 RefreshToken

Conceptual fields:

```text
RefreshToken
├─ user
├─ tokenHash
├─ expiresAt
├─ revoked
└─ created timestamp
```

Stored hashed, never in plaintext. A user may hold multiple `RefreshToken` records (one per active session/device), so logout on one device doesn't revoke sessions on others. See `security.md` §11.

---

## 7. Content Lifecycle

### 7.1 Post Creation

```text
Create Blog
    │
    ▼
Validate title/content/category
    │
    ├───────────────┐
    ▼               ▼
Save Draft       Publish
    │               │
    ▼               ▼
status=draft    status=published
```

### 7.2 Post Editing

The author accesses their own post through My Posts.

```text
My Posts
   │
   ▼
Select Post
   │
   ▼
Ownership Check
   │
   ▼
Edit
   │
   ├─ Save Draft
   └─ Update / Publish
```

The backend must enforce ownership rather than relying on the UI to hide unauthorized edit controls.

### 7.3 Deletion and Cascade Rules

```text
Delete Post
    │
    ▼
Ownership Check
    │
    ▼
Cascade delete: Comments (incl. replies), Bookmarks, Notifications, Reports targeting this Post/Comments
    │
    ▼
Delete Post

Delete top-level Comment
    │
    ▼
Ownership Check
    │
    ▼
Cascade delete: its one-level Replies & Reports targeting them
    │
    ▼
Delete Comment
```

When a post or comment is removed via admin moderation (`PATCH /admin/reports/:id` with `action: "resolve"`), the cascade removes the target content and other reports targeting it while updating and retaining that resolved `Report` record (`status: "resolved"`) for moderation history. Deleting a `Category` is blocked with `409 CONFLICT` if any `Post` references it.

`User` deletion behavior for their authored content is not defined by current product decisions; account suspension via `User.status` is in scope, but hard deletion of a user (and cascading their posts/comments) is out of scope until a product decision is made (see `database.md` §7).

### Rich Content Flow

The rich-text editor produces structured TipTap JSON content. Image uploads from the user's device go to `POST /api/uploads/image` (validated for MIME/magic bytes and 5 MB limit, then stored on Cloudinary), returning an `https://` URL inserted into the editor's `image` node. On `POST /posts` and `PATCH /posts/:id`, the API validates the TipTap node/mark schema — ensuring `image.attrs.src` uses `http://` or `https://` only (`data:` URIs rejected on the backend; `security.md` §10) — and extracts `searchText` before storing in MongoDB. The reader view (`PostContent.jsx`) renders the validated document safely without `dangerouslySetInnerHTML`.

---

## 8. Discovery and Search

The discovery flow is:

```text
Home
  │
  ▼
Explore / Search
  │
  ├─ keyword search
  ├─ category filter
  └─ sorting
  │
  ▼
Published Post Results
  │
  ▼
Individual Blog Post
```

Only content appropriate for discovery should be returned by public/student-facing published-content queries. Browsing and reading published posts is public (no authentication required); everything else in the product requires authentication — see `api.md` §5.

The current requirements specify keyword search, category filtering, sorting, and recent/related content. They do not define a sophisticated recommendation engine.

Therefore:

- Use database-backed queries for the initial implementation.
- Do not introduce machine-learning recommendations.
- Treat "related" or "recent" content as query behavior unless a later product decision defines a recommendation system.

---

## 9. Comment and Reply Architecture

Comments use a self-reference:

```text
Comment
└─ parentCommentId: null | Comment ID
```

Allowed structure:

```text
Post
├─ Comment A
│  ├─ Reply A1
│  └─ Reply A2
├─ Comment B
│  └─ Reply B1
└─ Comment C
```

Not allowed:

```text
Comment
└─ Reply
   └─ Reply to Reply
```

The service layer should reject a reply when the specified parent comment is itself already a reply.

On reply creation (`POST /comments/:id/replies`), the reply's `post` reference is derived server-side from the parent comment's `post` field — never taken from client input — so a reply cannot be attached to the wrong post.

---

## 10. Bookmark Architecture

Bookmarking is modeled as a separate relationship rather than embedding saved-post arrays into the post itself.

Flow:

```text
Blog Post
   │
   ▼
Bookmark action
   │
   ▼
BookmarkService
   │
   ├─ verify user
   ├─ verify post
   ├─ prevent duplicate relationship
   └─ create Bookmark
```

Saved Posts then query bookmarks for the authenticated user and retrieve the associated posts.

This makes the user-centric "Saved Posts" view straightforward and avoids modifying the main post document for every bookmark action.

---

## 11. Notification & Real-Time Architecture

*(Updated by explicit product decision: Socket.IO is enabled as an enhancement on top of the REST API.)*

### Hybrid REST + Socket.IO flow

```text
Comment / Reply Event
        │
        ├─► Persist Comment & Notification in MongoDB
        │
        ├─► Emit comment:new       ──► room post:<postId> (published posts)
        │
        └─► Emit notification:new  ──► room user:<recipientId> (never to actor)

User opens / refreshes Notifications
        │
        ▼
GET /api/notifications (source of truth on load)
```

Socket.IO is attached to the HTTP server in `src/server.js` via `src/realtime/index.js`, with CORS restricted to `CORS_ORIGIN`. Services emit events through `src/realtime/index.js` without importing `socket.io` directly, and real-time emit errors never fail REST requests. In mock mode (`VITE_USE_MOCK=true`), the client skips opening a socket.

---

## 12. Reporting and Moderation

The moderation flow is:

```text
Student
   │
   ▼
Report Post / Comment
   │
   ├─ reason
   └─ target
   │
   ▼
Create Report(status=pending)
   │
   ▼
Admin Dashboard
   │
   ▼
Review Report
   │
   ├─ Dismiss
   │      └─ status=dismissed
   │
   └─ Moderate Content
          ├─ remove content
          └─ status=resolved
```

The backend must verify that:

- The report target exists.
- The target is a reportable post/comment.
- The report reason is valid/non-empty.
- Admin-only moderation operations are protected by role authorization.

---

## 13. API Architecture

The API is RESTful, mounted under `/api` (full endpoint specifications and JSON schemas live in `api.md`).

Endpoint groups:

```text
/auth
/users
/categories
/uploads
/posts
/comments
/bookmarks
/notifications
/reports
/admin
```

Endpoints:

```text
Authentication
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

Users & Profiles
GET    /users/me
PATCH  /users/me
GET    /users/:id

Categories
GET    /categories

Image Uploads
POST   /uploads/image

Posts
GET    /posts                 (supports q, category, authorId, sort, limit, mine=true)
GET    /posts/:id
POST   /posts
PATCH  /posts/:id
DELETE /posts/:id

Comments
GET    /posts/:postId/comments
POST   /posts/:postId/comments
PATCH  /comments/:id
DELETE /comments/:id
POST   /comments/:id/replies

Bookmarks
POST   /posts/:postId/bookmark
DELETE /posts/:postId/bookmark
GET    /bookmarks

Notifications
GET    /notifications
PATCH  /notifications/:id/read

Reports
POST   /reports

Admin
GET    /admin/stats
GET    /admin/users
PATCH  /admin/users/:id
GET    /admin/reports
PATCH  /admin/reports/:id
POST   /admin/categories
PATCH  /admin/categories/:id
DELETE /admin/categories/:id
```

---

## 14. Validation and Error Handling

Validation uses **Zod** schemas at the API boundary, after authentication (where required) and before ownership checks or business logic execute — consistent with §4's request flow and `api.md` §2.

```text
Request
  │
  ▼
Authentication
  │
  ├─ unauthenticated → 401
  │
  ▼
Schema / Input Validation
  │
  ├─ invalid → 400 Bad Request
  │
  ▼
Role Authorization
  │
  ├─ forbidden → 403
  │
  ▼
Service Logic
  │
  ├─ ownership check → 403 (resource-specific, post-fetch)
  ├─ missing resource → 404
  ├─ conflict → 409
  └─ unexpected error → 500
```

The API should use a consistent error shape so the React client can display errors predictably.

Example:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Post not found."
  }
}
```

The error envelope and standard error codes (`VALIDATION_ERROR`, `REPLY_TO_REPLY`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `ACCOUNT_SUSPENDED`, `RESOURCE_NOT_FOUND`, `EMAIL_TAKEN`, `CONFLICT`) are specified in `api.md` §3.

---

## 15. Security Architecture

The supplied product stack specifies:

- JWT (access + refresh).
- bcrypt.
- Environment variables.
- Input validation.
- Role-based authorization.
- Rate limiting on authentication endpoints.
- Explicit CORS configuration.

Security responsibilities should be layered:

```text
Client
  │
  ▼
HTTPS
  │
  ▼
CORS
  │
  ▼
API Validation
  │
  ▼
JWT Authentication
  │
  ▼
Role / Ownership Authorization
  │
  ▼
Service-level business rules
  │
  ▼
Mongoose validation / database constraints
```

Important rules:

- Never trust client-supplied role information.
- Never authorize ownership operations solely in React.
- Never store plaintext passwords or plaintext refresh tokens.
- Never commit JWT secrets/database credentials to Git.
- Validate and sanitize user-controlled input appropriate to the application.
- Avoid returning credential, password-hash, or refresh-token data in user-facing API responses.
- Rate-limit `/auth/login` and `/auth/register`.

The exact deployment-specific security controls are not defined in the current source material and should be finalized with the deployment configuration.

---

## 16. Database Design Considerations

The current product model is intentionally logical rather than a finalized physical schema.

Potential indexes should be chosen around actual query paths, especially:

```text
Post
├─ author
├─ category
├─ status
├─ publishedAt / updatedAt
└─ title + searchText

Comment
├─ post
└─ parentComment

Bookmark
├─ user
└─ unique(user, post)

Notification
├─ recipient
├─ post
├─ read state
└─ createdAt

Report
├─ status
├─ target (targetType + targetId)
└─ createdAt

RefreshToken
├─ user
├─ tokenHash
└─ expiresAt (TTL index candidate)
```

For search, the backend maintains `Post.searchText` (plain text extracted from `Post.content` JSON on write) and queries `title` + `searchText` directly in MongoDB without an external search service (`database.md` §6).

---

## 17. Suggested Backend Structure

A feature-oriented structure keeps domain logic organized:

```text
server/
├─ src/
│  ├─ config/
│  │  └─ database.js
│  │
│  ├─ middleware/
│  │  ├─ auth.js
│  │  ├─ authorize.js
│  │  ├─ validate.js
│  │  └─ errorHandler.js
│  │
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ auth.controller.js
│  │  │  ├─ auth.routes.js
│  │  │  └─ auth.service.js
│  │  │
│  │  ├─ users/
│  │  ├─ posts/
│  │  ├─ categories/
│  │  ├─ comments/
│  │  ├─ bookmarks/
│  │  ├─ notifications/
│  │  └─ reports/
│  │
│  ├─ models/
│  │  ├─ User.js
│  │  ├─ Post.js
│  │  ├─ Category.js
│  │  ├─ Comment.js
│  │  ├─ Bookmark.js
│  │  ├─ Notification.js
│  │  ├─ Report.js
│  │  └─ RefreshToken.js
│  │
│  ├─ routes/
│  │  └─ index.js
│  │
│  ├─ app.js
│  └─ server.js
│
├─ tests/
├─ Dockerfile
└─ package.json
```

The exact organization is an implementation recommendation rather than a product requirement.

---

## 18. Suggested Frontend Structure

```text
client/
├─ src/
│  ├─ components/
│  │  ├─ common/
│  │  ├─ posts/
│  │  ├─ comments/
│  │  └─ admin/
│  │
│  ├─ pages/
│  │  ├─ auth/
│  │  ├─ student/
│  │  └─ admin/
│  │
│  ├─ hooks/
│  ├─ services/
│  │  └─ api/
│  ├─ state/
│  ├─ layouts/
│  ├─ routes/
│  ├─ utils/
│  └─ App.jsx
│
├─ Dockerfile
└─ package.json
```

The frontend should organize reusable visual components separately from page-level composition.

---

## 19. Deployment Architecture

The supplied implementation constraints specify Docker + Docker Compose and CI/CD through GitHub Actions, with a deployment target such as Render or Vercel not yet finalized.

A deployment-agnostic conceptual setup is:

```text
                    Internet
                       │
             HTTPS / Web Application
                       │
              ┌────────┴────────┐
              │                 │
          React App         Express API
              │                 │
              │                 │
              └────────┬────────┘
                       │
                    MongoDB
```

During local development:

```text
Docker Compose
├─ frontend container
├─ backend container
└─ database dependency/configuration
```

The precise production topology depends on the final deployment provider and whether MongoDB is hosted separately. Those details are not specified by the current product/design sources.

---

## 20. CI/CD Architecture

The intended workflow uses GitHub Actions.

```text
Developer
   │
   ▼
Git commit / pull request
   │
   ▼
GitHub
   │
   ▼
GitHub Actions
   │
   ├─ install dependencies
   ├─ lint / checks
   ├─ run tests
   └─ build
   │
   ▼
Deployment target
```

Deployment configuration, environment variables, and secrets should be managed outside source control.

---

## 21. Containerization

Docker should provide consistent development and deployment environments.

Local architecture:

```text
docker-compose.yml
├─ frontend
│  └─ React.js + Tailwind CSS
│
├─ backend
│  └─ Node.js + Express.js
│
└─ database / database configuration
   └─ MongoDB
```

The production deployment does not necessarily need to mirror the local Docker Compose topology exactly.

---

## 22. Admin Architecture

The admin interface uses a dedicated layout but shares the backend and authentication system.

```text
Admin Login
    │
    ▼
JWT Authentication
    │
    ▼
Admin Authorization
    │
    ▼
Admin Layout
    ├─ Dashboard
    ├─ Users            (role and account-status management)
    ├─ Content Moderation
    └─ Categories
```

Every admin operation must be authorized by the backend.

The wireframe mentions Settings and some additional administrative details, but the current product requirements specifically define dashboard, user management, moderation, and category management as the core admin functionality.

---

## 23. Observability and Operational Concerns

The current product documentation does not define a full observability stack.

For the initial implementation, the application should at minimum produce structured server logs for:

- Authentication failures.
- Authorization failures.
- Validation failures where useful.
- Important moderation actions.
- Unexpected server errors.

A dedicated metrics, tracing, or centralized logging platform is not part of the current specified scope.

---

## 24. Architecture Principles

### Separation of concerns

```text
UI → API → Business Logic → Persistence
```

Each layer should have a clear responsibility.

### Server-side enforcement

The client may hide unavailable actions, but the server remains authoritative for permissions.

### Minimal product surface

Architecture should support the defined product instead of creating dependencies for unspecified features.

### Replaceable infrastructure

Infrastructure choices such as image hosting (Cloudinary), deployment target, and physical index tuning should be isolated so they do not affect core domain logic.

### Explicit domain rules

Rules such as post ownership, valid post states, one-level replies, report states, notification types, and deletion cascade behavior should be represented in services/models rather than relying only on frontend behavior.

---

## 25. Architectural Decisions Status

Decisions previously left open and now settled vs. remaining deferred choices:

| Decision | Status & Resolution |
|---|---|
| Frontend state management | **Resolved:** React Context API (`AuthContext`, `NotificationsContext`) |
| JWT transport & CORS | **Resolved:** Header-based `Authorization: Bearer <accessToken>` + refresh token in JSON body; explicit `CORS_ORIGIN` allowlist (`security.md` §3, §13) |
| Validation strategy | **Resolved:** Zod schema validation + TipTap JSON/URL validation (`api.md` §2, `security.md` §10) |
| Exact API contract | **Resolved:** Full endpoint routes and JSON shapes defined in `api.md` §4 |
| Image storage | **Resolved:** Cloudinary upload via `POST /api/uploads/image`; `http(s)` URLs only in `Post.content` (`security.md` §10) |
| Search implementation | **Resolved:** Server-derived `Post.searchText` queried in MongoDB (`database.md` §6) |
| Pagination (v1) | **Resolved for v1:** Unwrapped array responses (`GET /posts` supports `limit`); cursor/page pagination deferred unless scale requires it |
| Deployment target | **Open:** Render vs Vercel (or equivalent) not finalized |
| Physical database indexes | **Open (non-blocking):** Logical query paths defined in `database.md` §5; exact compound/text index tuning left to implementation |
| Orphaned Cloudinary assets | **Open (deferred):** Periodic cleanup of images from deleted posts or abandoned drafts is not in v1 scope |

Remaining open items can be resolved during implementation or deployment without changing the core product scope.

---

## 26. End-to-End Core Flows

### Student content loop

```text
Register
  ↓
Login
  ↓
Home / Explore
  ↓
Search / Filter
  ↓
Read Post
  ↓
Comment / Reply
  ↓
Bookmark
  ↓
Saved Posts
```

### Student authoring loop

```text
My Posts
  ↓
Create Blog
  ↓
Save Draft
  ↓
Edit
  ↓
Publish
  ↓
Manage Published Post
```

### Moderation loop

```text
User reports content
        ↓
Report created
        ↓
Admin reviews
        ↓
Dismiss OR remove/moderate
        ↓
Report state updated
```

### Notification loop

```text
Comment / Reply created
        ↓
Notification stored
        ↓
User loads/fetches notifications
        ↓
Notification displayed
        ↓
User marks as read
```

---

## 27. Design-System Relationship

The architecture is independent of the visual theme, but the frontend implementation should consume the supplied design system rather than hard-code presentation decisions into domain logic.

The design system defines an atmospheric, tactile visual language built around forest-inspired tones, editorial typography, tonal layers, soft shapes, and restrained elevation. The architecture should therefore expose reusable UI components and layouts that can implement those tokens consistently.

The design system specifies:

- **Playfair Display** for display/headline storytelling.
- **Inter** for functional UI and body text.
- A 4px spacing base.
- 32px desktop gutter and 20px mobile margins.
- A 720px reading width for focused narrative content.
- Tonal layering instead of heavy shadows.
- Soft corner radii and tactile buttons/cards.
- Paper-grain and botanical accents as visual treatments.
- A structured rich-text editor whose image nodes support external `http(s)` URLs or uploaded images stored via Cloudinary (`POST /api/uploads/image`).

These are presentation concerns and should remain in the client/design system layer rather than becoming backend dependencies.

---

## 28. Scope Boundary

The architecture explicitly does **not** require:

- Private messaging.
- User following.
- Likes/reactions as a core feature.
- Advanced recommendation algorithms.
- Multi-level threaded discussions.
- A separate microservice for each domain.
- A dedicated search service.
- Machine-learning infrastructure.
- Local-disk or MongoDB-stored binary image files (uploaded images are hosted on Cloudinary and referenced by HTTPS URL).

Such capabilities can be introduced later only through new product decisions.

---

## 29. Summary

The recommended architecture is a modular monolith:

```text
React + Tailwind (Context API)
       │
       │ REST + Bearer JWT
       ▼
Node.js + Express (Zod validation)
       │
       ├─ Authentication / RBAC (access + refresh tokens)
       ├─ Users
       ├─ Categories
       ├─ Image Uploads → Cloudinary
       ├─ Posts
       ├─ Comments
       ├─ Bookmarks
       ├─ Notifications
       └─ Reports / Moderation
       │
       ▼
MongoDB + Mongoose
```

This structure settles the API contract, Bearer JWT transport, Cloudinary image upload flow, notification schema, and validation strategy while leaving deployment provider and physical index tuning cleanly decoupled. It is substantially simpler than a microservice architecture and is appropriate for the current feature set and supplied implementation constraints.
