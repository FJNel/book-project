const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, emailCostLimiter, sensitiveActionLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { validateFullName, validatePreferredName, validateEmail, validatePassword } = require("../utils/validators");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { enqueueEmail } = require("../utils/email-queue");
const fetch = global.fetch
	? global.fetch.bind(global)
	: (...args) => import("node-fetch").then(({ default: fetchFn }) => fetchFn(...args));
const config = require("../config");
const SALT_ROUNDS = config.saltRounds;

const RECAPTCHA_SECRET = config.recaptchaSecret;

const ACCOUNT_DISABLE_TOKEN_EXPIRY_MINUTES = 60;
const ACCOUNT_DELETE_TOKEN_EXPIRY_MINUTES = 60;
const EMAIL_CHANGE_TOKEN_EXPIRY_MINUTES = 60;

const ACTION_LIMITS = {
	accountDisable: { limit: 2, label: "account disable requests" },
	accountDeletion: { limit: 2, label: "account deletion requests" },
	emailChange: { limit: 1, label: "email change requests" },
	passwordChange: { limit: 2, label: "password changes" }
};

function getTodayKey() {
	return new Date().toISOString().slice(0, 10);
}

function applyDailyActionLimit(metadata, actionKey) {
	const config = ACTION_LIMITS[actionKey];
	if (!config) {
		return { allowed: true, metadata: getSafeMetadata(metadata) };
	}

	const normalizedMetadata = getSafeMetadata(metadata);
	const countersSource = normalizedMetadata.actionCounters;
	const counters = countersSource && typeof countersSource === "object" && !Array.isArray(countersSource)
		? { ...countersSource }
		: {};

	const today = getTodayKey();
	const record = counters[actionKey];
	const currentCount = record && record.date === today ? record.count : 0;

	if (currentCount >= config.limit) {
		return {
			allowed: false,
			metadata: normalizedMetadata,
			message: `You have reached today's limit for ${config.label}. Please try again tomorrow.`
		};
	}

	const nextCount = currentCount + 1;
	counters[actionKey] = { date: today, count: nextCount };

	return {
		allowed: true,
		metadata: {
			...normalizedMetadata,
			actionCounters: counters
		},
		remaining: config.limit - nextCount
	};
}

function summarizeUserAgent(userAgent) {
	if (!userAgent || typeof userAgent !== "string") {
		return { browser: "Unknown", device: "Unknown", operatingSystem: "Unknown", raw: "" };
	}

	const raw = userAgent;
	const ua = raw.toLowerCase();

	let browser = "Unknown";
	if (/edg\//.test(ua)) {
		browser = "Microsoft Edge";
	} else if (/opr\//.test(ua) || /opera/.test(ua)) {
		browser = "Opera";
	} else if (/chrome/.test(ua) && !/edg|opr/.test(ua)) {
		browser = "Chrome";
	} else if (/safari/.test(ua) && !/chrome|crios|opr|edg/.test(ua)) {
		browser = "Safari";
	} else if (/firefox/.test(ua)) {
		browser = "Firefox";
	} else if (/msie|trident/.test(ua)) {
		browser = "Internet Explorer";
	}

	let operatingSystem = "Unknown";
	if (/windows nt/.test(ua)) {
		operatingSystem = "Windows";
	} else if (/mac os x/.test(ua)) {
		operatingSystem = "macOS";
	} else if (/android/.test(ua)) {
		operatingSystem = "Android";
	} else if (/iphone|ipad|ipod/.test(ua)) {
		operatingSystem = "iOS";
	} else if (/linux/.test(ua)) {
		operatingSystem = "Linux";
	}

	let device = "Desktop";
	if (/ipad|tablet/.test(ua)) {
		device = "Tablet";
	} else if (/mobile|iphone|android/.test(ua)) {
		device = "Mobile";
	}

	return { browser, device, operatingSystem, raw };
}

function generateActionToken() {
	return crypto.randomBytes(32).toString("hex");
}

