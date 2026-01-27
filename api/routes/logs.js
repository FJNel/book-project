const express = require("express");

const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth, requireRole } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_LIMIT = 1000;

function normalizeText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
}

function parseOptionalInt(value, fieldLabel, { min = 0, max = null } = {}) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) {
		return { error: `${fieldLabel} must be an integer.` };
	}
	if (parsed < min || (max !== null && parsed > max)) {
		const range = max !== null ? `between ${min} and ${max}` : `greater than or equal to ${min}`;
		return { error: `${fieldLabel} must be ${range}.` };
	}
	return { value: parsed };
}

function parseDate(value, fieldLabel) {
	if (!value) return { value: null };
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) return { error: `${fieldLabel} must be a valid ISO 8601 date.` };
	return { value: new Date(parsed).toISOString() };
}

function buildFilters(params = {}) {
	const filters = [];
	const values = [];
	let idx = 1;

	if (normalizeText(params.actorType)) {
		filters.push(`actor_type = $${idx++}`);
		values.push(normalizeText(params.actorType));
	}
	if (Number.isInteger(Number.parseInt(params.userId, 10))) {
		filters.push(`user_id = $${idx++}`);
		values.push(Number.parseInt(params.userId, 10));
	}
	if (normalizeText(params.userEmail)) {
		filters.push(`user_email ILIKE $${idx++}`);
		values.push(`%${normalizeText(params.userEmail)}%`);
	}
	if (Number.isInteger(Number.parseInt(params.apiKeyId, 10))) {
		filters.push(`api_key_id = $${idx++}`);
		values.push(Number.parseInt(params.apiKeyId, 10));
	}
	if (normalizeText(params.apiKeyLabel)) {
		filters.push(`api_key_label ILIKE $${idx++}`);
		values.push(`%${normalizeText(params.apiKeyLabel)}%`);
	}
	if (normalizeText(params.apiKeyPrefix)) {
		filters.push(`api_key_prefix = $${idx++}`);
		values.push(`%${normalizeText(params.apiKeyPrefix)}%`);
	}
	if (normalizeText(params.method)) {
		filters.push(`UPPER(method) = $${idx++}`);
		values.push(normalizeText(params.method).toUpperCase());
	}
	if (normalizeText(params.path)) {
		filters.push(`path ILIKE $${idx++}`);
		values.push(`%${normalizeText(params.path)}%`);
	}
	if (normalizeText(params.level)) {
		filters.push(`level = $${idx++}`);
		values.push(normalizeText(params.level));
	}
	if (normalizeText(params.category)) {
		filters.push(`category = $${idx++}`);
		values.push(normalizeText(params.category));
	}
	if (params.statusCodeMin || params.statusCodeMax) {
		const min = Number.isInteger(Number.parseInt(params.statusCodeMin, 10))
			? Number.parseInt(params.statusCodeMin, 10)
			: 100;
		const max = Number.isInteger(Number.parseInt(params.statusCodeMax, 10))
			? Number.parseInt(params.statusCodeMax, 10)
			: 599;
		filters.push(`status_code BETWEEN $${idx++} AND $${idx++}`);
		values.push(min, max);
	}
	if (normalizeText(params.search)) {
		filters.push(`(
			CAST(correlation_id AS TEXT) ILIKE $${idx}
			OR path ILIKE $${idx}
			OR route_pattern ILIKE $${idx}
			OR user_email ILIKE $${idx}
			OR api_key_label ILIKE $${idx}
			OR error_summary ILIKE $${idx}
		)`);
		values.push(`%${normalizeText(params.search)}%`);
		idx += 1;
	}
	if (params.startDate || params.endDate) {
		const start = params.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const end = params.endDate || new Date().toISOString();
		filters.push(`logged_at BETWEEN $${idx++} AND $${idx++}`);
		values.push(start, end);
	}

	return { filters, values, idx };
}

