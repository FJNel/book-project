const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_LIST_LIMIT = 200;

router.use((req, res, next) => {
	logToFile("TAGS_REQUEST", {
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
		logToFile("TAGS_RESPONSE", {
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

// GET /tags/stats - Tag statistics
router.get("/stats", requiresAuth, statsLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => (typeof field === "string" ? field.trim() : "")).filter(Boolean)
		: [];

	const availableFields = new Set([
		"totalTags",
		"mostUsedTag",
		"leastUsedTags",
		"unusedTags",
		"tagGrowth"
	]);
	const selected = fields.length > 0 ? fields : Array.from(availableFields);
	const invalid = selected.filter((field) => !availableFields.has(field));
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}

	const { value: leastLimit, error: leastLimitError } = parseOptionalInt(params.leastLimit, "leastLimit", { min: 1, max: MAX_LIST_LIMIT });
	if (leastLimitError) {
		return errorResponse(res, 400, "Validation Error", [leastLimitError]);
	}
	const { value: unusedLimit, error: unusedLimitError } = parseOptionalInt(params.unusedLimit, "unusedLimit", { min: 1, max: MAX_LIST_LIMIT });
	if (unusedLimitError) {
		return errorResponse(res, 400, "Validation Error", [unusedLimitError]);
	}
	const leastLimitValue = leastLimit ?? 50;
	const unusedLimitValue = unusedLimit ?? 50;

	try {
		const payload = {};

		const totalTagsResult = await pool.query(
			`SELECT COUNT(*)::int AS count
			 FROM tags
			 WHERE user_id = $1`,
			[userId]
		);
		const totalTags = totalTagsResult.rows[0]?.count ?? 0;
		if (selected.includes("totalTags")) payload.totalTags = totalTags;

		if (selected.includes("tagGrowth")) {
			const growthResult = await pool.query(
				`SELECT
				   COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last_30,
				   COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days')::int AS last_90
				 FROM tags
				 WHERE user_id = $1`,
				[userId]
			);
			payload.tagGrowth = {
				last30Days: growthResult.rows[0]?.last_30 ?? 0,
				last90Days: growthResult.rows[0]?.last_90 ?? 0
			};
		}

		const totalBooksResult = await pool.query(
			`SELECT COUNT(*)::int AS count
			 FROM books
			 WHERE user_id = $1 AND deleted_at IS NULL`,
			[userId]
		);
		const totalBooks = totalBooksResult.rows[0]?.count ?? 0;

		if (selected.includes("mostUsedTag")) {
			const result = await pool.query(
				`SELECT t.id, t.name, COUNT(DISTINCT bt.book_id)::int AS book_count
				 FROM tags t
				 JOIN book_tags bt ON bt.tag_id = t.id AND bt.user_id = t.user_id
				 JOIN books b ON b.id = bt.book_id AND b.deleted_at IS NULL
				 WHERE t.user_id = $1
				 GROUP BY t.id, t.name
				 ORDER BY book_count DESC, t.name ASC
				 LIMIT 1`,
				[userId]
			);
			const row = result.rows[0];
			payload.mostUsedTag = row
				? {
					id: row.id,
					name: row.name,
					bookCount: row.book_count,
					percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
				}
				: null;
		}

		if (selected.includes("leastUsedTags")) {
			const result = await pool.query(
				`SELECT t.id, t.name, COUNT(DISTINCT bt.book_id)::int AS book_count
				 FROM tags t
				 JOIN book_tags bt ON bt.tag_id = t.id AND bt.user_id = t.user_id
				 JOIN books b ON b.id = bt.book_id AND b.deleted_at IS NULL
				 WHERE t.user_id = $1
				 GROUP BY t.id, t.name
				 HAVING COUNT(DISTINCT bt.book_id) = 1
				 ORDER BY t.name ASC
				 LIMIT $2`,
				[userId, leastLimitValue]
			);
			payload.leastUsedTags = result.rows.map((row) => ({
				id: row.id,
				name: row.name,
				bookCount: row.book_count,
				percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
			}));
		}

		if (selected.includes("unusedTags")) {
			const result = await pool.query(
				`SELECT t.id, t.name
				 FROM tags t
				 LEFT JOIN book_tags bt ON bt.tag_id = t.id AND bt.user_id = t.user_id
				 LEFT JOIN books b ON b.id = bt.book_id AND b.deleted_at IS NULL
				 WHERE t.user_id = $1
				 GROUP BY t.id, t.name
				 HAVING COUNT(b.id) = 0
				 ORDER BY t.name ASC
				 LIMIT $2`,
				[userId, unusedLimitValue]
			);
			payload.unusedTags = result.rows.map((row) => ({
				id: row.id,
				name: row.name
			}));
		}

		return successResponse(res, 200, "Tag stats retrieved successfully.", { stats: payload });
	} catch (error) {
		logToFile("TAG_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve tag stats at this time."]);
	}
});

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
