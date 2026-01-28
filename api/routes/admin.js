// All endpoints should be logged thoroughly with user ID and admin ID, along with action etc.

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const { requiresAuth, requireRole } = require("../utils/jwt");
const { authenticatedLimiter, emailCostLimiter, sensitiveActionLimiter, adminDeletionLimiter } = require("../utils/rate-limiters");
const { logToFile, sanitizeInput } = require("../utils/logging");
const { successResponse, errorResponse } = require("../utils/response");
const { validateFullName, validatePreferredName, validateEmail, validatePassword } = require("../utils/validators");
const { enqueueEmail } = require("../utils/email-queue");
const { recordEmailHistory, updateEmailHistory } = require("../utils/email-history");
const email = require("../utils/email");
const {
	DEFAULT_ADMIN_TTL_SECONDS,
	buildCacheKey,
	getCacheEntry,
	setCacheEntry
} = require("../utils/stats-cache");
const {
	canSendEmailForUser,
	getUserEmailPreferences,
	preferenceSummary,
	getEmailCategoryForType
} = require("../utils/email-preferences");
const config = require("../config");
const pool = require("../db");
const fetch = (...args) => import("node-fetch").then(({ default: fetchFn }) => fetchFn(...args));

router.use((req, res, next) => {
	const start = process.hrtime();
	res.on("finish", () => {
		const diff = process.hrtime(start);
		const durationMs = Number((diff[0] * 1e3 + diff[1] / 1e6).toFixed(2));
		logToFile("ADMIN_RESPONSE", {
			admin_id: req.user ? req.user.id : null,
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

function logAdminRequest(req, res, next) {
	logToFile("ADMIN_REQUEST", {
		admin_id: req.user ? req.user.id : null,
		method: req.method,
		path: req.originalUrl || req.url,
		ip: req.ip,
		user_agent: req.get("user-agent"),
		query: req.query || {},
		request: req.body || {}
	}, "info");
	next();
}

// Middleware to ensure the user is an authenticated admin
const adminAuth = [requiresAuth, authenticatedLimiter, requireRole(["admin"]), logAdminRequest];

// GET/POST /admin/stats/summary - Site-wide statistics
// Manual verification (regression signal):
// - Expected inputs: authenticated admin user; optional JSON body or query params are ignored.
// - Expected failures: database query error or permission failure should return a standard error envelope.
// - Expected error shape: { status, httpCode, responseTime, message, data: {}, errors: [] }.
// - UI check: Admin > Statistics should render counts or show the error alert without breaking the page.
const adminStatsSummaryHandler = async (req, res) => {
	try {
		const cacheKey = buildCacheKey({
			scope: "admin",
			endpoint: "admin/stats/summary",
			params: {}
		});
		const cached = getCacheEntry(cacheKey);
		if (cached) {
			return successResponse(res, 200, "Site statistics retrieved successfully.", {
				...cached.data,
				cache: { hit: true, ageSeconds: cached.ageSeconds }
			});
		}

		const schemaErrorCodes = new Set(["42P01", "42703"]);
		const safeCount = async (label, sql, params = []) => {
			try {
				const result = await pool.query(sql, params);
				return { label, count: result.rows[0]?.count ?? 0 };
			} catch (error) {
				if (schemaErrorCodes.has(error.code)) {
					logToFile("ADMIN_STATS_PARTIAL", {
						status: "SCHEMA_MISSING",
						label,
						error_message: error.message,
						admin_id: req.user.id
					}, "warn");
					return { label, count: null, warning: `${label} unavailable.` };
				}
				throw error;
			}
		};
		const safeScalar = async (label, sql, params = []) => {
			try {
				const result = await pool.query(sql, params);
				const raw = result.rows[0]?.value ?? null;
				const numeric = raw === null || raw === undefined ? null : Number(raw);
				return { label, value: Number.isFinite(numeric) ? numeric : null };
			} catch (error) {
				if (schemaErrorCodes.has(error.code)) {
					logToFile("ADMIN_STATS_PARTIAL", {
						status: "SCHEMA_MISSING",
						label,
						error_message: error.message,
						admin_id: req.user.id
					}, "warn");
					return { label, value: null, warning: `${label} unavailable.` };
				}
				throw error;
			}
		};

		const MIN_SAMPLE_SIZE = 5;
		const buildMetric = ({ label, value, unit = "number", sampleSize, note }) => {
			if (!Number.isFinite(sampleSize) || sampleSize < MIN_SAMPLE_SIZE) {
				return { label, value: null, unit, sampleSize, note: "Not enough data yet" };
			}
			if (value === null || value === undefined || Number.isNaN(value)) {
				return { label, value: null, unit, sampleSize, note: note || "Unavailable" };
			}
			return { label, value, unit, sampleSize, note: note || null };
		};

		const results = await Promise.all([
			safeCount("users_total", "SELECT COUNT(*)::int AS count FROM users"),
			safeCount("users_verified", "SELECT COUNT(*)::int AS count FROM users WHERE is_verified = TRUE"),
			safeCount("users_disabled", "SELECT COUNT(*)::int AS count FROM users WHERE is_disabled = TRUE"),
			safeCount("books_total", "SELECT COUNT(*)::int AS count FROM books"),
			safeCount("books_active", "SELECT COUNT(*)::int AS count FROM books WHERE deleted_at IS NULL"),
			safeCount("books_deleted", "SELECT COUNT(*)::int AS count FROM books WHERE deleted_at IS NOT NULL"),
			safeCount("authors_active", "SELECT COUNT(*)::int AS count FROM authors WHERE deleted_at IS NULL"),
			safeCount("publishers_active", "SELECT COUNT(*)::int AS count FROM publishers WHERE deleted_at IS NULL"),
			safeCount("series_active", "SELECT COUNT(*)::int AS count FROM book_series WHERE deleted_at IS NULL"),
			safeCount("book_types_total", "SELECT COUNT(*)::int AS count FROM book_types"),
			safeCount("tags_active", "SELECT COUNT(*)::int AS count FROM tags"),
			safeCount("storage_locations_active", "SELECT COUNT(*)::int AS count FROM storage_locations")
		]);
		const resultMap = results.reduce((acc, entry) => {
			acc[entry.label] = entry;
			return acc;
		}, {});
		const warnings = results.filter((entry) => entry.warning).map((entry) => entry.warning);
		const [
			zeroBooks,
			medianBooks,
			avgAuthors,
			avgTags,
			avgPages,
			booksWithPages,
			booksMissingCover,
			booksMissingPageCount
		] = await Promise.all([
			safeCount("users_zero_books",
				`SELECT COUNT(*)::int AS count
				 FROM users u
				 LEFT JOIN books b ON b.user_id = u.id AND b.deleted_at IS NULL
				 WHERE b.id IS NULL`
			),
			safeScalar("books_per_user_median",
				`SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY book_count)::numeric AS value
				 FROM (
				   SELECT u.id, COUNT(b.id) AS book_count
				   FROM users u
				   LEFT JOIN books b ON b.user_id = u.id AND b.deleted_at IS NULL
				   GROUP BY u.id
				 ) t`
			),
			safeScalar("authors_per_book_avg",
				`SELECT AVG(author_count)::numeric AS value
				 FROM (
				   SELECT b.id, COUNT(ba.author_id)::int AS author_count
				   FROM books b
				   LEFT JOIN book_authors ba ON ba.book_id = b.id
				   WHERE b.deleted_at IS NULL
				   GROUP BY b.id
				 ) t`
			),
			safeScalar("tags_per_book_avg",
				`SELECT AVG(tag_count)::numeric AS value
				 FROM (
				   SELECT b.id, COUNT(bt.tag_id)::int AS tag_count
				   FROM books b
				   LEFT JOIN book_tags bt ON bt.book_id = b.id
				   WHERE b.deleted_at IS NULL
				   GROUP BY b.id
				 ) t`
			),
			safeScalar("avg_page_count",
				`SELECT AVG(page_count)::numeric AS value
				 FROM books
				 WHERE deleted_at IS NULL AND page_count IS NOT NULL`
			),
			safeCount("books_with_page_count",
				`SELECT COUNT(*)::int AS count FROM books WHERE deleted_at IS NULL AND page_count IS NOT NULL`
			),
			safeCount("books_missing_cover",
				`SELECT COUNT(*)::int AS count
				 FROM books
				 WHERE deleted_at IS NULL AND (cover_image_url IS NULL OR cover_image_url = '')`
			),
			safeCount("books_missing_page_count",
				`SELECT COUNT(*)::int AS count
				 FROM books
				 WHERE deleted_at IS NULL AND page_count IS NULL`
			)
		]);

		const scalarWarnings = [zeroBooks, medianBooks, avgAuthors, avgTags, avgPages, booksWithPages, booksMissingCover, booksMissingPageCount]
			.filter((entry) => entry?.warning)
			.map((entry) => entry.warning);
		if (scalarWarnings.length) warnings.push(...scalarWarnings);

		const responseData = {
			stats: {
				users: {
					total: resultMap.users_total?.count ?? null,
					verified: resultMap.users_verified?.count ?? null,
					disabled: resultMap.users_disabled?.count ?? null
				},
				books: {
					total: resultMap.books_total?.count ?? null,
					active: resultMap.books_active?.count ?? null,
					deleted: resultMap.books_deleted?.count ?? null
				},
				library: {
					authors: resultMap.authors_active?.count ?? null,
					publishers: resultMap.publishers_active?.count ?? null,
					series: resultMap.series_active?.count ?? null,
					bookTypes: resultMap.book_types_total?.count ?? null,
					tags: resultMap.tags_active?.count ?? null,
					storageLocations: resultMap.storage_locations_active?.count ?? null
				}
			},
			insights: {
				adoption: [
					buildMetric({
						label: "Average books per user",
						value: resultMap.users_total?.count
							? (resultMap.books_active?.count ?? 0) / resultMap.users_total.count
							: null,
						unit: "number",
						sampleSize: resultMap.users_total?.count ?? 0
					}),
					buildMetric({
						label: "Median books per user",
						value: medianBooks?.value ?? null,
						unit: "number",
						sampleSize: resultMap.users_total?.count ?? 0,
						note: medianBooks?.warning ? "Unavailable" : null
					}),
					buildMetric({
						label: "Users with zero books",
						value: resultMap.users_total?.count
							? ((zeroBooks?.count ?? 0) / resultMap.users_total.count) * 100
							: null,
						unit: "percent",
						sampleSize: resultMap.users_total?.count ?? 0
					})
				],
				quality: [
					buildMetric({
						label: "Books missing page count",
						value: resultMap.books_active?.count
							? ((booksMissingPageCount?.count ?? 0) / resultMap.books_active.count) * 100
							: null,
						unit: "percent",
						sampleSize: resultMap.books_active?.count ?? 0
					}),
					buildMetric({
						label: "Books missing cover image",
						value: resultMap.books_active?.count
							? ((booksMissingCover?.count ?? 0) / resultMap.books_active.count) * 100
							: null,
						unit: "percent",
						sampleSize: resultMap.books_active?.count ?? 0
					})
				],
				engagement: [
					buildMetric({
						label: "Average authors per book",
						value: avgAuthors?.value ?? null,
						unit: "number",
						sampleSize: resultMap.books_active?.count ?? 0,
						note: avgAuthors?.warning ? "Unavailable" : null
					}),
					buildMetric({
						label: "Average tags per book",
						value: avgTags?.value ?? null,
						unit: "number",
						sampleSize: resultMap.books_active?.count ?? 0,
						note: avgTags?.warning ? "Unavailable" : null
					}),
					buildMetric({
						label: "Average page count",
						value: avgPages?.value ?? null,
						unit: "pages",
						sampleSize: booksWithPages?.count ?? 0,
						note: avgPages?.warning ? "Unavailable" : null
					})
				]
			},
			cache: { hit: false, ageSeconds: 0 }
		};
		if (warnings.length) {
			responseData.warnings = warnings;
		}
		setCacheEntry(cacheKey, responseData, DEFAULT_ADMIN_TTL_SECONDS);
		return successResponse(res, 200, "Site statistics retrieved successfully.", responseData);
	} catch (error) {
		logToFile("ADMIN_STATS", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve site statistics at this time."]);
	}
};

router.get("/stats/summary", adminAuth, adminStatsSummaryHandler);
router.post("/stats/summary", adminAuth, adminStatsSummaryHandler);

// GET/POST /admin/usage/users - Usage dashboard (user sessions only)
const adminUsageUsersHandler = async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const { value: startDate, error: startError } = parseDateFilter(params.startDate, "startDate");
	const { value: endDate, error: endError } = parseDateFilter(params.endDate, "endDate");
	const { value: limit, error: limitError } = parseOptionalInt(params.limit, "limit", { min: 1, max: 500 });
	const { value: offset, error: offsetError } = parseOptionalInt(params.offset, "offset", { min: 0, max: null });

	const errors = [];
	if (startError) errors.push(startError);
	if (endError) errors.push(endError);
	if (limitError) errors.push(limitError);
	if (offsetError) errors.push(offsetError);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const windowStart = startDate || new Date(Date.now() - USAGE_SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const windowEnd = endDate || new Date().toISOString();
	const sortBy = normalizeText(params.sortBy) || "usageScore";
	const sortOrder = (parseSortOrder(params.order) || "desc").toUpperCase();
	const topLimit = Math.min(Number.parseInt(params.topLimit || "5", 10) || 5, 15);

	const clauses = ["l.actor_type IN ('user', 'api_key')", "l.logged_at BETWEEN $1 AND $2"];
	const values = [windowStart, windowEnd];
	let idx = 3;

	if (Number.isInteger(parseId(params.userId))) {
		clauses.push(`l.user_id = $${idx++}`);
		values.push(parseId(params.userId));
	}
	if (normalizeText(params.email)) {
		clauses.push(`l.user_email ILIKE $${idx++}`);
		values.push(`%${normalizeText(params.email)}%`);
	}
	if (normalizeText(params.method)) {
		clauses.push(`UPPER(l.method) = $${idx++}`);
		values.push(normalizeText(params.method).toUpperCase());
	}
	if (normalizeText(params.path)) {
		clauses.push(`l.path ILIKE $${idx++}`);
		values.push(`%${normalizeText(params.path)}%`);
	}

	const sortColumnMap = {
		usageScore: "usage_score",
		requests: "request_count",
		lastSeen: "last_seen"
	};
	const sortColumn = sortColumnMap[sortBy] || "usage_score";

	try {
		const { hasTable, hasCostUnits } = await getRequestLogsAvailability();
		if (!hasTable) {
			return successResponse(res, 200, "User usage retrieved successfully.", {
				configured: false,
				message: LOGS_NOT_CONFIGURED_MESSAGE,
				window: { startDate: windowStart, endDate: windowEnd },
				limit: limit ?? 25,
				offset: offset ?? 0,
				usageLevels: USAGE_LEVEL_THRESHOLDS,
				users: [],
				warnings: ["Request logs are unavailable, so usage data cannot be generated."]
			});
		}
		const cacheKey = buildCacheKey({
			scope: "admin",
			endpoint: "admin/usage/users",
			params: {
				windowStart,
				windowEnd,
				sortBy,
				order: sortOrder,
				topLimit,
				limit: limit ?? 25,
				offset: offset ?? 0,
				userId: parseId(params.userId),
				email: normalizeText(params.email),
				path: normalizeText(params.path),
				method: normalizeText(params.method)
			}
		});
		const cached = getCacheEntry(cacheKey);
		if (cached) {
			return successResponse(res, 200, "User usage retrieved successfully.", cached.data);
		}

		// Usage score: capped 0-100 with log10 scaling over the 30-day window (cost_units preferred; fallback to request count).
		const usageScoreSelect = `${buildUsageScoreExpression(hasCostUnits)} AS usage_score`;

		const usageResult = await pool.query(
			`SELECT l.user_id,
			        l.user_email,
			        l.user_role,
			        COUNT(*)::int AS request_count,
			        ${usageScoreSelect},
			        MAX(l.logged_at) AS last_seen
			 FROM request_logs l
			 WHERE ${clauses.join(" AND ")}
			 GROUP BY l.user_id, l.user_email, l.user_role
			 ORDER BY ${sortColumn} ${sortOrder}
			 LIMIT $${idx} OFFSET $${idx + 1}`,
			[...values, limit ?? 25, offset ?? 0]
		);

		const users = usageResult.rows.map((row) => ({
			userId: row.user_id,
			email: row.user_email,
			role: row.user_role,
			requestCount: row.request_count,
			usageScore: row.usage_score,
			usageLevel: getUsageLevel(row.usage_score),
			lastSeen: row.last_seen,
			topEndpoints: []
		}));

		if (users.length > 0) {
			const userIds = users.map((u) => u.userId);
			const topResult = await pool.query(
				`SELECT l.user_id, l.method, l.path, COUNT(*)::int AS count
				 FROM request_logs l
				 WHERE l.actor_type IN ('user', 'api_key')
				   AND l.user_id = ANY($1)
				   AND l.logged_at BETWEEN $2 AND $3
				 GROUP BY l.user_id, l.method, l.path
				 ORDER BY count DESC`,
				[userIds, windowStart, windowEnd]
			);
			const grouped = new Map();
			topResult.rows.forEach((row) => {
				if (!grouped.has(row.user_id)) grouped.set(row.user_id, []);
				grouped.get(row.user_id).push({
					method: row.method,
					path: row.path,
					count: row.count
				});
			});
			users.forEach((user) => {
				const list = grouped.get(user.userId) || [];
				user.topEndpoints = list.slice(0, topLimit);
			});
		}

		const responseData = {
			configured: true,
			window: { startDate: windowStart, endDate: windowEnd },
			limit: limit ?? 25,
			offset: offset ?? 0,
			usageLevels: USAGE_LEVEL_THRESHOLDS,
			users
		};
		setCacheEntry(cacheKey, responseData, DEFAULT_ADMIN_TTL_SECONDS);
		return successResponse(res, 200, "User usage retrieved successfully.", responseData);
	} catch (error) {
		logToFile("ADMIN_USAGE_USERS", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve usage analytics at this time."]);
	}
};

router.get("/usage/users", adminAuth, adminUsageUsersHandler);
router.post("/usage/users", adminAuth, adminUsageUsersHandler);

// Admin: request logs health check (usage logging diagnostic)
router.get("/request-logs/health", adminAuth, async (req, res) => {
	try {
		const tableResult = await pool.query("SELECT to_regclass('public.request_logs') AS table_exists");
		const hasTable = Boolean(tableResult.rows[0]?.table_exists);
		if (!hasTable) {
			return successResponse(res, 200, "Request logs are not configured.", {
				configured: false,
				total: 0,
				lastLoggedAt: null
			});
		}

		const statsResult = await pool.query(
			"SELECT COUNT(*)::int AS total, MAX(logged_at) AS last_logged_at FROM request_logs"
		);
		const total = statsResult.rows[0]?.total ?? 0;
		const lastLoggedAt = statsResult.rows[0]?.last_logged_at ?? null;

		logToFile("ADMIN_REQUEST_LOGS_HEALTH", {
			status: "SUCCESS",
			admin_id: req.user ? req.user.id : null,
			total
		}, "info");

		return successResponse(res, 200, "Request log health retrieved.", {
			configured: true,
			total,
			lastLoggedAt
		});
	} catch (error) {
		logToFile("ADMIN_REQUEST_LOGS_HEALTH", {
			status: "FAILURE",
			admin_id: req.user ? req.user.id : null,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve request log health at this time."]);
	}
});

// GET/POST /admin/usage/api-keys - Usage dashboard for API keys
const adminUsageApiKeysHandler = async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const { value: startDate, error: startError } = parseDateFilter(params.startDate, "startDate");
	const { value: endDate, error: endError } = parseDateFilter(params.endDate, "endDate");
	const { value: limit, error: limitError } = parseOptionalInt(params.limit, "limit", { min: 1, max: 500 });
	const { value: offset, error: offsetError } = parseOptionalInt(params.offset, "offset", { min: 0, max: null });

	const errors = [];
	if (startError) errors.push(startError);
	if (endError) errors.push(endError);
	if (limitError) errors.push(limitError);
	if (offsetError) errors.push(offsetError);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const windowStart = startDate || new Date(Date.now() - USAGE_SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
	const windowEnd = endDate || new Date().toISOString();
	const sortBy = normalizeText(params.sortBy) || "usageScore";
	const sortOrder = (parseSortOrder(params.order) || "desc").toUpperCase();
	const topLimit = Math.min(Number.parseInt(params.topLimit || "5", 10) || 5, 15);

	const clauses = ["l.actor_type = 'api_key'", "l.logged_at BETWEEN $1 AND $2"];
	const values = [windowStart, windowEnd];
	let idx = 3;

	if (Number.isInteger(parseId(params.userId))) {
		clauses.push(`l.user_id = $${idx++}`);
		values.push(parseId(params.userId));
	}
	if (normalizeText(params.email)) {
		clauses.push(`l.user_email ILIKE $${idx++}`);
		values.push(`%${normalizeText(params.email)}%`);
	}
	if (Number.isInteger(parseId(params.apiKeyId))) {
		clauses.push(`l.api_key_id = $${idx++}`);
		values.push(parseId(params.apiKeyId));
	}
	if (normalizeText(params.apiKeyLabel)) {
		clauses.push(`l.api_key_label ILIKE $${idx++}`);
		values.push(`%${normalizeText(params.apiKeyLabel)}%`);
	}
	if (normalizeText(params.method)) {
		clauses.push(`UPPER(l.method) = $${idx++}`);
		values.push(normalizeText(params.method).toUpperCase());
	}
	if (normalizeText(params.path)) {
		clauses.push(`l.path ILIKE $${idx++}`);
		values.push(`%${normalizeText(params.path)}%`);
	}

	const sortColumnMap = {
		usageScore: "usage_score",
		requests: "request_count",
		lastSeen: "last_seen"
	};
	const sortColumn = sortColumnMap[sortBy] || "usage_score";

	try {
		const { hasTable, hasCostUnits } = await getRequestLogsAvailability();
		if (!hasTable) {
			return successResponse(res, 200, "API key usage retrieved successfully.", {
				configured: false,
				message: LOGS_NOT_CONFIGURED_MESSAGE,
				window: { startDate: windowStart, endDate: windowEnd },
				limit: limit ?? 25,
				offset: offset ?? 0,
				usageLevels: USAGE_LEVEL_THRESHOLDS,
				apiKeys: [],
				warnings: ["Request logs are unavailable, so usage data cannot be generated."]
			});
		}
		const cacheKey = buildCacheKey({
			scope: "admin",
			endpoint: "admin/usage/api-keys",
			params: {
				windowStart,
				windowEnd,
				sortBy,
				order: sortOrder,
				topLimit,
				limit: limit ?? 25,
				offset: offset ?? 0,
				userId: parseId(params.userId),
				email: normalizeText(params.email),
				apiKeyId: parseId(params.apiKeyId),
				apiKeyLabel: normalizeText(params.apiKeyLabel),
				method: normalizeText(params.method),
				path: normalizeText(params.path)
			}
		});
		const cached = getCacheEntry(cacheKey);
		if (cached) {
			return successResponse(res, 200, "API key usage retrieved successfully.", cached.data);
		}

		// Usage score: capped 0-100 with log10 scaling over the 30-day window (cost_units preferred; fallback to request count).
		const usageScoreSelect = `${buildUsageScoreExpression(hasCostUnits)} AS usage_score`;

		const usageResult = await pool.query(
			`SELECT l.api_key_id,
			        l.api_key_label,
			        l.api_key_prefix,
			        l.user_id,
			        l.user_email,
			        COUNT(*)::int AS request_count,
			        ${usageScoreSelect},
			        MAX(l.logged_at) AS last_seen
			 FROM request_logs l
			 WHERE ${clauses.join(" AND ")}
			 GROUP BY l.api_key_id, l.api_key_label, l.api_key_prefix, l.user_id, l.user_email
			 ORDER BY ${sortColumn} ${sortOrder}
			 LIMIT $${idx} OFFSET $${idx + 1}`,
			[...values, limit ?? 25, offset ?? 0]
		);

		const apiKeys = usageResult.rows.map((row) => ({
			apiKeyId: row.api_key_id,
			apiKeyLabel: row.api_key_label,
			apiKeyPrefix: row.api_key_prefix,
			userId: row.user_id,
			email: row.user_email,
			requestCount: row.request_count,
			usageScore: row.usage_score,
			usageLevel: getUsageLevel(row.usage_score),
			lastSeen: row.last_seen,
			topEndpoints: []
		}));

		if (apiKeys.length > 0) {
			const keyIds = apiKeys.map((k) => k.apiKeyId);
			const topResult = await pool.query(
				`SELECT l.api_key_id, l.method, l.path, COUNT(*)::int AS count
				 FROM request_logs l
				 WHERE l.actor_type = 'api_key'
				   AND l.api_key_id = ANY($1)
				   AND l.logged_at BETWEEN $2 AND $3
				 GROUP BY l.api_key_id, l.method, l.path
				 ORDER BY count DESC`,
				[keyIds, windowStart, windowEnd]
			);
			const grouped = new Map();
			topResult.rows.forEach((row) => {
				if (!grouped.has(row.api_key_id)) grouped.set(row.api_key_id, []);
				grouped.get(row.api_key_id).push({
					method: row.method,
					path: row.path,
					count: row.count
				});
			});
			apiKeys.forEach((key) => {
				const list = grouped.get(key.apiKeyId) || [];
				key.topEndpoints = list.slice(0, topLimit);
			});
		}

		const responseData = {
			configured: true,
			window: { startDate: windowStart, endDate: windowEnd },
			limit: limit ?? 25,
			offset: offset ?? 0,
			usageLevels: USAGE_LEVEL_THRESHOLDS,
			apiKeys
		};
		setCacheEntry(cacheKey, responseData, DEFAULT_ADMIN_TTL_SECONDS);
		return successResponse(res, 200, "API key usage retrieved successfully.", responseData);
	} catch (error) {
		logToFile("ADMIN_USAGE_API_KEYS", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve usage analytics at this time."]);
	}
};

router.get("/usage/api-keys", adminAuth, adminUsageApiKeysHandler);
router.post("/usage/api-keys", adminAuth, adminUsageApiKeysHandler);

const MAX_LANGUAGE_NAME_LENGTH = 100;
const MAX_LIST_LIMIT = 200;
const MAX_REASON_LENGTH = 500;
const MAX_EMAIL_LENGTH = 255;
const MAX_EMAIL_SUBJECT_LENGTH = 160;
const MAX_EMAIL_BODY_LENGTH = 8000;
const VALID_ROLES = new Set(["user", "admin"]);
// Usage score bands for a 0-100 scale.
const USAGE_LEVEL_THRESHOLDS = [
	{ label: "Low", min: 0, max: 39 },
	{ label: "Medium", min: 40, max: 69 },
	{ label: "High", min: 70, max: 89 },
	{ label: "Very High", min: 90, max: 100 }
];
const USAGE_SCORE_REFERENCE = 5000;
const USAGE_SCORE_WINDOW_DAYS = 30;

function buildUsageScoreExpression(hasCostUnits, reference = USAGE_SCORE_REFERENCE) {
	const metric = hasCostUnits ? "COALESCE(SUM(l.cost_units), COUNT(*))" : "COUNT(*)";
	return `LEAST(100, ROUND(100 * LOG(10, 1 + ${metric}) / LOG(10, 1 + ${reference})))::int`;
}
// This list should mirror api/database-tables.txt (sanitized, read-only).
const DATA_VIEWER_TABLES = [
	{
		name: "users",
		label: "Users",
		description: "Basic user profile data without credentials.",
		from: "users u",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "u.id" },
			{ name: "full_name", label: "Full name", type: "text", select: "u.full_name" },
			{ name: "preferred_name", label: "Preferred name", type: "text", select: "u.preferred_name" },
			{ name: "email", label: "Email", type: "text", select: "u.email" },
			{ name: "role", label: "Role", type: "text", select: "u.role" },
			{ name: "is_verified", label: "Verified", type: "boolean", select: "u.is_verified" },
			{ name: "is_disabled", label: "Disabled", type: "boolean", select: "u.is_disabled" },
			{ name: "api_key_ban_enabled", label: "API key blocked", type: "boolean", select: "u.api_key_ban_enabled" },
			{ name: "usage_lockout_until", label: "Usage lockout until", type: "datetime", select: "u.usage_lockout_until" },
			{ name: "last_login", label: "Last login", type: "datetime", select: "u.last_login" },
			{ name: "created_at", label: "Created", type: "datetime", select: "u.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "u.updated_at" }
		],
		searchColumns: ["u.full_name", "u.preferred_name", "u.email"],
		sortFields: [
			{ value: "created_at", label: "Created", column: "u.created_at" },
			{ value: "updated_at", label: "Updated", column: "u.updated_at" },
			{ value: "last_login", label: "Last login", column: "u.last_login" },
			{ value: "full_name", label: "Full name", column: "u.full_name" }
		],
		defaultSort: "created_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "u.id", emailColumn: "u.email" }
	},
	{
		name: "verification_tokens",
		label: "Verification tokens",
		description: "Verification and reset tokens without the raw token values.",
		from: "verification_tokens vt",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "vt.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "vt.user_id" },
			{ name: "token_type", label: "Token type", type: "text", select: "vt.token_type" },
			{ name: "expires_at", label: "Expires", type: "datetime", select: "vt.expires_at" },
			{ name: "used", label: "Used", type: "boolean", select: "vt.used" },
			{ name: "created_at", label: "Created", type: "datetime", select: "vt.created_at" }
		],
		searchColumns: ["vt.token_type"],
		sortFields: [
			{ value: "created_at", label: "Created", column: "vt.created_at" },
			{ value: "expires_at", label: "Expires", column: "vt.expires_at" }
		],
		defaultSort: "created_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "vt.user_id" }
	},
	{
		name: "oauth_accounts",
		label: "OAuth accounts",
		description: "OAuth connections without access or refresh tokens.",
		from: "oauth_accounts oa",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "oa.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "oa.user_id" },
			{ name: "provider", label: "Provider", type: "text", select: "oa.provider" },
			{ name: "provider_user_id", label: "Provider user ID", type: "text", select: "oa.provider_user_id" },
			{ name: "scopes", label: "Scopes", type: "json", select: "oa.scopes" },
			{ name: "created_at", label: "Created", type: "datetime", select: "oa.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "oa.updated_at" }
		],
		searchColumns: ["oa.provider", "oa.provider_user_id"],
		sortFields: [
			{ value: "created_at", label: "Created", column: "oa.created_at" },
			{ value: "provider", label: "Provider", column: "oa.provider" }
		],
		defaultSort: "created_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "oa.user_id" }
	},
	{
		name: "refresh_tokens",
		label: "Refresh tokens",
		description: "Refresh token metadata without fingerprints.",
		from: "refresh_tokens rt",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "rt.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "rt.user_id" },
			{ name: "issued_at", label: "Issued", type: "datetime", select: "rt.issued_at" },
			{ name: "expires_at", label: "Expires", type: "datetime", select: "rt.expires_at" },
			{ name: "revoked", label: "Revoked", type: "boolean", select: "rt.revoked" },
			{ name: "ip_address", label: "IP address", type: "text", select: "rt.ip_address" },
			{ name: "user_agent", label: "User agent", type: "text", select: "rt.user_agent" }
		],
		searchColumns: ["rt.user_agent"],
		sortFields: [
			{ value: "issued_at", label: "Issued", column: "rt.issued_at" },
			{ value: "expires_at", label: "Expires", column: "rt.expires_at" }
		],
		defaultSort: "issued_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "rt.user_id" }
	},
	{
		name: "languages",
		label: "Languages",
		description: "Global languages list used across libraries.",
		from: "languages l",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "l.id" },
			{ name: "name", label: "Name", type: "text", select: "l.name" },
			{ name: "name_normalized", label: "Normalized", type: "text", select: "l.name_normalized" },
			{ name: "created_at", label: "Created", type: "datetime", select: "l.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "l.updated_at" }
		],
		searchColumns: ["l.name", "l.name_normalized"],
		sortFields: [
			{ value: "name", label: "Name", column: "l.name" },
			{ value: "created_at", label: "Created", column: "l.created_at" },
			{ value: "updated_at", label: "Updated", column: "l.updated_at" }
		],
		defaultSort: "name",
		defaultOrder: "asc"
	},
	{
		name: "book_types",
		label: "Book types",
		description: "User-defined book type records.",
		from: "book_types bt",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "bt.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "bt.user_id" },
			{ name: "name", label: "Name", type: "text", select: "bt.name" },
			{ name: "description", label: "Description", type: "text", select: "bt.description" },
			{ name: "created_at", label: "Created", type: "datetime", select: "bt.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "bt.updated_at" }
		],
		searchColumns: ["bt.name", "bt.description"],
		sortFields: [
			{ value: "name", label: "Name", column: "bt.name" },
			{ value: "created_at", label: "Created", column: "bt.created_at" },
			{ value: "updated_at", label: "Updated", column: "bt.updated_at" }
		],
		defaultSort: "name",
		defaultOrder: "asc",
		filters: { userIdColumn: "bt.user_id" }
	},
	{
		name: "dates",
		label: "Dates",
		description: "Parsed date fragments used by other records.",
		from: "dates d",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "d.id" },
			{ name: "day", label: "Day", type: "number", select: "d.day" },
			{ name: "month", label: "Month", type: "number", select: "d.month" },
			{ name: "year", label: "Year", type: "number", select: "d.year" },
			{ name: "text", label: "Text", type: "text", select: "d.text" },
			{ name: "created_at", label: "Created", type: "datetime", select: "d.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "d.updated_at" }
		],
		searchColumns: ["d.text"],
		sortFields: [
			{ value: "created_at", label: "Created", column: "d.created_at" },
			{ value: "year", label: "Year", column: "d.year" }
		],
		defaultSort: "created_at",
		defaultOrder: "desc"
	},
	{
		name: "authors",
		label: "Authors",
		description: "Author records with soft-delete status.",
		from: "authors a",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "a.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "a.user_id" },
			{ name: "display_name", label: "Display name", type: "text", select: "a.display_name" },
			{ name: "first_names", label: "First names", type: "text", select: "a.first_names" },
			{ name: "last_name", label: "Last name", type: "text", select: "a.last_name" },
			{ name: "birth_date_id", label: "Birth date ID", type: "number", select: "a.birth_date_id" },
			{ name: "death_date_id", label: "Death date ID", type: "number", select: "a.death_date_id" },
			{ name: "deceased", label: "Deceased", type: "boolean", select: "a.deceased" },
			{ name: "deleted_at", label: "Deleted", type: "datetime", select: "a.deleted_at" },
			{ name: "created_at", label: "Created", type: "datetime", select: "a.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "a.updated_at" }
		],
		searchColumns: ["a.display_name", "a.first_names", "a.last_name"],
		sortFields: [
			{ value: "display_name", label: "Display name", column: "a.display_name" },
			{ value: "created_at", label: "Created", column: "a.created_at" }
		],
		defaultSort: "display_name",
		defaultOrder: "asc",
		filters: { userIdColumn: "a.user_id" }
	},
	{
		name: "publishers",
		label: "Publishers",
		description: "Publisher records with soft-delete status.",
		from: "publishers p",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "p.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "p.user_id" },
			{ name: "name", label: "Name", type: "text", select: "p.name" },
			{ name: "founded_date_id", label: "Founded date ID", type: "number", select: "p.founded_date_id" },
			{ name: "website", label: "Website", type: "text", select: "p.website" },
			{ name: "notes", label: "Notes", type: "text", select: "p.notes" },
			{ name: "deleted_at", label: "Deleted", type: "datetime", select: "p.deleted_at" },
			{ name: "created_at", label: "Created", type: "datetime", select: "p.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "p.updated_at" }
		],
		searchColumns: ["p.name", "p.website"],
		sortFields: [
			{ value: "name", label: "Name", column: "p.name" },
			{ value: "created_at", label: "Created", column: "p.created_at" }
		],
		defaultSort: "name",
		defaultOrder: "asc",
		filters: { userIdColumn: "p.user_id" }
	},
	{
		name: "book_authors",
		label: "Book authors",
		description: "Author assignments to books.",
		from: "book_authors ba",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "ba.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "ba.user_id" },
			{ name: "book_id", label: "Book ID", type: "number", select: "ba.book_id" },
			{ name: "author_id", label: "Author ID", type: "number", select: "ba.author_id" },
			{ name: "role", label: "Role", type: "text", select: "ba.role" },
			{ name: "created_at", label: "Created", type: "datetime", select: "ba.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "ba.updated_at" }
		],
		searchColumns: ["ba.role"],
		sortFields: [
			{ value: "created_at", label: "Created", column: "ba.created_at" }
		],
		defaultSort: "created_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "ba.user_id" }
	},
	{
		name: "book_series",
		label: "Series",
		description: "Series records with soft-delete status.",
		from: "book_series s",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "s.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "s.user_id" },
			{ name: "name", label: "Name", type: "text", select: "s.name" },
			{ name: "description", label: "Description", type: "text", select: "s.description" },
			{ name: "website", label: "Website", type: "text", select: "s.website" },
			{ name: "deleted_at", label: "Deleted", type: "datetime", select: "s.deleted_at" },
			{ name: "created_at", label: "Created", type: "datetime", select: "s.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "s.updated_at" }
		],
		searchColumns: ["s.name", "s.description"],
		sortFields: [
			{ value: "name", label: "Name", column: "s.name" },
			{ value: "created_at", label: "Created", column: "s.created_at" }
		],
		defaultSort: "name",
		defaultOrder: "asc",
		filters: { userIdColumn: "s.user_id" }
	},
	{
		name: "book_series_books",
		label: "Series books",
		description: "Book order within a series.",
		from: "book_series_books sb",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "sb.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "sb.user_id" },
			{ name: "series_id", label: "Series ID", type: "number", select: "sb.series_id" },
			{ name: "book_id", label: "Book ID", type: "number", select: "sb.book_id" },
			{ name: "book_order", label: "Order", type: "number", select: "sb.book_order" },
			{ name: "created_at", label: "Created", type: "datetime", select: "sb.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "sb.updated_at" }
		],
		sortFields: [
			{ value: "created_at", label: "Created", column: "sb.created_at" },
			{ value: "book_order", label: "Order", column: "sb.book_order" }
		],
		defaultSort: "created_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "sb.user_id" }
	},
	{
		name: "storage_locations",
		label: "Storage locations",
		description: "Storage location records for physical copies.",
		from: "storage_locations sl",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "sl.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "sl.user_id" },
			{ name: "name", label: "Name", type: "text", select: "sl.name" },
			{ name: "parent_id", label: "Parent ID", type: "number", select: "sl.parent_id" },
			{ name: "notes", label: "Notes", type: "text", select: "sl.notes" },
			{ name: "created_at", label: "Created", type: "datetime", select: "sl.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "sl.updated_at" }
		],
		searchColumns: ["sl.name", "sl.notes"],
		sortFields: [
			{ value: "name", label: "Name", column: "sl.name" },
			{ value: "created_at", label: "Created", column: "sl.created_at" }
		],
		defaultSort: "name",
		defaultOrder: "asc",
		filters: { userIdColumn: "sl.user_id" }
	},
	{
		name: "book_copies",
		label: "Book copies",
		description: "Physical copy records and acquisition details.",
		from: "book_copies bc",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "bc.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "bc.user_id" },
			{ name: "book_id", label: "Book ID", type: "number", select: "bc.book_id" },
			{ name: "storage_location_id", label: "Storage location ID", type: "number", select: "bc.storage_location_id" },
			{ name: "acquisition_date_id", label: "Acquisition date ID", type: "number", select: "bc.acquisition_date_id" },
			{ name: "acquired_from", label: "Acquired from", type: "text", select: "bc.acquired_from" },
			{ name: "acquisition_type", label: "Acquisition type", type: "text", select: "bc.acquisition_type" },
			{ name: "acquisition_location", label: "Acquisition location", type: "text", select: "bc.acquisition_location" },
			{ name: "notes", label: "Notes", type: "text", select: "bc.notes" },
			{ name: "created_at", label: "Created", type: "datetime", select: "bc.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "bc.updated_at" }
		],
		searchColumns: ["bc.acquired_from", "bc.acquisition_type", "bc.acquisition_location"],
		sortFields: [
			{ value: "created_at", label: "Created", column: "bc.created_at" },
			{ value: "updated_at", label: "Updated", column: "bc.updated_at" }
		],
		defaultSort: "created_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "bc.user_id" }
	},
	{
		name: "books",
		label: "Books",
		description: "Book records with soft-delete status.",
		from: "books b",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "b.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "b.user_id" },
			{ name: "title", label: "Title", type: "text", select: "b.title" },
			{ name: "subtitle", label: "Subtitle", type: "text", select: "b.subtitle" },
			{ name: "isbn", label: "ISBN", type: "text", select: "b.isbn" },
			{ name: "publication_date_id", label: "Publication date ID", type: "number", select: "b.publication_date_id" },
			{ name: "book_type_id", label: "Book type ID", type: "number", select: "b.book_type_id" },
			{ name: "publisher_id", label: "Publisher ID", type: "number", select: "b.publisher_id" },
			{ name: "page_count", label: "Pages", type: "number", select: "b.page_count" },
			{ name: "deleted_at", label: "Deleted", type: "datetime", select: "b.deleted_at" },
			{ name: "created_at", label: "Created", type: "datetime", select: "b.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "b.updated_at" }
		],
		searchColumns: ["b.title", "b.subtitle", "b.isbn"],
		sortFields: [
			{ value: "title", label: "Title", column: "b.title" },
			{ value: "created_at", label: "Created", column: "b.created_at" }
		],
		defaultSort: "title",
		defaultOrder: "asc",
		filters: { userIdColumn: "b.user_id" }
	},
	{
		name: "book_languages",
		label: "Library languages",
		description: "Language assignments within user libraries.",
		from: "book_languages bl LEFT JOIN languages l ON l.id = bl.language_id",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "bl.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "bl.user_id" },
			{ name: "language_id", label: "Language ID", type: "number", select: "bl.language_id" },
			{ name: "language_name", label: "Language", type: "text", select: "l.name" },
			{ name: "created_at", label: "Created", type: "datetime", select: "bl.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "bl.updated_at" }
		],
		searchColumns: ["l.name"],
		sortFields: [
			{ value: "created_at", label: "Created", column: "bl.created_at" },
			{ value: "updated_at", label: "Updated", column: "bl.updated_at" },
			{ value: "language_name", label: "Language", column: "l.name" }
		],
		defaultSort: "created_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "bl.user_id" }
	},
	{
		name: "tags",
		label: "Tags",
		description: "Tags assigned to books.",
		from: "tags t",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "t.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "t.user_id" },
			{ name: "name", label: "Name", type: "text", select: "t.name" },
			{ name: "name_normalized", label: "Normalized", type: "text", select: "t.name_normalized" },
			{ name: "created_at", label: "Created", type: "datetime", select: "t.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "t.updated_at" }
		],
		searchColumns: ["t.name", "t.name_normalized"],
		sortFields: [
			{ value: "name", label: "Name", column: "t.name" },
			{ value: "created_at", label: "Created", column: "t.created_at" }
		],
		defaultSort: "name",
		defaultOrder: "asc",
		filters: { userIdColumn: "t.user_id" }
	},
	{
		name: "book_tags",
		label: "Book tags",
		description: "Tag assignments on books.",
		from: "book_tags bt",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "bt.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "bt.user_id" },
			{ name: "book_id", label: "Book ID", type: "number", select: "bt.book_id" },
			{ name: "tag_id", label: "Tag ID", type: "number", select: "bt.tag_id" },
			{ name: "created_at", label: "Created", type: "datetime", select: "bt.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "bt.updated_at" }
		],
		sortFields: [
			{ value: "created_at", label: "Created", column: "bt.created_at" }
		],
		defaultSort: "created_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "bt.user_id" }
	},
	{
		name: "user_api_keys",
		label: "API keys",
		description: "API key metadata without hashes or prefixes.",
		from: "user_api_keys k LEFT JOIN users u ON u.id = k.user_id",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "k.id" },
			{ name: "user_id", label: "User ID", type: "number", select: "k.user_id" },
			{ name: "user_email", label: "User email", type: "text", select: "u.email" },
			{ name: "name", label: "Label", type: "text", select: "k.name" },
			{ name: "last_used_at", label: "Last used", type: "datetime", select: "k.last_used_at" },
			{ name: "expires_at", label: "Expires", type: "datetime", select: "k.expires_at" },
			{ name: "revoked_at", label: "Revoked", type: "datetime", select: "k.revoked_at" },
			{ name: "created_at", label: "Created", type: "datetime", select: "k.created_at" },
			{ name: "updated_at", label: "Updated", type: "datetime", select: "k.updated_at" }
		],
		searchColumns: ["k.name", "u.email"],
		sortFields: [
			{ value: "created_at", label: "Created", column: "k.created_at" },
			{ value: "last_used_at", label: "Last used", column: "k.last_used_at" },
			{ value: "expires_at", label: "Expires", column: "k.expires_at" },
			{ value: "name", label: "Label", column: "k.name" }
		],
		defaultSort: "created_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "k.user_id", emailColumn: "u.email" }
	},
	{
		name: "request_logs",
		label: "Request logs",
		description: "Recent API activity without full payloads.",
		from: "request_logs l",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "l.id" },
			{ name: "logged_at", label: "Logged", type: "datetime", select: "l.logged_at" },
			{ name: "level", label: "Level", type: "text", select: "l.level" },
			{ name: "category", label: "Category", type: "text", select: "l.category" },
			{ name: "correlation_id", label: "Correlation", type: "text", select: "l.correlation_id" },
			{ name: "method", label: "Method", type: "text", select: "l.method" },
			{ name: "path", label: "Path", type: "text", select: "l.path" },
			{ name: "route_pattern", label: "Route", type: "text", select: "l.route_pattern" },
			{ name: "actor_type", label: "Actor", type: "text", select: "l.actor_type" },
			{ name: "user_id", label: "User ID", type: "number", select: "l.user_id" },
			{ name: "user_email", label: "User email", type: "text", select: "l.user_email" },
			{ name: "api_key_label", label: "API key label", type: "text", select: "l.api_key_label" },
			{ name: "status_code", label: "Status", type: "number", select: "l.status_code" },
			{ name: "duration_ms", label: "Duration (ms)", type: "number", select: "l.duration_ms" },
			{ name: "cost_units", label: "Cost", type: "number", select: "l.cost_units" },
			{ name: "error_summary", label: "Error summary", type: "text", select: "l.error_summary" },
			{ name: "request_bytes", label: "Request bytes", type: "number", select: "l.request_bytes" },
			{ name: "response_bytes", label: "Response bytes", type: "number", select: "l.response_bytes" }
		],
		searchColumns: ["l.path", "l.user_email", "l.api_key_label", "l.correlation_id"],
		sortFields: [
			{ value: "logged_at", label: "Logged", column: "l.logged_at" },
			{ value: "status_code", label: "Status", column: "l.status_code" },
			{ value: "duration_ms", label: "Duration", column: "l.duration_ms" },
			{ value: "cost_units", label: "Cost", column: "l.cost_units" }
		],
		defaultSort: "logged_at",
		defaultOrder: "desc",
		filters: { userIdColumn: "l.user_id", emailColumn: "l.user_email" }
	},
	{
		name: "email_send_history",
		label: "Email send history",
		description: "Send attempts without email content.",
		from: "email_send_history eh",
		columns: [
			{ name: "id", label: "ID", type: "number", select: "eh.id" },
			{ name: "email_type", label: "Type", type: "text", select: "eh.email_type" },
			{ name: "recipient_email", label: "Recipient", type: "text", select: "eh.recipient_email" },
			{ name: "queued_at", label: "Queued", type: "datetime", select: "eh.queued_at" },
			{ name: "sent_at", label: "Sent", type: "datetime", select: "eh.sent_at" },
			{ name: "status", label: "Status", type: "text", select: "eh.status" },
			{ name: "retry_count", label: "Retries", type: "number", select: "eh.retry_count" },
			{ name: "failure_reason", label: "Failure reason", type: "text", select: "eh.failure_reason" }
		],
		searchColumns: ["eh.email_type", "eh.recipient_email", "eh.status"],
		sortFields: [
			{ value: "queued_at", label: "Queued", column: "eh.queued_at" },
			{ value: "sent_at", label: "Sent", column: "eh.sent_at" }
		],
		defaultSort: "queued_at",
		defaultOrder: "desc"
	}
];
// Sanitization strategy: denylist-based redaction with a small allowlist override.
// If unsure, fields are redacted rather than exposed.
const DATA_VIEWER_REDACT_COLUMN_PATTERN = /(password|token|secret|hash|api[_-]?key|authorization|cookie|refresh|access)/i;
const DATA_VIEWER_SAFE_COLUMNS = new Set([
	"token_type",
	"api_key_label",
	"api_key_ban_enabled"
]);
const DATA_VIEWER_REDACT_VALUE_PATTERNS = [
	/^bearer\s+/i,
	/^apikey\s+/i,
	/^api-key\s+/i,
	/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/,
	/^[A-Fa-f0-9]{32,}$/,
	/^[A-Za-z0-9-_]{32,}$/
];
const TOKEN_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const LOGS_NOT_CONFIGURED_MESSAGE = "Request logs are not configured. Create the request_logs table and enable request logging.";
const TOKEN_EMAIL_TYPES = new Set([
	"verification",
	"password_reset",
	"account_disable_verification",
	"account_delete_verification",
	"email_change_verification",
	"admin_account_setup"
]);
const TOKEN_EXPIRY_DEFAULTS = {
	verification: 30,
	password_reset: 30,
	account_disable_verification: 60,
	account_delete_verification: 60,
	email_change_verification: 60,
	admin_account_setup: 60
};
let lastTokenCleanupAt = 0;

const EMAIL_TYPE_METADATA = {
	verification: {
		description: "Verification link for new sign-ins or email confirmation.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	password_reset: {
		description: "Password reset link for a user who requested help.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	welcome: {
		description: "Welcome message for newly created accounts.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	password_reset_success: {
		description: "Confirmation that a password reset completed.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	account_disable_verification: {
		description: "Verification link before disabling an account.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	account_disable_confirmation: {
		description: "Confirmation that an account was disabled.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	account_delete_verification: {
		description: "Verification link before deleting an account.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	account_delete_admin_notice: {
		description: "Admin notice when a user requests account deletion.",
		fields: [
			{ name: "userFullName", label: "User full name", type: "text", placeholder: "Avery Reader" },
			{ name: "userPreferredName", label: "User preferred name", type: "text", placeholder: "Avery" },
			{ name: "userId", label: "User ID", type: "number", placeholder: "123" },
			{ name: "requestIp", label: "Request IP", type: "text", placeholder: "203.0.113.5" },
			{ name: "requestedAt", label: "Requested at", type: "datetime-local" }
		]
	},
	email_change_verification: {
		description: "Verification link for an email address change.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	email_change_confirmation: {
		description: "Confirmation that an email change was completed.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "newEmail", label: "New email", type: "email", placeholder: "new@example.com", required: true }
		]
	},
	admin_profile_update: {
		description: "Notice that a profile was updated by an admin.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "changeSummary", label: "Change summary", type: "text", placeholder: "Role updated to admin", required: true }
		]
	},
	admin_account_disabled: {
		description: "Notice that an admin disabled the account.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	admin_account_enabled: {
		description: "Notice that an admin re-enabled the account.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	admin_email_unverified: {
		description: "Notice that an admin marked the email as unverified.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "reason", label: "Reason", type: "text", placeholder: "Email bounced", required: true, maxLength: MAX_REASON_LENGTH }
		]
	},
	admin_email_verified: {
		description: "Notice that an admin verified the email address.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "reason", label: "Reason", type: "text", placeholder: "Identity confirmed", required: true, maxLength: MAX_REASON_LENGTH }
		]
	},
	admin_account_setup: {
		description: "Account setup message with verification details.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	dev_features_announcement: {
		description: "Announcement email for development updates.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "subject", label: "Subject", type: "text", placeholder: "The Book Project update", required: true, maxLength: MAX_EMAIL_SUBJECT_LENGTH },
			{ name: "markdownBody", label: "Markdown body", type: "textarea", placeholder: "## Release notes\n- New features...", required: true, maxLength: MAX_EMAIL_BODY_LENGTH }
		]
	},
	api_key_created: {
		description: "Notice that an API key was created.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "keyName", label: "Key name", type: "text", placeholder: "Primary key", required: true },
			{ name: "keyPrefix", label: "Key prefix", type: "text", placeholder: "bk_1234", required: true },
			{ name: "expiresAt", label: "Expires at", type: "datetime-local" }
		]
	},
	api_key_revoked: {
		description: "Notice that an API key was revoked.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "keyName", label: "Key name", type: "text", placeholder: "Primary key", required: true },
			{ name: "keyPrefix", label: "Key prefix", type: "text", placeholder: "bk_1234", required: true }
		]
	},
	api_key_ban_applied: {
		description: "Notice that API key creation was blocked.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "reason", label: "Reason", type: "text", placeholder: "Usage policy violation", required: true, maxLength: MAX_REASON_LENGTH }
		]
	},
	api_key_ban_removed: {
		description: "Notice that API key creation was allowed again.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" }
		]
	},
	usage_warning_api_key: {
		description: "Usage warning for API key activity.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "keyName", label: "Key name", type: "text", placeholder: "Primary key", required: true },
			{ name: "usageLevel", label: "Usage level", type: "text", placeholder: "High", required: true, helpText: "Use the current usage level (Low, Medium, High, Very High)." }
		]
	},
	api_key_expiring: {
		description: "Notice that an API key is expiring soon.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "keyName", label: "Key name", type: "text", placeholder: "Primary key", required: true },
			{ name: "keyPrefix", label: "Key prefix", type: "text", placeholder: "bk_1234", required: true },
			{ name: "expiresAt", label: "Expires at", type: "datetime-local" }
		]
	},
	api_key_expired: {
		description: "Notice that an API key has expired.",
		fields: [
			{ name: "preferredName", label: "Preferred name", type: "text", placeholder: "Avery" },
			{ name: "keyName", label: "Key name", type: "text", placeholder: "Primary key", required: true },
			{ name: "keyPrefix", label: "Key prefix", type: "text", placeholder: "bk_1234", required: true }
		]
	}
};

