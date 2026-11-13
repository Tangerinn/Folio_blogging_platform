# Product — Student Blogging and Discussion Platform

> **Document scope:** This file owns *what* the product does and *why* — user needs, user-visible behavior, scope boundaries, and success criteria. It does not own *how* the system is built. Where a requirement depends on a technical decision, this doc names the owning file/section rather than restating the decision — so that decision has exactly one home and can't drift out of sync with itself. See `architecture.md`, `database.md`, `api.md`, `security.md`, `DESIGN.md`, and `development.md` for the "how."

## 1. Product Overview

The **Student Blogging and Discussion Platform** is a student-focused web application for publishing, discovering, and discussing academic and practical content. It brings structured blogging and post-based discussion into a single environment instead of relying on general-purpose messaging groups, social networks, forums, or scattered documents.

The product supports three core activities:

1. **Create** — students write, save, edit, and publish blog posts.
2. **Discover** — users browse, search, and filter published content.
3. **Discuss** — users comment on posts and reply to comments in one-level threads.

A lightweight moderation workflow allows administrators to manage users, categories, posts/comments, and reported content.

## 2. Problem

Students frequently have useful academic knowledge, project experiences, tutorials, opinions, and practical insights, but this material is often distributed across general-purpose platforms or documents. These channels are not specifically organized around student-oriented publishing and discussion.

The product addresses this by providing a dedicated space for structured student content, content discovery, and discussion.

## 3. Target Users

### Student / Registered User

The primary user can:

- Register, log in, and log out.
- Manage a profile and basic author information.
- Create, edit, delete, draft, and publish blog posts.
- Browse and search published content.
- Filter content by category.
- Read individual posts.
- Bookmark and manage saved posts.
- Comment on posts and reply to comments.
- Edit or delete their own comments.
- Report inappropriate posts or comments with a reason.
- View activity notifications.

### Administrator

The administrator maintains platform quality and activity by:

- Managing registered users, including role changes and account status (active/suspended).
- Reviewing and moderating reported posts/comments.
- Removing inappropriate content or dismissing reports.
- Creating, editing, and removing categories.
- Monitoring basic platform activity and statistics.

## 4. Product Scope

### In Scope

- Authentication and role-based access.
- Student profiles.
- Blog creation, editing, drafting, publishing, and deletion.
- Home/feed and explore/search experiences.
- Category-based discovery.
- Individual post reading and discussion.
- Bookmarks / saved posts.
- Notifications for comments and replies.
- Reporting and lightweight moderation.
- Administrator dashboard, user management (role/status), content moderation, and category management.

### Out of Scope / Not Specified

The current source material does not define requirements for features such as private messaging, following users, reactions/likes as a core requirement, advanced recommendation algorithms, or multi-level comment threads. These should not be added without a new product decision.

Real-time notification delivery is explicitly not part of the current scope — see §10 for the rationale. Image insertion supports both external `http(s)` image URLs and uploaded images hosted via Cloudinary (specification in `api.md`, `database.md`, and `security.md` §10).

The wireframes contain some additional visual concepts such as tags, featured images, trending discussions, popular tags, and discussion/resource navigation. Their exact functional behavior is not defined in Experiment 0, so they are treated as **UI concepts pending confirmation**, not mandatory requirements (tracked in §12).

## 5. Core User Flows

### 5.1 Authentication

Registration → Login → Home / Profile

Users create an account using name, email, password, and password confirmation. Registered users authenticate through the login screen and enter the main application.

### 5.2 Discover Content

Home → Explore / Search → Blog Post

Users can browse recent/featured content, search by keywords, select categories, and open an individual post.

### 5.3 Read and Discuss

Blog Post → Comment → Reply

A published post contains its author and publication information, article content, bookmark/report actions, and a discussion section. Comments support replies one level deep.

### 5.4 Create and Manage Content

Profile / My Posts → Create Blog → Save Draft or Publish

My Posts → Edit Blog → Save Draft or Update Post

Students manage their own published posts and drafts from the dashboard.

### 5.5 Save Content

Blog Post → Bookmark → Saved Posts → Blog Post

Users can bookmark useful content, browse saved posts, filter/search them, and remove bookmarks.

### 5.6 Notifications

Navigation → Notifications → Related Post / Comment

Users receive notifications related to comments and replies, refreshed on page load/fetch rather than pushed in real time (rationale in §10; delivery mechanism in `architecture.md` §11).

### 5.7 Administration

Admin Login → Admin Dashboard → User Management / Content Moderation / Category Management

Administrators use a persistent admin layout to monitor activity and perform moderation and management tasks.

## 6. Application Views

### Student-facing Views

1. **Home / Feed** — overview of recent/featured posts, discovery controls, categories, and navigation.
2. **Login** — authentication form for registered users.
3. **Registration** — account creation form for new users.
4. **Explore / Search** — search, category filtering, sorting, result list, and post discovery.
5. **Blog Post** — complete article, author information, metadata, bookmark/report actions, comments, and replies.
6. **Create Blog** — users create blog posts using a rich-text editor supporting formatted text, headings, lists, links, code blocks, and images. Images can be inserted via an external URL or uploaded from the user's device (stored via Cloudinary in production, storing only the resulting HTTPS URL in the post document; upload rules in `api.md` and `security.md` §10, editor mechanics in `DESIGN.md`'s Rich Text Editor section).
7. **Edit Blog** — existing post editing with draft and update actions.
8. **My Posts / Dashboard** — published/draft views with post status, dates, comment counts, and edit/delete actions.
9. **User Profile** — profile information, published posts, and recently saved content.
10. **Saved Posts** — bookmarked content with search/filter controls and bookmark removal.
11. **Notifications** — activity notifications with read/unread state and timestamps.

