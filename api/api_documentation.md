# BOOK PROJECT API DOCUMENTATION

Welcome to the Book Project API Documentation. This document provides an overview of the Book Project API. This documentation covers authentication, standard response formats, and all available endpoints.

To interact with the API, you can use tools like Postman or curl, or access it programmatically via HTTP requests. 

**Location:** https://api.fjnel.co.za/ 

**Request and Response Format:** JSON

**Request Type:** Depends on the endpoint used (see below for more details)

# Table of Contents

- [BOOK PROJECT API DOCUMENTATION](#book-project-api-documentation)
- [Table of Contents](#table-of-contents)
- [Standard Response Format](#standard-response-format)
  - [Success Response](#success-response)
  - [Error Response](#error-response)
- [Rate limiting](#rate-limiting)
- [General Endpoints](#general-endpoints)
  - [Health Check](#health-check)
- [Authentication Endpoints](#authentication-endpoints)
  - [Understanding the JWT Authentication System](#understanding-the-jwt-authentication-system)
    - [The Access Token: A 15-Minute "Access Pass"](#the-access-token-a-15-minute-access-pass)
    - [The Refresh Token: A 7-Day "Session Key"](#the-refresh-token-a-7-day-session-key)
    - [Key Design Benefits](#key-design-benefits)
  - [Register](#register)
  - [Login](#login)
  - [Logout](#logout)
  - [Refresh Token](#refresh-token)
  - [Me](#me)

# Standard Response Format

All API responses, whether successful or failed, follow a standardised JSON structure.

## Success Response

Successful requests will return a `2xx` HTTP status code and a JSON body with the following structure:

```json
{
	"status": "success",
	"httpCode": 200,
	"responseTime": "15.42", // Response time in milliseconds
	"message": "A descriptive success message",
	"data": {
		// Contains the requested data (e.g., a user object, a list of books)
	},
	"errors": [] // Always an empty array on success
}
```

## Error Response

Failed requests will return a `4xx` or `5xx` HTTP status code and provide details in the errors array.

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

# Rate limiting

To prevent API abuse, rate limiting is enforced on certain endpoints. Exceeding the limit will result in a `429 Too Many Requests` response with the message "Too many requests from this IP". Rate limiting details are as follows:
| Endpoint               | Limit                | Window       | Description                          |
| :--------------------- | :------------------- | :----------- | :----------------------------------- |
| `POST /auth/register`  | 5 requests          | 15 minutes   | Allows new user registrations.      |
| `POST /auth/login`     | 10 requests         | 15 minutes   | Allows users to log in to their account.

# General Endpoints

## Health Check

This endpoint retrieves the API's current status. It is a public endpoint and does not require authentication.

**Endpoint:** `GET /`

**Example Response:**
```json
{
	"status": "success",
	"httpCode": 200,
	"responseTime": "0.48",
	"message": "Success",
	"data": {
		"message": "The Book Project API is working!",
	"timestamp": "08/09/2025, 14:41:51"
  	},
	"errors": []
}
```



# Authentication Endpoints

The authentication endpoints allow users to register, log in, refresh tokens, get their profile, and log out.

## Understanding the JWT Authentication System

The Book Project API uses a two-token system (JWT Access Tokens and Refresh Tokens) to manage user sessions. This model is intentionally designed to provide a perfect balance between robust security, server efficiency, and a seamless user experience.

Instead of a single, long-lived token that creates a major security risk, we split the responsibilities between two distinct tokens.

### The Access Token: A 15-Minute "Access Pass"

This is the primary token used to interact with the API.

* **What It Is:** A JSON Web Token (JWT) that is returned on a successful login or refresh.
* **How It's Used:** It must be sent in the `Authorization: Bearer <token>` header for every request to a protected endpoint. The server verifies this token to authenticate and authorize your request.
* **The "Why":** This token is **short-lived (15 minutes)** by design. This is a core security feature. If an access token is ever leaked or intercepted, an attacker only has a 15-minute window to use it, drastically limiting potential damage. Once it expires, it is useless.

### The Refresh Token: A 7-Day "Session Key"

This token's only job is to prove you are still the same user so you can get a new access pass.

* **What It Is:** A long-lived token returned *only* at login.
* **How It's Used:** When your Access Token expires, your application sends this Refresh Token in the request body to the `/auth/refresh` endpoint. If valid, the server grants you a brand-new 15-minute Access Token.
* **The "Why":** This token is **long-lived (7 days)** to provide a good user experience. It allows you to stay "logged in" for a full week without having to re-enter your credentials every 15 minutes. When you log out, this token is revoked, immediately ending the session.

### Key Design Benefits

This hybrid approach provides the best of both stateless and stateful authentication models.

#### 1. The Best of Both Worlds: Stateless Verification & Stateful Control

This is the most important concept in our design.

* **Stateless Verification:** The **Access Tokens** are self-contained (stateless). They are cryptographically signed and encode the user's ID and permissions directly inside them. This means our servers can verify your identity and permissions on any protected endpoint *without* needing an extra database lookup, making the API extremely fast and scalable.
* **Stateful Control:** The **Refresh Tokens** are stored in our database (stateful). This gives us complete control over user sessions. This is what makes a secure logout possible: the `/auth/logout` endpoint works by finding and deleting your refresh token from our database, instantly revoking your long-term session.

#### 2. Enhanced Security & Identification

This model is inherently secure.

* **Tamper-Proof:** All JWTs are digitally signed. The server can instantly verify that the token's data (like your user ID or role) has not been tampered with.
* **Reliable Identification:** Because a valid Access Token must accompany every request, the API reliably identifies *who* is making each request, which is essential for enforcing role-based access control.

#### 3. Universal Integration

JWT is a global standard. By using the standard HTTP `Authorization` header, our API can be easily integrated with any client, including web applications, mobile apps, or other backend services.

---

## Register

**Endpoint:** `POST /auth/register`

**Access:** Captcha-protected public

**Description:** Registers a new user account in the database, if the provided details are valid and the user is authorized to create an account.

> **Important Note:**  
> User registration is restricted. A user will only be registered if their email address and name **exactly** match an entry in the list of allowed users.  
> If the provided email or name does not match this list, registration will fail and an error response will be returned (see below).
> This is an **intentional security measure** to prevent unauthorized account creation: The API and its associated services are intended for use by a specific group of users only. 
> The list of allowed users is maintained by the system administrator and can be updated as needed. Contact the administrator to request access.

**Required Parameters (JSON body):**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `captchaToken` | String | **Yes** | Google reCAPTCHA v3 token to verify that the user is not a bot. Obtain this token from the frontend application. |
| `name` | String | **Yes** | User's name. Must be 2-100 characters. Allows letters, spaces, hyphens, apostrophes. |
| `email` | String | **Yes** | User's email address. Must be a valid format, unique, and less than 255 characters. |
| `password` | String | **Yes** | User's password. Must be 6-100 characters. Must contain at least one uppercase, one lowercase, one number, and one special character (`@$!%*?&`). |
| `phone` | String | **Yes** | User's phone number. Must be exactly 10 digits (e.g., `0821234567`). No country codes or symbols. |
| `role` | String | **No** | Role for the user. Must be either `user` or `admin`. Defaults to `user` if not provided. |

**Example Request Body**
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "password": "Password123!",
  "phone": "0821234567",
  "role": "user"
}
```

**Example Success Response (201 Created):**
```json
{
    "status": "success",
    "httpCode": 201,
    "timestamp": "2025-09-05T19:05:45.272Z",
    "message": "User registered successfully",
    "data": {
        "id": 1,
        "name": "Johan",
        "email": "johan@test.co.za",
        "role": "user",
        "created_at": "2025-09-05T19:05:45.268Z"
    },
    "errors": []
}
```

**Example Error Response (400 Bad Request):**
```json
{
    "status": "error",
    "httpCode": 400,
    "timestamp": "2025-09-05T19:05:19.515Z",
    "message": "Validation Error",
    "data": {},
    "errors": [
        "Invalid email format",
        "Password must be at least 6 characters",
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        "Phone number must be 10 digits. Do not include country code or special characters (e.g. +27)",
        "Phone number must contain only digits. Do not include country code or special characters (e.g. +27)"
    ]
}
```

**Example Error Response (403 Forbidden - Unauthorized Registration Attempt):**
```json
{
    "status": "error",
    "httpCode": 403,
    "responseTime": "55.60",
    "message": "Registration not allowed",
    "data": {},
    "errors": [
        "Registration not allowed: Name and Email do not match an approved user."
    ]
}
```

---

## Login

**Endpoint:** `POST /auth/login`

**Access:** Captcha-protected public

**Description:** Authenticates a user and returns a JWT access token and a refresh token for accessing protected endpoints.

> **Important Note:**  
> The API response does not provide specific details about why a login attempt failed (e.g. whether the email or password was incorrect). This is an **intentional security measure** to prevent potential attackers from gaining insights into valid email addresses or account statuses.

**Required Parameters (JSON body):**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `captchaToken` | String | **Yes** | Google reCAPTCHA v3 token to verify that the user is not a bot. Obtain this token from the frontend application. |
| `email` | String | **Yes** | User's email address. Must be a valid format, unique, and less than 255 characters. |
| `password` | String | **Yes** | User's password. |

**Example Request Body**
```json
{
	"email": "jane.doe@example.com",
	"password": "Password123!"
}
```

**Response (JSON):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `token` | String | JWT access token for authenticating subsequent requests. Valid for 15 minutes. |
| `refresh_token` | String | Token used to obtain a new access token when the current one expires. Valid for 7 days. |
| `user` | Object | Object containing user details. |
| `user.id` | Integer | Unique identifier for the user. |
| `user.name` | String | User's full name. |
| `user.email` | String | User's email address. |
| `user.role` | String | User's role (`user`, `admin`). |

**Example Success Response (200 OK):**
```json
{
    "status": "success",
    "httpCode": 200,
    "responseTime": "101.07",
    "message": "Login successful",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Miwicm9sZSI6InVzZXIiLCJpYXQiOjE3NTczNDk5NTgsImV4cCI6MTc1NzM1MDg1OH0.rHSWpwJLIBIVd1CGs0JBXeQ9RrvpekB9wjU11WGlnuA",
        "refreshToken": "6f672b268e4b7e8d487ebe0290ee81024a07bb6fa5d430cc52fc84a5fea461644924255213588281331c4385427a4d113e293563edbe23afef959feec6c777d8",
        "user": {
            "id": 2,
            "name": "Johan",
            "email": "joha@test.co.za",
            "phone": "0662240908",
            "role": "user",
            "is_active": true,
            "created_at": "2025-09-08T14:55:32.842Z",
            "last_login": "2025-09-08T16:43:19.158Z",
            "metadata": null
        }
    },
    "errors": []
}
```

**Example Error Response (401 Unauthorized):**
```json
{
    "status": "error",
    "httpCode": 401,
    "responseTime": "15.76",
    "message": "Login Failed",
    "data": {},
    "errors": [
        "Invalid credentials"
    ]
}
```

---

## Logout

**Endpoint:** `POST /auth/logout`

**Access:** Protected (requires valid JWT access token)

**Description:** Logs out the authenticated user by invalidating their current refresh token.

**Headers:**
| Header | Value | Required | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` | **Yes** | The JWT access token received during login or refresh. |

**Required Parameters (JSON body):**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `refreshToken` | String | **Yes** | The refresh token to be invalidated/revoked. |

**Example Request Body**
```json
{
    "refreshToken": "6f672b268e4b7e8d487ebe0290ee81024a07bb6fa5d430cc52fc84a5fea461644924255213588281331c4385427a4d113e293563edbe23afef959feec6c777d8"
}
```

**Example Success Response (200 OK):**
```json
{
    "status": "success",
    "httpCode": 200,
    "responseTime": "55.32",
    "message": "Logged out",
    "data": {},
    "errors": []
}
```

**Example Error Response (400 Bad Request):**
```json
{
    "status": "error",
    "httpCode": 400,
    "responseTime": "3.14",
    "message": "Bad Request",
    "data": {},
    "errors": [
        "Missing refresh token"
    ]
}
```

---

## Refresh Token

**Endpoint:** `POST /auth/refresh`

**Access:** Protected (requires valid refresh token)

**Description:** Issues a new JWT access token using a valid refresh token.

**Required Parameters (JSON body):**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `refreshToken` | String | **Yes** | The refresh token previously issued during login. |

**Example Request Body**
```json
{
    "refreshToken": "2a389a0a9227f36ee8eebdbc9a93da0d0b3e277de7ea3ee83e2743208642be0c030e712d9b81d027744397283ea667a152ad5c646f6ffc72cda5c8d17c1a9985"
}
```

**Example Success Response (200 OK):**
```json
{
    "status": "success",
    "httpCode": 200,
    "responseTime": "14.26",
    "message": "Token refreshed",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Miwicm9sZSI6InVzZXIiLCJpYXQiOjE3NTczNTAzOTEsImV4cCI6MTc1NzM1MTI5MX0.FpdQEvUs0Vo8qPze43nmZQvAFwAbdS1aC_ZbdV6B8qs"
    },
    "errors": []
}
```

**Example Error Response (401 Unauthorized):**
```json
{
    "status": "error",
    "httpCode": 401,
    "responseTime": "10.83",
    "message": "Unauthorized",
    "data": {},
    "errors": [
        "Invalid or expired refresh token"
    ]
}
```

---

## Me

**Endpoint:** `GET /auth/me`

**Access:** Protected (requires valid JWT access token)

**Description:** Retrieves the profile information of the authenticated user.

**Headers:**
| Header | Value | Required | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` | **Yes** | The JWT access token received during login or refresh. |

**Example Success Response (200 OK):**
```json
{
    "status": "success",
    "httpCode": 200,
    "responseTime": "12.30",
    "message": "User profile fetched successfully",
    "data": {
        "id": 2,
        "name": "Johan",
        "email": "joha@test.co.za",
        "phone": "0662240908",
        "role": "user",
        "is_active": true,
        "created_at": "2025-09-08T14:55:32.842Z",
        "last_login": "2025-09-08T16:52:53.936Z",
        "metadata": null
    },
    "errors": []
}
```

**Example Error Response (401 Unauthorized):**
```json
{
    "status": "error",
    "httpCode": 401,
    "responseTime": "0.58",
    "message": "Unauthorized",
    "data": {},
    "errors": [
        "Invalid or expired token"
    ]
}
```

