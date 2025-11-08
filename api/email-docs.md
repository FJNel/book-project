# Email Template Catalog

This reference documents every transactional email the API can send. Each section explains when the message is used, who receives it, the subject line, and the exact HTML body (trimmed only for readability). Values wrapped in `{{ }}` must be substituted at runtime.

**Sender:** `Book Project <{{FROM_EMAIL}}>`  
**Support Contact:** `support@fjnel.co.za`

## Template Summary

| Template | Queue `type` | Trigger | Recipient |
| --- | --- | --- | --- |
| Email Verification | `verification` | Registration, resend verification | End user |
| Password Reset | `password_reset` | Forgot password request | End user |
| Welcome | `welcome` | Email verification succeeds | End user |
| Password Reset Success | `password_reset_success` | Password updated | End user |
| Account Disable Verification | `account_disable_verification` | DELETE `/users/me` | End user |
| Account Disable Confirmation | `account_disable_confirmation` | Disable verified | End user |
| Account Deletion Verification | `account_delete_verification` | `/users/me/request-account-deletion` | End user |
| Account Deletion Admin Notice | `account_delete_admin_notice` | Deletion confirm token | Support team |
| Email Change Verification | `email_change_verification` | `/users/me/request-email-change` | New email |
| Email Change Confirmation | `email_change_confirmation` | Email change confirmed | Old email |

---

## Email Verification (`verification`)

- **Subject:** `Verify your email address for the Book Project`
- **Purpose:** Confirms a user owns the registration email.
- **Triggered By:** `POST /auth/register`, `POST /auth/resend-verification`.
- **Recipient:** User’s email.
- **Token Lifetime:** 60 minutes.

**Queue Payload**

```json
{
  "type": "verification",
  "params": {
    "toEmail": "jane@example.com",
    "token": "{{VERIFICATION_TOKEN}}",
    "preferredName": "Jane",
    "expiresIn": 60
  },
  "context": "REGISTER_NEW",
  "userId": 42
}
```

**HTML Body**

```html
<div style="background-color:#f4f6f8;padding:40px 0;font-family:Arial,sans-serif;">
  <table align="center" style="max-width:600px;background:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
    <tr><td align="center" style="padding:24px;"><img src="https://via.placeholder.com/150x50?text=Book+Project" alt="Book Project" style="height:50px;"></td></tr>
    <tr>
      <td style="padding:0 32px 32px;color:#333;">
        <h2 style="color:#2d3748;">Welcome{{PREFERRED_NAME}}!</h2>
        <p>Thank you for registering for the <strong>Book Project</strong>. Please verify your email address to activate your account.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{FRONTEND_VERIFY_URL}}?token={{TOKEN}}" style="background:#3182ce;color:#fff;padding:14px 28px;border-radius:6px;font-weight:bold;display:inline-block;">Verify Email</a>
        </div>
        <p>If you did not register, contact <a href="mailto:support@fjnel.co.za">support@fjnel.co.za</a>. This link expires in <strong>{{EXPIRES_IN}} minutes</strong>.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
        <p style="font-size:12px;color:#a0aec0;text-align:center;">&copy; {{YEAR}} Book Project. All rights reserved.</p>
      </td>
    </tr>
  </table>
</div>
```

---

## Password Reset (`password_reset`)

- **Subject:** `Reset your password for the Book Project`
- **Purpose:** Sends the password reset link.
- **Triggered By:** `POST /auth/request-password-reset`.

```json
{
  "type": "password_reset",
  "params": {
    "toEmail": "jane@example.com",
    "token": "{{RESET_TOKEN}}",
    "preferredName": "Jane",
    "expiresIn": 30
  },
  "context": "REQUEST_PASSWORD_RESET",
  "userId": 42
}
```

```html
<div style="background:#f4f6f8;padding:40px 0;font-family:Arial,sans-serif;">
  <table align="center" style="max-width:600px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
    <tr><td align="center" style="padding:24px;"><img src="https://via.placeholder.com/150x50?text=Book+Project" alt="Book Project" style="height:50px;"></td></tr>
    <tr>
      <td style="padding:0 32px 32px;color:#333;">
        <h2 style="color:#2d3748;">Hello{{PREFERRED_NAME}}!</h2>
        <p>We received a request to reset your password. If this was you, click below to set a new password.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{FRONTEND_RESET_URL}}?token={{TOKEN}}" style="background:#e53e3e;color:#fff;padding:14px 28px;border-radius:6px;font-weight:bold;display:inline-block;">Reset Password</a>
        </div>
        <p>If you didn’t request this, email <a href="mailto:support@fjnel.co.za">support@fjnel.co.za</a> immediately. Link expires in <strong>{{EXPIRES_IN}} minutes</strong>.</p>
      </td>
    </tr>
  </table>
</div>
```

---

## Welcome (`welcome`)

- **Subject:** `Welcome to The Book Project`
- **Purpose:** Sent after successful email verification.

```json
{
  "type": "welcome",
  "params": { "toEmail": "jane@example.com", "preferredName": "Jane" },
  "context": "welcome_after_verify",
  "userId": 42
}
```

```html
<div style="background:#f4f6f8;padding:40px 0;font-family:Arial,sans-serif;">
  <table align="center" style="max-width:600px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
    <tr><td align="center" style="padding:24px;"><img src="https://via.placeholder.com/150x50?text=Book+Project" alt="Book Project" style="height:50px;"></td></tr>
    <tr>
      <td style="padding:0 32px 32px;color:#333;">
        <h2 style="color:#2d3748;">Welcome{{PREFERRED_NAME}}!</h2>
        <p>Your email has been verified successfully. You can now log in to start using <strong>The Book Project</strong>.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{FRONTEND_LOGIN_URL}}" style="background:#3182ce;color:#fff;padding:14px 28px;border-radius:6px;font-weight:bold;display:inline-block;">Log In</a>
        </div>
        <p>If this wasn’t you, notify <a href="mailto:support@fjnel.co.za">support@fjnel.co.za</a> immediately.</p>
      </td>
    </tr>
  </table>
</div>
```