router.get("/", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const { value: limit, error: limitError } = parseOptionalInt(params.limit, "limit", { min: 1, max: MAX_LIMIT });
	const { value: offset, error: offsetError } = parseOptionalInt(params.offset, "offset", { min: 0, max: null });
	const { value: startDate, error: startError } = parseDate(params.startDate, "startDate");
	const { value: endDate, error: endError } = parseDate(params.endDate, "endDate");

	const errors = [];
	if (limitError) errors.push(limitError);
	if (offsetError) errors.push(offsetError);
	if (startError) errors.push(startError);
	if (endError) errors.push(endError);
	if (errors.length > 0) {
		logToFile("LOGS_QUERY", {
			status: "VALIDATION_FAILED",
			admin_id: req.user ? req.user.id : null,
			errors,
			filters: params
		}, "warn");
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const { filters, values, idx } = buildFilters({
		...params,
		startDate,
		endDate
	});
	const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

	try {
		const countResult = await pool.query(
			`SELECT COUNT(*)::int AS total FROM request_logs ${whereClause}`,
			values
		);
		const total = countResult.rows[0]?.total ?? 0;
		const logResult = await pool.query(
			`SELECT *
			 FROM request_logs
			 ${whereClause}
			 ORDER BY logged_at DESC
			 LIMIT $${idx} OFFSET $${idx + 1}`,
			[...values, limit ?? 50, offset ?? 0]
		);

		logToFile("LOGS_QUERY", {
			status: "SUCCESS",
			admin_id: req.user ? req.user.id : null,
			count: logResult.rows.length,
			total,
			filters: params
		}, "info");

		return successResponse(res, 200, "Logs retrieved successfully.", {
			total,
			count: logResult.rows.length,
			limit: limit ?? 50,
			offset: offset ?? 0,
			logs: logResult.rows
		});
	} catch (error) {
		logToFile("LOGS_QUERY", {
			status: "FAILURE",
			admin_id: req.user ? req.user.id : null,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve logs at this time."]);
	}
});

router.post("/search", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const params = req.body || {};
	const { value: limit, error: limitError } = parseOptionalInt(params.limit, "limit", { min: 1, max: MAX_LIMIT });
	const { value: offset, error: offsetError } = parseOptionalInt(params.offset, "offset", { min: 0, max: null });
	const { value: startDate, error: startError } = parseDate(params.startDate, "startDate");
	const { value: endDate, error: endError } = parseDate(params.endDate, "endDate");

	const errors = [];
	if (limitError) errors.push(limitError);
	if (offsetError) errors.push(offsetError);
	if (startError) errors.push(startError);
	if (endError) errors.push(endError);
	if (errors.length > 0) {
		logToFile("LOGS_QUERY", {
			status: "VALIDATION_FAILED",
			admin_id: req.user ? req.user.id : null,
			errors,
			filters: params
		}, "warn");
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const { filters, values, idx } = buildFilters({
		...params,
		startDate,
		endDate
	});
	const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

	try {
		const countResult = await pool.query(
			`SELECT COUNT(*)::int AS total FROM request_logs ${whereClause}`,
			values
		);
		const total = countResult.rows[0]?.total ?? 0;
		const logResult = await pool.query(
			`SELECT *
			 FROM request_logs
			 ${whereClause}
			 ORDER BY logged_at DESC
			 LIMIT $${idx} OFFSET $${idx + 1}`,
			[...values, limit ?? 50, offset ?? 0]
		);

		logToFile("LOGS_QUERY", {
			status: "SUCCESS",
			admin_id: req.user ? req.user.id : null,
			count: logResult.rows.length,
			total,
			filters: params
		}, "info");

		return successResponse(res, 200, "Logs retrieved successfully.", {
			total,
			count: logResult.rows.length,
			limit: limit ?? 50,
			offset: offset ?? 0,
			logs: logResult.rows
		});
	} catch (error) {
		logToFile("LOGS_QUERY", {
			status: "FAILURE",
			admin_id: req.user ? req.user.id : null,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve logs at this time."]);
	}
});

router.get("/log_types", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT DISTINCT category FROM request_logs WHERE category IS NOT NULL ORDER BY category ASC"
		);
		const list = result.rows.map((row) => row.category);
		logToFile("LOGS_TYPES", {
			status: "SUCCESS",
			admin_id: req.user ? req.user.id : null,
			count: list.length
		}, "info");
		return successResponse(res, 200, "Log types retrieved successfully.", {
			count: list.length,
			logTypes: list
		});
	} catch (error) {
		logToFile("LOGS_TYPES", {
			status: "FAILURE",
			admin_id: req.user ? req.user.id : null,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve log types at this time."]);
	}
});

router.get("/levels", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT DISTINCT level FROM request_logs WHERE level IS NOT NULL ORDER BY level ASC"
		);
		const list = result.rows.map((row) => row.level);
		logToFile("LOGS_LEVELS", {
			status: "SUCCESS",
			admin_id: req.user ? req.user.id : null,
			count: list.length
		}, "info");
		return successResponse(res, 200, "Log levels retrieved successfully.", {
			count: list.length,
			levels: list
		});
	} catch (error) {
		logToFile("LOGS_LEVELS", {
			status: "FAILURE",
			admin_id: req.user ? req.user.id : null,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve log levels at this time."]);
	}
});

router.get("/statuses", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT DISTINCT status_code FROM request_logs WHERE status_code IS NOT NULL ORDER BY status_code ASC"
		);
		const list = result.rows.map((row) => row.status_code);
		logToFile("LOGS_STATUSES", {
			status: "SUCCESS",
			admin_id: req.user ? req.user.id : null,
			count: list.length
		}, "info");
		return successResponse(res, 200, "Log statuses retrieved successfully.", {
			count: list.length,
			statuses: list
		});
	} catch (error) {
		logToFile("LOGS_STATUSES", {
			status: "FAILURE",
			admin_id: req.user ? req.user.id : null,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve log statuses at this time."]);
	}
});

router.post("/export", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const params = req.body || {};
	const format = normalizeText(params.format || "json").toLowerCase();
	const { value: startDate, error: startError } = parseDate(params.startDate, "startDate");
	const { value: endDate, error: endError } = parseDate(params.endDate, "endDate");
	if (startError || endError) {
		return errorResponse(res, 400, "Validation Error", [startError, endError].filter(Boolean));
	}
	const { filters, values } = buildFilters({
		...params,
		startDate,
		endDate
	});
	const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

	try {
		const result = await pool.query(
			`SELECT * FROM request_logs ${whereClause} ORDER BY logged_at DESC`,
			values
		);

		if (format === "csv") {
			const rows = result.rows;
			const headers = Object.keys(rows[0] || {});
			const lines = [headers.join(",")];
			rows.forEach((row) => {
				const line = headers.map((key) => {
					const value = row[key];
					if (value === null || value === undefined) return "";
					const safe = typeof value === "object" ? JSON.stringify(value) : String(value);
					return `"${safe.replace(/"/g, '""')}"`;
				});
				lines.push(line.join(","));
			});
			res.setHeader("Content-Type", "text/csv");
			res.setHeader("Content-Disposition", "attachment; filename=logs-export.csv");
			return res.send(lines.join("\n"));
		}

		return successResponse(res, 200, "Log export ready.", { logs: result.rows });
	} catch (error) {
		logToFile("LOGS_EXPORT", {
			status: "FAILURE",
			admin_id: req.user ? req.user.id : null,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to export logs at this time."]);
	}
});

router.get("/log-types", requiresAuth, authenticatedLimiter, requireRole(["admin"]), (req, res) => {
	return res.redirect(308, "/logs/log_types");
});

router.get("/:id", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const id = Number.parseInt(req.params.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Log id must be a valid integer."]);
	}
	try {
		const result = await pool.query("SELECT * FROM request_logs WHERE id = $1", [id]);
		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Log not found.", ["The requested log entry could not be located."]);
		}
		return successResponse(res, 200, "Log retrieved successfully.", { log: result.rows[0] });
	} catch (error) {
		logToFile("LOGS_DETAIL", {
			status: "FAILURE",
			admin_id: req.user ? req.user.id : null,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve log entry at this time."]);
	}
});

module.exports = router;
