# Development

## 1. Stack

```text
Frontend      React.js + Tailwind CSS
State         Redux Toolkit OR React Context API (TBD)
Backend       Node.js + Express.js
Database      MongoDB + Mongoose
Auth          JWT (access + refresh) + bcrypt
Containers    Docker + Docker Compose
CI/CD         GitHub Actions
Versioning    Git + GitHub
API tooling   Postman
```

The production deployment target is currently TBD (for example, Render or Vercel).

## 2. Repository Shape

Recommended structure:

```text
project/
├─ client/
│  └─ src/
│     ├─ components/
│     ├─ pages/
│     ├─ hooks/
│     ├─ services/
│     ├─ state/
│     ├─ layouts/
│     ├─ routes/
│     └─ utils/
│
├─ server/
│  ├─ src/
│  │  ├─ config/
│  │  ├─ middleware/
│  │  ├─ modules/
│  │  ├─ models/
│  │  ├─ routes/
│  │  ├─ app.js
│  │  └─ server.js
│  └─ tests/
│
├─ docker-compose.yml
└─ README.md
```

This is an implementation recommendation, not a mandated repository layout.

## 3. Local Environment

Required local services/tools follow the supplied stack:

- Node.js runtime
- npm package manager
- MongoDB
- Docker / Docker Compose
- Git
- Postman for API testing

## 4. Environment Configuration

Use environment variables for secrets and environment-specific configuration.

Typical configuration categories:

```text
Application environment
API/server port
MongoDB connection
JWT access-token secret/configuration
JWT refresh-token secret/configuration
Frontend/API base URL
Allowed CORS origin(s)
```

Exact variable names are TBD.

Never commit secrets to Git.

## 5. Docker

Local container architecture:

```text
Docker Compose
├─ frontend
├─ backend
└─ database / database configuration
```

The production topology may differ from local Docker Compose.

## 6. Development Conventions

### Backend

```text
Route → Controller → Service → Model
```

- Keep controllers thin.
- Put business rules in services.
- Keep database access in the data/model layer.
- Centralize authentication/authorization middleware.
- Validate request input at the API boundary.

### Frontend

- Keep reusable UI in components.
- Keep page composition in page/layout components.
- Keep API calls in the service/API layer.
- Keep domain rules out of presentational components where practical.

## 7. Testing

The architecture requires testing as part of CI, but the sources do not prescribe a particular test framework.

At minimum, cover:

- authentication (including token refresh/revocation)
- authorization/ownership
- post lifecycle
- one-level comment replies
- bookmarks
- notifications
- reporting/moderation
- category management

Exact unit/integration/E2E framework is TBD.

## 8. CI/CD

Expected GitHub Actions flow:

```text
Commit / Pull Request
        ↓
Install dependencies
        ↓
Lint / checks
        ↓
Tests
        ↓
Build
        ↓
Deploy
```

Deployment configuration and secrets must remain outside source control.

## 9. API Testing

Postman is the supplied API testing/documentation tool.

Keep representative collections for authentication, student flows, and admin flows as the API stabilizes.

## 10. Git Conventions

Use Git + GitHub. Keep commits focused and avoid committing:

- secrets
- generated build output where not required
- local environment files containing credentials

Exact branch/commit naming conventions are not specified and should be agreed by the team.
