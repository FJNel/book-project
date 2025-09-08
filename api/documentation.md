# Book Project API Documentation

Welcome to the Book Project API. This document provides an overview of the Book Project API. This documentation covers authentication, standard response formats, and all available endpoints.

To interact with the API, you can use tools like Postman or curl, or access it programmatically via HTTP requests. 

**Location:** https://api.fjnel.co.za/ 

**Request and Response Format:** JSON

**Request Type:** Depends on the endpoint used (see below for more details)

## Table of Contents

- [Book Project API Documentation](#book-project-api-documentation)
  - [Table of Contents](#table-of-contents)
  - [Standard Response Format](#standard-response-format)
    - [Success Response](#success-response)
    - [Error Response](#error-response)
  - [Rate limiting](#rate-limiting)
  - [General Endpoints](#general-endpoints)
    - [Health Check](#health-check)
  - [Authentication Endpoints](#authentication-endpoints)
    - [Register](#register)
    - [Login](#login)
    - [](#)

## Standard Response Format

All API responses, whether successful or failed, follow a standardised JSON structure.

### Success Response

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

### Error Response

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

## Rate limiting

To prevent API abuse, rate limiting is enforced on certain endpoints. Exceeding the limit will result in a `429 Too Many Requests` response with the message "Too many requests from this IP". 

## General Endpoints

### Health Check

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



## Authentication Endpoints

The authentication endpoints allow users to register and log in to the Book Project API.

---

### Register

**Endpoint:** `POST /auth/register`
**Access:** Public
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

### Login

**Endpoint:** `POST /auth/login`
**Access:** Public
**Description:** Authenticates a user and returns a JWT token for accessing protected endpoints.

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

**Example Success Response (200 OK):**
```json
{
    "status": "success",
    "httpCode": 200,
    "responseTime": "139.27",
    "message": "Login successful",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Miwicm9sZSI6InVzZXIiLCJpYXQiOjE3NTczNDQ4ODUsImV4cCI6MTc1Nzk0OTY4NX0.iSrr2IU2V3ngidCg-CGSyz6zTLkOsPGJPIJ8fKydIc0",
        "user": {
            "id": 2,
            "name": "Johan",
            "email": "joha@test.co.za",
            "role": "user"
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

### 
