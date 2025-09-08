# Book Project API Documentation

Welcome to the Book Project API. This document provides an overview of the Book Project API, including its endpoints, request and response formats, and usage examples. To interact with the API, you can use tools like Postman or curl, or access it programmatically via HTTP requests. 

**Location:** https://api.fjnel.co.za/
**Request and Response Format:** JSON
**Request Type:** Depends on the endpoint used



## Table of Contents

- [Introduction](#introduction)
- [Authentication](#authentication)

## Introduction

The Book Project API is a RESTful service that allows users to manage books, authors, and borrowers. It is built using Node.js and Express. 

The API supports JSON request and response formats and includes endpoints for creating, reading, updating, and deleting resources.

## Authentication

The authentication endpoints allow users to register and log in to the Book Project API. All requests and responses use JSON format.

---

### Root Endpoint (API Status)

**Endpoint:** `GET /`

Returns a simple JSON response to confirm the API is running.

**Example Request:**
```bash
curl https://api.fjnel.co.za/
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "message": "Book API is working!"
  }
}
```

---

### Register a New User

**Endpoint:** `POST /api/auth/register`

Registers a new user account.

**Required Parameters (JSON body):**
- `name` (string): Full name of the user.
- `email` (string): Email address (must be unique).
- `password` (string): Password.
- `role` (string, optional): User role (defaults to `"user"` if omitted).
- `phone` (string, optional): Phone number.
- `captchaToken` (string, optional): reCAPTCHA token (currently not enforced).

**Example Request:**
```bash
curl -X POST https://api.fjnel.co.za/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "StrongPassword123",
    "role": "user",
    "phone": "0123456789"
  }'
```

**Successful Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "created_at": "2025-09-08T12:34:56.789Z"
  },
  "message": "User registered successfully"
}
```

**Error Response (validation):**
```json
{
  "success": false,
  "errors": [
    "Email already registered. Please use a different email or login."
  ],
  "message": "Validation Error"
}
```

---

### User Login

**Endpoint:** `POST /api/auth/login`

Authenticates a user and returns a JWT token.

**Required Parameters (JSON body):**
- `email` (string): Registered email address.
- `password` (string): Password.
- `captchaToken` (string, optional): reCAPTCHA token (currently not enforced).

**Example Request:**
```bash
curl -X POST https://api.fjnel.co.za/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "password": "StrongPassword123"
  }'
```

**Successful Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "user"
    }
  },
  "message": "Login successful"
}
```

**Error Response (invalid credentials):**
```json
{
  "success": false,
  "errors": [
    "Invalid credentials"
  ],
  "message": "Login Failed"
}
```

**Error Response (rate limit):**
```json
{
  "success": false,
  "errors": [
    "Too many login attempts from this IP"
  ],
  "message": "Rate limit exceeded"
}
```

---

### Notes

- All endpoints expect and return JSON.
- Rate limiting is enforced: max 10 registration attempts and 5 login attempts per minute per IP.
- JWT tokens returned on login should be included in the `Authorization` header for protected endpoints (see relevant documentation).