function normalizeEmailTypeField(field) {
	return {
		name: field.name,
		label: field.label || field.name,
		type: field.type || "text",
		placeholder: field.placeholder || "",
		required: Boolean(field.required),
		helpText: field.helpText || "",
		maxLength: Number.isInteger(field.maxLength) ? field.maxLength : null,
		pattern: field.pattern || null
	};
}

function resolveEmailTypeMetadata(emailType) {
	const meta = EMAIL_TYPE_METADATA[emailType] || { description: "Email preview for the selected template.", fields: [] };
	const fields = Array.isArray(meta.fields) ? meta.fields.map(normalizeEmailTypeField) : [];
	return {
		description: meta.description || "Email preview for the selected template.",
		fields
	};
}

function validateEmailTypeContext(emailType, context = {}) {
	const meta = resolveEmailTypeMetadata(emailType);
	const errors = [];
	const fields = Array.isArray(meta.fields) ? meta.fields : [];
	fields.forEach((field) => {
		const label = field.label || field.name;
		let value = context[field.name];
		if (field.name === "changeSummary") {
			value = Array.isArray(context.changes) ? context.changes[0]?.newValue : null;
		}
		const isBlank = value === null || value === undefined || (typeof value === "string" && !value.trim());
		if (field.required && isBlank) {
			errors.push(`${label} is required.`);
			return;
		}
		if (isBlank) return;
		if (field.type === "number") {
			const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
			if (!Number.isInteger(parsed)) {
				errors.push(`${label} must be a number.`);
				return;
			}
		}
		if (field.type === "email") {
			const emailError = validateEmail(String(value));
			if (emailError) errors.push(emailError.replace("Email", label));
		}
		if (field.type === "datetime-local") {
			const parsed = Date.parse(String(value));
			if (Number.isNaN(parsed)) {
				errors.push(`${label} must be a valid date and time.`);
				return;
			}
		}
		if (typeof value === "string" && Number.isInteger(field.maxLength) && value.length > field.maxLength) {
			errors.push(`${label} must be ${field.maxLength} characters or fewer.`);
		}
		if (typeof value === "string" && field.pattern) {
			try {
				const pattern = new RegExp(field.pattern);
				if (!pattern.test(value)) {
					errors.push(`${label} has an invalid format.`);
				}
			} catch (err) {
				errors.push(`${label} has an invalid format pattern.`);
			}
		}
	});
	return errors;
}

