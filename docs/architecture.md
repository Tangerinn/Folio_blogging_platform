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

The architecture intentionally stays simple enough for the current product scope. Features that are not defined as product requirements—such as recommendations, private messaging, likes, following, multi-level discussions, real-time delivery, or image file upload—are not introduced as architectural dependencies.

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
8. Return notifications through normal page-load/fetch requests in the current scope.
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

The supplied product material leaves the choice between:

- Redux Toolkit
- React Context API

unresolved.

The architecture therefore uses a generic **client state layer** rather than coupling the design to one library.

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

The exact token transport mechanism (header vs. cookie) is an implementation decision and is not specified by the current product material; it also determines the CORS configuration (see `security.md` §13).

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
 └──────────────< Report            (via targetType/targetId)

Comment
 ├──────────────< Comment
 │     (parent comment, maximum one reply level)
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
├─ author
├─ category
├─ status
├─ created timestamp
└─ updated/published timestamp data
```

Allowed product states:

```text
draft
published
```

A draft is visible to its author according to the dashboard/editing workflow; published posts participate in public discovery.

`content` is structured editor JSON (see §7's Rich Content Flow and `database.md` §3). Comment counts shown on dashboards are computed at read time, not stored on `Post`.

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
├─ recipient
├─ type
├─ target
│   ├─ targetType  ('post' | 'comment')
│   └─ targetId
├─ read state
└─ timestamp
```

Current notification types:

```text
comment
reply
```

`target` uses the same `targetType`/`targetId` pattern as `Report` (§6.7), since a notification can point at either a post or a comment.

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
Cascade delete: Comments (incl. replies), Bookmarks, Reports targeting this Post
    │
    ▼
Delete Post

Delete top-level Comment
    │
    ▼
Ownership Check
    │
    ▼
Cascade delete: its one-level Replies
    │
    ▼
Delete Comment
```

`User` deletion behavior for their authored content is not defined by current product decisions; account suspension via `User.status` is in scope, but hard deletion of a user (and cascading their posts/comments) is out of scope until a product decision is made (see `database.md` §7).

### Rich Content Flow

The rich-text editor produces structured JSON content. The API validates the content — including that image nodes reference only external URLs, never uploaded files (see `security.md` §10) — before storing it in MongoDB. The reader view renders the validated document into the corresponding visual content.

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

## 11. Notification Architecture

The current product intentionally does not require real-time push notifications.

### Current architecture

```text
Comment / Reply Event
        │
        ▼
Create Notification document
        │
        ▼
MongoDB
        │
        │
User opens / refreshes Notifications
        ▼
GET notifications
        │
        ▼
React renders notification list
```

Example:

```text
Student A comments on Student B's post
            │
            ▼
NotificationService
            │
            ▼
Notification(recipient=Student B, type=comment)
```

Socket.IO/WebSockets are **not part of the current implementation stack**. Real-time delivery is out of scope and would require a new product decision to introduce.

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

The API is RESTful. Exact endpoint naming can be finalized during implementation, but the resource structure should follow the product model.

Illustrative endpoint groups:

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

Representative operations:

```text
Authentication
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

Posts
GET    /posts
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

These endpoint names are architectural examples, not additional product requirements.

---

## 14. Validation and Error Handling

Validation should occur at the API boundary, after authentication but before ownership checks or business logic execute — consistent with §4's request flow.

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
    "message": "Post not found"
  }
}
```

The exact error contract can be finalized during implementation.

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
└─ timestamps

Comment
├─ post
└─ parentComment

Bookmark
├─ user
└─ unique(user, post)

Notification
├─ recipient
├─ read state
└─ timestamp

Report
├─ status
├─ target (targetType + targetId)
└─ timestamp

RefreshToken
├─ user
├─ tokenHash
└─ expiresAt (TTL index candidate)
```

For search, the implementation should use the search capabilities appropriate to the chosen MongoDB configuration. The current product source does not prescribe a particular search-index strategy.

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

Unresolved choices such as state management and deployment should be isolated so they do not affect core domain logic.

### Explicit domain rules

Rules such as post ownership, valid post states, one-level replies, report states, notification types, and deletion cascade behavior should be represented in services/models rather than relying only on frontend behavior.

---

## 25. Open Architectural Decisions

The source material explicitly leaves several implementation decisions unresolved:

| Decision | Current options / status |
|---|---|
| Frontend state management | Redux Toolkit vs React Context API |
| Deployment | Render vs Vercel not finalized |
| Physical database indexes | Logical model exists and is settled; physical indexes need refinement |
| Search implementation | Keyword search is required; exact database search/index strategy is not specified |
| JWT transport | Access/refresh token issuance and expiry are specified (see `security.md` §11); header vs. cookie transport is not, and determines the CORS configuration |
| Exact API contract | REST is specified; endpoint naming and response schemas remain implementation decisions |

These should be resolved during implementation without changing the core product scope unless a new product decision is made.

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
- A structured rich-text editor whose image nodes reference external URLs only (no upload UI).

These are presentation concerns and should remain in the client/design system layer rather than becoming backend dependencies.

---

## 28. Scope Boundary

The architecture explicitly does **not** require:

- Private messaging.
- User following.
- Likes/reactions as a core feature.
- Advanced recommendation algorithms.
- Multi-level threaded discussions.
- Real-time notifications as a required product behavior (Socket.IO/WebSockets are not part of the stack).
- A separate microservice for each domain.
- A dedicated search service.
- Machine-learning infrastructure.
- Image file upload/hosting infrastructure (images are external-URL references only).

Such capabilities can be introduced later only through new product decisions.

---

## 29. Summary

The recommended architecture is a modular monolith:

```text
React + Tailwind
       │
       │ REST
       ▼
Node.js + Express
       │
       ├─ Authentication / RBAC (access + refresh tokens)
       ├─ Users
       ├─ Posts
       ├─ Categories
       ├─ Comments
       ├─ Bookmarks
       ├─ Notifications
       └─ Reports / Moderation
       │
       ▼
MongoDB + Mongoose
```

This structure matches the current product scope while leaving state management, deployment, JWT transport, and physical database index details intentionally open. It is substantially simpler than a microservice architecture and is appropriate for the current feature set and supplied implementation constraints.