function addMinutesToNow(minutes) {
	return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function minutesUntilExpiry(expiresAt) {
	if (!expiresAt) {
		return 0;
	}
	const expires = new Date(expiresAt).getTime();
	const diffMs = expires - Date.now();
	if (Number.isNaN(diffMs) || diffMs <= 0) {
		return 0;
	}
	return Math.max(1, Math.round(diffMs / 60000));
}

function getSafeMetadata(rawMetadata) {
	return rawMetadata && typeof rawMetadata === "object" ? { ...rawMetadata } : {};
}

function serializeMetadata(metadataObject) {
	const normalized = metadataObject && Object.keys(metadataObject).length > 0 ? metadataObject : {};
	return JSON.stringify(normalized);
}

function removeMetadataKey(metadata, key) {
	const clone = getSafeMetadata(metadata);
	delete clone[key];
	return clone;
}

function normalizeEmail(value) {
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function invalidConfirmationResponse(res) {
	return errorResponse(res, 400, "Invalid or expired token", [
		"The confirmation token is invalid, has expired, or the supplied information does not match this request."
	]);
}

async function verifyCaptchaToken(token, ip, expectedAction = null, minScore = 0.7) {
	if (!RECAPTCHA_SECRET) {
		logToFile("CAPTCHA_MISCONFIGURED", { message: "RECAPTCHA_SECRET is not set in environment variables" }, "warn");
		return false;
	}

	if (!token || typeof token !== "string") {
		return false;
	}

	try {
		const params = new URLSearchParams();
		params.append("secret", RECAPTCHA_SECRET);
		params.append("response", token);
		if (ip) {
			params.append("remoteip", ip);
		}

		const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params
		});
		const data = await response.json();
		const actionMatch = expectedAction ? data?.action === expectedAction : true;
		const ok = data?.success === true && (typeof data?.score === "number" ? data.score >= minScore : true) && actionMatch;
		logToFile("CAPTCHA_VERIFICATION", {
			status: ok ? "SUCCESS" : "FAILURE",
			score: data?.score,
			min_score: minScore,
			action: data?.action,
			expected_action: expectedAction,
			action_match: actionMatch
		}, ok ? "info" : "warn");
		return ok;
	} catch (error) {
		logToFile("CAPTCHA_VERIFICATION_ERROR", { message: error.message }, "error");
		return false;
	}
}

function extractTokenFromRequest(req) {
	if (req.method === "GET") {
		return typeof req.query.token === "string" ? req.query.token.trim() : undefined;
	}
	return typeof req.body?.token === "string" ? req.body.token.trim() : undefined;
}


// Retrieve the profile information of the currently authenticated user
router.get("/me", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;

	try {
		const query = `
			SELECT
				u.id,
				u.email,
				u.full_name,
				u.preferred_name,
				u.role,
				u.is_verified,
				u.password_updated,
				u.created_at,
				u.updated_at,
				COALESCE(
					(SELECT json_agg(provider) FROM oauth_accounts WHERE user_id = u.id),
					'[]'::json
				) AS oauth_providers
			FROM users u
			WHERE u.id = $1 AND u.is_disabled = false;
		`;
		// Also fetch associated OAuth providers
		const result = await pool.query(query, [userId]);

		// If no user found or user is disabled
		if (result.rows.length === 0) {
			logToFile("GET_PROFILE", { status: "FAILURE", reason: "NOT_FOUND", user_id: userId, ip: req.ip, user_agent: req.get("user-agent") }, "warn");
			return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		}

		// Construct user profile response
		const userProfile = {
			id: result.rows[0].id,
			email: result.rows[0].email,
			fullName: result.rows[0].full_name,
			preferredName: result.rows[0].preferred_name,
			role: result.rows[0].role,
			isVerified: result.rows[0].is_verified,
			passwordUpdated: result.rows[0].password_updated,
			oauthProviders: result.rows[0].oauth_providers,
			createdAt: result.rows[0].created_at,
			updatedAt: result.rows[0].updated_at,
		};

		// Log successful retrieval

		// Return user profile
		logToFile("GET_PROFILE", { status: "SUCCESS", user_id: userId, ip: req.ip, user_agent: req.get("user-agent") }, "info");
		return successResponse(res, 200, "User profile retrieved successfully.", userProfile);
	} catch (e) {
		logToFile("GET_PROFILE_ERROR", { status: "FAILURE", error_message: e.message, user_id: userId, ip: req.ip, user_agent: req.get("user-agent") }, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the user profile."]);
	}
}); // router.get("/me")


