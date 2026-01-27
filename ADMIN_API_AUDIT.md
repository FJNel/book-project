# Admin API Audit Matrix (Phase 5.1)

Purpose: map each Admin tab to its network calls, payloads, response fields used by UI, auth, and error/caching expectations.

Notes:
- All admin list/search/filter calls use JSON bodies (POST) in the UI.
- Error handling follows ApiResponse error envelope; UI shows inline alerts and clears loading states.

## Overview
- Endpoint: GET `/status`
  - Payload: none
  - Response fields used: `data.db.latencyMs`, `data.emailQueue.queueLength`, `data.emailQueue.isProcessing`, `data.user.email`
  - Auth: admin-only
  - Error handling: inline alert; status pills set to “Unavailable”
- Endpoint: GET `/health`
  - Payload: none
  - Response fields used: `data.db.sslMode`, `data.db.latencyMs`, `data.db.schemaOk`
  - Auth: public
  - Error handling: inline health banner; does not block other sections

## Statistics
- Endpoint: POST `/admin/stats/summary`
  - Payload: `{}` (JSON body)
  - Response fields used: `data.stats.*`, `data.warnings[]`
  - Auth: admin-only
  - Caching: server-side (admin TTL)
  - Error handling: inline alert; cards show “Unavailable”

## Users
- Endpoint: POST `/admin/users/list`
  - Payload: `{ limit, offset, sortBy, order, filterEmail?, filterRole?, filterIsVerified?, filterIsDisabled? }`
  - Response fields used: `data.users[]`, `data.total`
  - Auth: admin-only
  - Error handling: inline alert + table fallback row
- Endpoint: POST `/admin/users`
  - Payload: `{ fullName, preferredName?, email, password?, role?, noPassword?, duration? }`
  - Response fields used: `data.user.*`
  - Auth: admin-only
  - Error handling: inline modal alert + validation text
- Endpoint group (actions, JSON body):
  - `/admin/users/verify`, `/admin/users/unverify`, `/admin/users/send-verification`, `/admin/users/reset-password`, `/admin/users/force-logout`, `/admin/users/handle-account-deletion`, `/admin/users/enable`
  - Payload: `{ id }` + optional action-specific fields
  - Response fields used: message only
  - Auth: admin-only

## Libraries
- Endpoint: GET `/languages`
  - Payload: none
  - Response fields used: `data.languages[]`
  - Auth: admin-only (enforced on server)
  - Error handling: inline alert + table fallback row
- Endpoint: POST `/admin/languages`
  - Payload: `{ name }`
  - Response fields used: `data.language.*`
  - Auth: admin-only
- Endpoint: PUT `/admin/languages/{id}`
  - Payload: `{ name }`
  - Response fields used: message only
  - Auth: admin-only
- Endpoint: DELETE `/admin/languages/{id}`
  - Payload: none
  - Response fields used: message only
  - Auth: admin-only

## Emails
- Endpoint: GET `/admin/emails/types`
  - Payload: none
  - Response fields used: `data.types[]` (type, description, fields[])
  - Auth: admin-only
  - Error handling: inline alert; form remains disabled
- Endpoint: POST `/admin/emails/send-test`
  - Payload: `{ emailType, toEmail, context }`
  - Response fields used: `data.emailType`, `data.toEmail`, `data.expiresInMinutes`
  - Auth: admin-only
  - Error handling: inline alert + modal error state
- Endpoint: POST `/admin/emails/dev-features/test`
  - Payload: `{ toEmail, subject, markdownBody }`
  - Response fields used: `data.willSend`, `data.reason?`
  - Auth: admin-only
  - Error handling: inline alert
- Endpoint: POST `/admin/emails/dev-features/send`
  - Payload: `{ subject, markdownBody }`
  - Response fields used: `data.recipientCount`
  - Auth: admin-only
  - Error handling: inline alert
- Endpoint: POST `/admin/emails/history`
  - Payload: `{ type?, status?, recipient?, startDate?, endDate?, page?, limit? }`
  - Response fields used: `data.history[]`, `data.count`, `data.total`, `data.page`, `data.limit`, `data.hasNext`, `data.warnings[]`
  - Auth: admin-only
  - Error handling: inline alert + table fallback row
- Endpoint: POST `/admin/markdown/render`
  - Payload: `{ text }`
  - Response fields used: `data.html`
  - Auth: admin-only
  - Error handling: inline preview error text

