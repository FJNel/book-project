# API Overview

OpenAPI is the source of truth; Markdown is explanatory. Refer to `openapi/openapi.yaml` for full endpoint contracts.

- **Base URL:** `https://api.fjnel.co.za`
- **Authentication:** Bearer access token (`Authorization: Bearer <accessToken>`) or API key (`X-API-Key: <apiKey>` or `Authorization: ApiKey <apiKey>`). Admin routes additionally require `role=admin`.
- **Response envelope:** Every response uses `{ status, httpCode, responseTime, message, data, errors }`. `status` is `success` or `error`; `errors` is an array of human-readable strings.
- **Rate limits:**
  - Authenticated endpoints: 60 req/min/user (shared `authenticatedLimiter`).
  - Stats endpoints (*/stats, `/timeline/buckets`): 20 req/min/user (`statsLimiter`).
  - Captcha/sensitive/email/admin deletion limiters noted per endpoint in the spec (`x-rateLimit` notes).
- **Partial dates:** Many entities accept `PartialDate` objects with `day`, `month`, `year`, `text`; missing parts are allowed per API rules.

## Working with the OpenAPI spec

- View docs locally with Redocly (no install needed):
  - `npx @redocly/openapi-cli preview-docs openapi/openapi.yaml`
- Lint locally (optional): `npx @redocly/openapi-cli lint openapi/openapi.yaml`
- Many GET list endpoints accept filters in either query params or JSON bodies; bodies take precedence.
- GET endpoints that accept bodies are modeled directly in OpenAPI 3.1. If both query and body are sent, body wins.

For detailed schemas, reusable parameters, security schemes, examples, and rate-limit notes, see `openapi/openapi.yaml`.
