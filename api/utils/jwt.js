const jwt = require("jsonwebtoken");
const config = require("../config");
const pool = require("../db");
const { errorResponse } = require("./response");
const { logToFile } = require("./logging");
const { hashApiKey } = require("./api-keys");

const ACCESS_TOKEN_SECRET = config.jwt.accessSecret;
const REFRESH_TOKEN_SECRET = config.jwt.refreshSecret;
const ACCESS_TOKEN_EXPIRES_IN = config.jwt.accessExpiresIn; // Short-lived
const REFRESH_TOKEN_EXPIRES_IN = config.jwt.refreshExpiresIn; // Long-lived

function generateAccessToken(user) {
	// Only include safe fields
	return jwt.sign(
		{
			id: user.id,
			role: user.role
		},
		ACCESS_TOKEN_SECRET,
		{ expiresIn: ACCESS_TOKEN_EXPIRES_IN }
	);
} // generateAccessToken

function generateRefreshToken(user, fingerprint) {
	// Only include user id and fingerprint
	return jwt.sign(
		{
			id: user.id,
			fingerprint
		},
		REFRESH_TOKEN_SECRET,
		{ expiresIn: REFRESH_TOKEN_EXPIRES_IN }
	);
} // generateRefreshToken

function verifyAccessToken(token) {
	return jwt.verify(token, ACCESS_TOKEN_SECRET);
} // verifyAccessToken

function verifyRefreshToken(token) {
	return jwt.verify(token, REFRESH_TOKEN_SECRET);
} // verifyRefreshToken

async function requiresAuth(req, res, next) {
	const authHeader = req.headers.authorization;
	const apiKeyHeader = req.headers["x-api-key"];
	const apiKeyFromAuth = authHeader && (authHeader.startsWith("ApiKey ") || authHeader.startsWith("Api-Key "))
		? authHeader.split(" ")[1]
		: null;
	const apiKey = typeof apiKeyHeader === "string" && apiKeyHeader.trim()
		? apiKeyHeader.trim()
		: (apiKeyFromAuth || "");

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		if (!apiKey) {
			logToFile("AUTH_CHECK", {
				status: "FAILURE",
				reason: "MISSING_AUTH_HEADER",
				ip: req.ip,
				path: req.originalUrl,
				user_agent: req.get("user-agent")
			}, "warn");
			return errorResponse(res, 401, "Authentication required for this action.", ["Missing or invalid Authorization header."]);
		}

		try {
			const keyHash = hashApiKey(apiKey);
			const { rows } = await pool.query(
				`SELECT k.id AS key_id, k.user_id, k.revoked_at, k.expires_at, u.role, u.is_disabled
				 FROM user_api_keys k
				 JOIN users u ON u.id = k.user_id
				 WHERE k.key_hash = $1`,
				[keyHash]
			);

			if (rows.length === 0) {
				return errorResponse(res, 401, "Invalid or expired access token.", ["Authentication failed."]);
			}

			const key = rows[0];
			if (key.revoked_at) {
				return errorResponse(res, 401, "Invalid or expired access token.", ["Authentication failed."]);
			}
			if (key.expires_at && new Date(key.expires_at) <= new Date()) {
				return errorResponse(res, 401, "Invalid or expired access token.", ["Authentication failed."]);
			}
			if (key.is_disabled) {
				return errorResponse(res, 403, "Your account has been disabled.", ["Please contact the system administrator if you believe this is a mistake."]);
			}

			await pool.query(
				`UPDATE user_api_keys SET last_used_at = NOW() WHERE id = $1`,
				[key.key_id]
			);

			req.user = { id: key.user_id, role: key.role };
			req.authMethod = "apiKey";
			return next();
		} catch (dbErr) {
			logToFile("AUTH_CHECK", {
				status: "FAILURE",
				reason: "Database Error",
				error_message: dbErr.message,
				ip: req.ip,
				path: req.originalUrl,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Internal Server Error", ["An error occurred while validating your authentication. Please try again."]);
		}
	}

	const token = authHeader.split(" ")[1];
	let payload;

	try {
		payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
	} catch (err) {
		logToFile("AUTH_CHECK", {
			status: "FAILURE",
			reason: "ACCESS_TOKEN_INVALID",
			error_message: err.message,
			ip: req.ip,
			path: req.originalUrl,
			user_agent: req.get("user-agent")
		}, "warn");
		return errorResponse(res, 401, "Invalid or expired access token.", ["Authentication failed."]);
	}

	try {
		const { rows } = await pool.query("SELECT id, role, is_disabled FROM users WHERE id = $1", [payload.id]);
		if (rows.length === 0) {
			logToFile("AUTH_CHECK", {
				status: "FAILURE",
				reason: "User not found.",
				user_id: payload.id,
				ip: req.ip,
				path: req.originalUrl,
				user_agent: req.get("user-agent")
			}, "warn");
			return errorResponse(res, 401, "Authentication required for this action.", ["Missing or invalid Authorization header."]);
		}

		const user = rows[0];
		if (user.is_disabled) {
			logToFile("AUTH_CHECK", {
				status: "FAILURE",
				reason: "Your account has been disabled.",
				user_id: user.id,
				ip: req.ip,
				path: req.originalUrl,
				user_agent: req.get("user-agent")
			}, "warn");
			return errorResponse(res, 403, "Your account has been disabled.", ["Please contact the system administrator if you believe this is a mistake."]);
		}

		req.user = {
			id: user.id,
			role: user.role
		};
		req.authMethod = "accessToken";
		return next();
	} catch (dbErr) {
		logToFile("AUTH_CHECK", {
			status: "FAILURE",
			reason: "Database Error",
			error_message: dbErr.message,
			user_id: payload.id,
			ip: req.ip,
			path: req.originalUrl,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["An error occurred while validating your authentication. Please try again."]);
	}
} // requiresAuth

function requireRole(roles) {
	return function (req, res, next) {
		if (!req.user || !roles.includes(req.user.role)) {
			logToFile("AUTH_CHECK", {
				status: "FAILURE",
				reason: "FORBIDDEN_ROLE",
				user_id: req.user ? req.user.id : null,
				path: req.originalUrl,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "warn");
			return errorResponse(res, 403, "Forbidden: Insufficient permissions.", ["You do not have permission to access this resource or endpoint."]);
		}
		return next();
	};
} // requireRole

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  requiresAuth,
  requireRole
};