// Update the profile information of the currently authenticated user
// Only fullName and preferredName can be updated
router.put("/me", requiresAuth, authenticatedLimiter, async (req, res) => {
	// Get the user ID from the authenticated request
	const userId = req.user.id;
	// Extract fields to update from the request body
	const { fullName, preferredName } = req.body;

	// Validation
	const errors = [];
	if (fullName !== undefined) {
		errors.push(...validateFullName(fullName));
	}
	if (preferredName !== undefined) {
		errors.push(...validatePreferredName(preferredName));
	}

	// If validation errors exist, log and return them
	if (errors.length > 0) {
		logToFile("UPDATE_PROFILE", { status: "FAILURE", reason: "VALIDATION", user_id: userId, ip: req.ip, user_agent: req.get("user-agent"), errors }, "warn");
		return errorResponse(res, 400, "Validation Error", errors);
	}

	// Build the update query dynamically
	const updateFields = [];
	const queryParams = [userId];
	let paramIndex = 2;

	if (fullName !== undefined) {
		updateFields.push(`full_name = $${paramIndex++}`);
		queryParams.push(fullName);
	}
	if (preferredName !== undefined) {
		updateFields.push(`preferred_name = $${paramIndex++}`);
		queryParams.push(preferredName);
	}

	if (updateFields.length === 0) {
		return errorResponse(res, 400, "No changes were provided.", ["Please provide at least one field to update."]);
	}

	// Construct the final SQL query
	const queryText = `
		UPDATE users
		SET ${updateFields.join(", ")}, updated_at = NOW()
		WHERE id = $1 AND is_disabled = false
		RETURNING id, email, full_name, preferred_name, role, is_verified, password_updated, created_at, updated_at;
	`;

	try {
		// Execute the update query
		const result = await pool.query(queryText, queryParams);

		if (result.rows.length === 0) {
			// No user found or user is disabled
			return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		}

		// Construct the updated user profile response
		const updatedUser = {
			id: result.rows[0].id,
			email: result.rows[0].email,
			fullName: result.rows[0].full_name,
			preferredName: result.rows[0].preferred_name,
			role: result.rows[0].role,
			isVerified: result.rows[0].is_verified,
			passwordUpdated: result.rows[0].password_updated,
			createdAt: result.rows[0].created_at,
			updatedAt: result.rows[0].updated_at,
		};

		logToFile("UPDATE_PROFILE", { status: "SUCCESS", user_id: userId, ip: req.ip, user_agent: req.get("user-agent") }, "info");

		return successResponse(res, 200, "User profile updated successfully.", updatedUser);
	} catch (e) {
		logToFile("UPDATE_PROFILE_ERROR", { status: "FAILURE", error_message: e.message, user_id: userId, ip: req.ip, user_agent: req.get("user-agent") }, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the user profile."]);
	}
}); // router.put("/me")


//Initiate account disable flow (requires email confirmation)
router.delete("/me", requiresAuth, authenticatedLimiter, emailCostLimiter, async (req, res) => {
	const userId = req.user.id;

	try {
		const { rows } = await pool.query("SELECT email, preferred_name, is_disabled, metadata FROM users WHERE id = $1", [userId]);
		if (rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		}

		const user = rows[0];
		if (user.is_disabled) {
			return errorResponse(res, 400, "Account already disabled.", ["Your account has already been disabled. Contact support if this was unexpected."]);
		}

		let metadata = getSafeMetadata(user.metadata);
		const limitCheck = applyDailyActionLimit(metadata, "accountDisable");
		if (!limitCheck.allowed) {
			logToFile("ACCOUNT_DISABLE_REQUEST", {
				status: "FAILURE",
				reason: "DAILY_LIMIT",
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "warn");
			return errorResponse(res, 429, "Daily limit reached", [limitCheck.message]);
		}
		metadata = limitCheck.metadata;

		const existingDisable = metadata.pendingAccountDisable;
		const now = new Date();
		let token;
		let expiresAt;
		let reusedToken = false;

		if (existingDisable && existingDisable.token && existingDisable.expiresAt && new Date(existingDisable.expiresAt) > now) {
			token = existingDisable.token;
			expiresAt = existingDisable.expiresAt;
			reusedToken = true;
		} else {
			token = generateActionToken();
			expiresAt = addMinutesToNow(ACCOUNT_DISABLE_TOKEN_EXPIRY_MINUTES);
			metadata.pendingAccountDisable = {
				token,
				expiresAt,
				requestedAt: new Date().toISOString()
			};
		}

		await pool.query(
			"UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1",
			[userId, serializeMetadata(metadata)]
		);

		const expiresInMinutes = Math.max(1, minutesUntilExpiry(expiresAt) || ACCOUNT_DISABLE_TOKEN_EXPIRY_MINUTES);
		enqueueEmail({
			type: "account_disable_verification",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				token,
				expiresIn: expiresInMinutes
			},
			context: "ACCOUNT_DISABLE_REQUEST",
			userId
		});

		logToFile("ACCOUNT_DISABLE_REQUEST", {
			status: "INFO",
			mode: reusedToken ? "REUSED_TOKEN" : "NEW_TOKEN",
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(
			res,
			200,
			"Check your email to confirm this action.",
			{ disclaimer: "Your account will remain active until you confirm the disable request via the link we sent." }
		);
	} catch (error) {
		logToFile("ACCOUNT_DISABLE_REQUEST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["An error occurred while requesting the account disable action."]);
	}
}); // router.delete("/me")

router.post("/me/request-email-change", requiresAuth, authenticatedLimiter, emailCostLimiter, async (req, res) => {
	const userId = req.user.id;
	let { newEmail } = req.body || {};
	newEmail = typeof newEmail === "string" ? newEmail.trim() : "";
	const normalizedNewEmail = newEmail.toLowerCase();

	const emailValidationErrors = validateEmail(newEmail);
	if (emailValidationErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", emailValidationErrors);
	}

	try {
		const { rows } = await pool.query("SELECT email, preferred_name, metadata FROM users WHERE id = $1", [userId]);
		if (rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		}
		const user = rows[0];
		const currentEmail = (user.email || "").toLowerCase();
		if (currentEmail === newEmail) {
			return errorResponse(res, 400, "Validation Error", ["The new email address must be different from your current email."]);
		}

		const existingEmail = await pool.query("SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1", [normalizedNewEmail, userId]);
		if (existingEmail.rows.length > 0) {
			logToFile("EMAIL_CHANGE_REQUEST", {
				status: "INFO",
				reason: "EMAIL_IN_USE",
				user_id: userId,
				new_email: newEmail,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");
			return successResponse(
				res,
				200,
				"If this email can be used, you will receive a confirmation link shortly.",
				{ disclaimer: "If you do not receive an email, please use a different address or try again later." }
			);
		}

		let metadata = getSafeMetadata(user.metadata);
		const limitCheck = applyDailyActionLimit(metadata, "emailChange");
		if (!limitCheck.allowed) {
			logToFile("EMAIL_CHANGE_REQUEST", {
				status: "FAILURE",
				reason: "DAILY_LIMIT",
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "warn");
			return errorResponse(res, 429, "Daily limit reached", [limitCheck.message]);
		}
		metadata = limitCheck.metadata;
		const existingChange = metadata.pendingEmailChange;
		const now = new Date();
		let token;
		let expiresAt;
		let reusedToken = false;
		const canReuse = existingChange
			&& existingChange.token
			&& existingChange.expiresAt
			&& existingChange.newEmail === normalizedNewEmail
			&& new Date(existingChange.expiresAt) > now;

		if (canReuse) {
			token = existingChange.token;
			expiresAt = existingChange.expiresAt;
			reusedToken = true;
		} else {
			token = generateActionToken();
			expiresAt = addMinutesToNow(EMAIL_CHANGE_TOKEN_EXPIRY_MINUTES);
			metadata.pendingEmailChange = {
				token,
				newEmail: normalizedNewEmail,
				expiresAt,
				requestedAt: new Date().toISOString()
			};
		}

		await pool.query(
			"UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1",
			[userId, serializeMetadata(metadata)]
		);

		const expiresInMinutes = Math.max(1, minutesUntilExpiry(expiresAt) || EMAIL_CHANGE_TOKEN_EXPIRY_MINUTES);
		enqueueEmail({
			type: "email_change_verification",
			params: {
				toEmail: newEmail,
				preferredName: user.preferred_name,
				token,
				expiresIn: expiresInMinutes
			},
			context: "EMAIL_CHANGE_REQUEST",
			userId
		});

		logToFile("EMAIL_CHANGE_REQUEST", {
			status: "SUCCESS",
			mode: reusedToken ? "REUSED_TOKEN" : "NEW_TOKEN",
			user_id: userId,
			new_email: newEmail,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(
			res,
			200,
			"If this email can be used, you will receive a confirmation link shortly.",
			{ disclaimer: "You will be signed out on all devices once the new email is verified." }
		);
	} catch (error) {
		logToFile("EMAIL_CHANGE_REQUEST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["An error occurred while requesting the email change."]);
	}
}); // router.post("/me/request-email-change")

async function initiateAccountDeletionRequest(req, res) {
	const userId = req.user.id;
	try {
		const { rows } = await pool.query("SELECT email, preferred_name, full_name, metadata FROM users WHERE id = $1", [userId]);
		if (rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		}
		const user = rows[0];
		let metadata = getSafeMetadata(user.metadata);
		const limitCheck = applyDailyActionLimit(metadata, "accountDeletion");
		if (!limitCheck.allowed) {
			logToFile("ACCOUNT_DELETE_REQUEST", {
				status: "FAILURE",
				reason: "DAILY_LIMIT",
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "warn");
			return errorResponse(res, 429, "Daily limit reached", [limitCheck.message]);
		}
		metadata = limitCheck.metadata;
		const existingDeletion = metadata.pendingAccountDeletion;
		const now = new Date();
		let token;
		let expiresAt;
		let reusedToken = false;

		if (existingDeletion && existingDeletion.token && existingDeletion.expiresAt && new Date(existingDeletion.expiresAt) > now) {
			token = existingDeletion.token;
			expiresAt = existingDeletion.expiresAt;
			reusedToken = true;
		} else {
			token = generateActionToken();
			expiresAt = addMinutesToNow(ACCOUNT_DELETE_TOKEN_EXPIRY_MINUTES);
			metadata.pendingAccountDeletion = {
				token,
				expiresAt,
				requestedAt: new Date().toISOString()
			};
		}

		await pool.query(
			"UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1",
			[userId, serializeMetadata(metadata)]
		);

		const expiresInMinutes = Math.max(1, minutesUntilExpiry(expiresAt) || ACCOUNT_DELETE_TOKEN_EXPIRY_MINUTES);
		enqueueEmail({
			type: "account_delete_verification",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				token,
				expiresIn: expiresInMinutes
			},
			context: "ACCOUNT_DELETE_REQUEST",
			userId
		});

		logToFile("ACCOUNT_DELETE_REQUEST", {
			status: "INFO",
			mode: reusedToken ? "REUSED_TOKEN" : "NEW_TOKEN",
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(
			res,
			200,
			"Check your email to confirm this deletion request.",
			{ disclaimer: "Our support team will only be notified after you confirm via the email link." }
		);
	} catch (error) {
		logToFile("ACCOUNT_DELETE_REQUEST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["An error occurred while requesting account deletion."]);
	}
}

router.delete("/me/request-account-deletion", requiresAuth, authenticatedLimiter, emailCostLimiter, initiateAccountDeletionRequest);
router.post("/me/request-account-deletion", requiresAuth, authenticatedLimiter, emailCostLimiter, initiateAccountDeletionRequest); // backward compatibility

router.get("/me/sessions", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	try {
		const { rows } = await pool.query(
			`SELECT token_fingerprint, issued_at, expires_at, ip_address::TEXT AS ip_address, user_agent
			 FROM refresh_tokens
			 WHERE user_id = $1
				 AND revoked = false
				 AND expires_at > NOW()
			 ORDER BY expires_at DESC`,
			[userId]
		);

		const sessions = rows.map((session) => {
			const summary = summarizeUserAgent(session.user_agent);
			const expiresAt = session.expires_at;
			const millisecondsRemaining = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0;
			return {
				fingerprint: session.token_fingerprint,
				issuedAt: session.issued_at,
				expiresAt,
				expiresInSeconds: Math.floor(millisecondsRemaining / 1000),
				ipAddress: session.ip_address || null,
				locationHint: session.ip_address ? `IP ${session.ip_address}` : "Unknown",
				browser: summary.browser,
				device: summary.device,
				operatingSystem: summary.operatingSystem,
				rawUserAgent: summary.raw
			};
		});

		logToFile("LIST_SESSIONS", {
			status: "SUCCESS",
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent"),
			session_count: sessions.length
		}, "info");

		return successResponse(res, 200, "Active sessions retrieved.", { sessions });
	} catch (error) {
		logToFile("LIST_SESSIONS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["Unable to retrieve sessions at this time."]);
	}
});

router.delete("/me/sessions/:fingerprint", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const fingerprint = typeof req.params?.fingerprint === "string" ? req.params.fingerprint.trim() : "";

	if (!fingerprint) {
		return errorResponse(res, 400, "Invalid session identifier", ["A session fingerprint must be provided in the URL path."]);
	}

	try {
		const { rowCount } = await pool.query(
			`UPDATE refresh_tokens
			 SET revoked = true
			 WHERE user_id = $1
				 AND token_fingerprint = $2
				 AND revoked = false`,
			[userId, fingerprint]
		);

		const wasRevoked = rowCount > 0;
		logToFile("REVOKE_SESSION", {
			status: wasRevoked ? "SUCCESS" : "NO_OP",
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent"),
			fingerprint
		}, wasRevoked ? "info" : "warn");

		return successResponse(
			res,
			200,
			wasRevoked ? "Session revoked." : "Session not found or already inactive.",
			{ fingerprint, wasRevoked }
		);
	} catch (error) {
		logToFile("REVOKE_SESSION", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent"),
			fingerprint
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["Unable to revoke the requested session."]);
	}
});

async function changePassword(req, res) {
	const userId = req.user.id;
	const { currentPassword, newPassword, captchaToken } = req.body || {};

	if (!currentPassword || typeof currentPassword !== "string") {
		return errorResponse(res, 400, "Validation Error", ["Current password is required."]);
	}
	if (!newPassword || typeof newPassword !== "string") {
		return errorResponse(res, 400, "Validation Error", ["A new password is required."]);
	}

	const sanitizedNewPassword = newPassword.trim();
	const passwordErrors = validatePassword(sanitizedNewPassword);
	if (passwordErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", passwordErrors);
	}

	const captchaValid = await verifyCaptchaToken(captchaToken, req.ip, "change_password");
	if (!captchaValid) {
		return errorResponse(res, 400, "CAPTCHA verification failed", ["Please refresh the page and try again.", "Make sure that you provided a captchaToken in your request."]);
	}

	try {
	const { rows } = await pool.query(
		"SELECT password_hash, email, preferred_name, metadata FROM users WHERE id = $1 AND is_disabled = false",
		[userId]
	);
	if (rows.length === 0) {
		return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
	}
	const user = rows[0];
	let metadata = getSafeMetadata(user.metadata);
	const limitCheck = applyDailyActionLimit(metadata, "passwordChange");
	if (!limitCheck.allowed) {
		logToFile("CHANGE_PASSWORD", {
			status: "FAILURE",
			reason: "DAILY_LIMIT",
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "warn");
		return errorResponse(res, 429, "Daily limit reached", [limitCheck.message]);
	}
	metadata = limitCheck.metadata;
	if (!user.password_hash) {
		return errorResponse(res, 400, "Password change unavailable", ["This account does not have a password set. Please use the password reset flow first."]);
	}
		const currentMatches = await bcrypt.compare(currentPassword, user.password_hash);
		if (!currentMatches) {
			return errorResponse(res, 400, "Validation Error", ["The current password provided is incorrect."]);
		}
		const sameAsOld = await bcrypt.compare(sanitizedNewPassword, user.password_hash);
		if (sameAsOld) {
			return errorResponse(res, 400, "Validation Error", ["The new password must be different from the current password."]);
		}

	const hashedPassword = await bcrypt.hash(sanitizedNewPassword, SALT_ROUNDS);
	const serializedMetadata = serializeMetadata(metadata);
	const client = await pool.connect();
	let passwordUpdatedAt = null;
	try {
		await client.query("BEGIN");
		const updateResult = await client.query(
			"UPDATE users SET password_hash = $2, password_updated = NOW(), metadata = $3::jsonb, updated_at = NOW() WHERE id = $1 RETURNING password_updated",
			[userId, hashedPassword, serializedMetadata]
		);
		passwordUpdatedAt = updateResult.rows[0]?.password_updated || null;
		await client.query(
			"UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false",
			[userId]
		);
		await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("CHANGE_PASSWORD", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Internal Server Error", ["An error occurred while updating the password."]);
		} finally {
			client.release();
		}

		enqueueEmail({
			type: "password_reset_success",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name
			},
			context: "PASSWORD_CHANGE_SELF_SERVICE",
			userId
		});

		logToFile("CHANGE_PASSWORD", {
			status: "SUCCESS",
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

	return successResponse(
		res,
		200,
		"Password updated successfully.",
		{
			passwordUpdated: passwordUpdatedAt,
			disclaimer: "You have been signed out on all devices. Please log in using your new password."
		}
	);
	} catch (error) {
		logToFile("CHANGE_PASSWORD", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["An unexpected error occurred while changing the password."]);
	}
}

async function verifyAccountDisable(req, res) {
	const token = extractTokenFromRequest(req);
	const { email, captchaToken } = req.body || {};

	if (!token) {
		return errorResponse(res, 400, "Token required", ["A valid confirmation token must be provided."]);
	}
	if (!email || typeof email !== "string") {
		return errorResponse(res, 400, "Validation Error", ["Email address is required."]);
	}
	const captchaValid = await verifyCaptchaToken(captchaToken, req.ip, "verify_delete");
	if (!captchaValid) {
		return errorResponse(res, 400, "CAPTCHA verification failed", ["Please refresh the page and try again.", "Make sure that you provided a captchaToken in your request."]);
	}

	try {
		const { rows } = await pool.query(
			`SELECT id, email, preferred_name, metadata FROM users
			 WHERE jsonb_extract_path_text(metadata, 'pendingAccountDisable', 'token') = $1
			 LIMIT 1`,
			[token]
		);

		if (rows.length === 0) {
			return invalidConfirmationResponse(res);
		}

		const user = rows[0];
		const disableRequestEmail = normalizeEmail(email);
		if (normalizeEmail(user.email) !== disableRequestEmail) {
			logToFile("ACCOUNT_DISABLE_CONFIRM", { status: "FAILURE", reason: "EMAIL_MISMATCH", user_id: user.id }, "warn");
			return invalidConfirmationResponse(res);
		}
		const metadata = getSafeMetadata(user.metadata);
		const pending = metadata.pendingAccountDisable;
		if (!pending || pending.token !== token) {
			return invalidConfirmationResponse(res);
		}

		if (!pending.expiresAt || new Date(pending.expiresAt) < new Date()) {
			const updatedMetadata = removeMetadataKey(metadata, "pendingAccountDisable");
			await pool.query("UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1", [user.id, serializeMetadata(updatedMetadata)]);
			return errorResponse(res, 400, "Token expired", ["The confirmation token has expired. Please submit a new request from your account settings."]);
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const updatedMetadata = removeMetadataKey(metadata, "pendingAccountDisable");
			await client.query(
				"UPDATE users SET is_disabled = true, metadata = $2::jsonb, updated_at = NOW() WHERE id = $1",
				[user.id, serializeMetadata(updatedMetadata)]
			);
			await client.query(
				"UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false",
				[user.id]
			);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("ACCOUNT_DISABLE_CONFIRM", { status: "FAILURE", error_message: error.message, user_id: user.id }, "error");
			return errorResponse(res, 500, "Internal Server Error", ["An error occurred while disabling the account."]);
		} finally {
			client.release();
		}

		enqueueEmail({
			type: "account_disable_confirmation",
			params: { toEmail: user.email, preferredName: user.preferred_name },
			context: "ACCOUNT_DISABLE_CONFIRMED",
			userId: user.id
		});

		logToFile("ACCOUNT_DISABLE_CONFIRM", {
			status: "SUCCESS",
			user_id: user.id
		}, "info");

		return successResponse(
			res,
			200,
			"Your account has been disabled.",
			{ disclaimer: "If you need to reactivate your account, please contact support." }
		);
	} catch (error) {
		logToFile("ACCOUNT_DISABLE_CONFIRM", { status: "FAILURE", error_message: error.message }, "error");
		return errorResponse(res, 500, "Internal Server Error", ["An unexpected error occurred while validating the token."]);
	}
}

async function verifyAccountDeletion(req, res) {
	const token = extractTokenFromRequest(req);
	const { email, password, confirm, captchaToken } = req.body || {};

	if (!token) {
		return errorResponse(res, 400, "Token required", ["A valid confirmation token must be provided."]);
	}
	if (!email || typeof email !== "string") {
		return errorResponse(res, 400, "Validation Error", ["Email address is required."]);
	}
	if (!password || typeof password !== "string") {
		return errorResponse(res, 400, "Validation Error", ["Password is required."]);
	}
	if (confirm !== true) {
		return errorResponse(res, 400, "Validation Error", ["You must confirm this action before proceeding."]);
	}
	const captchaValid = await verifyCaptchaToken(captchaToken, req.ip, "verify_account_deletion");
	if (!captchaValid) {
		return errorResponse(res, 400, "CAPTCHA verification failed", ["Please refresh the page and try again.", "Make sure that you provided a captchaToken in your request."]);
	}

	try {
		const { rows } = await pool.query(
			`SELECT id, email, preferred_name, full_name, metadata, password_hash FROM users
			 WHERE jsonb_extract_path_text(metadata, 'pendingAccountDeletion', 'token') = $1
			 LIMIT 1`,
			[token]
		);

		if (rows.length === 0) {
			return invalidConfirmationResponse(res);
		}

		const user = rows[0];
		const deletionConfirmationEmail = normalizeEmail(email);
		if (normalizeEmail(user.email) !== deletionConfirmationEmail) {
			logToFile("ACCOUNT_DELETE_CONFIRM", { status: "FAILURE", reason: "EMAIL_MISMATCH", user_id: user.id }, "warn");
			return invalidConfirmationResponse(res);
		}
		if (!user.password_hash) {
			return invalidConfirmationResponse(res);
		}
		const deletionPasswordMatches = await bcrypt.compare(password, user.password_hash);
		if (!deletionPasswordMatches) {
			logToFile("ACCOUNT_DELETE_CONFIRM", { status: "FAILURE", reason: "PASSWORD_MISMATCH", user_id: user.id }, "warn");
			return invalidConfirmationResponse(res);
		}
		const metadata = getSafeMetadata(user.metadata);
		const pending = metadata.pendingAccountDeletion;

		if (!pending || pending.token !== token) {
			return invalidConfirmationResponse(res);
		}

		if (!pending.expiresAt || new Date(pending.expiresAt) < new Date()) {
			const updatedMetadata = removeMetadataKey(metadata, "pendingAccountDeletion");
			await pool.query("UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1", [user.id, serializeMetadata(updatedMetadata)]);
			return errorResponse(res, 400, "Token expired", ["The confirmation token has expired. Please submit a new request from your account settings."]);
		}

		const updatedMetadata = removeMetadataKey(metadata, "pendingAccountDeletion");
		await pool.query(
			"UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1",
			[user.id, serializeMetadata(updatedMetadata)]
		);

		enqueueEmail({
			type: "account_delete_admin_notice",
			params: {
				userEmail: user.email,
				userFullName: user.full_name,
				userPreferredName: user.preferred_name,
				userId: user.id,
				requestedAt: pending.requestedAt || new Date().toISOString(),
				requestIp: req.ip
			},
			context: "ACCOUNT_DELETE_CONFIRMED",
			userId: user.id
		});

		logToFile("ACCOUNT_DELETE_CONFIRM", {
			status: "SUCCESS",
			user_id: user.id
		}, "info");

		return successResponse(
			res,
			200,
			"Your request has been forwarded to our support team.",
			{ disclaimer: "A member of our team will contact you on the confirmed email address to finalize the deletion." }
		);
	} catch (error) {
		logToFile("ACCOUNT_DELETE_CONFIRM", { status: "FAILURE", error_message: error.message }, "error");
		return errorResponse(res, 500, "Internal Server Error", ["An unexpected error occurred while validating the token."]);
	}
}

async function verifyEmailChange(req, res) {
	const token = extractTokenFromRequest(req);
	const { oldEmail, newEmail, password, captchaToken } = req.body || {};

	if (!token) {
		return errorResponse(res, 400, "Token required", ["A valid confirmation token must be provided."]);
	}
	if (!oldEmail || typeof oldEmail !== "string") {
		return errorResponse(res, 400, "Validation Error", ["Your current email address is required."]);
	}
	if (!newEmail || typeof newEmail !== "string") {
		return errorResponse(res, 400, "Validation Error", ["The new email address is required."]);
	}
	if (!password || typeof password !== "string") {
		return errorResponse(res, 400, "Validation Error", ["Current password is required."]);
	}
	const captchaValid = await verifyCaptchaToken(captchaToken, req.ip, "verify_email_change");
	if (!captchaValid) {
		return errorResponse(res, 400, "CAPTCHA verification failed", ["Please refresh the page and try again.", "Make sure that you provided a captchaToken in your request."]);
	}
	const normalizedOldEmail = normalizeEmail(oldEmail);
	const normalizedNewEmailInput = normalizeEmail(newEmail);

	try {
		const { rows } = await pool.query(
			`SELECT id, email, preferred_name, metadata, password_hash FROM users
			 WHERE jsonb_extract_path_text(metadata, 'pendingEmailChange', 'token') = $1
			 LIMIT 1`,
			[token]
		);

		if (rows.length === 0) {
			return invalidConfirmationResponse(res);
		}

		const user = rows[0];
		if (normalizeEmail(user.email) !== normalizedOldEmail) {
			logToFile("EMAIL_CHANGE_CONFIRM", { status: "FAILURE", reason: "OLD_EMAIL_MISMATCH", user_id: user.id }, "warn");
			return invalidConfirmationResponse(res);
		}
		const metadata = getSafeMetadata(user.metadata);
		const pending = metadata.pendingEmailChange;

		if (!pending || pending.token !== token) {
			return invalidConfirmationResponse(res);
		}

		if (!pending.expiresAt || new Date(pending.expiresAt) < new Date()) {
			const updatedMetadata = removeMetadataKey(metadata, "pendingEmailChange");
			await pool.query("UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1", [user.id, serializeMetadata(updatedMetadata)]);
			return errorResponse(res, 400, "Token expired", ["The confirmation token has expired. Please submit a new request from your account settings."]);
		}

		const pendingNewEmail = pending.newEmail;
		if (!pendingNewEmail) {
			const updatedMetadata = removeMetadataKey(metadata, "pendingEmailChange");
			await pool.query("UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1", [user.id, serializeMetadata(updatedMetadata)]);
			return errorResponse(res, 400, "Invalid request", ["The pending email change request is not valid. Please start again from your account settings."]);
		}

		if (!normalizedNewEmailInput) {
			return errorResponse(res, 400, "Validation Error", ["The new email address is required."]);
		}
		if (pendingNewEmail !== normalizedNewEmailInput) {
			logToFile("EMAIL_CHANGE_CONFIRM", { status: "FAILURE", reason: "NEW_EMAIL_MISMATCH", user_id: user.id }, "warn");
			return invalidConfirmationResponse(res);
		}
		if (!user.password_hash) {
			return invalidConfirmationResponse(res);
		}
		const emailChangePasswordMatches = await bcrypt.compare(password, user.password_hash);
		if (!emailChangePasswordMatches) {
			logToFile("EMAIL_CHANGE_CONFIRM", { status: "FAILURE", reason: "PASSWORD_MISMATCH", user_id: user.id }, "warn");
			return invalidConfirmationResponse(res);
		}

		const collision = await pool.query("SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1", [normalizedNewEmailInput, user.id]);
		if (collision.rows.length > 0) {
			const updatedMetadata = removeMetadataKey(metadata, "pendingEmailChange");
			await pool.query("UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1", [user.id, serializeMetadata(updatedMetadata)]);
			return invalidConfirmationResponse(res);
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const updatedMetadata = removeMetadataKey(metadata, "pendingEmailChange");
			await client.query(
				"UPDATE users SET email = $2, is_verified = true, metadata = $3::jsonb, updated_at = NOW() WHERE id = $1",
				[user.id, normalizedNewEmailInput, serializeMetadata(updatedMetadata)]
			);
			await client.query("DELETE FROM oauth_accounts WHERE user_id = $1", [user.id]);
			await client.query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false", [user.id]);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("EMAIL_CHANGE_CONFIRM", { status: "FAILURE", error_message: error.message, user_id: user.id }, "error");
			return errorResponse(res, 500, "Internal Server Error", ["An error occurred while updating the email address."]);
		} finally {
			client.release();
		}

		enqueueEmail({
			type: "email_change_confirmation",
			params: {
				toEmail: user.email,
				newEmail: normalizedNewEmailInput,
				preferredName: user.preferred_name
			},
			context: "EMAIL_CHANGE_CONFIRMED",
			userId: user.id
		});

		logToFile("EMAIL_CHANGE_CONFIRM", {
			status: "SUCCESS",
			user_id: user.id,
			new_email: normalizedNewEmailInput
		}, "info");

		return successResponse(
			res,
			200,
			"Your email address has been updated.",
			{ disclaimer: "Please log in with your new email address. You have been signed out on all devices." }
		);
	} catch (error) {
		logToFile("EMAIL_CHANGE_CONFIRM", { status: "FAILURE", error_message: error.message }, "error");
		return errorResponse(res, 500, "Internal Server Error", ["An unexpected error occurred while validating the token."]);
	}
}

router.post("/me/change-password", requiresAuth, authenticatedLimiter, emailCostLimiter, sensitiveActionLimiter, changePassword);

router.post("/me/verify-delete", emailCostLimiter, sensitiveActionLimiter, verifyAccountDisable);

router.post("/me/verify-account-deletion", emailCostLimiter, sensitiveActionLimiter, verifyAccountDeletion);

router.post("/me/verify-email-change", emailCostLimiter, sensitiveActionLimiter, verifyEmailChange);

module.exports = router;
