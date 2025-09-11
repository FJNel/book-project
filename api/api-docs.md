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

The API uses a hybrid logging approach.

Significant actions, like user registration, login, logout, password reset requests, profile updates, etc. are logged in a dedicated database table called `user_logs`.

In addition to this, all requests and responses are logged to log files using `morgan` middleware. This includes details like the HTTP method, endpoint accessed, response status code, and response time. This is useful for monitoring and debugging purposes. 

Sensitive information like passwords and tokens are never logged.

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

- **Endpoint:** `GET /`
- **Access:** Public
- **Description:** Returns a welcome message and basic information about the API.

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

- **Endpoint:** `POST /auth/register`
- **Access:** Public (Rate Limited) (CAPTCHA Protected) (Email Verification Required)
- **Description:** Registers a new user in the database.

### Rate Limiting:

To ensure that this endpoint is not abused, it is rate-limited.  
**Limit:** Maximum of 5 requests per IP address every 10 minutes.

### CAPTCHA Protection:

To prevent automated registrations, this endpoint is protected by CAPTCHA. Users must complete a CAPTCHA challenge to successfully register. The `captchaToken` as provided by the client must be included in the request body. 

### Email Verification:

After registration, a verification email will be sent to the provided email address. The user must verify their email before they can log in. This is prevent unauthorised access using fake or incorrect email addresses.

### Required Parameters (JSON Body):

Parameter | Type | Required | Description and Details | Default
--- | --- | --- | ---
`captchaToken` | String | **Yes** | The CAPTCHA token obtained from the client-side CAPTCHA challenge. This is used to verify that the registration request is legitimate and not automated. |
`fullName` | String | **Yes** | The user's full name. This allows for flexibility in name formats. Must be between 2 and 255 characters. Only alphabetic characters, spaces, hyphens, full stops and apostrophes are allowed. |
`preferredName` | String | No | The user's preferred name. This name will be used in UI elements. Must be between 2 and 100 characters. Only alphabetic characters are allowed. | `null`
`email` | String | **Yes** | The user's email address which will be used for login. It must be unique. It must be between 5 and 255 characters and follow standard email formatting rules. **Important:** The email must exist and belong to the user: A verification email will be sent to the provided email address and the user will only be allowed to log in after verifying their email. |
`password` | String | **Yes** | The user's password. It must be between 10 and 100 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character. |
`confirmPassword` | String | **Yes** | Must match the `password` field exactly. This is to ensure that the user has correctly entered their desired password. |

