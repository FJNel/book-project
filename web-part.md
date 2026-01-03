# Web Frontend Notes (web/)

## Overview
- Static HTML pages under `web/` with Bootstrap 5.3.6 via CDN.
- JavaScript lives in `web/assets/js/` and handles auth flows, API calls, modals, reCAPTCHA v3, and utility behavior.
- Styles are minimal and extend Bootstrap via `web/assets/css/`.

## Page Inventory
- `web/index.html`: Landing page with login/register modals, Google sign-in placeholder button, and multiple status modals (loading, API error, session expired, not-logged-in, already-logged-in, Google login error, login success). Loads `bs-init.js`, `http-interceptor.js`, `common.js`, `recaptcha-v3.js`, and auth handlers (`login-handler.js`, `register-handler.js`, `reset-password-request-handler.js`, `resend-verification-handler.js`, `index-actions.js`). Uses `data-lang` attributes for localization text.
- `web/add-book.html`: Large multi-step book entry form (ISBN lookup, details, book type, authors, etc.). Uses Bootstrap, Animate.css for hover animation, and `data-bss-*` attributes for tooltips/animations. Includes the common modals (page loading) and expects `bs-init.js` + shared JS. The UI is structured for desktop but responsive in Bootstrap grid.
- `web/404.html`: Simple 404 page with random message and a "Back to The Book Project" button. Loads `assets/js/404.js` and Bootstrap bundle.
- `web/reset-password.html`: Reset password page with email + new password form, plus standard modals (loading, API error, desktop recommendation, session expired, not logged in, invalid link). Loads `http-interceptor.js`, `common.js`, `recaptcha-v3.js`, and `reset-password.js`.
- `web/verify-email.html`: Email verification page with email entry. Similar modals and JS stack to reset-password. Loads `verify-email.js`.
- `web/privacy-policy.html`: Minimal shell with the loading modal + Bootstrap; appears intended to render or link to `web/Privacy Policy.md`.

## JavaScript Modules
- `web/assets/js/http-interceptor.js`: Central API wrapper (`apiFetch`) with token attachment, refresh flow, and session-expired handling. Defines a global modal manager to keep a single Bootstrap modal active, plus the `showSessionExpiredModal` helper.
- `web/assets/js/common.js`: App initialization (`checkApiHealth`, loading modal), API error modal handling, and a modal delegation helper for consistent modal behavior. Also includes deprecated viewport and login checks (currently returning `true`).
- `web/assets/js/index-actions.js`: Reads `?action=` query params to auto-open login/register/reset/resend modals, and shows an "already logged in" modal if tokens exist.
- `web/assets/js/login-handler.js`: Login form flow with validation, reCAPTCHA, API calls, alert messaging, and success handling. Loads language strings from `web/lang/en.json`.
- `web/assets/js/register-handler.js`: Registration flow with validation, reCAPTCHA, API calls, and alert messaging. Loads language strings.
- `web/assets/js/reset-password-request-handler.js`: "Forgot password" modal flow; validates email, calls `/auth/request-password-reset`, shows success and disclaimer.
- `web/assets/js/resend-verification-handler.js`: Resend verification modal flow; validates email, calls `/auth/resend-verification`.
- `web/assets/js/reset-password.js`: Reset password page; validates token presence in URL, email/password validation, reCAPTCHA, `/auth/reset-password` call, redirects on success.
- `web/assets/js/verify-email.js`: Verification page; validates token, reCAPTCHA, `/auth/verify-email` call, redirects on success.
- `web/assets/js/recaptcha-v3.js`: Lightweight reCAPTCHA v3 loader + `window.recaptchaV3.getToken(action)` helper; expects a hidden element `#recaptcha-root` with `data-sitekey`.
- `web/assets/js/404.js`: Fetches `assets/data/404-messages.json`, picks a random message, and wires the back-home button.
- `web/assets/js/bs-init.js`: Enables hover animations and tooltips for elements using `data-bss-*` attributes (Bootstrap Studio style).
- `web/assets/js/partial-date-parser.js`: Large standalone partial date parser (English + Afrikaans), exported for browser and Node. See `web/temp/Date-Parsing-Rules.md` for the spec.

## Styles
- `web/assets/css/styles.css`: Minimal global rule to keep `html, body` at full height.
- `web/assets/css/Navbar-With-Button-icons.css`: Utility icon sizing and variants used by Bootstrap Studio components.

## Data and Localization
- `web/assets/data/404-messages.json`: Array of thematic 404 messages.
- `web/lang/en.json`: Primary English UI strings for common modals and auth flows (used via `data-lang` or JS fallbacks).
- `web/lang/af.json`: Afrikaans translations for the landing page and Google login error copy.

## Temp / Reference Material
- `web/temp/Date-Parsing-Rules.md`: Documentation for the partial date parser contract and parsing rules.
- `web/temp/test-dates.html` and `web/temp/test-dates.js`: A local test harness to try inputs, bulk-parse, and report incorrect parsing to an API endpoint.

## External Dependencies
- Bootstrap 5.3.6 via CDN on all public pages.
- Animate.css (only on `web/add-book.html`) for hover animations.
- Google reCAPTCHA v3 loaded dynamically by `recaptcha-v3.js` from `https://www.google.com/recaptcha/api.js`.
- API base URL hardcoded in JS: `https://api.fjnel.co.za/`.

