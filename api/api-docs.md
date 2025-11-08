# API Documentation

This guide describes the publicly available REST endpoints exposed by the API, the expected request payloads, and the standard response contract. All examples assume JSON request and response bodies.

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
| Authenticated endpoints (`/auth/logout`, `/users/*`, `/admin/*`) | 60 requests | 1 minute per authenticated user | Enforced by `authenticatedLimiter`; keyed by `user.id`. |

All other endpoints currently have no dedicated custom limit.

## Shared Behaviours

- **Authentication:** Routes guarded by `requiresAuth` return HTTP `401` with `message` `"Authentication required for this action."` when the Authorization header is missing or invalid. Disabled accounts receive HTTP `403` with `message` `"Your account has been disabled."`.
- **Role Checks:** Admin-only routes use `requireRole`. Non-admin users receive HTTP `403` with `message` `"Forbidden: Insufficient permissions."`.
- **Validation:** Validation failures respond with HTTP `400`, `message` `"Validation Error"`, and each issue listed in `errors`.
- **Global 404:** Unmatched routes return HTTP `404` with `message` `"Endpoint Not Found"` and guidance in `errors`.
- **Unhandled Errors:** Unexpected exceptions return HTTP `500`, `message` `"Internal Server Error"`, and a generic error list.

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

- **Created (201):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "24.35",
  "message": "User registered successfully. Please verify your email before logging in.",
  "data": {
    "id": "b6df9c94-91b3-4ea7-ac37-4f5b8d2c8d1e",
    "email": "jane@example.com",
    "fullName": "Jane Doe",
    "preferredName": "Jane",
    "role": "user",
    "isVerified": false
  },
  "errors": []
}
```

- **Existing Unverified Account (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "11.02",
  "message": "Account already exists but not verified. Verification email has been (re)sent. The existing account was not modified.",
  "data": {},
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

- **Email in Use by Verified Account (409):**

```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "6.12",
  "message": "Email already in use",
  "data": {},
  "errors": [
    "The provided email is already associated with another account. Please log in or use a different email."
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
      "isVerified": true
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
      "isVerified": true
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

- **Purpose:** Update `fullName` and/or `preferredName`.
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

- **Purpose:** Soft-delete the authenticated account and revoke every refresh token.

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

- **Deleted (200):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "6.07",
  "message": "Your account has been disabled.",
  "data": {},
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
  "message": "Database Error",
  "data": {},
  "errors": [
    "An error occurred while disabling the user account."
  ]
}
```

### POST /users/me/request-email-change

- **Purpose:** Placeholder for initiating an email change workflow (not implemented yet).
- **Authentication:** Access token required.
- **Status:** Reserved for future use; always returns HTTP 501.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/users/me/request-email-change` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (no fields currently used) |

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Required even though the endpoint is a stub. |
| `Content-Type` | No | `application/json` | Included for parity; no body is processed. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| *(none)* | — | — | No request body is currently accepted. |

- **Current Response (501):**

```json
{
  "status": "error",
  "httpCode": 501,
  "responseTime": "3.87",
  "message": "This functionality has not been implemented yet.",
  "data": {},
  "errors": [
    "This endpoint is reserved for future use."
  ]
}
```

### POST /users/me/request-account-deletion

- **Purpose:** Placeholder for requesting account deletion (not implemented yet).
- **Authentication:** Access token required.
- **Status:** Reserved for future use; always returns HTTP 501.

#### Request Overview

| Property | Value |
| --- | --- |
| Method | `POST` |
| Path | `/users/me/request-account-deletion` |
| Authentication | `Authorization: Bearer <accessToken>` |
| Rate Limit | 60 requests / minute / user |
| Content-Type | `application/json` (no fields currently used) |

#### Required Headers

| Header | Required | Value | Notes |
| --- | --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` | Required even though the endpoint is a stub. |
| `Content-Type` | No | `application/json` | Included for parity; no body is processed. |
| `Accept` | No | `application/json` | Responses are JSON. |

#### Body Parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| *(none)* | — | — | No request body is currently accepted. |

- **Current Response (501):**

```json
{
  "status": "error",
  "httpCode": 501,
  "responseTime": "3.87",
  "message": "This functionality has not been implemented yet.",
  "data": {},
  "errors": [
    "This endpoint is reserved for future use."
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
