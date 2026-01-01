# API Documentation

This guide describes the publicly available REST endpoints exposed by the API, the expected request payloads, and the standard response contract. All examples assume JSON request and response bodies.

- [API Documentation](#api-documentation)
  - [Logging](#logging)
  - [Standard Response Envelope](#standard-response-envelope)
    - [Success Response](#success-response)
    - [Error Response](#error-response)
    - [Envelope Fields](#envelope-fields)
  - [Rate Limiting](#rate-limiting)
  - [Shared Behaviours](#shared-behaviours)
  - [Endpoints](#endpoints)
    - [GET /](#get-)
  - [Authentication](#authentication)
    - [POST /auth/register](#post-authregister)
    - [POST /auth/resend-verification](#post-authresend-verification)
    - [POST /auth/verify-email](#post-authverify-email)
    - [POST /auth/login](#post-authlogin)
    - [POST /auth/refresh-token](#post-authrefresh-token)
    - [POST /auth/logout](#post-authlogout)
    - [POST /auth/request-password-reset](#post-authrequest-password-reset)
    - [POST /auth/reset-password](#post-authreset-password)
    - [POST /auth/google](#post-authgoogle)
  - [User Management](#user-management)
    - [GET /users/me](#get-usersme)
    - [PUT /users/me](#put-usersme)
    - [DELETE /users/me](#delete-usersme)
    - [POST /users/me/verify-delete](#post-usersmeverify-delete)
    - [POST /users/me/request-email-change](#post-usersmerequest-email-change)
    - [POST /users/me/verify-email-change](#post-usersmeverify-email-change)
    - [DELETE /users/me/request-account-deletion (also available as POST)](#delete-usersmerequest-account-deletion-also-available-as-post)
    - [POST /users/me/verify-account-deletion](#post-usersmeverify-account-deletion)
    - [GET /users/me/sessions](#get-usersmesessions)
    - [DELETE /users/me/sessions/:fingerprint](#delete-usersmesessionsfingerprint)
    - [POST /users/me/change-password](#post-usersmechange-password)
  - [Book Types](#book-types)
    - [GET /booktype](#get-booktype)
    - [GET /booktype/:id](#get-booktypeid)
    - [GET /booktype/by-name](#get-booktypeby-name)
    - [POST /booktype](#post-booktype)
    - [PUT /booktype](#put-booktype)
    - [PUT /booktype/:id](#put-booktypeid)
    - [DELETE /booktype](#delete-booktype)
    - [DELETE /booktype/:id](#delete-booktypeid)
  - [Authors](#authors)
    - [GET /author](#get-author)
    - [GET /author/:id](#get-authorid)
    - [GET /author/by-name](#get-authorby-name)
    - [POST /author](#post-author)
    - [PUT /author](#put-author)
    - [PUT /author/:id](#put-authorid)
    - [DELETE /author](#delete-author)
    - [DELETE /author/:id](#delete-authorid)
  - [Publishers](#publishers)
    - [GET /publisher](#get-publisher)
    - [GET /publisher/:id](#get-publisherid)
    - [GET /publisher/by-name](#get-publisherby-name)
    - [POST /publisher](#post-publisher)
    - [PUT /publisher](#put-publisher)
    - [PUT /publisher/:id](#put-publisherid)
    - [DELETE /publisher](#delete-publisher)
    - [DELETE /publisher/:id](#delete-publisherid)
  - [Book Series](#book-series)
    - [GET /bookseries](#get-bookseries)
    - [GET /bookseries/:id](#get-bookseriesid)
    - [GET /bookseries/by-name](#get-bookseriesby-name)
    - [POST /bookseries](#post-bookseries)
    - [PUT /bookseries](#put-bookseries)
    - [PUT /bookseries/:id](#put-bookseriesid)
    - [DELETE /bookseries](#delete-bookseries)
    - [DELETE /bookseries/:id](#delete-bookseriesid)
    - [POST /bookseries/link](#post-bookserieslink)
    - [PUT /bookseries/link](#put-bookserieslink)
    - [DELETE /bookseries/link](#delete-bookserieslink)
  - [Languages](#languages)
    - [GET /languages](#get-languages)
  - [Books](#books)
    - [GET /book](#get-book)
    - [POST /book](#post-book)
    - [PUT /book](#put-book)
    - [PUT /book/:id](#put-bookid)
    - [DELETE /book/:id](#delete-bookid)
  - [Storage Locations](#storage-locations)
    - [GET /storagelocation](#get-storagelocation)
    - [POST /storagelocation](#post-storagelocation)
    - [PUT /storagelocation](#put-storagelocation)
    - [PUT /storagelocation/:id](#put-storagelocationid)
    - [DELETE /storagelocation](#delete-storagelocation)
    - [DELETE /storagelocation/:id](#delete-storagelocationid)
  - [Book Copies](#book-copies)
    - [GET /bookcopy](#get-bookcopy)
    - [POST /bookcopy](#post-bookcopy)
    - [PUT /bookcopy](#put-bookcopy)
    - [PUT /bookcopy/:id](#put-bookcopyid)
    - [DELETE /bookcopy](#delete-bookcopy)
    - [DELETE /bookcopy/:id](#delete-bookcopyid)
  - [Tags](#tags)
    - [GET /tags](#get-tags)
  - [Admin](#admin)
    - [POST /admin/languages](#post-adminlanguages)
    - [PUT /admin/languages/:id](#put-adminlanguagesid)
    - [DELETE /admin/languages/:id](#delete-adminlanguagesid)


**Base URL:** `https://api.fjnel.co.za`

## Logging

The API writes structured JSON logs to rotating files. Every HTTP request is captured with an `event` of `HTTP_REQUEST`, together with the method, path, status code, latency, originating IP, user agent, and a sanitised copy of the request body. Significant actions (registration, login, logout, verification, password reset, profile changes) log an action-specific `event` such as `USER_REGISTERED` or `LOGIN_ATTEMPT`. Each log entry records a `status` (`SUCCESS`, `FAILURE`, or `INFO`) and a normalised `error_message` where applicable.

## Standard Response Envelope

All API responses (success or error) adhere to the same JSON envelope. Response times are reported in milliseconds as strings for readability.

### Success Response

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "14.62",
  "message": "Description of the outcome",
  "data": {
    "example": "Payload varies per endpoint"
  },
  "errors": []
}
```

### Error Response

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "9.81",
  "message": "High level error description",
  "data": {},
  "errors": [
    "Specific error detail 1.",
    "Specific error detail 2."
  ]
}
```

### Envelope Fields

- `status`: `"success"` or `"error"`.
- `httpCode`: Mirrors the HTTP status code returned by Express.
- `responseTime`: Milliseconds elapsed, formatted as a string with two decimals.
- `message`: High-level summary of the outcome.
- `data`: Object containing endpoint-specific payload (empty object on errors).
- `errors`: Array of human-readable error messages (empty on success).

## Rate Limiting

When a limit is exceeded the API returns HTTP `429` using the standard error envelope with `message` `"Too many requests"`.

| Endpoint | Limit | Window | Notes |
| --- | --- | --- | --- |
| `POST /auth/register` | 5 requests | 10 minutes | CAPTCHA required (`captchaToken`, action `register`). |
| `POST /auth/resend-verification` | 1 request | 5 minutes | CAPTCHA required (`captchaToken`, action `resend_verification`). |
| `POST /auth/login` | 10 requests | 10 minutes | CAPTCHA required (`captchaToken`, action `login`). |
| `POST /auth/request-password-reset` | 1 request | 5 minutes | CAPTCHA required (`captchaToken`, action `request_password_reset`). |
| `POST /auth/reset-password` | 1 request | 5 minutes | CAPTCHA required (`captchaToken`, action `reset_password`). |
| Sensitive user actions (`POST /users/me/verify-delete`, `/users/me/verify-account-deletion`, `/users/me/verify-email-change`, `/users/me/change-password`) | 3 requests | 5 minutes per IP | Protected by `sensitiveActionLimiter` + CAPTCHA. |
| Email-sending user actions (`DELETE /users/me`, `/users/me/request-email-change`, `/users/me/request-account-deletion` via `POST` or `DELETE`, `/users/me/change-password`, `/users/me/verify-*`) | 1 request | 5 minutes per IP | Additional `emailCostLimiter` applied to limit outbound email costs. |
| Authenticated endpoints (`/auth/logout`, `/users/*`, `/booktype/*`, `/author/*`, `/publisher/*`, `/bookseries/*`, `/languages`, `/book/*`, `/storagelocation/*`, `/bookcopy/*`, `/tags`, `/admin/*`) | 60 requests | 1 minute per authenticated user | Enforced by `authenticatedLimiter`; keyed by `user.id`. |

All other endpoints currently have no dedicated custom limit.

### Common Rate Limit Response (429)

```json
{
  "status": "error",
  "httpCode": 429,
  "responseTime": "2.12",
  "message": "Too many requests",
  "data": {},
  "errors": [
    "You have exceeded the maximum number of requests. Please try again later."
  ]
}
```

## Shared Behaviours

- **Authentication:** Routes guarded by `requiresAuth` return HTTP `401` with `message` `"Authentication required for this action."` when the Authorization header is missing or invalid. Disabled accounts receive HTTP `403` with `message` `"Your account has been disabled."`.
- **Role Checks:** Admin-only routes use `requireRole`. Non-admin users receive HTTP `403` with `message` `"Forbidden: Insufficient permissions."`.
- **Validation:** Validation failures respond with HTTP `400`, `message` `"Validation Error"`, and each issue listed in `errors`.
- **Global 404:** Unmatched routes return HTTP `404` with `message` `"Endpoint Not Found"` and guidance in `errors`.
- **Unhandled Errors:** Unexpected exceptions return HTTP `500`, `message` `"Internal Server Error"`, and a generic error list.
- **Account action quotas:** Authenticated flows that trigger emails also enforce daily per-account quotas: up to 2 password changes per day, 1 email change request per day, and 2 account disable or deletion requests per day (regardless of HTTP verb).
- **Password metadata:** Whenever the API returns a user profile (login, `/users/me`, profile updates), the payload includes `passwordUpdated`, an ISO timestamp describing the last password change, or `null` for OAuth-only accounts.
- **Login metadata:** User profiles include `lastLogin`, an ISO timestamp of the most recent successful login (regardless of login method).

### Partial Date Object

Some endpoints accept partial dates for fields like author birth/death dates, publisher founded dates, book publication dates, and acquisition dates. The API expects a partial date object in the following format:

```json
{
  "day": 23,
  "month": 10,
  "year": 2005,
  "text": "23 October 2005"
}
```

Rules:
- `day`, `month`, and `year` may be `null`, but `text` is required.
- If `day` is provided, `month` and `year` must also be provided.
- If `month` is provided, `year` must also be provided.
- `text` must match the provided values in English (`"23 October 2005"`, `"October 2005"`, or `"2005"`).

## Endpoints

Sample identifiers, tokens, timestamps, and IDs shown below are illustrative.

### GET /

- **Description:** Health check that confirms the API is reachable and returns the documentation link.
- **Authentication:** Not required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/` |
| Authentication | None |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Accept` | No | `application/json` | Responses are JSON by default. |
| `Authorization` | No | — | Not used. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| *(none)* | — | — | This endpoint does not accept a request body. |

- **Successful Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "1.08",
  "message": "The API is working!",
  "data": {
    "timestamp": "14/01/2025, 17:23:51",
    "api_documentation_url": "https://api.fjnel.co.za/api-docs.html"
  },
  "errors": []
}
```

---

## Authentication

Authentication flows combine email/password, Google OAuth, email verification, and password reset flows. Unless stated otherwise, authentication endpoints do not require an access token but do require the relevant CAPTCHA token.

### POST /auth/register

- **Purpose:** Create a new user account.
- **Authentication:** Not required.
- **Rate Limit:** 5 requests per 10 minutes per IP.
- **CAPTCHA:** Provide `captchaToken` validated against the `register` action.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/auth/register` |
| Authentication | None |
| Rate Limit | 5 requests / 10 minutes / IP |
| CAPTCHA Action | `register` (reCAPTCHA v3) |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "captchaToken": "<captcha-token>",
  "fullName": "Jane Doe",
  "preferredName": "Jane",
  "email": "jane@example.com",
  "password": "P@ssw0rd123!"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |
| `Authorization` | No | — | Not used. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `captchaToken` | string | Yes | reCAPTCHA v3 token for the `register` action. |
| `fullName` | string | Yes | 2–255 characters; letters plus spaces, hyphens, periods, apostrophes. |
| `preferredName` | string | No | 2–100 alphabetic characters; optional friendly name. |
| `email` | string | Yes | 5–255 characters; must be unique and in valid email format. |
| `password` | string | Yes | 10–100 characters; must include upper, lower, digit, and special character. |

- **Generic Success (200):** Returned both for new registrations and when an existing account needs verification so that email enumeration is prevented.

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "11.02",
  "message": "If this email can be registered, you will receive an email with the next steps shortly.",
  "data": {
    "disclaimer": "If you do not see an email within a few minutes, please check your spam folder or try again later."
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "7.41",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Full Name must be between 2 and 255 characters.",
    "Password must include at least one special character."
  ]
}
```

- **CAPTCHA Failure (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "5.44",
  "message": "CAPTCHA verification failed",
  "data": {},
  "errors": [
    "Please refresh the page and try again.",
    "Make sure that you provided a captchaToken in your request."
  ]
}
```

- **Token Issuance Failure (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "8.39",
  "message": "Failed to issue verification token",
  "data": {},
  "errors": [
    "Database connection lost"
  ]
}
```

- **Database Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "7.81",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while creating the user",
    "duplicate key value violates unique constraint \"users_email_key\""
  ]
}
```

### POST /auth/resend-verification

- **Purpose:** Re-send the verification email for an unverified account.
- **Authentication:** Not required.
- **Rate Limit:** 1 request per 5 minutes per IP.
- **CAPTCHA:** Provide `captchaToken` validated against the `resend_verification` action.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/auth/resend-verification` |
| Authentication | None |
| Rate Limit | 1 request / 5 minutes / IP |
| CAPTCHA Action | `resend_verification` |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "captchaToken": "<captcha-token>",
  "email": "jane@example.com"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |
| `Authorization` | No | — | Not used. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `captchaToken` | string | Yes | reCAPTCHA v3 token for the `resend_verification` action. |
| `email` | string | Yes | Email address to resend verification for; must be 5–255 chars and valid format. |

- **Generic Success (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.12",
  "message": "If you have registered an account with this email address and it is unverified, you will receive a verification email.",
  "data": {
    "disclaimer": "If you did not receive an email when you should have, please check your spam folder or try again later."
  },
  "errors": []
}
```

- **CAPTCHA Failure (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "5.27",
  "message": "CAPTCHA verification failed",
  "data": {},
  "errors": [
    "Please refresh the page and try again.",
    "Make sure that you provided a captchaToken in your request."
  ]
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.98",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Email must be provided."
  ]
}
```

### POST /auth/verify-email

- **Purpose:** Mark a user as verified using the token emailed during registration.
- **Authentication:** Not required.
- **Rate Limit:** Not currently rate limited beyond CAPTCHA.
- **CAPTCHA:** Provide `captchaToken` validated against the `verify_email` action.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/auth/verify-email` |
| Authentication | None |
| Rate Limit | Not currently rate limited |
| CAPTCHA Action | `verify_email` |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "email": "jane@example.com",
  "token": "<verification-token>"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |
| `Authorization` | No | — | Not used. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `captchaToken` | string | Yes | reCAPTCHA v3 token for the `verify_email` action. |
| `email` | string | Yes | Email address to verify (5–255 characters, valid format). |
| `token` | string | Yes | Email verification token (32-byte hex string). |

- **Verified (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "6.84",
  "message": "Email verified successfully. You can now log in.",
  "data": {
    "id": "b6df9c94-91b3-4ea7-ac37-4f5b8d2c8d1e",
    "email": "jane@example.com"
  },
  "errors": []
}
```

- **Already Verified (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "4.56",
  "message": "Email already verified. You can log in.",
  "data": {
    "id": "b6df9c94-91b3-4ea7-ac37-4f5b8d2c8d1e",
    "email": "jane@example.com"
  },
  "errors": []
}
```

- **CAPTCHA Failure (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "5.73",
  "message": "CAPTCHA verification failed",
  "data": {},
  "errors": [
    "Please refresh the page and try again.",
    "Make sure that you provided a captchaToken in your request."
  ]
}
```

- **Invalid Token or Email (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "7.03",
  "message": "Token expired or incorrect email address",
  "data": {},
  "errors": [
    "The provided token is invalid, has expired, or the email address is incorrect.",
    "Please request a new verification email."
  ]
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "6.22",
  "message": "Token expired or incorrect email address",
  "data": {},
  "errors": [
    "Email must be provided.",
    "A valid verification token must be provided."
  ]
}
```

- **Database Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "9.64",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while verifying your email. Please try again."
  ]
}
```

- **Internal Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "8.77",
  "message": "Internal Server Error",
  "data": {},
  "errors": [
    "An error occurred while verifying your email. Please try again."
  ]
}
```

### POST /auth/login

- **Purpose:** Authenticate with email and password and issue access/refresh tokens.
- **Authentication:** Not required.
- **Rate Limit:** 10 requests per 10 minutes per IP.
- **CAPTCHA:** Provide `captchaToken` validated against the `login` action.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/auth/login` |
| Authentication | None |
| Rate Limit | 10 requests / 10 minutes / IP |
| CAPTCHA Action | `login` |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "captchaToken": "<captcha-token>",
  "email": "jane@example.com",
  "password": "P@ssw0rd123!"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |
| `Authorization` | No | — | Not used. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `captchaToken` | string | Yes | reCAPTCHA v3 token for the `login` action. |
| `email` | string | Yes | Email address of the user (case-insensitive). |
| `password` | string | Yes | Plain-text password to verify; not stored. |

- **Authenticated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "18.02",
  "message": "Login successful.",
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "user": {
      "id": "b6df9c94-91b3-4ea7-ac37-4f5b8d2c8d1e",
      "email": "jane@example.com",
      "fullName": "Jane Doe",
      "preferredName": "Jane",
      "role": "user",
      "isVerified": true,
      "passwordUpdated": "2024-07-11T10:22:33.000Z",
      "lastLogin": "2025-01-17T09:20:11.000Z"
    }
  },
  "errors": []
}
```

- **Invalid Credentials (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "6.51",
  "message": "Invalid email or password.",
  "data": {},
  "errors": [
    "The provided email or password is incorrect"
  ]
}
```

- **CAPTCHA Failure (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "5.18",
  "message": "CAPTCHA verification failed",
  "data": {},
  "errors": [
    "Please refresh the page and try again.",
    "Make sure that you provided a captchaToken in your request."
  ]
}
```

- **Account Disabled (403):**

```json
{
  "status": "error",
  "httpCode": 403,
  "responseTime": "4.92",
  "message": "Your account has been disabled.",
  "data": {},
  "errors": [
    "Please contact the system administrator if you believe this is a mistake."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "10.44",
  "message": "Internal Server Error",
  "data": {},
  "errors": [
    "An error occurred during login. Please try again."
  ]
}
```

### POST /auth/refresh-token

- **Purpose:** Exchange a valid refresh token for a new access token.
- **Authentication:** Not required (the refresh token provides trust).

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/auth/refresh-token` |
| Authentication | Not required |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "refreshToken": "<refresh-token>"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |
| `Authorization` | No | — | Not used. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `refreshToken` | string (JWT) | Yes | Refresh token previously issued by `/auth/login` or `/auth/google`. |

- **Refreshed (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "7.81",
  "message": "Access token refreshed.",
  "data": {
    "accessToken": "<jwt>"
  },
  "errors": []
}
```

- **Missing Token (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.07",
  "message": "Refresh token required",
  "data": {},
  "errors": [
    "Please provide a valid refresh token in the request body."
  ]
}
```

- **Invalid or Revoked Token (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "6.35",
  "message": "Invalid refresh token",
  "data": {},
  "errors": [
    "The provided refresh token is invalid or has expired."
  ]
}
```

- **Token User Missing (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "6.90",
  "message": "Invalid refresh token",
  "data": {},
  "errors": [
    "User associated with token not found."
  ]
}
```

- **Account Disabled (403):**

```json
{
  "status": "error",
  "httpCode": 403,
  "responseTime": "6.22",
  "message": "Your account has been disabled.",
  "data": {},
  "errors": [
    "Please contact the system administrator if you believe this is a mistake."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "8.58",
  "message": "Internal Server Error",
  "data": {},
  "errors": [
    "An error occurred while refreshing the access token."
  ]
}
```

### POST /auth/logout

- **Purpose:** Revoke one or all active refresh tokens for the authenticated user.
- **Authentication:** Access token required (`Authorization: Bearer <accessToken>`).
- **Rate Limit:** 60 requests per minute per authenticated user.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/auth/logout` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user + 1 request / 5 minutes / IP (email cost) + 2 requests / day / account |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "refreshToken": "<refresh-token>",
  "allDevices": false
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Access token generated by `/auth/login` or `/auth/google`. |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `refreshToken` | string (JWT) | Conditionally | Required unless `allDevices` is provided; identifies the session to revoke. |
| `allDevices` | boolean \| string | No | Set to `true`, `1`, `"true"`, `"1"`, or `"all"` to revoke every active session without supplying `refreshToken`. |

Set `allDevices` truthy (`true`, `"true"`, `1`, `"1"`, or `"all"`) to revoke every active session without supplying a refresh token.

- **Single Session Logout (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "5.94",
  "message": "Logged out successfully.",
  "data": {
    "scope": "single",
    "revokedSessions": 1
  },
  "errors": []
}
```

- **All Sessions Logout (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "6.12",
  "message": "Logged out successfully.",
  "data": {
    "scope": "all",
    "revokedSessions": 5
  },
  "errors": []
}
```

- **Missing Refresh Token (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.31",
  "message": "Refresh token required",
  "data": {},
  "errors": [
    "Please provide a valid refresh token in the request body."
  ]
}
```

- **Invalid Refresh Token (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "5.49",
  "message": "Invalid refresh token",
  "data": {},
  "errors": [
    "The provided refresh token is invalid or has expired."
  ]
}
```

- **Forbidden Session (403):**

```json
{
  "status": "error",
  "httpCode": 403,
  "responseTime": "5.17",
  "message": "Forbidden",
  "data": {},
  "errors": [
    "You can only log out your own session.",
    "The access token and refresh token do not belong to the same user."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "7.95",
  "message": "Internal Server Error",
  "data": {},
  "errors": [
    "An error occurred while logging out. Please try again."
  ]
}
```

### POST /auth/request-password-reset

- **Purpose:** Send a password reset email if the account exists.
- **Authentication:** Not required.
- **Rate Limit:** 1 request per 5 minutes per IP.
- **CAPTCHA:** Provide `captchaToken` validated against the `request_password_reset` action.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/auth/request-password-reset` |
| Authentication | None |
| Rate Limit | 1 request / 5 minutes / IP |
| CAPTCHA Action | `request_password_reset` |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "captchaToken": "<captcha-token>",
  "email": "jane@example.com"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |
| `Authorization` | No | — | Not used. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `captchaToken` | string | Yes | reCAPTCHA v3 token for the `request_password_reset` action. |
| `email` | string | Yes | Email address to send the password reset link to. |

- **Generic Success (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.84",
  "message": "If you have registered an account with this email address, you will receive a password reset email.",
  "data": {
    "disclaimer": "If you did not receive an email when you should have, please check your spam folder or try again later."
  },
  "errors": []
}
```

- **CAPTCHA Failure (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "5.09",
  "message": "CAPTCHA verification failed",
  "data": {},
  "errors": [
    "Please refresh the page and try again.",
    "Make sure that you provided a captchaToken in your request."
  ]
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.88",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Email must be provided."
  ]
}
```

> **Note:** Unexpected errors still respond with the same generic `200` envelope to avoid leaking account existence.

### POST /auth/reset-password

- **Purpose:** Reset the account password using the emailed token.
- **Authentication:** Not required.
- **Rate Limit:** 1 request per 5 minutes per IP.
- **CAPTCHA:** Provide `captchaToken` validated against the `reset_password` action.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/auth/reset-password` |
| Authentication | None |
| Rate Limit | 1 request / 5 minutes / IP |
| CAPTCHA Action | `reset_password` |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "email": "jane@example.com",
  "token": "<reset-token>",
  "newPassword": "NewP@ssw0rd123!"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |
| `Authorization` | No | — | Not used. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `captchaToken` | string | Yes | reCAPTCHA v3 token for the `reset_password` action. |
| `email` | string | Yes | Email address associated with the password reset request. |
| `token` | string | Yes | Password-reset token sent via email (32-byte hex). |
| `newPassword` | string | Yes | 10–100 characters, including upper, lower, digit, and special character. |

- **Password Reset (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "9.42",
  "message": "Password reset successfully. You can now log in.",
  "data": {
    "id": "b6df9c94-91b3-4ea7-ac37-4f5b8d2c8d1e",
    "email": "jane@example.com",
    "passwordUpdated": "2025-01-17T09:02:44.000Z"
  },
  "errors": []
}
```

- **CAPTCHA Failure (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "5.26",
  "message": "CAPTCHA verification failed",
  "data": {},
  "errors": [
    "Please refresh the page and try again.",
    "Make sure that you provided a captchaToken in your request."
  ]
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "6.91",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "A valid password reset token must be provided.",
    "Password must include at least one special character."
  ]
}
```

- **Invalid Token or Email (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "6.74",
  "message": "Token expired or incorrect email address",
  "data": {},
  "errors": [
    "The provided token is invalid, has expired, or the email address is incorrect.",
    "Please request a new password reset email."
  ]
}
```

- **Database Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "8.54",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while resetting your password. Please try again."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "8.97",
  "message": "Internal Server Error",
  "data": {},
  "errors": [
    "An error occurred while resetting your password. Please try again."
  ]
}
```

### POST /auth/google

- **Purpose:** Sign up or sign in a user using a verified Google ID token.
- **Authentication:** Not required.
- **Request Body:**

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/auth/google` |
| Authentication | None |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "idToken": "<google-id-token>"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |
| `Authorization` | No | — | Not used. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `idToken` | string | Yes | ID token returned by Google OAuth (must be for the configured client ID). |

- **Authenticated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "19.77",
  "message": "Login successful.",
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "user": {
      "id": "b6df9c94-91b3-4ea7-ac37-4f5b8d2c8d1e",
      "email": "jane@example.com",
      "fullName": "Jane Doe",
      "preferredName": "Jane",
      "role": "user",
      "isVerified": true,
      "passwordUpdated": null,
      "lastLogin": "2025-01-17T09:20:11.000Z"
    }
  },
  "errors": []
}
```

- **ID Token Missing (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.71",
  "message": "ID token required",
  "data": {},
  "errors": [
    "Please provide a valid Google ID token in the request body."
  ]
}
```

- **Invalid ID Token (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "6.08",
  "message": "Invalid ID token",
  "data": {},
  "errors": [
    "The provided Google ID token is invalid."
  ]
}
```

- **Email Not Verified by Google (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "5.33",
  "message": "Email not verified by Google",
  "data": {},
  "errors": [
    "Your Google account email is not verified. Please verify your email with Google before signing in."
  ]
}
```

- **Missing Google User ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "5.12",
  "message": "Invalid Google profile: No user ID",
  "data": {},
  "errors": [
    "Could not retrieve valid user ID from Google profile."
  ]
}
```

- **Incomplete Google Profile (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "5.76",
  "message": "Incomplete Google profile",
  "data": {},
  "errors": [
    "Your Google profile is missing required information.",
    "Please ensure your Google account has an email address and name associated with it.",
    "Or, if you still have issues, please register/login manually."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "9.11",
  "message": "Internal Server Error",
  "data": {},
  "errors": [
    "An error occurred during Google login. Please try again."
  ]
}
```

---

## User Management

All user management endpoints require a valid access token (`Authorization: Bearer <accessToken>`) and are subject to the `authenticatedLimiter` (60 requests per minute per user).

### GET /users/me

- **Purpose:** Retrieve the authenticated user's profile and connected OAuth providers.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/users/me` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Access token generated by `/auth/login` or `/auth/google`. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| *(none)* | — | — | This endpoint does not accept a request body. |

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "4.73",
  "message": "User profile retrieved successfully.",
  "data": {
    "id": "b6df9c94-91b3-4ea7-ac37-4f5b8d2c8d1e",
    "email": "jane@example.com",
    "fullName": "Jane Doe",
    "preferredName": "Jane",
    "role": "user",
    "isVerified": true,
    "passwordUpdated": "2025-01-15T11:01:11.000Z",
    "lastLogin": "2025-01-17T09:20:11.000Z",
    "oauthProviders": [
      "google"
    ],
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **User Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "5.67",
  "message": "User not found.",
  "data": {},
  "errors": [
    "The requested user record could not be located."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "8.13",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the user profile."
  ]
}
```

### PUT /users/me

- **Purpose:** Update `fullName` and/or `preferredName`. To change the email or password, use the dedicated endpoints.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/users/me` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "fullName": "Jane Q. Doe",
  "preferredName": "Jan"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Access token generated by `/auth/login` or `/auth/google`. |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `fullName` | string | Conditionally | 2–255 characters; letters plus spaces, hyphens, periods, apostrophes. |
| `preferredName` | string | Conditionally | 2–100 alphabetic characters (letters only). |

At least one of `fullName` or `preferredName` must be provided.

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "6.41",
  "message": "User profile updated successfully.",
  "data": {
    "id": "b6df9c94-91b3-4ea7-ac37-4f5b8d2c8d1e",
    "email": "jane@example.com",
    "fullName": "Jane Q. Doe",
    "preferredName": "Jan",
    "role": "user",
    "isVerified": true,
    "passwordUpdated": "2025-01-15T11:01:11.000Z",
    "lastLogin": "2025-01-17T09:20:11.000Z",
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-17T08:44:02.000Z"
  },
  "errors": []
}
```

- **No Fields Provided (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.21",
  "message": "No changes were provided.",
  "data": {},
  "errors": [
    "Please provide at least one field to update."
  ]
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.92",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Preferred Name must be between 2 and 100 characters."
  ]
}
```

- **User Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "5.33",
  "message": "User not found.",
  "data": {},
  "errors": [
    "The requested user record could not be located."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "8.26",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the user profile."
  ]
}
```

### DELETE /users/me

- **Purpose:** Initiate a soft-delete. Sends a confirmation link to the account email; the account is disabled only after the link is confirmed.
- **Daily Quota:** Maximum of two disable requests per account per rolling 24 hours.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/users/me` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Required to identify the user being disabled. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| *(none)* | — | — | This endpoint does not accept a request body. |

- **Requested (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "6.07",
  "message": "Check your email to confirm this action.",
  "data": {
    "disclaimer": "Your account will remain active until you confirm the disable request via the link we sent."
  },
  "errors": []
}
```

- **User Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "5.48",
  "message": "User not found.",
  "data": {},
  "errors": [
    "The requested user record could not be located."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "8.44",
  "message": "Internal Server Error",
  "data": {},
  "errors": [
    "An error occurred while requesting the account disable action."
  ]
}
```

### POST /users/me/verify-delete

- **Purpose:** Confirms the disable request using the emailed token, validates the user’s email, and revokes all active sessions.
- **Authentication:** Not required (token + email based); protected by CAPTCHA.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/users/me/verify-delete` |
| Authentication | None |
| Rate Limit | 3 requests / 5 minutes / IP |
| CAPTCHA Action | `verify_delete` |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "token": "<verification-token>",
  "email": "jane@example.com",
  "captchaToken": "<captcha-token>"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | Yes | Token supplied in the disable-confirmation email. |
| `email` | string | Yes | Must match the account email that requested disable. |
| `captchaToken` | string | Yes | reCAPTCHA v3 token for action `verify_delete`. |

*Security note: If the supplied email or CAPTCHA token does not match the pending request, the API returns the same error as an invalid or expired token.*

- **Confirmed (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "5.01",
  "message": "Your account has been disabled.",
  "data": {
    "disclaimer": "If you need to reactivate the account, please contact support."
  },
  "errors": []
}
```

- **Invalid Token / Email (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.44",
  "message": "Invalid or expired token",
  "data": {},
  "errors": [
    "The confirmation token is invalid, has expired, or the supplied information does not match this request."
  ]
}
```

### POST /users/me/request-email-change

- **Purpose:** Initiate an email change for the authenticated user. Sends a verification link to the new email address. The user is signed out everywhere once the new email is confirmed.
- **Daily Quota:** Only one email change request can be initiated per account per day.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/users/me/request-email-change` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user + 1 request / 5 minutes / IP (email cost) + 1 request / day / account |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "newEmail": "jane.new@example.com"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Identifies the user requesting the change. |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `newEmail` | string | Yes | Desired email address; must pass the same validation as registration. |

- **Generic Success (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "4.32",
  "message": "If this email can be used, you will receive a confirmation link shortly.",
  "data": {
    "disclaimer": "You will be signed out on all devices once the new email is verified."
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.12",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "The new email address must be different from your current email."
  ]
}
```

### POST /users/me/verify-email-change

- **Purpose:** Confirms the pending email change using the token sent to the new email address. Requires the user’s current email, the new email, password confirmation, and a CAPTCHA check before revoking sessions and removing OAuth links.
- **Authentication:** Not required (token + credentials); protected by CAPTCHA.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/users/me/verify-email-change` |
| Authentication | None |
| Rate Limit | 3 requests / 5 minutes / IP |
| CAPTCHA Action | `verify_email_change` |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "token": "<verification-token>",
  "oldEmail": "jane@example.com",
  "newEmail": "jane.new@example.com",
  "password": "P@ssw0rd123!",
  "captchaToken": "<captcha-token>"
}
```

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | Yes | Token from the verification email. |
| `oldEmail` | string | Yes | Must match the current account email. |
| `newEmail` | string | Yes | Must match the email that initiated the change. |
| `password` | string | Yes | Confirms the user controls the account. |
| `captchaToken` | string | Yes | reCAPTCHA v3 token for action `verify_email_change`. |

*Security note: Incorrect email, password, or CAPTCHA data yields the same error as an invalid token to prevent email enumeration.*

- **Confirmed (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "4.85",
  "message": "Your email address has been updated.",
  "data": {
    "disclaimer": "Please log in with your new email address. You have been signed out on all devices."
  },
  "errors": []
}
```

- **Invalid Token / Data (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.02",
  "message": "Invalid or expired token",
  "data": {},
  "errors": [
    "The confirmation token is invalid, has expired, or the supplied information does not match this request."
  ]
}
```

### DELETE /users/me/request-account-deletion (also available as POST)

- **Purpose:** Starts the permanent deletion workflow. Sends a confirmation link to the account email. After confirmation, support (support@fjnel.co.za) is notified with the account details needed to complete the deletion.
- **Daily Quota:** Up to two deletion requests per account per day (shared between `DELETE` and `POST` clients).
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` (legacy clients may still use `POST`) |
| Path | `/users/me/request-account-deletion` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user + 1 request / 5 minutes / IP (email cost) + 2 requests / day / account |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Identifies the user requesting deletion. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| *(none)* | — | — | No request body is accepted. |

- **Requested (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "4.77",
  "message": "Check your email to confirm this deletion request.",
  "data": {
    "disclaimer": "Our support team will only be notified after you confirm via the email link."
  },
  "errors": []
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "7.65",
  "message": "Internal Server Error",
  "data": {},
  "errors": [
    "An error occurred while requesting account deletion."
  ]
}
```

### POST /users/me/verify-account-deletion

- **Purpose:** Confirms the deletion request using the emailed token, validates the user’s credentials, and notifies support so the deletion can be processed manually.
- **Authentication:** Not required (token + credentials); protected by CAPTCHA.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/users/me/verify-account-deletion` |
| Authentication | None |
| Rate Limit | 3 requests / 5 minutes / IP |
| CAPTCHA Action | `verify_account_deletion` |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "token": "<verification-token>",
  "email": "jane@example.com",
  "password": "P@ssw0rd123!",
  "confirm": true,
  "captchaToken": "<captcha-token>"
}
```

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | Yes | Token supplied in the deletion-confirmation email. |
| `email` | string | Yes | Must match the account requesting deletion. |
| `password` | string | Yes | Must match the current account password. |
| `confirm` | boolean | Yes | Must be `true` to acknowledge the permanent deletion. |
| `captchaToken` | string | Yes | reCAPTCHA v3 token for action `verify_account_deletion`. |

*Security note: Invalid email, password, or confirmation values produce the same response as an expired token.*

- **Confirmed (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "4.23",
  "message": "Your request has been forwarded to our support team.",
  "data": {
    "disclaimer": "Support will reach out on the confirmed email address to finalize the deletion."
  },
  "errors": []
}
```

- **Invalid Token / Credentials (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.01",
  "message": "Invalid or expired token",
  "data": {},
  "errors": [
    "The confirmation token is invalid, has expired, or the supplied information does not match this request."
  ]
}
```

### GET /users/me/sessions

- **Purpose:** List the authenticated user’s active refresh-token sessions, including device, browser, IP hint, and remaining lifetime.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/users/me/sessions` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Identifies the user whose sessions are being listed. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| *(none)* | — | — | This endpoint does not accept a request body. |

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "5.31",
  "message": "Active sessions retrieved.",
  "data": {
    "sessions": [
      {
        "fingerprint": "f17bb6df-d94b-4d85-88de-3c8280dcfd9e",
        "issuedAt": "2025-01-17T08:30:00.000Z",
        "expiresAt": "2025-01-24T08:30:00.000Z",
        "expiresInSeconds": 543210,
        "ipAddress": "203.0.113.24",
        "locationHint": "IP 203.0.113.24",
        "browser": "Chrome",
        "device": "Desktop",
        "operatingSystem": "Windows",
        "rawUserAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ..."
      },
      {
        "fingerprint": "6b9d3caa-1d7e-4f91-9d39-6a74073ca21c",
        "issuedAt": "2025-01-16T19:04:11.000Z",
        "expiresAt": "2025-01-23T19:04:11.000Z",
        "expiresInSeconds": 302515,
        "ipAddress": null,
        "locationHint": "Unknown",
        "browser": "Safari",
        "device": "Mobile",
        "operatingSystem": "iOS",
        "rawUserAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 ..."
      }
    ]
  },
  "errors": []
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "7.44",
  "message": "Internal Server Error",
  "data": {},
  "errors": [
    "Unable to retrieve sessions at this time."
  ]
}
```

### DELETE /users/me/sessions/:fingerprint

- **Purpose:** Revoke a single refresh-token session (for example, to sign out a lost or unattended device). Fingerprints are returned by `GET /users/me/sessions`.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/users/me/sessions/:fingerprint` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Identifies the requesting user. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Path Parameters

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `fingerprint` | string | Yes | Token fingerprint returned by the session listing endpoint. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| *(none)* | — | — | Provide the fingerprint via the path parameter. |

- **Session Revoked (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "4.78",
  "message": "Session revoked.",
  "data": {
    "fingerprint": "f17bb6df-d94b-4d85-88de-3c8280dcfd9e",
    "wasRevoked": true
  },
  "errors": []
}
```

- **Session Already Inactive (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "4.02",
  "message": "Session not found or already inactive.",
  "data": {
    "fingerprint": "6b9d3caa-1d7e-4f91-9d39-6a74073ca21c",
    "wasRevoked": false
  },
  "errors": []
}
```

- **Invalid Fingerprint (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "3.61",
  "message": "Invalid session identifier",
  "data": {},
  "errors": [
    "A session fingerprint must be provided in the URL path."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "6.01",
  "message": "Internal Server Error",
  "data": {},
  "errors": [
    "Unable to revoke the requested session."
  ]
}
```

### POST /users/me/change-password

- **Purpose:** Allows an authenticated user to update their password without email verification. Requires the current password, a compliant new password, and a CAPTCHA check. All active sessions are revoked and the user receives a confirmation email.
- **Daily Quota:** A user can change their password via this endpoint up to twice per day.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/users/me/change-password` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 3 requests / 5 minutes / user + 1 request / 5 minutes / IP (email cost) + 2 requests / day / account |
| CAPTCHA Action | `change_password` |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "currentPassword": "P@ssw0rd123!",
  "newPassword": "N3wP@ssw0rd123!",
  "captchaToken": "<captcha-token>"
}
```

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Identifies the signed-in user. |
| `Content-Type` | Yes | `application/json` | Body must be JSON encoded. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `currentPassword` | string | Yes | Must match the user’s existing password. |
| `newPassword` | string | Yes | 10–100 characters with upper, lower, digit, special character. |
| `captchaToken` | string | Yes | reCAPTCHA v3 token for action `change_password`. |

- **Successful Change (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "6.02",
  "message": "Password updated successfully.",
  "data": {
    "passwordUpdated": "2025-01-17T09:02:44.000Z",
    "disclaimer": "You have been signed out on all devices. Please log in using your new password."
  },
  "errors": []
}
```

- **Invalid Current Password (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "4.67",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "The current password provided is incorrect."
  ]
}
```

---

## Book Types

Book types are scoped per user. Each account starts with two defaults: `Hardcover` and `Softcover`.

### GET /booktype

- **Purpose:** Retrieve all book types for the authenticated user.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/booktype` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "nameOnly": false,
  "sortBy": "name",
  "order": "asc",
  "limit": 50,
  "offset": 0,
  "filterName": "Hard",
  "filterCreatedAfter": "2024-01-01"
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `nameOnly` | boolean | No | When true, returns only `id` and `name`. Defaults to `false`. |
| `sortBy` | string | No | Sort field for lists. Defaults to `name`. |
| `order` | string | No | Sort direction (`asc` or `desc`). Defaults to `asc`. |
| `limit` | integer | No | Limits list results (1-200). |
| `offset` | integer | No | Offset for list pagination (0+). |
| `filterId` | integer | No | Filter list by exact id. |
| `filterName` | string | No | Case-insensitive partial match on name. |
| `filterDescription` | string | No | Case-insensitive partial match on description. |
| `filterCreatedAt` | string | No | ISO date/time match for `createdAt`. |
| `filterUpdatedAt` | string | No | ISO date/time match for `updatedAt`. |
| `filterCreatedAfter` | string | No | ISO date/time lower bound for `createdAt`. |
| `filterCreatedBefore` | string | No | ISO date/time upper bound for `createdAt`. |
| `filterUpdatedAfter` | string | No | ISO date/time lower bound for `updatedAt`. |
| `filterUpdatedBefore` | string | No | ISO date/time upper bound for `updatedAt`. |

`sortBy` accepts: `id`, `name`, `description`, `createdAt`, `updatedAt`.

You can provide these list controls via query string or JSON body. If both are provided, the JSON body takes precedence.

#### Common Examples

- **All book types containing "cover", sorted by updated date (desc), limit 10:**

```json
{
  "filterName": "cover",
  "sortBy": "updatedAt",
  "order": "desc",
  "limit": 10
}
```

Query string equivalent:

```
GET /booktype?filterName=cover&sortBy=updatedAt&order=desc&limit=10
```

#### Optional Lookup (query or body)

When `id` or `name` is provided (query string or JSON body), the endpoint returns a single book type instead of a list.

Use the `filter...` parameters for list filtering to avoid conflicts with the single-record lookup.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | integer | No | Book type id to fetch. |
| `name` | string | No | Book type name to fetch. |

If both `id` and `name` are provided, the API uses `id` and ignores `name`.

- **Response (200, list):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.21",
  "message": "Book types retrieved successfully.",
  "data": {
    "bookTypes": [
      {
        "id": 1,
        "name": "Hardcover",
        "description": "Hardback edition with rigid cover.",
        "createdAt": "2025-01-10T09:15:23.000Z",
        "updatedAt": "2025-01-14T16:58:41.000Z"
      }
    ]
  },
  "errors": []
}
```

- **Response (200, nameOnly=true):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.91",
  "message": "Book types retrieved successfully.",
  "data": {
    "bookTypes": [
      {
        "id": 1,
        "name": "Hardcover"
      }
    ]
  },
  "errors": []
}
```

- **Response (200, single result):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Book type retrieved successfully.",
  "data": {
    "id": 1,
    "name": "Hardcover",
    "description": "Hardback edition with rigid cover.",
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.05",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Book Type Name must be provided."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book type not found.",
  "data": {},
  "errors": [
    "The requested book type could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the author."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the author."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the author."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the author."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the author."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "6.24",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving book types."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.31",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

### GET /booktype/:id

- **Purpose:** Retrieve a specific book type by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/booktype/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.02",
  "message": "Book type retrieved successfully.",
  "data": {
    "id": 2,
    "name": "Softcover",
    "description": null,
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Book type id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book type not found.",
  "data": {},
  "errors": [
    "The requested book type could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the book type."
  ]
}
```

### GET /booktype/by-name

- **Purpose:** Retrieve a specific book type by name.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/booktype/by-name` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "name": "Hardcover",
  "nameOnly": false
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | Yes | Book type name to look up (query string or JSON body). |

If `name` is provided in both the query string and JSON body, the JSON body takes precedence.

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Book type retrieved successfully.",
  "data": {
    "id": 1,
    "name": "Hardcover",
    "description": "Hardback edition with rigid cover.",
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.05",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Book Type Name must be provided."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book type not found.",
  "data": {},
  "errors": [
    "The requested book type could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the book type."
  ]
}
```

### POST /booktype

- **Purpose:** Create a new book type for the authenticated user.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/booktype` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "name": "Hardcover",
  "description": "Standard hardcover binding."
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | 2–100 characters; letters, numbers, spaces, and basic punctuation. |
| `description` | string | No | Optional description (<= 1000 characters). |

- **Created (201):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "4.33",
  "message": "Book type created successfully.",
  "data": {
    "id": 10,
    "name": "Hogwarts Illustrated Edition",
    "description": "Harry Potter special edition with illustrations.",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:02:11.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Language name must be between 2 and 100 characters."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Language already exists.",
  "data": {},
  "errors": [
    "A language with this name already exists."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Forbidden (403):**

```json
{
  "status": "error",
  "httpCode": 403,
  "responseTime": "2.18",
  "message": "Forbidden: Insufficient permissions.",
  "data": {},
  "errors": [
    "Admin privileges are required for this action."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while creating the language."
  ]
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Book Type Name must be between 2 and 100 characters."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Book type already exists.",
  "data": {},
  "errors": [
    "A book type with this name already exists."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while creating the book type."
  ]
}
```

### PUT /booktype/:id

- **Purpose:** Update a book type.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/booktype/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "name": "Hardcover",
  "description": "Updated description."
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | No | Updated name. |
| `description` | string | No | Updated description (<= 1000 characters). |

At least one field must be provided.

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.92",
  "message": "Book type updated successfully.",
  "data": {
    "id": 10,
    "name": "Hogwarts Illustrated Edition",
    "description": "Harry Potter special edition with illustrations.",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:05:48.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Language name must be between 2 and 100 characters."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Language not found.",
  "data": {},
  "errors": [
    "The requested language could not be located."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Language already exists.",
  "data": {},
  "errors": [
    "A language with this name already exists."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Forbidden (403):**

```json
{
  "status": "error",
  "httpCode": 403,
  "responseTime": "2.18",
  "message": "Forbidden: Insufficient permissions.",
  "data": {},
  "errors": [
    "Admin privileges are required for this action."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the language."
  ]
}
```

- **No Fields Provided (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.30",
  "message": "No changes were provided.",
  "data": {},
  "errors": [
    "Please provide at least one field to update."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book type not found.",
  "data": {},
  "errors": [
    "The requested book type could not be located."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Book type already exists.",
  "data": {},
  "errors": [
    "A book type with this name already exists."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the book type."
  ]
}
```

### PUT /booktype

- **Purpose:** Update a book type by `id` or `name`.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/booktype` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "id": 1,
  "name": "Hardcover",
  "description": "Updated description."
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | Conditional | The book type id to update. |
| `targetName` | string | Conditional | The current book type name to update (used to identify the record). |
| `name` | string | No | New name to apply. |
| `description` | string | No | Updated description (<= 1000 characters). |

At least one of `id` or `targetName` must be provided to identify the record, and at least one updatable field must be included.

If both `id` and `targetName` are provided, the API uses `id` and ignores `targetName`.

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.92",
  "message": "Book type updated successfully.",
  "data": {
    "id": 10,
    "name": "Hogwarts Illustrated Edition",
    "description": "Harry Potter special edition with illustrations.",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:05:48.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide a book type id or name to update."
  ]
}
```

- **No Fields Provided (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.30",
  "message": "No changes were provided.",
  "data": {},
  "errors": [
    "Please provide at least one field to update."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book type not found.",
  "data": {},
  "errors": [
    "The requested book type could not be located."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Book type already exists.",
  "data": {},
  "errors": [
    "A book type with this name already exists."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the book type."
  ]
}
```

### DELETE /booktype

- **Purpose:** Delete a book type by `id` or `name`.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/booktype` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "id": 1
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | Conditional | The book type id to delete. |
| `name` | string | Conditional | The book type name to delete. |

At least one of `id` or `name` must be provided.

If both `id` and `name` are provided, the API uses `id` and ignores `name`.

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Book type deleted successfully.",
  "data": {
    "id": 10
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Language id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Language not found.",
  "data": {},
  "errors": [
    "The requested language could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Forbidden (403):**

```json
{
  "status": "error",
  "httpCode": 403,
  "responseTime": "2.18",
  "message": "Forbidden: Insufficient permissions.",
  "data": {},
  "errors": [
    "Admin privileges are required for this action."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the language."
  ]
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide a book type id or name to delete."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book type not found.",
  "data": {},
  "errors": [
    "The requested book type could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the book type."
  ]
}
```

### DELETE /booktype/:id

- **Purpose:** Delete a book type owned by the authenticated user.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/booktype/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Book type deleted successfully.",
  "data": {
    "id": 10
  },
  "errors": []
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book type not found.",
  "data": {},
  "errors": [
    "The requested book type could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the book type."
  ]
}
```

## Authors

Authors are scoped per user and can be linked to books later via a linking table. Dates use the partial date object described below.

### GET /author

- **Purpose:** Retrieve all authors for the authenticated user.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/author` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "nameOnly": false,
  "sortBy": "displayName",
  "order": "asc",
  "limit": 50,
  "offset": 0,
  "filterDeceased": true,
  "filterBirthYear": 1950
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `nameOnly` | boolean | No | When true, returns only `id` and `displayName`. Defaults to `false`. |
| `sortBy` | string | No | Sort field for lists. Defaults to `displayName`. |
| `order` | string | No | Sort direction (`asc` or `desc`). Defaults to `asc`. |
| `limit` | integer | No | Limits list results (1-200). |
| `offset` | integer | No | Offset for list pagination (0+). |
| `filterId` | integer | No | Filter list by exact id. |
| `filterDisplayName` | string | No | Case-insensitive partial match on display name. |
| `filterFirstNames` | string | No | Case-insensitive partial match on first names. |
| `filterLastName` | string | No | Case-insensitive partial match on last name. |
| `filterDeceased` | boolean | No | Filter by deceased flag. |
| `filterBio` | string | No | Case-insensitive partial match on bio. |
| `filterBirthDateId` | integer | No | Filter by exact birth date id. |
| `filterDeathDateId` | integer | No | Filter by exact death date id. |
| `filterBirthDay` | integer | No | Filter by birth day (1-31). |
| `filterBirthMonth` | integer | No | Filter by birth month (1-12). |
| `filterBirthYear` | integer | No | Filter by birth year (1-9999). |
| `filterBirthText` | string | No | Case-insensitive partial match on birth date text. |
| `filterDeathDay` | integer | No | Filter by death day (1-31). |
| `filterDeathMonth` | integer | No | Filter by death month (1-12). |
| `filterDeathYear` | integer | No | Filter by death year (1-9999). |
| `filterDeathText` | string | No | Case-insensitive partial match on death date text. |
| `filterCreatedAt` | string | No | ISO date/time match for `createdAt`. |
| `filterUpdatedAt` | string | No | ISO date/time match for `updatedAt`. |
| `filterCreatedAfter` | string | No | ISO date/time lower bound for `createdAt`. |
| `filterCreatedBefore` | string | No | ISO date/time upper bound for `createdAt`. |
| `filterUpdatedAfter` | string | No | ISO date/time lower bound for `updatedAt`. |
| `filterUpdatedBefore` | string | No | ISO date/time upper bound for `updatedAt`. |
| `filterBornBefore` | string | No | ISO date/time upper bound for birth date. |
| `filterBornAfter` | string | No | ISO date/time lower bound for birth date. |
| `filterDiedBefore` | string | No | ISO date/time upper bound for death date. |
| `filterDiedAfter` | string | No | ISO date/time lower bound for death date. |

`sortBy` accepts: `id`, `displayName`, `firstNames`, `lastName`, `deceased`, `bio`, `createdAt`, `updatedAt`, `birthDateId`, `deathDateId`, `birthDay`, `birthMonth`, `birthYear`, `birthText`, `deathDay`, `deathMonth`, `deathYear`, `deathText`.

For born/died filters, the API compares using the earliest possible date from the partial date (missing month/day are treated as January/1).
Authors without a birth/death date will not match the born/died filters.

You can provide these list controls via query string or JSON body. If both are provided, the JSON body takes precedence.

#### Common Examples

- **All deceased authors, sorted by death year (desc), limit 20:**

```json
{
  "filterDeceased": true,
  "sortBy": "deathYear",
  "order": "desc",
  "limit": 20
}
```

Query string equivalent:

```
GET /author?filterDeceased=true&sortBy=deathYear&order=desc&limit=20
```

- **Authors born before 1900, sorted by display name (asc):**

```json
{
  "filterBornBefore": "1900-01-01",
  "sortBy": "displayName",
  "order": "asc"
}
```

Query string equivalent:

```
GET /author?filterBornBefore=1900-01-01&sortBy=displayName&order=asc
```

#### Optional Lookup (query or body)

When `id` or `displayName` is provided (query string or JSON body), the endpoint returns a single author instead of a list.

Use the `filter...` parameters for list filtering to avoid conflicts with the single-record lookup.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | integer | No | Author id to fetch. |
| `displayName` | string | No | Author display name to fetch. |

If both `id` and `displayName` are provided, the API uses `id` and ignores `displayName`.

- **Response (200, list):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.21",
  "message": "Authors retrieved successfully.",
  "data": {
    "authors": [
      {
        "id": 1,
        "displayName": "J.R.R. Tolkien",
        "firstNames": "John Ronald Reuel",
        "lastName": "Tolkien",
        "birthDate": {
          "id": 12,
          "day": 3,
          "month": 1,
          "year": 1892,
          "text": "3 January 1892"
        },
        "deceased": true,
        "deathDate": {
          "id": 13,
          "day": 2,
          "month": 9,
          "year": 1973,
          "text": "2 September 1973"
        },
        "bio": "Author of The Lord of the Rings.",
        "createdAt": "2025-01-10T09:15:23.000Z",
        "updatedAt": "2025-01-14T16:58:41.000Z"
      }
    ]
  },
  "errors": []
}
```

- **Response (200, nameOnly=true):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.91",
  "message": "Authors retrieved successfully.",
  "data": {
    "authors": [
      {
        "id": 1,
        "displayName": "J.R.R. Tolkien"
      }
    ]
  },
  "errors": []
}
```

- **Response (200, single result):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Author retrieved successfully.",
  "data": {
    "id": 1,
    "displayName": "J.R.R. Tolkien",
    "firstNames": "John Ronald Reuel",
    "lastName": "Tolkien",
    "birthDate": {
      "id": 12,
      "day": 3,
      "month": 1,
      "year": 1892,
      "text": "3 January 1892"
    },
    "deceased": true,
    "deathDate": {
      "id": 13,
      "day": 2,
      "month": 9,
      "year": 1973,
      "text": "2 September 1973"
    },
    "bio": "Author of The Lord of the Rings.",
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.05",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Display Name must be provided."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Author not found.",
  "data": {},
  "errors": [
    "The requested author could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving authors."
  ]
}
```

### GET /author/:id

- **Purpose:** Retrieve a specific author by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/author/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.02",
  "message": "Author retrieved successfully.",
  "data": {
    "id": 1,
    "displayName": "J.R.R. Tolkien",
    "firstNames": "John Ronald Reuel",
    "lastName": "Tolkien",
    "birthDate": {
      "id": 12,
      "day": 3,
      "month": 1,
      "year": 1892,
      "text": "3 January 1892"
    },
    "deceased": true,
    "deathDate": {
      "id": 13,
      "day": 2,
      "month": 9,
      "year": 1973,
      "text": "2 September 1973"
    },
    "bio": "Author of The Lord of the Rings.",
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Author id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Author not found.",
  "data": {},
  "errors": [
    "The requested author could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the author."
  ]
}
```

### GET /author/by-name

- **Purpose:** Retrieve a specific author by display name.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/author/by-name` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "displayName": "J.R.R. Tolkien",
  "nameOnly": false
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `displayName` | string | Yes | Display name to look up (query string or JSON body). |

If `displayName` is provided in both the query string and JSON body, the JSON body takes precedence.

Edge cases:
- Display names are user-scoped; a name that exists for another user will still return `404`.

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Author retrieved successfully.",
  "data": {
    "id": 1,
    "displayName": "J.R.R. Tolkien",
    "firstNames": "John Ronald Reuel",
    "lastName": "Tolkien",
    "birthDate": {
      "id": 12,
      "day": 3,
      "month": 1,
      "year": 1892,
      "text": "3 January 1892"
    },
    "deceased": true,
    "deathDate": {
      "id": 13,
      "day": 2,
      "month": 9,
      "year": 1973,
      "text": "2 September 1973"
    },
    "bio": "Author of The Lord of the Rings.",
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.05",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Display Name must be provided."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Author not found.",
  "data": {},
  "errors": [
    "The requested author could not be located."
  ]
}
```

### POST /author

- **Purpose:** Create a new author for the authenticated user.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/author` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "displayName": "J.R.R. Tolkien",
  "firstNames": "John Ronald Reuel",
  "lastName": "Tolkien",
  "birthDate": {
    "day": 3,
    "month": 1,
    "year": 1892,
    "text": "3 January 1892"
  },
  "deceased": true,
  "deathDate": {
    "day": 2,
    "month": 9,
    "year": 1973,
    "text": "2 September 1973"
  },
  "bio": "English writer and philologist."
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `displayName` | string | Yes | 2–150 characters. |
| `firstNames` | string | No | Optional first names (2–150 characters). |
| `lastName` | string | No | Optional last name (2–100 characters). |
| `birthDate` | object | No | Partial date object. |
| `deceased` | boolean | No | Whether the author is deceased. Defaults to `false` unless a `deathDate` is provided. |
| `deathDate` | object | No | Partial date object (optional even when `deceased=true`). |
| `bio` | string | No | Optional bio (<= 1000 characters). |

Edge cases:
- If `deceased=false` and `deathDate` is provided, the request fails validation.
- If `deceased` is omitted but `deathDate` is provided, the API assumes `deceased=true`.

- **Created (201):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "4.33",
  "message": "Author created successfully.",
  "data": {
    "id": 10,
    "displayName": "J.R.R. Tolkien",
    "firstNames": "John Ronald Reuel",
    "lastName": "Tolkien",
    "birthDate": {
      "id": 12,
      "day": 3,
      "month": 1,
      "year": 1892,
      "text": "3 January 1892"
    },
    "deceased": true,
    "deathDate": {
      "id": 13,
      "day": 2,
      "month": 9,
      "year": 1973,
      "text": "2 September 1973"
    },
    "bio": "Author of The Lord of the Rings.",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:02:11.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Display Name must be provided."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Author already exists.",
  "data": {},
  "errors": [
    "An author with this display name already exists."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while creating the author."
  ]
}
```

### PUT /author

- **Purpose:** Update an author by `id` or `displayName`.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/author` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "id": 1,
  "displayName": "J.R.R. Tolkien",
  "bio": "Updated biography."
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | Conditional | The author id to update. |
| `targetDisplayName` | string | Conditional | The author display name to update (used to identify the record). |
| `displayName` | string | No | New display name to apply. |
| `firstNames` | string | No | Updated first names. |
| `lastName` | string | No | Updated last name. |
| `birthDate` | object | No | Updated partial date object. |
| `deceased` | boolean | No | Updated deceased flag. |
| `deathDate` | object | No | Updated partial date object. |
| `bio` | string | No | Updated bio (<= 1000 characters). |

At least one of `id` or `targetDisplayName` must be provided to identify the record, and at least one updatable field must be included.

If both `id` and `targetDisplayName` are provided, the API uses `id` and ignores `targetDisplayName`.

Edge cases:
- If `deceased=false` and `deathDate` is provided, the request fails validation.
- If `deceased` is omitted but `deathDate` is provided, the API assumes `deceased=true`.

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.92",
  "message": "Author updated successfully.",
  "data": {
    "id": 10,
    "displayName": "J.R.R. Tolkien",
    "firstNames": "John Ronald Reuel",
    "lastName": "Tolkien",
    "birthDate": {
      "id": 12,
      "day": 3,
      "month": 1,
      "year": 1892,
      "text": "3 January 1892"
    },
    "deceased": true,
    "deathDate": {
      "id": 13,
      "day": 2,
      "month": 9,
      "year": 1973,
      "text": "2 September 1973"
    },
    "bio": "Author of The Lord of the Rings.",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:05:48.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide an author id or display name to update."
  ]
}
```

- **No Fields Provided (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.30",
  "message": "No changes were provided.",
  "data": {},
  "errors": [
    "Please provide at least one field to update."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Author not found.",
  "data": {},
  "errors": [
    "The requested author could not be located."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Author already exists.",
  "data": {},
  "errors": [
    "An author with this display name already exists."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the author."
  ]
}
```

### PUT /author/:id

- **Purpose:** Update an author by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/author/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "displayName": "J.R.R. Tolkien",
  "bio": "Updated biography."
}
```

Edge cases:
- If `deceased=false` and `deathDate` is provided, the request fails validation.
- If `deceased` is omitted but `deathDate` is provided, the API assumes `deceased=true`.

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.92",
  "message": "Author updated successfully.",
  "data": {
    "id": 10,
    "displayName": "J.R.R. Tolkien",
    "firstNames": "John Ronald Reuel",
    "lastName": "Tolkien",
    "birthDate": {
      "id": 12,
      "day": 3,
      "month": 1,
      "year": 1892,
      "text": "3 January 1892"
    },
    "deceased": true,
    "deathDate": {
      "id": 13,
      "day": 2,
      "month": 9,
      "year": 1973,
      "text": "2 September 1973"
    },
    "bio": "Author of The Lord of the Rings.",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:05:48.000Z"
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Author id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Author not found.",
  "data": {},
  "errors": [
    "The requested author could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the author."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the author."
  ]
}
```

### DELETE /author

- **Purpose:** Delete an author by `id` or `displayName`.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/author` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "id": 1
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | Conditional | The author id to delete. |
| `displayName` | string | Conditional | The author display name to delete. |

At least one of `id` or `displayName` must be provided.

If both `id` and `displayName` are provided, the API uses `id` and ignores `displayName`.

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Author deleted successfully.",
  "data": {
    "id": 10
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide an author id or display name to delete."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Author not found.",
  "data": {},
  "errors": [
    "The requested author could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the author."
  ]
}
```

### DELETE /author/:id

- **Purpose:** Delete an author by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/author/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Author deleted successfully.",
  "data": {
    "id": 10
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Author id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Author not found.",
  "data": {},
  "errors": [
    "The requested author could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the author."
  ]
}
```

## Publishers

Publishers are scoped per user. Founded dates use the same Partial Date Object described in **Shared Behaviours**.

### GET /publisher

- **Purpose:** Retrieve all publishers for the authenticated user.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/publisher` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "nameOnly": false,
  "sortBy": "name",
  "order": "asc",
  "limit": 50,
  "offset": 0,
  "filterName": "Bloomsbury"
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `nameOnly` | boolean | No | When true, returns only `id` and `name`. Defaults to `false`. |
| `sortBy` | string | No | Sort field for lists. Defaults to `name`. |
| `order` | string | No | Sort direction (`asc` or `desc`). Defaults to `asc`. |
| `limit` | integer | No | Limits list results (1-200). |
| `offset` | integer | No | Offset for list pagination (0+). |
| `filterId` | integer | No | Filter list by exact id. |
| `filterName` | string | No | Case-insensitive partial match on name. |
| `filterWebsite` | string | No | Case-insensitive partial match on website. |
| `filterNotes` | string | No | Case-insensitive partial match on notes. |
| `filterFoundedDateId` | integer | No | Filter by exact founded date id. |
| `filterFoundedDay` | integer | No | Filter by founded day (1-31). |
| `filterFoundedMonth` | integer | No | Filter by founded month (1-12). |
| `filterFoundedYear` | integer | No | Filter by founded year (1-9999). |
| `filterFoundedText` | string | No | Case-insensitive partial match on founded date text. |
| `filterFoundedBefore` | string | No | ISO date/time upper bound for founded date. |
| `filterFoundedAfter` | string | No | ISO date/time lower bound for founded date. |
| `filterCreatedAt` | string | No | ISO date/time match for `createdAt`. |
| `filterUpdatedAt` | string | No | ISO date/time match for `updatedAt`. |
| `filterCreatedAfter` | string | No | ISO date/time lower bound for `createdAt`. |
| `filterCreatedBefore` | string | No | ISO date/time upper bound for `createdAt`. |
| `filterUpdatedAfter` | string | No | ISO date/time lower bound for `updatedAt`. |
| `filterUpdatedBefore` | string | No | ISO date/time upper bound for `updatedAt`. |

`sortBy` accepts: `id`, `name`, `website`, `notes`, `createdAt`, `updatedAt`, `foundedDateId`, `foundedDay`, `foundedMonth`, `foundedYear`, `foundedText`.

For founded filters, the API compares using the earliest possible date from the partial date (missing month/day are treated as January/1). Publishers without a founded date will not match the founded filters.

You can provide these list controls via query string or JSON body. If both are provided, the JSON body takes precedence.

#### Optional Lookup (query or body)

When `id` or `name` is provided (query string or JSON body), the endpoint returns a single publisher instead of a list.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | integer | No | Publisher id to fetch. |
| `name` | string | No | Publisher name to fetch. |

If both `id` and `name` are provided, the API uses `id` and ignores `name`.

Use the `filter...` parameters for list filtering to avoid conflicts with the single-record lookup.

- **Response (200, list):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.21",
  "message": "Publishers retrieved successfully.",
  "data": {
    "publishers": [
      {
        "id": 5,
        "name": "Bloomsbury",
        "foundedDate": {
          "id": 21,
          "day": 1,
          "month": 3,
          "year": 1986,
          "text": "1 March 1986"
        },
        "website": "https://www.bloomsbury.com",
        "notes": "Publisher of the Harry Potter series.",
        "createdAt": "2025-01-10T09:15:23.000Z",
        "updatedAt": "2025-01-14T16:58:41.000Z"
      }
    ]
  },
  "errors": []
}
```

- **Response (200, nameOnly=true):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.91",
  "message": "Publishers retrieved successfully.",
  "data": {
    "publishers": [
      {
        "id": 5,
        "name": "Bloomsbury"
      }
    ]
  },
  "errors": []
}
```

- **Response (200, single result):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Publisher retrieved successfully.",
  "data": {
    "id": 5,
    "name": "Bloomsbury",
    "foundedDate": {
      "id": 21,
      "day": 1,
          "month": 3,
          "year": 1986,
          "text": "1 March 1986"
    },
    "website": "https://www.bloomsbury.com",
    "notes": "Publisher of the Harry Potter series.",
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.05",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Publisher Name must be provided."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Publisher not found.",
  "data": {},
  "errors": [
    "The requested publisher could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving publishers."
  ]
}
```

#### Common Examples

- **All publishers founded before 1950, sorted by founded year (desc), limit 20:**

```json
{
  "filterFoundedBefore": "1950-01-01",
  "sortBy": "foundedYear",
  "order": "desc",
  "limit": 20
}
```

Query string equivalent:

```
GET /publisher?filterFoundedBefore=1950-01-01&sortBy=foundedYear&order=desc&limit=20
```

- **Publishers with "blooms" in the name, sorted by name (asc), offset 10, limit 10:**

```json
{
  "filterName": "blooms",
  "sortBy": "name",
  "order": "asc",
  "offset": 10,
  "limit": 10
}
```

Query string equivalent:

```
GET /publisher?filterName=blooms&sortBy=name&order=asc&offset=10&limit=10
```

### GET /publisher/by-name

- **Purpose:** Retrieve a specific publisher by name.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/publisher/by-name` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "name": "Bloomsbury",
  "nameOnly": false
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | Yes | Publisher name to look up (query string or JSON body). |

If `name` is provided in both the query string and JSON body, the JSON body takes precedence.

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Publisher retrieved successfully.",
  "data": {
    "id": 5,
    "name": "Bloomsbury",
    "foundedDate": {
      "id": 21,
      "day": 1,
          "month": 3,
          "year": 1986,
          "text": "1 March 1986"
    },
    "website": "https://www.bloomsbury.com",
    "notes": "Publisher of the Harry Potter series.",
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.05",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Publisher Name must be provided."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Publisher not found.",
  "data": {},
  "errors": [
    "The requested publisher could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the publisher."
  ]
}
```

### GET /publisher/:id

- **Purpose:** Retrieve a specific publisher by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/publisher/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Publisher retrieved successfully.",
  "data": {
    "id": 5,
    "name": "Bloomsbury",
    "foundedDate": {
      "id": 21,
      "day": 1,
          "month": 3,
          "year": 1986,
          "text": "1 March 1986"
    },
    "website": "https://www.bloomsbury.com",
    "notes": "Publisher of the Harry Potter series.",
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Publisher id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Publisher not found.",
  "data": {},
  "errors": [
    "The requested publisher could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the publisher."
  ]
}
```

### POST /publisher

- **Purpose:** Create a new publisher.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/publisher` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "name": "Bloomsbury",
  "foundedDate": {
    "month": 1,
    "year": 1986,
    "text": "January 1986"
  },
  "website": "https://www.bloomsbury.com",
  "notes": "UK publisher."
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | 2–150 characters; letters, numbers, spaces, and basic punctuation. |
| `foundedDate` | object | No | Partial Date Object (`day`, `month`, `year`, `text`). |
| `website` | string | No | Must be a valid URL starting with `http://` or `https://` (<= 300 chars). |
| `notes` | string | No | Optional notes (<= 1000 characters). |

- **Created (201):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "4.33",
  "message": "Publisher created successfully.",
  "data": {
    "id": 5,
    "name": "Bloomsbury",
    "foundedDate": {
      "id": 21,
      "day": 1,
          "month": 3,
          "year": 1986,
          "text": "1 March 1986"
    },
    "website": "https://www.bloomsbury.com",
    "notes": "Publisher of the Harry Potter series.",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:02:11.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Publisher Name must be between 2 and 150 characters."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Publisher already exists.",
  "data": {},
  "errors": [
    "A publisher with this name already exists."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while creating the publisher."
  ]
}
```

### PUT /publisher

- **Purpose:** Update a publisher by id or name.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/publisher` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "id": 5,
  "notes": "Updated notes."
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | No | Publisher id to update. |
| `targetName` | string | No | Publisher name to update (used if `id` is not provided). |
| `name` | string | No | New publisher name. |
| `foundedDate` | object | No | Partial Date Object (`day`, `month`, `year`, `text`). Use `null` to clear. |
| `website` | string | No | New website. Use `null` to clear. |
| `notes` | string | No | New notes. Use `null` to clear. |

If both `id` and `targetName` are provided, the API uses `id` and ignores `targetName`.

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.42",
  "message": "Publisher updated successfully.",
  "data": {
    "id": 5,
    "name": "Bloomsbury",
    "foundedDate": {
      "id": 21,
      "day": 1,
          "month": 3,
          "year": 1986,
          "text": "1 March 1986"
    },
    "website": "https://www.bloomsbury.com",
    "notes": "Updated notes.",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-20T08:45:10.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide at least one field to update."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Publisher already exists.",
  "data": {},
  "errors": [
    "A publisher with this name already exists."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Publisher not found.",
  "data": {},
  "errors": [
    "The requested publisher could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the publisher."
  ]
}
```

### PUT /publisher/:id

- **Purpose:** Update a publisher by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/publisher/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "notes": "Updated notes."
}
```

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.42",
  "message": "Publisher updated successfully.",
  "data": {
    "id": 5,
    "name": "Bloomsbury",
    "foundedDate": {
      "id": 21,
      "day": 1,
          "month": 3,
          "year": 1986,
          "text": "1 March 1986"
    },
    "website": "https://www.bloomsbury.com",
    "notes": "Updated notes.",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-20T08:45:10.000Z"
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Publisher id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Publisher not found.",
  "data": {},
  "errors": [
    "The requested publisher could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the publisher."
  ]
}
```

### DELETE /publisher

- **Purpose:** Delete a publisher by id or name.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/publisher` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "id": 5
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | No | Publisher id to delete. |
| `name` | string | No | Publisher name to delete (used if `id` is not provided). |

If both `id` and `name` are provided, the API uses `id` and ignores `name`.

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Publisher deleted successfully.",
  "data": {
    "id": 5
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide a publisher id or name to delete."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Publisher not found.",
  "data": {},
  "errors": [
    "The requested publisher could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the publisher."
  ]
}
```

### DELETE /publisher/:id

- **Purpose:** Delete a publisher by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/publisher/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Publisher deleted successfully.",
  "data": {
    "id": 5
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Publisher id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Publisher not found.",
  "data": {},
  "errors": [
    "The requested publisher could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the publisher."
  ]
}
```

## Book Series

Book series are scoped per user. Series start/end dates are derived from linked books (earliest/latest publication dates). Books without a `publicationDate` are ignored for start/end calculations. Books can be linked to multiple series; the link can optionally store the book order within the series.

If a series has no linked books with published dates, `startDate` and `endDate` will be `null`.

### GET /bookseries

- **Purpose:** Retrieve all book series for the authenticated user.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/bookseries` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "nameOnly": false,
  "sortBy": "name",
  "order": "asc",
  "limit": 50,
  "offset": 0,
  "filterName": "Rings"
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `nameOnly` | boolean | No | When true, returns only `id` and `name`. Defaults to `false`. |
| `sortBy` | string | No | Sort field for lists. Defaults to `name`. |
| `order` | string | No | Sort direction (`asc` or `desc`). Defaults to `asc`. |
| `limit` | integer | No | Limits list results (1-200). |
| `offset` | integer | No | Offset for list pagination (0+). |
| `filterId` | integer | No | Filter list by exact id. |
| `filterName` | string | No | Case-insensitive partial match on name. |
| `filterDescription` | string | No | Case-insensitive partial match on description. |
| `filterWebsite` | string | No | Case-insensitive partial match on website. |
| `filterStartDateId` | integer | No | Filter by exact start date id. |
| `filterStartDay` | integer | No | Filter by start day (1-31). |
| `filterStartMonth` | integer | No | Filter by start month (1-12). |
| `filterStartYear` | integer | No | Filter by start year (1-9999). |
| `filterStartText` | string | No | Case-insensitive partial match on start date text. |
| `filterEndDateId` | integer | No | Filter by exact end date id. |
| `filterEndDay` | integer | No | Filter by end day (1-31). |
| `filterEndMonth` | integer | No | Filter by end month (1-12). |
| `filterEndYear` | integer | No | Filter by end year (1-9999). |
| `filterEndText` | string | No | Case-insensitive partial match on end date text. |
| `filterStartedBefore` | string | No | ISO date/time upper bound for series start date. |
| `filterStartedAfter` | string | No | ISO date/time lower bound for series start date. |
| `filterEndedBefore` | string | No | ISO date/time upper bound for series end date. |
| `filterEndedAfter` | string | No | ISO date/time lower bound for series end date. |
| `filterCreatedAt` | string | No | ISO date/time match for `createdAt`. |
| `filterUpdatedAt` | string | No | ISO date/time match for `updatedAt`. |
| `filterCreatedAfter` | string | No | ISO date/time lower bound for `createdAt`. |
| `filterCreatedBefore` | string | No | ISO date/time upper bound for `createdAt`. |
| `filterUpdatedAfter` | string | No | ISO date/time lower bound for `updatedAt`. |
| `filterUpdatedBefore` | string | No | ISO date/time upper bound for `updatedAt`. |

`sortBy` accepts: `id`, `name`, `description`, `website`, `createdAt`, `updatedAt`, `startDate`, `startDateId`, `startDay`, `startMonth`, `startYear`, `startText`, `endDate`, `endDateId`, `endDay`, `endMonth`, `endYear`, `endText`.

For started/ended filters, the API compares using the earliest possible date from the partial date (missing month/day are treated as January/1). Series without start/end dates will not match the corresponding filters.

You can provide these list controls via query string or JSON body. If both are provided, the JSON body takes precedence.

#### Optional Lookup (query or body)

When `id` or `name` is provided (query string or JSON body), the endpoint returns a single series instead of a list.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | integer | No | Series id to fetch. |
| `name` | string | No | Series name to fetch. |

If both `id` and `name` are provided, the API uses `id` and ignores `name`.

Use the `filter...` parameters for list filtering to avoid conflicts with the single-record lookup.

- **Response (200, list):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.21",
  "message": "Series retrieved successfully.",
  "data": {
    "series": [
      {
        "id": 8,
        "name": "The Lord of the Rings",
        "startDate": {
          "id": 42,
          "day": 29,
          "month": 7,
          "year": 1954,
          "text": "29 July 1954"
        },
        "endDate": {
          "id": 43,
          "day": 20,
          "month": 10,
          "year": 1955,
          "text": "20 October 1955"
        },
        "description": "Epic fantasy series by J.R.R. Tolkien.",
        "website": "https://www.tolkien.co.uk",
        "createdAt": "2025-01-10T09:15:23.000Z",
        "updatedAt": "2025-01-14T16:58:41.000Z"
      }
    ]
  },
  "errors": []
}
```

- **Response (200, nameOnly=true):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.91",
  "message": "Series retrieved successfully.",
  "data": {
    "series": [
      {
        "id": 8,
        "name": "The Lord of the Rings"
      }
    ]
  },
  "errors": []
}
```

- **Response (200, single result):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Series retrieved successfully.",
  "data": {
    "id": 8,
    "name": "The Lord of the Rings",
    "startDate": {
      "id": 42,
      "day": 29,
      "month": 7,
      "year": 1954,
      "text": "29 July 1954"
    },
    "endDate": {
      "id": 43,
      "day": 20,
      "month": 10,
      "year": 1955,
      "text": "20 October 1955"
    },
    "description": "Epic fantasy series by J.R.R. Tolkien.",
    "website": "https://www.tolkien.co.uk",
    "books": [
      {
        "bookId": 101,
        "bookOrder": 1
      },
      {
        "bookId": 102,
        "bookOrder": 2
      },
      {
        "bookId": 103,
        "bookOrder": 3
      }
    ],
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.05",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Series Name must be provided."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Series not found.",
  "data": {},
  "errors": [
    "The requested series could not be located."
  ]
}
```

- **Not Found (404, book missing):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book not found.",
  "data": {},
  "errors": [
    "The requested book could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving series."
  ]
}
```

#### Common Examples

- **All series started before 1990, sorted by start year (desc), limit 10:**

```json
{
  "filterStartedBefore": "1990-01-01",
  "sortBy": "startYear",
  "order": "desc",
  "limit": 10
}
```

Query string equivalent:

```
GET /bookseries?filterStartedBefore=1990-01-01&sortBy=startYear&order=desc&limit=10
```

- **Series with "harry" in the name, sorted by name (asc), offset 20, limit 10:**

```json
{
  "filterName": "harry",
  "sortBy": "name",
  "order": "asc",
  "offset": 20,
  "limit": 10
}
```

Query string equivalent:

```
GET /bookseries?filterName=harry&sortBy=name&order=asc&offset=20&limit=10
```

### GET /bookseries/by-name

- **Purpose:** Retrieve a specific series by name.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/bookseries/by-name` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "name": "The Lord of the Rings"
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | Yes | Series name to look up (query string or JSON body). |

If `name` is provided in both the query string and JSON body, the JSON body takes precedence.

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Series retrieved successfully.",
  "data": {
    "id": 8,
    "name": "The Lord of the Rings",
    "startDate": {
      "id": 42,
      "day": 29,
      "month": 7,
      "year": 1954,
      "text": "29 July 1954"
    },
    "endDate": {
      "id": 43,
      "day": 20,
      "month": 10,
      "year": 1955,
      "text": "20 October 1955"
    },
    "description": "Epic fantasy series by J.R.R. Tolkien.",
    "website": "https://www.tolkien.co.uk",
    "books": [
      {
        "bookId": 101,
        "bookOrder": 1
      }
    ],
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.05",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Series Name must be provided."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Series not found.",
  "data": {},
  "errors": [
    "The requested series could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the series."
  ]
}
```

### GET /bookseries/:id

- **Purpose:** Retrieve a specific series by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/bookseries/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Series retrieved successfully.",
  "data": {
    "id": 8,
    "name": "The Lord of the Rings",
    "startDate": {
      "id": 42,
      "day": 29,
      "month": 7,
      "year": 1954,
      "text": "29 July 1954"
    },
    "endDate": {
      "id": 43,
      "day": 20,
      "month": 10,
      "year": 1955,
      "text": "20 October 1955"
    },
    "description": "Epic fantasy series by J.R.R. Tolkien.",
    "website": "https://www.tolkien.co.uk",
    "books": [
      {
        "bookId": 101,
        "bookOrder": 1
      }
    ],
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Series id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Series not found.",
  "data": {},
  "errors": [
    "The requested series could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the series."
  ]
}
```

### POST /bookseries

- **Purpose:** Create a new book series.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/bookseries` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "name": "The Lord of the Rings",
  "description": "Epic fantasy series.",
  "website": "https://www.tolkien.co.uk"
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | 2–150 characters; letters, numbers, spaces, and basic punctuation. |
| `description` | string | No | Optional description (<= 1000 characters). |
| `website` | string | No | Must be a valid URL starting with `http://` or `https://` (<= 300 chars). |

- **Created (201):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "4.33",
  "message": "Series created successfully.",
  "data": {
    "id": 8,
    "name": "The Lord of the Rings",
    "description": "Epic fantasy series by J.R.R. Tolkien.",
    "website": "https://www.tolkien.co.uk",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:02:11.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Series Name must be between 2 and 150 characters."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Series already exists.",
  "data": {},
  "errors": [
    "A series with this name already exists."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while creating the series."
  ]
}
```

### PUT /bookseries

- **Purpose:** Update a series by id or name.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/bookseries` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "id": 8,
  "description": "Updated series description."
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | No | Series id to update. |
| `targetName` | string | No | Series name to update (used if `id` is not provided). |
| `name` | string | No | New series name. |
| `description` | string | No | New description. Use `null` to clear. |
| `website` | string | No | New website. Use `null` to clear. |

If both `id` and `targetName` are provided, the API uses `id` and ignores `targetName`.

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.42",
  "message": "Series updated successfully.",
  "data": {
    "id": 8,
    "name": "The Lord of the Rings",
    "description": "Updated description.",
    "website": "https://www.tolkien.co.uk",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-20T08:45:10.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide at least one field to update."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Series already exists.",
  "data": {},
  "errors": [
    "A series with this name already exists."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Series not found.",
  "data": {},
  "errors": [
    "The requested series could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the series."
  ]
}
```

### PUT /bookseries/:id

- **Purpose:** Update a series by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/bookseries/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "description": "Updated series description."
}
```

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.42",
  "message": "Series updated successfully.",
  "data": {
    "id": 8,
    "name": "The Lord of the Rings",
    "description": "Updated description.",
    "website": "https://www.tolkien.co.uk",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-20T08:45:10.000Z"
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Series id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Series not found.",
  "data": {},
  "errors": [
    "The requested series could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the series."
  ]
}
```

### DELETE /bookseries

- **Purpose:** Delete a series by id or name.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/bookseries` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "id": 8
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | No | Series id to delete. |
| `name` | string | No | Series name to delete (used if `id` is not provided). |

If both `id` and `name` are provided, the API uses `id` and ignores `name`.

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Series deleted successfully.",
  "data": {
    "id": 8
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide a series id or name to delete."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Series not found.",
  "data": {},
  "errors": [
    "The requested series could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the series."
  ]
}
```

### DELETE /bookseries/:id

- **Purpose:** Delete a series by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/bookseries/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Series deleted successfully.",
  "data": {
    "id": 8
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Series id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Series not found.",
  "data": {},
  "errors": [
    "The requested series could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the series."
  ]
}
```

### POST /bookseries/link

- **Purpose:** Link a book to a series with an optional order.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/bookseries/link` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "seriesId": 8,
  "bookId": 22,
  "bookOrder": 1
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `seriesId` | integer | No | Series id to link. |
| `seriesName` | string | No | Series name to link (used if `seriesId` is not provided). |
| `bookId` | integer | Yes | Book id to link. |
| `bookOrder` | integer | No | Order of the book in the series (1-10000). |

If both `seriesId` and `seriesName` are provided, the API uses `seriesId` and ignores `seriesName`.

Notes:
- `bookId` must reference an existing book owned by the authenticated user.
- Series `startDate` and `endDate` are derived from the linked books' `publicationDate`. Books without a publication date are ignored for date ranges.
- If a link already exists for the same series and book, the API updates that link instead of returning a conflict. Only provided fields are updated; omitted fields remain unchanged.

- **Created (201):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "4.33",
  "message": "Book linked to series successfully.",
  "data": {
    "id": 77,
    "seriesId": 8,
    "bookId": 101,
    "bookOrder": 1,
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:02:11.000Z"
  },
  "errors": []
}
```

- **Updated (200, when link already exists):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.42",
  "message": "Book-series link updated successfully.",
  "data": {
    "id": 77,
    "seriesId": 8,
    "bookId": 101,
    "bookOrder": 2,
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-20T08:45:10.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide a valid bookId to link."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Series not found.",
  "data": {},
  "errors": [
    "The requested series could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while linking the book to the series."
  ]
}
```

### PUT /bookseries/link

- **Purpose:** Update a book-series link (book order).
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/bookseries/link` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "seriesId": 8,
  "bookId": 22,
  "bookOrder": 2
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `seriesId` | integer | No | Series id to update. |
| `seriesName` | string | No | Series name to update (used if `seriesId` is not provided). |
| `bookId` | integer | Yes | Book id for the link. |
| `bookOrder` | integer | No | New order of the book in the series (1-10000). Use `null` to clear. |

If both `seriesId` and `seriesName` are provided, the API uses `seriesId` and ignores `seriesName`.

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.42",
  "message": "Book-series link updated successfully.",
  "data": {
    "id": 77,
    "seriesId": 8,
    "bookId": 101,
    "bookOrder": 2,
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-20T08:45:10.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide a valid bookId for the link."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Link not found.",
  "data": {},
  "errors": [
    "The requested book-series link could not be located."
  ]
}
```

- **Not Found (404, series missing):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Series not found.",
  "data": {},
  "errors": [
    "The requested series could not be located."
  ]
}
```

- **Not Found (404, book missing):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book not found.",
  "data": {},
  "errors": [
    "The requested book could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the link."
  ]
}
```

### DELETE /bookseries/link

- **Purpose:** Remove a book-series link.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/bookseries/link` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "seriesId": 8,
  "bookId": 22
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `seriesId` | integer | No | Series id to unlink. |
| `seriesName` | string | No | Series name to unlink (used if `seriesId` is not provided). |
| `bookId` | integer | Yes | Book id to unlink. |

If both `seriesId` and `seriesName` are provided, the API uses `seriesId` and ignores `seriesName`.

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Book unlinked from series successfully.",
  "data": {
    "seriesId": 8,
    "bookId": 101
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide a valid bookId for the link."
  ]
}
```

## Languages

Languages are global and shared across users. They are used to tag books with one or more languages.

### GET /languages

- **Purpose:** Retrieve all available languages (alphabetical).
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/languages` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{}
```

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Languages retrieved successfully.",
  "data": {
    "languages": [
      { "id": 1, "name": "Afrikaans" },
      { "id": 2, "name": "English" },
      { "id": 3, "name": "Netherlands" }
    ]
  },
  "errors": []
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving languages."
  ]
}
```

## Books

Books are scoped per user. Titles are not unique, so multiple books can share the same title (e.g., different formats). ISBNs are unique per user when provided. When identifying a book by title, the API returns `409` if multiple books share that title.

Tags are normalised on ingest (trimmed, lowercased, punctuation stripped, whitespace collapsed) and stored per user. The original display name is retained.
If a book's `publicationDate` is `null`, date-based filters will not match it, and it will not affect series start/end date ranges.

### GET /book

- **Purpose:** Retrieve all books for the authenticated user, or fetch a specific book by id, ISBN, or title.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/book` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "view": "card",
  "sortBy": "title",
  "order": "asc",
  "limit": 20,
  "offset": 0,
  "filterTag": "fantasy",
  "filterPublishedAfter": "1950-01-01"
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `view` | string | No | `all` (default), `card`, or `nameOnly`. |
| `nameOnly` | boolean | No | When true, returns only `id` and `title` (overrides `view`). |
| `sort` | array | No | Array of `{ field, order }` objects (JSON body only). |
| `sortBy` | string | No | Comma-separated sort fields (query or body). |
| `order` | string | No | Comma-separated sort orders (`asc`/`desc`). |
| `limit` | integer | No | Limits list results (1-200). |
| `offset` | integer | No | Offset for list pagination (0+). |
| `filterId` | integer | No | Filter by exact id. |
| `filterTitle` | string | No | Case-insensitive partial match on title. |
| `filterSubtitle` | string | No | Case-insensitive partial match on subtitle. |
| `filterIsbn` | string | No | Exact ISBN match. |
| `filterBookTypeId` | integer | No | Filter by book type id. |
| `filterPublisherId` | integer | No | Filter by publisher id. |
| `filterAuthorId` | integer | No | Filter by author id. |
| `filterSeriesId` | integer | No | Filter by series id. |
| `filterTag` | string | No | Filter by tag name (normalised). |
| `filterLanguageId` | integer | No | Filter by language id. |
| `filterLanguage` | string | No | Filter by language name (normalised). |
| `filterPageMin` | integer | No | Minimum page count. |
| `filterPageMax` | integer | No | Maximum page count. |
| `filterPublishedBefore` | string | No | ISO date/time upper bound for publication date. |
| `filterPublishedAfter` | string | No | ISO date/time lower bound for publication date. |
| `filterPublishedYear` | integer | No | Filter by publication year. |
| `filterPublishedMonth` | integer | No | Filter by publication month. |
| `filterPublishedDay` | integer | No | Filter by publication day. |
| `filterCreatedAt` | string | No | ISO date/time match for `createdAt`. |
| `filterUpdatedAt` | string | No | ISO date/time match for `updatedAt`. |
| `filterCreatedAfter` | string | No | ISO date/time lower bound for `createdAt`. |
| `filterCreatedBefore` | string | No | ISO date/time upper bound for `createdAt`. |
| `filterUpdatedAfter` | string | No | ISO date/time lower bound for `updatedAt`. |
| `filterUpdatedBefore` | string | No | ISO date/time upper bound for `updatedAt`. |

`sortBy` accepts: `id`, `title`, `subtitle`, `isbn`, `pageCount`, `createdAt`, `updatedAt`, `publicationDate`.

You can provide these list controls via query string or JSON body. If both are provided, the JSON body takes precedence.

#### Optional Lookup (query or body)

When `id`, `isbn`, or `title` is provided (query string or JSON body), the endpoint returns a single book instead of a list.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | integer | No | Book id to fetch. |
| `isbn` | string | No | Book ISBN to fetch. |
| `title` | string | No | Book title to fetch. |

If multiple identifiers are provided, the API uses `id`, then `isbn`, then `title`.

Use the `filter...` parameters for list filtering to avoid conflicts with the single-record lookup.

Notes:
- `view=all` includes `bookCopies`, `series`, `tags`, `languages`, and `authors`.

- **Response (200, list, view=card):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.21",
  "message": "Books retrieved successfully.",
  "data": {
    "books": [
      {
        "id": 15,
        "title": "Harry Potter and the Philosopher's Stone",
        "subtitle": null,
        "coverImageUrl": "https://example.com/hp1.jpg",
        "publicationDate": {
          "id": 60,
          "day": 26,
          "month": 6,
          "year": 1997,
          "text": "26 June 1997"
        },
        "pageCount": 223,
        "bookTypeId": 1,
        "publisherId": 5,
        "languages": [
          { "id": 2, "name": "English" }
        ],
        "tags": [
          { "id": 7, "name": "Fantasy" },
          { "id": 8, "name": "Adventure" }
        ]
      }
    ]
  },
  "errors": []
}
```

- **Response (200, single result, view=all):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Book retrieved successfully.",
  "data": {
    "id": 22,
    "title": "The Lord of the Rings",
    "subtitle": "The Fellowship of the Ring",
    "isbn": "978-0-261-10235-4",
    "publicationDate": {
      "id": 61,
      "day": 29,
      "month": 7,
      "year": 1954,
      "text": "29 July 1954"
    },
    "pageCount": 423,
    "bookTypeId": 1,
    "publisherId": 5,
    "coverImageUrl": "https://example.com/lotr-fotr.jpg",
    "description": "The first volume of The Lord of the Rings.",
    "authors": [1],
    "languages": [
      { "id": 2, "name": "English" }
    ],
    "tags": [
      { "id": 7, "name": "Fantasy" },
      { "id": 9, "name": "Epic" }
    ],
    "series": [
      {
        "seriesId": 8,
        "bookOrder": 1,
        "bookPublishedDate": {
          "id": 61,
          "day": 29,
          "month": 7,
          "year": 1954,
          "text": "29 July 1954"
        }
      }
    ],
    "bookCopies": [
      {
        "id": 501,
        "storageLocationId": 12,
        "storageLocationPath": "Home -> Living Room -> Shelf A",
        "acquisitionStory": "Gifted for a birthday.",
        "acquisitionDate": {
          "id": 71,
          "day": 21,
          "month": 12,
          "year": 2010,
          "text": "21 December 2010"
        },
        "acquiredFrom": "Family",
        "acquisitionType": "Gift",
        "acquisitionLocation": "Cape Town",
        "notes": "Hardcover edition.",
        "createdAt": "2025-01-17T10:02:11.000Z",
        "updatedAt": "2025-01-17T10:02:11.000Z"
      }
    ],
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

- **Multiple Matches (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Multiple books matched.",
  "data": {},
  "errors": [
    "Multiple books share this title. Please use id or ISBN."
  ]
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Please provide at least one field to update."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book not found.",
  "data": {},
  "errors": [
    "The requested book could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the book."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book not found.",
  "data": {},
  "errors": [
    "The requested book could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving the book."
  ]
}
```

### POST /book

- **Purpose:** Create a new book and link it to related entities.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/book` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "title": "The Lord of the Rings",
  "subtitle": "The Fellowship of the Ring",
  "isbn": "978-0-261-10235-4",
  "publicationDate": {
    "day": 29,
    "month": 7,
    "year": 1954,
    "text": "29 July 1954"
  },
  "pageCount": 423,
  "coverImageUrl": "https://example.com/lotr-fotr.jpg",
  "description": "The first volume of The Lord of the Rings.",
  "bookTypeId": 1,
  "publisherId": 5,
  "authorIds": [
    1
  ],
  "languageNames": [
    "English"
  ],
  "tags": [
    "Fantasy",
    "Epic"
  ],
  "series": [
    {
      "seriesId": 8,
      "bookOrder": 1
    }
  ],
  "bookCopy": {
    "storageLocationPath": "Home -> Living Room -> Shelf A",
    "acquisitionStory": "Gifted for a birthday.",
    "acquisitionDate": {
      "day": 21,
      "month": 12,
      "year": 2010,
      "text": "21 December 2010"
    },
    "acquiredFrom": "Family",
    "acquisitionType": "Gift",
    "acquisitionLocation": "Cape Town",
    "notes": "Hardcover edition."
  }
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | 2–255 characters. |
| `subtitle` | string | No | Optional subtitle (<= 255 characters). |
| `isbn` | string | No | ISBN (10–17 chars, digits/hyphen/X). Unique per user when provided. |
| `publicationDate` | object | No | Partial Date Object. |
| `pageCount` | integer | No | Number of pages (1–10000). |
| `coverImageUrl` | string | No | Valid URL for a cover image. |
| `description` | string | No | Optional description (<= 2000 characters). |
| `bookTypeId` | integer or array | No | Book type id (single number or array with one number). |
| `publisherId` | integer or array | No | Publisher id (single number or array with one number). |
| `authorIds` | array | No | Array of author ids. |
| `languageIds` | array | No | Array of language ids. |
| `languageNames` | array | No | Array of language names (case-insensitive). |
| `tags` | array | No | Array of tag strings (<= 50 chars). |
| `series` | array | No | Array of series ids or objects with `seriesId` and optional `bookOrder`. |
| `bookCopy` | object | No | First book copy to create (see fields below). |
| `bookCopies` | array | No | Array of book copy objects; only the first entry is used. |

Notes:
- Tags are normalised and de-duplicated per user.
- Series dates are derived from the linked books' `publicationDate`; `bookPublishedDate` is not accepted in requests.
- If no `bookCopy` is provided, the API creates a blank copy so every book has at least one copy.
- The response includes `series[].bookPublishedDate` derived from the book's `publicationDate`.

Book copy fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `storageLocationId` | integer | No | Storage location id for this copy. |
| `storageLocationPath` | string | No | Storage location path (e.g., `Home -> Living Room`). |
| `acquisitionStory` | string | No | Free-text acquisition story (<= 2000 chars). |
| `acquisitionDate` | object | No | Partial Date Object. |
| `acquiredFrom` | string | No | Who the copy was acquired from (<= 255 chars). |
| `acquisitionType` | string | No | Acquisition type (<= 100 chars). |
| `acquisitionLocation` | string | No | Acquisition location (<= 255 chars). |
| `notes` | string | No | Additional notes (<= 2000 chars). |

If both `storageLocationId` and `storageLocationPath` are provided, they must refer to the same location.

If both `storageLocationId` and `storageLocationPath` are provided, they must refer to the same location.

- **Created (201):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "4.33",
  "message": "Book created successfully.",
  "data": {
    "id": 22,
    "title": "The Lord of the Rings",
    "subtitle": "The Fellowship of the Ring",
    "isbn": "978-0-261-10235-4",
    "publicationDate": {
      "id": 61,
      "day": 29,
      "month": 7,
      "year": 1954,
      "text": "29 July 1954"
    },
    "pageCount": 423,
    "bookTypeId": 1,
    "publisherId": 5,
    "coverImageUrl": "https://example.com/lotr-fotr.jpg",
    "description": "The first volume of The Lord of the Rings.",
    "authors": [1],
    "languages": [
      { "id": 2, "name": "English" }
    ],
    "tags": [
      { "id": 7, "name": "Fantasy" },
      { "id": 9, "name": "Epic" }
    ],
    "series": [
      {
        "seriesId": 8,
        "bookOrder": 1,
        "bookPublishedDate": {
          "id": 61,
          "day": 29,
          "month": 7,
          "year": 1954,
          "text": "29 July 1954"
        }
      }
    ],
    "bookCopies": [
      {
        "id": 502,
        "storageLocationId": 12,
        "storageLocationPath": "Home -> Living Room -> Shelf A",
        "acquisitionStory": "Gifted for a birthday.",
        "acquisitionDate": {
          "id": 71,
          "day": 21,
          "month": 12,
          "year": 2010,
          "text": "21 December 2010"
        },
        "acquiredFrom": "Family",
        "acquisitionType": "Gift",
        "acquisitionLocation": "Cape Town",
        "notes": "Hardcover edition.",
        "createdAt": "2025-01-17T10:02:11.000Z",
        "updatedAt": "2025-01-17T10:02:11.000Z"
      }
    ],
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:02:11.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Title must be between 2 and 255 characters."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Book already exists.",
  "data": {},
  "errors": [
    "A book with this ISBN already exists."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while creating the book."
  ]
}
```

### PUT /book

- **Purpose:** Update a book by id, ISBN, or title.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/book` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "id": 22,
  "pageCount": 430,
  "tags": [
    "Fantasy"
  ],
  "series": [
    {
      "seriesId": 8,
      "bookOrder": 1
    }
  ]
}
```

#### Body Parameters

Identification (one of):

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | No | Book id to update. |
| `isbn` | string | No | Book ISBN to update. |
| `title` | string | No | Book title to update (returns 409 if multiple matches). |

Updatable fields (all optional):

| Field | Type | Description |
| --- | --- | --- |
| `title` | string | New title. |
| `subtitle` | string | New subtitle (use `null` to clear). |
| `isbn` | string | New ISBN (use `null` to clear). |
| `publicationDate` | object | Partial Date Object (use `null` to clear). |
| `pageCount` | integer | New page count. |
| `coverImageUrl` | string | New cover image URL (use `null` to clear). |
| `description` | string | New description (use `null` to clear). |
| `bookTypeId` | integer or array | New book type id (single number or array with one number). |
| `publisherId` | integer or array | New publisher id (single number or array with one number). |
| `authorIds` | array | Replace author links (empty array clears). |
| `languageIds` | array | Replace language links (empty array clears). |
| `languageNames` | array | Replace language links by name (empty array clears). |
| `tags` | array | Replace tags (empty array clears). |
| `series` | array | Replace series links (empty array clears). |

Notes:
- If a relation array is provided, the API replaces existing links with the supplied list.
- Series dates are derived from the linked books' `publicationDate`; `bookPublishedDate` is not accepted in requests.

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.42",
  "message": "Book updated successfully.",
  "data": {
    "id": 22,
    "title": "The Lord of the Rings",
    "subtitle": "The Fellowship of the Ring",
    "isbn": "978-0-261-10235-4",
    "publicationDate": {
      "id": 61,
      "day": 29,
      "month": 7,
      "year": 1954,
      "text": "29 July 1954"
    },
    "pageCount": 423,
    "bookTypeId": 2,
    "publisherId": 5,
    "coverImageUrl": "https://example.com/lotr-fotr.jpg",
    "description": "Updated description.",
    "authors": [1],
    "languages": [
      { "id": 2, "name": "English" }
    ],
    "tags": [
      { "id": 7, "name": "Fantasy" }
    ],
    "series": [
      {
        "seriesId": 8,
        "bookOrder": 1,
        "bookPublishedDate": {
          "id": 61,
          "day": 29,
          "month": 7,
          "year": 1954,
          "text": "29 July 1954"
        }
      }
    ],
    "bookCopies": [
      {
        "id": 502,
        "storageLocationId": 12,
        "storageLocationPath": "Home -> Living Room -> Shelf A",
        "acquisitionStory": "Gifted for a birthday.",
        "acquisitionDate": {
          "id": 71,
          "day": 21,
          "month": 12,
          "year": 2010,
          "text": "21 December 2010"
        },
        "acquiredFrom": "Family",
        "acquisitionType": "Gift",
        "acquisitionLocation": "Cape Town",
        "notes": "Hardcover edition.",
        "createdAt": "2025-01-17T10:02:11.000Z",
        "updatedAt": "2025-01-17T10:02:11.000Z"
      }
    ],
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-20T08:45:10.000Z"
  },
  "errors": []
}
```

- **Multiple Matches (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.18",
  "message": "Multiple books matched.",
  "data": {},
  "errors": [
    "Multiple books share this title. Please use id or ISBN."
  ]
}
```

### PUT /book/:id

- **Purpose:** Update a book by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/book/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "pageCount": 430,
  "tags": [
    "Fantasy"
  ],
  "series": [
    {
      "seriesId": 8,
      "bookOrder": 1
    }
  ]
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Book id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book not found.",
  "data": {},
  "errors": [
    "The requested book could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the book."
  ]
}
```

### DELETE /book/:id

- **Purpose:** Delete a book by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/book/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Book deleted successfully.",
  "data": {
    "id": 22
  },
  "errors": []
}
```

- **Invalid ID (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Book id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book not found.",
  "data": {},
  "errors": [
    "The requested book could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the book."
  ]
}
```

## Storage Locations

Storage locations are hierarchical and scoped per user. The API returns a human-readable `path` for each location, e.g. `Home -> Living Room -> Shelf A`.

### GET /storagelocation

- **Purpose:** Retrieve all storage locations or fetch a single location by id/path.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/storagelocation` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "nameOnly": false,
  "sortBy": "path",
  "order": "asc",
  "limit": 100,
  "offset": 0,
  "filterPathContains": "Home"
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | integer | No | Location id to fetch (query or body). |
| `path` | string | No | Location path to fetch (query or body). |
| `nameOnly` | boolean | No | When true, returns only `id`, `name`, and `path`. |
| `sortBy` | string | No | `id`, `name`, `path`, `parentId`, `notes`, `createdAt`, `updatedAt`. |
| `order` | string | No | `asc` or `desc`. |
| `limit` | integer | No | Limit list results (1–200). |
| `offset` | integer | No | Offset for list pagination (0+). |
| `filterId` | integer | No | Filter by exact id. |
| `filterName` | string | No | Case-insensitive partial match on name. |
| `filterParentId` | integer | No | Filter by parent id. |
| `filterRootOnly` | boolean | No | When true, return only root locations. |
| `filterPath` | string | No | Exact path match. |
| `filterPathContains` | string | No | Case-insensitive path match. |

If both `id` and `path` are provided, `id` takes precedence.

- **Response (200, list):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.11",
  "message": "Storage locations retrieved successfully.",
  "data": {
    "storageLocations": [
      {
        "id": 1,
        "name": "Home",
        "parentId": null,
        "notes": null,
        "path": "Home",
        "createdAt": "2025-01-05T08:15:23.000Z",
        "updatedAt": "2025-01-05T08:15:23.000Z"
      },
      {
        "id": 2,
        "name": "Living Room",
        "parentId": 1,
        "notes": "Main shelves",
        "path": "Home -> Living Room",
        "createdAt": "2025-01-06T10:22:11.000Z",
        "updatedAt": "2025-01-06T10:22:11.000Z"
      }
    ]
  },
  "errors": []
}
```

- **Response (200, single result):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.64",
  "message": "Storage location retrieved successfully.",
  "data": {
    "id": 2,
    "name": "Living Room",
    "parentId": 1,
    "notes": "Main shelves",
    "path": "Home -> Living Room",
    "createdAt": "2025-01-06T10:22:11.000Z",
    "updatedAt": "2025-01-06T10:22:11.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.01",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "sortBy must be one of: id, name, path, parentId, notes, createdAt, updatedAt."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.18",
  "message": "Storage location not found.",
  "data": {},
  "errors": [
    "The requested storage location could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving storage locations."
  ]
}
```

### POST /storagelocation

- **Purpose:** Create a new storage location (base or nested).
- **Authentication:** Access token required.

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | 2–150 characters. |
| `parentId` | integer | No | Parent location id (omit or `null` for base). |
| `notes` | string | No | Optional notes (<= 2000 chars). |

- **Created (201):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "3.02",
  "message": "Storage location created successfully.",
  "data": {
    "id": 3,
    "name": "Shelf A",
    "parentId": 2,
    "notes": "Top row",
    "path": "Home -> Living Room -> Shelf A",
    "createdAt": "2025-01-10T10:12:11.000Z",
    "updatedAt": "2025-01-10T10:12:11.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.01",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Parent location could not be located."
  ]
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.04",
  "message": "Storage location already exists.",
  "data": {},
  "errors": [
    "A storage location with this name already exists at the same level."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while creating the storage location."
  ]
}
```

### PUT /storagelocation

- **Purpose:** Update a storage location by id or path.
- **Authentication:** Access token required.

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | No | Location id to update. |
| `path` | string | No | Location path to update. |
| `name` | string | No | New name. |
| `parentId` | integer | No | New parent id (use `null` to move to root). |
| `notes` | string | No | New notes (use `null` to clear). |

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.02",
  "message": "Storage location updated successfully.",
  "data": {
    "id": 3,
    "name": "Shelf A",
    "parentId": 2,
    "notes": "Updated notes",
    "path": "Home -> Living Room -> Shelf A",
    "createdAt": "2025-01-10T10:12:11.000Z",
    "updatedAt": "2025-01-12T09:31:00.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.01",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Parent location cannot be a child of this location."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.18",
  "message": "Storage location not found.",
  "data": {},
  "errors": [
    "The requested storage location could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the storage location."
  ]
}
```

### PUT /storagelocation/:id

Same payload and responses as `PUT /storagelocation`, with the target id supplied in the URL path.

### DELETE /storagelocation

- **Purpose:** Delete a storage location by id or path.
- **Authentication:** Access token required.

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | No | Location id to delete. |
| `path` | string | No | Location path to delete. |

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.64",
  "message": "Storage location deleted successfully.",
  "data": {
    "id": 3,
    "name": "Shelf A"
  },
  "errors": []
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.18",
  "message": "Storage location not found.",
  "data": {},
  "errors": [
    "The requested storage location could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the storage location."
  ]
}
```

### DELETE /storagelocation/:id

Same payload and responses as `DELETE /storagelocation`, with the target id supplied in the URL path.

## Book Copies

Book copies represent the physical copies you own. Every book must have at least one copy.

### GET /bookcopy

- **Purpose:** Retrieve all book copies, or fetch a specific copy by id.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/bookcopy` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "name": "Shelf A",
  "parentId": 2,
  "notes": "Top row"
}
```

#### Example Request (JSON)

```json
{
  "id": 3,
  "notes": "Updated notes"
}
```

#### Example Request (JSON)

```json
{
  "name": "Shelf A",
  "notes": "Updated notes"
}
```

#### Example Request (JSON)

```json
{
  "id": 3
}
```

#### Example Request (JSON)

```json
{}
```

#### Example Request (JSON)

```json
{
  "sortBy": "createdAt",
  "order": "desc",
  "limit": 50,
  "offset": 0,
  "filterStorageLocationPath": "Home",
  "includeNested": true
}
```

#### Query Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | integer | No | Book copy id to fetch. |
| `sortBy` | string | No | `id`, `bookId`, `storageLocationId`, `acquisitionStory`, `acquisitionDateId`, `acquiredFrom`, `acquisitionType`, `acquisitionLocation`, `notes`, `createdAt`, `updatedAt`, `acquisitionDay`, `acquisitionMonth`, `acquisitionYear`, `acquisitionText`, `acquisitionDate`. |
| `order` | string | No | `asc` or `desc`. |
| `limit` | integer | No | Limit list results (1–200). |
| `offset` | integer | No | Offset for list pagination (0+). |
| `filterId` | integer | No | Filter by exact copy id. |
| `filterBookId` | integer | No | Filter by book id. |
| `filterStorageLocationId` | integer | No | Filter by storage location id. |
| `filterStorageLocationPath` | string | No | Filter by storage location path (e.g., `Home -> Living Room`). |
| `includeNested` | boolean | No | When filtering by location, include nested locations (default true). |
| `filterAcquisitionStory` | string | No | Case-insensitive partial match. |
| `filterAcquiredFrom` | string | No | Case-insensitive partial match. |
| `filterAcquisitionType` | string | No | Case-insensitive partial match. |
| `filterAcquisitionLocation` | string | No | Case-insensitive partial match. |
| `filterNotes` | string | No | Case-insensitive partial match. |
| `filterAcquisitionDateId` | integer | No | Filter by acquisition date id. |
| `filterAcquisitionDay` | integer | No | Filter by acquisition day. |
| `filterAcquisitionMonth` | integer | No | Filter by acquisition month. |
| `filterAcquisitionYear` | integer | No | Filter by acquisition year. |
| `filterAcquisitionText` | string | No | Case-insensitive partial match on acquisition date text. |
| `filterAcquiredBefore` | string | No | ISO date/time upper bound for acquisition date. |
| `filterAcquiredAfter` | string | No | ISO date/time lower bound for acquisition date. |
| `filterCreatedBefore` | string | No | ISO date/time upper bound for `createdAt`. |
| `filterCreatedAfter` | string | No | ISO date/time lower bound for `createdAt`. |
| `filterUpdatedBefore` | string | No | ISO date/time upper bound for `updatedAt`. |
| `filterUpdatedAfter` | string | No | ISO date/time lower bound for `updatedAt`. |

Notes:
- Use `filterStorageLocationId` or `filterStorageLocationPath` with `includeNested=true` to list all copies under a location tree.

- **Response (200, list):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.21",
  "message": "Book copies retrieved successfully.",
  "data": {
    "bookCopies": [
      {
        "id": 501,
        "bookId": 22,
        "bookTitle": "The Lord of the Rings",
        "bookIsbn": "978-0-261-10235-4",
        "storageLocationId": 12,
        "storageLocationPath": "Home -> Living Room -> Shelf A",
        "acquisitionStory": "Gifted for a birthday.",
        "acquisitionDate": {
          "id": 71,
          "day": 21,
          "month": 12,
          "year": 2010,
          "text": "21 December 2010"
        },
        "acquiredFrom": "Family",
        "acquisitionType": "Gift",
        "acquisitionLocation": "Cape Town",
        "notes": "Hardcover edition.",
        "createdAt": "2025-01-17T10:02:11.000Z",
        "updatedAt": "2025-01-17T10:02:11.000Z"
      }
    ]
  },
  "errors": []
}
```

- **Response (200, single result):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.78",
  "message": "Book copy retrieved successfully.",
  "data": {
    "id": 501,
    "bookId": 22,
    "bookTitle": "The Lord of the Rings",
    "bookIsbn": "978-0-261-10235-4",
    "storageLocationId": 12,
    "storageLocationPath": "Home -> Living Room -> Shelf A",
    "acquisitionStory": "Gifted for a birthday.",
    "acquisitionDate": {
      "id": 71,
      "day": 21,
      "month": 12,
      "year": 2010,
      "text": "21 December 2010"
    },
    "acquiredFrom": "Family",
    "acquisitionType": "Gift",
    "acquisitionLocation": "Cape Town",
    "notes": "Hardcover edition.",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:02:11.000Z"
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "filterStorageLocationId must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book copy not found.",
  "data": {},
  "errors": [
    "The requested book copy could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving book copies."
  ]
}
```

### POST /bookcopy

- **Purpose:** Add a new book copy to a book.
- **Authentication:** Access token required.

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `bookId` | integer | Yes | Book id to attach the copy to. |
| `storageLocationId` | integer | No | Storage location id for this copy. |
| `storageLocationPath` | string | No | Storage location path (e.g., `Home -> Living Room`). |
| `acquisitionStory` | string | No | Free-text acquisition story (<= 2000 chars). |
| `acquisitionDate` | object | No | Partial Date Object. |
| `acquiredFrom` | string | No | Who the copy was acquired from (<= 255 chars). |
| `acquisitionType` | string | No | Acquisition type (<= 100 chars). |
| `acquisitionLocation` | string | No | Acquisition location (<= 255 chars). |
| `notes` | string | No | Additional notes (<= 2000 chars). |

- **Created (201):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "3.02",
  "message": "Book copy created successfully.",
  "data": {
    "id": 503
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Book id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book not found.",
  "data": {},
  "errors": [
    "The requested book could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while creating the book copy."
  ]
}
```

### PUT /bookcopy

- **Purpose:** Update a book copy by id.
- **Authentication:** Access token required.

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | Yes | Book copy id to update. |
| `storageLocationId` | integer | No | New storage location id. |
| `storageLocationPath` | string | No | New storage location path. |
| `acquisitionStory` | string | No | New acquisition story. |
| `acquisitionDate` | object | No | Partial Date Object (use `null` to clear). |
| `acquiredFrom` | string | No | New acquired-from value. |
| `acquisitionType` | string | No | New acquisition type. |
| `acquisitionLocation` | string | No | New acquisition location. |
| `notes` | string | No | New notes. |

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.90",
  "message": "Book copy updated successfully.",
  "data": {
    "id": 503
  },
  "errors": []
}
```

- **Validation Error (400):**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "2.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Storage location id must be a valid integer."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book copy not found.",
  "data": {},
  "errors": [
    "The requested book copy could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while updating the book copy."
  ]
}
```

### PUT /bookcopy/:id

Same payload and responses as `PUT /bookcopy`, with the target id supplied in the URL path.

### DELETE /bookcopy

- **Purpose:** Delete a book copy by id.
- **Authentication:** Access token required.

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | integer | Yes | Book copy id to delete. |

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.64",
  "message": "Book copy deleted successfully.",
  "data": {
    "id": 503
  },
  "errors": []
}
```

- **Conflict (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "2.12",
  "message": "Book copy required.",
  "data": {},
  "errors": [
    "A book must have at least one copy."
  ]
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Book copy not found.",
  "data": {},
  "errors": [
    "The requested book copy could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while deleting the book copy."
  ]
}
```

### DELETE /bookcopy/:id

Same payload and responses as `DELETE /bookcopy`, with the target id supplied in the URL path.

## Tags

Tags are user-defined labels attached to books. The endpoint returns all tags owned by the authenticated user, sorted alphabetically.

### GET /tags

- **Purpose:** Retrieve all tags for the authenticated user.
- **Authentication:** Access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `GET` |
| Path | `/tags` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (optional body) |

#### Example Request (JSON)

```json
{
  "bookId": 22,
  "storageLocationPath": "Home -> Living Room -> Shelf A",
  "acquisitionStory": "Gifted for a birthday.",
  "acquisitionDate": {
    "day": 21,
    "month": 12,
    "year": 2010,
    "text": "21 December 2010"
  },
  "acquiredFrom": "Family",
  "acquisitionType": "Gift",
  "acquisitionLocation": "Cape Town",
  "notes": "Hardcover edition."
}
```

#### Example Request (JSON)

```json
{
  "id": 503,
  "notes": "Updated notes"
}
```

#### Example Request (JSON)

```json
{
  "notes": "Updated notes"
}
```

#### Example Request (JSON)

```json
{
  "id": 503
}
```

#### Example Request (JSON)

```json
{}
```

#### Example Request (JSON)

```json
{}
```

- **Response (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.40",
  "message": "Tags retrieved successfully.",
  "data": {
    "tags": [
      {
        "id": 7,
        "name": "Fantasy",
        "createdAt": "2025-01-17T10:02:11.000Z",
        "updatedAt": "2025-01-17T10:02:11.000Z"
      },
      {
        "id": 8,
        "name": "Adventure",
        "createdAt": "2025-01-17T10:02:11.000Z",
        "updatedAt": "2025-01-17T10:02:11.000Z"
      }
    ]
  },
  "errors": []
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while retrieving tags."
  ]
}
```

## Admin

All `/admin/*` routes require an authenticated admin user.

### POST /admin/languages

- **Purpose:** Add a new language.
- **Authentication:** Admin access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/admin/languages` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / admin user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "name": "Zulu"
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | Language name (2–100 characters). |

- **Created (201):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "3.10",
  "message": "Language created successfully.",
  "data": {
    "id": 4,
    "name": "Elvish",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-17T10:02:11.000Z"
  },
  "errors": []
}
```

### PUT /admin/languages/:id

- **Purpose:** Update a language.
- **Authentication:** Admin access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/admin/languages/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / admin user |
| Content-Type | `application/json` |

#### Example Request (JSON)

```json
{
  "name": "isiZulu"
}
```

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | Language name (2–100 characters). |

- **Updated (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "3.10",
  "message": "Language updated successfully.",
  "data": {
    "id": 4,
    "name": "Elvish",
    "createdAt": "2025-01-17T10:02:11.000Z",
    "updatedAt": "2025-01-20T08:45:10.000Z"
  },
  "errors": []
}
```

### DELETE /admin/languages/:id

- **Purpose:** Delete a language.
- **Authentication:** Admin access token required.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/admin/languages/:id` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / admin user |
| Content-Type | N/A (no body) |

#### Example Request (JSON)

```json
{}
```

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "2.48",
  "message": "Language deleted successfully.",
  "data": {
    "id": 4
  },
  "errors": []
}
```

- **Not Found (404):**

```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "2.84",
  "message": "Link not found.",
  "data": {},
  "errors": [
    "The requested book-series link could not be located."
  ]
}
```

- **Authentication Required (401):**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "2.18",
  "message": "Authentication required for this action.",
  "data": {},
  "errors": [
    "Missing or invalid Authorization header."
  ]
}
```

- **Server Error (500):**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "5.42",
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while removing the link."
  ]
}
```