## Usage & Logs
- Endpoint: POST `/logs/search`
  - Payload: `{ search?, category?, level?, method?, actorType?, path?, userId?, userEmail?, apiKeyId?, apiKeyLabel?, apiKeyPrefix?, statusCodeMin?, statusCodeMax?, startDate?, endDate?, limit, offset }`
  - Response fields used: `data.logs[]`, `data.total`, `data.count`, `data.limit`, `data.offset`, `data.configured`, `data.message`, `data.warnings[]`
  - Auth: admin-only
  - Error handling: inline alert + table fallback row
- Endpoint: GET `/logs/log_types`
  - Payload: none
  - Response fields used: `data.logTypes[]`, `data.configured`, `data.message`, `data.warnings[]`
  - Auth: admin-only
- Endpoint: GET `/logs/levels`
  - Payload: none
  - Response fields used: `data.levels[]`, `data.configured`, `data.message`, `data.warnings[]`
  - Auth: admin-only
- Endpoint: GET `/logs/statuses`
  - Payload: none
  - Response fields used: `data.statuses[]`, `data.configured`, `data.message`, `data.warnings[]`
  - Auth: admin-only
- Endpoint: POST `/admin/usage/users`
  - Payload: `{ startDate?, endDate?, sortBy?, order?, topLimit?, limit?, offset?, userId?, email?, path? }`
  - Response fields used: `data.users[]`, `data.window`, `data.usageLevels`, `data.configured`, `data.message`, `data.warnings[]`
  - Auth: admin-only
  - Caching: server-side (admin TTL)
- Endpoint: POST `/admin/usage/api-keys`
  - Payload: `{ startDate?, endDate?, sortBy?, order?, topLimit?, limit?, offset?, apiKeyId?, apiKeyLabel?, email? }`
  - Response fields used: `data.apiKeys[]`, `data.window`, `data.usageLevels`, `data.configured`, `data.message`, `data.warnings[]`
  - Auth: admin-only
  - Caching: server-side (admin TTL)

## Data Tools
- Endpoint: GET `/admin/data-viewer/tables`
  - Payload: none
  - Response fields used: `data.tables[]` (name, label, description, defaultSort, defaultOrder, sortFields[])
  - Auth: admin-only
- Endpoint: POST `/admin/data-viewer/query`
  - Payload: `{ table, search?, userId?, email?, sortBy?, order?, limit?, page? }`
  - Response fields used: `data.columns[]`, `data.rows[]`, `data.count`, `data.total`, `data.page`, `data.limit`, `data.hasNext`
  - Auth: admin-only
  - Error handling: inline alert + table fallback row

## request_logs Migration (required for Logs/Usage)
Copy/paste SQL:

```
CREATE TABLE IF NOT EXISTS request_logs (
  id               BIGSERIAL PRIMARY KEY,
  logged_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  level            VARCHAR(10) NOT NULL,
  category         VARCHAR(40) NOT NULL,
  correlation_id   VARCHAR(64),
  method           VARCHAR(10),
  path             TEXT,
  route_pattern    TEXT,
  query            JSONB,
  headers          JSONB,
  body             JSONB,
  body_truncated   BOOLEAN NOT NULL DEFAULT FALSE,
  ip               INET,
  user_agent       TEXT,
  actor_type       VARCHAR(20) NOT NULL,
  user_id          INT REFERENCES users(id) ON DELETE SET NULL,
  user_email       VARCHAR(255),
  user_role        VARCHAR(20),
  api_key_id       INT,
  api_key_label    VARCHAR(120),
  api_key_prefix   VARCHAR(20),
  status_code      INT,
  response_body    JSONB,
  response_truncated BOOLEAN NOT NULL DEFAULT FALSE,
  duration_ms      DOUBLE PRECISION,
  error_summary    TEXT,
  request_bytes    INT,
  response_bytes   INT,
  cost_units       INT
);

CREATE INDEX IF NOT EXISTS request_logs_logged_at_idx ON request_logs (logged_at);
CREATE INDEX IF NOT EXISTS request_logs_user_id_idx ON request_logs (user_id);
CREATE INDEX IF NOT EXISTS request_logs_user_email_idx ON request_logs (user_email);
CREATE INDEX IF NOT EXISTS request_logs_api_key_id_idx ON request_logs (api_key_id);
CREATE INDEX IF NOT EXISTS request_logs_method_path_idx ON request_logs (method, path);
CREATE INDEX IF NOT EXISTS request_logs_status_code_idx ON request_logs (status_code);
CREATE INDEX IF NOT EXISTS request_logs_level_idx ON request_logs (level);
CREATE INDEX IF NOT EXISTS request_logs_category_idx ON request_logs (category);
```
