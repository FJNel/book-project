# Dewey Decimal Support (Phase 1)

Phase 1 adds optional Dewey Decimal support to books without changing the rest of the runtime data-access layer.

## What Phase 1 Includes

- `books.dewey_code` as a nullable string column
- A built-in default dataset at `data/dewey/default.json`
- An effective-dataset service that currently returns the default dataset and is structured for future user overrides
- `GET /me/dewey-dataset` for frontend dataset loading
- Structured Dewey feature state exposed through `GET /users/me`
- Local frontend interpretation while typing on Add Book and Edit Book
- Save-time backend normalization, validation, and canonical resolution
- Minimal Dewey display on Book Details

## Normalization and Validation

Backend and frontend follow the same practical rules:

- Trim whitespace
- Replace commas with dots
- Collapse repeated dots
- Valid format: `^\d{1,3}(\.\d+)?$`

Examples:

- `513,2` -> `513.2`
- `513..27` -> `513.27`

## Resolution Rules

Resolution is prefix-based and tolerates incomplete datasets.

Example fallback order for `513.27`:

1. `513.27`
2. `513.2`
3. `513`
4. `510`
5. `500`

Path construction is also prefix-based, so missing intermediate captions are skipped instead of causing failure.

## Effective Dataset Structure

The backend uses `api/utils/dewey.js` as the single Dewey service entry point.

Today:

- default dataset only
- response source: `default`

Designed for a later phase:

- user dataset overrides matching default codes
- missing user codes still fall back to default entries

## Save-Time Behaviour

When a book is created or updated with a Dewey code:

1. Input is normalized.
2. Format is validated.
3. The backend resolves the code against the effective dataset.
4. The normalized code is stored.

Valid but unresolved codes are still allowed in Phase 1. The backend remains authoritative for normalization and canonical resolution even though the frontend interprets locally for instant feedback.

## Feature Enablement

Dewey support now uses a small settings foundation with two layers:

1. Global availability from `DEWEY_DECIMAL_ENABLED`
2. Per-user enablement from `users.dewey_enabled`

Dewey is active only when both are true.

The canonical resolver lives in `api/utils/feature-settings.js`.

`GET /users/me` exposes:

```json
{
  "settings": {
    "deweyEnabled": false
  },
  "features": {
    "dewey": {
      "available": true,
      "enabled": false
    }
  }
}
```

Frontend behavior:

- if globally unavailable: Dewey UI stays hidden
- if globally available but the user has not enabled it: Dewey UI stays hidden
- if active but dataset loading fails: Dewey input stays usable with a manual-entry fallback

Stored Dewey data is not deleted when the feature is hidden.
