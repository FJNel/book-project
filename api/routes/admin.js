// All endpoints should be logged thoroughly with user ID and admin ID, along with action etc.

const express = require("express");
const router = express.Router();

const { requiresAuth, requireRole } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { successResponse, errorResponse } = require("../utils/response");
const pool = require("../db");

// Middleware to ensure the user is an authenticated admin
const adminAuth = [requiresAuth, authenticatedLimiter, requireRole(["admin"])];

const MAX_LANGUAGE_NAME_LENGTH = 100;

function normalizeText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
}

function normalizeLanguageName(value) {
	const trimmed = normalizeText(value);
	return trimmed.toLowerCase();
}

function validateLanguageName(name) {
	const errors = [];
	if (!name) {
		errors.push("Language name must be provided.");
		return errors;
	}
	if (name.length < 2 || name.length > MAX_LANGUAGE_NAME_LENGTH) {
		errors.push(`Language name must be between 2 and ${MAX_LANGUAGE_NAME_LENGTH} characters.`);
	}
	if (!/^[A-Za-z\s\-.'’]+$/.test(name)) {
		errors.push("Language name can only contain letters, spaces, hyphens, and apostrophes.");
	}
	return errors;
}

/**
 * A reusable handler for endpoints that are not yet implemented.
 * Returns a 300 status code as requested.
 */
const notImplemented = (req, res) => {
	const message = "This admin endpoint is not yet implemented.";
	logToFile("ADMIN_ENDPOINT", {
		status: "INFO",
		user_id: req.user?.id || null,
		ip: req.ip,
		user_agent: req.get("user-agent"),
		path: req.originalUrl,
		method: req.method,
		reason: message,
	}, "info");
	return errorResponse(res, 300, message, [message]);
}; // notImplemented

// `GET /admin/users/` - List all users (admin only, with pagination and filtering) and their appropriate information (from JSON body if provided)
router.get("/users", adminAuth, notImplemented); // router.get("/users")

// `POST /admin/users/` - Create a new user (admin only)
router.post("/users", adminAuth, notImplemented); // router.post("/users")

// `GET /admin/users/:id` - Get a specific user profile by ID (admin only)
// `GET /admin/users` with JSON body containing { id: userId } is also supported
router.get("/users/:id", adminAuth, notImplemented); // router.get("/users/:id")

// `PUT /admin/users/:id` - Update a specific user’s profile by ID (including role and email, admin only)
// `PUT /admin/users` with JSON body containing { id: userId, ...updates } is also supported
// If the email is changed, the user’s email_verified status should be set to false and a new verification email sent (with an extended validity of 24 hours)
// Admins can then use the verify endpoint to manually verify the email if needed
// The admin should not be able to change their own role to prevent accidental lockout
// Users should be notified via email of any changes made to their profile by an admin
router.put("/users/:id", adminAuth, notImplemented); // router.put("/users/:id")

// `DELETE /admin/users/:id` - Disable a user profile by ID (admin only)
// `DELETE /admin/users` with JSON body containing { id: userId } is also supported
// This means a soft delete - the user data remains in the database but the user cannot log in
// All sessions for the user should be invalidated upon disabling
// The user should receive an email notification that their account has been disabled by an admin
router.delete("/users/:id", adminAuth, notImplemented); // router.delete("/users/:id")

// `POST /admin/users/:id/enable` - Re-enable a disabled user profile by ID (admin only)
// `POST /admin/users/enable` with JSON body containing { id: userId } is also supported
// This allows the user to log in again and access their data
// The user should receive an email notification that their account has been re-enabled by an admin
router.post("/users/:id/enable", adminAuth, notImplemented); // router.post("/users/:id/enable")

// `POST /admin/users/:id/unverify` - Mark a user’s email as unverified by ID (admin only)
// `POST /admin/users/unverify` with JSON body containing { id: userId } is also supported
// This forces the user to re-verify their email address.
// The user should be notified via email that their email has been marked as unverified by an admin
// Accepts a required reason parameter in the JSON body for record-keeping
router.post("/users/:id/unverify", adminAuth, notImplemented); // router.post("/users/:id/unverify")

// `POST /admin/users/:id/verify` - Mark a user’s email as verified by ID (bypassing verification, admin only)
// `POST /admin/users/verify` with JSON body containing { id: userId } is also supported
// This allows the admin to manually verify a user’s email without requiring the user to click a link
// This should only be used in exceptional circumstances and the user should be notified via email that their email has been verified by an admin
// Accepts a required reason parameter in the JSON body for record-keeping
router.post("/users/:id/verify", adminAuth, notImplemented); // router.post("/users/:id/verify")

// `POST /admin/users/:id/send-verification` - Resend email verification email for a user (admin only)
// `POST /admin/users/send-verification` with JSON body containing { id: userId } is also supported
// Also accepts a duration parameter in minutes to extend the token validity (default 30 mins, max 1440 mins)
router.post("/users/:id/send-verification", adminAuth, notImplemented); // router.post("/users/:id/send-verification")

// `POST /admin/users/:id/reset-password` - Trigger a password reset for a user by ID (admin only)
// `POST /admin/users/reset-password` with JSON body containing { id: userId } is also supported
// Also accepts a duration parameter in minutes to extend the token validity (default 30 mins, max 1440 mins)
// Sends the user a password reset email with the generated token
router.post("/users/:id/reset-password", adminAuth, notImplemented); // router.post("/users/:id/reset-password")


// POST /admin/users/:id/sessions - List all active sessions for a user (admin only)
// POST /admin/users/sessions with JSON body containing { id: userId } is also supported
router.post("/users/:id/sessions", adminAuth, notImplemented); // router.post("/users/:id/sessions")

// `POST /admin/users/:id/force-logout` - Force logout a user (invalidate all sessions, admin only)
// `POST /admin/users/force-logout` with JSON body containing { id: userId } is also supported
// Can also specify a session fingerprint (or an array of fingerprints) to only invalidate that specific session(s)
router.post("/users/:id/force-logout", adminAuth, notImplemented); // router.post("/users/:id/force-logout")

// `POST /admin/users/:id/handle-account-deletion` - Permanently delete a user and all associated data after review (admin only)
// `POST /admin/users/handle-account-deletion` with JSON body containing { id: userId } is also supported
// This is a permanent action and cannot be undone. The endpoint should fail if the user has not gone through the account deletion review process (i.e. the user should have done POST /users/me/verify-account-deletion first)
// All associated data must be deleted from all tables, meaning that no artifacts of the user remain in the database
// The endpoint must log all actions taken, including what data was deleted, for auditing purposes
// The endpoint must accept a reason for deletion in the JSON body for record-keeping
// The endpoint must ensure that the admin performing the deletion is not deleting their own account
// This endpoint should have an increased rate limit to prevent abuse 
// The endpoint should accept a confirmation flag in the JSON body to prevent accidental deletions
// The endpoint should also accept userToBeDeletedEmail in the JSON body to confirm the email of the user being deleted matches
router.post("/users/:id/handle-account-deletion", adminAuth, notImplemented); // router.post("/users/:id/handle-account-deletion")

// `POST /admin/languages` - Add a new language (admin only)
router.post("/languages", adminAuth, async (req, res) => {
	const rawName = normalizeText(req.body?.name);
	const normalized = normalizeLanguageName(rawName);

	const errors = validateLanguageName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query(
			`SELECT id FROM languages WHERE name_normalized = $1`,
			[normalized]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Language already exists.", ["A language with this name already exists."]);
		}

		const result = await pool.query(
			`INSERT INTO languages (name, name_normalized, created_at, updated_at)
			 VALUES ($1, $2, NOW(), NOW())
			 RETURNING id, name, created_at, updated_at`,
			[rawName, normalized]
		);

		const row = result.rows[0];
		logToFile("LANGUAGE_CREATE", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			language_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 201, "Language created successfully.", {
			id: row.id,
			name: row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
	} catch (error) {
		logToFile("LANGUAGE_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the language."]);
	}
});

async function handleLanguageUpdate(req, res, id) {
	const rawName = normalizeText(req.body?.name);
	const normalized = normalizeLanguageName(rawName);
	const errors = validateLanguageName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query(
			`SELECT id FROM languages WHERE name_normalized = $1 AND id <> $2`,
			[normalized, id]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Language already exists.", ["A language with this name already exists."]);
		}

		const result = await pool.query(
			`UPDATE languages
			 SET name = $1, name_normalized = $2, updated_at = NOW()
			 WHERE id = $3
			 RETURNING id, name, created_at, updated_at`,
			[rawName, normalized, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Language not found.", ["The requested language could not be located."]);
		}

		const row = result.rows[0];
		logToFile("LANGUAGE_UPDATE", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			language_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Language updated successfully.", {
			id: row.id,
			name: row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
	} catch (error) {
		logToFile("LANGUAGE_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the language."]);
	}
}

// `PUT /admin/languages/:id` - Update a language (admin only)
router.put("/languages/:id", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.params.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageUpdate(req, res, id);
});

// `PUT /admin/languages` - Update a language using JSON body (admin only)
router.put("/languages", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.body?.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageUpdate(req, res, id);
});

async function handleLanguageDelete(req, res, id) {
	try {
		const result = await pool.query(
			`DELETE FROM languages WHERE id = $1`,
			[id]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Language not found.", ["The requested language could not be located."]);
		}

		logToFile("LANGUAGE_DELETE", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			language_id: id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Language deleted successfully.", { id });
	} catch (error) {
		logToFile("LANGUAGE_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the language."]);
	}
}

// `DELETE /admin/languages/:id` - Delete a language (admin only)
router.delete("/languages/:id", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.params.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageDelete(req, res, id);
});

// `DELETE /admin/languages` - Delete a language using JSON body (admin only)
router.delete("/languages", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.body?.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageDelete(req, res, id);
});


module.exports = router;
