# Documentation

Welcome to the Documentation for my project. This document provides an overview of the API and covers authentication, standard response formats, and all available endpoints. It also provides an overview of how databases are structured. You can access databases indirectly using the API.

To interact with the API, you can use tools like Postman or curl, or access it programmatically via HTTP requests.

**API Location:** https://api.fjnel.co.za/  
**API Request and Response Format:** JSON  
**API Request Type:** Depends on the endpoint used (see below for more details)

# Table of Contents

- [Documentation](#documentation)
- [Table of Contents](#table-of-contents)
- [Response Format](#response-format)
	- [Success Response](#success-response)
	- [Error Response](#error-response)
- [Root Endpoint (Health Check)](#root-endpoint-health-check)
- [Authentication](#authentication)
	- [](#)

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

### Rate Limiting:

To ensure that this endpoint is not abused, it is rate-limited.  
**Limit:** Maximum of 5 requests per IP address every 10 minutes.

### CAPTCHA Protection:

To prevent automated registrations, this endpoint is protected by CAPTCHA. Users must complete a CAPTCHA challenge to successfully register. The `captchaToken` as provided by the client must be included in the request body. 

### Email Verification:

After successful registration, a verification email is issued for the provided email address. The user must verify their email before they can log in. If a registration is attempted with an email that already exists but is not yet verified, the API will (re)send a verification email (reusing an active token if still valid, otherwise creating a new one) and return a success message instead of creating a duplicate account.

### Required Parameters (JSON Body):

Here’s a clean Markdown table you can paste into your docs:

| Parameter | Type | Required | Description and Details | Default |
|-----------|------|----------|-------------------------|---------|
| `captchaToken` | String | **Yes** | CAPTCHA token from the client-side challenge, used to verify that the request is human. | |
| `fullName` | String | **Yes** | The user's full name. This allows for flexibility in name formats. Must be between 2 and 255 characters. Only alphabetic characters, spaces, hyphens, full stops and apostrophes are allowed. | |
| `preferredName` | String | No | The user's preferred name. This name will be used in UI elements. Must be between 2 and 100 characters. Only alphabetic characters are allowed. | `null` |
| `email` | String | **Yes** | The user's email address which will be used for login. It must be unique. It must be between 5 and 255 characters and follow standard email formatting rules. The user must be able to receive emails at this address. | |
| `password` | String | **Yes** | The user's password. It must be between 10 and 100 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character. | |

### Example Request Object
```json
{
	"captchaToken": "<captcha-token-from-client>",
	"fullName": "Jane Doe",
	"preferredName": "Jane",
	"email": "jane@example.com",
	"password": "Str0ng&P@ssw0rd!"
}
```

### Example Success Response (201 Created):
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

### Example Request Object

If the email already exists but is not verified, a verification email is (re)sent and the request succeeds with 200 OK (no new account is created):

```json
{
	"captchaToken": "<captcha-token-from-client>",
	"fullName": "Jane Doe",
	"preferredName": "Jane",
	"email": "unverified@example.com",
	"password": "Str0ng&P@ssw0rd!"
}
```

### Example Success Response (201 OK):
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

### Example Error Response (409 Conflict)

Example error when the email is already verified and in use:

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

### Example Error Response (400 Bad Request)

Example error when CAPTCHA fails:

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
**Access:** Public  
**Description:** Resends the email verification if the account exists but is not yet verified. If an active verification token exists, it is reused; otherwise, a new one is created.

### Required Parameters (JSON Body):

| Parameter | Type | Required | Description and Details | Default |
|-----------|------|----------|-------------------------|---------|
| `email` | String | **Yes** | The registered email address to resend the verification to. | |

### Example Request

```http
POST /auth/resend-verification
Content-Type: application/json

{
	"email": "jane@example.com"
}
```

Example success response (200 OK):

```json
{
	"status": "success",
	"httpCode": 200,
	"responseTime": "7.42",
	"message": "Verification email has been (re)sent.",
	"data": {},
	"errors": []
}
```

Example error when the account does not exist (404 Not Found):

```json
{
	"status": "error",
	"httpCode": 404,
	"responseTime": "2.11",
	"message": "User not found",
	"data": {},
	"errors": [
		"No account is registered with this email."
	]
}
```

Example error when the account is already verified (400 Bad Request):

```json
{
	"status": "error",
	"httpCode": 400,
	"responseTime": "3.05",
	"message": "Email already verified",
	"data": {},
	"errors": [
		"This account is already verified."
	]
}
```



