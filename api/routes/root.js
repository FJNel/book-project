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
const { logToFile } = require("../utils/logging");

router.use((req, res, next) => {
	logToFile("ROOT_REQUEST", {
		user_id: req.user ? req.user.id : null,
		method: req.method,
		path: req.originalUrl || req.url,
		ip: req.ip,
		user_agent: req.get("user-agent"),
		query: req.query || {},
		request: req.body || {}
	}, "info");
	next();
});

router.use((req, res, next) => {
	const start = process.hrtime();
	res.on("finish", () => {
		const diff = process.hrtime(start);
		const durationMs = Number((diff[0] * 1e3 + diff[1] / 1e6).toFixed(2));
		logToFile("ROOT_RESPONSE", {
			user_id: req.user ? req.user.id : null,
			method: req.method,
			path: req.originalUrl || req.url,
			http_status: res.statusCode,
			duration_ms: durationMs,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");
	});
	next();
});

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
		logToFile("ROOT_STATUS", {
			status: "SUCCESS",
			path: "/",
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");
		return successResponse(res, 200, "The API is working!", {
			timestamp,
			api_documentation_url: config.api.docsUrl
		//   db_documentation_url: `${config.api.baseUrl}/db_documentation.html`,
		});
}); // router.get("/")

// GET /health - Basic health check
router.get("/health", async (req, res) => {
	const timeoutMs = 2500;
	let responded = false;
	const respondOnce = (status, payload) => {
		if (responded) return;
		responded = true;
		res.status(status).json(payload);
	};
	const t = setTimeout(() => {
		// logToFile("HEALTH_CHECK", {
		// 	status: "TIMEOUT",
		// 	ip: req.ip,
		// 	user_agent: req.get("user-agent")
		// }, "warn");
		respondOnce(503, { ok: false, error: "Health check timed out" });
	}, timeoutMs);

	try {
		// logToFile("HEALTH_CHECK", {
		// 	status: "START",
		// 	ip: req.ip,
		// 	user_agent: req.get("user-agent")
		// }, "info");
		const skipDbCheck = process.env.HEALTHCHECK_SKIP_DB === "true";
		if (!skipDbCheck) {
			// logToFile("HEALTH_CHECK", {
			// 	status: "DB_START",
			// 	ip: req.ip,
			// 	user_agent: req.get("user-agent")
			// }, "info");
			const dbStart = Date.now();
			await Promise.race([
				pool.query("SELECT 1"),
				new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 1500))
			]);
			// logToFile("HEALTH_CHECK", {
			// 	status: "DB_END",
			// 	db_latency_ms: Date.now() - dbStart,
			// 	ip: req.ip,
			// 	user_agent: req.get("user-agent")
			// }, "info");
		} else {
			// logToFile("HEALTH_CHECK", {
			// 	status: "DB_SKIPPED",
			// 	reason: "SKIP_DB",
			// 	ip: req.ip,
			// 	user_agent: req.get("user-agent")
			// }, "warn");
		}
		// logToFile("HEALTH_CHECK", {
		// 	status: "SUCCESS",
		// 	ip: req.ip,
		// 	user_agent: req.get("user-agent")
		// }, "info");
		respondOnce(200, { ok: true });
	} catch (error) {
		// logToFile("HEALTH_CHECK", {
		// 	status: "FAILURE",
		// 	error_message: error.message,
		// 	ip: req.ip,
		// 	user_agent: req.get("user-agent")
		// }, "error");
		respondOnce(500, { ok: false, error: "Health check failed" });
	} finally {
		clearTimeout(t);
	}
});

// GET /status - Admin status check (db + email queue)
router.get("/status", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	try {
		const dbStart = Date.now();
		await pool.query("SELECT 1");
		const dbLatencyMs = Date.now() - dbStart;

		const queueStats = getQueueStats();
		logToFile("STATUS_CHECK", {
			status: "SUCCESS",
			user_id: req.user ? req.user.id : null,
			db_latency_ms: dbLatencyMs,
			queue_size: queueStats?.queueLength ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");
		return successResponse(res, 200, "Status retrieved successfully.", {
			status: "ok",
			db: {
				healthy: true,
				latencyMs: dbLatencyMs
			},
			emailQueue: queueStats,
			user: {
				id: req.user ? req.user.id : null,
				email: req.user ? req.user.email : null
			}
		});
	} catch (error) {
		logToFile("STATUS_CHECK", {
			status: "FAILURE",
			user_id: req.user ? req.user.id : null,
			error_message: error.message,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve status at this time."]);
	}
});

// GET /rate-limits - Show remaining rate limit details
router.get("/rate-limits", requiresAuth, authenticatedLimiter, (req, res) => {
	const rate = req.rateLimit || {};
	logToFile("RATE_LIMIT_STATUS", {
		status: "SUCCESS",
		user_id: req.user ? req.user.id : null,
		limit: rate.limit ?? null,
		remaining: rate.remaining ?? null,
		resetTime: rate.resetTime ?? null,
		ip: req.ip,
		user_agent: req.get("user-agent")
	}, "info");
	return successResponse(res, 200, "Rate limit status retrieved successfully.", {
		limit: rate.limit ?? null,
		remaining: rate.remaining ?? null,
		resetTime: rate.resetTime ?? null
	});
});

module.exports = router;
