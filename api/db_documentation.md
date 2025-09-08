# BOOK PROJECT DATABASE DOCUMENTATION

Welcome to the Book Project Database Documentation. This document provides a detailed overview of the core PostgreSQL database schema that is used by the Book Project API.

This documentation serves as a companion to the API Documentation, explaining the "shape" and "why" of the data that the API consumes and produces.

# Table of Contents
- [BOOK PROJECT DATABASE DOCUMENTATION](#book-project-database-documentation)
- [Table of Contents](#table-of-contents)
- [Schema Overview \& Relationships](#schema-overview--relationships)
- [Authentication Schema Details](#authentication-schema-details)
	- [Table: approved\_users](#table-approved_users)
	- [Table: users](#table-users)
	- [Table: refresh\_tokens](#table-refresh_tokens)

# Schema Overview & Relationships

The database is designed around a central `users` table, which acts as the primary identity provider for the entire application. To enhance security and provide a robust session management system, the `users` table is supported by two other tables:

1.  **`approved_users`**: This table acts as a security "allow-list." A record **must** exist here for a user to be allowed to register an account. This decouples "approval to join" from "account creation."
2.  **`refresh_tokens`**: This table is the stateful component of our authentication system. It stores a record of every valid long-term user session, giving us the power to revoke them individually (i.e., enabling a secure logout).

**Entity Relationships (Text-Based ERD):**

  * `[users]` has a one-to-many relationship with `[refresh_tokens]`.
      * One `user` can have many `refresh_tokens` (representing sessions on multiple devices).
      * Each `refresh_token` belongs to exactly one `user`.
      * If a `user` is deleted, all associated `refresh_tokens` are automatically deleted via `ON DELETE CASCADE`.
  * `[approved_users]` and `[users]` are logically related by the application logic (at the point of registration) but are not linked by a direct foreign key.

-----

# Authentication Schema Details

The following tables form the core of the API's authentication, authorization, and session management system.

## Table: approved\_users

This table serves as a prerequisite "allow-list" to control who can create an account via the API.

**Usage and Design Decisions:**

This table is a critical security measure referenced in the `POST /auth/register` API documentation. Its sole purpose is to hold the names and emails of individuals who are pre-authorized to join the service.

When a user attempts to register, the API first checks their provided `name` and `email` against this table. Only if an exact match is found will the application proceed to create an account in the main `users` table. This design prevents unauthorized public registration and ensures the service remains private to its intended group of users.

**Schema Definition:**

```sql
CREATE TABLE approved_users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE
);
```

**Data Dictionary:**
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | **PRIMARY KEY** | Unique identifier for the approved user entry. |
| `name` | `VARCHAR(100)` | **NOT NULL** | The full name of the approved user. Must match the registration attempt. |
| `email` | `VARCHAR(255)` | **NOT NULL**, **UNIQUE** | The email address of the approved user. Must match the registration attempt. |

-----

## Table: users

This is the central identity table for the application. It stores the primary profile, credentials, and permissions for every registered user account.

**Usage and Design Decisions:**

This table acts as the "single source of truth" for user identity.

  * **Credentials:** It stores the user's unique `email` (used for login) and their `password_hash`. We **never** store plaintext passwords; this column holds a strong, one-way bcrypt hash.
  * **Permissions:** The `role` column (`user_role` is a custom PostgreSQL ENUM type) dictates the user's authorization level within the API. The `is_active` boolean allows an administrator to disable an account without deleting it.
  * **Flexibility:** The `metadata` column uses the `JSONB` type. This is a powerful design choice that allows us to store arbitrary structured data (like user preferences or profile settings) without needing to alter the table schema.

**Schema Definition:**

```sql
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'user',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login      TIMESTAMP WITH TIME ZONE,
  metadata        JSONB
);
```

**Data Dictionary:**
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | **PRIMARY KEY** | Unique identifier for the user. This is the `id` used in JWT payloads. |
| `name` | `TEXT` | **NOT NULL** | The user's full name. |
| `email` | `TEXT` | **UNIQUE**, **NOT NULL** | The user's email address, used as their primary login credential. |
| `phone` | `TEXT` | (Nullable) | The user's 10-digit phone number. |
| `password\_hash` | `TEXT` | **NOT NULL** | A strong, one-way bcrypt hash of the user's password. |
| `role` | `user_role` | **NOT NULL**, **DEFAULT 'user'** | The user's authorization role (likely an ENUM of `'user'`, `'admin'`). |
| `is\_active` | `BOOLEAN` | **NOT NULL**, **DEFAULT TRUE** | Controls if the user account is enabled. Inactive users cannot log in. |
| `created\_at` | `TIMESTAMPTZ` | **NOT NULL**, **DEFAULT now()** | Timestamp of when the user account was created. |
| `last\_login` | `TIMESTAMPTZ` | (Nullable) | Timestamp of the user's last successful login. Updated by the login endpoint. |
| `metadata` | `JSONB` | (Nullable) | Flexible JSON storage for arbitrary user data (e.g., preferences, profile info). |

-----

## Table: refresh\_tokens

This table is the stateful engine of our authentication system. It tracks every valid long-term session and is the key to enabling secure logout.

**Usage and Design Decisions:**

This table is the stateful counterpart to our "stateless" JWT Access Tokens, as explained in the API documentation.

  * **Stateful Control:** When a user logs in, we create a long-lived refresh token and store a record of it here. The API's `/auth/refresh` endpoint *must* validate against this table to ensure the token is still valid.
  * **Secure Logout:** This design is what makes secure logout possible. The `/auth/logout` endpoint sets the `revoked` flag to `TRUE`, instantly invalidating that specific session. The user can no longer get new access tokens with it, even if it hasn't expired.
  * **Enhanced Security:** We do **not** store the full refresh token. Instead, we store a `token_fingerprint` (likely a unique, hashed portion of the token). This prevents an attacker who gains database access from being able to immediately use the stored tokens.
  * **Auto-Cleanup:** The `ON DELETE CASCADE` constraint on `user_id` is a critical housekeeping rule. If a user is deleted from the `users` table, all of their sessions in this table are automatically and instantly deleted.

**Schema Definition:**

```sql
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_fingerprint VARCHAR(128) NOT NULL UNIQUE,
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE
);
```

**Data Dictionary:**
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `SERIAL` | **PRIMARY KEY** | Unique identifier for the session record. |
| `user\_id` | `INTEGER` | **NOT NULL**, **FOREIGN KEY** | Links this session to a specific user in the `users` table. **`ON DELETE CASCADE`** ensures all sessions are deleted if the user is. |
| `token\_fingerprint` | `VARCHAR(128)` | **NOT NULL**, **UNIQUE** | A unique, hashed representation (fingerprint) of the refresh token. Used for verification without storing the token itself. |
| `issued\_at` | `TIMESTAMP` | **NOT NULL**, **DEFAULT NOW()** | Timestamp of when this refresh token was issued (at login). |
| `expires\_at` | `TIMESTAMP` | **NOT NULL** | The timestamp when this refresh token will automatically expire (e.g., 7 days from `issued_at`). |
| `revoked` | `BOOLEAN` | **NOT NULL**, **DEFAULT FALSE** | Flag to control session validity. Set to `TRUE` on logout to manually revoke the session before it expires. |