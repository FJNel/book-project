
# API Documentation

This guide describes the publicly available REST endpoints exposed by the API, the expected request payloads, and the standard response contract. All examples assume JSON request and response bodies.

**Base URL:** `https://api.fjnel.co.za`

## Logging

The API writes structured JSON logs to rotating files. Every HTTP request is captured with an `event` of `HTTP_REQUEST`, together with the method, path, status code, latency, originating IP, user agent, and a sanitised copy of the request body. Significant actions (registration, login, logout, verification, password reset, profile changes) log an action specific `event` such as `USER_REGISTERED` or `LOGIN_ATTEMPT` with a common shape that includes `status` (`SUCCESS`, `FAILURE`, or `INFO`) and contextual information. Error objects are normalised so that the final log entry always includes an `error_message` field.

## Standard Response Format

Both successful and failed requests return a consistent envelope. Response times are reported in milliseconds as strings for readability.

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

## Rate Limiting

Per-endpoint rate limiting protects expensive operations. When a limit is exceeded the API returns HTTP `429` using the standard error envelope with `message` set to `"Too many requests"`.

| Endpoint | Limit | Window | Notes |
| --- | --- | --- | --- |
| `POST /auth/register` | 5 requests | 10 minutes | CAPTCHA required (`captchaToken`, action `register`). |
| `POST /auth/resend-verification` | 1 request | 5 minutes | CAPTCHA required (`captchaToken`, action `resend_verification`). |
| `POST /auth/login` | 10 requests | 10 minutes | CAPTCHA required (`captchaToken`, action `login`). |
| `POST /auth/request-password-reset` | 1 request | 5 minutes | CAPTCHA required (`captchaToken`, action `request_password_reset`). |
| `POST /auth/reset-password` | 1 request | 5 minutes | CAPTCHA required (`captchaToken`, action `reset_password`). |
| Authenticated endpoints (`/auth/logout`, `/users/*`) | 60 requests | 1 minute per authenticated user | Enforced by `authenticatedLimiter`; key is the authenticated `user.id`.

All other endpoints inherit Express' default behaviour and currently have no dedicated custom limit.

## Endpoints

### GET /

- **Description:** Health check that confirms the API is reachable and returns the documentation link.
- **Authentication:** Not required.
- **Example Response:**

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

- **Successful Response (201):**

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

- **Common Error (400 Validation):**

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

If the email already belongs to a verified account the API returns HTTP `409` with `message` `"Email already in use"`.

### POST /auth/resend-verification

- **Purpose:** Re-send the verification email for an unverified account.
- **Authentication:** Not required.
- **Rate Limit:** 1 request per 5 minutes per IP.
- **CAPTCHA:** Provide `captchaToken` validated against the `resend_verification` action.
- **Request Body:**

```json
{
  "captchaToken": "string",
  "email": "jane@example.com"
}
```

- **Successful Response (200):** Always generic to avoid leaking account state.

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

### POST /auth/verify-email

- **Purpose:** Mark a user as verified using the token emailed during registration.
- **Authentication:** Not required.
- **Rate Limit:** Not currently rate limited beyond CAPTCHA.
- **CAPTCHA:** Provide `captchaToken` validated against the `verify_email` action.
- **Request Body:**

```json
{
  "captchaToken": "string",
  "email": "jane@example.com",
  "token": "f1b8d0c7..."
}
```

- **Successful Response (200):**

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

- **Invalid Token (400):** Returns `message` `"Token expired or incorrect email address"` with two explanatory entries in `errors`.

### POST /auth/login

- **Purpose:** Authenticate with email and password and issue access/refresh tokens.
- **Authentication:** Not required.
- **Rate Limit:** 10 requests per 10 minutes per IP.
- **CAPTCHA:** Provide `captchaToken` validated against the `login` action.
- **Request Body:**

```json
{
  "captchaToken": "string",
  "email": "jane@example.com",
  "password": "P@ssw0rd123!"
}
```

- **Successful Response (200):**

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

- **Invalid Credentials (401):** `message` `"Invalid email or password."` with a single error entry `"The provided email or password is incorrect"`.

### POST /auth/refresh-token

- **Purpose:** Exchange a valid refresh token for a new access token.
- **Authentication:** Not required (refresh token provides trust).
- **Rate Limit:** Not currently rate limited beyond implicit database lookups.
- **Request Body:**

```json
{
  "refreshToken": "<jwt>"
}
```

