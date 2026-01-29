const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth, requireRole } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_LIMIT = 1000;
const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_SCAN_MAX_BYTES = 2 * 1024 * 1024;
const LOG_SCAN_MAX_LINES = 10000;
const LOGS_NOT_CONFIGURED_MESSAGE = "Logs are not configured. File logging must be enabled to view logs.";

const LOG_SORT_FIELDS = {
	logged_at: "logged_at",
	status_code: "status_code",
	duration_ms: "duration_ms",
	level: "level",
	category: "category"
};

function listLogFiles() {
	try {
		if (!fs.existsSync(LOG_DIR)) return [];
		const entries = fs.readdirSync(LOG_DIR);
		const matches = entries
			.map((name) => {
				const match = name.match(/^app\.log(?:\.(\d+))?$/);
				if (!match) return null;
				const order = match[1] ? Number.parseInt(match[1], 10) : 0;
				return { name, order };
			})
			.filter(Boolean)
			.sort((a, b) => a.order - b.order)
			.map((entry) => ({
				name: entry.name,
				path: path.join(LOG_DIR, entry.name)
			}));
		return matches;
	} catch (error) {
		logToFile("LOGS_FILE_LIST", {
			status: "FAILURE",
			error_message: error.message
		}, "error");
		return [];
	}
}

function readTail(filePath, maxBytes) {
	try {
		const stats = fs.statSync(filePath);
		if (!stats.isFile()) return "";
		if (stats.size <= 0) return "";
		const readBytes = Math.min(stats.size, maxBytes);
		const start = Math.max(0, stats.size - readBytes);
		const fd = fs.openSync(filePath, "r");
		const buffer = Buffer.alloc(readBytes);
		fs.readSync(fd, buffer, 0, readBytes, start);
		fs.closeSync(fd);
		return buffer.toString("utf8");
	} catch (error) {
		logToFile("LOGS_FILE_READ", {
			status: "FAILURE",
			error_message: error.message,
			path: filePath
		}, "error");
		return "";
	}
}

function hashId(source, line) {
	return crypto
		.createHash("sha1")
		.update(source)
		.update("\n")
		.update(line)
		.digest("hex");
}

function normalizeLogEntry(raw, source, line) {
	const details = raw && typeof raw.details === "object" ? raw.details : {};
	const statusCode = Number.isFinite(raw.http_status)
		? raw.http_status
		: (Number.isFinite(raw.status_code) ? raw.status_code : null);
	return {
		id: hashId(source, line),
		logged_at: raw.logged_at || raw.timestamp || raw.time || null,
		level: raw.level || null,
		category: raw.event || raw.category || null,
		status_code: statusCode,
		status: raw.status || null,
		message: raw.message || raw.msg || null,
		error_summary: raw.error_summary || raw.error_message || raw.error || null,
		method: raw.method || raw.http_method || details.method || null,
		path: raw.path || raw.url || details.path || null,
		duration_ms: Number.isFinite(raw.duration_ms) ? raw.duration_ms : (Number.isFinite(details.duration_ms) ? details.duration_ms : null),
		actor_type: raw.actor_type || details.actor_type || null,
		user_id: raw.user_id ?? details.user_id ?? null,
		user_email: raw.user_email || details.user_email || null,
		api_key_id: raw.api_key_id ?? details.api_key_id ?? null,
		api_key_label: raw.api_key_label || details.api_key_label || null,
		api_key_prefix: raw.api_key_prefix || details.api_key_prefix || null,
		correlation_id: raw.correlation_id || details.correlation_id || null,
		route_pattern: raw.route_pattern || details.route_pattern || null,
		ip: raw.ip || details.ip || null,
		user_agent: raw.user_agent || details.user_agent || null,
		request_bytes: raw.request_bytes ?? details.request_bytes ?? null,
		response_bytes: raw.response_bytes ?? details.response_bytes ?? null,
		body: raw.body ?? details.body ?? null,
		response_body: raw.response_body ?? details.response_body ?? null,
		body_truncated: raw.body_truncated ?? details.body_truncated ?? false,
		response_truncated: raw.response_truncated ?? details.response_truncated ?? false
	};
}

