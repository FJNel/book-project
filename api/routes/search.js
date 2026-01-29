const express = require("express");
const router = express.Router();

const pool = require("../db");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { successResponse, errorResponse } = require("../utils/response");
const { logToFile } = require("../utils/logging");
const { resolveLibraryReadUserId, enforceLibraryWriteScope } = require("../utils/library-permissions");

const MAX_LIMIT = 50;

router.use((req, res, next) => {
	logToFile("SEARCH_REQUEST", {
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
		logToFile("SEARCH_RESPONSE", {
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

const READ_ONLY_POST_PATHS = new Set();
router.use((req, res, next) => {
	if (req.method === "GET" || (req.method === "POST" && READ_ONLY_POST_PATHS.has(req.path))) {
		const resolved = resolveLibraryReadUserId(req);
		if (resolved.error) {
			return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
		}
		if (resolved.userId !== req.user.id) {
			req.authUserId = req.user.id;
			req.user.id = resolved.userId;
		}
		return next();
	}
	if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
		const writeError = enforceLibraryWriteScope(req);
		if (writeError) {
			return errorResponse(res, writeError.status, writeError.message, writeError.errors);
		}
	}
	return next();
});

function normalizeText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
}

function parseId(value) {
	if (value === undefined || value === null || value === "") return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) return null;
	return parsed;
}

function parseTypes(rawTypes) {
	if (!rawTypes) return null;
	if (Array.isArray(rawTypes)) {
		return rawTypes.map((t) => normalizeText(t).toLowerCase()).filter(Boolean);
	}
	return String(rawTypes)
		.split(",")
		.map((t) => normalizeText(t).toLowerCase())
		.filter(Boolean);
}

function parseOptionalInt(value, fieldLabel, { min = 1, max = MAX_LIMIT } = {}) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) return { error: `${fieldLabel} must be an integer.` };
	if (parsed < min || parsed > max) {
		return { error: `${fieldLabel} must be between ${min} and ${max}.` };
	}
	return { value: parsed };
}

// GET /search - Global lookup across library entities
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const query = normalizeText(params.q);
	const types = parseTypes(params.types);
	const { value: limit, error: limitError } = parseOptionalInt(params.limit, "limit", { min: 1, max: MAX_LIMIT });
	const { value: offset, error: offsetError } = parseOptionalInt(params.offset, "offset", { min: 0, max: 10000 });

	const errors = [];
	if (!query) {
		errors.push("Search query (q) must be provided.");
	}
	if (limitError) errors.push(limitError);
	if (offsetError) errors.push(offsetError);

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const limitValue = limit ?? 10;
	const offsetValue = offset ?? 0;
	const includeTypes = types && types.length > 0
		? new Set(types)
		: new Set(["books", "authors", "publishers", "series", "tags"]);

	try {
		const results = {};

		if (includeTypes.has("books")) {
			const bookRows = await pool.query(
				`SELECT id, title, subtitle
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL
				   AND (title ILIKE $2 OR subtitle ILIKE $2)
				 ORDER BY title ASC
				 LIMIT $3 OFFSET $4`,
				[userId, `%${query}%`, limitValue, offsetValue]
			);
			results.books = bookRows.rows.map((row) => ({
				id: row.id,
				title: row.title,
				subtitle: row.subtitle
			}));
		}

		if (includeTypes.has("authors")) {
			const authorRows = await pool.query(
				`SELECT id, display_name
				 FROM authors
				 WHERE user_id = $1 AND deleted_at IS NULL
				   AND display_name ILIKE $2
				 ORDER BY display_name ASC
				 LIMIT $3 OFFSET $4`,
				[userId, `%${query}%`, limitValue, offsetValue]
			);
			results.authors = authorRows.rows.map((row) => ({
				id: row.id,
				displayName: row.display_name
			}));
		}

		if (includeTypes.has("publishers")) {
			const publisherRows = await pool.query(
				`SELECT id, name
				 FROM publishers
				 WHERE user_id = $1 AND deleted_at IS NULL
				   AND name ILIKE $2
				 ORDER BY name ASC
				 LIMIT $3 OFFSET $4`,
				[userId, `%${query}%`, limitValue, offsetValue]
			);
			results.publishers = publisherRows.rows.map((row) => ({
				id: row.id,
				name: row.name
			}));
		}

		if (includeTypes.has("series")) {
			const seriesRows = await pool.query(
				`SELECT id, name
				 FROM book_series
				 WHERE user_id = $1 AND deleted_at IS NULL
				   AND name ILIKE $2
				 ORDER BY name ASC
				 LIMIT $3 OFFSET $4`,
				[userId, `%${query}%`, limitValue, offsetValue]
			);
			results.series = seriesRows.rows.map((row) => ({
				id: row.id,
				name: row.name
			}));
		}

		if (includeTypes.has("tags")) {
			const tagRows = await pool.query(
				`SELECT id, name
				 FROM tags
				 WHERE user_id = $1 AND name ILIKE $2
				 ORDER BY name ASC
				 LIMIT $3 OFFSET $4`,
				[userId, `%${query}%`, limitValue, offsetValue]
			);
			results.tags = tagRows.rows.map((row) => ({
				id: row.id,
				name: row.name
			}));
		}

		return successResponse(res, 200, "Search results retrieved successfully.", {
			query,
			limit: limitValue,
			offset: offsetValue,
			results
		});
	} catch (error) {
		logToFile("SEARCH", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent"),
			query
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while searching."]);
	}
});

module.exports = router;
