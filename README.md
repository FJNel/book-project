# The Book Project

A full‑stack application to manage a personal book collection. It provides user authentication (email/password and Google OAuth), email verification, password reset, a secure API with structured responses and logging, and a Bootstrap‑based frontend with helpful modals and simple internationalisation.

This README documents the architecture, technology choices, setup instructions, security design, and how to extend or operate the project.

## Highlights

- Modern Node.js API with Express 5, PostgreSQL, JWT access/refresh tokens, and rate limiting
- Email flows via Mailgun: verification, password reset, and welcome messages
- Google reCAPTCHA v3 server‑side verification for key auth flows
- Google OAuth2 sign‑in support
- Centralised logging: rotating file logs + database user action logs with sensitive‑data redaction
- Consistent JSON response envelope for success and error
- Static frontend with Bootstrap 5; dedicated flows for login, register, verify email, reset password
- Frontend HTTP interceptor that attaches tokens, refreshes access token on 401, and handles session expiry
- Language file support (`web/lang/en.json`) for UI copy

## Repository Structure

- `web/` Frontend (static site)
  - `index.html` Landing page with Login/Register modals and support modals
  - `verify-email.html`, `reset-password.html`, `add-book.html`, `404.html`, `privacy-policy.html`
  - `assets/js/` Frontend logic (see Feature Overview)
  - `assets/css/` Styles, primarily Bootstrap overrides and helpers
  - `lang/en.json` Language strings used by UI handlers
  - `assets/data/404-messages.json` Fun 404 messages
- `api/` Backend (Node.js + Express)
  - `index.js` Server setup, middleware, and route wiring
  - `db.js` PostgreSQL connection pool
  - `routes/` Core routes: `root.js`, `auth.js`, `users.js`, `admin.js`
  - `utils/` Shared utilities: `jwt.js`, `validators.js`, `logging.js`, `response.js`, `email.js`
  - `public/` Static API docs HTML
  - `api-docs.md` API documentation (detailed endpoints and examples)
  - `database-tables.txt` PostgreSQL schema for users, tokens, OAuth links, and logs
- `README.md` This document
- `package.json` Root (placeholder) and `api/package.json` (API dependencies and scripts)

## Technology Choices and Rationale

- Express 5 + Node.js
  - Mature ecosystem; minimalistic, flexible middleware model
  - Combined with Helmet and CORS for baseline security
  - `express-rate-limit` for throttling sensitive endpoints
- PostgreSQL (`pg`)
  - Reliable relational data store; strong SQL and transactional semantics
  - Suits normalized user, token, OAuth, and logging tables well
- JWT for access and refresh tokens
  - Short‑lived access tokens (`15m`) and long‑lived refresh tokens (`7d`)
  - Refresh tokens stored as fingerprints in DB to enable revocation and auditing
- Mailgun for transactional emails
  - Official SDK; reliable delivery; simple HTML templates for verification, welcome, and reset flows
- Google reCAPTCHA v3
  - Mitigates abuse on register, login, resend‑verification, and reset‑password endpoints
- Google OAuth2
  - Low‑friction sign‑in, synced with internal user records and verified emails
- Winston file logging + DB logs
  - Operational visibility with redaction and rotation; user action trail for auditability
- Bootstrap 5 (CDN)
  - Fast to ship a responsive UI with modals, tooltips, and grid
- Static frontend + API separation
  - Clear separation of concerns; frontend can be hosted on any static host; API deploys independently

## API Overview

The API is documented in `api/api-docs.md` and serves JSON using a consistent envelope via `utils/response.js`.

- Auth routes: register, resend verification, verify email, login, refresh token, logout, request password reset, reset password, Google OAuth
- User routes: get current user (`/users/me`), update profile, soft‑delete own account (also revokes refresh tokens)
- Admin routes: scaffolded under `/admin` with role checks (not yet implemented)

Cross‑cutting concerns:

- Security headers via Helmet
- CORS restricted to allowed origins in `api/index.js`
- Rate limiting for sensitive endpoints (dedicated limiters with unified handler)
- Request logging (method, path, status, duration, IP, user‑agent, request payload sanitised)
- Structured error handling (404 and global error handler)

## Frontend Overview

Pages and flows:

- `index.html` Landing page with modals for Login, Register, “Forgot Password”, and “Resend Verification Email”
- `verify-email.html` Accepts `?token=` via query string, collects email, posts to API
- `reset-password.html` Accepts `?token=` via query string, collects email + new password, posts to API
- `add-book.html` Early UI scaffold for adding books, including an ISBN lookup section
- `404.html` Lightweight 404 page with randomized messages from `assets/data/404-messages.json`

Key scripts (`web/assets/js/`):

- `http-interceptor.js`
  - Central `apiFetch(path, options)` wrapper
  - Adds `Authorization: Bearer <accessToken>` for private endpoints
  - On 401 from private endpoints: calls `/auth/refresh-token`, retries original request
  - On refresh failure: clears tokens, shows a session‑expired modal, and redirects to login
  - `API_BASE_URL` is set to production; adjust for local dev (see Setup)
- `common.js`
  - Startup checks, API health check against `/`
  - Page loading modal helpers
- `login-handler.js`, `register-handler.js`, `resend-verification-handler.js`, `reset-password-request-handler.js`
  - User flows with client‑side validation and language strings from `lang/en.json`
- `verify-email.js`, `reset-password.js`
  - Tokenised flows from links sent via email; robust error and success messaging
- `index-actions.js`
  - Supports `?action=login|register|request-password-reset|request-verification-email` to deep‑link modals
- `404.js`
  - Picks a random message for the 404 page and wires the “Back Home” button