function parseLogLines(text, source) {
	if (!text) return [];
	const lines = text.split(/\r?\n/).filter(Boolean);
	const entries = [];
	for (const line of lines) {
		try {
			const raw = JSON.parse(line);
			if (!raw || typeof raw !== "object") continue;
			entries.push(normalizeLogEntry(raw, source, line));
		} catch (error) {
			continue;
		}
	}
	return entries;
}

function loadLogEntries({ maxLines = LOG_SCAN_MAX_LINES } = {}) {
	const files = listLogFiles();
	if (!files.length) {
		return { configured: false, entries: [], warnings: ["Logs are unavailable."] };
	}

	const entries = [];
	let truncated = false;
	for (const file of files) {
		if (entries.length >= maxLines) {
			truncated = true;
			break;
		}
		const content = readTail(file.path, LOG_SCAN_MAX_BYTES);
		if (!content) continue;
		const parsed = parseLogLines(content, file.name);
		if (!parsed.length) continue;
		entries.push(...parsed);
		if (entries.length >= maxLines) {
			truncated = true;
			entries.length = maxLines;
			break;
		}
	}

	return {
		configured: true,
		entries,
		warnings: truncated ? ["Log view limited to recent entries."] : []
	};
}

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

function buildFilterParams(params = {}) {
	const errors = [];
	const filters = {
		search: normalizeText(params.search),
		category: normalizeText(params.category || params.type),
		level: normalizeText(params.level),
		method: normalizeText(params.method),
		actorType: normalizeText(params.actorType),
		path: normalizeText(params.path),
		userEmail: normalizeText(params.userEmail),
		apiKeyLabel: normalizeText(params.apiKeyLabel),
		apiKeyPrefix: normalizeText(params.apiKeyPrefix),
		sortBy: normalizeText(params.sortBy) || "logged_at",
		order: normalizeText(params.order) === "asc" ? "asc" : "desc"
	};

	const { value: userId, error: userIdError } = parseOptionalInt(params.userId, "userId", { min: 1, max: null });
	if (userIdError) errors.push(userIdError);
	filters.userId = userId;

	const { value: apiKeyId, error: apiKeyIdError } = parseOptionalInt(params.apiKeyId, "apiKeyId", { min: 1, max: null });
	if (apiKeyIdError) errors.push(apiKeyIdError);
	filters.apiKeyId = apiKeyId;

	const statusMinInput = params.statusCodeMin ?? params.statusCode ?? params.status;
	const statusMaxInput = params.statusCodeMax ?? params.statusCode ?? params.status;
	const { value: statusCodeMin, error: statusMinError } = parseOptionalInt(statusMinInput, "statusCodeMin", { min: 100, max: 599 });
	const { value: statusCodeMax, error: statusMaxError } = parseOptionalInt(statusMaxInput, "statusCodeMax", { min: 100, max: 599 });
	if (statusMinError) errors.push(statusMinError);
	if (statusMaxError) errors.push(statusMaxError);
	filters.statusCodeMin = statusCodeMin;
	filters.statusCodeMax = statusCodeMax;

	const { value: startDate, error: startError } = parseDate(params.startDate, "startDate");
	const { value: endDate, error: endError } = parseDate(params.endDate, "endDate");
	if (startError) errors.push(startError);
	if (endError) errors.push(endError);
	filters.startDate = startDate;
	filters.endDate = endDate;

	return { filters, errors };
}

