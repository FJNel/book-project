const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { validateFullName, validatePreferredName, validateEmail } = require("../utils/validators");
const crypto = require("crypto");
const { enqueueEmail } = require("../utils/email-queue");

const ACCOUNT_DISABLE_TOKEN_EXPIRY_MINUTES = 60;
const ACCOUNT_DELETE_TOKEN_EXPIRY_MINUTES = 60;
const EMAIL_CHANGE_TOKEN_EXPIRY_MINUTES = 60;

function generateActionToken() {
	return crypto.randomBytes(32).toString("hex");
}

function addMinutesToNow(minutes) {
	return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function getSafeMetadata(rawMetadata) {
	return rawMetadata && typeof rawMetadata === "object" ? { ...rawMetadata } : {};
}

function serializeMetadata(metadataObject) {
	const normalized = metadataObject && Object.keys(metadataObject).length > 0 ? metadataObject : {};
	return normalized;
}

function removeMetadataKey(metadata, key) {
	const clone = getSafeMetadata(metadata);
	delete clone[key];
	return clone;
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
		RETURNING id, email, full_name, preferred_name, role, is_verified, created_at, updated_at;
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
router.delete("/me", requiresAuth, authenticatedLimiter, async (req, res) => {
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

		const metadata = getSafeMetadata(user.metadata);
		const token = generateActionToken();
		const expiresAt = addMinutesToNow(ACCOUNT_DISABLE_TOKEN_EXPIRY_MINUTES);

		metadata.pendingAccountDisable = {
			token,
			expiresAt,
			requestedAt: new Date().toISOString()
		};

		await pool.query(
			"UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1",
			[userId, serializeMetadata(metadata)]
		);

		enqueueEmail({
			type: "account_disable_verification",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				token,
				expiresIn: ACCOUNT_DISABLE_TOKEN_EXPIRY_MINUTES
			},
			context: "ACCOUNT_DISABLE_REQUEST",
			userId
		});

		logToFile("ACCOUNT_DISABLE_REQUEST", {
			status: "INFO",
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

router.post("/me/request-email-change", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	let { newEmail } = req.body || {};
	newEmail = typeof newEmail === "string" ? newEmail.trim() : "";
	const normalizedEmail = newEmail.toLowerCase();

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

		const existingEmail = await pool.query("SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1", [normalizedEmail, userId]);
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

		const metadata = getSafeMetadata(user.metadata);
		const token = generateActionToken();
		const expiresAt = addMinutesToNow(EMAIL_CHANGE_TOKEN_EXPIRY_MINUTES);
		metadata.pendingEmailChange = {
			token,
			newEmail: normalizedEmail,
			expiresAt,
			requestedAt: new Date().toISOString()
		};

		await pool.query(
			"UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1",
			[userId, serializeMetadata(metadata)]
		);

		enqueueEmail({
			type: "email_change_verification",
			params: {
				toEmail: newEmail,
				preferredName: user.preferred_name,
				token,
				expiresIn: EMAIL_CHANGE_TOKEN_EXPIRY_MINUTES
			},
			context: "EMAIL_CHANGE_REQUEST",
			userId
		});

		logToFile("EMAIL_CHANGE_REQUEST", {
			status: "SUCCESS",
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
		const metadata = getSafeMetadata(user.metadata);
		const token = generateActionToken();
		const expiresAt = addMinutesToNow(ACCOUNT_DELETE_TOKEN_EXPIRY_MINUTES);
		metadata.pendingAccountDeletion = {
			token,
			expiresAt,
			requestedAt: new Date().toISOString()
		};

		await pool.query(
			"UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1",
			[userId, serializeMetadata(metadata)]
		);

		enqueueEmail({
			type: "account_delete_verification",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				token,
				expiresIn: ACCOUNT_DELETE_TOKEN_EXPIRY_MINUTES
			},
			context: "ACCOUNT_DELETE_REQUEST",
			userId
		});

		logToFile("ACCOUNT_DELETE_REQUEST", {
			status: "INFO",
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

router.delete("/me/request-account-deletion", requiresAuth, authenticatedLimiter, initiateAccountDeletionRequest);
router.post("/me/request-account-deletion", requiresAuth, authenticatedLimiter, initiateAccountDeletionRequest); // backward compatibility

async function verifyAccountDisable(req, res) {
	const token = extractTokenFromRequest(req);
	if (!token) {
		return errorResponse(res, 400, "Token required", ["A valid confirmation token must be provided."]);
	}

	try {
		const { rows } = await pool.query(
			`SELECT id, email, preferred_name, metadata FROM users
			 WHERE jsonb_extract_path_text(metadata, 'pendingAccountDisable', 'token') = $1
			 LIMIT 1`,
			[token]
		);

		if (rows.length === 0) {
			return errorResponse(res, 400, "Invalid or expired token", ["The confirmation token is invalid or has already been used."]);
		}

		const user = rows[0];
		const metadata = getSafeMetadata(user.metadata);
		const pending = metadata.pendingAccountDisable;
		if (!pending || pending.token !== token) {
			return errorResponse(res, 400, "Invalid or expired token", ["The confirmation token is invalid or has already been used."]);
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
	if (!token) {
		return errorResponse(res, 400, "Token required", ["A valid confirmation token must be provided."]);
	}

	try {
		const { rows } = await pool.query(
			`SELECT id, email, preferred_name, full_name, metadata FROM users
			 WHERE jsonb_extract_path_text(metadata, 'pendingAccountDeletion', 'token') = $1
			 LIMIT 1`,
			[token]
		);

		if (rows.length === 0) {
			return errorResponse(res, 400, "Invalid or expired token", ["The confirmation token is invalid or has already been used."]);
		}

		const user = rows[0];
		const metadata = getSafeMetadata(user.metadata);
		const pending = metadata.pendingAccountDeletion;

		if (!pending || pending.token !== token) {
			return errorResponse(res, 400, "Invalid or expired token", ["The confirmation token is invalid or has already been used."]);
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
	if (!token) {
		return errorResponse(res, 400, "Token required", ["A valid confirmation token must be provided."]);
	}

	try {
		const { rows } = await pool.query(
			`SELECT id, email, preferred_name, metadata FROM users
			 WHERE jsonb_extract_path_text(metadata, 'pendingEmailChange', 'token') = $1
			 LIMIT 1`,
			[token]
		);

		if (rows.length === 0) {
			return errorResponse(res, 400, "Invalid or expired token", ["The confirmation token is invalid or has already been used."]);
		}

		const user = rows[0];
		const metadata = getSafeMetadata(user.metadata);
		const pending = metadata.pendingEmailChange;

		if (!pending || pending.token !== token) {
			return errorResponse(res, 400, "Invalid or expired token", ["The confirmation token is invalid or has already been used."]);
		}

		if (!pending.expiresAt || new Date(pending.expiresAt) < new Date()) {
			const updatedMetadata = removeMetadataKey(metadata, "pendingEmailChange");
			await pool.query("UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1", [user.id, serializeMetadata(updatedMetadata)]);
			return errorResponse(res, 400, "Token expired", ["The confirmation token has expired. Please submit a new request from your account settings."]);
		}

		const newEmail = pending.newEmail;
		if (!newEmail) {
			const updatedMetadata = removeMetadataKey(metadata, "pendingEmailChange");
			await pool.query("UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1", [user.id, serializeMetadata(updatedMetadata)]);
			return errorResponse(res, 400, "Invalid request", ["The pending email change request is not valid. Please start again from your account settings."]);
		}

		const collision = await pool.query("SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1", [newEmail.toLowerCase(), user.id]);
		if (collision.rows.length > 0) {
			const updatedMetadata = removeMetadataKey(metadata, "pendingEmailChange");
			await pool.query("UPDATE users SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1", [user.id, serializeMetadata(updatedMetadata)]);
			return errorResponse(res, 400, "Email unavailable", ["The new email address is no longer available. Please submit a new request with a different address."]);
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const updatedMetadata = removeMetadataKey(metadata, "pendingEmailChange");
			await client.query(
				"UPDATE users SET email = $2, is_verified = true, metadata = $3::jsonb, updated_at = NOW() WHERE id = $1",
				[user.id, newEmail, serializeMetadata(updatedMetadata)]
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
				newEmail,
				preferredName: user.preferred_name
			},
			context: "EMAIL_CHANGE_CONFIRMED",
			userId: user.id
		});

		logToFile("EMAIL_CHANGE_CONFIRM", {
			status: "SUCCESS",
			user_id: user.id,
			new_email: newEmail
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

router.post("/me/verify-delete", verifyAccountDisable);
router.get("/me/verify-delete", verifyAccountDisable);

router.post("/me/verify-account-deletion", verifyAccountDeletion);
router.get("/me/verify-account-deletion", verifyAccountDeletion);

router.post("/me/verify-email-change", verifyEmailChange);
router.get("/me/verify-email-change", verifyEmailChange);

module.exports = router;