Language strings:

- `web/lang/en.json` holds UI copy and translated error keys mirroring API messages

## Database Schema

See `api/database-tables.txt` for full DDL. Core tables:

- `users` User records; local password and/or OAuth
- `verification_tokens` Type: `email_verification` or `password_reset`; expiry + used flags
- `oauth_accounts` Linked OAuth providers (e.g., Google)
- `refresh_tokens` Refresh token fingerprints with expiry and revocation
- `user_logs` Action logs with `action`, `status`, minimal metadata, and optional JSON `details`

## Security Model

- Access tokens: short‑lived JWTs; attached to API requests via the frontend interceptor
- Refresh tokens: signed JWT containing a UUID fingerprint; corresponding fingerprint stored in DB
  - On logout/reset/disable: DB marks refresh tokens revoked, effectively ending sessions
- Passwords: hashed with bcrypt (configurable `SALT_ROUNDS`)
- Email and password reset links: single‑use tokens with expiry stored in `verification_tokens`
- Google OAuth2: verified emails required; on first login, a user record is created and linked
- CORS: locked to allowed origins in `api/index.js` (`origin: [...]`)
- Helmet: security headers
- Rate limiting: per‑route limiters for high‑risk endpoints
- Logging: request logs and action logs with redaction (`utils/logging.js` sanitises keys like password/token/secret)

## Local Development Setup

Prerequisites:

- Node.js 18+ (recommended 20+)
- PostgreSQL 14+
- A Mailgun account and domain (for email flows), or skip email during local dev
- Google OAuth Client ID (optional for local dev)
- Google reCAPTCHA v3 secret (optional for local dev)

1) Install API dependencies

- `cd api`
- `npm install`

2) Create the database and tables

- Create a PostgreSQL database and user
- Run the DDL in `api/database-tables.txt` against your DB

3) Configure API environment

Create `api/.env` with values appropriate for your environment:

```
PORT=4000
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=book_project_user
DB_PASSWORD=supersecret
DB_NAME=book_project

# Optional: use a single connection string (preferred in production)
# DATABASE_URL=postgresql://user:password@host:5432/book_project
# DB_SSL_MODE=disable|require|allow-self-signed|verify-ca|verify-full
# DB_SSL_CA="-----BEGIN CERTIFICATE-----..."

# JWT
JWT_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
SALT_ROUNDS=10

# Mailgun (optional for dev)
MAILGUN_API_KEY=key-xxx
MAILGUN_DOMAIN=mg.example.com
FROM_EMAIL=noreply@example.com
MAILGUN_REGION=US
MAILGUN_MONTHLY_SEND_LIMIT=10000

# Frontend URL used in email links
FRONTEND_URL=http://127.0.0.1:8000

# Google OAuth / reCAPTCHA (optional during dev)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
RECAPTCHA_SECRET=your-recaptcha-secret
```

4) Start the API

- `npm run dev` (nodemon) or `npm start`
- Default port is `4000`

5) Serve the frontend

The frontend is static; you can open files directly or serve with any static file server. Examples:

- VS Code Live Server
- `python -m http.server 8000` (then visit `http://127.0.0.1:8000/web/`)

Important for local dev:

- Update allowed origins in `api/index.js` CORS config to include your local web server
- The frontend points to the production API by default via constants:
  - `web/assets/js/http-interceptor.js` (API_BASE_URL)
  - `web/assets/js/common.js`, and some handlers reference the same production base
  - For local dev, change `API_BASE_URL` to `http://127.0.0.1:4000/`

## Scripts

API (`api/package.json`):

- `npm run dev` Run API with nodemon
- `npm start` Run API with node

## Operational Logging

- File logs: rotating log at `api/logs/app.log` with size rotation (Winston)
- DB logs: `user_logs` captures key actions with status and minimal metadata
- Sanitisation: credentials, tokens, and large strings are redacted by `sanitizeInput`

## Internationalisation (i18n)

- `web/lang/en.json` provides UI strings and maps common API error keys to user‑friendly text
- Handlers gracefully fall back to default strings if the language file is unavailable

## Privacy and Data Handling

- Email, password resets, and verification use Mailgun; the API does not log sensitive payloads
- The frontend stores `accessToken` and `refreshToken` in `localStorage` for simplicity
  - Consider switching to HTTP‑only secure cookies for production hardening
- A starter Privacy Policy lives at `web/Privacy Policy.md` and `web/privacy-policy.html`

## Known Limitations and TODOs

- Admin routes are placeholders (`api/routes/admin.js`)
- Frontend uses `localStorage` for tokens; consider cookies + CSRF protections for production
- `API_BASE_URL` is set inline in scripts; consider environment‑driven config for deploys
- No automated tests yet; `api/package.json` has a placeholder test script
- `users.js` contains profile and delete flows; building out additional book management routes is planned

## Deployment Notes

- Frontend: host `web/` on any static hosting (e.g., Netlify, GitHub Pages, S3/CloudFront)
- API: deploy `api/` to your Node hosting (e.g., Docker on a VPS); ensure environment variables and Postgres connectivity
- Update CORS `origin` allowlist in `api/index.js`
- Ensure Mailgun and OAuth credentials are configured and DNS is correct for sender domain


## License

This project is distributed under a Source‑Available Proprietary License. See `LICENCE.md` for the complete terms, including permitted and prohibited uses and how to request additional permissions.

Summary (for convenience only; the license file governs):
- Permitted: View and study the code for personal/educational/reference purposes.
- Not permitted without written permission: Redistribution, modification, derivative works, hosting, or any commercial/production use.

For commercial use or other permissions, review and follow the instructions in `LICENCE.md`.
