// Centralized logging: rotating file logs (Winston) + DB user action logs

const fs = require("fs");
const path = require("path");
const winston = require("winston");
const pool = require("../db");

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
function logToFile(event, data = {}, level = "info") {
    const safePayload = sanitizeInput(data || {});
    logger.log({
        level,
        event,
        timestamp: new Date().toISOString(),
        ...safePayload,
    });
} // logToFile

// ----- DB logging (user_logs) -----
async function logUserAction({
    userId = null,
    action,
    status,
    ip,
    userAgent,
    errorMessage,
    details,
}) {
    try {
        const safeDetails = sanitizeInput(details || {});
        const safeError = typeof errorMessage === "string" ? redactIfSecretLike(errorMessage) : null;

        await pool.query(
            `INSERT INTO user_logs (user_id, action, status, ip_address, user_agent, error_message, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
            [
                userId || null,
                action,
                status,
                ip || null,
                userAgent || null,
                safeError,
                Object.keys(safeDetails).length ? JSON.stringify(safeDetails) : null,
            ]
        );
    } catch (err) {
        logToFile("DB_LOG_ERROR", {
            error: err && err.message ? err.message : String(err),
            userId,
            action,
            status,
            ip,
            userAgent,
        }, "error");
    }
} // logUserAction

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
  logUserAction,
  logToFile,
  logger,
  sanitizeInput,
};
