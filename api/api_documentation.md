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
- [Admin Endpoints](#admin-endpoints)
  - [Approved User Management](#approved-user-management)
    - [Get (All) Approved Users](#get-all-approved-users)
    - [Get an Approved User](#get-an-approved-user)
    - [Add an Approved User](#add-an-approved-user)
    - [Edit an Approved User](#edit-an-approved-user)
    - [Delete an Approved User](#delete-an-approved-user)
- [User Endpoints](#user-endpoints)
  - [Get Me](#get-me)
- [](#)

# Standard Response Format

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

To prevent API abuse, rate limiting is enforced on certain endpoints. Exceeding the limit will result in a `429 Too Many Requests` response with the message "Too many requests from this IP". Rate limiting is implemented as follows:
| Endpoint               | Limit                | Window       | Description                          |
| :--------------------- | :------------------- | :----------- | :----------------------------------- |
| [`POST /auth/register`](#register)  | 5 requests          | 15 minutes   | Allows new user registrations.      |
| [`POST /auth/login`](#login)     | 10 requests         | 15 minutes   | Allows users to log in to their account.

# General Endpoints

These endpoints are available to all users, regardless of authentication status.

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

## Register

**Endpoint:** `POST /auth/register`

**Access:** Captcha-protected Public

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

**Successful Response Fields (`data` in JSON body):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer | Unique identifier for the created user. |
| `name` | String | User's name. |
| `email` | String | User's email address. |
| `role` | String | User's role (`user`, `admin`). |
| `created_at` | String | Timestamp of when the user was created. |

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

## Login

**Endpoint:** `POST /auth/login`

**Access:** Captcha-protected Public

**Description:** Authenticates a user and returns a JWT access token and a refresh token for accessing protected endpoints.

> **Important Note:**  
> The API response does not provide specific details about why a login attempt failed (e.g. whether the email or password was incorrect). This is an **intentional security measure** to prevent potential attackers from gaining insights into valid email addresses or account statuses.

**Required Parameters (JSON body):**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `captchaToken` | String | **Yes** | Google reCAPTCHA v3 token to verify that the user is not a bot. Obtain this token from the frontend application. |
| `email` | String | **Yes** | User's email address. Must be a valid format, unique, and less than 255 characters. |
| `password` | String | **Yes** | User's password. |

**Successful Response Fields (`data` in JSON body):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `token` | String | JWT access token for authenticating subsequent requests. |
| `refreshToken` | String | Refresh token for obtaining a new access token. |
| `user` | Object | Information about the authenticated user. |
| `user.id` | Integer | Unique identifier for the user. |
| `user.name` | String | User's name. |
| `user.email` | String | User's email address. |
| `user.phone` | String | User's phone number. |
| `user.role` | String | User's role (`user`, `admin`). |
| `user.is_active` | Boolean | Indicates if the user's account is active (defaults to `true`) |
| `user.created_at` | String | Timestamp of when the user was created. |
| `user.last_login` | String | Timestamp of the user's last login. |
| `user.metadata` | Object or null | Additional metadata associated with the user (if any). |

**Example Request Body**
```json
{
	"email": "jane.doe@example.com",
	"password": "Password123!"
}
```

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

## Refresh Token

**Endpoint:** `POST /auth/refresh`

**Access:** Protected (requires valid refresh token)

**Description:** Issues a new JWT access token using a valid refresh token.

**Required Parameters (JSON body):**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `refreshToken` | String | **Yes** | The refresh token previously issued during login. |

**Successful Response Fields (`data` in JSON body):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `token` | String | JWT access token for authenticating subsequent requests. |

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

# Admin Endpoints

Admin endpoints are restricted to users with the `admin` role. These endpoints allow for user management and other administrative tasks.

## Approved User Management

We use the term "Approved Users" to refer to a predefined list of individuals who are authorized/allowed to register and access the Book Project API.

The system administrator can view, add, edit or remove users from this list as needed using these admin-only endpoints.

### Get (All) Approved Users

**Endpoint:** `GET /admin/approved-users`

**Access:** Protected Admin-only (requires valid JWT access token with `admin` role)

**Description:** Retrieves a list of all approved users who are authorized to register and access the API.

**Headers:**
| Header | Value | Required | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` | **Yes** | The JWT access token received during login or refresh. Must belong to an `admin` user. |

**Successful Response Fields (`data` in JSON body):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `approvedUsers` | Array of Objects | List of approved users. Sorted by `name` in ascending order. |
| `approvedUsers[].id` | Integer | Unique identifier for the approved user. |
| `approvedUsers[].name` | String | Approved user's name. |
| `approvedUsers[].email` | String | Approved user's email address. |

**Example Success Response (200 OK):**
```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "11.17",
  "message": "Success",
  "data": {
    "approvedUsers": [
      {
        "id": 2,
        "name": "Jane Doe",
        "email": "jane.doe@example.com"
      },
      {
        "id": 1,
        "name": "Johan",
        "email": "fnel688@gmail.com"
      }
    ]
  },
  "errors": []
}
```

### Get an Approved User

**Endpoint:** `GET /admin/approved-users/{id}`

**Access:** Protected Admin-only (requires valid JWT access token with `admin` role)

**Description:** Retrieves details of a specific approved user by their ID.

**Headers:**
| Header | Value | Required | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` | **Yes** | The JWT access token received during login or refresh. Must belong to an `admin` user. |

**Path Parameters:**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `id` | Integer | **Yes** | The unique identifier of the approved user to retrieve. |

**Successful Response Fields (`data` in JSON body):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `approvedUser` | Object | Details of the approved user. |
| `approvedUser.id` | Integer | Unique identifier for the approved user. |
| `approvedUser.name` | String | Approved user's name. |
| `approvedUser.email` | String | Approved user's email address. |

**Example Success Response (200 OK):**
```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "11.03",
  "message": "Success",
  "data": {
    "approvedUser": {
      "id": 2,
      "name": "Jane Doe",
      "email": "jane.doe@example.com"
    }
  },
  "errors": []
}
```

**Example Error Response (404 Not Found):**
```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "10.89",
  "message": "Not Found",
  "data": {},
  "errors": [
    "Approved user not found"
  ]
}
```

### Add an Approved User

**Endpoint:** `POST /admin/approved-users`

**Access:** Protected Admin-only (requires valid JWT access token with `admin` role)

**Description:** Adds a new user to the list of approved users who are authorized to register and access the API.

**Headers:**
| Header | Value | Required | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` | **Yes** | The JWT access token received during login or refresh. Must belong to an `admin` user. |

**Required Parameters (JSON body):**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `name` | String | **Yes** | User's name. Must be 2-100 characters. Allows letters, spaces, hyphens, apostrophes. |
| `email` | String | **Yes** | User's email address. Must be a valid format and less than 255 characters. |

**Successful Response Fields (`data` in JSON body):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `approvedUser` | Object | Details of the newly added approved user. | 
| `approvedUser.id` | Integer | Unique identifier for the approved user. |
| `approvedUser.name` | String | Approved user's name. |
| `approvedUser.email` | String | Approved user's email address. |

**Example Request Body**
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com"
}
```

**Example Success Response (201 Created):**
```json
{
  "status": "success",
  "httpCode": 201,
  "responseTime": "14.15",
  "message": "Approved user added",
  "data": {
    "approvedUser": {
      "id": 2,
      "name": "Jane Doe",
      "email": "jane.doe@example.com"
    }
  },
  "errors": []
}
```

**Example Error Response (409 Conflict):**
```json
{
  "status": "error",
  "httpCode": 409,
  "responseTime": "12.71",
  "message": "Conflict",
  "data": {},
  "errors": [
    "Email is already owned by an approved user"
  ]
}
```

**Example Error Response (400 Bad Request):**
```json
{
  "status": "error",
  "httpCode": 400,
  "responseTime": "1.48",
  "message": "Validation Error",
  "data": {},
  "errors": [
    "Invalid email format"
  ]
}
```

### Edit an Approved User

**Endpoint:** `PUT /admin/approved-users/{id}`

**Access:** Protected Admin-only (requires valid JWT access token with `admin` role)

**Description:** Updates the details of an existing approved user.

**Headers:**
| Header | Value | Required | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` | **Yes** | The JWT access token received during login or refresh. Must belong to an `admin` user. |

**Path Parameters:**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `id` | Integer | **Yes** | The unique identifier of the approved user to update. |

**Required Parameters (JSON body):**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `name` | String | **No** | User's name. Must be 2-100 characters. Allows letters, spaces, hyphens, apostrophes. |
| `email` | String | **No** | User's email address. Must be a valid format and less than 255 characters. |
> **Note:** At least one of `name` or `email` must be provided in the request body. If a field is not provided, it will remain unchanged.

**Successful Response Fields (`data` in JSON body):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `approvedUser` | Object | Details of the updated approved user. |
| `approvedUser.id` | Integer | Unique identifier for the approved user. |
| `approvedUser.name` | String | Approved user's name. |
| `approvedUser.email` | String | Approved user's email address. |

**Example Request Body**
```json
{
  "name": "Jane Smith",
  "email": "jane.smith@example.com"
}
```

**Example Success Response (200 OK):**
```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "18.10",
  "message": "Approved user updated",
  "data": {
    "approvedUser": {
      "id": 2,
      "name": "Jane Smith",
      "email": "jane.smith@example.com"
    }
  },
  "errors": []
}
```

**Example Error Response (404 Not Found):**
```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "12.34",
  "message": "Not Found",
  "data": {},
  "errors": [
    "Approved user not found"
  ]
}
```

### Delete an Approved User

**Endpoint:** `DELETE /admin/approved-users/{id}`

**Access:** Protected Admin-only (requires valid JWT access token with `admin` role)

**Description:** Removes an approved user from the list, revoking their ability to register and access the API.

**Headers:**
| Header | Value | Required | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` | **Yes** | The JWT access token received during login or refresh. Must belong to an `admin` user. |

**Path Parameters:**
| Parameter | Type | Required | Description and Details |
| :--- | :--- | :--- | :--- |
| `id` | Integer | **Yes** | The unique identifier of the approved user to delete. |

**Example Success Response (200 OK):**
```json
{
  "status": "success",
  "httpCode": 200,
  "responseTime": "17.93",
  "message": "Approved user deleted",
  "data": {},
  "errors": []
}
```

**Example Error Response (404 Not Found):**
```json
{
  "status": "error",
  "httpCode": 404,
  "responseTime": "11.22",
  "message": "Not Found",
  "data": {},
  "errors": [
    "Approved user not found"
  ]
}
```

---

# User Endpoints

The endpoints in this section are available to allow for better user management and profile handling.

## Get Me

**Endpoint:** `GET /users/me`

**Access:** Protected (requires valid JWT access token)

**Description:** Retrieves the profile information of the authenticated user.

**Headers:**
| Header | Value | Required | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` | **Yes** | The JWT access token received during login or refresh. |

**Successful Response Fields (`data` in JSON body):**
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | Integer | Unique identifier for the user. |
| `name` | String | User's name. |
| `email` | String | User's email address. |
| `phone` | String | User's phone number. |
| `role` | String | User's role (`user`, `admin`). |
| `is_active` | Boolean | Indicates if the user's account is active (defaults to `true`). |
| `created_at` | String | Timestamp of when the user was created. |
| `last_login` | String | Timestamp of the user's last login. |
| `metadata` | Object or null | Additional metadata associated with the user (if any). |

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

#