- **Successful Response (200):** Returns `message` `"Access token refreshed."` with `{ "accessToken": "<jwt>" }` in `data`.
- **Invalid Token:** HTTP `401` with `message` `"Invalid refresh token"`.
- **Disabled Account:** HTTP `403` with `message` `"Your account has been disabled."`.

### POST /auth/logout

- **Purpose:** Revoke one or all active refresh tokens for the authenticated user.
- **Authentication:** Access token required (Authorization header `Bearer <accessToken>`).
- **Rate Limit:** 60 requests per minute per authenticated user via `authenticatedLimiter`.
- **Request Body:**

```json
{
  "refreshToken": "<jwt>",
  "allDevices": false
}
```

Set `allDevices` truthy (`true`, `"true"`, `1`, `"1"`, or `"all"`) to revoke every active session without supplying a refresh token.

- **Successful Single-Device Logout:**

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

- **Missing Refresh Token (400):** `message` `"Refresh token required"` and a single error instructing the caller to supply the token.

### POST /auth/request-password-reset

- **Purpose:** Send a password reset email if the account exists.
- **Authentication:** Not required.
- **Rate Limit:** 1 request per 5 minutes per IP.
- **CAPTCHA:** Provide `captchaToken` validated against the `request_password_reset` action.
- **Request Body:**

```json
{
  "captchaToken": "string",
  "email": "jane@example.com"
}
```

- **Successful Response (200):** Always generic to avoid account enumeration. `message` `"If you have registered an account with this email address, you will receive a password reset email."` with a `disclaimer` in the `data` object.

### POST /auth/reset-password

- **Purpose:** Reset the account password using the emailed token.
- **Authentication:** Not required.
- **Rate Limit:** 1 request per 5 minutes per IP.
- **CAPTCHA:** Provide `captchaToken` validated against the `reset_password` action.
- **Request Body:**

```json
{
  "captchaToken": "string",
  "email": "jane@example.com",
  "token": "f1b8d0c7...",
  "newPassword": "N3wP@ssw0rd!!!"
}
```

- **Successful Response (200):** `message` `"Password reset successfully. You can now log in."` and `data` containing the user id and email. All refresh tokens are revoked as part of the flow.
- **Invalid Token:** HTTP `400` with the same error text used by `/auth/verify-email`, instructing the caller to request a new email.

### POST /auth/google

- **Purpose:** Sign up or sign in a user using a verified Google ID token.
- **Authentication:** Not required.
- **Rate Limit:** Not currently rate limited.
- **Request Body:**

```json
{
  "idToken": "<google-id-token>"
}
```

- **Successful Response (200):**

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

- **Invalid Token (401):** `message` `"Invalid ID token"`.
- **Incomplete Profile (400):** For example, `message` `"Email not verified by Google"` when `email_verified` is false.

---

## User Management

All user management endpoints require a valid access token (`Authorization: Bearer <accessToken>`) and are subject to the `authenticatedLimiter` (60 requests per minute per user).

### GET /users/me

- **Purpose:** Retrieve the authenticated user's profile and connected OAuth providers.
- **Successful Response (200):**

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
    "oauthProviders": ["google"],
    "createdAt": "2025-01-10T09:15:23.000Z",
    "updatedAt": "2025-01-14T16:58:41.000Z"
  },
  "errors": []
}
```

If the account is disabled the API returns `404` with `message` `"User not found."`.

### PUT /users/me

- **Purpose:** Update `fullName` and/or `preferredName`.
- **Request Body:** Any combination of `fullName` and `preferredName`.

```json
{
  "fullName": "Jane Q. Doe",
  "preferredName": "Jan"
}
```

- **Successful Response (200):** Mirrors `GET /users/me` with updated values.
- **No Fields Provided:** HTTP `400` with `message` `"No changes were provided."` and error `"Please provide at least one field to update."`.

### DELETE /users/me

- **Purpose:** Soft-delete the authenticated account and revoke every refresh token.
- **Successful Response (200):** `message` `"Your account has been disabled."` and an empty object in `data`.

### POST /users/me/request-email-change
### POST /users/me/request-account-deletion

These endpoints are planned but not yet implemented. Each currently returns HTTP `501` with `message` `"This functionality has not been implemented yet."` and an explanatory error entry.

---

## Admin

All `/admin` routes require an authenticated admin user and currently respond with HTTP `300` using the standard error envelope, `message` `"This admin endpoint is not yet implemented."`, and the same string echoed in the `errors` array. Further details will be documented once the endpoints are implemented.
