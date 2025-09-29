	const express = require("express");
	const router = express.Router();

	const pool = require("../db");
	const { successResponse, errorResponse } = require("../utils/response");
	const { requiresAuth } = require("../utils/jwt");
	const { logUserAction, logToFile } = require("../utils/logging");
	const { validateFullName, validatePreferredName } = require("../utils/validators");

//Retrieve the profile information of the currently authenticated user
router.get("/me", requiresAuth, async (req, res) => {
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
		//Also fetch associated OAuth providers
		const result = await pool.query(query, [userId]);

		// If no user found or user is disabled
		if (result.rows.length === 0) {
			await logUserAction({
				userId,
				action: "GET_PROFILE",
				status: "FAILURE",
				ip: req.ip,
				userAgent: req.get("user-agent"),
				errorMessage: "User not found or disabled",
				details: {},
			});
			logToFile("GET_PROFILE", { reason: "NOT_FOUND", user_id: userId }, "warn");
			return errorResponse(res, 404, "USER_NOT_FOUND", ["USER_NOT_FOUND_DETAIL"]);
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
		await logUserAction({
		userId,
			action: "GET_PROFILE",
			status: "SUCCESS",
			ip: req.ip,
			userAgent: req.get("user-agent"),
			details: {},
		});

		// Return user profile
		logToFile("GET_PROFILE", { user_id: userId, outcome: "SUCCESS" }, "info");
		return successResponse(res, 200, "USER_RETRIEVED_SUCCESS", userProfile);
	} catch (e) {
			await logUserAction({
			userId,
			action: "GET_PROFILE",
			status: "FAILURE",
			ip: req.ip,
			userAgent: req.get("user-agent"),
			errorMessage: e.message,
			details: {},
		});
		logToFile("GET_PROFILE_ERROR", { error: e.message, user_id: userId }, "error");
		return errorResponse(res, 500, "DATABASE_ERROR", ["DATABASE_ERROR_GET_USER"]);
	}
});


// Update the profile information of the currently authenticated user
// Only fullName and preferredName can be updated
router.put("/me", requiresAuth, async (req, res) => {
	//Get the user ID from the authenticated request
	const userId = req.user.id;
	//Extract fields to update from the request body
	const { fullName, preferredName } = req.body;

	//Validation
	const errors = [];
	if (fullName !== undefined) {
		errors.push(...validateFullName(fullName));
	}
	if (preferredName !== undefined) {
		errors.push(...validatePreferredName(preferredName));
	}

	//If validation errors exist, log and return them
	if (errors.length > 0) {
		await logUserAction({
		userId,
		action: "UPDATE_PROFILE",
		status: "FAILURE",
		ip: req.ip,
		userAgent: req.get("user-agent"),
		errorMessage: "Validation Error",
		details: { errors },
		});
		logToFile("UPDATE_PROFILE", { reason: "VALIDATION", user_id: userId, errors }, "warn");
		return errorResponse(res, 400, "VALIDATION_ERROR", errors);
	}
	
	//Build the update query dynamically
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
		return errorResponse(res, 400, "NOTHING_TO_UPDATE", ["NOTHING_TO_UPDATE_DETAIL"]);
	}
	
	//Construct the final SQL query
	const queryText = `
		UPDATE users
		SET ${updateFields.join(", ")}, updated_at = NOW()
		WHERE id = $1 AND is_disabled = false
		RETURNING id, email, full_name, preferred_name, role, is_verified, created_at, updated_at;
	`;

	try {
		//Execute the update query
		const result = await pool.query(queryText, queryParams);
		
		if (result.rows.length === 0) {
			//No user found or user is disabled
			return errorResponse(res, 404, "USER_NOT_FOUND", ["USER_NOT_FOUND_DETAIL"]);
		}

		//Construct the updated user profile response
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
		
		await logUserAction({
		userId,
		action: "USER_UPDATED_PROFILE",
		status: "SUCCESS",
		ip: req.ip,
		userAgent: req.get("user-agent"),
		details: { updatedFields: { fullName, preferredName } },
		});
		logToFile("UPDATE_PROFILE", { user_id: userId, outcome: "SUCCESS" }, "info");

		return successResponse(res, 200, "USER_UPDATED_SUCCESS", updatedUser);
	} catch (e) {
		await logUserAction({
		userId,
		action: "UPDATE_PROFILE",
		status: "FAILURE",
		ip: req.ip,
		userAgent: req.get("user-agent"),
		errorMessage: e.message,
		details: {},
		});
		logToFile("UPDATE_PROFILE_ERROR", { error: e.message, user_id: userId }, "error");
		return errorResponse(res, 500, "DATABASE_ERROR", ["DATABASE_ERROR_UPDATE_USER"]);
	}
});


//Disable the currently authenticated user's profile (soft delete)
//This action revokes all refresh tokens to force logout
router.delete("/me", requiresAuth, async (req, res) => {
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
            return errorResponse(res, 404, "USER_NOT_FOUND", ["USER_NOT_FOUND_DETAIL"]);
        }

        // Revoke all their refresh tokens to force logout
        await client.query(
            `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`,
            [userId]
        );
        
        await client.query("COMMIT");

        await logUserAction({
            userId,
            action: "DISABLE_PROFILE",
            status: "SUCCESS",
            ip: req.ip,
            userAgent: req.get("user-agent"),
            details: {},
        });
        logToFile("DISABLE_PROFILE", { user_id: userId, outcome: "SUCCESS" }, "info");

        return successResponse(res, 200, "USER_DISABLED_SUCCESS", {});

    } catch (e) {
        await client.query("ROLLBACK");
        await logUserAction({
            userId,
            action: "DISABLE_PROFILE",
            status: "FAILURE",
            ip: req.ip,
            userAgent: req.get("user-agent"),
            errorMessage: e.message,
            details: {},
        });
        logToFile("DISABLE_PROFILE_ERROR", { error: e.message, user_id: userId }, "error");
        return errorResponse(res, 500, "DATABASE_ERROR", ["DATABASE_ERROR_DISABLE_USER"]);
    } finally {
        client.release();
    }
});


module.exports = router;

/*
{
    "USER_RETRIEVED_SUCCESS": "User profile retrieved successfully.",
    "USER_UPDATED_SUCCESS": "User profile updated successfully.",
    "USER_DISABLED_SUCCESS": "Your account has been successfully disabled.",
    "USER_NOT_FOUND": "User not found.",
    "USER_NOT_FOUND_DETAIL": "The requested user profile could not be found or may be disabled.",
    "NOTHING_TO_UPDATE": "No fields to update.",
    "NOTHING_TO_UPDATE_DETAIL": "Please provide at least one field (fullName or preferredName) to update.",
    "DATABASE_ERROR_GET_USER": "An error occurred while retrieving the user profile.",
    "DATABASE_ERROR_UPDATE_USER": "An error occurred while updating the user profile.",
    "DATABASE_ERROR_DISABLE_USER": "An error occurred while disabling the user account."
}
*/