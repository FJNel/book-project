//The root route is used to display a message stating that the API is working as expected
//It also provides a link to the API and database documentation.

const express = require("express");
const router = express.Router();

//Import standard response handlers
const { successResponse, errorResponse } = require("../utils/response");
const config = require("../config");
const pool = require("../db");
const { requiresAuth, requireRole } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { getQueueStats } = require("../utils/email-queue");

router.get("/", (req, res) => {
		const now = new Date();
		const timestamp = now.toLocaleString("en-GB", {
			hour12: false,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		return successResponse(res, 200, "The API is working!", {
			timestamp,
			api_documentation_url: config.api.docsUrl
		//   db_documentation_url: `${config.api.baseUrl}/db_documentation.html`,
		});
}); // router.get("/")

// GET /health - Basic health check
router.get("/health", (req, res) => {
	return successResponse(res, 200, "OK", {
		status: "ok",
		timestamp: new Date().toISOString()
	});
});

// GET /status - Admin status check (db + email queue)
router.get("/status", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	try {
		const dbStart = Date.now();
		await pool.query("SELECT 1");
		const dbLatencyMs = Date.now() - dbStart;

		const queueStats = getQueueStats();
		return successResponse(res, 200, "Status retrieved successfully.", {
			status: "ok",
			db: {
				healthy: true,
				latencyMs: dbLatencyMs
			},
			emailQueue: queueStats
		});
	} catch (error) {
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve status at this time."]);
	}
});

// GET /rate-limits - Show remaining rate limit details
router.get("/rate-limits", requiresAuth, authenticatedLimiter, (req, res) => {
	const rate = req.rateLimit || {};
	return successResponse(res, 200, "Rate limit status retrieved successfully.", {
		limit: rate.limit ?? null,
		remaining: rate.remaining ?? null,
		resetTime: rate.resetTime ?? null
	});
});

module.exports = router;
