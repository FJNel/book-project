const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { validateFullName, validatePreferredName } = require("../utils/validators");


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
		return errorResponse(res, 500, "Database Error", ["DATABASE_ERROR_GET_USER"]);
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
		return errorResponse(res, 500, "Database Error", ["DATABASE_ERROR_UPDATE_USER"]);
	}
}); // router.put("/me")


//Disable the currently authenticated user's profile (soft delete)
//This action revokes all refresh tokens to force logout
router.delete("/me", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const client = await pool.connect();

	try {
		await client.query("BEGIN");

		// Soft-delete the user
		const updateUser = await client.query(
			`UPDATE users SET is_disabled = true, updated_at = NOW() WHERE id = $1 AND is_disabled = false`,
			[userId]
		);

		// If no rows were affected, the user doesn't exist or is already disabled.
		if (updateUser.rowCount === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		}

		// Revoke all their refresh tokens to force logout
		await client.query(
			`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
			[userId]
		);

		await client.query("COMMIT");

		logToFile("DISABLE_PROFILE", { status: "SUCCESS", user_id: userId, ip: req.ip, user_agent: req.get("user-agent") }, "info");

		// Send confirmation email to user (pseudo-code, implement email sending as needed)

		return successResponse(res, 200, "Your account has been disabled.", {});
	} catch (e) {
		await client.query("ROLLBACK");
		logToFile("DISABLE_PROFILE_ERROR", { status: "FAILURE", error_message: e.message, user_id: userId, ip: req.ip, user_agent: req.get("user-agent") }, "error");
		return errorResponse(res, 500, "Database Error", ["DATABASE_ERROR_DISABLE_USER"]);
	} finally {
		client.release();
	}
}); // router.delete("/me")

router.post("/me/request-email-change", requiresAuth, authenticatedLimiter, (req, res) => {
	return errorResponse(res, 501, "This functionality has not been implemented yet.", ["This endpoint is reserved for future use."]);
}); // router.post("/me/request-email-change")

router.post("/me/request-account-deletion", requiresAuth, authenticatedLimiter, (req, res) => {
	return errorResponse(res, 501, "This functionality has not been implemented yet.", ["This endpoint is reserved for future use."]);
}); // router.post("/me/request-account-deletion")

module.exports = router;

/*
{
	"User profile retrieved successfully.": "User profile retrieved successfully.",
	"User profile updated successfully.": "User profile updated successfully.",
	"Your account has been disabled.": "Your account has been successfully disabled.",
	"User not found.": "User not found.",
	"The requested user record could not be located.": "The requested user profile could not be found or may be disabled.",
	"No changes were provided.": "No fields to update.",
	"Please provide at least one field to update.": "Please provide at least one field (fullName or preferredName) to update.",
	"DATABASE_ERROR_GET_USER": "An error occurred while retrieving the user profile.",
	"DATABASE_ERROR_UPDATE_USER": "An error occurred while updating the user profile.",
	"DATABASE_ERROR_DISABLE_USER": "An error occurred while disabling the user account."
}
*/