function normalizeText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
}

function normalizeEmail(value) {
	if (typeof value !== "string") return "";
	return value.trim().toLowerCase();
}

function parseBooleanFlag(value) {
	if (value === undefined || value === null || value === "") return null;
	if (typeof value === "boolean") return value;
	const normalized = String(value).trim().toLowerCase();
	if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
	if (normalized === "false" || normalized === "0" || normalized === "no") return false;
	return null;
}

const DEV_FEATURES_TEST_WINDOW_MS = 12 * 60 * 60 * 1000;
const devFeaturesTestGate = new Map();

function buildDevFeaturesSignature(subject, markdownBody) {
	const seed = `${String(subject || "").trim()}::${String(markdownBody || "").trim()}`;
	return crypto.createHash("sha256").update(seed).digest("hex");
}

function recordDevFeaturesTest(adminId, subject, markdownBody) {
	if (!adminId) return;
	devFeaturesTestGate.set(adminId, {
		signature: buildDevFeaturesSignature(subject, markdownBody),
		testedAt: Date.now()
	});
}

function hasRecentDevFeaturesTest(adminId, subject, markdownBody) {
	if (!adminId) return false;
	const entry = devFeaturesTestGate.get(adminId);
	if (!entry) return false;
	if (Date.now() - entry.testedAt > DEV_FEATURES_TEST_WINDOW_MS) return false;
	return entry.signature === buildDevFeaturesSignature(subject, markdownBody);
}

function parseId(value) {
	if (value === undefined || value === null || value === "") return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) return null;
	return parsed;
}

function parseSortOrder(value) {
	if (!value) return "asc";
	const normalized = String(value).trim().toLowerCase();
	if (normalized === "asc" || normalized === "desc") return normalized;
	return null;
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

function parseLockoutExpiry(params = {}) {
	const expiresAtInput = params.expiresAt || params.lockoutUntil;
	const durationMinutes = params.durationMinutes !== undefined ? Number.parseInt(params.durationMinutes, 10) : null;
	if (expiresAtInput) {
		const parsed = Date.parse(expiresAtInput);
		if (Number.isNaN(parsed)) {
			return { error: "expiresAt must be a valid ISO 8601 date." };
		}
		return { value: new Date(parsed).toISOString() };
	}
	if (Number.isInteger(durationMinutes)) {
		if (durationMinutes < 5 || durationMinutes > 43200) {
			return { error: "durationMinutes must be between 5 and 43200." };
		}
		const until = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
		return { value: until };
	}
	return { error: "Provide expiresAt or durationMinutes." };
}

function parseDateFilter(value, fieldLabel) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) {
		return { error: `${fieldLabel} must be a valid ISO 8601 date.` };
	}
	return { value: new Date(parsed).toISOString() };
}

let requestLogsAvailability = null;
let usersColumnAvailability = null;
const tableExistsCache = new Map();

async function getRequestLogsAvailability() {
	if (requestLogsAvailability) return requestLogsAvailability;
	try {
		const tableResult = await pool.query("SELECT to_regclass('public.request_logs') AS table_exists");
		const hasTable = Boolean(tableResult.rows[0]?.table_exists);
		let hasCostUnits = false;
		if (hasTable) {
			const colResult = await pool.query(
				`SELECT 1
				 FROM information_schema.columns
				 WHERE table_schema = 'public'
				   AND table_name = 'request_logs'
				   AND column_name = 'cost_units'
				 LIMIT 1`
			);
			hasCostUnits = colResult.rows.length > 0;
		}
		requestLogsAvailability = { hasTable, hasCostUnits };
		return requestLogsAvailability;
	} catch (error) {
		logToFile("ADMIN_USERS_SCHEMA_CHECK", {
			status: "FAILURE",
			error_message: error.message
		}, "error");
		requestLogsAvailability = { hasTable: false, hasCostUnits: false };
		return requestLogsAvailability;
	}
}

async function getUsersColumnAvailability() {
	if (usersColumnAvailability) return usersColumnAvailability;
	try {
		const result = await pool.query(
			`SELECT column_name
			 FROM information_schema.columns
			 WHERE table_schema = 'public'
			   AND table_name = 'users'`
		);
		usersColumnAvailability = new Set(result.rows.map((row) => row.column_name));
		return usersColumnAvailability;
	} catch (error) {
		logToFile("ADMIN_USERS_SCHEMA_CHECK", {
			status: "FAILURE",
			error_message: error.message
		}, "error");
		usersColumnAvailability = new Set();
		return usersColumnAvailability;
	}
}

async function tableExists(tableName) {
	if (tableExistsCache.has(tableName)) return tableExistsCache.get(tableName);
	try {
		const result = await pool.query("SELECT to_regclass($1) AS table_exists", [`public.${tableName}`]);
		const exists = Boolean(result.rows[0]?.table_exists);
		tableExistsCache.set(tableName, exists);
		return exists;
	} catch (error) {
		logToFile("ADMIN_TABLE_CHECK", {
			status: "FAILURE",
			error_message: error.message,
			table: tableName
		}, "error");
		tableExistsCache.set(tableName, false);
		return false;
	}
}

function getDataViewerTableConfig(name) {
	if (!name) return null;
	return DATA_VIEWER_TABLES.find((table) => table.name === name) || null;
}

function stripTablePrefix(value) {
	if (!value || typeof value !== "string") return value;
	const parts = value.split(".");
	return parts[parts.length - 1];
}

async function resolveDataViewerConfig(tableConfig) {
	if (!tableConfig || tableConfig.name !== "users") return tableConfig;
	const availability = await getUsersColumnAvailability();
	const columns = tableConfig.columns.filter((col) => availability.has(col.name));
	const sortFields = tableConfig.sortFields.filter((field) => availability.has(stripTablePrefix(field.column)));
	const searchColumns = (tableConfig.searchColumns || []).filter((col) => availability.has(stripTablePrefix(col)));
	const defaultSort = sortFields.some((field) => field.value === tableConfig.defaultSort)
		? tableConfig.defaultSort
		: (sortFields[0]?.value || tableConfig.defaultSort);
	return {
		...tableConfig,
		columns,
		sortFields,
		searchColumns,
		defaultSort
	};
}

function shouldRedactDataViewerColumn(name) {
	if (!name) return false;
	if (DATA_VIEWER_SAFE_COLUMNS.has(String(name))) return false;
	return DATA_VIEWER_REDACT_COLUMN_PATTERN.test(String(name));
}

