const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

// GET /tags - List all tags for the authenticated user
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;

	try {
		const result = await pool.query(
			`SELECT id, name, created_at, updated_at
			 FROM tags
			 WHERE user_id = $1
			 ORDER BY name ASC`,
			[userId]
		);

		const payload = result.rows.map((row) => ({
			id: row.id,
			name: row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		}));

		logToFile("TAG_LIST", {
			status: "SUCCESS",
			user_id: userId,
			count: payload.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Tags retrieved successfully.", { tags: payload });
	} catch (error) {
		logToFile("TAG_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving tags."]);
	}
});

module.exports = router;
