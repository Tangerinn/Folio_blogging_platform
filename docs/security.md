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

The exact token transport mechanism (header vs. cookie) is not specified in the current sources and remains a decision. Whichever is chosen determines the CORS configuration in §12.

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

## 5. Input and Data Safety

Validate user-controlled input before business logic. Apply appropriate output handling for user-generated content.

The current sources require input validation but do not specify the exact validation library; that remains an implementation decision. Rich-text/content-node validation is specified in §10 below.

## 6. Secrets

Keep secrets outside source control using environment configuration.

At minimum, secrets/configuration should not be hard-coded:

```text
JWT access-token secret
JWT refresh-token secret
Database credentials / connection configuration
Deployment secrets
```

Exact environment variable names are implementation-specific.

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

## 10. Content/Input security

Post content is stored as structured editor JSON. The server validates the document structure, allowed node types, attributes, and URLs before storage. Arbitrary HTML, scripts, event handlers, and unsupported embedded content must not be permitted.

Image nodes reference an externally-hosted URL only (see `DESIGN.md`, `database.md`). The server validates that the URL is well-formed and uses an allowed scheme (`http`/`https`); the platform does not accept or store uploaded image files in the current scope.

## 11. JWT Expiration and Refresh

- Access tokens expire after 15 minutes.
- Refresh tokens are longer-lived and stored server-side, persisted as their own records (see `database.md`'s `RefreshToken` collection) — not embedded as a single field on `User` — so that multiple sessions/devices can be issued and revoked independently.
- Refresh tokens are stored hashed, never in plaintext, matching the treatment of passwords.
- A new access token is obtained via `POST /auth/refresh` (see `api.md` §4), which validates the presented refresh token against its stored hash and issues a new access token. An expired or revoked refresh token is rejected and requires re-login.
- Logout revokes the presented refresh token (marks it revoked in storage) and removes authentication tokens from the client.
- Expired or invalid tokens are rejected.

## 12. Rate Limiting

`/auth/login` and `/auth/register` must be rate-limited (e.g., per-IP and/or per-account) to reduce brute-force and automated-registration risk. Exact limits/window and library are an implementation decision; this section only establishes that the control must exist.

## 13. CORS

The API must configure CORS to allow only the deployed frontend origin(s) — not a wildcard. Whether `credentials: true` (cookie-based CORS) is required depends on the JWT transport decision in §3:

- Header-based transport (`Authorization: Bearer <token>`): standard CORS with an explicit origin allowlist; `credentials` mode not required.
- Cookie-based transport: CORS must set `credentials: true` and the frontend must send requests with credentials included; cookies should be `HttpOnly`, `Secure`, and `SameSite`-scoped appropriately.

This decision should be finalized alongside the JWT transport mechanism, not independently.
