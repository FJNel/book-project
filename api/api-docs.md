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
    - [Required Parameters (Query String)](#required-parameters-query-string)
    - [Notes](#notes-2)
    - [Examples](#examples-2)
  - [Login](#login)
    - [Rate Limiting](#rate-limiting-2)
    - [CAPTCHA Protection](#captcha-protection-1)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-2)
    - [Notes](#notes-3)
    - [Examples](#examples-3)
  - [Refresh Token](#refresh-token)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-3)
    - [Examples](#examples-4)
  - [Logout](#logout)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-4)
    - [Required Headers](#required-headers)
    - [Notes](#notes-4)
    - [Examples](#examples-5)
  - [Request Password Reset Email](#request-password-reset-email)
    - [Rate Limiting](#rate-limiting-3)
    - [CAPTCHA Protection](#captcha-protection-2)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-5)
    - [Notes](#notes-5)
    - [Examples](#examples-6)
  - [Reset Password](#reset-password)
    - [Rate Limiting](#rate-limiting-4)
    - [CAPTCHA Protection](#captcha-protection-3)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-6)
    - [Notes](#notes-6)
    - [Examples](#examples-7)
  - [Google OAuth2 Verification](#google-oauth2-verification)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-7)
    - [Notes](#notes-7)
    - [Examples](#examples-8)
- [User Management](#user-management)
    - [Required Headers](#required-headers-1)
  - [Get Current User Profile](#get-current-user-profile)
    - [Notes](#notes-8)
    - [Examples](#examples-9)
  - [Update Current User Profile](#update-current-user-profile)
    - [Required Parameters (JSON Body)](#required-parameters-json-body-8)
    - [Notes](#notes-9)
    - [Examples](#examples-10)
  - [Disable Current User Profile](#disable-current-user-profile)
    - [Notes](#notes-10)
    - [Examples](#examples-11)
- [User Management](#user-management-1)
- [Books Management](#books-management)
- [Author Management](#author-management)
- [Borrower Management](#borrower-management)
- [Loan Management](#loan-management)
- [Storage (Location) Management](#storage-location-management)
- [Book Series Management](#book-series-management)
- [Tags (Categories) Management](#tags-categories-management)
- [Book Type Management](#book-type-management)
- [Book Acquisition Location Management](#book-acquisition-location-management)

# Logging

The API uses a hybrid logging approach:

- Significant actions (user registration, login, logout, password reset requests, profile updates, token refresh, email verification events, etc.) are logged in a dedicated database table `user_logs`.
- In addition, all HTTP requests are logged to rotating log files (via a Winston-based logger) with method, path, status, response time, and limited metadata. This is helpful for monitoring and debugging.
- Sensitive information (passwords, tokens, secrets, Authorization headers, etc.) is never logged. Potentially secret-like fields are redacted in both file and DB logs.

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
 "email": "peter@example.com"
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

**Endpoint:** `GET /auth/verify-email`  
**Access:** Public  
**Description:** Verifies a user's email address using the token that was sent via email.

### Required Parameters (Query String)

| Parameter | Type | Required | Description and Details |
|-----------|------|----------|-------------------------|
| `email` | String | **Yes** | The email address that the verification token was sent to. It must be between 5 and 255 characters and follow standard email formatting rules. |
| `token` | String | **Yes** | The verification token sent to the user's email address. |

### Notes

- If the token is valid (not expired or already used) and matches the email, the user's account will be marked as verified. They can then log in.
- If the token is invalid or expired, or the email does not match, an error message will be returned.

### Examples

**Example Request:**

```json
{
 "email": "peter@example.com",
 "token": "<verification-token>"
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
**Description:** Logs out the user by invalidating their refresh token.  

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
 - To update the role: Requires admin privileges and must be done via a dedicated admin endpoint.
 - To update the email: Requires re-verification and must be done via a dedicated admin endpoint.
 - To update the password: Must be done via the password reset flow.
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


---
---
---

# User Management

`GET /users/me` - Retrieve the profile information of the currently authenticated user
`PUT /users/me` - Update the profile information of the currently authenticated user
`DELETE /users/me` - Disable (soft delete) the currently authenticated user’s profile

`GET /admin/users/` - List all users (admin only, with pagination and filtering)
`POST /admin/users/` - Create a new user (admin only)
`GET /admin/users/:id` - Get a specific user profile by ID (admin only)
`PUT /admin/users/:id` - Update a specific user’s profile by ID (including role and email, admin only)
`DELETE /admin/users/:id` - Permanently delete a user by ID (hard delete, admin only)
`POST /admin/users/:id/disable` - Disable a user profile by ID (admin only)
`POST /admin/users/:id/enable` - Re-enable a disabled user profile by ID (admin only)
`POST /admin/users/:id/unverify` - Mark a user’s email as unverified by ID (admin only)
`POST /admin/users/:id/verify` - Mark a user’s email as verified by ID (bypassing verification, admin only)
`POST /admin/users/:id/send-verification` - Resend email verification for a user (admin only)
`POST /admin/users/:id/reset-password` - Trigger a password reset for a user by ID (admin only)
`POST /admin/users/:id/force-logout` - Force logout a user (invalidate all sessions, admin only)

---

# Books Management

`GET /books/` - List all books owned by the authenticated user (with pagination and filtering)
`GET /books/:id` - Get a specific book by ID (only if owned by the authenticated user)
`POST /books/` - Create a new book owned by the authenticated user
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