function shouldRedactDataViewerValue(value) {
	if (typeof value !== "string") return false;
	const trimmed = value.trim();
	if (!trimmed) return false;
	return DATA_VIEWER_REDACT_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function redactDataViewerValue(value, columnName) {
	const normalized = value instanceof Date ? value.toISOString() : value;
	const sanitized = sanitizeInput(normalized, columnName);
	if (sanitized === null || sanitized === undefined) return sanitized;
	if (shouldRedactDataViewerColumn(columnName)) return "[REDACTED]";
	if (shouldRedactDataViewerValue(sanitized)) return "[REDACTED]";
	return sanitized;
}

const adminDataViewerTablesHandler = async (req, res) => {
	try {
		const tables = await Promise.all(DATA_VIEWER_TABLES.map(async (table) => {
			const resolved = await resolveDataViewerConfig(table);
			return {
				name: resolved.name,
				label: resolved.label,
				description: resolved.description,
				defaultSort: resolved.defaultSort,
				defaultOrder: resolved.defaultOrder,
				sortFields: resolved.sortFields.map((field) => ({
					value: field.value,
					label: field.label
				}))
			};
		}));
		return successResponse(res, 200, "Data viewer tables retrieved successfully.", { tables });
	} catch (error) {
		logToFile("ADMIN_DATA_VIEWER_TABLES", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to load data viewer tables."]);
	}
};

const adminDataViewerQueryHandler = async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const tableName = normalizeText(params.table);
	const tableConfig = getDataViewerTableConfig(tableName);
	if (!tableConfig) {
		return errorResponse(res, 400, "Validation Error", ["Table is not available."]);
	}
	const tableAvailable = await tableExists(tableConfig.name);
	if (!tableAvailable) {
		return errorResponse(res, 400, "Validation Error", ["Table is not available."]);
	}
	const resolvedConfig = await resolveDataViewerConfig(tableConfig);
	if (!resolvedConfig.columns.length) {
		return errorResponse(res, 400, "Validation Error", ["Table columns are not available."]);
	}

	const { value: limit, error: limitError } = parseOptionalInt(params.limit, "limit", { min: 5, max: 200 });
	const { value: page, error: pageError } = parseOptionalInt(params.page, "page", { min: 1, max: 10000 });
	const { value: userId, error: userIdError } = parseOptionalInt(params.userId, "userId", { min: 1, max: null });

	const errors = [];
	if (limitError) errors.push(limitError);
	if (pageError) errors.push(pageError);
	if (userIdError) errors.push(userIdError);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const search = normalizeText(params.search);
	const email = normalizeText(params.email);
	const sortKey = normalizeText(params.sortBy);
	const order = (parseSortOrder(params.order) || resolvedConfig.defaultOrder || "desc").toUpperCase();

	const clauses = [];
	const values = [];
	let idx = 1;

	if (search && resolvedConfig.searchColumns?.length) {
		clauses.push(`(${resolvedConfig.searchColumns.map((col) => `${col} ILIKE $${idx}`).join(" OR ")})`);
		values.push(`%${search}%`);
		idx += 1;
	}

	if (Number.isInteger(userId) && resolvedConfig.filters?.userIdColumn) {
		clauses.push(`${resolvedConfig.filters.userIdColumn} = $${idx++}`);
		values.push(userId);
	}

	if (email && resolvedConfig.filters?.emailColumn) {
		clauses.push(`${resolvedConfig.filters.emailColumn} ILIKE $${idx++}`);
		values.push(`%${email}%`);
	}

	const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
	const limitValue = limit ?? 25;
	const pageValue = page ?? 1;
	const offsetValue = (pageValue - 1) * limitValue;
	const sortField = resolvedConfig.sortFields.find((field) => field.value === sortKey)
		|| resolvedConfig.sortFields.find((field) => field.value === resolvedConfig.defaultSort)
		|| resolvedConfig.sortFields[0];
	if (!sortField) {
		return errorResponse(res, 400, "Validation Error", ["Sort field is not available."]);
	}

	try {
		const countResult = await pool.query(
			`SELECT COUNT(*)::int AS count FROM ${resolvedConfig.from} ${whereClause}`,
			values
		);
		const total = countResult.rows[0]?.count ?? 0;
		const selectList = resolvedConfig.columns.map((col) => `${col.select} AS ${col.name}`).join(", ");
		const rowsResult = await pool.query(
			`SELECT ${selectList}
			 FROM ${resolvedConfig.from}
			 ${whereClause}
			 ORDER BY ${sortField.column} ${order}
			 LIMIT $${idx} OFFSET $${idx + 1}`,
			[...values, limitValue, offsetValue]
		);
		const rows = rowsResult.rows || [];
		const sanitizedRows = rows.map((row) => {
			const safeRow = {};
			resolvedConfig.columns.forEach((col) => {
				safeRow[col.name] = redactDataViewerValue(row[col.name], col.name);
			});
			return safeRow;
		});
		const hasNext = offsetValue + rows.length < total;
		return successResponse(res, 200, "Data viewer results retrieved successfully.", {
			table: resolvedConfig.name,
			columns: resolvedConfig.columns.map((col) => ({
				name: col.name,
				label: col.label,
				type: col.type
			})),
			rows: sanitizedRows,
			count: rows.length,
			total,
			page: pageValue,
			limit: limitValue,
			hasNext
		});
	} catch (error) {
		logToFile("ADMIN_DATA_VIEWER_QUERY", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to load data viewer results."]);
	}
};

router.get("/data-viewer/tables", adminAuth, adminDataViewerTablesHandler);
router.post("/data-viewer/tables", adminAuth, adminDataViewerTablesHandler);
router.get("/data-viewer/query", adminAuth, adminDataViewerQueryHandler);
router.post("/data-viewer/query", adminAuth, adminDataViewerQueryHandler);

function getUsageLevel(score) {
	const value = Number.isFinite(score) ? score : 0;
	const match = USAGE_LEVEL_THRESHOLDS.find((range) => value >= range.min && value <= range.max);
	return match ? match.label : "Low";
}

function resolveDefaultExpiry(emailType) {
	return TOKEN_EXPIRY_DEFAULTS[emailType] || 60;
}

const EMAIL_TYPE_HANDLERS = {
	verification: async (payload) => email.sendVerificationEmail(payload.toEmail, payload.token, payload.preferredName, payload.expiresIn),
	password_reset: async (payload) => email.sendPasswordResetEmail(payload.toEmail, payload.token, payload.preferredName, payload.expiresIn),
	welcome: async (payload) => email.sendWelcomeEmail(payload.toEmail, payload.preferredName),
	password_reset_success: async (payload) => email.sendPasswordResetSuccessEmail(payload.toEmail, payload.preferredName),
	account_disable_verification: async (payload) => email.sendAccountDisableVerificationEmail(payload.toEmail, payload.preferredName, payload.token, payload.expiresIn),
	account_disable_confirmation: async (payload) => email.sendAccountDisableConfirmationEmail(payload.toEmail, payload.preferredName),
	account_delete_verification: async (payload) => email.sendAccountDeletionVerificationEmail(payload.toEmail, payload.preferredName, payload.token, payload.expiresIn),
	account_delete_admin_notice: async (payload) => email.sendAccountDeletionAdminEmail(payload),
	email_change_verification: async (payload) => email.sendEmailChangeVerificationEmail(payload.toEmail, payload.preferredName, payload.token, payload.expiresIn),
	email_change_confirmation: async (payload) => email.sendEmailChangeConfirmationEmail(payload.toEmail, payload.newEmail, payload.preferredName),
	admin_profile_update: async (payload) => email.sendAdminProfileUpdateEmail(payload.toEmail, payload.preferredName, payload.changes),
	admin_account_disabled: async (payload) => email.sendAdminAccountDisabledEmail(payload.toEmail, payload.preferredName),
	admin_account_enabled: async (payload) => email.sendAdminAccountEnabledEmail(payload.toEmail, payload.preferredName),
	admin_email_unverified: async (payload) => email.sendAdminEmailUnverifiedEmail(payload.toEmail, payload.preferredName, payload.reason),
	admin_email_verified: async (payload) => email.sendAdminEmailVerifiedEmail(payload.toEmail, payload.preferredName, payload.reason),
	admin_account_setup: async (payload) => email.sendAdminAccountSetupEmail(payload.toEmail, payload.preferredName, payload.verificationToken, payload.resetToken, payload.verificationExpiresIn, payload.resetExpiresIn),
	dev_features_announcement: async (payload) => email.sendDevelopmentFeaturesEmail(payload.toEmail, payload.preferredName, payload.subject, payload.markdownBody),
	api_key_created: async (payload) => email.sendApiKeyCreatedEmail(payload.toEmail, payload.preferredName, payload.keyName, payload.keyPrefix, payload.expiresAt),
	api_key_revoked: async (payload) => email.sendApiKeyRevokedEmail(payload.toEmail, payload.preferredName, payload.keyName, payload.keyPrefix),
	api_key_ban_applied: async (payload) => email.sendApiKeyBanAppliedEmail(payload.toEmail, payload.preferredName, payload.reason),
	api_key_ban_removed: async (payload) => email.sendApiKeyBanRemovedEmail(payload.toEmail, payload.preferredName),
	usage_warning_api_key: async (payload) => email.sendApiKeyUsageWarningEmail(payload.toEmail, payload.preferredName, payload.keyName, payload.usageLevel),
	api_key_expiring: async (payload) => email.sendApiKeyExpiringEmail(payload.toEmail, payload.preferredName, payload.keyName, payload.keyPrefix, payload.expiresAt),
	api_key_expired: async (payload) => email.sendApiKeyExpiredEmail(payload.toEmail, payload.preferredName, payload.keyName, payload.keyPrefix)
};

function buildTestEmailParams(emailType, normalizedEmail, tokenValue, expiresInMinutes, context = {}, fallbackIp = null) {
	const preferredName = typeof context.preferredName === "string" && context.preferredName.trim().length > 0
		? context.preferredName.trim()
		: "Test User";
	const token = typeof tokenValue === "string" && tokenValue.trim() ? tokenValue.trim() : "test";
	const reason = typeof context.reason === "string" && context.reason.trim() ? context.reason.trim() : "Admin test email";
	const newEmail = typeof context.newEmail === "string" && context.newEmail.trim() ? context.newEmail.trim() : `test+new@${normalizedEmail.split("@")[1] || "example.com"}`;
	const changes = context.changes && typeof context.changes === "object" ? context.changes : { role: "user" };
	switch (emailType) {
		case "verification":
			return { toEmail: normalizedEmail, token, preferredName, expiresIn: expiresInMinutes };
		case "password_reset":
			return { toEmail: normalizedEmail, token, preferredName, expiresIn: expiresInMinutes };
		case "welcome":
			return { toEmail: normalizedEmail, preferredName };
		case "password_reset_success":
			return { toEmail: normalizedEmail, preferredName };
		case "account_disable_verification":
			return { toEmail: normalizedEmail, preferredName, token, expiresIn: expiresInMinutes };
		case "account_disable_confirmation":
			return { toEmail: normalizedEmail, preferredName };
		case "account_delete_verification":
			return { toEmail: normalizedEmail, preferredName, token, expiresIn: expiresInMinutes };
		case "account_delete_admin_notice":
			return {
				userEmail: normalizedEmail,
				userFullName: context.userFullName || preferredName,
				userPreferredName: context.userPreferredName || preferredName,
				userId: context.userId || 0,
				requestedAt: context.requestedAt || new Date().toISOString(),
				requestIp: context.requestIp || fallbackIp || "127.0.0.1"
			};
		case "email_change_verification":
			return { toEmail: normalizedEmail, preferredName, token, expiresIn: expiresInMinutes };
		case "email_change_confirmation":
			return { toEmail: normalizedEmail, newEmail, preferredName };
		case "admin_profile_update":
			return { toEmail: normalizedEmail, preferredName, changes };
		case "admin_account_disabled":
			return { toEmail: normalizedEmail, preferredName };
		case "admin_account_enabled":
			return { toEmail: normalizedEmail, preferredName };
		case "admin_email_unverified":
			return { toEmail: normalizedEmail, preferredName, reason };
		case "admin_email_verified":
			return { toEmail: normalizedEmail, preferredName, reason };
		case "admin_account_setup":
			return {
				toEmail: normalizedEmail,
				preferredName,
				verificationToken: token,
				resetToken: `${token}-reset`,
				verificationExpiresIn: expiresInMinutes,
				resetExpiresIn: expiresInMinutes
			};
		case "dev_features_announcement":
			return {
				toEmail: normalizedEmail,
				preferredName,
				subject: context.subject || "The Book Project update",
				markdownBody: context.markdownBody || ""
			};
		case "api_key_created":
			return {
				toEmail: normalizedEmail,
				preferredName,
				keyName: context.keyName || "Primary key",
				keyPrefix: context.keyPrefix || "bk_1234",
				expiresAt: context.expiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
			};
		case "api_key_revoked":
			return {
				toEmail: normalizedEmail,
				preferredName,
				keyName: context.keyName || "Primary key",
				keyPrefix: context.keyPrefix || "bk_1234"
			};
		case "api_key_ban_applied":
			return { toEmail: normalizedEmail, preferredName, reason };
		case "api_key_ban_removed":
			return { toEmail: normalizedEmail, preferredName };
		case "usage_warning_api_key":
			return {
				toEmail: normalizedEmail,
				preferredName,
				keyName: context.keyName || "Primary key",
				usageLevel: context.usageLevel || "High"
			};
		case "api_key_expiring":
			return {
				toEmail: normalizedEmail,
				preferredName,
				keyName: context.keyName || "Primary key",
				keyPrefix: context.keyPrefix || "bk_1234",
				expiresAt: context.expiresAt || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
			};
		case "api_key_expired":
			return {
				toEmail: normalizedEmail,
				preferredName,
				keyName: context.keyName || "Primary key",
				keyPrefix: context.keyPrefix || "bk_1234"
			};
		default:
			return null;
	}
}

function validateRole(role) {
	const errors = [];
	if (!role) {
		return errors;
	}
	if (!VALID_ROLES.has(role)) {
		errors.push("Role must be one of: user, admin.");
	}
	return errors;
}

function validateReason(reason) {
	const errors = [];
	if (!reason || typeof reason !== "string" || !reason.trim()) {
		errors.push("Reason must be provided.");
		return errors;
	}
	if (reason.trim().length > MAX_REASON_LENGTH) {
		errors.push(`Reason must be ${MAX_REASON_LENGTH} characters or fewer.`);
	}
	return errors;
}

function validateDevEmailPayload(subject, markdownBody) {
	const errors = [];
	if (!subject || typeof subject !== "string" || !subject.trim()) {
		errors.push("subject is required.");
	} else if (subject.trim().length > MAX_EMAIL_SUBJECT_LENGTH) {
		errors.push(`subject must be ${MAX_EMAIL_SUBJECT_LENGTH} characters or fewer.`);
	}

	if (!markdownBody || typeof markdownBody !== "string" || !markdownBody.trim()) {
		errors.push("markdownBody is required.");
	} else if (markdownBody.trim().length > MAX_EMAIL_BODY_LENGTH) {
		errors.push(`markdownBody must be ${MAX_EMAIL_BODY_LENGTH} characters or fewer.`);
	}

	return errors;
}

function summarizeUserAgent(userAgent) {
	if (!userAgent || typeof userAgent !== "string") {
		return { browser: "Unknown", device: "Unknown", operatingSystem: "Unknown", raw: "" };
	}

	const raw = userAgent;
	const ua = raw.toLowerCase();

	let browser = "Unknown";
	if (/edg\//.test(ua)) {
		browser = "Microsoft Edge";
	} else if (/opr\//.test(ua) || /opera/.test(ua)) {
		browser = "Opera";
	} else if (/chrome/.test(ua) && !/edg|opr/.test(ua)) {
		browser = "Chrome";
	} else if (/safari/.test(ua) && !/chrome|crios|opr|edg/.test(ua)) {
		browser = "Safari";
	} else if (/firefox/.test(ua)) {
		browser = "Firefox";
	} else if (/msie|trident/.test(ua)) {
		browser = "Internet Explorer";
	}

	let operatingSystem = "Unknown";
	if (/windows nt/.test(ua)) {
		operatingSystem = "Windows";
	} else if (/mac os x/.test(ua)) {
		operatingSystem = "macOS";
	} else if (/android/.test(ua)) {
		operatingSystem = "Android";
	} else if (/iphone|ipad|ipod/.test(ua)) {
		operatingSystem = "iOS";
	} else if (/linux/.test(ua)) {
		operatingSystem = "Linux";
	}

	let device = "Desktop";
	if (/ipad|tablet/.test(ua)) {
		device = "Tablet";
	} else if (/mobile|iphone|android/.test(ua)) {
		device = "Mobile";
	}

	return { browser, device, operatingSystem, raw };
}

function generateActionToken() {
	return crypto.randomBytes(32).toString("hex");
}

function addMinutesToNow(minutes) {
	return new Date(Date.now() + minutes * 60 * 1000);
}

function normalizeDurationMinutes(value, defaultMinutes) {
	if (value === undefined || value === null || value === "") return { value: defaultMinutes };
	const parsed = parseId(value);
	if (!Number.isInteger(parsed)) {
		return { error: "duration must be an integer between 1 and 1440 minutes." };
	}
	if (parsed < 1 || parsed > 1440) {
		return { error: "duration must be between 1 and 1440 minutes." };
	}
	return { value: parsed };
}

async function maybeCleanupVerificationTokens(client = pool) {
	const now = Date.now();
	if (now - lastTokenCleanupAt < TOKEN_CLEANUP_INTERVAL_MS) {
		return;
	}
	lastTokenCleanupAt = now;
	try {
		await client.query(`
			DELETE FROM verification_tokens
			WHERE (expires_at < NOW() - INTERVAL '1 day')
			   OR (used = true AND created_at < NOW() - INTERVAL '1 day')
			   OR (created_at < NOW() - INTERVAL '30 days')
		`);
		logToFile("VERIFICATION_TOKEN_CLEANUP", { status: "INFO" }, "info");
	} catch (error) {
		logToFile("VERIFICATION_TOKEN_CLEANUP", { status: "FAILURE", error_message: error.message }, "error");
		lastTokenCleanupAt = now - TOKEN_CLEANUP_INTERVAL_MS + 60 * 1000;
	}
}

async function issueVerificationToken(client, userId, durationMinutes) {
	const token = generateActionToken();
	const expiresAt = addMinutesToNow(durationMinutes);
	await client.query(
		`UPDATE verification_tokens
		 SET used = true
		 WHERE user_id = $1 AND token_type = 'email_verification' AND used = false`,
		[userId]
	);
	await client.query(
		`INSERT INTO verification_tokens (user_id, token, token_type, expires_at, used, created_at)
		 VALUES ($1, $2, 'email_verification', $3, false, NOW())`,
		[userId, token, expiresAt]
	);
	return { token, expiresAt };
}

async function issuePasswordResetToken(client, userId, durationMinutes) {
	const token = generateActionToken();
	const expiresAt = addMinutesToNow(durationMinutes);
	await client.query(
		`UPDATE verification_tokens
		 SET used = true
		 WHERE user_id = $1 AND token_type = 'password_reset' AND used = false`,
		[userId]
	);
	await client.query(
		`INSERT INTO verification_tokens (user_id, token, token_type, expires_at, used, created_at)
		 VALUES ($1, $2, 'password_reset', $3, false, NOW())`,
		[userId, token, expiresAt]
	);
	return { token, expiresAt };
}

async function resolveTargetUserId({ idValue, emailValue }) {
	const id = parseId(idValue);
	const email = normalizeEmail(emailValue);

	if (!id && !email) {
		return {
			error: {
				status: 400,
				message: "Validation Error",
				errors: ["User id or email must be provided."]
			}
		};
	}

	if (email) {
		const emailErrors = validateEmail(email);
		if (emailErrors.length > 0) {
			return {
				error: {
					status: 400,
					message: "Validation Error",
					errors: emailErrors
				}
			};
		}
	}

	if (id && email) {
		const match = await pool.query(
			`SELECT id FROM users WHERE id = $1 AND email = $2`,
			[id, email]
		);
		if (match.rows.length === 0) {
			return {
				error: {
					status: 400,
					message: "Validation Error",
					errors: ["User id and email do not match."]
				}
			};
		}
		return { id, email };
	}

	if (id) {
		return { id, email: null };
	}

	const result = await pool.query(
		`SELECT id FROM users WHERE email = $1`,
		[email]
	);
	if (result.rows.length === 0) {
		return {
			error: {
				status: 404,
				message: "User not found.",
				errors: ["The requested user could not be located."]
			}
		};
	}

	return { id: result.rows[0].id, email };
}

async function ensureEmailMatchesTargetId(targetId, emailValue) {
	const email = normalizeEmail(emailValue);
	if (!email) {
		return null;
	}
	const emailErrors = validateEmail(email);
	if (emailErrors.length > 0) {
		return {
			status: 400,
			message: "Validation Error",
			errors: emailErrors
		};
	}

	const match = await pool.query(
		`SELECT id FROM users WHERE id = $1 AND email = $2`,
		[targetId, email]
	);
	if (match.rows.length === 0) {
		return {
			status: 400,
			message: "Validation Error",
			errors: ["User id and email do not match."]
		};
	}
	return null;
}

async function enforceEmailMatch(res, targetId, emailValue) {
	const matchError = await ensureEmailMatchesTargetId(targetId, emailValue);
	if (matchError) {
		errorResponse(res, matchError.status, matchError.message, matchError.errors);
		return false;
	}
	return true;
}

function formatUserRow(row, { nameOnly = false, includeOauthProviders = false } = {}) {
	if (nameOnly) {
		return {
			id: row.id,
			email: row.email,
			fullName: row.full_name
		};
	}

	const usageScore = Number(row.usage_score) || 0;
	const lastActive = row.last_active || row.last_login || row.usage_last_seen || null;
	const apiKeyActiveCount = Number(row.api_key_active_count) || 0;
	const apiKeyRevokedCount = Number(row.api_key_revoked_count) || 0;
	const apiKeyStatus = apiKeyActiveCount > 0 ? "Active" : (apiKeyRevokedCount > 0 ? "Revoked" : "None");

	const payload = {
		id: row.id,
		email: row.email,
		fullName: row.full_name,
		preferredName: row.preferred_name,
		role: row.role,
		isVerified: row.is_verified,
		isDisabled: row.is_disabled,
		passwordUpdated: row.password_updated,
		lastLogin: row.last_login,
		lastActive,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		languageCount: Number(row.language_count) || 0,
		librarySize: Number(row.library_size) || 0,
		usageScore,
		usageRank: getUsageLevel(usageScore),
		apiKeyActiveCount,
		apiKeyRevokedCount,
		apiKeyStatus,
		apiKeyBanEnabled: Boolean(row.api_key_ban_enabled),
		usageLockoutUntil: row.usage_lockout_until,
		emailPreferences: {
			accountUpdates: row.email_pref_account_updates,
			devFeatures: row.email_pref_dev_features
		}
	};

	if (includeOauthProviders) {
		payload.oauthProviders = row.oauth_providers || [];
	}

	return payload;
}

async function createDefaultBookTypes(client, userId) {
	await client.query(
		`INSERT INTO book_types (user_id, name, description, created_at, updated_at)
		 VALUES ($1, 'Hardcover', 'A durable hardbound edition with rigid boards and a protective jacket or printed cover. Built to last, it resists wear and warping better than paperbacks and is ideal for collectors, frequent readers, and long-term shelving.', NOW(), NOW()),
		        ($1, 'Softcover', 'A flexible paperback edition with a card cover. Lighter and more portable than hardcover, it''s usually more affordable and easy to handle. Great for everyday reading, travel, and casual collections.', NOW(), NOW())
		 ON CONFLICT (user_id, name) DO NOTHING`,
		[userId]
	);
}

function normalizeLanguageName(value) {
	const trimmed = normalizeText(value);
	return trimmed.toLowerCase();
}

function validateLanguageName(name) {
	const errors = [];
	if (!name) {
		errors.push("Language name must be provided.");
		return errors;
	}
	if (name.length < 2 || name.length > MAX_LANGUAGE_NAME_LENGTH) {
		errors.push(`Language name must be between 2 and ${MAX_LANGUAGE_NAME_LENGTH} characters.`);
	}
	if (!/^[A-Za-z\s\-.'’]+$/.test(name)) {
		errors.push("Language name can only contain letters, spaces, hyphens, and apostrophes.");
	}
	return errors;
}

const adminUsersListHandler = async (req, res) => {
	const adminId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly) ?? false;
	const errors = [];
	const userColumns = await getUsersColumnAvailability();
	const hasUserApiKeys = await tableExists("user_api_keys");
	const sortFields = {
		id: "u.id",
		email: "u.email",
		fullName: "u.full_name",
		preferredName: "u.preferred_name",
		role: "u.role",
		isVerified: userColumns.has("is_verified") ? "u.is_verified" : null,
		isDisabled: userColumns.has("is_disabled") ? "u.is_disabled" : null,
		lastLogin: userColumns.has("last_login") ? "u.last_login" : null,
		passwordUpdated: userColumns.has("password_updated") ? "u.password_updated" : null,
		createdAt: "u.created_at",
		updatedAt: "u.updated_at"
	};
	const sortBy = normalizeText(listParams.sortBy) || "email";
	const sortColumn = sortFields[sortBy];
	if (!sortColumn) {
		errors.push("sortBy must be one of: id, email, fullName, preferredName, role, isVerified, isDisabled, lastLogin, passwordUpdated, createdAt, updatedAt.");
	}

	const order = parseSortOrder(listParams.order);
	if (!order) {
		errors.push("order must be either asc or desc.");
	}

	const { value: limit, error: limitError } = parseOptionalInt(listParams.limit, "limit", { min: 1, max: MAX_LIST_LIMIT });
	if (limitError) errors.push(limitError);
	const { value: offset, error: offsetError } = parseOptionalInt(listParams.offset, "offset", { min: 0 });
	if (offsetError) errors.push(offsetError);

	const filters = [];
	const values = [];
	let paramIndex = 1;

	if (listParams.filterId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterId, "filterId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterIdMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`u.id = ANY($${paramIndex++}::int[])`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`u.id = $${paramIndex++}`);
					values.push(id);
				});
			}
		}
	}

	const filterEmail = normalizeText(listParams.filterEmail);
	if (filterEmail) {
		if (filterEmail.length > MAX_EMAIL_LENGTH) {
			errors.push(`filterEmail must be ${MAX_EMAIL_LENGTH} characters or fewer.`);
		} else {
			filters.push(`u.email ILIKE $${paramIndex++}`);
			values.push(`%${filterEmail}%`);
		}
	}

	const filterFullName = normalizeText(listParams.filterFullName);
	if (filterFullName) {
		filters.push(`u.full_name ILIKE $${paramIndex++}`);
		values.push(`%${filterFullName}%`);
	}

	const filterPreferredName = normalizeText(listParams.filterPreferredName);
	if (filterPreferredName) {
		filters.push(`u.preferred_name ILIKE $${paramIndex++}`);
		values.push(`%${filterPreferredName}%`);
	}

	if (listParams.filterRole !== undefined && listParams.filterRole !== null && listParams.filterRole !== "") {
		const roleValue = normalizeText(listParams.filterRole);
		if (!VALID_ROLES.has(roleValue)) {
			errors.push("filterRole must be one of: user, admin.");
		} else {
			filters.push(`u.role = $${paramIndex++}`);
			values.push(roleValue);
		}
	}

	if (listParams.filterIsVerified !== undefined) {
		if (!userColumns.has("is_verified")) {
			errors.push("filterIsVerified is not available for the current schema.");
		} else {
			const parsed = parseBooleanFlag(listParams.filterIsVerified);
			if (parsed === null) {
				errors.push("filterIsVerified must be a boolean.");
			} else {
				filters.push(`u.is_verified = $${paramIndex++}`);
				values.push(parsed);
			}
		}
	}

	if (listParams.filterIsDisabled !== undefined) {
		if (!userColumns.has("is_disabled")) {
			errors.push("filterIsDisabled is not available for the current schema.");
		} else {
			const parsed = parseBooleanFlag(listParams.filterIsDisabled);
			if (parsed === null) {
				errors.push("filterIsDisabled must be a boolean.");
			} else {
				filters.push(`u.is_disabled = $${paramIndex++}`);
				values.push(parsed);
			}
		}
	}

	const dateFilters = [
		{ key: "filterCreatedAt", column: "u.created_at", op: "=" },
		{ key: "filterUpdatedAt", column: "u.updated_at", op: "=" },
		{ key: "filterCreatedAfter", column: "u.created_at", op: ">=" },
		{ key: "filterCreatedBefore", column: "u.created_at", op: "<=" },
		{ key: "filterUpdatedAfter", column: "u.updated_at", op: ">=" },
		{ key: "filterUpdatedBefore", column: "u.updated_at", op: "<=" },
		{ key: "filterLastLogin", column: "u.last_login", op: "=" },
		{ key: "filterLastLoginAfter", column: "u.last_login", op: ">=" },
		{ key: "filterLastLoginBefore", column: "u.last_login", op: "<=" },
		{ key: "filterPasswordUpdated", column: "u.password_updated", op: "=" },
		{ key: "filterPasswordUpdatedAfter", column: "u.password_updated", op: ">=" },
		{ key: "filterPasswordUpdatedBefore", column: "u.password_updated", op: "<=" }
	];

	for (const filter of dateFilters) {
		const { value, error } = parseDateFilter(listParams[filter.key], filter.key);
		if (error) {
			errors.push(error);
		} else if (value) {
			filters.push(`${filter.column} ${filter.op} $${paramIndex++}`);
			values.push(value);
		}
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const { hasTable, hasCostUnits } = await getRequestLogsAvailability();
	const selectUserColumn = (column, fallback) => userColumns.has(column) ? `u.${column}` : `${fallback} AS ${column}`;
	const usageLastSeenSelect = hasTable
		? "(SELECT MAX(l.logged_at) FROM request_logs l WHERE l.user_id = u.id AND l.actor_type IN ('user', 'api_key')) AS usage_last_seen"
		: "NULL AS usage_last_seen";
	// Usage score (0-100) uses 30-day request_logs activity with log scaling; cost_units preferred when available.
	const usageScoreSelect = hasTable
		? `(SELECT ${buildUsageScoreExpression(hasCostUnits)} FROM request_logs l WHERE l.user_id = u.id AND l.actor_type IN ('user', 'api_key') AND l.logged_at >= NOW() - INTERVAL '${USAGE_SCORE_WINDOW_DAYS} days') AS usage_score`
		: "NULL::int AS usage_score";
	const apiKeyActiveSelect = hasUserApiKeys
		? "(SELECT COUNT(*)::int FROM user_api_keys k WHERE k.user_id = u.id AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > NOW())) AS api_key_active_count"
		: "0::int AS api_key_active_count";
	const apiKeyRevokedSelect = hasUserApiKeys
		? "(SELECT COUNT(*)::int FROM user_api_keys k WHERE k.user_id = u.id AND k.revoked_at IS NOT NULL) AS api_key_revoked_count"
		: "0::int AS api_key_revoked_count";

	const fields = nameOnly
		? "u.id, u.email, u.full_name"
		: `u.id, u.email, u.full_name, u.preferred_name, u.role,
		   ${selectUserColumn("is_verified", "FALSE")},
		   ${selectUserColumn("is_disabled", "FALSE")},
		   ${selectUserColumn("password_updated", "NULL")},
		   ${selectUserColumn("last_login", "NULL")},
		   ${selectUserColumn("created_at", "NOW()")},
		   ${selectUserColumn("updated_at", "NOW()")},
		   ${selectUserColumn("api_key_ban_enabled", "FALSE")},
		   ${selectUserColumn("usage_lockout_until", "NULL")},
		   ${selectUserColumn("email_pref_account_updates", "TRUE")},
		   ${selectUserColumn("email_pref_dev_features", "FALSE")},
		   (SELECT COUNT(DISTINCT bl.language_id) FROM book_languages bl WHERE bl.user_id = u.id) AS language_count,
		   (SELECT COUNT(*) FROM books b WHERE b.user_id = u.id AND b.deleted_at IS NULL) AS library_size,
		   ${usageLastSeenSelect},
		   ${usageScoreSelect},
		   ${apiKeyActiveSelect},
		   ${apiKeyRevokedSelect}`;

	try {
		let query = `SELECT ${fields} FROM users u`;
		const whereClause = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
		if (filters.length > 0) {
			query += whereClause;
		}
		query += ` ORDER BY ${sortColumn} ${order.toUpperCase()}`;
		const countResult = await pool.query(
			`SELECT COUNT(*)::int AS total FROM users u${whereClause}`,
			values
		);
		const total = countResult.rows[0]?.total ?? 0;
		const queryValues = [...values];
		let queryIndex = paramIndex;
		if (limit !== null) {
			query += ` LIMIT $${queryIndex++}`;
			queryValues.push(limit);
		}
		if (offset !== null) {
			query += ` OFFSET $${queryIndex++}`;
			queryValues.push(offset);
		}

		const result = await pool.query(query, queryValues);

		logToFile("ADMIN_USERS_LIST", {
			status: "SUCCESS",
			admin_id: adminId,
			count: result.rows.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		const payload = result.rows.map((row) => formatUserRow(row, { nameOnly }));
		return successResponse(res, 200, "Users retrieved successfully.", { users: payload, total });
	} catch (error) {
		logToFile("ADMIN_USERS_LIST", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving users."]);
	}
};

// `GET /admin/users/` - List all users (admin only, with pagination and filtering) and their appropriate information (from JSON body if provided)
router.get("/users", adminAuth, async (req, res) => {
	const adminId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const targetId = parseId(listParams.id);
	const rawLookupEmail = listParams.email;
	const lookupEmail = rawLookupEmail ? normalizeEmail(rawLookupEmail) : "";

	if (targetId !== null || lookupEmail) {
		try {
			const resolved = await resolveTargetUserId({ idValue: targetId, emailValue: lookupEmail });
			if (resolved.error) {
				return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
			}
			const resolvedId = resolved.id;
			const userColumns = await getUsersColumnAvailability();
			const hasUserApiKeys = await tableExists("user_api_keys");
			const hasOauthAccounts = await tableExists("oauth_accounts");
			const selectUserColumn = (column, fallback) => userColumns.has(column) ? `u.${column}` : `${fallback} AS ${column}`;
			const { hasTable, hasCostUnits } = await getRequestLogsAvailability();
			const usageLastSeenSelect = hasTable
				? "(SELECT MAX(l.logged_at) FROM request_logs l WHERE l.user_id = u.id AND l.actor_type IN ('user', 'api_key')) AS usage_last_seen"
				: "NULL AS usage_last_seen";
			const usageScoreSelect = hasTable
				? `(SELECT ${buildUsageScoreExpression(hasCostUnits)} FROM request_logs l WHERE l.user_id = u.id AND l.actor_type IN ('user', 'api_key') AND l.logged_at >= NOW() - INTERVAL '${USAGE_SCORE_WINDOW_DAYS} days') AS usage_score`
				: "NULL::int AS usage_score";
			const apiKeyActiveSelect = hasUserApiKeys
				? "(SELECT COUNT(*)::int FROM user_api_keys k WHERE k.user_id = u.id AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > NOW())) AS api_key_active_count"
				: "0::int AS api_key_active_count";
			const apiKeyRevokedSelect = hasUserApiKeys
				? "(SELECT COUNT(*)::int FROM user_api_keys k WHERE k.user_id = u.id AND k.revoked_at IS NOT NULL) AS api_key_revoked_count"
				: "0::int AS api_key_revoked_count";
			const oauthProvidersSelect = hasOauthAccounts
				? "COALESCE((SELECT json_agg(provider) FROM oauth_accounts WHERE user_id = u.id), '[]'::json) AS oauth_providers"
				: "'[]'::json AS oauth_providers";

			const result = await pool.query(
				`SELECT u.id, u.email, u.full_name, u.preferred_name, u.role,
				        ${selectUserColumn("is_verified", "FALSE")},
				        ${selectUserColumn("is_disabled", "FALSE")},
				        ${selectUserColumn("password_updated", "NULL")},
				        ${selectUserColumn("last_login", "NULL")},
				        ${selectUserColumn("created_at", "NOW()")},
				        ${selectUserColumn("updated_at", "NOW()")},
				        ${selectUserColumn("api_key_ban_enabled", "FALSE")},
				        ${selectUserColumn("usage_lockout_until", "NULL")},
				        ${selectUserColumn("email_pref_account_updates", "TRUE")},
				        ${selectUserColumn("email_pref_dev_features", "FALSE")},
				        (SELECT COUNT(DISTINCT bl.language_id) FROM book_languages bl WHERE bl.user_id = u.id) AS language_count,
				        (SELECT COUNT(*) FROM books b WHERE b.user_id = u.id AND b.deleted_at IS NULL) AS library_size,
				        ${usageLastSeenSelect},
				        ${usageScoreSelect},
				        ${apiKeyActiveSelect},
				        ${apiKeyRevokedSelect},
				        ${oauthProvidersSelect}
				 FROM users u
				 WHERE u.id = $1`,
				[resolvedId]
			);

			const row = result.rows[0];
			logToFile("ADMIN_USERS_GET", {
				status: "SUCCESS",
				admin_id: adminId,
				user_id: row.id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, "User retrieved successfully.", formatUserRow(row, {
				nameOnly,
				includeOauthProviders: !nameOnly
			}));
		} catch (error) {
			logToFile("ADMIN_USERS_GET", {
				status: "FAILURE",
				error_message: error.message,
				admin_id: adminId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the user."]);
		}
	}
	return adminUsersListHandler(req, res);
});

// POST /admin/users/list - JSON-body list variant (admin only)
router.post("/users/list", adminAuth, adminUsersListHandler);

// `POST /admin/users/` - Create a new user (admin only)
router.post("/users", adminAuth, async (req, res) => {
	const adminId = req.user.id;
	let { fullName, preferredName, email, password, role, noPassword, duration } = req.body || {};
	fullName = typeof fullName === "string" ? fullName.trim() : "";
	preferredName = typeof preferredName === "string" ? preferredName.trim() : null;
	email = normalizeEmail(email);
	password = typeof password === "string" ? password.trim() : "";
	role = typeof role === "string" ? role.trim() : "user";
	noPassword = parseBooleanFlag(noPassword) ?? false;

	const errors = [];
	errors.push(
		...validateFullName(fullName),
		...validatePreferredName(preferredName),
		...validateEmail(email),
		...validateRole(role)
	);

	const durationResult = normalizeDurationMinutes(duration, 60);
	if (durationResult.error) {
		errors.push(durationResult.error);
	}

	if (noPassword) {
		if (password) {
			errors.push("Password must not be provided when noPassword is true.");
		}
	} else {
		errors.push(...validatePassword(password));
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "User already exists.", ["A user with this email address already exists."]);
		}
	} catch (error) {
		logToFile("ADMIN_USER_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while checking for duplicate users."]);
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		const passwordHash = noPassword ? null : await bcrypt.hash(password, config.saltRounds);
		const passwordUpdated = noPassword ? null : new Date();
		const insertUser = await client.query(
			`INSERT INTO users (full_name, preferred_name, email, password_hash, role, is_verified, is_disabled, password_updated)
			 VALUES ($1, $2, $3, $4, $5, false, false, $6)
			 RETURNING id, email, full_name, preferred_name, role, is_verified, is_disabled, password_updated, last_login, created_at, updated_at`,
			[fullName, preferredName, email, passwordHash, role, passwordUpdated]
		);
		const newUser = insertUser.rows[0];

		await createDefaultBookTypes(client, newUser.id);

		const { token, expiresAt } = await issueVerificationToken(client, newUser.id, durationResult.value);
		let passwordResetPayload = null;
		if (noPassword) {
			const resetToken = await issuePasswordResetToken(client, newUser.id, durationResult.value);
			passwordResetPayload = {
				token: resetToken.token,
				expiresAt: resetToken.expiresAt
			};
		}

		await client.query("COMMIT");
		await maybeCleanupVerificationTokens();

		const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
		if (noPassword && passwordResetPayload) {
			const resetExpiresIn = Math.max(1, Math.round((new Date(passwordResetPayload.expiresAt) - Date.now()) / 60000));
			enqueueEmail({
				type: "admin_account_setup",
				params: {
					toEmail: email,
					preferredName: newUser.preferred_name,
					verificationToken: token,
					resetToken: passwordResetPayload.token,
					verificationExpiresIn: expiresIn,
					resetExpiresIn
				},
				context: "ADMIN_CREATE_USER_NO_PASSWORD",
				userId: newUser.id
			});
		} else {
			enqueueEmail({
				type: "verification",
				params: { toEmail: email, token, preferredName: newUser.preferred_name, expiresIn },
				context: "ADMIN_CREATE_USER",
				userId: newUser.id
			});
		}

		logToFile("ADMIN_USER_CREATE", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: newUser.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 201, "User created successfully.", formatUserRow(newUser));
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("ADMIN_USER_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the user."]);
	} finally {
		client.release();
	}
});

// `GET /admin/users/:id` - Get a specific user profile by ID (admin only)
// `GET /admin/users` with JSON body containing { id: userId } is also supported
router.get("/users/:id", adminAuth, async (req, res) => {
	const adminId = req.user.id;
	const pathId = parseId(req.params.id);
	if (!Number.isInteger(pathId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== pathId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, pathId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	const nameOnly = parseBooleanFlag(req.query.nameOnly ?? req.body?.nameOnly) ?? false;

	try {
		const { hasTable, hasCostUnits } = await getRequestLogsAvailability();
		const usageLastSeenSelect = hasTable
			? "(SELECT MAX(l.logged_at) FROM request_logs l WHERE l.user_id = u.id AND l.actor_type IN ('user', 'api_key')) AS usage_last_seen"
			: "NULL AS usage_last_seen";
		const usageScoreSelect = hasTable
			? `(SELECT ${buildUsageScoreExpression(hasCostUnits)} FROM request_logs l WHERE l.user_id = u.id AND l.actor_type IN ('user', 'api_key') AND l.logged_at >= NOW() - INTERVAL '${USAGE_SCORE_WINDOW_DAYS} days') AS usage_score`
			: "NULL::int AS usage_score";

		const result = await pool.query(
			`SELECT u.id, u.email, u.full_name, u.preferred_name, u.role, u.is_verified, u.is_disabled,
			        u.password_updated, u.last_login, u.created_at, u.updated_at,
			        u.api_key_ban_enabled, u.usage_lockout_until,
			        u.email_pref_account_updates, u.email_pref_dev_features,
			        (SELECT COUNT(DISTINCT bl.language_id) FROM book_languages bl WHERE bl.user_id = u.id) AS language_count,
			        (SELECT COUNT(*) FROM books b WHERE b.user_id = u.id AND b.deleted_at IS NULL) AS library_size,
			        ${usageLastSeenSelect},
			        ${usageScoreSelect},
			        (SELECT COUNT(*)::int FROM user_api_keys k WHERE k.user_id = u.id AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > NOW())) AS api_key_active_count,
			        (SELECT COUNT(*)::int FROM user_api_keys k WHERE k.user_id = u.id AND k.revoked_at IS NOT NULL) AS api_key_revoked_count,
			        COALESCE((SELECT json_agg(provider) FROM oauth_accounts WHERE user_id = u.id), '[]'::json) AS oauth_providers
			 FROM users u
			 WHERE u.id = $1`,
			[pathId]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const row = result.rows[0];
		logToFile("ADMIN_USERS_GET", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "User retrieved successfully.", formatUserRow(row, {
			nameOnly,
			includeOauthProviders: !nameOnly
		}));
	} catch (error) {
		logToFile("ADMIN_USERS_GET", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the user."]);
	}
});

async function handleUserUpdate(req, res, targetId) {
	const adminId = req.user.id;
	const body = req.body || {};
	let { fullName, preferredName, email, role } = body;

	const errors = [];
	const hasFullName = fullName !== undefined;
	const hasPreferredName = preferredName !== undefined;
	const hasEmail = email !== undefined;
	const hasRole = role !== undefined;
	const hasDuration = body.duration !== undefined;
	let verificationDuration = 1440;

	if (!hasFullName && !hasPreferredName && !hasEmail && !hasRole) {
		return errorResponse(res, 400, "Validation Error", ["At least one field must be provided for update."]);
	}

	const normalizedEmail = hasEmail ? normalizeEmail(email) : null;
	if (hasFullName) {
		fullName = typeof fullName === "string" ? fullName.trim() : "";
		errors.push(...validateFullName(fullName));
	}

	if (hasPreferredName) {
		if (preferredName === null || preferredName === "") {
			preferredName = null;
		} else if (typeof preferredName === "string") {
			preferredName = preferredName.trim();
		}
		errors.push(...validatePreferredName(preferredName));
	}

	if (hasEmail) {
		errors.push(...validateEmail(normalizedEmail));
	}

	if (hasRole) {
		role = typeof role === "string" ? role.trim() : "";
		errors.push(...validateRole(role));
	}

	if (hasDuration) {
		const durationResult = normalizeDurationMinutes(body.duration, 1440);
		if (durationResult.error) {
			errors.push(durationResult.error);
		} else {
			verificationDuration = durationResult.value;
		}
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existingRes = await pool.query(
			`SELECT id, email, full_name, preferred_name, role, is_verified, is_disabled
			 FROM users WHERE id = $1`,
			[targetId]
		);
		if (existingRes.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const existingUser = existingRes.rows[0];
		if (hasRole && targetId === adminId && role !== existingUser.role) {
			return errorResponse(res, 403, "Forbidden", ["You cannot change your own role."]);
		}

		const emailChanged = hasEmail && normalizedEmail !== existingUser.email;
		if (emailChanged) {
			const duplicate = await pool.query(
				"SELECT 1 FROM users WHERE email = $1 AND id <> $2",
				[normalizedEmail, targetId]
			);
			if (duplicate.rows.length > 0) {
				return errorResponse(res, 409, "Email already in use.", ["Another user already uses this email address."]);
			}
		}

		const updates = [];
		const values = [];
		let paramIndex = 1;
		const changeEntries = [];
		const recordChange = (label, oldValue, newValue) => {
			changeEntries.push({ label, oldValue, newValue });
		};

		if (hasFullName && fullName !== existingUser.full_name) {
			updates.push(`full_name = $${paramIndex++}`);
			values.push(fullName);
			recordChange("Full name", existingUser.full_name, fullName);
		}
		if (hasPreferredName) {
			const preferredValue = preferredName || null;
			if (preferredValue !== existingUser.preferred_name) {
				updates.push(`preferred_name = $${paramIndex++}`);
				values.push(preferredValue);
				recordChange("Preferred name", existingUser.preferred_name, preferredValue);
			}
		}
		if (hasEmail && normalizedEmail !== existingUser.email) {
			updates.push(`email = $${paramIndex++}`);
			values.push(normalizedEmail);
			updates.push(`is_verified = false`);
			recordChange("Email", existingUser.email, normalizedEmail);
			if (existingUser.is_verified) {
				recordChange("Verification status", "Verified", "Not verified");
			}
		}
		if (hasRole && role !== existingUser.role) {
			updates.push(`role = $${paramIndex++}`);
			values.push(role);
			recordChange("Role", existingUser.role, role);
		}

		if (updates.length === 0) {
			return successResponse(res, 200, "No changes were applied.", formatUserRow(existingUser));
		}

		values.push(targetId);
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const updateQuery = `
				UPDATE users
				SET ${updates.join(", ")}
				WHERE id = $${paramIndex}
				RETURNING id, email, full_name, preferred_name, role, is_verified, is_disabled, password_updated, last_login, created_at, updated_at
			`;
			const updateRes = await client.query(updateQuery, values);
			const updatedUser = updateRes.rows[0];

			let verificationPayload = null;
			if (emailChanged) {
				const { token, expiresAt } = await issueVerificationToken(client, targetId, verificationDuration);
				verificationPayload = { token, expiresAt };
			}

			await client.query("COMMIT");
			await maybeCleanupVerificationTokens();

			if (emailChanged && verificationPayload) {
				const expiresIn = Math.max(1, Math.round((new Date(verificationPayload.expiresAt) - Date.now()) / 60000));
				enqueueEmail({
					type: "verification",
					params: {
						toEmail: updatedUser.email,
						token: verificationPayload.token,
						preferredName: updatedUser.preferred_name,
						expiresIn
					},
					context: "ADMIN_UPDATE_EMAIL",
					userId: updatedUser.id
				});
			}

			if (changeEntries.length > 0) {
				const recipients = new Set();
				recipients.add(updatedUser.email);
				if (emailChanged && existingUser.email) {
					recipients.add(existingUser.email);
				}
				recipients.forEach((toEmail) => {
					enqueueEmail({
						type: "admin_profile_update",
						params: {
							toEmail,
							preferredName: updatedUser.preferred_name,
							changes: changeEntries
						},
						context: "ADMIN_UPDATE_USER",
						userId: updatedUser.id
					});
				});
			}

			logToFile("ADMIN_USER_UPDATE", {
				status: "SUCCESS",
				admin_id: adminId,
				user_id: updatedUser.id,
				changes: changeEntries,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, "User updated successfully.", formatUserRow(updatedUser));
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("ADMIN_USER_UPDATE", {
				status: "FAILURE",
				error_message: error.message,
				admin_id: adminId,
				user_id: targetId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while updating the user."]);
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("ADMIN_USER_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the user."]);
	}
}

// `PUT /admin/users/:id` - Update a specific user’s profile by ID (including role and email, admin only)
router.put("/users/:id", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	return handleUserUpdate(req, res, targetId);
});

// `PUT /admin/users` with JSON body containing { id: userId, ...updates } is also supported
router.put("/users", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleUserUpdate(req, res, resolved.id);
});

async function handleDisableUser(req, res, targetId) {
	const adminId = req.user.id;
	if (targetId === adminId) {
		return errorResponse(res, 403, "Forbidden", ["You cannot disable your own account."]);
	}
	try {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const userRes = await client.query(
				`SELECT id, email, preferred_name, is_disabled
				 FROM users WHERE id = $1`,
				[targetId]
			);
			if (userRes.rows.length === 0) {
				await client.query("ROLLBACK");
				return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
			}

			const user = userRes.rows[0];
			if (!user.is_disabled) {
				await client.query(
					`UPDATE users SET is_disabled = true WHERE id = $1`,
					[targetId]
				);
			}

			const sessionResult = await client.query(
				`UPDATE refresh_tokens
				 SET revoked = true
				 WHERE user_id = $1 AND revoked = false
				 RETURNING token_fingerprint`,
				[targetId]
			);

			await client.query("COMMIT");

			enqueueEmail({
				type: "admin_account_disabled",
				params: {
					toEmail: user.email,
					preferredName: user.preferred_name
				},
				context: "ADMIN_DISABLE_USER",
				userId: user.id
			});

			logToFile("ADMIN_USER_DISABLE", {
				status: "SUCCESS",
				admin_id: adminId,
				user_id: user.id,
				disabled: !user.is_disabled,
				revoked_sessions: sessionResult.rows.length,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, user.is_disabled ? "User already disabled." : "User disabled successfully.", {
				id: user.id,
				wasDisabled: !user.is_disabled,
				revokedSessions: sessionResult.rows.length
			});
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("ADMIN_USER_DISABLE", {
				status: "FAILURE",
				error_message: error.message,
				admin_id: adminId,
				user_id: targetId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while disabling the user."]);
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("ADMIN_USER_DISABLE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while disabling the user."]);
	}
}

// `DELETE /admin/users/:id` - Disable a user profile by ID (admin only)
router.delete("/users/:id", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleDisableUser(req, res, targetId);
});

// `DELETE /admin/users` with JSON body containing { id: userId } is also supported
router.delete("/users", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleDisableUser(req, res, resolved.id);
});

async function handleEnableUser(req, res, targetId) {
	const adminId = req.user.id;
	try {
		const result = await pool.query(
			`UPDATE users
			 SET is_disabled = false
			 WHERE id = $1
			 RETURNING id, email, preferred_name, is_disabled`,
			[targetId]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = result.rows[0];
		enqueueEmail({
			type: "admin_account_enabled",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name
			},
			context: "ADMIN_ENABLE_USER",
			userId: user.id
		});

		logToFile("ADMIN_USER_ENABLE", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "User enabled successfully.", { id: user.id });
	} catch (error) {
		logToFile("ADMIN_USER_ENABLE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while enabling the user."]);
	}
}

async function handleApiKeyBan(req, res, targetId, banEnabled) {
	const adminId = req.user.id;
	const reason = banEnabled ? req.body?.reason || req.query?.reason : null;
	if (banEnabled) {
		const reasonErrors = validateReason(reason);
		if (reasonErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", reasonErrors);
		}
	}
	try {
		const result = await pool.query(
			`UPDATE users
			 SET api_key_ban_enabled = $1,
			     api_key_ban_reason = $2,
			     api_key_ban_applied_at = $3,
			     api_key_ban_applied_by = $4
			 WHERE id = $5
			 RETURNING id, email, preferred_name, api_key_ban_enabled, api_key_ban_reason`,
			[
				banEnabled,
				banEnabled ? reason.trim() : null,
				banEnabled ? new Date().toISOString() : null,
				banEnabled ? adminId : null,
				targetId
			]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = result.rows[0];
		enqueueEmail({
			type: banEnabled ? "api_key_ban_applied" : "api_key_ban_removed",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				reason: banEnabled ? reason.trim() : null
			},
			context: banEnabled ? "ADMIN_API_KEY_BAN" : "ADMIN_API_KEY_UNBAN",
			userId: user.id
		});

		logToFile(banEnabled ? "ADMIN_API_KEY_BAN" : "ADMIN_API_KEY_UNBAN", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			reason: banEnabled ? reason.trim() : null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, banEnabled ? "API key creation blocked for user." : "API key ban removed.", {
			id: user.id,
			apiKeyBanEnabled: user.api_key_ban_enabled,
			apiKeyBanReason: user.api_key_ban_reason || null
		});
	} catch (error) {
		logToFile(banEnabled ? "ADMIN_API_KEY_BAN" : "ADMIN_API_KEY_UNBAN", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the API key ban."]);
	}
}

async function handleUsageLockout(req, res, targetId, enableLockout) {
	const adminId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const reason = enableLockout ? params.reason : null;
	if (enableLockout) {
		const reasonErrors = validateReason(reason);
		if (reasonErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", reasonErrors);
		}
	}
	const { value: lockoutUntil, error: lockoutError } = enableLockout ? parseLockoutExpiry(params) : { value: null };
	if (enableLockout && lockoutError) {
		return errorResponse(res, 400, "Validation Error", [lockoutError]);
	}

	try {
		const result = await pool.query(
			`UPDATE users
			 SET usage_lockout_until = $1,
			     usage_lockout_reason = $2,
			     usage_lockout_applied_by = $3
			 WHERE id = $4
			 RETURNING id, email, preferred_name, usage_lockout_until, usage_lockout_reason`,
			[
				enableLockout ? lockoutUntil : null,
				enableLockout ? reason.trim() : null,
				enableLockout ? adminId : null,
				targetId
			]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = result.rows[0];
		enqueueEmail({
			type: enableLockout ? "usage_restriction_applied" : "usage_restriction_removed",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				reason: enableLockout ? reason.trim() : null,
				lockoutUntil: enableLockout ? user.usage_lockout_until : null
			},
			context: enableLockout ? "ADMIN_USAGE_LOCKOUT" : "ADMIN_USAGE_LOCKOUT_CLEAR",
			userId: user.id
		});

		logToFile(enableLockout ? "ADMIN_USAGE_LOCKOUT" : "ADMIN_USAGE_LOCKOUT_CLEAR", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			reason: enableLockout ? reason.trim() : null,
			lockout_until: enableLockout ? user.usage_lockout_until : null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, enableLockout ? "Usage restriction applied." : "Usage restriction removed.", {
			id: user.id,
			usageLockoutUntil: user.usage_lockout_until,
			usageLockoutReason: user.usage_lockout_reason || null
		});
	} catch (error) {
		logToFile(enableLockout ? "ADMIN_USAGE_LOCKOUT" : "ADMIN_USAGE_LOCKOUT_CLEAR", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating usage restrictions."]);
	}
}

async function handleAdminApiKeyRevoke(req, res, identifier) {
	const adminId = req.user.id;
	try {
		const bulkByUser = Number.isInteger(identifier.userId)
			&& !Number.isInteger(identifier.id)
			&& !identifier.name
			&& !identifier.prefix;
		if (bulkByUser) {
			const keysResult = await pool.query(
				`SELECT k.id, k.name, k.key_prefix, k.user_id, u.email, u.preferred_name
				 FROM user_api_keys k
				 JOIN users u ON u.id = k.user_id
				 WHERE k.user_id = $1 AND k.revoked_at IS NULL`,
				[identifier.userId]
			);
			if (keysResult.rows.length === 0) {
				return errorResponse(res, 404, "API key not found.", ["No active API keys were found for this user."]);
			}
			await pool.query(
				"UPDATE user_api_keys SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
				[identifier.userId]
			);
			const firstKey = keysResult.rows[0];
			const keyName = keysResult.rows.length > 1 ? "multiple API keys" : (firstKey.name || "API key");
			const keyPrefix = keysResult.rows.length > 1 ? null : firstKey.key_prefix;
			enqueueEmail({
				type: "api_key_revoked",
				params: {
					toEmail: firstKey.email,
					preferredName: firstKey.preferred_name,
					keyId: firstKey.id,
					keyName,
					keyPrefix,
					initiator: "admin"
				},
				context: "ADMIN_API_KEY_REVOKE",
				userId: firstKey.user_id
			});

			logToFile("ADMIN_API_KEY_REVOKE", {
				status: "SUCCESS",
				admin_id: adminId,
				user_id: firstKey.user_id,
				key_count: keysResult.rows.length,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, "API keys revoked successfully.", {
				userId: firstKey.user_id,
				revokedCount: keysResult.rows.length
			});
		}

		const clauses = [];
		const values = [];
		let idx = 1;
		if (Number.isInteger(identifier.id)) {
			clauses.push(`k.id = $${idx++}`);
			values.push(identifier.id);
		}
		if (Number.isInteger(identifier.userId)) {
			clauses.push(`k.user_id = $${idx++}`);
			values.push(identifier.userId);
		}
		if (identifier.name) {
			clauses.push(`k.name = $${idx++}`);
			values.push(identifier.name);
		}
		if (identifier.prefix) {
			clauses.push(`k.key_prefix = $${idx++}`);
			values.push(identifier.prefix);
		}
		if (clauses.length === 0) {
			return errorResponse(res, 400, "Validation Error", ["Provide an API key id, userId, name, or prefix."]);
		}

		const match = await pool.query(
			`SELECT k.id, k.name, k.key_prefix, k.user_id, u.email, u.preferred_name
			 FROM user_api_keys k
			 JOIN users u ON u.id = k.user_id
			 WHERE ${clauses.join(" AND ")}`,
			values
		);

		if (match.rows.length === 0) {
			return errorResponse(res, 404, "API key not found.", ["The requested API key could not be located."]);
		}
		if (match.rows.length > 1) {
			return errorResponse(res, 400, "Validation Error", ["Please provide a more specific API key identifier."]);
		}

		const key = match.rows[0];
		await pool.query("UPDATE user_api_keys SET revoked_at = NOW() WHERE id = $1", [key.id]);

		enqueueEmail({
			type: "api_key_revoked",
			params: {
				toEmail: key.email,
				preferredName: key.preferred_name,
				keyId: key.id,
				keyName: key.name,
				keyPrefix: key.key_prefix,
				initiator: "admin"
			},
			context: "ADMIN_API_KEY_REVOKE",
			userId: key.user_id
		});

		logToFile("ADMIN_API_KEY_REVOKE", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: key.user_id,
			key_id: key.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "API key revoked successfully.", {
			id: key.id,
			userId: key.user_id
		});
	} catch (error) {
		logToFile("ADMIN_API_KEY_REVOKE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while revoking the API key."]);
	}
}

// `POST /admin/users/:id/enable` - Re-enable a disabled user profile by ID (admin only)
router.post("/users/:id/enable", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleEnableUser(req, res, targetId);
});

// `POST /admin/users/enable` with JSON body containing { id: userId } is also supported
router.post("/users/enable", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleEnableUser(req, res, resolved.id);
});

router.post("/users/:id/api-key-ban", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	return handleApiKeyBan(req, res, targetId, true);
});

router.post("/users/api-key-ban", adminAuth, async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const resolved = await resolveTargetUserId({ idValue: params.id, emailValue: params.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleApiKeyBan(req, res, resolved.id, true);
});

router.post("/users/:id/api-key-unban", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	return handleApiKeyBan(req, res, targetId, false);
});

router.post("/users/api-key-unban", adminAuth, async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const resolved = await resolveTargetUserId({ idValue: params.id, emailValue: params.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleApiKeyBan(req, res, resolved.id, false);
});

router.post("/users/:id/usage-warning-api-key", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const keyName = normalizeText(req.body?.keyName) || "API key";
	const usageLevel = normalizeText(req.body?.usageLevel) || "High";
	const errors = [];
	if (keyName.length > 120) errors.push("Key name must be 120 characters or fewer.");
	if (usageLevel.length > 40) errors.push("Usage level must be 40 characters or fewer.");
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}
	try {
		const result = await pool.query(
			`SELECT id, email, preferred_name
			 FROM users
			 WHERE id = $1`,
			[targetId]
		);
		if (result.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}
		const user = result.rows[0];
		enqueueEmail({
			type: "usage_warning_api_key",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				keyName,
				usageLevel
			},
			context: "ADMIN_USAGE_WARNING",
			userId: user.id
		});
		logToFile("ADMIN_USAGE_WARNING", {
			status: "SUCCESS",
			admin_id: req.user.id,
			user_id: user.id,
			key_name: keyName,
			usage_level: usageLevel,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");
		return successResponse(res, 200, "Usage warning email queued.", {
			id: user.id,
			email: user.email,
			usageLevel,
			keyName
		});
	} catch (error) {
		logToFile("ADMIN_USAGE_WARNING", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Email service error", ["Unable to queue usage warning email."]);
	}
});

router.post("/users/:id/usage-lockout", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	return handleUsageLockout(req, res, targetId, true);
});

router.post("/users/usage-lockout", adminAuth, async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const resolved = await resolveTargetUserId({ idValue: params.id, emailValue: params.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleUsageLockout(req, res, resolved.id, true);
});

router.post("/users/:id/usage-lockout/clear", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	return handleUsageLockout(req, res, targetId, false);
});

router.post("/users/usage-lockout/clear", adminAuth, async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const resolved = await resolveTargetUserId({ idValue: params.id, emailValue: params.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleUsageLockout(req, res, resolved.id, false);
});

router.post("/api-keys/:id/revoke", adminAuth, async (req, res) => {
	const keyId = parseId(req.params.id);
	if (!Number.isInteger(keyId)) {
		return errorResponse(res, 400, "Validation Error", ["API key id must be a valid integer."]);
	}
	return handleAdminApiKeyRevoke(req, res, { id: keyId });
});

router.post("/api-keys/revoke", adminAuth, async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	return handleAdminApiKeyRevoke(req, res, {
		id: parseId(params.id),
		userId: parseId(params.userId),
		name: normalizeText(params.name),
		prefix: normalizeText(params.prefix)
	});
});

async function handleUnverifyUser(req, res, targetId) {
	const adminId = req.user.id;
	const reasonErrors = validateReason(req.body?.reason);
	if (reasonErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", reasonErrors);
	}
	const reason = req.body.reason.trim();

	try {
		const result = await pool.query(
			`UPDATE users
			 SET is_verified = false
			 WHERE id = $1
			 RETURNING id, email, preferred_name`,
			[targetId]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = result.rows[0];
		enqueueEmail({
			type: "admin_email_unverified",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				reason
			},
			context: "ADMIN_UNVERIFY",
			userId: user.id
		});

		logToFile("ADMIN_USER_UNVERIFY", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			reason,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "User marked as unverified.", { id: user.id });
	} catch (error) {
		logToFile("ADMIN_USER_UNVERIFY", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while unverifying the user."]);
	}
}

// `POST /admin/users/:id/unverify` - Mark a user’s email as unverified by ID (admin only)
router.post("/users/:id/unverify", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleUnverifyUser(req, res, targetId);
});

// `POST /admin/users/unverify` with JSON body containing { id: userId } is also supported
router.post("/users/unverify", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleUnverifyUser(req, res, resolved.id);
});

async function handleVerifyUser(req, res, targetId) {
	const adminId = req.user.id;
	const reasonErrors = validateReason(req.body?.reason);
	if (reasonErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", reasonErrors);
	}
	const reason = req.body.reason.trim();

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const result = await client.query(
			`UPDATE users
			 SET is_verified = true
			 WHERE id = $1
			 RETURNING id, email, preferred_name`,
			[targetId]
		);

		if (result.rows.length === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		await client.query(
			`UPDATE verification_tokens
			 SET used = true
			 WHERE user_id = $1 AND token_type = 'email_verification' AND used = false`,
			[targetId]
		);

		await client.query("COMMIT");
		await maybeCleanupVerificationTokens(client);

		const user = result.rows[0];
		enqueueEmail({
			type: "admin_email_verified",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				reason
			},
			context: "ADMIN_VERIFY",
			userId: user.id
		});

		logToFile("ADMIN_USER_VERIFY", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			reason,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "User marked as verified.", { id: user.id });
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("ADMIN_USER_VERIFY", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while verifying the user."]);
	} finally {
		client.release();
	}
}

// `POST /admin/users/:id/verify` - Mark a user’s email as verified by ID (admin only)
router.post("/users/:id/verify", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleVerifyUser(req, res, targetId);
});

// `POST /admin/users/verify` with JSON body containing { id: userId } is also supported
router.post("/users/verify", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleVerifyUser(req, res, resolved.id);
});

async function handleSendVerification(req, res, targetId) {
	const adminId = req.user.id;
	const { value: durationMinutes, error: durationError } = normalizeDurationMinutes(req.body?.duration, 30);
	if (durationError) {
		return errorResponse(res, 400, "Validation Error", [durationError]);
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const userRes = await client.query(
			`SELECT id, email, preferred_name, is_verified
			 FROM users WHERE id = $1`,
			[targetId]
		);

		if (userRes.rows.length === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = userRes.rows[0];
		const wasVerified = Boolean(user.is_verified);
		if (wasVerified) {
			await client.query(
				`UPDATE users
				 SET is_verified = FALSE, updated_at = NOW()
				 WHERE id = $1`,
				[targetId]
			);
		}

		const { token, expiresAt } = await issueVerificationToken(client, targetId, durationMinutes);
		await client.query("COMMIT");
		await maybeCleanupVerificationTokens(client);

		const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
		enqueueEmail({
			type: "verification",
			params: { toEmail: user.email, token, preferredName: user.preferred_name, expiresIn },
			context: "ADMIN_SEND_VERIFICATION",
			userId: user.id
		});

		logToFile("ADMIN_SEND_VERIFICATION", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			was_verified: wasVerified,
			duration_minutes: durationMinutes,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Verification email sent successfully.", {
			id: user.id,
			expiresInMinutes: durationMinutes,
			verifiedReset: wasVerified
		});
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("ADMIN_SEND_VERIFICATION", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while sending verification email."]);
	} finally {
		client.release();
	}
}

// `POST /admin/users/:id/send-verification` - Resend email verification email for a user (admin only)
router.post("/users/:id/send-verification", [...adminAuth, emailCostLimiter], async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleSendVerification(req, res, targetId);
});

// `POST /admin/users/send-verification` with JSON body containing { id: userId } is also supported
router.post("/users/send-verification", [...adminAuth, emailCostLimiter], async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleSendVerification(req, res, resolved.id);
});

// GET /admin/users/:id/email-preferences - View email preferences for a user
router.get("/users/:id/email-preferences", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}

	try {
		const preferences = await getUserEmailPreferences(targetId);
		if (!preferences) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}
		return successResponse(res, 200, "Email preferences retrieved successfully.", {
			userId: targetId,
			preferences: preferenceSummary(preferences)
		});
	} catch (error) {
		logToFile("ADMIN_EMAIL_PREFERENCES_GET", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve email preferences at this time."]);
	}
});

