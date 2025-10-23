# Documentation

Welcome to the Documentation for my project. This document provides an overview of the API and covers authentication, standard response formats, and all available endpoints. It also provides an overview of how databases are structured. You can access databases indirectly using the API.

To interact with the API, you can use tools like Postman or curl, or access it programmatically via HTTP requests.

**API Location:** <https://api.fjnel.co.za/>  
**API Request and Response Format:** JSON  
**API Request Type:** Depends on the endpoint used (see below for more details)

# Table of Contents

- [Documentation](#documentation)
- [Table of Contents](#table-of-contents)
- [Logging](#logging)
- [Response Format](#response-format)
  - [Success Response](#success-response)
  - [Error Response](#error-response)
- [Root Endpoint (Health Check)](#root-endpoint-health-check)
- [Authentication](#authentication)
    - [CAPTCHA Protection Overview](#captcha-protection-overview)
  - [Register](#register)
    - [Rate Limiting](#rate-limiting)
    - [CAPTCHA Protection](#captcha-protection)
    - [Email Verification](#email-verification)
    - [Required Parameters (JSON Body)](#required-parameters-json-body)
    - [Notes](#notes)
    - [Examples](#examples)
  - [Resend Email Verification](#resend-email-verification)
    - [Rate Limiting](#rate-limiting-1)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-1)
    - [Notes](#notes-1)
    - [Examples](#examples-1)
  - [Verify Email](#verify-email)
    - [CAPTCHA Protection](#captcha-protection-1)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-2)
    - [Notes](#notes-2)
    - [Examples](#examples-2)
  - [Login](#login)
    - [Rate Limiting](#rate-limiting-2)
    - [CAPTCHA Protection](#captcha-protection-2)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-3)
    - [Notes](#notes-3)
    - [Examples](#examples-3)
  - [Refresh Token](#refresh-token)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-4)
    - [Examples](#examples-4)
  - [Logout](#logout)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-5)
    - [Required Headers](#required-headers)
    - [Notes](#notes-4)
    - [Examples](#examples-5)
  - [Request Password Reset Email](#request-password-reset-email)
    - [Rate Limiting](#rate-limiting-3)
    - [CAPTCHA Protection](#captcha-protection-3)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-6)
    - [Notes](#notes-5)
    - [Examples](#examples-6)
  - [Reset Password](#reset-password)
    - [Rate Limiting](#rate-limiting-4)
    - [CAPTCHA Protection](#captcha-protection-4)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-7)
    - [Notes](#notes-6)
    - [Examples](#examples-7)
  - [Google OAuth2 Verification](#google-oauth2-verification)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-8)
    - [Notes](#notes-7)
    - [Examples](#examples-8)
- [User Management](#user-management)
    - [Required Headers](#required-headers-1)
  - [Get Current User Profile](#get-current-user-profile)
    - [Notes](#notes-8)
    - [Examples](#examples-9)
  - [Update Current User Profile](#update-current-user-profile)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-9)
    - [Notes](#notes-9)
    - [Examples](#examples-10)
  - [Disable Current User Profile](#disable-current-user-profile)
    - [Notes](#notes-10)
    - [Examples](#examples-11)
  - [Request Email Change](#request-email-change)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-10)
    - [Notes](#notes-11)
  - [Verify Email Change](#verify-email-change)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-11)
    - [Notes](#notes-12)
  - [Request Account Deletion](#request-account-deletion)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-12)
    - [Notes](#notes-13)
- [Admin User Management](#admin-user-management)
- [Book Management (Normal Users)](#book-management-normal-users)
  - [Required Headers](#required-headers-2)
  - [Create a Book and link it to Related Entities](#create-a-book-and-link-it-to-related-entities)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-13)
    - [Nested Related Entities](#nested-related-entities)
    - [Examples](#examples-12)
  - [Create a Book without linking Related Entities](#create-a-book-without-linking-related-entities)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-14)
    - [Notes](#notes-14)
  - [Retrieve all Books](#retrieve-all-books)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-15)
    - [Notes](#notes-15)
    - [Examples](#examples-13)
  - [Retrieve all Book Attributes for Filtering](#retrieve-all-book-attributes-for-filtering)
    - [Notes](#notes-16)
    - [Examples](#examples-14)
  - [Get a Specific Book by ID](#get-a-specific-book-by-id)
    - [Notes](#notes-17)
    - [Examples](#examples-15)
  - [ISBN Lookup](#isbn-lookup)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-16)
    - [Notes](#notes-18)
    - [Examples](#examples-16)
  - [Planned endpoints:](#planned-endpoints)
- [Author Management](#author-management)
- [Borrower Management](#borrower-management)
- [Loan Management](#loan-management)
- [Storage (Location) Management](#storage-location-management)
- [Book Series Management](#book-series-management)
- [Tags (Categories) Management](#tags-categories-management)
- [Book Type Management](#book-type-management)
- [Book Acquisition Location Management](#book-acquisition-location-management)

# Logging

The API uses file-based structured logging (Winston) with size-based rotation. Database logging has been removed to avoid duplication and simplify operations.

- All HTTP requests are logged with: `event=HTTP_REQUEST`, `method`, `path`, `http_status`, `duration_ms`, `ip`, `user_agent`, and a sanitized `request` payload.
- Significant actions (e.g., registration, login, logout, email verification, password reset, profile update) are logged under an action-specific `event` (e.g., `LOGIN_ATTEMPT`, `USER_REGISTERED`) with a consistent payload.
- Sensitive information is redacted before logging (passwords, tokens, secrets, Authorization headers, large strings).

Log entry conventions:
- Top-level fields: `event`, `level`, `timestamp`, `status` (one of `SUCCESS`, `FAILURE`, `INFO`)
- Common context: `user_id`, `ip`, `user_agent`, `http_status` (where applicable)
- Error fields: `error_message` (normalized from any `error`)
- Additional context lives under `details`

Deprecated: `logToFile` (legacy DB logger) is no-op and should not be used. Use `logToFile(event, data, level)` everywhere.

# Response Format

All API responses, whether successful or failed, follow a standardised JSON structure. This ensures consistency and makes it easier to handle responses programmatically.

## Success Response

Successful requests will return a `2xx` HTTP status code and a JSON body with the following structure:

```json
{
 "status": "success",
 "httpCode": 200,
 "responseTime": "15.42", // Response time in milliseconds
 "message": "A success message",
 "data": {
  // Contains the requested data (e.g., a user object, a list of books)
 },
 "errors": [] // Always an empty array on success
}
```

## Error Response

Failed requests will return a `4xx` or `5xx` HTTP status code and provide details in the `errors` array.

```json
{
 "status": "error",
 "httpCode": 400,
 "responseTime": "10.01", // Response time in milliseconds
 "message": "A general error message (e.g., 'Validation Error')",
 "data": {}, // Always an empty object on error
 "errors": [
  "Specific error message 1.",
  "Specific error message 2."
   ]
}
```

# Root Endpoint (Health Check)

**Endpoint:** `GET /`  
**Access:** Public  
**Description:** Returns a welcome message and basic information about the API.  

**Example Response:**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "1.26",
  "message": "The API is working!",
  "data": {
    "timestamp": "11/09/2025, 09:03:54",
    "api_documentation_url": "https://api.fjnel.co.za/api-docs.html"
  },
  "errors": []
}
```

# Authentication

The `/auth/` route is used for all authentication-related operations, including user registration, login, logout, password reset, and token refresh.

### CAPTCHA Protection Overview

This API uses reCAPTCHA v3 to mitigate abuse. Clients must include a `captchaToken` issued by Google reCAPTCHA v3 in the JSON body for protected endpoints. The server verifies the token with Google, enforces a minimum score (≥ 0.7), and checks that the action matches the expected action for the endpoint. If verification fails, the API returns `400` with `message: "CAPTCHA_VERIFICATION_FAILED"`.

- `POST /auth/register` → action: `register`
- `POST /auth/login` → action: `login`
- `POST /auth/resend-verification` → action: `resend-verification`
- `POST /auth/verify-email` → action: `verify-email`
- `POST /auth/request-password-reset` → action: `request-password-reset`
- `POST /auth/reset-password` → action: `reset-password`

## Register

**Endpoint:** `POST /auth/register`
**Access:** Public (Rate Limited) (CAPTCHA Protected) (Email Verification Required)
**Description:** Registers a new user in the database.

### Rate Limiting

To ensure that this endpoint is not abused, it is rate-limited.  
**Limit:** Maximum of 5 requests per IP address every 10 minutes.

### CAPTCHA Protection

To prevent automated registrations, this endpoint is protected by CAPTCHA. Users must complete a CAPTCHA challenge to successfully register. The `captchaToken` as provided by the client must be included in the request body.

### Email Verification

After successful registration, a verification email is sent to the provided email address. The user must verify their email before they can log in. If a registration is attempted with an email that already exists but is not yet verified, the API will (re)send a verification email (reusing an active token if still valid, otherwise creating a new one) and return a success message instead of creating a duplicate account.

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details | Default |
|-----------|------|----------|-------------------------|---------|
| `captchaToken` | String | **Yes** | CAPTCHA token from the client-side challenge, used to verify that the request is human. | |
| `fullName` | String | **Yes** | The user's full name. This allows for flexibility in name formats. Must be between 2 and 255 characters. Only alphabetic characters, spaces, hyphens, full stops and apostrophes are allowed. | |
| `preferredName` | String | No | The user's preferred name. This name will be used in UI elements. Must be between 2 and 100 characters. Only alphabetic characters are allowed. | `null` |
| `email` | String | **Yes** | The user's email address which will be used for login. It must be unique. It must be between 5 and 255 characters and follow standard email formatting rules. The user must be able to receive emails at this address. | |
| `password` | String | **Yes** | The user's password. It must be between 10 and 100 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character. | |

### Notes

- If the email already exists but is not verified, a verification email is (re)sent and the request succeeds with 200 OK. No new account is created. The existing account details are not modified.

### Examples

**Example Request (JSON Object):**

```json
{
 "captchaToken": "<captcha-token-from-client>",
 "fullName": "Jane Doe",
 "preferredName": "Jane",
 "email": "jane@example.com",
 "password": "Str0ng&P@ssw0rd!"
}
```

**Example Success Response (201 Created):**

```json
{
 "status": "success",
 "httpCode": 201,
 "responseTime": "12.34",
 "message": "User registered successfully. Please verify your email before logging in.",
 "data": {
  "id": 123,
  "email": "jane@example.com",
  "fullName": "Jane Doe",
  "preferredName": "Jane",
  "role": "user",
  "isVerified": false
 },
 "errors": []
}
```

**Example Success Response (200 OK):**

```json
{
 "status": "success",
 "httpCode": 200,
 "responseTime": "9.87",
 "message": "Account already exists but not verified. Verification email has been (re)sent.",
 "data": {},
 "errors": []
}
```

**Example Error Response (409 Conflict)**

```json
{
 "status": "error",
 "httpCode": 409,
 "responseTime": "3.21",
 "message": "Email already in use",
 "data": {},
 "errors": [
  "The provided email is already associated with another account."
 ]
}
```

**Example Error Response (400 Bad Request)**

```json
{
 "status": "error",
 "httpCode": 400,
 "responseTime": "4.56",
 "message": "CAPTCHA verification failed",
 "data": {},
 "errors": [
  "CAPTCHA verification failed. Please try again."
 ]
}
```

## Resend Email Verification

**Endpoint:** `POST /auth/resend-verification`  
**Access:** Public (Rate Limited)  
**Description:** Resends the email verification if the account exists but is not yet verified. If an active verification token exists, it is reused; otherwise, a new one is created.

### Rate Limiting

To ensure that this endpoint is not abused, it is rate-limited.  
**Limit:** Maximum of 1 requests per IP address every 5 minutes.

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `captchaToken` | String | **Yes** | CAPTCHA token from the client-side challenge, used to verify that the request is human. |
| `email` | String | **Yes** | The registered email address to resend the verification to. It must be between 5 and 255 characters and follow standard email formatting rules. The user must be able to receive emails at this address. |

### Notes

- The response is always a generic success message to prevent email enumeration. If the email does not exist or is already verified, the response will still indicate that a verification email has been sent.
- If the email already exists but is not verified, a verification email is (re)sent and the request succeeds with 200 OK. No new account is created. The existing account details are not modified.
- If the email does not exist or is already verified, the response will still indicate that a verification email has been sent.
- If the email could not be sent due to a server error, the response will still indicate that a verification email has been sent to avoid revealing whether the email exists in the system.

### Examples

**Example Request (JSON Object):**

```json
{
  "email": "peter@example.com",
  "captchaToken": "<recaptcha-v3-token>"
}
```

**Example Success Response (200 OK):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "60.15",
  "message": {
    "message": "If you have registered an account with this email address and it is unverified, you will receive a verification email.",
    "disclaimer": "If you did not receive an email when you should have, please check your spam folder or try again later."
  },
  "data": {},
  "errors": []
}
```

## Verify Email

**Endpoint:** `POST /auth/verify-email`  
**Access:** Public  
**Description:** Verifies a user's email address using the token that was sent via email.

### CAPTCHA Protection

- reCAPTCHA v3 enforced; expected action: `verify-email` (score ≥ 0.7)
- Include `captchaToken` in the JSON body

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `email` | String | **Yes** | The email address that the verification token was sent to. It must be between 5 and 255 characters and follow standard email formatting rules. |
| `token` | String | **Yes** | The verification token sent to the user's email address. |
| `captchaToken` | String | **Yes** | reCAPTCHA v3 token issued on the client for action `verify-email`. |

### Notes

- If the token is valid (not expired or already used) and matches the email, the user's account will be marked as verified. They can then log in.
- If the token is invalid or expired, or the email does not match, an error message will be returned.
- On successful verification, the system sends a welcome email, including a “Log In” button linking to `https://bookproject.fjnel.co.za/?action=login`.
- Verification emails include a security notice: “If you did not create an account, please contact the system administrator at support@fjnel.co.za to ensure the safety of your account.”

### Examples

**Example Request:**

```json
{
  "email": "peter@example.com",
  "token": "<verification-token>",
  "captchaToken": "<recaptcha-v3-token>"
}
```

**Example Success Response (200 OK):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "25.34",
  "message": "Email verified successfully. You can now log in.",
  "data": {
 "id": 456,
 "email": "peter@example.com"
  }, 
  "errors": []
}
```

**Example Error Response (400 Bad Request)**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "15.67",
  "message": "Incorrect email address, or invalid or expired token.",
  "data": {},
  "errors": [
 "The provided token is invalid or has expired OR the email address is incorrect.",
 "Please request a new verification email."
  ]
}
```

## Login

**Endpoint:** `POST /auth/login`  
**Access:** Public (Rate Limited) (CAPTCHA Protected) (Email Verification Required)  
**Description:** Authenticates a user and returns a JWT token for session management.

### Rate Limiting

To ensure that this endpoint is not abused, it is rate-limited.  
**Limit:** Maximum of 10 requests per IP address every 10 minutes.

### CAPTCHA Protection

To prevent automated login attempts, this endpoint is protected by CAPTCHA. Users must complete a CAPTCHA challenge to successfully log in. The `captchaToken` as provided by the client must be included in the request body.

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `captchaToken` | String | **Yes** | CAPTCHA token from the client-side challenge, used to verify that the request is human. |
| `email` | String | **Yes** | The user's registered email address. |
| `password` | String | **Yes** | The user's password. |

### Notes

- If the email is not verified, the login will fail. The user should first verify their email address before they can log in.
- The email and password fields are not validated for format or length to avoid giving hints to attackers. Both fields must still be provided and non-empty.
- If the email or password is incorrect, a generic error message is returned to avoid revealing which part was wrong.

### Examples

**Example Request (JSON Object):**

```json
{
 "captchaToken": "<captcha-token-from-client>",
 "email": "peter@example.com",
 "password": "StrongPassword@123"
}
```

**Example Success Response (200 OK):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "45.67",
  "message": "Login successful.",
  "data": {
 "accessToken": "<jwt-access-token>",
 "refreshToken": "<refresh-token>",
 "user": {
   "id": 456,
   "email": "peter@example.com",
   "fullName": "Peter Parker",
   "preferredName": "Peter",
   "role": "user",
   "isVerified": true
 }
  },
  "errors": []
}
```

**Example Error Response (401 Unauthorized)**

```json
{
  "status": "error",
  "httpCode": 401,
  "responseTime": "30.12",
  "message": "Invalid email or password.",
  "data": {},
  "errors": [
 "The provided email or password is incorrect."
  ]
}
```

## Refresh Token

**Endpoint:** `POST /auth/refresh-token`  
**Access:** Public  
**Description:** Generates a new access token using a valid refresh token.

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `refreshToken` | String | **Yes** | The refresh token to be used for generating a new access token. |

### Examples

**Example Request (JSON Object):**

```json
{
 "refreshToken": "<refresh-token>"
}
```

**Example Success Response (200 OK):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "25.34",
  "message": "Access token refreshed.",
  "data": {
 "accessToken": "<new-jwt-access-token>"
  },
  "errors": []
}
```

## Logout

**Endpoint:** `POST /auth/logout`  
**Access:** Authenticated Users  
**Description:** Logs out the user by invalidating their refresh token. This logs the user out from all devices.  

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `refreshToken` | String | **Yes** | The refresh token to be invalidated. |

### Required Headers

| Header | Type | Required | Format | Description and Details |
|--------|------|----------|--------|-------------------------|
| `Authorization` | String | **Yes**| `Bearer <token>` | Bearer token containing the user's access token. This token is used to identify the user. It has a limited lifespan and must be refreshed periodically. |

### Notes

- To log out, the user must provide their refresh token in the request body and a valid access token in the `Authorization` header. The tokens must belong to the same user.
- If the refresh token is invalid or does not belong to the user, an error message will be returned.
- If the access token is missing or invalid, an error will be returned.

### Examples

**Example Request (JSON Object):**

```json
{
 "refreshToken": "<refresh-token>"
}
```

**Example Success Response (200 OK):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "20.45",
  "message": "Logged out successfully.",
  "data": {},
  "errors": []
}
```

## Request Password Reset Email

**Endpoint:** `POST /auth/request-password-reset`  
**Access:** Public (Rate Limited) (CAPTCHA Protected)  
**Description:** Sends a password reset email to the user if the email exists in the system.

### Rate Limiting

To ensure that this endpoint is not abused, it is rate-limited.  
**Limit:** Maximum of 1 request per IP address every 5 minutes.

### CAPTCHA Protection

To prevent automated requests, this endpoint is protected by CAPTCHA. Users must complete a CAPTCHA challenge to successfully request a password reset. The `captchaToken` as provided by the client must be included in the request body.

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `captchaToken` | String | **Yes** | CAPTCHA token from the client-side challenge, used to verify that the request is human. |
| `email` | String | **Yes** | The registered email address to send the password reset link to. It must be between 5 and 255 characters and follow standard email formatting rules. The user must be able to receive emails at this address. |

### Notes

- The response is always a generic success message to prevent email enumeration. If the email does not exist, the response will still indicate that a password reset email has been sent.
- If the email could not be sent due to a server error, the response will still indicate that a password reset email has been sent to avoid revealing whether the email exists in the system.

### Examples

**Example Request (JSON Object):**

```json
{
 "captchaToken": "<captcha-token>",
 "email": "<user-email>"
}
```

**Example Success Response (200 OK):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "30.12",
  "message": "Password reset email sent.",
  "data": {},
  "errors": []
}
```

## Reset Password

**Endpoint:** `POST /auth/reset-password`  
**Access:** Public (Rate Limited) (CAPTCHA Protected)  
**Description:** Resets the user's password using the token sent to their email.

### Rate Limiting

To ensure that this endpoint is not abused, it is rate-limited.  
**Limit:** Maximum of 1 request per IP address every 5 minutes.

### CAPTCHA Protection

To prevent automated requests, this endpoint is protected by CAPTCHA. Users must complete a CAPTCHA challenge to successfully reset their password. The `captchaToken` as provided by the client must be included in the request body.

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `captchaToken` | String | **Yes** | CAPTCHA token from the client-side challenge, used to verify that the request is human. |
| `email` | String | **Yes** | The registered email address associated with the account. It must be between 5 and 255 characters and follow standard email formatting rules. |
| `token` | String | **Yes** | The password reset token sent to the user's email address. |
| `newPassword` | String | **Yes** | The new password for the user's account. It must be between 10 and 100 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character. |

### Notes

- If the token is valid (not expired or already used) and matches the email, the user's password will be updated. All existing refresh tokens for the user will be revoked, requiring re-authentication.
- If the token is invalid or expired, or the email does not match, an error message will be returned.
- On successful reset, the system sends a confirmation email, including a “Log In” button linking to `https://bookproject.fjnel.co.za/?action=login`.
- Password reset emails include a security notice: “If you did not request a password reset, please contact the system administrator at support@fjnel.co.za to ensure the safety of your account.”

### Examples

**Example Request (JSON Object):**

```json
{
 "captchaToken": "<captcha-token>",
 "email": "peter@example.com",
 "token": "<reset-token>",
 "newPassword": "<new-password>"
}
```

**Example Success Response (200 OK):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "30.12",
  "message": "Password has been reset successfully.",
  "data": {},
  "errors": []
}
```

## Google OAuth2 Verification

**Endpoint:** `POST /auth/google`  
**Access:** Public
**Description:** Verifies a Google OAuth2 token and logs in or registers the user.

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `idToken` | String | **Yes** | The ID token obtained from Google after user authentication. This token is used to verify the user's identity and retrieve their profile information. |

### Notes

- If the user does not exist in the system, a new account will be created using the information retrieved from Google. The account will be marked as verified since Google has already verified the user's email.
- If the user already exists, they will be logged in and a new access token will be issued.
- The `preferredName` will be set to the user's first name as provided by Google.
- The password field will be set to `null`.
- If the email provided by Google is already associated with a non-Google account, Google will be added as an OAuth provider for the existing account. This means that the user can log in using either their original method (email/password) or Google OAuth2 in the future.

### Examples

**Example Request (JSON Object):**

```json
{
 "idToken": "<google-id-token>"
}
```

**Example Success Response (200 OK):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "40.56",
  "message": "Login successful.",
  "data": {
    "accessToken": "<jwt-access-token>",
    "refreshToken": "<refresh-token>",
    "user": {
      "id": 789,
      "email": "<user-email>",
      "preferredName": "<user-first-name>",
      "provider": "google"
    }
  },
  "errors": []
}
```

# User Management

The `/users/` route is used for all user-related operations, including retrieving and updating user profiles. 

### Required Headers

For any endpoint that requires authentication, the following header must be included:

| Header | Type | Required | Format | Description and Details |
|--------|------|----------|--------|-------------------------|
| `Authorization` | String | **Yes**| `Bearer <token>` | Bearer token containing the user's access token. This token is used to identify the user. It has a limited lifespan and must be refreshed periodically. |

## Get Current User Profile

**Endpoint:** `GET /users/me`  
**Access:** Authenticated Users  
**Description:** Retrieves the profile information of the currently authenticated user.  

### Notes

- The user must be authenticated to access this endpoint. If the access token is missing or invalid, an error will be returned.
- The response will include the user's ID, email, full name, preferred name, role, verification status, OAuth provider(s) (if any), and timestamps for account creation and last update.
- Sensitive information such as passwords or tokens will not be included in the response.

### Examples

**Example Success Response (200 OK):**
```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "15.67",
  "message": "PROFILE_RETRIEVAL_SUCCESS",
  "data": {
    "id": 456,
    "email": "jane@example.com",
    "fullName": "Jane Doe",
    "preferredName": "Jane",
    "role": "user",
    "isVerified": true,
    "oauthProviders": ["google", "facebook"],
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:00:00Z"
  },
  "errors": []
}
```

## Update Current User Profile

**Endpoint:** `PUT /users/me`  
**Access:** Authenticated Users  
**Description:** Updates the profile information of the currently authenticated user.

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `fullName` | String | No | The user's full name. Must be between 2 and 255 characters. Only alphabetic characters, spaces, hyphens, full stops and apostrophes are allowed. |
| `preferredName` | String | No | The user's preferred name. Must be between 2 and 100 characters. Only alphabetic characters are allowed. |


### Notes

- The user must be authenticated to access this endpoint. If the access token is missing or invalid, an error will be returned.
- Only fields provided in the request body will be updated. Fields not included will remain unchanged.
- If any of the provided fields are invalid (e.g., too short, too long, contains invalid characters), an error message will be returned and no changes will be made.
- The role, email and password fields cannot be updated via this endpoint:
 - To update the role: Requires admin privileges and must be done via the dedicated admin endpoint.
 - To update the email: Requires re-verification and must be done via a dedicated endpoint.
 - To update the password: Must be done via the password reset flow (`auth/request-password-reset` and `auth/reset-password`) on the front-end.
 - To disable the account: Use the `DELETE /users/me` endpoint.
- The response will include the updated user profile information.

### Examples

**Example Request (JSON Object):**

```json
{
 "fullName": "John Smith",
 "preferredName": "John"
}
```

**Example Success Response (200 OK):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "20.45",
  "message": "PROFILE_UPDATE_SUCCESS",
  "data": {
    "id": 456,
    "email": "jane@example.com", // Email cannot be changed via this endpoint
    "fullName": "John Smith",
    "preferredName": "John",
    "role": "user",
    "isVerified": true,
    "oauthProviders": ["google", "facebook"],
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:00:00Z"
  },
  "errors": []
}
```

**Example Error Response (400 Bad Request)**

```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "10.12",
  "message": "PROFILE_UPDATE_FAILED",
  "data": {},
  "errors": [
    "FULL_NAME_LENGTH",
    "PREFERRED_NAME_ALPHABETICS_ONLY"
  ]
}
```

## Disable Current User Profile

**Endpoint:** `DELETE /users/me`  

**Access:** Authenticated Users  

**Description:** Disables (soft deletes) the currently authenticated user's profile. This action is reversible by contacting a system administrator.  

### Notes

- The user must be authenticated to access this endpoint. If the access token is missing or invalid, an error will be returned.
- Disabling the profile will prevent the user from logging in or accessing any authenticated endpoints.
- The user's data will remain in the database but will be marked as disabled. This allows for potential reactivation by an administrator.
- The user will receive a confirmation email notifying them of the account disablement and instructions on how to contact the System Administrator if they wish to reactivate their account. (Not yet implemented!)

### Examples

**Example Success Response (200 OK):**

```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "18.34",
  "message": "USER_DISABLE_SUCCESS",
  "data": {},
  "errors": []
}
```

## Request Email Change

> Not yet implemented!

**Endpoint:** `POST /users/me/request-email-change`  
**Access:** Authenticated Users
**Description:** Requests an email change for the currently authenticated user. A verification email will be sent to the new email address.  

### Required Parameters (JSON Body)
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `newEmail` | String | Yes | The new email address to be set for the user. It must be between 5 and 255 characters and follow standard email formatting rules. The user must be able to receive emails at this address. |

### Notes

- The user must be authenticated to access this endpoint. If the access token is missing or invalid, an error will be returned.
- The new email address must not already be associated with another account. If it is, an error message will be returned.
- A verification email will be sent to the new email address. The email change will only take effect after the user verifies the new email using the link and token sent in their email. 
- Once the email change is requested, the user will still be able to log in using their old email until the new email is verified.
- Once the new email is verified, the user's email in the system will be updated to the new address.
- When the email is updated in the system (using the `POST /auth/verify-email-change` endpoint), all existing refresh tokens for the user will be revoked, requiring re-authentication. 

## Verify Email Change

> Not yet implemented!

**Endpoint:** `POST /auth/verify-email-change`  
**Access:** Public
**Description:** Verifies the email change request for the currently authenticated user. This endpoint must be called with the token received in the verification email.

### Required Parameters (JSON Body)
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `email` | String | Yes | The new email address that the verification token was sent to. It must be between 5 and 255 characters and follow standard email formatting rules. |
| `token` | String | Yes | The verification token sent to the new email address. |

### Notes

- If the token is valid (not expired or already used) and matches the new email, the user's email in the system will be updated to the new address. All existing refresh tokens for the user will be revoked, requiring re-authentication.
- The new email address must not already be associated with another account. If it is, an error message will be returned.
- The response will include the updated user profile information.
- Any OAuth providers linked to the old email will be unlinked. The user will need to re-link them using the new email address. If the user tries to log in with an OAuth provider using the old email, a new account will be created because the old email is no longer associated with an account.
- If the token is invalid or expired, or the email does not match, an error message will be returned.


## Request Account Deletion

> Not yet implemented!

Users can request permanent deletion of their account and all associated data. This action is irreversible and will remove all user data from the system. To do this, users can use this endpoint which will inform the System Administrator of their request. 

**Endpoint:** `POST /users/me/request-account-deletion`  
**Access:** Authenticated Users  
**Description:** Requests permanent deletion of the currently authenticated user's account and all associated data. This action is irreversible and will remove all user data from the system after a grace period.

### Required Parameters (JSON Body)
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `reason` | String | No | The reason for requesting account deletion. This will be sent to the System Administrator. It can be omitted. |

### Notes

- The user must be authenticated to access this endpoint. If the access token is missing or invalid, an error will be returned.
- The user will receive a confirmation email acknowledging their request, with information about the grace period and how to cancel the request if they change their mind.
- The System Administrator will also be notified of the request for review. Once the grace period has passed, the user's account and all associated data will be permanently deleted from the system by the System Administrator.
- During the grace period the user will not be able to log in or access any part of the system.

---
---
---

# Admin User Management

> Not yet implemented!

`GET /admin/users/` - List all users (admin only, with pagination and filtering)  
`POST /admin/users/` - Create a new user (admin only)  
`GET /admin/users/:id` - Get a specific user profile by ID (admin only)  
`PUT /admin/users/:id` - Update a specific user's profile by ID (including role and email, admin only)  
`DELETE /admin/users/:id` - Permanently delete a user by ID (hard delete, admin only)  
`POST /admin/users/:id/disable` - Disable a user profile by ID (admin only)  
`POST /admin/users/:id/enable` - Re-enable a disabled user profile by ID (admin only)  
`POST /admin/users/:id/unverify` - Mark a user's email as unverified by ID (admin only)  
`POST /admin/users/:id/verify` - Mark a user's email as verified by ID (bypassing verification, admin only)  
`POST /admin/users/:id/send-verification` - Resend email verification for a user (admin only)  
`POST /admin/users/:id/reset-password` - Trigger a password reset for a user by ID (admin only)  
`POST /admin/users/:id/force-logout` - Force logout a user (invalidate all sessions, admin only)  
`POST /admin/users/:id/handle-account-deletion` - Permanently delete a user and all associated data after review (admin only)

---
---
---

# Book Management (Normal Users)

The `/books/` route is used for all book-related operations, including creating, retrieving, updating, and deleting books. Books can be linked to related entities such as authors, publishers, series, storage locations, and tags.

## Required Headers

For any endpoint that requires authentication, the following header must be included:

| Header | Type | Required | Format | Description and Details |
|--------|------|----------|--------|-------------------------|
| `Authorization` | String | **Yes**| `Bearer <token>` | Bearer token containing the user's access token. This token is used to identify the user. It has a limited lifespan and must be refreshed periodically. |

## Create a Book and link it to Related Entities

**Endpoint:** `POST /books/full`

**Access:** Authenticated Users

**Description:** Creates a new book and links related entities such as authors, publisher(s), series, storage location, and tags.
- An `id` attribute can be used to link the book to an existing entity. Use other endpoints to create, update, or retrieve existing entities.
- **Important:** This endpoint creates a record in the `books` table (with all the book information) and one in the `book_copies` table (the first, physical copy owned by the authenticated user). Both records are created in a single transaction to ensure data integrity.
- If the user owns multiple copies of the same book, they must call the `POST /book-copies/` endpoint to add additional copies.
- The entire operation is atomic: if any part of the request fails (e.g. invalid data, constraint violation), the entire transaction is rolled back and no data is created.
- This endpoint does not support creation of related entities. Use their respective endpoints to create authors, publishers, series, storage locations, or book types.
- This endpoint does not support updating existing books. Use the `PUT /books/:id` endpoint for updates.

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
|` title` | String | **Yes** | The book's title. Must be between 2 and 255 characters. |
| `subtitle` | String | No | The book's subtitle. Must be between 2 and 255 characters if provided. |
| `isbn` | String | No | The book's ISBN. Must be a valid ISBN-10 or ISBN-13 format if provided. Must be unique within the user's collection. |
| `publicationYear` | Integer | No | The year the book was published. Must be a four-digit year between 1000 and the current year. |
| `language` | String | No | The two letter ISO 639-1 code for the book's language (e.g., "`en`" for English, "`fr`" for French). |
| `pages` | Integer | No | The number of pages in the book. Must be a positive integer if provided. |
| `description` | String | No | A brief description or summary of the book. Can be up to 2000 characters. |
| `coverImageUrl` | String | No | A URL to an image of the book's cover. Must be a valid URL format if provided. |

CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  isbn VARCHAR(20),
  publisher_id INT REFERENCES publishers(id),
  series_id INT REFERENCES series(id),
  type_id INT REFERENCES book_types(id),
  publication_year INT,
  pages INT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
CREATE TABLE book_copies (
  id SERIAL PRIMARY KEY,
  book_id INT NOT NULL REFERENCES books(id),
  user_id INT NOT NULL REFERENCES users(id),
  storage_id INT REFERENCES storages(id),
  story_text TEXT,
  acquisition_date DATE,
  acquisition_from_person VARCHAR(255),
  acquisition_from_org VARCHAR(255),
  condition VARCHAR(50),
  notes TEXT,
  borrower_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
CREATE TABLE book_languages (
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  language_code VARCHAR(2) NOT NULL,
  PRIMARY KEY (book_id, language_code)
);


### Nested Related Entities

#### Book Type

- Accepts a single book type `id`. A book can only have one type.
- The `id` must reference an existing book type.
- To create new book types, use the `POST /book-types/` endpoint. 

For the `bookType` object:
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `id` | Integer | **Yes** | The ID of an existing book type to link. Must belong to the authenticated user. |

CREATE TABLE book_types (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

#### Authors

- Accepts an array of author objects. **Note:** It is uncommon for a book to have multiple authors, but this implementation allows it for flexibility.
- Each author object must contain an `id` field referencing an existing author.
- Optionally, you can provide a `role` field to specify the author's role in relation to this book.
- To create new authors, use the `POST /authors/` endpoint.

For each `author` object:
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `id` | Integer | **Yes** | The ID of an existing author to link. Must belong to the authenticated user.  |
| `role` | String | No | The author's role in relation to the book (e.g., "Author", "Editor", "Illustrator"). Can be up to 100 characters if provided. |

CREATE TABLE authors (
    id          SERIAL PRIMARY KEY,
    full_name   VARCHAR(255) NOT NULL,
    DOB         DATE,
    DOD         DATE,
    biography   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE book_authors (
    book_id    INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id  INT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    role       VARCHAR(100), -- e.g., "Author", "Editor", "Illustrator"
    PRIMARY KEY (book_id, author_id)
);



#### Publishers

- Accepts a single publisher `id`. **Note:** Since books are usually identified by ISBN, a book can only have one publisher.
- The `id` must reference an existing publisher.
- To create new publishers, use the `POST /publishers/` endpoint.

For the `publisher` object:
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `id` | Integer | **Yes** | The ID of an existing publisher to link. Must belong to the authenticated user. |

CREATE TABLE publishers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    founded_year INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


#### Series

- Accepts an array of series objects. **Note:** It is uncommon for a book to belong to multiple series, but this implementation allows it for flexibility.
- Each series object must contain an `id` field referencing an existing series.
- Optionally, you can provide an `order` field to specify the book's position within the series.
- To create new series, use the `POST /series/` endpoint.

For each `series` object:
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `id` | Integer | **Yes** | The ID of an existing series to link. Must belong to the authenticated user. |
| `order` | Integer | No | The order of the book within the series. Must be a positive integer (or zero) if provided. |

CREATE TABLE series (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE book_series (
    book_id    INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    series_id  INT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    order      INT, -- position in the series
    PRIMARY KEY (book_id, series_id)
);

#### Storage Locations

- Accepts a single storage location `id`. This will be the location of the first copy of the book being created.
- Storage locations are hierarchical (e.g., "Living Room > Shelf A > Row 2"). Assigning a child's location implicitly assigns all its parent locations.
- The `id` must reference an existing storage location.
- If omitted or `null`, the first book copy will be created without a storage location.
- To create new storage location, use the `POST /storage-locations/` endpoint. 

> **Note:** This is the storage location of the first copy of the book being created. If the user owns multiple copies of the same book, they must use the `POST /book-copies/` endpoint to add additional copies and specify their storage locations.

For the `storageLocation` object:
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `id` | Integer | No | The ID of an existing storage location to link. Must belong to the authenticated user. |

CREATE TABLE storage_locations (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,   -- e.g., "Living Room Shelf A"
    description TEXT,
    parent_id   INT REFERENCES storage_locations(id) ON DELETE SET NULL, -- nested hierarchy
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

#### Tags

- Accepts an array of tag objects.
- Each tag object must contain a `name` field.
- Tags are unique per user. If a tag with the same name already exists for the user, it will be linked to the book instead of creating a duplicate.
- Tags can be up to 50 characters long and can contain letters and spaces.
- Tags are case-insensitive. "Science Fiction" and "science fiction" will be treated as the same tag.
- If no tags are provided, the book will have no tags.

For each `tag` object:
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `name`    | String | **Yes** | The name of the tag. Must be unique per user and can be up to 50 characters long. Can only contain letters and spaces. |

CREATE TABLE tags (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);
CREATE TABLE user_book_tags (
    user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id   INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    tag_id    INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, book_id, tag_id)
);

#### Stories (Acquisition Notes)

Stories are not supported in this endpoint. Use the `POST /stories/` endpoint to create book acquisition stories, analyze them, and link them to specific `book_copies`.

### Examples

**Example Request (JSON Object):**

```json
{
 "title": "The Great Gatsby",
 "subtitle": "A Novel",
 "isbn": "9780743273565",
 "publicationYear": 1925,
 "language": "en",
 "pages": 180,
 "description": "A novel set in the Roaring Twenties...",
 "coverImageUrl": "https://example.com/covers/great-gatsby.jpg",
 "bookType": {
   "id": 1
 },
 "authors": [
   {
     "id": 10,
     "role": "Author"
   }
 ],
 "publishers": [
   {
     "id": 5
   }
 ],
 "series": [
   {
     "id": 2,
     "order": 1
   }
 ],
 "storageLocation": {
   "id": 3
 },
 "tags": [
   {
     "name": "Classic"
   },
   {
     "name": "Fiction"
   }
 ]
}
```

**Example Success Response (201 Created):**

```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "45.67",
  "message": "Book created successfully.",
  "data": {
    "bookId": 123,
    "bookCopyId": 456
    //All information about the created book and its first copy can be retrieved using the GET /books/:id endpoint
  },
  "errors": []
}
```

## Create a Book without linking Related Entities

**Endpoint:** `POST /books/`  
**Access:** Authenticated Users  
**Description:** Creates a new book without linking any related entities. This endpoint creates a record in the `books` table with the provided details. It does not create a record in the `book_copies` table. To add physical copies of the book owned by the user, they must use the `POST /book-copies/` endpoint after the book is created.

### Required Parameters (JSON Body)
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
|` title` | String | **Yes** | The book's title. Must be between 1 and 255 characters. |
| `subtitle` | String | No | The book's subtitle. Must be between 1 and 255 characters if provided. |
| `isbn` | String | No | The book's ISBN. Must be a valid ISBN-10 or ISBN-13 format if provided. Must be unique within the user's collection. |
| `publicationYear` | Integer | No | The year the book was published. Must be a four-digit year between 1000 and the current year. |
| `language` | String | No | The two letter ISO 639-1 code for the book's language (e.g., "`en`" for English, "`fr`" for French). |
| `pages` | Integer | No | The number of pages in the book. Must be a positive integer if provided. |
| `description` | String | No | A brief description or summary of the book. Can be up to 1000 characters. |
| `coverImageUrl` | String | No | A URL to an image of the book's cover. Must be a valid URL format if provided. |

### Notes

- The user must be authenticated to access this endpoint. If the access token is missing or invalid, an error will be returned.
- If the `isbn` is provided, it must be unique within the user's collection. If a book with the same `isbn` already exists for the user, an error message will be returned.
- The response will include the ID of the newly created book and all provided details.
- To add physical copies of the book owned by the user, they must use the `POST /book-copies/` endpoint after the book is created.
- This endpoint does not support linking related entities such as authors, publishers, series, storage locations, or tags. Use the `POST /books/full` endpoint to create a book with linked entities.
- This endpoint does not support updating existing books. Use the `PUT /books/:id` endpoint for updates.
- The entire operation is atomic: if any part of the request fails (e.g. invalid data, constraint violation), no data will be created.


## Retrieve all Books

**Endpoint:** `GET /books/`  
**Access:** Authenticated Users  
**Description:** Retrieves a paginated list of all books owned by the authenticated user, with optional filtering, sorting, and search. Both `books` and their associated `book_copies` records are included: The response reflects only the copies owned by the currently authenticated user.

### Required Parameters (JSON Body)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `page` | Integer | No | The page number to retrieve. Must be a positive integer. Default is `1`. |
| `limit` | Integer | No | The number of `book`s per page. Must be a positive integer between `1` and `100`. Default is `20`. |
| `sortBy` | String | No | The field to sort the results by. Allowed values are: `title`, `subtitle`, `isbn`, `language`, `publicationYear`, `pages`, `createdAt`, `updatedAt`. Default is `title`. |
| `sortOrder` | String | No | The order to sort the results. Allowed values are: `asc` (ascending) and `desc` (descending). Default is `asc`. |
| `search` | String | No | A broad keyword search across `title`, `subtitle`, `description`, `authors`, `tags`, `ISBN`, and `series`. Case-insensitive. Must be at least 3 characters long and not exceed 100 characters. |
| `filters` | Object | No | An object container optional filtering criteria. Each filter is optional and can be combined. See the table below for more information. |

#### Supported Filters

| Field | Type | Description and Details |
|-------|------|-------------------------|
| `title` | String | Filter books by title. Case-insensitive partial match. |
| `authorId` | Integer | Filter books by a specific author ID. Show only books by this author. |
| `publisherId` | Integer | Filter books by a specific publisher ID. Show only books by this publisher. |
| `seriesId` | Integer | Filter books by a specific series ID. Show only books in this series. |
| `storageId` | Integer | Filter books by a specific storage location ID. Show only books in this location. |
| `typeId` | Integer | Filter books by a specific book type ID. Show only books of this type. |
| `language` | String | Filter books by language (ISO 639-1 code). Case-insensitive exact match. |
| `tagIds` | Array of Integers | Filter books by multiple tag IDs. Results will default to an *OR* match. See below for more details. |
| `tagIdStrict` | Boolean | If `true`, only return books that have *all* of the specified `tagIds` (*AND* logic). If `false` or omitted, return books that have *any* of the specified `tagIds` (*OR* logic). |
| `publicationYearMin` | Integer | Filter books published in or after this year. Must be a four-digit year between 1000 and the current year. |
| `publicationYearMax` | Integer | Filter books published in or before this year. Must be a four-digit year between 1000 and the current year. |
| `pagesMin` | Integer | Filter books with at least this many pages. Must be a positive integer. |
| `pagesMax` | Integer | Filter books with at most this many pages. Must be a positive integer. |
| `acquisitionDateMin` | Date | Filter books with copies acquired on or after this date. |
| `acquisitionDateMax` | Date | Filter books with copies acquired on or before this date. |
| `borrowed` | Boolean | If `true`, return only books that are currently loaned out. If `false`, return only books that are not loaned out. If omitted, return all books regardless of loan status. |
| `borrowerId` | Integer | Filter books currently loaned to a specific borrower ID. Show only books currently loaned to this borrower. |

### Notes

- The user must be authenticated to access this endpoint. If the access token is missing or invalid, an error will be returned.
- The response will include pagination metadata (total items, total pages, current page, items per page) along with the list of books.
- Each book in the response will include its associated authors, publishers, series, tags, and the details of all copies owned by the authenticated user.
- Filtering applies only to the books owned by the authenticated user.
- Combining filters allows for complex queries. `AND` logic is applied between different filter fields: The more filters specified, the narrower the results.
- Sorting only applies to the book-level fields, not the book copies.

### Examples

...

## Retrieve all Book Attributes for Filtering

**Endpoint:** `GET /books/filter/`  
**Access:** Authenticated Users  
**Description:** Retrieves all distinct values for book attributes (authors, tags, series, storage locations, types) owned by the authenticated user to assist with frontend filtering options.

### Notes

- The user must be authenticated to access this endpoint. If the access token is missing or invalid, an error will be returned.
- The response will include all pagination metadata (total items, total pages, current page, items per page) along with distinct values for book attributes owned by the authenticated user.

### Examples

...

## Get a Specific Book by ID

**Endpoint:** `GET /books/:id`  
**Access:** Authenticated Users  
**Description:** Retrieves all information for a specific book by its ID, including its associated authors, publishers, series, tags, and details of all copies owned by the authenticated user.

### Notes

- The user must be authenticated to access this endpoint. If the access token is missing or invalid, an error will be returned.
- If the book is not found or does not belong to the authenticated user, a 404 Not Found error will be returned.

### Examples

...

## ISBN Lookup

**Endpoint:** `GET /books/fetch-isbn`
**Access:** Authenticated Users  
**Description:** Fetches book details from multiple external APIs using an ISBN number. It returns consistently formatted book information that can be used to pre-fill book creation forms, reducing manual data entry. The user can then review and modify the information before creating the book in their collection. 

### Required Parameters (JSON Body)
| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `isbn` | String | **Yes** | The ISBN number of the book to look up. Must be a valid ISBN-10 or ISBN-13 format. |

### Notes

- The user must be authenticated to access this endpoint. If the access token is missing or invalid, an error will be returned.
- This endpoint does not create any records in the database; it only retrieves information from external sources.
- This API will call multiple external API services in parallel to get the most comprehensive data available. If one service fails, it will still return data from the other services. It will then consolidate the results into a single response which may include partial data if some services failed or if certain information is not available.
- The response will include all information required to create a book record, including title, author(s), publisher(s), series(s), publication date, and more.

#### API Services Used
- Open Library Books API: https://openlibrary.org/dev/docs/api/books
- Google Books API: https://developers.google.com/books/docs/v1/using

### Examples

...


## Planned endpoints:

`PUT /books/:id` - Update a specific book by ID (only if owned by the authenticated user)
`DELETE /books/:id` - Delete a specific book by ID (only if owned by the authenticated user)
`GET /books/:id/authors` - List all authors for a specific book
`POST /books/:id/authors/:authorId` - Add an author to a book
`DELETE /books/:id/authors/:authorId` - Remove an author from a book
`PATCH /books/:id/storage/:storageId` - Move a book to a different storage location
`GET /books/:id/type` - Get the type of a specific book
`PATCH /books/:id/type/:typeId` - Change the type of a specific book to a different type

`GET /admin/books/` - List all books (admin only, with pagination and filtering)
`GET /admin/books/:id` - Get a specific book by ID (admin only)
`DELETE /admin/books/:id` - Delete a specific book by ID (admin only)

---

# Author Management

`GET /authors/` - List all authors owned by the authenticated user (with pagination and filtering)
`POST /authors/` - Create a new author owned by the authenticated user
`GET /authors/:id` - Get a specific author by ID (only if owned by the authenticated user)
`PUT /authors/:id` - Update a specific author by ID (only if owned by the authenticated user)
`DELETE /authors/:id` - Delete a specific author by ID (only if owned by the authenticated user)

`GET /admin/authors/` - List all authors (admin only, with pagination and filtering)
`GET /admin/authors/:id` - Get a specific author by ID (admin only)
`DELETE /admin/authors/:id` - Delete a specific author by ID (admin only)

---

# Borrower Management

`GET /borrowers/` - List all borrowers owned by the authenticated user (with pagination and filtering)
`POST /borrowers/` - Create a new borrower owned by the authenticated user
`GET /borrowers/:id` - Get a specific borrower by ID (only if owned by the authenticated user)
`PUT /borrowers/:id` - Update a specific borrower by ID (only if owned by the authenticated user)
`DELETE /borrowers/:id` - Delete a specific borrower by ID (only if owned by the authenticated user)
`POST /borrowers/:id/loans` - Record a new loan for a borrower
`GET /borrowers/:id/loans` - List all loans for a borrower
`DELETE /borrowers/:id/loans/:loanId` - Mark a specific loan as returned

`GET /admin/borrowers/` - List all borrowers (admin only, with pagination and filtering)
`GET /admin/borrowers/:id` - Get a specific borrower by ID (admin only)
`DELETE /admin/borrowers/:id` - Delete a specific borrower by ID (admin only)

---

# Loan Management

`GET /loans/` - List all loans for the authenticated user (with pagination and filtering)
`POST /loans/` - Create a new loan (book + borrower + due date)
`GET /loans/:id` - Get details of a specific loan
`PUT /loans/:id/return` - Mark a loan as returned
`GET /loans/:id/history` - Get the history of a specific loan

`GET /admin/loans/` - List all loans (admin only, with pagination and filtering)
`GET /admin/loans/overdue` - List all overdue loans (admin only)

---

# Storage (Location) Management

`GET /storage/` - List all storage locations owned by the authenticated user (with pagination and filtering)
`GET /storage/:id` - Get a specific storage location by ID
`POST /storage/` - Create a new storage location
`PUT /storage/:id` - Update a specific storage location
`DELETE /storage/:id` - Delete a specific storage location
`GET /storage/:id/books` - List all books in a specific storage location

`GET /admin/storage/` - List all storage locations (admin only, with pagination and filtering)
`GET /admin/storage/:id` - Get a specific storage location by ID (admin only)
`DELETE /admin/storage/:id` - Delete a specific storage location by ID (admin only)

---

# Book Series Management

`GET /series/` - List all book series owned by the authenticated user (with pagination and filtering)
`GET /series/:id` - Get a specific book series by ID
`POST /series/` - Create a new book series
`PUT /series/:id` - Update a specific book series
`DELETE /series/:id` - Delete a specific book series
`GET /series/:id/books` - List all books in a specific series
`POST /series/:id/books/:bookId` - Add a book to a series
`DELETE /series/:id/books/:bookId` - Remove a book from a series

`GET /admin/series/` - List all book series (admin only, with pagination and filtering)
`GET /admin/series/:id` - Get a specific book series by ID (admin only)
`DELETE /admin/series/:id` - Delete a specific book series by ID (admin only)

---

# Tags (Categories) Management

`GET /tags/` - List all tags created by the authenticated user
`POST /tags/` - Create a new tag
`GET /tags/:id` - Get a specific tag by ID
`DELETE /tags/:id` - Delete a specific tag
`POST /books/:id/tags/:tagId` - Add a tag to a book
`DELETE /books/:id/tags/:tagId` - Remove a tag from a book
`GET /tags/:id/books` - List all books with a specific tag

# Book Type Management

`GET /book-types/` - List all book types created by the authenticated user (with pagination and optional filtering)
`POST /book-types/` - Create a new book type for the authenticated user
`GET /book-types/:id` - Get a specific book type by ID (only if owned by the authenticated user)
`PUT /book-types/:id` - Update a specific book type by ID (only if owned by the authenticated user)
`DELETE /book-types/:id` - Delete a specific book type by ID (only if owned by the authenticated user)

`GET /admin/book-types/` - List all book types for all users (admin only, with pagination and filtering)
`GET /admin/book-types/:id` - Get a specific book type by ID (admin only)
`DELETE /admin/book-types/:id` - Delete a specific book type by ID (admin only)

---

# Book Acquisition Location Management

`GET /locations-acquired/` - List all book acquisition locations created by the authenticated user (with pagination and filtering)
`POST /locations-acquired/` - Create a new acquisition location for the authenticated user
`GET /locations-acquired/:id` - Get a specific acquisition location by ID (only if owned by the authenticated user)
`PUT /locations-acquired/:id` - Update a specific acquisition location by ID (only if owned by the authenticated user)
`DELETE /locations-acquired/:id` - Delete a specific acquisition location by ID (only if owned by the authenticated user)

`GET /books/:id/location-acquired` - Get the acquisition location of a specific book
`PATCH /books/:id/location-acquired/:locationId` - Update the acquisition location of a specific book

`GET /admin/locations-acquired/` - List all acquisition locations for all users (admin only, with pagination and filtering)
`GET /admin/locations-acquired/:id` - Get a specific acquisition location by ID (admin only)
`DELETE /admin/locations-acquired/:id` - Delete a specific acquisition location by ID (admin only)



