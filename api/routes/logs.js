const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const router = express.Router();

const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth, requireRole } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE_PREFIX = "app.log";
const MAX_LIMIT = 1000;

router.use((req, res, next) => {
	logToFile("LOGS_REQUEST", {
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
		logToFile("LOGS_RESPONSE", {
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

function parseList(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
	return String(value)
		.split(",")
		.map((item) => normalizeText(item))
		.filter(Boolean);
}

function parseDate(value, fieldLabel) {
	if (!value) return { value: null };
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) return { error: `${fieldLabel} must be a valid ISO 8601 date.` };
	return { value: new Date(parsed) };
}

function isLogFile(name) {
	if (name === LOG_FILE_PREFIX) return true;
	return name.startsWith(`${LOG_FILE_PREFIX}.`) && /^\d+$/.test(name.split(".").pop());
}

function sortLogFiles(files) {
	return files.sort((a, b) => {
		if (a === LOG_FILE_PREFIX) return 1;
		if (b === LOG_FILE_PREFIX) return -1;
		const aNum = Number.parseInt(a.split(".").pop(), 10);
		const bNum = Number.parseInt(b.split(".").pop(), 10);
		return bNum - aNum;
	});
}

async function readLogFiles() {
	const files = await fs.readdir(LOG_DIR);
	const logFiles = sortLogFiles(files.filter(isLogFile));
	const entries = [];

	for (const file of logFiles) {
		const content = await fs.readFile(path.join(LOG_DIR, file), "utf8");
		const lines = content.split("\n").filter(Boolean);
		for (const line of lines) {
			try {
				const entry = JSON.parse(line);
				entries.push(entry);
			} catch (_) {
				// Skip malformed lines
			}
		}
	}

	return entries;
}

function filterEntries(entries, filters) {
	const {
		events,
		levels,
		statuses,
		userId,
		methods,
		paths,
		startDate,
		endDate,
		search
	} = filters;

	return entries.filter((entry) => {
		if (events.length > 0 && !events.includes(String(entry.event || "").toLowerCase())) return false;
		if (levels.length > 0 && !levels.includes(String(entry.level || "").toLowerCase())) return false;
		if (statuses.length > 0 && !statuses.includes(String(entry.status || "").toLowerCase())) return false;
		if (methods.length > 0 && !methods.includes(String(entry.method || "").toLowerCase())) return false;
		if (paths.length > 0 && !paths.some((p) => String(entry.path || "").includes(p))) return false;
		if (Number.isInteger(userId) && entry.user_id !== userId) return false;
		if (startDate && new Date(entry.timestamp) < startDate) return false;
		if (endDate && new Date(entry.timestamp) > endDate) return false;
		if (search) {
			const haystack = [
				entry.message,
				entry.event,
				entry.error_message,
				entry.error_reason,
				entry.path,
				entry.method,
				entry.level,
				entry.status,
				entry.user_agent,
				typeof entry.details === "object" ? JSON.stringify(entry.details) : ""
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			if (!haystack.includes(search)) return false;
		}
		return true;
	});
}

router.get("/", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const events = parseList(params.events).map((value) => value.toLowerCase());
	const levels = parseList(params.levels).map((value) => value.toLowerCase());
	const statuses = parseList(params.statuses).map((value) => value.toLowerCase());
	const methods = parseList(params.methods).map((value) => value.toLowerCase());
	const paths = parseList(params.paths);
	const userId = params.userId !== undefined ? Number.parseInt(params.userId, 10) : null;
	const search = normalizeText(params.search).toLowerCase() || null;

	const { value: limit, error: limitError } = parseOptionalInt(params.limit, "limit", { min: 1, max: MAX_LIMIT });
	const { value: offset, error: offsetError } = parseOptionalInt(params.offset, "offset", { min: 0, max: null });
	const { value: startDate, error: startError } = parseDate(params.startDate, "startDate");
	const { value: endDate, error: endError } = parseDate(params.endDate, "endDate");

	const errors = [];
	if (params.userId !== undefined && !Number.isInteger(userId)) {
		errors.push("userId must be a valid integer.");
	}
	if (limitError) errors.push(limitError);
	if (offsetError) errors.push(offsetError);
	if (startError) errors.push(startError);
	if (endError) errors.push(endError);

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const entries = await readLogFiles();
		const filtered = filterEntries(entries, {
			events,
			levels,
			statuses,
			userId: Number.isInteger(userId) ? userId : null,
			methods,
			paths,
			startDate,
			endDate,
			search
		});

		filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

		const limitValue = limit ?? 100;
		const offsetValue = offset ?? 0;
		const sliced = filtered.slice(offsetValue, offsetValue + limitValue);

		logToFile("LOGS_QUERY", {
			status: "SUCCESS",
			admin_id: req.user ? req.user.id : null,
			count: sliced.length,
			total: filtered.length,
			filters: {
				events,
				levels,
				statuses,
				methods,
				paths,
				userId: Number.isInteger(userId) ? userId : null,
				startDate: startDate ? startDate.toISOString() : null,
				endDate: endDate ? endDate.toISOString() : null,
				search
			}
		}, "info");

		return successResponse(res, 200, "Logs retrieved successfully.", {
			total: filtered.length,
			count: sliced.length,
			limit: limitValue,
			offset: offsetValue,
			logs: sliced
		});
	} catch (error) {
		logToFile("LOGS_QUERY", {
			status: "FAILURE",
			admin_id: req.user ? req.user.id : null,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["Unable to retrieve logs at this time."]);
	}
});

router.post("/search", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const params = req.body || {};
	const events = parseList(params.events).map((value) => value.toLowerCase());
	const levels = parseList(params.levels).map((value) => value.toLowerCase());
	const statuses = parseList(params.statuses).map((value) => value.toLowerCase());
	const methods = parseList(params.methods).map((value) => value.toLowerCase());
	const paths = parseList(params.paths);
	const userId = params.userId !== undefined ? Number.parseInt(params.userId, 10) : null;
	const search = normalizeText(params.search).toLowerCase() || null;

	const { value: limit, error: limitError } = parseOptionalInt(params.limit, "limit", { min: 1, max: MAX_LIMIT });
	const { value: offset, error: offsetError } = parseOptionalInt(params.offset, "offset", { min: 0, max: null });
	const { value: startDate, error: startError } = parseDate(params.startDate, "startDate");
	const { value: endDate, error: endError } = parseDate(params.endDate, "endDate");

	const errors = [];
	if (params.userId !== undefined && !Number.isInteger(userId)) {
		errors.push("userId must be a valid integer.");
	}
	if (limitError) errors.push(limitError);
	if (offsetError) errors.push(offsetError);
	if (startError) errors.push(startError);
	if (endError) errors.push(endError);

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const entries = await readLogFiles();
		const filtered = filterEntries(entries, {
			events,
			levels,
			statuses,
			userId: Number.isInteger(userId) ? userId : null,
			methods,
			paths,
			startDate,
			endDate,
			search
		});

		filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

		const limitValue = limit ?? 100;
		const offsetValue = offset ?? 0;
		const sliced = filtered.slice(offsetValue, offsetValue + limitValue);

		logToFile("LOGS_QUERY", {
			status: "SUCCESS",
			admin_id: req.user ? req.user.id : null,
			count: sliced.length,
			total: filtered.length,
			filters: {
				events,
				levels,
				statuses,
				methods,
				paths,
				userId: Number.isInteger(userId) ? userId : null,
				startDate: startDate ? startDate.toISOString() : null,
				endDate: endDate ? endDate.toISOString() : null,
				search
			}
		}, "info");

		return successResponse(res, 200, "Logs retrieved successfully.", {
			total: filtered.length,
			count: sliced.length,
			limit: limitValue,
			offset: offsetValue,
			logs: sliced
		});
	} catch (error) {
		logToFile("LOGS_QUERY", {
			status: "FAILURE",
			admin_id: req.user ? req.user.id : null,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["Unable to retrieve logs at this time."]);
	}
});

router.get("/log_types", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	try {
		const entries = await readLogFiles();
		const types = new Set(entries.map((entry) => entry.event).filter(Boolean));
		const list = Array.from(types).sort((a, b) => String(a).localeCompare(String(b)));

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
		return errorResponse(res, 500, "Internal Server Error", ["Unable to retrieve log types at this time."]);
	}
});

router.get("/levels", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	try {
		const entries = await readLogFiles();
		const levels = new Set(entries.map((entry) => entry.level).filter(Boolean));
		const list = Array.from(levels).sort((a, b) => String(a).localeCompare(String(b)));

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
		return errorResponse(res, 500, "Internal Server Error", ["Unable to retrieve log levels at this time."]);
	}
});

router.get("/statuses", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	try {
		const entries = await readLogFiles();
		const statuses = new Set(entries.map((entry) => entry.status).filter(Boolean));
		const list = Array.from(statuses).sort((a, b) => String(a).localeCompare(String(b)));

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
		return errorResponse(res, 500, "Internal Server Error", ["Unable to retrieve log statuses at this time."]);
	}
});

router.get("/log-types", requiresAuth, authenticatedLimiter, requireRole(["admin"]), (req, res) => {
	return res.redirect(308, "/logs/log_types");
});

module.exports = router;