---

## Password Reset Success (`password_reset_success`)

- **Subject:** `Your password has been reset`
- **Purpose:** Confirms the password update and reminds the user to log in.

```json
{
  "type": "password_reset_success",
  "params": { "toEmail": "jane@example.com", "preferredName": "Jane" },
  "context": "password_reset_success",
  "userId": 42
}
```

*HTML body mirrors the welcome template but references the password change and support contact.*

---

## Account Disable Verification (`account_disable_verification`)

- **Subject:** `Confirm your Book Project account disable request`
- **Purpose:** Confirms the disable instruction before revoking access.

```json
{
  "type": "account_disable_verification",
  "params": {
    "toEmail": "jane@example.com",
    "preferredName": "Jane",
    "token": "{{TOKEN}}",
    "expiresIn": 60
  },
  "context": "ACCOUNT_DISABLE_REQUEST",
  "userId": 42
}
```

```html
<div style="background:#f4f6f8;padding:40px 0;font-family:Arial,sans-serif;">
  <table align="center" style="max-width:600px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
    <tr><td align="center" style="padding:24px;"><img src="https://via.placeholder.com/150x50?text=Book+Project" alt="Book Project" style="height:50px;"></td></tr>
    <tr>
      <td style="padding:0 32px 32px;color:#333;">
        <h2 style="color:#2d3748;">Hi{{PREFERRED_NAME}}.</h2>
        <p>We received a request to disable your account. Confirm below. If you change your mind or did not request it, contact <a href="mailto:support@fjnel.co.za">support@fjnel.co.za</a> to keep or reactivate the account.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{{API_BASE_URL}}/users/me/verify-delete?token={{TOKEN}}" style="background:#e53e3e;color:#fff;padding:14px 28px;border-radius:6px;font-weight:bold;display:inline-block;">Confirm Disable</a>
        </div>
        <p>Link expires in <strong>{{EXPIRES_IN}} minutes</strong>.</p>
      </td>
    </tr>
  </table>
</div>
```

---

## Account Disable Confirmation (`account_disable_confirmation`)

- **Subject:** `Your Book Project account has been disabled`
- **Purpose:** Notifies the user after successful disable; includes reactivation instructions.

```json
{
  "type": "account_disable_confirmation",
  "params": {
    "toEmail": "jane@example.com",
    "preferredName": "Jane"
  },
  "context": "ACCOUNT_DISABLE_CONFIRMED",
  "userId": 42
}
```

*Body explains the effects of disabling and that reactivation requires emailing support.*

---

## Account Deletion Verification (`account_delete_verification`)

- **Subject:** `Confirm your Book Project account deletion request`
- **Purpose:** Ensures the user truly wants all data removed.

```json
{
  "type": "account_delete_verification",
  "params": {
    "toEmail": "jane@example.com",
    "preferredName": "Jane",
    "token": "{{TOKEN}}",
    "expiresIn": 60
  },
  "context": "ACCOUNT_DELETE_REQUEST",
  "userId": 42
}
```

*HTML strongly encourages contacting support if the request is suspicious.*

---

## Account Deletion Admin Notice (`account_delete_admin_notice`)

- **Subject:** `Account deletion confirmation received for {{EMAIL}}`
- **Purpose:** Alerts support that a user confirmed deletion.
- **Recipient:** `support@fjnel.co.za`.

```json
{
  "type": "account_delete_admin_notice",
  "params": {
    "userEmail": "jane@example.com",
    "userFullName": "Jane Doe",
    "userPreferredName": "Jane",
    "userId": 42,
    "requestedAt": "2025-01-18T12:48:00.000Z",
    "requestIp": "203.0.113.10"
  },
  "context": "ACCOUNT_DELETE_CONFIRMED",
  "userId": 42
}
```

*HTML summarises the account details and asks the support team to follow internal procedures.*

---

## Email Change Verification (`email_change_verification`)

- **Subject:** `Verify your new Book Project email address`
- **Purpose:** Validates the new address before it replaces the existing login.

```json
{
  "type": "email_change_verification",
  "params": {
    "toEmail": "new-address@example.com",
    "preferredName": "Jane",
    "token": "{{TOKEN}}",
    "expiresIn": 60
  },
  "context": "EMAIL_CHANGE_REQUEST",
  "userId": 42
}
```

*HTML emphasises contacting support if the change wasn’t requested.*

---

## Email Change Confirmation (`email_change_confirmation`)

- **Subject:** `Your Book Project email address has changed`
- **Purpose:** Confirms to the previous email that the account now uses a new address in case the user needs to contest it.

```json
{
  "type": "email_change_confirmation",
  "params": {
    "toEmail": "old-address@example.com",
    "newEmail": "new-address@example.com",
    "preferredName": "Jane"
  },
  "context": "EMAIL_CHANGE_CONFIRMED",
  "userId": 42
}
```

*HTML instructs the user to contact support immediately if the change was unauthorized.*

---

**Notes**

- All templates rely on Mailgun settings defined in `config.mail`.
- Links that hit the API (e.g., `/users/me/verify-delete`) support `GET` for browser compatibility; the API itself accepts both `GET` and `POST`.
- For localisation requirements, replicate these templates with translated text but keep the same structure and support contact.
