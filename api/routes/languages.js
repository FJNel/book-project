const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

// GET /languages - List available languages
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	try {
		const result = await pool.query(
			`SELECT id, name
			 FROM languages
			 ORDER BY name ASC`
		);

		logToFile("LANGUAGES_LIST", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			count: result.rows.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Languages retrieved successfully.", {
			languages: result.rows
		});
	} catch (error) {
		logToFile("LANGUAGES_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving languages."]);
	}
});

module.exports = router;