// GET/POST /admin/users/email-preferences - JSON-body/query variant for email preferences
const adminEmailPreferencesHandler = async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const resolved = await resolveTargetUserId({ idValue: params.userId ?? params.id, emailValue: params.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}

	try {
		const preferences = await getUserEmailPreferences(resolved.id);
		if (!preferences) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}
		return successResponse(res, 200, "Email preferences retrieved successfully.", {
			userId: resolved.id,
			preferences: preferenceSummary(preferences)
		});
	} catch (error) {
		logToFile("ADMIN_EMAIL_PREFERENCES_GET", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			user_id: resolved.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve email preferences at this time."]);
	}
};

router.get("/users/email-preferences", adminAuth, adminEmailPreferencesHandler);
router.post("/users/email-preferences", adminAuth, adminEmailPreferencesHandler);

// POST /admin/users/:id/email-preferences/check - Check if an email will send
router.post("/users/:id/email-preferences/check", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const emailType = typeof req.body?.emailType === "string" ? req.body.emailType.trim() : "";
	if (!emailType) {
		return errorResponse(res, 400, "Validation Error", ["emailType is required."]);
	}

	try {
		const preferences = await getUserEmailPreferences(targetId);
		if (!preferences) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}
		const result = await canSendEmailForUser({ userId: targetId, emailType });
		return successResponse(res, 200, "Email preference check complete.", {
			userId: targetId,
			emailType,
			category: getEmailCategoryForType(emailType),
			canSend: result.canSend,
			reason: result.reason,
			preferences: preferenceSummary(preferences)
		});
	} catch (error) {
		logToFile("ADMIN_EMAIL_PREFERENCES_CHECK", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to validate email preferences at this time."]);
	}
});

