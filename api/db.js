const { Pool } = require("pg"); // PostgreSQL client
const { logToFile } = require("./utils/logging");
const config = require("./config");
require("dotenv").config(); // Load environment variables from .env file

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || null;
const sslModeEnv = process.env.DB_SSL_MODE || "";
const sslMode = String(sslModeEnv).trim().toLowerCase();
const sslCa = process.env.DB_SSL_CA || "";

function resolveDbHost() {
	if (connectionString) {
		try {
			const url = new URL(connectionString);
			return url.hostname || null;
		} catch (_) {
			return null;
		}
	}
	return config.db.host || null;
}

function isLocalHost(host) {
	if (!host) return false;
	const normalized = String(host).trim().toLowerCase();
	return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function buildPgSslConfig(mode, host) {
	const explicitMode = Boolean(mode);
	if (!explicitMode && isLocalHost(host)) {
		return { ssl: false, sslMode: "disable" };
	}

	const effectiveMode = explicitMode ? mode : "require";
	if (effectiveMode === "disable") {
		return { ssl: false, sslMode: "disable" };
	}
	if (effectiveMode === "allow-self-signed") {
		return { ssl: { rejectUnauthorized: false }, sslMode: "allow-self-signed" };
	}
	if (effectiveMode === "verify-ca" || effectiveMode === "verify-full") {
		const ca = sslCa.trim();
		if (!ca) {
			logToFile("DB_SSL_CONFIG", { status: "WARN", reason: "MISSING_CA", ssl_mode: effectiveMode }, "warn");
			return { ssl: { rejectUnauthorized: true }, sslMode: "require" };
		}
		return { ssl: { rejectUnauthorized: true, ca }, sslMode: effectiveMode };
	}
	return { ssl: { rejectUnauthorized: true }, sslMode: "require" };
}

const resolvedHost = resolveDbHost();
const sslConfig = buildPgSslConfig(sslMode, resolvedHost);
const ssl = sslConfig.ssl;
const effectiveSslMode = sslConfig.sslMode;

// Create a new pool instance to manage PostgreSQL connections
// A pool allows multiple clients to connect to the database efficiently
const pool = new Pool(connectionString ? {
	connectionString,
	ssl
} : {
	host: config.db.host,
	port: config.db.port,
	user: config.db.user,
	password: config.db.password,
	database: config.db.name,
	ssl
});

let hasLoggedConnect = false;
pool.on("connect", (client) => {
	if (hasLoggedConnect) return;
	hasLoggedConnect = true;
	logToFile("DB_POOL_CONNECTED", {
		host: process.env.DB_HOST || null,
		port: process.env.DB_PORT ? Number(process.env.DB_PORT) : null,
		database: process.env.DB_NAME || null,
		ssl_mode: effectiveSslMode
	}, "info");
});

pool.on("error", (err) => {
	logToFile("DB_POOL_ERROR", { error_message: err.message }, "error");
});

// Startup connectivity check (non-fatal; logs actionable error)
pool.query("SELECT 1")
	.then(() => {
		logToFile("DB_STARTUP_CHECK", { status: "SUCCESS", ssl_mode: effectiveSslMode }, "info");
	})
	.catch((error) => {
		logToFile("DB_STARTUP_CHECK", {
			status: "FAILURE",
			error_message: error.message,
			ssl_mode: effectiveSslMode
		}, "error");
	});

// Export the pool instance for use in other parts of the application
module.exports = pool;