### Admin Views

12. **Admin Dashboard** — platform summary statistics, pending reports, and recent activity.
13. **User Management** — searchable user table with role/status and management actions (role changes, suspend/reactivate).
14. **Content Moderation** — reported posts/comments with report details and moderation actions.
15. **Category Management** — category list with descriptions, post counts, and add/edit/delete actions.

## 7. Functional Requirements

These describe required user-visible behavior. How each is implemented (token lifetimes, validation libraries, query strategy, etc.) is defined in the owning technical doc, referenced inline.

### Authentication & Profile

- User registration and login.
- Secure authentication with session renewal, so a user isn't forced to re-login constantly (mechanism: `security.md` §2, §11).
- Logout.
- Profile creation and editing.
- Basic author information display.
- Role-based access for students and administrators (roles and enforcement: `architecture.md` §5.3, `api.md` §6).

### Blog Management

- Create posts.
- Edit posts.
- Delete posts.
- Save drafts.
- Publish posts.
- View published posts.
- Display author and publication information.

### Content Discovery

- Browse published posts.
- Search by keywords.
- Filter by category.
- View individual posts.
- Display related or recent posts.

### Comments & Replies

- Add comments to posts.
- Reply to comments.
- Display threaded replies one level deep.
- Edit/delete own comments.

### Bookmarks

- Add a bookmark.
- View saved posts.
- Remove a bookmark.

### Notifications

- Notify users about comments/replies related to their content.
- Show unread notification count/state.
- Mark notifications as read.
- Refresh notifications through page load/fetch rather than real-time push (rationale: §10; mechanism: `architecture.md` §11).

### Reporting & Moderation

- Report a post or comment with a reason.
- Admin reviews reported content.
- Admin dismisses a report or removes content.
- Admin manages users (role and account status).
- Admin manages categories.
- Admin monitors basic activity statistics.

## 8. Content Model

The product's core concepts, described at the level a reader needs to make sense of the requirements above — not as a schema. Full field lists, relationships, and storage representation live in `database.md` §3–§4; this section exists so product.md stays readable without cross-referencing another document for the nouns it uses.

- **User** — a registered student or administrator.
- **Post** — a blog article authored by a student, in draft or published state.
- **Category** — an admin-defined grouping used for discovery.
- **Comment** — a reply to a post, or a reply to a comment (one level deep only).
- **Bookmark** — a user's saved-post relationship.
- **Notification** — an alert to a user about activity on their content.
- **Report** — a flag raised against a post or comment for moderation review.

Authentication also persists refresh-session records to support login renewal (§7). This is purely an implementation concern, not a product-facing concept, so it isn't listed as a core entity here — see `database.md` §3 (`RefreshToken`).

**Product-defined state values** (storage/enforcement in `database.md`):

- Post status: `draft`, `published`.
- Notification type: `comment`, `reply`.
- Report status: `pending`, `resolved`, `dismissed`.
- User account status: `active`, `suspended`.

## 9. UX

Visual styling and design-system decisions are defined in `DESIGN.md`.

## 10. Key Product Decisions and Rationale

### Student-focused platform

The application is intentionally centered on student publishing and discussion because the stated problem is the fragmentation of academic and practical student content across general-purpose platforms.

### Blogging + discussion in one product

Combining structured posts with comments/replies directly addresses both content publishing and peer interaction instead of treating them as separate systems.

### One-level threaded replies

Replies are explicitly limited to one level to preserve discussion structure while keeping implementation and UI complexity manageable.

### Lightweight moderation

Reporting, review, dismissal/removal, user management, and category management provide basic platform quality controls without expanding the product into a complex moderation suite.

### Notification refresh instead of push

Experiment 0 explicitly limits notifications to page-load/fetch refresh rather than real-time push to keep the project scope manageable. No notification requirement in §7 depends on real-time delivery, so it is not part of the implementation (`architecture.md` §11).

### Cloudinary-backed image uploads + URL references

Images can be inserted either by pasting an external URL or uploading an image file from the user's device. Uploaded files are routed to Cloudinary rather than stored in MongoDB or local server disk, so post documents stay compact (HTTPS URLs only), Express JSON payloads stay small, and no custom file-storage server is required (`api.md` §4, `security.md` §10).

## 11. Implementation Stack (Reference Only)

The product is built as a React + Node/Express + MongoDB web application. The full stack, library choices, and infrastructure are specified in `architecture.md` and `development.md` §1 — this document does not restate them, since stack choices don't change what the product does for a user.

## 12. Open Product-Scope Questions

Questions that would change user-visible requirements if resolved one way or another:

1. **Wireframe-only concepts:** tags, featured images, likes/interactions, trending discussions, popular tags, discussion/resource sections, and some admin role/status details appear in Stitch but are not fully specified as product requirements (§4).

Decisions that affect *how* the product is built but not *what* it does — state management library, deployment target, JWT transport mechanism, physical database indexes, and similar — are tracked in `architecture.md` §25, not duplicated here, so each stays resolved or open in exactly one place.

## 13. Success Criteria

The product should allow a student to complete the full core loop:

**Register/Login → Discover a post → Read → Comment/Reply → Bookmark → Return to saved content**, while also supporting **Create → Draft → Publish → Manage** for student-authored content and **Report → Review → Moderate** for administrators.

The implemented application should remain consistent with the defined views, functional requirements, and scope above.