// POST /admin/users/email-preferences/check - JSON-body/query variant for email preference checks
router.post("/users/email-preferences/check", adminAuth, async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const resolved = await resolveTargetUserId({ idValue: params.userId ?? params.id, emailValue: params.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	const emailType = typeof params.emailType === "string" ? params.emailType.trim() : "";
	if (!emailType) {
		return errorResponse(res, 400, "Validation Error", ["emailType is required."]);
	}

	try {
		const preferences = await getUserEmailPreferences(resolved.id);
		if (!preferences) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}
		const result = await canSendEmailForUser({ userId: resolved.id, emailType });
		return successResponse(res, 200, "Email preference check complete.", {
			userId: resolved.id,
			emailType,
			category: getEmailCategoryForType(emailType),
			canSend: result.canSend,
			reason: result.reason,
			preferences: preferenceSummary(preferences)
		});
	} catch (error) {
		logToFile("ADMIN_EMAIL_PREFERENCES_CHECK", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			user_id: resolved.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to validate email preferences at this time."]);
	}
});

router.get("/emails/types", adminAuth, async (req, res) => {
	const types = Object.keys(EMAIL_TYPE_HANDLERS).map((type) => ({
		type,
		...resolveEmailTypeMetadata(type)
	}));
	logToFile("ADMIN_EMAIL_TYPES", {
		status: "SUCCESS",
		admin_id: req.user.id,
		count: types.length,
		ip: req.ip,
		user_agent: req.get("user-agent")
	}, "info");
	return successResponse(res, 200, "Email types retrieved.", { types });
});

const adminEmailHistoryHandler = async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const allowedStatuses = new Set(["queued", "sent", "failed", "skipped"]);
	const type = normalizeText(params.type);
	const status = normalizeText(params.status);
	const recipient = normalizeText(params.recipient);
	const { value: userId, error: userIdError } = parseOptionalInt(params.userId, "userId", { min: 1, max: null });
	const { value: startDate, error: startError } = parseDateFilter(params.startDate, "startDate");
	const { value: endDate, error: endError } = parseDateFilter(params.endDate, "endDate");
	const { value: limit, error: limitError } = parseOptionalInt(params.limit, "limit", { min: 5, max: 100 });
	const { value: page, error: pageError } = parseOptionalInt(params.page, "page", { min: 1, max: 100000 });

	const errors = [];
	if (startError) errors.push(startError);
	if (endError) errors.push(endError);
	if (limitError) errors.push(limitError);
	if (pageError) errors.push(pageError);
	if (userIdError) errors.push(userIdError);
	if (status && !allowedStatuses.has(status)) {
		errors.push("status must be one of: queued, sent, failed, skipped.");
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	let resolvedRecipient = recipient;
	if (Number.isInteger(userId)) {
		const userResult = await pool.query("SELECT email FROM users WHERE id = $1", [userId]);
		if (userResult.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}
		const userEmail = userResult.rows[0]?.email;
		if (!userEmail) {
			return successResponse(res, 200, "Email history retrieved successfully.", {
				history: [],
				count: 0,
				total: 0,
				page: page ?? 1,
				limit: limit ?? 25,
				hasNext: false,
				warnings: ["This user does not have an email address on file."]
			});
		}
		resolvedRecipient = String(userEmail).trim();
	}

	const filters = [];
	const values = [];
	let idx = 1;
	if (type) {
		filters.push(`email_type = $${idx++}`);
		values.push(type);
	}
	if (status) {
		filters.push(`status = $${idx++}`);
		values.push(status);
	}
	if (resolvedRecipient) {
		filters.push(`recipient_email ILIKE $${idx++}`);
		values.push(`%${resolvedRecipient}%`);
	}
	if (startDate) {
		filters.push(`queued_at >= $${idx++}`);
		values.push(startDate);
	}
	if (endDate) {
		filters.push(`queued_at <= $${idx++}`);
		values.push(endDate);
	}
	const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
	const limitValue = limit ?? 25;
	const pageValue = page ?? 1;
	const offsetValue = (pageValue - 1) * limitValue;

	try {
		const countResult = await pool.query(
			`SELECT COUNT(*)::int AS count FROM email_send_history ${whereClause}`,
			values
		);
		const total = countResult.rows[0]?.count ?? 0;
		const rowsResult = await pool.query(
			`SELECT id, job_id, email_type, recipient_email, queued_at, sent_at, status, failure_reason, retry_count
			 FROM email_send_history
			 ${whereClause}
			 ORDER BY queued_at DESC
			 LIMIT $${idx} OFFSET $${idx + 1}`,
			[...values, limitValue, offsetValue]
		);
		const rows = rowsResult.rows || [];
		const hasNext = offsetValue + rows.length < total;
		return successResponse(res, 200, "Email history retrieved successfully.", {
			history: rows,
			count: rows.length,
			total,
			page: pageValue,
			limit: limitValue,
			hasNext
		});
	} catch (error) {
		if (error?.code === "42P01") {
			return successResponse(res, 200, "Email history unavailable.", {
				history: [],
				count: 0,
				total: 0,
				page: pageValue,
				limit: limitValue,
				hasNext: false,
				warnings: ["Email history is not available yet."]
			});
		}
		logToFile("ADMIN_EMAIL_HISTORY", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to load email history."]);
	}
};

router.get("/emails/history", adminAuth, adminEmailHistoryHandler);
router.post("/emails/history", adminAuth, adminEmailHistoryHandler);

router.post("/markdown/render", adminAuth, async (req, res) => {
	const text = typeof req.body?.text === "string" ? req.body.text : "";
	if (text.length > MAX_EMAIL_BODY_LENGTH) {
		return errorResponse(res, 400, "Validation Error", [`Markdown body must be ${MAX_EMAIL_BODY_LENGTH} characters or fewer.`]);
	}
	try {
		const response = await fetch("https://api.github.com/markdown", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
				"User-Agent": "BookProjectAdmin"
			},
			body: JSON.stringify({ text, mode: "gfm" })
		});
		if (!response.ok) {
			const errorBody = await response.text();
			logToFile("ADMIN_MARKDOWN_RENDER", {
				status: "FAILURE",
				admin_id: req.user.id,
				http_status: response.status,
				error_message: errorBody.slice(0, 240)
			}, "warn");
			return errorResponse(res, 502, "Markdown rendering failed.", ["Unable to render preview right now."]);
		}
		const html = await response.text();
		return successResponse(res, 200, "Markdown rendered successfully.", { html });
	} catch (error) {
		logToFile("ADMIN_MARKDOWN_RENDER", {
			status: "FAILURE",
			admin_id: req.user.id,
			error_message: error.message
		}, "error");
		return errorResponse(res, 502, "Markdown rendering failed.", ["Unable to render preview right now."]);
	}
});

