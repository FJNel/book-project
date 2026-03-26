# Dewey Decimal Support

The current Dewey implementation covers Phase 1 and Phase 2 without changing the rest of the runtime data-access layer.

## What Is Implemented

- `books.dewey_code` as a nullable string column
- A built-in default dataset at `data/dewey/default.json`
- A per-user uploaded dataset model stored in `user_dewey_sources` and `user_dewey_entries`
- An effective-dataset service in `api/utils/dewey.js`
- `GET /me/dewey-dataset` for frontend dataset loading
- `GET /me/dewey-source/status` for Dewey source status
- `POST /me/dewey-source/upload` for CSV uploads
- `GET /dewey/roots` for the Dewey Dashboard tree
- `GET /dewey/node/:code` for Dewey node details and books
- `GET /dewey/search?q=...` for Dewey Dashboard search
- Structured Dewey feature state exposed through `GET /users/me`
- Local frontend interpretation while typing on Add Book and Edit Book
- Save-time backend normalization, validation, and canonical resolution
- Minimal Dewey display on Book Details
- A Dewey Dashboard browsing page aligned with the Storage Locations experience

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

Merge rules:

- default dataset loads first
- active user dataset entries override matching default codes
- missing user codes still fall back to default entries
- the merged result is returned as source `merged`

If the user has no active uploaded dataset, the effective dataset remains `default`.

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

## Phase 2 Upload Format

Supported upload format: CSV

Required columns:

- `code`
- `caption`

Optional column:

- `parent_code`

The parser normalizes headers to tolerate spaces and hyphens, but the upload should still be kept simple and explicit.

## Upload Validation Rules

Fatal errors prevent the uploaded dataset from becoming active:

- missing required `code` column
- missing required `caption` column
- empty file or no data rows
- missing row `code`
- invalid row `code`
- missing row `caption`
- duplicate `code` values in the same upload

Warnings do not block activation:

- missing `parent_code` column
- missing row `parent_code`
- invalid `parent_code`
- `parent_code` that is not present in the uploaded dataset
- sparse uploaded hierarchy where broader fallback will rely on defaults

If an upload has fatal errors, it is recorded as an invalid source for status/reporting, but the currently active valid user dataset is left unchanged.

## Upload and Status Endpoints

`POST /me/dewey-source/upload`

- multipart upload
- file field name: `file`
- accepts CSV content
- returns whether the upload was accepted, the validation report, and the current dataset status

`GET /me/dewey-source/status`

- returns whether the user has uploaded a Dewey source
- returns whether an active user source exists
- returns active/latest source metadata and validation details
- indicates whether the account is still using the default dataset only

## Resolution Priority

Canonical resolution now follows this order:

1. active user dataset exact match
2. active user dataset prefix fallback
3. default dataset exact or prefix fallback
4. unresolved

This still uses the same prefix-based resolver introduced in Phase 1. `parent_code` remains optional metadata and is not required for resolution to work.

## Phase 3 Dashboard Browsing

The Dewey Dashboard uses the effective merged dataset for the authenticated user and derives hierarchy from code prefixes, not `parent_code`.

Implemented Phase 3 browsing behavior:

- browse Dewey roots and child nodes
- search by code or caption
- open a node and view its breadcrumb path
- see child nodes for the selected area
- switch between exact-book matches and descendants mode
- browse books linked to the selected node

### Tree rules

- nearest broader existing prefix becomes the parent in the visible tree
- missing intermediate dataset nodes do not break the tree
- user-uploaded captions override default captions everywhere the node is shown

### Book matching modes

`exact`

- only books with `dewey_code` exactly equal to the selected code

`descendants`

- books with the selected code
- plus books whose Dewey path contains the selected code as a broader prefix

This means a valid stored Dewey code can still appear under a broader node even if that exact code is not an explicit node in the current dataset.
