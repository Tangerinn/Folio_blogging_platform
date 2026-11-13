# AI Context — Student Blogging and Discussion Platform

## Project

A student-focused web platform for **publishing, discovering, and discussing** academic/practical content.

## Core Loop

```text
Create → Discover → Discuss
```

Students can register/login, manage profiles, create/edit/delete/draft/publish posts, browse/search/filter content, read posts, bookmark posts, comment/reply one level deep, report content, and view notifications.

Admins manage users, categories, reports/content moderation, and basic platform activity.

## Current Stack

```text
Frontend   React.js + Tailwind CSS (React Context API)
Backend    Node.js + Express.js (Zod validation)
Database   MongoDB + Mongoose
Auth       JWT Bearer (access + refresh) + bcrypt
Media      Cloudinary (post image uploads; URLs stored in Post content)
Infra      Docker + Docker Compose
CI/CD      GitHub Actions
API        REST
```

Deployment target remains open. JWT transport is settled on `Authorization: Bearer` headers + refresh tokens in request bodies, and keyword search uses a server-maintained `searchText` field in MongoDB. The physical DB schema is settled at the logical level (see `database.md`); exact physical indexes remain open.

## Core Entities

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

Post states: `draft`, `published`.

Notification types: `comment`, `reply`.

Report states: `pending`, `resolved`, `dismissed`.

Comments support **one reply level only**.

## Architecture

```text
React client
   ↓ REST
Express API
   ↓
Controllers → Services → Mongoose
   ↓
MongoDB
```

Authentication, authorization, validation, and ownership checks happen server-side.

## Scope Boundary

Do **not** assume these are required:

- private messaging
- following users
- likes/reactions as core functionality
- advanced recommendation algorithms
- multi-level comments
- real-time notifications (Socket.IO/WebSockets are not part of the stack)
- separate microservices
- dedicated search infrastructure
- local/MongoDB binary file storage (device image uploads go through `POST /api/uploads/image` to Cloudinary, and `Post.content` stores HTTPS URLs only)

Wireframe-only ideas such as tags, featured images, trending discussions, popular tags, and some navigation concepts are not mandatory unless product scope is updated.

## Design Context

The frontend uses the supplied "Sylvan Folio" direction: warm parchment/forest tones, Playfair Display for headlines, Inter for UI/body, tonal depth instead of heavy shadows, soft shapes, and restrained botanical/paper-grain accents.

## AI Rules

When changing the system:

1. Preserve current product scope unless explicitly told otherwise.
2. Treat `product.md` as the source of product requirements.
3. Treat `architecture.md` as the source of system structure.
4. Treat `database.md`, `api.md`, `security.md`, and `development.md` as implementation guidance derived from those sources.
5. Do not silently turn TBD/open decisions into fixed requirements.
6. Do not invent functionality because it appears plausible in a modern app.
7. Keep one-level comment nesting.
8. Enforce authorization on the backend, not only in the frontend.
