# Folio

A student-focused platform for publishing, discovering, and discussing academic content, project experiences, tutorials, and practical insights.

## Features

**For Students**
- Register, log in, and manage profiles.
- Create, edit, save drafts, publish, and delete blog posts.
- Browse, search, and filter published articles.
- Read articles and participate in discussions.
- Comment and reply in one-level threads.
- Bookmark and manage saved posts.
- Receive notifications for comments and replies.
- Report inappropriate content.

**For Administrators**
- View platform activity and statistics.
- Manage registered users.
- Review reported posts and comments.
- Remove content or dismiss reports.
- Create, edit, and delete categories.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcrypt |
| API Testing | Postman |
| Version Control | Git, GitHub |
| Deployment | Docker, GitHub Actions (planned) |

## Architecture

The application follows a client-server architecture.

- **Client:** React application handling UI, routing and state.
- **Server:** Express REST API handling business logic, authentication and data operations.
- **Database:** MongoDB for persistent application data.

The frontend currently supports a centralized mock API, with a separate API layer for future backend integration.

## Project Structure

```text
Folio_blogging_platform/
├── client/       # React frontend
├── server/       # Express backend
├── docs/         # Product, design and technical documentation
└── README.md
```

## Getting Started

### Prerequisites
- Node.js
- npm
- MongoDB Atlas account or local MongoDB instance

### Frontend

```bash
cd client
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
npm run dev
```

Configure environment variables using the respective `.env.example` files before running the application.

## Product Scope

The platform focuses on student publishing, content discovery, discussions and lightweight moderation.

Private messaging, user following, advanced recommendations, multi-level comment threads and real-time notifications are outside the current scope.

## Documentation

Additional project documentation is available in `docs/`, covering:
- Product requirements
- System architecture
- Database design
- API contracts
- UI/UX design
- Development conventions
- Security considerations

## Project Status

Frontend implementation is undergoing stabilization and verification. Backend integration, database persistence, testing and deployment are planned next.
