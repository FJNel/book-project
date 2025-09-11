// Handles logging to rotating files and the user_logs database table.

const fs = require("fs");
const path = require("path");
const winston = require("winston");
const pool = require("../db");

// ----- Configuration -----
const LOG_DIR = path.join(__dirname, "..", "logs");
ensureLogsDir(LOG_DIR);

// Winston rotating file transport (size-based)
const transport = new winston.transports.File({
  filename: path.join(LOG_DIR, "app.log"),
  maxsize: 5 * 1024 * 1024, // 5 MB
  maxFiles: 5,              // keep last 5 log files
  tailable: true            // overwrite oldest logs
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [transport]
});

// Also log to console in non-production for convenience
if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

// ----- Validation -----
const VALID_ACTIONS = [
  "LOGIN_ATTEMPT",
  "LOGOUT",
  "PASSWORD_RESET_REQUEST",
  "PASSWORD_RESET_SUCCESS",
  "EMAIL_VERIFICATION",
  "USER_REGISTERED",
  "USER_UPDATED_PROFILE",
  "TOKEN_REFRESHED"
];

const VALID_STATUSES = ["SUCCESS", "FAILURE", "INFO"];

// ----- Sanitization (deep) -----
function sanitizeInput(value) {
  try {
    // Redact strings that look like secrets (if you ever pass raw strings)
    if (typeof value === "string") return redactIfSecretLike(value);

    if (Array.isArray(value)) {
      return value.map(sanitizeInput);
    }
    if (value && typeof value === "object") {
      const copy = {};
      for (const [key, val] of Object.entries(value)) {
        if (isSecretKey(key)) {
          copy[key] = "[REDACTED]";
        } else {
          copy[key] = sanitizeInput(val);
        }
      }
      return copy;
    }
    return value;
  } catch {
    // Fallback: never let sanitization throw
    return "[UNSERIALIZABLE]";
  }
}

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
}

function redactIfSecretLike(str) {
  // Very light heuristic; adjust if needed
  if (str.length > 2000) return "[REDACTED_LARGE_STRING]";
  return str;
}

// ----- File logging -----
function logToFile(event, data = {}, level = "info") {
  const safePayload = sanitizeInput(data);
  logger.log({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...safePayload
  });
}

// ----- DB logging (user_logs) -----
async function logUserAction({
  userId = null,
  action,
  status,
  ip,
  userAgent,
  errorMessage,
  details
}) {
  try {
    // Validate enums
    if (!VALID_ACTIONS.includes(action)) {
      throw new Error(`Invalid action '${action}'. Must be one of: ${VALID_ACTIONS.join(", ")}`);
    }
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    // Sanitize inputs (never store raw secrets)
    const safeDetails = sanitizeInput(details || {});
    const safeError = typeof errorMessage === "string" ? redactIfSecretLike(errorMessage) : undefined;

    // Insert into DB; cast details to jsonb safely
    await pool.query(
      `INSERT INTO user_logs (user_id, action, status, ip_address, user_agent, error_message, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        userId || null,
        action,
        status,
        ip || null,
        userAgent || null,
        safeError || null,
        Object.keys(safeDetails).length ? JSON.stringify(safeDetails) : null
      ]
    );
  } catch (err) {
    // Fallback to file if DB logging fails or validation fails
    logToFile("DB_LOG_ERROR", {
      error: err.message,
      userId,
      action,
      status,
      ip,
      userAgent
    }, "error");
  }
}

// ----- Utils -----
function ensureLogsDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    // If directory creation fails, Winston will still try to create the file path on first write
    // Log to console as last resort
    // eslint-disable-next-line no-console
    console.error("Failed to ensure logs directory:", e.message);
  }
}

module.exports = {
  logUserAction,
  logToFile,
  logger,
  VALID_ACTIONS,
  VALID_STATUSES,
  sanitizeInput
};