function toNumber(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function matchesSearch(entry, search) {
	if (!search) return true;
	const needle = search.toLowerCase();
	const haystack = [
		entry.message,
		entry.error_summary,
		entry.path,
		entry.route_pattern,
		entry.user_email,
		entry.api_key_label,
		entry.api_key_prefix,
		entry.category,
		entry.level,
		entry.method
	].filter(Boolean).join(" ").toLowerCase();
	return haystack.includes(needle);
}

function matchesFilters(entry, filters) {
	if (!entry) return false;
	if (filters.category && String(entry.category || "").toLowerCase() !== filters.category.toLowerCase()) return false;
	if (filters.level && String(entry.level || "").toLowerCase() !== filters.level.toLowerCase()) return false;
	if (filters.method && String(entry.method || "").toLowerCase() !== filters.method.toLowerCase()) return false;
	if (filters.actorType && String(entry.actor_type || "").toLowerCase() !== filters.actorType.toLowerCase()) return false;
	if (filters.path && !String(entry.path || "").toLowerCase().includes(filters.path.toLowerCase())) return false;
	if (filters.userEmail && !String(entry.user_email || "").toLowerCase().includes(filters.userEmail.toLowerCase())) return false;
	if (Number.isInteger(filters.userId) && Number(entry.user_id) !== filters.userId) return false;
	if (Number.isInteger(filters.apiKeyId) && Number(entry.api_key_id) !== filters.apiKeyId) return false;
	if (filters.apiKeyLabel && !String(entry.api_key_label || "").toLowerCase().includes(filters.apiKeyLabel.toLowerCase())) return false;
	if (filters.apiKeyPrefix && !String(entry.api_key_prefix || "").toLowerCase().includes(filters.apiKeyPrefix.toLowerCase())) return false;
	if (Number.isInteger(filters.statusCodeMin) || Number.isInteger(filters.statusCodeMax)) {
		const statusCode = toNumber(entry.status_code);
		if (!Number.isFinite(statusCode)) return false;
		if (Number.isInteger(filters.statusCodeMin) && statusCode < filters.statusCodeMin) return false;
		if (Number.isInteger(filters.statusCodeMax) && statusCode > filters.statusCodeMax) return false;
	}
	if (filters.startDate || filters.endDate) {
		const loggedAt = Date.parse(entry.logged_at);
		if (Number.isNaN(loggedAt)) return false;
		if (filters.startDate && loggedAt < Date.parse(filters.startDate)) return false;
		if (filters.endDate && loggedAt > Date.parse(filters.endDate)) return false;
	}
	if (!matchesSearch(entry, filters.search)) return false;
	return true;
}

function sortLogs(entries, sortBy, order) {
	const key = LOG_SORT_FIELDS[sortBy] || "logged_at";
	const isAsc = order === "asc";
	const factor = isAsc ? 1 : -1;
	return entries.sort((a, b) => {
		const aValue = key === "logged_at" ? (a.logged_at ? Date.parse(a.logged_at) : 0) : (a[key] ?? "");
		const bValue = key === "logged_at" ? (b.logged_at ? Date.parse(b.logged_at) : 0) : (b[key] ?? "");
		if (typeof aValue === "number" && typeof bValue === "number") {
			return (aValue - bValue) * factor;
		}
		return String(aValue).localeCompare(String(bValue)) * factor;
	});
}

function respondLogs(res, { configured, entries, warnings }, { filters, limit, offset, sortBy, order }, adminId) {
	const filtered = entries.filter((entry) => matchesFilters(entry, filters));
	const sorted = sortLogs(filtered, sortBy, order);
	const total = sorted.length;
	const paged = sorted.slice(offset, offset + limit);

	logToFile("LOGS_QUERY", {
		status: "SUCCESS",
		admin_id: adminId ?? null,
		count: paged.length,
		total,
		filters
	}, "info");

	return successResponse(res, 200, "Logs retrieved successfully.", {
		configured,
		total,
		count: paged.length,
		limit,
		offset,
		logs: paged,
		warnings
	});
}

function buildListResponse(req, res, params) {
	const { value: limit, error: limitError } = parseOptionalInt(params.limit, "limit", { min: 1, max: MAX_LIMIT });
	const { value: offset, error: offsetError } = parseOptionalInt(params.offset, "offset", { min: 0, max: null });
	const { filters, errors } = buildFilterParams(params);
	if (limitError) errors.push(limitError);
	if (offsetError) errors.push(offsetError);
	if (errors.length > 0) {
		logToFile("LOGS_QUERY", {
			status: "VALIDATION_FAILED",
			admin_id: req.user ? req.user.id : null,
			errors,
			filters: params
		}, "warn");
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const availability = loadLogEntries();
	if (!availability.configured) {
		return successResponse(res, 200, "Logs unavailable.", {
			configured: false,
			message: LOGS_NOT_CONFIGURED_MESSAGE,
			total: 0,
			count: 0,
			limit: limit ?? 50,
			offset: offset ?? 0,
			logs: [],
			warnings: availability.warnings
		});
	}

	return respondLogs(res, availability, {
		filters,
		limit: limit ?? 50,
		offset: offset ?? 0,
		sortBy: filters.sortBy,
		order: filters.order
	}, req.user ? req.user.id : null);
}

router.get("/", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	return buildListResponse(req, res, req.query || {});
});

router.post("/search", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	return buildListResponse(req, res, req.body || {});
});

