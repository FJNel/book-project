# The Book Project Privacy Policy

**Effective Date:** June 2024  
**Last Updated:** 30 January 2026

This Privacy Policy explains how The Book Project collects, uses, stores, and shares information when you use our website and API (the “Services”). This policy is intentionally grounded in the functionality of the current codebase and the infrastructure we operate.

## Who We Are

The Book Project is a self-hosted personal library management application.  
The website is available at https://bookproject.fjnel.co.za and the API at https://api.fjnel.co.za.

## What Information We Collect

### Account Data

We collect and store information required to create and manage your account, including:

- Full name and preferred name  
- Email address  
- Password hash (we never store raw passwords)  
- Role (user or admin), verification status, and account status  
- Theme preference and email preference settings  
- Login timestamps  
- Account metadata used for security and account-change workflows  
- API keys you create (stored as hashed key material with a label/prefix and usage timestamps)

If you sign in using Google, we store a linked OAuth record containing the provider name and provider user ID. Google sign-in exists in the system but is currently disabled.

### Library and Content Data You Provide

The Services store the library data you choose to add, including:

- Books (title, subtitle, ISBN, page count, description)  
- Authors (names, biography, birth and death dates)  
- Publishers (name, website, notes)  
- Series, book types, tags, and languages  
- Storage locations and book copies (including acquisition stories, notes, and locations)

Cover images are stored as external URLs. Image files are not uploaded or stored by the Services.

### Technical and Usage Data (Logs)

To ensure reliability, security, and operational insight, we log API activity. Logged data may include:

- IP address and user agent  
- Request method, path, query parameters, headers, and request body (sanitized and truncated)  
- Response status, response body (sanitized and truncated), timing, and size metrics  
- Actor context (user ID/email or API key metadata)

We also maintain application log files for system events and troubleshooting. Sensitive fields such as passwords, tokens, and secrets are redacted.

### Browser Storage (Local or Session Storage)

The web client uses browser storage to support authentication and user experience, including:

- Access and refresh tokens  
- A cached user profile summary  
- Theme preference  
- Session-only UI state (for example redirects, alerts, or rate-limit timing)

The application does not set its own cookies for session management. Third-party services (such as Google reCAPTCHA) may set cookies as part of their own functionality.

## How We Use Information

We use the collected information to:

- Provide and maintain the Services (account management, authentication, library features)  
- Send service-related emails (verification, password reset, security notifications), and development updates if you opt in  
- Enforce rate limits and protect the Services from abuse  
- Monitor reliability, troubleshoot issues, and improve performance  
- Provide admin views and aggregated statistics for operational support and maintenance  

## How We Store and Secure Data

- Primary application data is stored in a PostgreSQL database on the server running the API (self-managed Raspberry Pi hosting).  
- Passwords are hashed using bcrypt before storage.  
- Refresh tokens are stored with a fingerprint and associated IP and user-agent data for session tracking and security.  
- Logs are stored in the database and in local log files with redaction and size-based rotation.  
- Encrypted backups are created daily and stored off-site, with limited retention (see Data Retention).

## Admin Access

Admin users have access to administrative views that may include user listings, library summaries, usage statistics, and system logs. These tools exist for support, auditing, and system maintenance, and may expose library data and aggregated usage information as part of those functions.

## Sharing and Third Parties

We use third-party services only where necessary to operate specific features:

- Cloudflare Tunnel (public access and reverse proxy)  
- Google reCAPTCHA (bot protection for sensitive authentication actions)  
- Google OAuth (optional sign-in method)  
- Mailgun (email delivery)  
- GitHub Markdown API (rendering developer announcement emails)  
- Google Drive (storage of encrypted daily backups)

These services receive only the minimum data required to perform their function, and process data according to their own privacy policies.

## Data Retention

- Account and library data is retained while your account remains active.  
- Many library records use soft deletion, meaning they may be marked as deleted and moved to a recycle bin until permanently removed.
- Verification and reset tokens are automatically cleaned up after expiration.  
- Request logs and email send history are retained without a fixed time-based limit under the current implementation.  
- Log files are rotated by size (up to five files of approximately 5 MB each).  
- Encrypted backups are retained for up to 28 days.

If you request account deletion, the current process involves confirmation and manual follow-up before final removal.

## Your Rights and Choices

Depending on available features and your account status, you may be able to:

- View and update your profile and preferences  
- Change your email address or password (with verification)  
- Disable your account  
- Request account deletion (subject to confirmation and follow-up)  
- Export your library data using the import/export tools (limited support; not a primary backup method)  

For assistance with account access, data export, or deletion requests, contact us using the details below.

## Children’s Privacy

The Services are not intended for use by children under the age of 13. We do not knowingly collect personal information from children.

## International Data Processing

Some third-party services used by the Services may process data outside South Africa, including Cloudflare, Google, Mailgun, GitHub, and Google Drive. These providers handle data in accordance with their own terms and privacy practices.

## Changes to This Policy

We may update this Privacy Policy from time to time. When we do, the “Last Updated” date above will be revised.

## Contact

For privacy-related questions or requests, please contact  
[support@fjnel.co.za](mailto:support@fjnel.co.za)