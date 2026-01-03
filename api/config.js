// Centralized configuration for the API
// Pulls from environment variables with sensible defaults and light parsing.

require('dotenv').config();
const { logToFile } = require("./utils/logging");

function env(name, def = undefined) {
	const v = process.env[name];
	return v === undefined || v === '' ? def : v;
}

function envNumber(name, def = undefined) {
	const v = env(name);
	if (v === undefined) return def;
	const n = Number(v);
	return Number.isFinite(n) ? n : def;
}

function envArray(name, def = []) {
	const v = env(name);
	if (!v) return def;
	return String(v)
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

const nodeEnv = env('NODE_ENV', 'development');
const port = envNumber('PORT', 4000);

// Database
const db = {
	host: env('DB_HOST', 'localhost'),
	port: envNumber('DB_PORT', 5432),
	user: env('DB_USER', 'postgres'),
	password: env('DB_PASSWORD', ''),
	name: env('DB_NAME', 'postgres'),
};

// Frontend
const frontendUrl = env('FRONTEND_URL', nodeEnv === 'production' ? 'https://bookproject.fjnel.co.za' : 'http://127.0.0.1:8000');
const loginPath = env('FRONTEND_LOGIN_PATH', '/?action=login');
const verifyPath = env('FRONTEND_VERIFY_PATH', '/verify-email');
const resetPath = env('FRONTEND_RESET_PATH', '/reset-password');

// API base and docs (for root route response)
const apiBaseUrl = env('API_BASE_URL', nodeEnv === 'production' ? 'https://api.fjnel.co.za' : `http://localhost:${port}`);
const apiDocsUrl = env('API_DOCS_URL', `${apiBaseUrl}/api-docs.html`);

// JWT
// Prefer ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET, but fall back to old names if provided
const jwt = {
	accessSecret: env('ACCESS_TOKEN_SECRET', env('JWT_SECRET', 'change-me-access')),
	refreshSecret: env('REFRESH_TOKEN_SECRET', env('JWT_REFRESH_SECRET', 'change-me-refresh')),
	accessExpiresIn: env('ACCESS_TOKEN_EXPIRES_IN', '15m'),
	refreshExpiresIn: env('REFRESH_TOKEN_EXPIRES_IN', '7d'),
};

// Security and auth
const saltRounds = envNumber('SALT_ROUNDS', 10);
const recaptchaSecret = env('RECAPTCHA_SECRET');
const google = {
	clientId: env('GOOGLE_CLIENT_ID', ''),
	clientSecret: env('GOOGLE_CLIENT_SECRET', ''),
};

// Mail / Notifications
const mail = {
	mailgunApiKey: env('MAILGUN_API_KEY'),
	mailgunDomain: env('MAILGUN_DOMAIN'),
	mailgunRegion: env('MAILGUN_REGION', 'US'), // 'EU' for EU domains
	fromEmail: env('FROM_EMAIL', 'noreply@fjnel.co.za'),
	supportEmail: env('SUPPORT_EMAIL', 'support@fjnel.co.za'),
};

// CORS
const defaultOrigins = [frontendUrl];
if (nodeEnv !== 'production') {
	defaultOrigins.push('http://127.0.0.1:8000', 'http://localhost:8000', `http://localhost:${port}`);
}
const cors = {
	allowedOrigins: envArray('CORS_ORIGINS', defaultOrigins),
	credentials: env('CORS_CREDENTIALS', 'true') !== 'false',
	methods: envArray('CORS_METHODS', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
	allowedHeaders: envArray('CORS_ALLOWED_HEADERS', ['Content-Type', 'Authorization']),
	optionsSuccessStatus: envNumber('CORS_OPTIONS_SUCCESS_STATUS', 204),
};

module.exports = {
	nodeEnv,
	port,
	db,
	cors,
	jwt,
	mail,
	saltRounds,
	recaptchaSecret,
	google,
	frontend: {
		url: frontendUrl,
		loginUrl: `${frontendUrl}${loginPath}`,
		verifyPath,
		resetPath,
	},
	api: {
		baseUrl: apiBaseUrl,
		docsUrl: apiDocsUrl,
	},
};

const missingConfig = [];
if (!recaptchaSecret) missingConfig.push("RECAPTCHA_SECRET");
if (!jwt.accessSecret || jwt.accessSecret === "change-me-access") missingConfig.push("ACCESS_TOKEN_SECRET");
if (!jwt.refreshSecret || jwt.refreshSecret === "change-me-refresh") missingConfig.push("REFRESH_TOKEN_SECRET");
if (!db.host) missingConfig.push("DB_HOST");
if (!db.user) missingConfig.push("DB_USER");
if (!db.name) missingConfig.push("DB_NAME");

logToFile("CONFIG_LOADED", {
	environment: nodeEnv,
	port,
	api_base_url: apiBaseUrl,
	frontend_url: frontendUrl,
	cors_origins: cors.allowedOrigins,
	mailgun_configured: Boolean(mail.mailgunApiKey && mail.mailgunDomain),
	google_oauth_configured: Boolean(google.clientId),
	recaptcha_configured: Boolean(recaptchaSecret),
	jwt_configured: Boolean(jwt.accessSecret && jwt.refreshSecret),
	db: {
		host: db.host,
		port: db.port,
		name: db.name
	}
}, "info");

if (missingConfig.length > 0) {
	logToFile("CONFIG_WARNING", { missing: missingConfig }, "warn");
}