router.get("/log_types", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const availability = loadLogEntries();
	if (!availability.configured) {
		return successResponse(res, 200, "Log types unavailable.", {
			configured: false,
			message: LOGS_NOT_CONFIGURED_MESSAGE,
			count: 0,
			logTypes: [],
			warnings: availability.warnings
		});
	}
	const list = Array.from(new Set(availability.entries.map((entry) => entry.category).filter(Boolean))).sort();
	return successResponse(res, 200, "Log types retrieved successfully.", {
		configured: true,
		count: list.length,
		logTypes: list
	});
});

router.get("/levels", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const availability = loadLogEntries();
	if (!availability.configured) {
		return successResponse(res, 200, "Log levels unavailable.", {
			configured: false,
			message: LOGS_NOT_CONFIGURED_MESSAGE,
			count: 0,
			levels: [],
			warnings: availability.warnings
		});
	}
	const list = Array.from(new Set(availability.entries.map((entry) => entry.level).filter(Boolean))).sort();
	return successResponse(res, 200, "Log levels retrieved successfully.", {
		configured: true,
		count: list.length,
		levels: list
	});
});

router.get("/statuses", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const availability = loadLogEntries();
	if (!availability.configured) {
		return successResponse(res, 200, "Log statuses unavailable.", {
			configured: false,
			message: LOGS_NOT_CONFIGURED_MESSAGE,
			count: 0,
			statuses: [],
			warnings: availability.warnings
		});
	}
	const list = Array.from(new Set(availability.entries.map((entry) => entry.status_code).filter((value) => Number.isFinite(value))))
		.sort((a, b) => a - b)
		.map((value) => String(value));
	return successResponse(res, 200, "Log statuses retrieved successfully.", {
		configured: true,
		count: list.length,
		statuses: list
	});
});

router.post("/export", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const params = req.body || {};
	const format = normalizeText(params.format || "json").toLowerCase();
	const { value: startDate, error: startError } = parseDate(params.startDate, "startDate");
	const { value: endDate, error: endError } = parseDate(params.endDate, "endDate");
	const { filters, errors } = buildFilterParams({ ...params, startDate, endDate });
	if (startError) errors.push(startError);
	if (endError) errors.push(endError);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const availability = loadLogEntries();
	if (!availability.configured) {
		return successResponse(res, 200, "Logs unavailable.", {
			configured: false,
			message: LOGS_NOT_CONFIGURED_MESSAGE,
			logs: [],
			warnings: availability.warnings
		});
	}

	const filtered = availability.entries.filter((entry) => matchesFilters(entry, filters));
	const sorted = sortLogs(filtered, filters.sortBy, filters.order);

	if (format === "csv") {
		const rows = sorted.map((entry) => ({
			id: entry.id,
			logged_at: entry.logged_at,
			level: entry.level,
			category: entry.category,
			status_code: entry.status_code,
			status: entry.status,
			message: entry.message,
			error_summary: entry.error_summary,
			method: entry.method,
			path: entry.path,
			duration_ms: entry.duration_ms,
			actor_type: entry.actor_type,
			user_id: entry.user_id,
			user_email: entry.user_email,
			api_key_id: entry.api_key_id,
			api_key_label: entry.api_key_label,
			api_key_prefix: entry.api_key_prefix
		}));
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

	return successResponse(res, 200, "Log export ready.", {
		configured: true,
		logs: sorted
	});
});

router.get("/log-types", requiresAuth, authenticatedLimiter, requireRole(["admin"]), (req, res) => {
	return res.redirect(308, "/logs/log_types");
});

router.get("/:id", requiresAuth, authenticatedLimiter, requireRole(["admin"]), async (req, res) => {
	const id = normalizeText(req.params.id);
	if (!id) {
		return errorResponse(res, 400, "Validation Error", ["Log id must be a valid string."]);
	}
	const availability = loadLogEntries();
	if (!availability.configured) {
		return errorResponse(res, 503, "Logs unavailable.", ["Logs are not configured."]);
	}
	const logEntry = availability.entries.find((entry) => entry.id === id);
	if (!logEntry) {
		return errorResponse(res, 404, "Log not found.", ["The requested log entry could not be located."]);
	}
	return successResponse(res, 200, "Log retrieved successfully.", { log: logEntry });
});

module.exports = router;
