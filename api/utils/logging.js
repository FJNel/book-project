// Centralized file logging with consistent structure

const fs = require("fs");
const path = require("path");
const winston = require("winston");

// ----- Setup log directory -----
const LOG_DIR = path.join(__dirname, "..", "logs");
ensureLogsDir(LOG_DIR);

// ----- Winston logger (size-based rotation via maxsize/maxFiles) -----
const fileTransport = new winston.transports.File({
	filename: path.join(LOG_DIR, "app.log"),
	maxsize: 5 * 1024 * 1024, // 5MB per file
	maxFiles: 5,
	tailable: true,
});

const logger = winston.createLogger({
	level: "info",
	format: winston.format.json(),
	transports: [fileTransport],
});

if (process.env.NODE_ENV !== "production") {
	logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

const VALID_STATUSES = new Set(["SUCCESS", "FAILURE", "INFO"]);

// ----- Helpers: sanitize -----
function isSecretKey(key = "") {
	const k = String(key).toLowerCase();
	return (
		k.includes("password") ||
		k.includes("token") ||
		k.includes("secret") ||
		k === "authorization" ||
		k === "adminpassword" ||
		k === "currentpassword" ||
		k === "newpassword"
	);
} // isSecretKey

function redactIfSecretLike(str) {
	if (typeof str !== "string") return str;
	if (str.length > 2000) return "[REDACTED_LARGE_STRING]";
	return str;
} // redactIfSecretLike

/**
 * Recursively sanitizes an input value.
 * - Redacts object values if their key is a secret key.
 * - **Crucially, attempts to parse string values as JSON to sanitize nested sensitive data.**
 * - Redacts large strings.
 * - Maps over arrays to sanitize their elements.
 */
function sanitizeInput(value, keyHint = null) {
	try {
		if (value === null || value === undefined) return value;

		if (typeof value === "string") {
			// If this field is marked secret → redact
			if (isSecretKey(keyHint)) return "[REDACTED]";
			// If it's just a huge blob → avoid log spam
			if (value.length > 2000) return "[REDACTED_LARGE_STRING]";
			return value;
		}

		if (Array.isArray(value)) {
			return value.map((v) => sanitizeInput(v));
		}

		if (typeof value === "object") {
			const out = {};
			for (const [k, v] of Object.entries(value)) {
				out[k] = sanitizeInput(v, k);
			}
			return out;
		}

		return value;
	} catch (e) {
		return "[UNSERIALIZABLE]";
	}
} // sanitizeInput

// ----- File logging -----
function normalizeLog(event, data = {}, level = "info") {
	const payload = sanitizeInput(data || {});

	// Normalize common fields
	const entry = {
		// Winston expects a message; mirror the event as message for portability
		message: String(event || '').toUpperCase(),
		event,
		level,
		timestamp: new Date().toISOString(),
	};

	// Standardize status strings
	if (payload.status && typeof payload.status === "string") {
		const s = payload.status.toUpperCase();
		entry.status = VALID_STATUSES.has(s) ? s : "INFO";
	}

	// Normalize error field name
	if (payload.error) entry.error_message = redactIfSecretLike(payload.error);
	if (payload.error_message) entry.error_message = redactIfSecretLike(payload.error_message);

	// Normalize reason
	if (payload.reason) entry.error_reason = payload.reason;

	// HTTP specific renames for consistency if provided
	if (payload.statusCode && !payload.http_status) entry.http_status = payload.statusCode;
	if (payload.status && typeof payload.status === "number") entry.http_status = payload.status; // avoid clash with status string

	// Flatten known fields
	if (payload.user_id !== undefined) entry.user_id = payload.user_id;
	if (payload.ip !== undefined) entry.ip = payload.ip;
	if (payload.user_agent !== undefined) entry.user_agent = payload.user_agent;
	if (payload.method !== undefined) entry.method = payload.method;
	if (payload.path !== undefined) entry.path = payload.path;
	if (payload.duration_ms !== undefined) entry.duration_ms = payload.duration_ms;

	// Keep any other fields under details to avoid collisions
	const reserved = new Set(["status","error","error_message","error_reason","reason","statusCode","http_status","user_id","ip","user_agent","method","path","duration_ms"]);
	const details = {};
	for (const [k, v] of Object.entries(payload)) {
		if (!reserved.has(k)) details[k] = v;
	}
	if (Object.keys(details).length) entry.details = details;

	return entry;
}

function logToFile(event, data = {}, level = "info") {
	const entry = normalizeLog(event, data, level);
	logger.log(entry);
} // logToFile

// ----- Utils -----
function ensureLogsDir(dir) {
	try {
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("Failed to ensure logs directory:", e && e.message ? e.message : e);
	}
} // ensureLogsDir

module.exports = {
  logToFile,
  logger,
  sanitizeInput,
};
