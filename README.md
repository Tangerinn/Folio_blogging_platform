# Folio

A student-focused blogging platform for publishing, discovering, and discussing academic content, project experiences, tutorials, and practical insights.

- **Live App:** https://folio-client.onrender.com
- **API Base:** https://folio-blogging-platform.onrender.com/api

## Features

**For Students**
- Register, log in (JWT access & refresh tokens), and manage profiles.
- Write and edit posts with a TipTap rich-text editor, image uploads via Cloudinary, drafts, and publishing.
- Browse, search, and filter published articles by category and sort order.
- Comment and reply in one-level threads with real-time updates via Socket.IO.
- Bookmark and manage saved posts.
- Receive real-time notifications for comments and replies.
- Report inappropriate posts or comments.

**For Administrators**
- View platform activity and statistics.
- Manage registered users (activate/suspend).
- Review reported posts and comments, remove content, or dismiss reports.
- Create, edit, and delete categories.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, TipTap, Socket.IO Client |
| Backend | Node.js, Express 5, Socket.IO, Helmet, Express Rate Limit |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JWT, bcrypt |
| Media Storage | Cloudinary, Multer |
| Testing | Node.js built-in test runner (`node --test`) |
| Deployment | Render (Static Site + Web Service) |

## Project Structure

```text
Folio_blogging_platform/
├── client/       # React + Vite frontend
├── server/       # Express + Socket.IO backend
├── docs/         # Product, design, and technical documentation
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm
- MongoDB Atlas cluster (or local MongoDB instance)
- Cloudinary account (for image uploads)

### 1. Backend Setup

```bash
cd server
npm install
cp .env.example .env
```

Configure `server/.env` with your `MONGODB_URI`, `JWT_ACCESS_SECRET`, `CORS_ORIGIN` (e.g., `http://localhost:5173`), and Cloudinary credentials.

Optional — seed demo users, categories, posts, and comments:
```bash
npm run seed
```

Start the development server:
```bash
npm run dev
```

Run backend tests:
```bash
npm test
```

### 2. Frontend Setup

```bash
cd client
npm install
cp .env.example .env
```

In `client/.env`:
- Set `VITE_USE_MOCK=false` and `VITE_API_URL=http://localhost:5000/api` to connect to your local backend.
- Or set `VITE_USE_MOCK=true` to run the frontend standalone with built-in mock data.

Start the Vite dev server:
```bash
npm run dev
```

## Deployment (Render)

- **Backend (`server/`)**: Deployed as a Render **Web Service** (`npm install` / `npm start`, health check `/health`) with `MONGODB_URI`, `JWT_ACCESS_SECRET`, `CORS_ORIGIN`, and Cloudinary environment variables.
- **Frontend (`client/`)**: Deployed as a Render **Static Site** (`npm install && npm run build`, publish directory `dist`) with `VITE_USE_MOCK=false`, `VITE_API_URL`, and a `/* -> /index.html` rewrite rule for client-side routing.

## Documentation

Additional design and technical documentation is available in `docs/`, covering product requirements, system architecture, database design, API contracts, UI/UX design, and security considerations.
