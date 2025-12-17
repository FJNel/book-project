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
    - [POST /dates/preview](#post-datespreview)
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
  - [Admin](#admin)


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
| Authenticated endpoints (`/auth/logout`, `/users/*`, `/admin/*`) | 60 requests | 1 minute per authenticated user | Enforced by `authenticatedLimiter`; keyed by `user.id`. |
| `POST /dates/preview` | 30 requests | 1 minute per IP | Lightweight preview endpoint backed by the Python partial date parser. |

All other endpoints currently have no dedicated custom limit.

## Shared Behaviours

- **Authentication:** Routes guarded by `requiresAuth` return HTTP `401` with `message` `"Authentication required for this action."` when the Authorization header is missing or invalid. Disabled accounts receive HTTP `403` with `message` `"Your account has been disabled."`.
- **Role Checks:** Admin-only routes use `requireRole`. Non-admin users receive HTTP `403` with `message` `"Forbidden: Insufficient permissions."`.
- **Validation:** Validation failures respond with HTTP `400`, `message` `"Validation Error"`, and each issue listed in `errors`.
- **Global 404:** Unmatched routes return HTTP `404` with `message` `"Endpoint Not Found"` and guidance in `errors`.
- **Unhandled Errors:** Unexpected exceptions return HTTP `500`, `message` `"Internal Server Error"`, and a generic error list.
- **Account action quotas:** Authenticated flows that trigger emails also enforce daily per-account quotas: up to 2 password changes per day, 1 email change request per day, and 2 account disable or deletion requests per day (regardless of HTTP verb).
- **Password metadata:** Whenever the API returns a user profile (login, `/users/me`, profile updates), the payload includes `passwordUpdated`—an ISO timestamp describing the last password change, or `null` for OAuth-only accounts.

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
| Content-Type | N/A (no body) |

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

### POST /dates/preview

- **Description:** Runs the Python `partial_date_parser.py` helper to show how a loosely formatted date will be stored.
- **Authentication:** Not required.
- **Rate Limit:** 30 requests per minute per IP.
- **Reference Date:** Uses the current date by default; optionally accept a `referenceDate` (`YYYY-MM-DD`) to anchor relative phrases.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/dates/preview` |
| Authentication | None |
| Rate Limit | 30 requests / minute / IP |
| Content-Type | `application/json` |

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Content-Type` | Yes | `application/json` | JSON body required. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `dateString` | string | Yes | The free-form date to parse. Must not be empty; max 512 characters. |
| `preferMdy` | boolean | No | When `true`, ambiguous numeric dates (e.g. `03/04/05`) are interpreted as MM/DD/YY. Defaults to `false` (DD/MM preference). |
| `referenceDate` | string (YYYY-MM-DD) | No | Reference date to treat as “today” for parsing relative phrases. Defaults to the current date if omitted. |

- **Request Body:**

```json
{
  "dateString": "15 Dec 25",
  "preferMdy": false,
  "referenceDate": "2025-12-15"
}
```

- **Successful Response (200)**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "4.33",
  "message": "Date preview generated.",
  "data": {
    "date": {
      "day": 15,
      "month": 12,
      "year": 2025,
      "text": "15 December 2025"
    },
    "input": "15 Dec 25",
    "preferMdy": false,
    "referenceDate": "2025-12-15"
  },
  "errors": []
}
```

- **Validation Error (400):** Empty input

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "3.10",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "An empty date cannot be parsed."
  ]
}
```

- **Validation Error (400):** Unparsable date text

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "3.22",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Could not parse the provided date."
  ]
}
```

- **Rate Limit Exceeded (429)**

```json
{
  "status": "error",
  "httpCode": 429,
  "responseTime": "2.01",
  "message": "Too many requests",
  "data": {},
  "errors": [
    "You have exceeded the maximum number of requests. Please try again later."
  ]
}
```

- **Parser Failure (500)**

```json
{
  "status": "error",
  "httpCode": 500,
  "responseTime": "2.88",
  "message": "Failed to parse date",
  "data": {},
  "errors": [
    "The date preview service is temporarily unavailable. Please try again shortly."
  ]
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

- **Request Body:**

```json
{
  "captchaToken": "string",
  "fullName": "Jane Doe",
  "preferredName": "Jane",
  "email": "jane@example.com",
  "password": "P@ssw0rd123!"
}
```

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

- **Request Body:**

```json
{
  "captchaToken": "string",
  "email": "jane@example.com"
}
```

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

- **Request Body:**

```json
{
  "captchaToken": "string",
  "email": "jane@example.com",
  "token": "f1b8d0c7..."
}
```

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

- **Request Body:**

```json
{
  "captchaToken": "string",
  "email": "jane@example.com",
  "password": "P@ssw0rd123!"
}
```

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
      "passwordUpdated": "2024-07-11T10:22:33.000Z"
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

- **Request Body:**

```json
{
  "refreshToken": "<jwt>"
}
```

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

- **Request Body:**

```json
{
  "refreshToken": "<jwt>",
  "allDevices": false
}
```

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

- **Request Body:**

```json
{
  "captchaToken": "string",
  "email": "jane@example.com"
}
```

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

- **Request Body:**

```json
{
  "captchaToken": "string",
  "email": "jane@example.com",
  "token": "f1b8d0c7...",
  "newPassword": "N3wP@ssw0rd!!!"
}
```

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

- **Request Body:**

```json
{
  "idToken": "<google-id-token>"
}
```

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
      "passwordUpdated": null
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

- **Request Body:**

```json
{
  "fullName": "Jane Q. Doe",
  "preferredName": "Jan"
}
```

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

## Admin

All `/admin/*` routes require an authenticated admin user and currently share the same placeholder implementation.

#### Shared Request Overview

| Property | Value |
| --- | --- |
| Method | Varies (`GET`, `POST`, `PUT`, `DELETE`) |
| Path | `/admin/*` |
| Authentication | `Authorization: Bearer <accessToken>` with `role=admin` |
| Rate Limit | 60 requests / minute / admin user |
| Content-Type | `application/json` for endpoints that accept a body |

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Token must belong to a user with the `admin` role. |
| `Content-Type` | Conditional | `application/json` | Required when sending a JSON body. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| *(varies)* | — | — | Admin endpoints are not yet implemented; request bodies will be documented once available. |

- **Not Implemented (300):**

```json
{
  "status": "error",
  "httpCode": 300,
  "responseTime": "4.02",
  "message": "This admin endpoint is not yet implemented.",
  "data": {},
  "errors": [
    "This admin endpoint is not yet implemented."
  ]
}
```

- **Unauthorized (401):** When no valid access token is provided the standard authentication error response is returned.
- **Forbidden (403):** Authenticated users without the `admin` role receive the shared `"Forbidden: Insufficient permissions."` envelope.

Further details will be documented once the admin endpoints are implemented.