router.post("/emails/send-test", [...adminAuth, emailCostLimiter], async (req, res) => {
	const adminId = req.user.id;
	const emailTypeRaw = req.body?.emailType || req.body?.email_type;
	const emailType = typeof emailTypeRaw === "string" ? emailTypeRaw.trim() : "";
	const toEmailRaw = req.body?.toEmail || req.body?.recipient_email;
	const toEmail = normalizeEmail(toEmailRaw);
	const context = req.body?.context && typeof req.body.context === "object" ? req.body.context : {};

	const errors = [];
	if (!emailType) {
		errors.push("emailType is required.");
	} else if (!EMAIL_TYPE_HANDLERS[emailType]) {
		errors.push("Unsupported emailType.");
	}

	errors.push(...validateEmail(toEmail));
	errors.push(...validateEmailTypeContext(emailType, context));

	const expiresInMinutes = TOKEN_EMAIL_TYPES.has(emailType) ? resolveDefaultExpiry(emailType) : null;

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const params = buildTestEmailParams(emailType, toEmail, "test", expiresInMinutes, context, req.ip);
	if (!params) {
		return errorResponse(res, 400, "Validation Error", ["Unable to build email payload for this emailType."]);
	}

	const jobId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
	try {
		await recordEmailHistory({
			jobId,
			emailType,
			recipientEmail: toEmail,
			queuedAt: new Date().toISOString(),
			status: "queued",
			retryCount: 0
		});
		const sent = await EMAIL_TYPE_HANDLERS[emailType](params);
		logToFile("ADMIN_EMAIL_TEST", {
			status: sent ? "SUCCESS" : "FAILURE",
			admin_id: adminId,
			email_type: emailType,
			to_email: toEmail,
			expires_in_minutes: expiresInMinutes,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, sent ? "info" : "error");
		if (!sent) {
			await updateEmailHistory(jobId, {
				status: "failed",
				failureReason: "Email service error",
				retryCount: 0
			});
			return errorResponse(res, 500, "Email service error", ["Unable to send test email."]);
		}
		await updateEmailHistory(jobId, {
			status: "sent",
			sentAt: new Date().toISOString(),
			failureReason: null,
			retryCount: 0
		});
		return successResponse(res, 200, "Test email sent.", {
			emailType,
			toEmail,
			expiresInMinutes
		});
	} catch (error) {
		await updateEmailHistory(jobId, {
			status: "failed",
			failureReason: error.message,
			retryCount: 0
		});
		logToFile("ADMIN_EMAIL_TEST", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			email_type: emailType,
			to_email: toEmail,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Email service error", ["Unable to send test email."]);
	}
});

// POST /admin/emails/dev-features/test - Send a development/features test email
router.post("/emails/dev-features/test", [...adminAuth, emailCostLimiter], async (req, res) => {
	const adminId = req.user.id;
	const toEmail = normalizeEmail(req.body?.toEmail);
	const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
	const markdownBody = typeof req.body?.markdownBody === "string" ? req.body.markdownBody.trim() : "";

	const errors = [...validateEmail(toEmail), ...validateDevEmailPayload(subject, markdownBody)];
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const userResult = await pool.query(
			`SELECT id, preferred_name, email_pref_dev_features
			 FROM users
			 WHERE LOWER(email) = LOWER($1)` ,
			[toEmail]
		);

		const targetUser = userResult.rows[0] || null;
		let preference = { canSend: true, reason: "No preference restrictions found." };
		if (targetUser) {
			preference = await canSendEmailForUser({ userId: targetUser.id, emailType: "dev_features_announcement" });
		}

		if (!preference.canSend) {
			const jobId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
			await recordEmailHistory({
				jobId,
				emailType: "dev_features_announcement",
				recipientEmail: toEmail,
				queuedAt: new Date().toISOString(),
				status: "skipped",
				failureReason: preference.reason,
				retryCount: 0
			});
			return successResponse(res, 200, "Test email skipped by preferences.", {
				willSend: false,
				reason: preference.reason,
				toEmail
			});
		}

		enqueueEmail({
			type: "dev_features_announcement",
			userId: targetUser?.id ?? null,
			params: {
				toEmail,
				preferredName: targetUser?.preferred_name || "",
				subject,
				markdownBody
			},
			context: { source: "admin_dev_features_test", adminId }
		});
		recordDevFeaturesTest(adminId, subject, markdownBody);

		logToFile("ADMIN_DEV_FEATURES_TEST", {
			status: "SUCCESS",
			admin_id: adminId,
			to_email: toEmail,
			user_id: targetUser?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Test email queued.", {
			willSend: true,
			toEmail
		});
	} catch (error) {
		logToFile("ADMIN_DEV_FEATURES_TEST", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			to_email: toEmail,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Email service error", ["Unable to send test email."]);
	}
});

// POST /admin/emails/dev-features/recipients - Count opted-in recipients for development updates
router.post("/emails/dev-features/recipients", adminAuth, async (req, res) => {
	try {
		const result = await pool.query(
			`SELECT COUNT(*)::int AS count
			 FROM users
			 WHERE is_disabled = FALSE
			   AND email_pref_dev_features = TRUE
			   AND email IS NOT NULL`
		);
		const count = result.rows[0]?.count ?? 0;
		return successResponse(res, 200, "Opted-in recipients counted.", { count });
	} catch (error) {
		logToFile("ADMIN_DEV_FEATURES_RECIPIENTS", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to load recipient count."]);
	}
});

// POST /admin/emails/dev-features/send - Send development/features email to opted-in users
router.post("/emails/dev-features/send", [...adminAuth, emailCostLimiter], async (req, res) => {
	const adminId = req.user.id;
	const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
	const markdownBody = typeof req.body?.markdownBody === "string" ? req.body.markdownBody.trim() : "";
	const confirmFlag = parseBooleanFlag(req.body?.confirm);
	const errors = validateDevEmailPayload(subject, markdownBody);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}
	if (!confirmFlag) {
		return errorResponse(res, 400, "Confirmation required.", ["Please confirm before sending this update."]);
	}
	if (!hasRecentDevFeaturesTest(adminId, subject, markdownBody)) {
		return errorResponse(res, 400, "Test required.", ["Send a test email before notifying opted-in users."]);
	}

	try {
		const result = await pool.query(
			`SELECT id, email, preferred_name
			 FROM users
			 WHERE is_disabled = FALSE
			   AND email_pref_dev_features = TRUE
			   AND email IS NOT NULL`
		);

		const recipients = result.rows || [];
		recipients.forEach((row) => {
			enqueueEmail({
				type: "dev_features_announcement",
				userId: row.id,
				params: {
					toEmail: row.email,
					preferredName: row.preferred_name || "",
					subject,
					markdownBody
				},
				context: { source: "admin_dev_features_send", adminId }
			});
		});

		logToFile("ADMIN_DEV_FEATURES_SEND", {
			status: "SUCCESS",
			admin_id: adminId,
			queued_count: recipients.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Development updates queued.", {
			queued: recipients.length
		});
	} catch (error) {
		logToFile("ADMIN_DEV_FEATURES_SEND", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Email service error", ["Unable to send development updates."]);
	}
});

const handleAdminLibraryBooksList = async (req, res, targetId) => {
	const listParams = { ...(req.body || {}) };
	const includeDeleted = parseBooleanFlag(listParams.includeDeleted) || false;

	const errors = [];
	const sortFields = {
		title: "b.title",
		createdAt: "b.created_at",
		updatedAt: "b.updated_at"
	};
	const sortBy = normalizeText(listParams.sort) || "title";
	const sortColumn = sortFields[sortBy];
	if (!sortColumn) {
		errors.push("sort must be one of: title, createdAt, updatedAt.");
	}
	const order = parseSortOrder(listParams.order) || "asc";
	const { value: limit, error: limitError } = parseOptionalInt(listParams.limit, "limit", { min: 1, max: MAX_LIST_LIMIT });
	if (limitError) errors.push(limitError);
	const { value: page, error: pageError } = parseOptionalInt(listParams.page, "page", { min: 1 });
	if (pageError) errors.push(pageError);

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const search = normalizeText(listParams.search);
	const offset = page && limit ? Math.max(0, (page - 1) * limit) : 0;

	try {
		const values = [targetId];
		let index = 2;
		let query = `
			SELECT b.id, b.title, b.subtitle, b.created_at, b.updated_at, b.deleted_at,
			       bt.name AS book_type_name,
			       p.name AS publisher_name
			FROM books b
			LEFT JOIN book_types bt ON bt.id = b.book_type_id AND bt.user_id = b.user_id
			LEFT JOIN publishers p ON p.id = b.publisher_id AND p.user_id = b.user_id
			WHERE b.user_id = $1`;

		if (!includeDeleted) {
			query += ` AND b.deleted_at IS NULL`;
		}
		if (search) {
			query += ` AND (b.title ILIKE $${index} OR b.subtitle ILIKE $${index})`;
			values.push(`%${search}%`);
			index += 1;
		}

		query += ` ORDER BY ${sortColumn} ${order.toUpperCase()}`;
		if (limit) {
			query += ` LIMIT $${index++}`;
			values.push(limit);
		}
		if (offset) {
			query += ` OFFSET $${index++}`;
			values.push(offset);
		}

		const result = await pool.query(query, values);

		logToFile("ADMIN_LIBRARY_VIEW", {
			status: "SUCCESS",
			admin_id: req.user.id,
			user_id: targetId,
			action: "list",
			resource: "books",
			count: result.rows.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Books retrieved successfully.", {
			books: result.rows.map((row) => ({
				id: row.id,
				title: row.title,
				subtitle: row.subtitle,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				deletedAt: row.deleted_at,
				bookTypeName: row.book_type_name,
				publisherName: row.publisher_name
			}))
		});
	} catch (error) {
		logToFile("ADMIN_LIBRARY_VIEW", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			user_id: targetId,
			action: "list",
			resource: "books",
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve books at this time."]);
	}
};

// POST /admin/users/:id/library/books/list - Read-only list of a user's books
router.post("/users/:id/library/books/list", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	return handleAdminLibraryBooksList(req, res, targetId);
});

// POST /admin/users/library/books/list - JSON-body/query variant for read-only list
router.post("/users/library/books/list", adminAuth, async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const resolved = await resolveTargetUserId({ idValue: params.userId ?? params.id, emailValue: params.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleAdminLibraryBooksList(req, res, resolved.id);
});

const handleAdminLibraryBookDetail = async (req, res, targetId) => {
	const bookId = parseId(req.body?.id ?? req.query?.id);
	if (!Number.isInteger(bookId)) {
		return errorResponse(res, 400, "Validation Error", ["Book id must be a valid integer."]);
	}

	try {
		const bookResult = await pool.query(
			`SELECT b.id, b.title, b.subtitle, b.description, b.isbn, b.page_count,
			        b.publish_year, b.created_at, b.updated_at, b.deleted_at,
			        bt.id AS book_type_id, bt.name AS book_type_name,
			        p.id AS publisher_id, p.name AS publisher_name,
			        sl.id AS storage_location_id, sl.name AS storage_location_name
			 FROM books b
			 LEFT JOIN book_types bt ON bt.id = b.book_type_id AND bt.user_id = b.user_id
			 LEFT JOIN publishers p ON p.id = b.publisher_id AND p.user_id = b.user_id
			 LEFT JOIN storage_locations sl ON sl.id = b.storage_location_id AND sl.user_id = b.user_id
			 WHERE b.user_id = $1 AND b.id = $2`,
			[targetId, bookId]
		);
		if (bookResult.rows.length === 0) {
			return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
		}

		const authorResult = await pool.query(
			`SELECT a.id, a.display_name
			 FROM book_authors ba
			 JOIN authors a ON a.id = ba.author_id
			 WHERE ba.book_id = $1 AND a.user_id = $2
			 ORDER BY ba.sort_order ASC, a.display_name ASC`,
			[bookId, targetId]
		);

		const tagResult = await pool.query(
			`SELECT t.id, t.name
			 FROM book_tags bt
			 JOIN tags t ON t.id = bt.tag_id
			 WHERE bt.book_id = $1 AND t.user_id = $2
			 ORDER BY t.name ASC`,
			[bookId, targetId]
		);

		const row = bookResult.rows[0];
		const payload = {
			id: row.id,
			title: row.title,
			subtitle: row.subtitle,
			description: row.description,
			isbn: row.isbn,
			pageCount: row.page_count,
			publishYear: row.publish_year,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			deletedAt: row.deleted_at,
			bookType: row.book_type_id ? { id: row.book_type_id, name: row.book_type_name } : null,
			publisher: row.publisher_id ? { id: row.publisher_id, name: row.publisher_name } : null,
			storageLocation: row.storage_location_id ? { id: row.storage_location_id, name: row.storage_location_name } : null,
			authors: authorResult.rows.map((author) => ({ id: author.id, name: author.display_name })),
			tags: tagResult.rows.map((tag) => ({ id: tag.id, name: tag.name }))
		};

		logToFile("ADMIN_LIBRARY_VIEW", {
			status: "SUCCESS",
			admin_id: req.user.id,
			user_id: targetId,
			action: "detail",
			resource: "books",
			resource_id: bookId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Book retrieved successfully.", { book: payload });
	} catch (error) {
		logToFile("ADMIN_LIBRARY_VIEW", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: req.user.id,
			user_id: targetId,
			action: "detail",
			resource: "books",
			resource_id: bookId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve book at this time."]);
	}
};

// POST /admin/users/:id/library/books/get - Read-only book details
router.post("/users/:id/library/books/get", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	return handleAdminLibraryBookDetail(req, res, targetId);
});

// POST /admin/users/library/books/get - JSON-body/query variant for read-only book details
router.post("/users/library/books/get", adminAuth, async (req, res) => {
	const params = { ...req.query, ...(req.body || {}) };
	const resolved = await resolveTargetUserId({ idValue: params.userId ?? params.id, emailValue: params.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleAdminLibraryBookDetail(req, res, resolved.id);
});

async function handleResetPassword(req, res, targetId) {
	const adminId = req.user.id;
	const { value: durationMinutes, error: durationError } = normalizeDurationMinutes(req.body?.duration, 30);
	if (durationError) {
		return errorResponse(res, 400, "Validation Error", [durationError]);
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const userRes = await client.query(
			`SELECT id, email, preferred_name
			 FROM users WHERE id = $1`,
			[targetId]
		);
		if (userRes.rows.length === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = userRes.rows[0];
		const { token, expiresAt } = await issuePasswordResetToken(client, targetId, durationMinutes);
		await client.query("COMMIT");
		await maybeCleanupVerificationTokens(client);

		const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
		enqueueEmail({
			type: "password_reset",
			params: { toEmail: user.email, token, preferredName: user.preferred_name, expiresIn },
			context: "ADMIN_PASSWORD_RESET",
			userId: user.id
		});

		logToFile("ADMIN_PASSWORD_RESET", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			duration_minutes: durationMinutes,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Password reset email sent successfully.", {
			id: user.id,
			expiresInMinutes: durationMinutes
		});
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("ADMIN_PASSWORD_RESET", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while sending password reset email."]);
	} finally {
		client.release();
	}
}

async function handleListSessions(req, res, targetId) {
	const adminId = req.user.id;

	try {
		const userRes = await pool.query("SELECT id FROM users WHERE id = $1", [targetId]);
		if (userRes.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const { rows } = await pool.query(
			`SELECT token_fingerprint, issued_at, expires_at, ip_address::TEXT AS ip_address, user_agent
			 FROM refresh_tokens
			 WHERE user_id = $1
				 AND revoked = false
				 AND expires_at > NOW()
			 ORDER BY expires_at DESC`,
			[targetId]
		);

		const sessions = rows.map((session) => {
			const summary = summarizeUserAgent(session.user_agent);
			const expiresAt = session.expires_at;
			const millisecondsRemaining = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0;
			return {
				fingerprint: session.token_fingerprint,
				issuedAt: session.issued_at,
				expiresAt,
				expiresInSeconds: Math.floor(millisecondsRemaining / 1000),
				ipAddress: session.ip_address || null,
				locationHint: session.ip_address ? `IP ${session.ip_address}` : "Unknown",
				browser: summary.browser,
				device: summary.device,
				operatingSystem: summary.operatingSystem,
				rawUserAgent: summary.raw
			};
		});

		logToFile("ADMIN_LIST_SESSIONS", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: targetId,
			session_count: sessions.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Active sessions retrieved.", { sessions });
	} catch (error) {
		logToFile("ADMIN_LIST_SESSIONS", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["Unable to retrieve sessions at this time."]);
	}
}

// `POST /admin/users/:id/reset-password` - Trigger a password reset for a user by ID (admin only)
router.post("/users/:id/reset-password", [...adminAuth, emailCostLimiter], async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleResetPassword(req, res, targetId);
});

// `POST /admin/users/reset-password` with JSON body containing { id: userId } is also supported
router.post("/users/reset-password", [...adminAuth, emailCostLimiter], async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleResetPassword(req, res, resolved.id);
});

// POST /admin/users/:id/sessions - List all active sessions for a user (admin only)
router.post("/users/:id/sessions", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleListSessions(req, res, targetId);
});

// POST /admin/users/sessions with JSON body containing { id: userId } is also supported
router.post("/users/sessions", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleListSessions(req, res, resolved.id);
});

async function handleForceLogout(req, res, targetId) {
	const adminId = req.user.id;
	let fingerprints = [];
	const fingerprintValue = req.body?.fingerprint;
	if (Array.isArray(fingerprintValue)) {
		fingerprints = fingerprintValue.map((fp) => (typeof fp === "string" ? fp.trim() : "")).filter(Boolean);
	} else if (typeof fingerprintValue === "string") {
		fingerprints = [fingerprintValue.trim()];
	}

	try {
		const userRes = await pool.query("SELECT id FROM users WHERE id = $1", [targetId]);
		if (userRes.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		let revokedRows = [];
		if (fingerprints.length > 0) {
			const result = await pool.query(
				`UPDATE refresh_tokens
				 SET revoked = true
				 WHERE user_id = $1
					AND token_fingerprint = ANY($2)
					AND revoked = false
				 RETURNING token_fingerprint`,
				[targetId, fingerprints]
			);
			revokedRows = result.rows;
		} else {
			const result = await pool.query(
				`UPDATE refresh_tokens
				 SET revoked = true
				 WHERE user_id = $1 AND revoked = false
				 RETURNING token_fingerprint`,
				[targetId]
			);
			revokedRows = result.rows;
		}

		logToFile("ADMIN_FORCE_LOGOUT", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: targetId,
			revoked_count: revokedRows.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Sessions revoked successfully.", {
			id: targetId,
			revokedCount: revokedRows.length,
			fingerprints: revokedRows.map((row) => row.token_fingerprint)
		});
	} catch (error) {
		logToFile("ADMIN_FORCE_LOGOUT", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["Unable to revoke the requested sessions."]);
	}
}

async function handleAccountDeletion(req, res, targetId) {
	const adminId = req.user.id;
	if (targetId === adminId) {
		return errorResponse(res, 403, "Forbidden", ["Admins cannot delete their own account."]);
	}

	const confirmFlag = parseBooleanFlag(req.body?.confirm);
	if (confirmFlag !== true) {
		return errorResponse(res, 400, "Validation Error", ["You must confirm this action before proceeding."]);
	}
	const reasonErrors = validateReason(req.body?.reason);
	if (reasonErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", reasonErrors);
	}
	const reason = req.body.reason.trim();
	const confirmationEmail = normalizeEmail(req.body?.userToBeDeletedEmail);
	if (!confirmationEmail) {
		return errorResponse(res, 400, "Validation Error", ["userToBeDeletedEmail must be provided."]);
	}
	const emailErrors = validateEmail(confirmationEmail);
	if (emailErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", emailErrors);
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const userRes = await client.query(
			`SELECT id, email, metadata
			 FROM users WHERE id = $1`,
			[targetId]
		);
		if (userRes.rows.length === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = userRes.rows[0];
		if (normalizeEmail(user.email) !== confirmationEmail) {
			await client.query("ROLLBACK");
			return errorResponse(res, 400, "Validation Error", ["userToBeDeletedEmail does not match the user's email."]);
		}

		const metadata = user.metadata && typeof user.metadata === "object" ? user.metadata : {};
		const deletionConfirmation = metadata.accountDeletionConfirmed;
		if (!deletionConfirmation || !deletionConfirmation.confirmedAt) {
			await client.query("ROLLBACK");
			return errorResponse(res, 409, "Deletion not confirmed.", ["The user has not completed the account deletion confirmation flow."]);
		}

		const tableCounts = {};
		const countQueries = [
			{ name: "verification_tokens", sql: "SELECT COUNT(*)::int AS count FROM verification_tokens WHERE user_id = $1" },
			{ name: "refresh_tokens", sql: "SELECT COUNT(*)::int AS count FROM refresh_tokens WHERE user_id = $1" },
			{ name: "oauth_accounts", sql: "SELECT COUNT(*)::int AS count FROM oauth_accounts WHERE user_id = $1" },
			{ name: "book_types", sql: "SELECT COUNT(*)::int AS count FROM book_types WHERE user_id = $1" },
			{ name: "authors", sql: "SELECT COUNT(*)::int AS count FROM authors WHERE user_id = $1" },
			{ name: "publishers", sql: "SELECT COUNT(*)::int AS count FROM publishers WHERE user_id = $1" },
			{ name: "book_authors", sql: "SELECT COUNT(*)::int AS count FROM book_authors WHERE user_id = $1" },
			{ name: "book_series", sql: "SELECT COUNT(*)::int AS count FROM book_series WHERE user_id = $1" },
			{ name: "book_series_books", sql: "SELECT COUNT(*)::int AS count FROM book_series_books WHERE user_id = $1" },
			{ name: "storage_locations", sql: "SELECT COUNT(*)::int AS count FROM storage_locations WHERE user_id = $1" },
			{ name: "books", sql: "SELECT COUNT(*)::int AS count FROM books WHERE user_id = $1" },
			{ name: "book_copies", sql: "SELECT COUNT(*)::int AS count FROM book_copies WHERE user_id = $1" },
			{ name: "book_languages", sql: "SELECT COUNT(*)::int AS count FROM book_languages WHERE user_id = $1" },
			{ name: "tags", sql: "SELECT COUNT(*)::int AS count FROM tags WHERE user_id = $1" },
			{ name: "book_tags", sql: "SELECT COUNT(*)::int AS count FROM book_tags WHERE user_id = $1" }
		];

		for (const query of countQueries) {
			const countRes = await client.query(query.sql, [targetId]);
			tableCounts[query.name] = countRes.rows[0]?.count ?? 0;
		}

		const dateIds = new Set();
		const authorDates = await client.query(
			`SELECT birth_date_id, death_date_id FROM authors WHERE user_id = $1`,
			[targetId]
		);
		for (const row of authorDates.rows) {
			if (row.birth_date_id) dateIds.add(row.birth_date_id);
			if (row.death_date_id) dateIds.add(row.death_date_id);
		}

		const publisherDates = await client.query(
			`SELECT founded_date_id FROM publishers WHERE user_id = $1`,
			[targetId]
		);
		for (const row of publisherDates.rows) {
			if (row.founded_date_id) dateIds.add(row.founded_date_id);
		}

		const bookDates = await client.query(
			`SELECT publication_date_id FROM books WHERE user_id = $1`,
			[targetId]
		);
		for (const row of bookDates.rows) {
			if (row.publication_date_id) dateIds.add(row.publication_date_id);
		}

		const copyDates = await client.query(
			`SELECT acquisition_date_id FROM book_copies WHERE user_id = $1`,
			[targetId]
		);
		for (const row of copyDates.rows) {
			if (row.acquisition_date_id) dateIds.add(row.acquisition_date_id);
		}

		await client.query(`DELETE FROM users WHERE id = $1`, [targetId]);

		if (dateIds.size > 0) {
			const ids = Array.from(dateIds);
			await client.query(
				`DELETE FROM dates d
				 WHERE d.id = ANY($1)
				   AND NOT EXISTS (SELECT 1 FROM authors a WHERE a.birth_date_id = d.id OR a.death_date_id = d.id)
				   AND NOT EXISTS (SELECT 1 FROM publishers p WHERE p.founded_date_id = d.id)
				   AND NOT EXISTS (SELECT 1 FROM books b WHERE b.publication_date_id = d.id)
				   AND NOT EXISTS (SELECT 1 FROM book_copies bc WHERE bc.acquisition_date_id = d.id)`,
				[ids]
			);
		}

		await client.query("COMMIT");

		logToFile("ADMIN_ACCOUNT_DELETE", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: targetId,
			reason,
			deleted_counts: tableCounts,
			date_cleanup_count: dateIds.size,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "User account deleted permanently.", {
			id: targetId,
			deletedCounts: tableCounts,
			datesCleaned: dateIds.size
		});
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("ADMIN_ACCOUNT_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the user."]);
	} finally {
		client.release();
	}
}

// `POST /admin/users/:id/force-logout` - Force logout a user (invalidate all sessions, admin only)
router.post("/users/:id/force-logout", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleForceLogout(req, res, targetId);
});

// `POST /admin/users/force-logout` with JSON body containing { id: userId } is also supported
router.post("/users/force-logout", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleForceLogout(req, res, resolved.id);
});

// `POST /admin/users/:id/handle-account-deletion` - Permanently delete a user and all associated data after review (admin only)
router.post("/users/:id/handle-account-deletion", [...adminAuth, sensitiveActionLimiter, adminDeletionLimiter], async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleAccountDeletion(req, res, targetId);
});

// `POST /admin/users/handle-account-deletion` with JSON body containing { id: userId } is also supported
router.post("/users/handle-account-deletion", [...adminAuth, sensitiveActionLimiter, adminDeletionLimiter], async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleAccountDeletion(req, res, resolved.id);
});

// `POST /admin/languages` - Add a new language (admin only)
router.post("/languages", adminAuth, async (req, res) => {
	const rawName = normalizeText(req.body?.name);
	const normalized = normalizeLanguageName(rawName);

	const errors = validateLanguageName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query(
			`SELECT id FROM languages WHERE name_normalized = $1`,
			[normalized]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Language already exists.", ["A language with this name already exists."]);
		}

		const result = await pool.query(
			`INSERT INTO languages (name, name_normalized, created_at, updated_at)
			 VALUES ($1, $2, NOW(), NOW())
			 RETURNING id, name, created_at, updated_at`,
			[rawName, normalized]
		);

		const row = result.rows[0];
		logToFile("LANGUAGE_CREATE", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			language_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 201, "Language created successfully.", {
			id: row.id,
			name: row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
	} catch (error) {
		logToFile("LANGUAGE_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the language."]);
	}
});

async function handleLanguageUpdate(req, res, id) {
	const rawName = normalizeText(req.body?.name);
	const normalized = normalizeLanguageName(rawName);
	const errors = validateLanguageName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query(
			`SELECT id FROM languages WHERE name_normalized = $1 AND id <> $2`,
			[normalized, id]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Language already exists.", ["A language with this name already exists."]);
		}

		const result = await pool.query(
			`UPDATE languages
			 SET name = $1, name_normalized = $2, updated_at = NOW()
			 WHERE id = $3
			 RETURNING id, name, created_at, updated_at`,
			[rawName, normalized, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Language not found.", ["The requested language could not be located."]);
		}

		const row = result.rows[0];
		logToFile("LANGUAGE_UPDATE", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			language_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Language updated successfully.", {
			id: row.id,
			name: row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
	} catch (error) {
		logToFile("LANGUAGE_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the language."]);
	}
}

// `PUT /admin/languages/:id` - Update a language (admin only)
router.put("/languages/:id", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.params.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageUpdate(req, res, id);
});

// `PUT /admin/languages` - Update a language using JSON body (admin only)
router.put("/languages", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.body?.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageUpdate(req, res, id);
});

async function handleLanguageDelete(req, res, id) {
	try {
		const result = await pool.query(
			`DELETE FROM languages WHERE id = $1`,
			[id]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Language not found.", ["The requested language could not be located."]);
		}

		logToFile("LANGUAGE_DELETE", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			language_id: id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Language deleted successfully.", { id });
	} catch (error) {
		logToFile("LANGUAGE_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the language."]);
	}
}

// `DELETE /admin/languages/:id` - Delete a language (admin only)
router.delete("/languages/:id", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.params.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageDelete(req, res, id);
});

// `DELETE /admin/languages` - Delete a language using JSON body (admin only)
router.delete("/languages", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.body?.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageDelete(req, res, id);
});


module.exports = router;
