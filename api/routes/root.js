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
	try {
		const dbStart = Date.now();
		await pool.query("SELECT 1");
		const dbLatencyMs = Date.now() - dbStart;
		const requiredColumns = [
			{ table: "users", column: "usage_lockout_until" },
			{ table: "authors", column: "deleted_at" },
			{ table: "publishers", column: "deleted_at" },
			{ table: "book_series", column: "deleted_at" },
			{ table: "books", column: "deleted_at" },
			{ table: "refresh_tokens", column: "ip_address" },
			{ table: "refresh_tokens", column: "user_agent" }
		];
		const schemaCheck = await pool.query(
			`SELECT table_name, column_name
			 FROM information_schema.columns
			 WHERE table_schema = 'public'
			   AND (table_name, column_name) IN (${requiredColumns.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(", ")})`,
			requiredColumns.flatMap((entry) => [entry.table, entry.column])
		);
		const existing = new Set(schemaCheck.rows.map((row) => `${row.table_name}.${row.column_name}`));
		const missingColumns = requiredColumns
			.filter((entry) => !existing.has(`${entry.table}.${entry.column}`))
			.map((entry) => ({ table: entry.table, column: entry.column }));

		if (missingColumns.length > 0) {
			logToFile("HEALTH_CHECK", {
				status: "FAILURE",
				reason: "SCHEMA_MISMATCH",
				missing_columns: missingColumns,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["Database schema is not ready."], {
				db: {
					healthy: false,
					schemaOk: false,
					missingColumns
				}
			});
		}
		logToFile("HEALTH_CHECK", {
			status: "SUCCESS",
			db_latency_ms: dbLatencyMs,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");
		return successResponse(res, 200, "OK", {
			status: "ok",
			timestamp: new Date().toISOString(),
			db: {
				healthy: true,
				schemaOk: true,
				latencyMs: dbLatencyMs
			}
		});
	} catch (error) {
		logToFile("HEALTH_CHECK", {
			status: "FAILURE",
			error_message: error.message,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Database connectivity failed."], {
			db: {
				healthy: false,
				sslMode: process.env.DB_SSL_MODE || (process.env.DB_SSL === "true" ? "require" : "disable")
			}
		});
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
			emailQueue: queueStats
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
