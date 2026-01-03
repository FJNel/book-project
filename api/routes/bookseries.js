const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_SERIES_NAME_LENGTH = 150;
const MAX_SERIES_DESCRIPTION_LENGTH = 1000;
const MAX_WEBSITE_LENGTH = 300;
const MAX_LIST_LIMIT = 200;

router.use((req, res, next) => {
	logToFile("BOOKSERIES_REQUEST", {
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
		logToFile("BOOKSERIES_RESPONSE", {
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

function validateSeriesName(name) {
	const errors = [];
	if (!name) {
		errors.push("Series Name must be provided.");
		return errors;
	}
	if (name.length < 2 || name.length > MAX_SERIES_NAME_LENGTH) {
		errors.push(`Series Name must be between 2 and ${MAX_SERIES_NAME_LENGTH} characters.`);
	}
	if (!/^[A-Za-z0-9\s\-.'’&/(),]+$/.test(name)) {
		errors.push("Series Name contains invalid characters.");
	}
	return errors;
}

function validateSeriesDescription(value) {
	const errors = [];
	if (value === undefined || value === null || value === "") {
		return errors;
	}
	if (typeof value !== "string") {
		errors.push("Description must be a string.");
		return errors;
	}
	if (value.trim().length > MAX_SERIES_DESCRIPTION_LENGTH) {
		errors.push(`Description must be ${MAX_SERIES_DESCRIPTION_LENGTH} characters or fewer.`);
	}
	return errors;
}

function validateWebsite(value) {
	const errors = [];
	if (value === undefined || value === null || value === "") {
		return errors;
	}
	if (typeof value !== "string") {
		errors.push("Website must be a string.");
		return errors;
	}
	const trimmed = value.trim();
	if (trimmed.length > MAX_WEBSITE_LENGTH) {
		errors.push(`Website must be ${MAX_WEBSITE_LENGTH} characters or fewer.`);
		return errors;
	}
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			errors.push("Website must start with http:// or https://.");
		}
	} catch (error) {
		errors.push("Website must be a valid URL starting with http:// or https://.");
	}
	return errors;
}

function parseBooleanFlag(value) {
	if (value === undefined || value === null) return null;
	if (typeof value === "boolean") return value;
	const normalized = String(value).trim().toLowerCase();
	if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
	if (normalized === "false" || normalized === "0" || normalized === "no") return false;
	return null;
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

function parseOptionalIntRange(value, fieldLabel, { min = 0, max = null } = {}) {
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

async function fetchSeriesStats(userId, seriesId) {
	const totalBooksResult = await pool.query(
		`SELECT COUNT(*)::int AS count FROM books WHERE user_id = $1 AND deleted_at IS NULL`,
		[userId]
	);
	const totalBooks = totalBooksResult.rows[0]?.count ?? 0;
	const result = await pool.query(
		`WITH ordered AS (
			SELECT bsb.book_order,
			       b.page_count
			FROM book_series_books bsb
			JOIN book_series bs ON bs.id = bsb.series_id AND bs.deleted_at IS NULL
			JOIN books b ON b.id = bsb.book_id AND b.deleted_at IS NULL
			WHERE bsb.user_id = $1 AND bsb.series_id = $2
		),
		per_series AS (
			SELECT COUNT(*)::int AS book_count,
			       SUM(page_count)::int AS total_pages,
			       AVG(page_count)::numeric AS avg_pages,
			       COUNT(*) FILTER (WHERE book_order IS NULL)::int AS null_orders,
			       COUNT(DISTINCT book_order) FILTER (WHERE book_order IS NOT NULL)::int AS distinct_orders,
			       COUNT(book_order) FILTER (WHERE book_order IS NOT NULL)::int AS total_orders,
			       MIN(book_order) FILTER (WHERE book_order IS NOT NULL) AS min_order,
			       MAX(book_order) FILTER (WHERE book_order IS NOT NULL) AS max_order
			FROM ordered
		)
		SELECT COALESCE(ps.book_count, 0)::int AS book_count,
		       ps.total_pages,
		       ps.avg_pages,
		       COALESCE(ps.null_orders, 0)::int AS null_orders,
		       COALESCE(GREATEST(ps.total_orders - ps.distinct_orders, 0), 0)::int AS duplicate_orders,
		       CASE
		         WHEN ps.min_order IS NULL OR ps.max_order IS NULL THEN 0
		         ELSE GREATEST((ps.max_order - ps.min_order + 1) - ps.distinct_orders, 0)
		       END AS gap_count
		FROM per_series ps`,
		[userId, seriesId]
	);
	const row = result.rows[0] || {
		book_count: 0,
		total_pages: null,
		avg_pages: null,
		null_orders: 0,
		duplicate_orders: 0,
		gap_count: 0
	};
	return {
		bookCount: row.book_count ?? 0,
		percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0,
		totalPages: row.total_pages === null ? null : Number(row.total_pages),
		avgPages: row.avg_pages === null ? null : Number(Number.parseFloat(row.avg_pages).toFixed(2)),
		nullBookOrderCount: row.null_orders ?? 0,
		duplicateOrderNumbers: row.duplicate_orders ?? 0,
		gapCount: row.gap_count ?? 0
	};
}

function parseDateFilter(value, fieldLabel) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) {
		return { error: `${fieldLabel} must be a valid ISO 8601 date.` };
	}
	return { value: new Date(parsed).toISOString() };
}

function parseBookOrder(value, fieldLabel) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) {
		return { error: `${fieldLabel} must be an integer.` };
	}
	if (parsed < 1 || parsed > 10000) {
		return { error: `${fieldLabel} must be between 1 and 10000.` };
	}
	return { value: parsed };
}

async function resolveSeriesId({ userId, id, name }) {
	const hasId = Number.isInteger(id);
	const hasName = Boolean(name);

	if (hasId && hasName) {
		const result = await pool.query(
			`SELECT id, name FROM book_series WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
			[userId, id]
		);
		if (result.rows.length === 0 || result.rows[0].name !== name) {
			return { id: null, mismatch: true };
		}
		return { id };
	}

	if (hasId) {
		return { id };
	}

	if (hasName) {
		const result = await pool.query(
			`SELECT id FROM book_series WHERE user_id = $1 AND name = $2 AND deleted_at IS NULL`,
			[userId, name]
		);
		if (result.rows.length === 0) {
			return { id: null };
		}
		return { id: result.rows[0].id };
	}
	return { id: null };
}

async function insertPartialDate(client, dateValue) {
	if (!dateValue) return null;
	const { day, month, year, text } = dateValue;
	const result = await client.query(
		`INSERT INTO dates (day, month, year, text, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, NOW(), NOW())
		 RETURNING id`,
		[day ?? null, month ?? null, year ?? null, text]
	);
	return result.rows[0]?.id ?? null;
}

async function fetchSeriesBooks(userId, seriesId) {
	const result = await pool.query(
		`SELECT bsb.book_id, bsb.book_order
		 FROM book_series_books bsb
		 WHERE bsb.user_id = $1 AND bsb.series_id = $2
		 ORDER BY bsb.book_order ASC NULLS LAST, bsb.book_id ASC`,
		[userId, seriesId]
	);
	return result.rows.map((row) => ({
		bookId: row.book_id,
		bookOrder: row.book_order
	}));
}

async function fetchSeriesDateRange(userId, seriesId) {
	const startResult = await pool.query(
		`SELECT d.id, d.day, d.month, d.year, d.text
		 FROM book_series_books bsb
		 JOIN books b ON bsb.book_id = b.id
		 JOIN dates d ON b.publication_date_id = d.id
		 WHERE bsb.user_id = $1 AND bsb.series_id = $2 AND d.year IS NOT NULL AND b.deleted_at IS NULL
		 ORDER BY make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1)) ASC
		 LIMIT 1`,
		[userId, seriesId]
	);

	const endResult = await pool.query(
		`SELECT d.id, d.day, d.month, d.year, d.text
		 FROM book_series_books bsb
		 JOIN books b ON bsb.book_id = b.id
		 JOIN dates d ON b.publication_date_id = d.id
		 WHERE bsb.user_id = $1 AND bsb.series_id = $2 AND d.year IS NOT NULL AND b.deleted_at IS NULL
		 ORDER BY make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1)) DESC
		 LIMIT 1`,
		[userId, seriesId]
	);

	const startRow = startResult.rows[0];
	const endRow = endResult.rows[0];

	return {
		startDate: startRow ? { id: startRow.id, day: startRow.day, month: startRow.month, year: startRow.year, text: startRow.text } : null,
		endDate: endRow ? { id: endRow.id, day: endRow.day, month: endRow.month, year: endRow.year, text: endRow.text } : null
	};
}

// GET /bookseries - List or fetch a specific series
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly) ?? false;
	const includeDeleted = parseBooleanFlag(listParams.includeDeleted) ?? false;
	const returnStats = parseBooleanFlag(listParams.returnStats);
	const targetId = parseId(req.query.id ?? req.body?.id);
	const targetName = normalizeText(req.query.name ?? req.body?.name);

	if (targetId !== null || targetName) {
		if (targetName) {
			const nameErrors = validateSeriesName(targetName);
			if (nameErrors.length > 0) {
				return errorResponse(res, 400, "Validation Error", nameErrors);
			}
		}

		try {
			const resolved = await resolveSeriesId({ userId, id: targetId, name: targetName });
			if (resolved.mismatch) {
				return errorResponse(res, 400, "Validation Error", ["Series id and name must refer to the same record."]);
			}
			if (!Number.isInteger(resolved.id)) {
				return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
			}

			const result = await pool.query(
				`SELECT s.id, s.name, s.description, s.website, s.created_at, s.updated_at
				 FROM book_series s
				 WHERE s.user_id = $1 AND s.id = $2 AND s.deleted_at IS NULL`,
				[userId, resolved.id]
			);

			const row = result.rows[0];
			const books = await fetchSeriesBooks(userId, resolved.id);
			const { startDate, endDate } = await fetchSeriesDateRange(userId, resolved.id);
			const payload = nameOnly
				? { id: row.id, name: row.name }
				: {
					id: row.id,
					name: row.name,
					startDate,
					endDate,
					description: row.description,
					website: row.website,
					books,
					createdAt: row.created_at,
					updatedAt: row.updated_at
				};

			if (returnStats) {
				payload.stats = await fetchSeriesStats(userId, row.id);
			}

			return successResponse(res, 200, "Series retrieved successfully.", payload);
		} catch (error) {
			logToFile("BOOK_SERIES_GET", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the series."]);
		}
	}

	const fields = nameOnly
		? "s.id, s.name"
		: `s.id, s.name, s.description, s.website, s.created_at, s.updated_at,
		   start_date.id AS start_date_id, start_date.day AS start_day, start_date.month AS start_month, start_date.year AS start_year, start_date.text AS start_text,
		   end_date.id AS end_date_id, end_date.day AS end_day, end_date.month AS end_month, end_date.year AS end_year, end_date.text AS end_text`;

	const errors = [];
	const sortFields = {
		id: "s.id",
		name: "s.name",
		description: "s.description",
		website: "s.website",
		createdAt: "s.created_at",
		updatedAt: "s.updated_at",
		startDateId: "start_date.id",
		startDay: "start_date.day",
		startMonth: "start_date.month",
		startYear: "start_date.year",
		startText: "start_date.text",
		endDateId: "end_date.id",
		endDay: "end_date.day",
		endMonth: "end_date.month",
		endYear: "end_date.year",
		endText: "end_date.text",
		startDate: "start_date.start_sort",
		endDate: "end_date.end_sort"
	};
	const sortBy = normalizeText(listParams.sortBy) || "name";
	const sortColumn = sortFields[sortBy];
	if (!sortColumn) {
		errors.push("sortBy must be one of: id, name, description, website, createdAt, updatedAt, startDate, startDateId, startDay, startMonth, startYear, startText, endDate, endDateId, endDay, endMonth, endYear, endText.");
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
	const values = [userId];
	let paramIndex = 2;

	if (!includeDeleted) {
		filters.push("s.deleted_at IS NULL");
	}

	if (listParams.filterId !== undefined) {
		const filterId = parseId(listParams.filterId);
		if (!Number.isInteger(filterId)) {
			errors.push("filterId must be a valid integer.");
		} else {
			filters.push(`s.id = $${paramIndex++}`);
			values.push(filterId);
		}
	}

	const filterName = normalizeText(listParams.filterName);
	if (filterName) {
		if (filterName.length > MAX_SERIES_NAME_LENGTH) {
			errors.push(`filterName must be ${MAX_SERIES_NAME_LENGTH} characters or fewer.`);
		} else {
			filters.push(`s.name ILIKE $${paramIndex++}`);
			values.push(`%${filterName}%`);
		}
	}

	const filterDescription = normalizeText(listParams.filterDescription);
	if (filterDescription) {
		if (filterDescription.length > MAX_SERIES_DESCRIPTION_LENGTH) {
			errors.push(`filterDescription must be ${MAX_SERIES_DESCRIPTION_LENGTH} characters or fewer.`);
		} else {
			filters.push(`s.description ILIKE $${paramIndex++}`);
			values.push(`%${filterDescription}%`);
		}
	}

	const filterWebsite = normalizeText(listParams.filterWebsite);
	if (filterWebsite) {
		if (filterWebsite.length > MAX_WEBSITE_LENGTH) {
			errors.push(`filterWebsite must be ${MAX_WEBSITE_LENGTH} characters or fewer.`);
		} else {
			filters.push(`s.website ILIKE $${paramIndex++}`);
			values.push(`%${filterWebsite}%`);
		}
	}

	if (listParams.filterStartDateId !== undefined) {
		const filterStartDateId = parseId(listParams.filterStartDateId);
		if (!Number.isInteger(filterStartDateId)) {
			errors.push("filterStartDateId must be a valid integer.");
		} else {
			filters.push(`start_date.id = $${paramIndex++}`);
			values.push(filterStartDateId);
		}
	}

	const startDay = parseOptionalIntRange(listParams.filterStartDay, "filterStartDay", { min: 1, max: 31 });
	if (startDay.error) errors.push(startDay.error);
	if (startDay.value !== null) {
		filters.push(`start_date.day = $${paramIndex++}`);
		values.push(startDay.value);
	}

	const startMonth = parseOptionalIntRange(listParams.filterStartMonth, "filterStartMonth", { min: 1, max: 12 });
	if (startMonth.error) errors.push(startMonth.error);
	if (startMonth.value !== null) {
		filters.push(`start_date.month = $${paramIndex++}`);
		values.push(startMonth.value);
	}

	const startYear = parseOptionalIntRange(listParams.filterStartYear, "filterStartYear", { min: 1, max: 9999 });
	if (startYear.error) errors.push(startYear.error);
	if (startYear.value !== null) {
		filters.push(`start_date.year = $${paramIndex++}`);
		values.push(startYear.value);
	}

	const startText = normalizeText(listParams.filterStartText);
	if (startText) {
		filters.push(`start_date.text ILIKE $${paramIndex++}`);
		values.push(`%${startText}%`);
	}

	if (listParams.filterEndDateId !== undefined) {
		const filterEndDateId = parseId(listParams.filterEndDateId);
		if (!Number.isInteger(filterEndDateId)) {
			errors.push("filterEndDateId must be a valid integer.");
		} else {
			filters.push(`end_date.id = $${paramIndex++}`);
			values.push(filterEndDateId);
		}
	}

	const endDay = parseOptionalIntRange(listParams.filterEndDay, "filterEndDay", { min: 1, max: 31 });
	if (endDay.error) errors.push(endDay.error);
	if (endDay.value !== null) {
		filters.push(`end_date.day = $${paramIndex++}`);
		values.push(endDay.value);
	}

	const endMonth = parseOptionalIntRange(listParams.filterEndMonth, "filterEndMonth", { min: 1, max: 12 });
	if (endMonth.error) errors.push(endMonth.error);
	if (endMonth.value !== null) {
		filters.push(`end_date.month = $${paramIndex++}`);
		values.push(endMonth.value);
	}

	const endYear = parseOptionalIntRange(listParams.filterEndYear, "filterEndYear", { min: 1, max: 9999 });
	if (endYear.error) errors.push(endYear.error);
	if (endYear.value !== null) {
		filters.push(`end_date.year = $${paramIndex++}`);
		values.push(endYear.value);
	}

	const endText = normalizeText(listParams.filterEndText);
	if (endText) {
		filters.push(`end_date.text ILIKE $${paramIndex++}`);
		values.push(`%${endText}%`);
	}

	const dateFilters = [
		{ key: "filterCreatedAt", column: "s.created_at", op: "=" },
		{ key: "filterUpdatedAt", column: "s.updated_at", op: "=" },
		{ key: "filterCreatedAfter", column: "s.created_at", op: ">=" },
		{ key: "filterCreatedBefore", column: "s.created_at", op: "<=" },
		{ key: "filterUpdatedAfter", column: "s.updated_at", op: ">=" },
		{ key: "filterUpdatedBefore", column: "s.updated_at", op: "<=" }
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

	const startBefore = parseDateFilter(listParams.filterStartedBefore, "filterStartedBefore");
	if (startBefore.error) errors.push(startBefore.error);
	if (startBefore.value) {
		filters.push(`start_date.start_sort <= $${paramIndex++}::date`);
		values.push(startBefore.value);
	}

	const startAfter = parseDateFilter(listParams.filterStartedAfter, "filterStartedAfter");
	if (startAfter.error) errors.push(startAfter.error);
	if (startAfter.value) {
		filters.push(`start_date.start_sort >= $${paramIndex++}::date`);
		values.push(startAfter.value);
	}

	const endBefore = parseDateFilter(listParams.filterEndedBefore, "filterEndedBefore");
	if (endBefore.error) errors.push(endBefore.error);
	if (endBefore.value) {
		filters.push(`end_date.end_sort <= $${paramIndex++}::date`);
		values.push(endBefore.value);
	}

	const endAfter = parseDateFilter(listParams.filterEndedAfter, "filterEndedAfter");
	if (endAfter.error) errors.push(endAfter.error);
	if (endAfter.value) {
		filters.push(`end_date.end_sort >= $${paramIndex++}::date`);
		values.push(endAfter.value);
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	let query = `SELECT ${fields}
			 FROM book_series s
			 LEFT JOIN LATERAL (
				SELECT d.id, d.day, d.month, d.year, d.text,
				       make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1)) AS start_sort
				FROM book_series_books bsb
				JOIN books b ON bsb.book_id = b.id
				JOIN dates d ON b.publication_date_id = d.id
				WHERE bsb.user_id = s.user_id AND bsb.series_id = s.id AND d.year IS NOT NULL
				ORDER BY make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1)) ASC
				LIMIT 1
			 ) start_date ON true
			 LEFT JOIN LATERAL (
				SELECT d.id, d.day, d.month, d.year, d.text,
				       make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1)) AS end_sort
				FROM book_series_books bsb
				JOIN books b ON bsb.book_id = b.id
				JOIN dates d ON b.publication_date_id = d.id
				WHERE bsb.user_id = s.user_id AND bsb.series_id = s.id AND d.year IS NOT NULL
				ORDER BY make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1)) DESC
				LIMIT 1
			 ) end_date ON true
			 WHERE s.user_id = $1`;
	if (filters.length > 0) {
		query += ` AND ${filters.join(" AND ")}`;
	}
	query += ` ORDER BY ${sortColumn} ${order.toUpperCase()}`;
	if (limit !== null) {
		query += ` LIMIT $${paramIndex++}`;
		values.push(limit);
	}
	if (offset !== null) {
		query += ` OFFSET $${paramIndex++}`;
		values.push(offset);
	}

	try {
		const result = await pool.query(query, values);

		logToFile("BOOK_SERIES_LIST", {
			status: "SUCCESS",
			user_id: userId,
			count: result.rows.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		const payload = result.rows.map((row) => {
			if (nameOnly) {
				return { id: row.id, name: row.name };
			}
			return {
				id: row.id,
				name: row.name,
				startDate: row.start_date_id
					? { id: row.start_date_id, day: row.start_day, month: row.start_month, year: row.start_year, text: row.start_text }
					: null,
				endDate: row.end_date_id
					? { id: row.end_date_id, day: row.end_day, month: row.end_month, year: row.end_year, text: row.end_text }
					: null,
				description: row.description,
				website: row.website,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			};
		});

		return successResponse(res, 200, "Series retrieved successfully.", { series: payload });
	} catch (error) {
		logToFile("BOOK_SERIES_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving series."]);
	}
});

// POST /bookseries - Create a new series
router.post("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const name = normalizeText(req.body?.name);
	const description = normalizeText(req.body?.description);
	const website = normalizeText(req.body?.website);

	const errors = [
		...validateSeriesName(name),
		...validateSeriesDescription(description),
		...validateWebsite(website)
	];

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query(
			`SELECT id FROM book_series WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
			[userId, name]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Series already exists.", ["A series with this name already exists."]);
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const result = await client.query(
				`INSERT INTO book_series (user_id, name, description, website, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, NOW(), NOW())
				 RETURNING id, name, description, website, created_at, updated_at`,
				[userId, name, description || null, website || null]
			);

			await client.query("COMMIT");

			const row = result.rows[0];
			logToFile("BOOK_SERIES_CREATE", {
				status: "SUCCESS",
				user_id: userId,
				series_id: row.id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 201, "Series created successfully.", {
				id: row.id,
				name: row.name,
				description: row.description,
				website: row.website,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			});
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("BOOK_SERIES_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the series."]);
	}
});

// GET /bookseries/by-name?name=Discworld - Fetch a specific series by name
router.get("/by-name", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const rawName = normalizeText(req.query.name ?? req.body?.name);
	const targetId = parseId(req.query.id ?? req.body?.id);
	const returnStats = parseBooleanFlag(req.query.returnStats ?? req.body?.returnStats);

	const errors = validateSeriesName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (Number.isInteger(targetId)) {
			const resolved = await resolveSeriesId({ userId, id: targetId, name: rawName });
			if (resolved.mismatch) {
				return errorResponse(res, 400, "Validation Error", ["Series id and name must refer to the same record."]);
			}
		}

		const result = await pool.query(
			`SELECT s.id, s.name, s.description, s.website, s.created_at, s.updated_at
			 FROM book_series s
			 WHERE s.user_id = $1 AND s.name = $2 AND s.deleted_at IS NULL`,
			[userId, rawName]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}

		const row = result.rows[0];
		const books = await fetchSeriesBooks(userId, row.id);
		const { startDate, endDate } = await fetchSeriesDateRange(userId, row.id);
		const payload = {
			id: row.id,
			name: row.name,
			startDate,
			endDate,
			description: row.description,
			website: row.website,
			books,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		};
		if (returnStats) {
			payload.stats = await fetchSeriesStats(userId, row.id);
		}
		return successResponse(res, 200, "Series retrieved successfully.", payload);
	} catch (error) {
		logToFile("BOOK_SERIES_GET", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the series."]);
	}
});

// GET /bookseries/trash - List deleted series
router.get("/trash", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	try {
		const result = await pool.query(
			`SELECT id, name, description, website, deleted_at, created_at, updated_at
			 FROM book_series
			 WHERE user_id = $1 AND deleted_at IS NOT NULL
			 ORDER BY deleted_at DESC`,
			[userId]
		);

		const payload = result.rows.map((row) => ({
			id: row.id,
			name: row.name,
			description: row.description,
			website: row.website,
			deletedAt: row.deleted_at,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		}));

		return successResponse(res, 200, "Deleted series retrieved successfully.", { series: payload });
	} catch (error) {
		logToFile("BOOK_SERIES_TRASH", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving deleted series."]);
	}
});

// GET /bookseries/stats - Series statistics
router.get("/stats", requiresAuth, statsLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => normalizeText(field)).filter(Boolean)
		: [];
	const { value: orphanLimit, error: orphanLimitError } = parseOptionalInt(params.orphanLimit, "orphanLimit", { min: 1, max: MAX_LIST_LIMIT });
	const { value: orphanOffset, error: orphanOffsetError } = parseOptionalInt(params.orphanOffset, "orphanOffset", { min: 0 });

	const fieldMap = {
		total: "COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total",
		totalSeries: "COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total_series",
		deleted: "COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted",
		withDescription: "COUNT(*) FILTER (WHERE deleted_at IS NULL AND description IS NOT NULL AND description <> '') AS with_description",
		withWebsite: "COUNT(*) FILTER (WHERE deleted_at IS NULL AND website IS NOT NULL AND website <> '') AS with_website",
		withBooks: "COUNT(*) FILTER (WHERE deleted_at IS NULL AND book_count > 0) AS with_books",
		avgBooksPerSeries: "AVG(book_count) FILTER (WHERE deleted_at IS NULL) AS avg_books_per_series",
		minBooksPerSeries: "MIN(book_count) FILTER (WHERE deleted_at IS NULL) AS min_books_per_series",
		maxBooksPerSeries: "MAX(book_count) FILTER (WHERE deleted_at IS NULL) AS max_books_per_series"
	};

	const derivedFields = [
		"largestSeries",
		"seriesCompleteness",
		"seriesWithNoBooks",
		"newestSeriesAdded",
		"oldestSeriesAdded",
		"breakdownPerSeries"
	];
	const availableFields = new Set([...Object.keys(fieldMap), ...derivedFields]);
	const selected = fields.length > 0 ? fields : Array.from(availableFields);
	const invalid = selected.filter((field) => !availableFields.has(field));
	const limitErrors = [orphanLimitError, orphanOffsetError].filter(Boolean);
	if (limitErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", limitErrors);
	}
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}

	try {
		const payload = {};
		const scalarFields = selected.filter((field) => fieldMap[field]);
		if (scalarFields.length > 0) {
			const query = `WITH series_counts AS (
					SELECT bs.id, bs.deleted_at, bs.description, bs.website, COUNT(b.id) AS book_count
					FROM book_series bs
					LEFT JOIN book_series_books bsb ON bsb.series_id = bs.id AND bsb.user_id = $1
					LEFT JOIN books b ON bsb.book_id = b.id AND b.deleted_at IS NULL
					WHERE bs.user_id = $1
					GROUP BY bs.id, bs.deleted_at, bs.description, bs.website
				)
				SELECT ${scalarFields.map((field) => fieldMap[field]).join(", ")}
				FROM series_counts`;

			const result = await pool.query(query, [userId]);
			const row = result.rows[0] || {};
			scalarFields.forEach((field) => {
				const key = field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
				payload[field] = row[key] ?? null;
			});
		}

		if (selected.includes("largestSeries")) {
			const totalBooksResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL`,
				[userId]
			);
			const totalBooks = totalBooksResult.rows[0]?.count ?? 0;
			const largestResult = await pool.query(
				`SELECT bs.id, bs.name, COUNT(DISTINCT b.id)::int AS book_count
				 FROM book_series bs
				 LEFT JOIN book_series_books bsb ON bsb.series_id = bs.id AND bsb.user_id = bs.user_id
				 LEFT JOIN books b ON b.id = bsb.book_id AND b.deleted_at IS NULL
				 WHERE bs.user_id = $1 AND bs.deleted_at IS NULL
				 GROUP BY bs.id, bs.name
				 ORDER BY book_count DESC, bs.name ASC
				 LIMIT 1`,
				[userId]
			);
			const row = largestResult.rows[0];
			payload.largestSeries = row
				? {
					id: row.id,
					name: row.name,
					bookCount: row.book_count,
					percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
				}
				: null;
		}

		if (selected.includes("seriesCompleteness")) {
			const completenessResult = await pool.query(
				`WITH ordered AS (
					SELECT bsb.series_id,
					       bsb.book_order
					FROM book_series_books bsb
					JOIN book_series bs ON bs.id = bsb.series_id
					JOIN books b ON b.id = bsb.book_id AND b.deleted_at IS NULL
					WHERE bsb.user_id = $1 AND bs.deleted_at IS NULL
				),
				per_series AS (
					SELECT series_id,
					       COUNT(*) FILTER (WHERE book_order IS NULL)::int AS null_orders,
					       COUNT(DISTINCT book_order) FILTER (WHERE book_order IS NOT NULL)::int AS distinct_orders,
					       COUNT(book_order) FILTER (WHERE book_order IS NOT NULL)::int AS total_orders,
					       MIN(book_order) FILTER (WHERE book_order IS NOT NULL) AS min_order,
					       MAX(book_order) FILTER (WHERE book_order IS NOT NULL) AS max_order
					FROM ordered
					GROUP BY series_id
				)
				SELECT SUM(null_orders)::int AS null_order_count,
				       SUM(GREATEST(total_orders - distinct_orders, 0))::int AS duplicate_order_count,
				       SUM(
				         CASE
				           WHEN min_order IS NULL OR max_order IS NULL THEN 0
				           ELSE GREATEST((max_order - min_order + 1) - distinct_orders, 0)
				         END
				       )::int AS gap_count
				FROM per_series`,
				[userId]
			);
			const row = completenessResult.rows[0] || {};
			payload.seriesCompleteness = {
				missingBookOrderNumbers: row.gap_count ?? 0,
				duplicateOrderNumbers: row.duplicate_order_count ?? 0,
				nullBookOrderCount: row.null_order_count ?? 0
			};
		}

		if (selected.includes("seriesWithNoBooks")) {
			const limitValue = orphanLimit ?? 50;
			const offsetValue = orphanOffset ?? 0;
			const orphanResult = await pool.query(
				`SELECT bs.id, bs.name, bs.created_at
				 FROM book_series bs
				 LEFT JOIN book_series_books bsb ON bsb.series_id = bs.id AND bsb.user_id = bs.user_id
				 LEFT JOIN books b ON b.id = bsb.book_id AND b.deleted_at IS NULL
				 WHERE bs.user_id = $1 AND bs.deleted_at IS NULL
				 GROUP BY bs.id, bs.name, bs.created_at
				 HAVING COUNT(b.id) = 0
				 ORDER BY bs.name ASC
				 LIMIT $2 OFFSET $3`,
				[userId, limitValue, offsetValue]
			);
			payload.seriesWithNoBooks = orphanResult.rows.map((row) => ({
				id: row.id,
				name: row.name,
				createdAt: row.created_at
			}));
		}

		if (selected.includes("newestSeriesAdded")) {
			const newestResult = await pool.query(
				`SELECT id, name, created_at
				 FROM book_series
				 WHERE user_id = $1 AND deleted_at IS NULL
				 ORDER BY created_at DESC
				 LIMIT 1`,
				[userId]
			);
			const row = newestResult.rows[0];
			payload.newestSeriesAdded = row
				? { id: row.id, name: row.name, createdAt: row.created_at }
				: null;
		}

		if (selected.includes("oldestSeriesAdded")) {
			const oldestResult = await pool.query(
				`SELECT id, name, created_at
				 FROM book_series
				 WHERE user_id = $1 AND deleted_at IS NULL
				 ORDER BY created_at ASC
				 LIMIT 1`,
				[userId]
			);
			const row = oldestResult.rows[0];
			payload.oldestSeriesAdded = row
				? { id: row.id, name: row.name, createdAt: row.created_at }
				: null;
		}

		if (selected.includes("breakdownPerSeries")) {
			const totalBooksResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL`,
				[userId]
			);
			const totalBooks = totalBooksResult.rows[0]?.count ?? 0;
			const breakdownResult = await pool.query(
				`WITH ordered AS (
					SELECT bsb.series_id,
					       bsb.book_order,
					       b.page_count
					FROM book_series_books bsb
					JOIN book_series bs ON bs.id = bsb.series_id AND bs.deleted_at IS NULL
					JOIN books b ON b.id = bsb.book_id AND b.deleted_at IS NULL
					WHERE bsb.user_id = $1
				),
				per_series AS (
					SELECT series_id,
					       COUNT(*)::int AS book_count,
					       SUM(page_count)::int AS total_pages,
					       AVG(page_count)::numeric AS avg_pages,
					       COUNT(*) FILTER (WHERE book_order IS NULL)::int AS null_orders,
					       COUNT(DISTINCT book_order) FILTER (WHERE book_order IS NOT NULL)::int AS distinct_orders,
					       COUNT(book_order) FILTER (WHERE book_order IS NOT NULL)::int AS total_orders,
					       MIN(book_order) FILTER (WHERE book_order IS NOT NULL) AS min_order,
					       MAX(book_order) FILTER (WHERE book_order IS NOT NULL) AS max_order
					FROM ordered
					GROUP BY series_id
				)
				SELECT bs.id, bs.name,
				       COALESCE(ps.book_count, 0)::int AS book_count,
				       ps.total_pages,
				       ps.avg_pages,
				       COALESCE(ps.null_orders, 0)::int AS null_orders,
				       COALESCE(GREATEST(ps.total_orders - ps.distinct_orders, 0), 0)::int AS duplicate_orders,
				       CASE
				         WHEN ps.min_order IS NULL OR ps.max_order IS NULL THEN 0
				         ELSE GREATEST((ps.max_order - ps.min_order + 1) - ps.distinct_orders, 0)
				       END AS gap_count
				FROM book_series bs
				LEFT JOIN per_series ps ON ps.series_id = bs.id
				WHERE bs.user_id = $1 AND bs.deleted_at IS NULL
				ORDER BY bs.name ASC`,
				[userId]
			);
			payload.breakdownPerSeries = breakdownResult.rows.map((row) => ({
				id: row.id,
				name: row.name,
				bookCount: row.book_count,
				percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0,
				totalPages: row.total_pages === null ? null : Number(row.total_pages),
				avgPages: row.avg_pages === null ? null : Number(Number.parseFloat(row.avg_pages).toFixed(2)),
				nullBookOrderCount: row.null_orders,
				duplicateOrderNumbers: row.duplicate_orders,
				gapCount: row.gap_count
			}));
		}

		return successResponse(res, 200, "Series stats retrieved successfully.", { stats: payload });
	} catch (error) {
		logToFile("BOOK_SERIES_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve series stats at this time."]);
	}
});

// GET /bookseries/:id - Fetch a specific series by ID
router.get("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = parseId(req.params.id);
	const returnStats = parseBooleanFlag(req.query.returnStats ?? req.body?.returnStats);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Series id must be a valid integer."]);
	}

	try {
		const result = await pool.query(
			`SELECT s.id, s.name, s.description, s.website, s.created_at, s.updated_at
			 FROM book_series s
			 WHERE s.user_id = $1 AND s.id = $2 AND s.deleted_at IS NULL`,
			[userId, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}

		const row = result.rows[0];
		const books = await fetchSeriesBooks(userId, row.id);
		const { startDate, endDate } = await fetchSeriesDateRange(userId, row.id);
		const payload = {
			id: row.id,
			name: row.name,
			startDate,
			endDate,
			description: row.description,
			website: row.website,
			books,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		};
		if (returnStats) {
			payload.stats = await fetchSeriesStats(userId, row.id);
		}
		return successResponse(res, 200, "Series retrieved successfully.", payload);
	} catch (error) {
		logToFile("BOOK_SERIES_GET", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the series."]);
	}
});

async function handleSeriesUpdate(req, res, seriesId) {
	const userId = req.user.id;
	const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
	const hasDescription = Object.prototype.hasOwnProperty.call(req.body || {}, "description");
	const hasWebsite = Object.prototype.hasOwnProperty.call(req.body || {}, "website");

	const name = hasName ? normalizeText(req.body?.name) : undefined;
	const description = hasDescription ? normalizeText(req.body?.description) : undefined;
	const website = hasWebsite ? normalizeText(req.body?.website) : undefined;

	const errors = [
		...(hasName ? validateSeriesName(name) : []),
		...(hasDescription ? validateSeriesDescription(description) : []),
		...(hasWebsite ? validateWebsite(website) : [])
	];

	if (!hasName && !hasDescription && !hasWebsite) {
		return errorResponse(res, 400, "No changes were provided.", ["Please provide at least one field to update."]);
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (hasName) {
			const existing = await pool.query(
				`SELECT id FROM book_series WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3`,
				[userId, name, seriesId]
			);
			if (existing.rows.length > 0) {
				return errorResponse(res, 409, "Series already exists.", ["A series with this name already exists."]);
			}
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const updateFields = [];
			const params = [userId, seriesId];
			let index = 3;

			if (hasName) {
				updateFields.push(`name = $${index++}`);
				params.push(name);
			}
			if (hasDescription) {
				updateFields.push(`description = $${index++}`);
				params.push(description || null);
			}
			if (hasWebsite) {
				updateFields.push(`website = $${index++}`);
				params.push(website || null);
			}

			const result = await client.query(
				`UPDATE book_series
				 SET ${updateFields.join(", ")}, updated_at = NOW()
				 WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
				 RETURNING id, name, description, website, created_at, updated_at`,
				params
			);

			if (result.rows.length === 0) {
				await client.query("ROLLBACK");
				return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
			}

			await client.query("COMMIT");

			const row = result.rows[0];
			logToFile("BOOK_SERIES_UPDATE", {
				status: "SUCCESS",
				user_id: userId,
				series_id: row.id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, "Series updated successfully.", {
				id: row.id,
				name: row.name,
				description: row.description,
				website: row.website,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			});
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("BOOK_SERIES_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the series."]);
	}
}

// PUT /bookseries/:id - Update a series by id
router.put("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Series id must be a valid integer."]);
	}
	return handleSeriesUpdate(req, res, id);
});

// PUT /bookseries - Update a series by id or name
router.put("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetName = normalizeText(req.body?.targetName ?? req.body?.name);

	if (!Number.isInteger(targetId) && !targetName) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a series id or name to update."]);
	}
	if (targetName) {
		const nameErrors = validateSeriesName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
	}

	const resolved = await resolveSeriesId({ userId, id: targetId, name: targetName });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Series id and name must refer to the same record."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
	}
	return handleSeriesUpdate(req, res, resolved.id);
});

async function handleSeriesDelete(req, res, seriesId) {
	const userId = req.user.id;
	try {
		const result = await pool.query(
			`UPDATE book_series
			 SET deleted_at = NOW()
			 WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
			 RETURNING id, deleted_at`,
			[userId, seriesId]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}

		logToFile("BOOK_SERIES_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			series_id: seriesId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Series moved to trash.", {
			id: result.rows[0].id,
			deletedAt: result.rows[0].deleted_at
		});
	} catch (error) {
		logToFile("BOOK_SERIES_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the series."]);
	}
}

// DELETE /bookseries/:id - Remove a series by id
router.delete("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Series id must be a valid integer."]);
	}
	return handleSeriesDelete(req, res, id);
});

// DELETE /bookseries - Remove a series by id or name
router.delete("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetName = normalizeText(req.body?.name);

	if (!Number.isInteger(targetId) && !targetName) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a series id or name to delete."]);
	}
	if (targetName) {
		const nameErrors = validateSeriesName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
	}

	const resolved = await resolveSeriesId({ userId, id: targetId, name: targetName });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Series id and name must refer to the same record."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
	}
	return handleSeriesDelete(req, res, resolved.id);
});

// POST /bookseries/restore - Restore a deleted series
router.post("/restore", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetName = normalizeText(req.body?.name);

	if (!Number.isInteger(targetId) && !targetName) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a series id or name to restore."]);
	}
	if (targetName) {
		const nameErrors = validateSeriesName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
	}

	const values = [userId];
	const clauses = ["user_id = $1", "deleted_at IS NOT NULL"];
	let idx = 2;

	if (Number.isInteger(targetId)) {
		clauses.push(`id = $${idx++}`);
		values.push(targetId);
	}
	if (targetName) {
		clauses.push(`name = $${idx++}`);
		values.push(targetName);
	}

	try {
		const match = await pool.query(
			`SELECT id FROM book_series WHERE ${clauses.join(" AND ")}`,
			values
		);
		if (match.rows.length === 0) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}
		if (match.rows.length > 1) {
			return errorResponse(res, 400, "Validation Error", ["Please provide a more specific series identifier."]);
		}

		const restored = await pool.query(
			`UPDATE book_series SET deleted_at = NULL WHERE id = $1 RETURNING id`,
			[match.rows[0].id]
		);

		return successResponse(res, 200, "Series restored successfully.", { id: restored.rows[0].id });
	} catch (error) {
		logToFile("BOOK_SERIES_RESTORE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while restoring the series."]);
	}
});

// POST /bookseries/link - Link a book to a series
router.post("/link", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const seriesId = parseId(req.body?.seriesId);
	const seriesName = normalizeText(req.body?.seriesName ?? req.body?.name);
	const bookId = parseId(req.body?.bookId);
	const hasBookOrder = Object.prototype.hasOwnProperty.call(req.body || {}, "bookOrder");
	const hasBookPublishedDate = Object.prototype.hasOwnProperty.call(req.body || {}, "bookPublishedDate");
	const { value: bookOrder, error: orderError } = parseBookOrder(req.body?.bookOrder, "bookOrder");

	const errors = [];
	if (!Number.isInteger(seriesId) && !seriesName) {
		errors.push("Please provide a series id or name to link.");
	}
	if (!Number.isInteger(bookId)) {
		errors.push("Please provide a valid bookId to link.");
	}
	if (seriesName) {
		errors.push(...validateSeriesName(seriesName));
	}
	if (hasBookOrder && orderError) {
		errors.push(orderError);
	}
	if (hasBookPublishedDate) {
		errors.push("bookPublishedDate is no longer supported. Use the book's publicationDate instead.");
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const resolved = await resolveSeriesId({ userId, id: seriesId, name: seriesName });
		if (resolved.mismatch) {
			return errorResponse(res, 400, "Validation Error", ["Series id and name must refer to the same record."]);
		}
		if (!Number.isInteger(resolved.id)) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}
		const bookCheck = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND id = $2`,
			[userId, bookId]
		);
		if (bookCheck.rows.length === 0) {
			return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
		}

		const existing = await pool.query(
			`SELECT id FROM book_series_books WHERE user_id = $1 AND series_id = $2 AND book_id = $3`,
			[userId, resolved.id, bookId]
		);

		const client = await pool.connect();
		try {
			await client.query("BEGIN");

			if (existing.rows.length > 0) {
				const updateFields = [];
				const params = [];
				let index = 1;

				if (hasBookOrder) {
					updateFields.push(`book_order = $${index++}`);
					params.push(bookOrder);
				}

				if (updateFields.length > 0) {
					updateFields.push(`updated_at = NOW()`);
					params.push(userId, resolved.id, bookId);

					const result = await client.query(
						`UPDATE book_series_books
						 SET ${updateFields.join(", ")}
						 WHERE user_id = $${index++} AND series_id = $${index++} AND book_id = $${index++}
						 RETURNING id, series_id, book_id, book_order, created_at, updated_at`,
						params
					);
					await client.query("COMMIT");

					const row = result.rows[0];
					logToFile("BOOK_SERIES_LINK_UPDATE", {
						status: "SUCCESS",
						user_id: userId,
						series_id: row.series_id,
						book_id: row.book_id,
						ip: req.ip,
						user_agent: req.get("user-agent")
					}, "info");

					return successResponse(res, 200, "Book-series link updated successfully.", {
						id: row.id,
						seriesId: row.series_id,
						bookId: row.book_id,
						bookOrder: row.book_order,
						createdAt: row.created_at,
						updatedAt: row.updated_at
					});
				}

				const current = await client.query(
					`SELECT bsb.id, bsb.series_id, bsb.book_id, bsb.book_order,
					        bsb.created_at, bsb.updated_at
					 FROM book_series_books bsb
					 WHERE bsb.user_id = $1 AND bsb.series_id = $2 AND bsb.book_id = $3`,
					[userId, resolved.id, bookId]
				);
				await client.query("COMMIT");

				const row = current.rows[0];
				logToFile("BOOK_SERIES_LINK_UPDATE", {
					status: "SUCCESS",
					user_id: userId,
					series_id: row.series_id,
					book_id: row.book_id,
					ip: req.ip,
					user_agent: req.get("user-agent")
				}, "info");

				return successResponse(res, 200, "Book-series link updated successfully.", {
					id: row.id,
					seriesId: row.series_id,
					bookId: row.book_id,
					bookOrder: row.book_order,
					createdAt: row.created_at,
					updatedAt: row.updated_at
				});
			}

			const result = await client.query(
				`INSERT INTO book_series_books (user_id, series_id, book_id, book_order, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, NOW(), NOW())
				 RETURNING id, series_id, book_id, book_order, created_at, updated_at`,
				[userId, resolved.id, bookId, bookOrder]
			);
			await client.query("COMMIT");

			const row = result.rows[0];
			logToFile("BOOK_SERIES_LINK_CREATE", {
				status: "SUCCESS",
				user_id: userId,
				series_id: row.series_id,
				book_id: row.book_id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 201, "Book linked to series successfully.", {
				id: row.id,
				seriesId: row.series_id,
				bookId: row.book_id,
				bookOrder: row.book_order,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			});
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}

	} catch (error) {
		logToFile("BOOK_SERIES_LINK_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while linking the book to the series."]);
	}
});

// PUT /bookseries/link - Update a book-series link
router.put("/link", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const seriesId = parseId(req.body?.seriesId);
	const seriesName = normalizeText(req.body?.seriesName ?? req.body?.name);
	const bookId = parseId(req.body?.bookId);
	const hasBookOrder = Object.prototype.hasOwnProperty.call(req.body || {}, "bookOrder");
	const hasBookPublishedDate = Object.prototype.hasOwnProperty.call(req.body || {}, "bookPublishedDate");
	const { value: bookOrder, error: orderError } = parseBookOrder(req.body?.bookOrder, "bookOrder");

	const errors = [];
	if (!Number.isInteger(seriesId) && !seriesName) {
		errors.push("Please provide a series id or name to update the link.");
	}
	if (!Number.isInteger(bookId)) {
		errors.push("Please provide a valid bookId for the link.");
	}
	if (seriesName) {
		errors.push(...validateSeriesName(seriesName));
	}
	if (hasBookOrder && orderError) {
		errors.push(orderError);
	}
	if (hasBookPublishedDate) {
		errors.push("bookPublishedDate is no longer supported. Use the book's publicationDate instead.");
	}
	if (!hasBookOrder && !hasBookPublishedDate) {
		errors.push("Please provide at least one field to update for the link.");
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const resolved = await resolveSeriesId({ userId, id: seriesId, name: seriesName });
		if (resolved.mismatch) {
			return errorResponse(res, 400, "Validation Error", ["Series id and name must refer to the same record."]);
		}
		if (!Number.isInteger(resolved.id)) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}
		const bookCheck = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND id = $2`,
			[userId, bookId]
		);
		if (bookCheck.rows.length === 0) {
			return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const updateFields = [];
			const params = [];
			let index = 1;

			if (hasBookOrder) {
				updateFields.push(`book_order = $${index++}`);
				params.push(bookOrder);
			}

			updateFields.push(`updated_at = NOW()`);
			params.push(userId, resolved.id, bookId);

			const result = await client.query(
				`UPDATE book_series_books
				 SET ${updateFields.join(", ")}
				 WHERE user_id = $${index++} AND series_id = $${index++} AND book_id = $${index++}
				 RETURNING id, series_id, book_id, book_order, created_at, updated_at`,
				params
			);

			if (result.rows.length === 0) {
				await client.query("ROLLBACK");
				return errorResponse(res, 404, "Link not found.", ["The requested book-series link could not be located."]);
			}

			await client.query("COMMIT");

			const row = result.rows[0];
			logToFile("BOOK_SERIES_LINK_UPDATE", {
				status: "SUCCESS",
				user_id: userId,
				series_id: row.series_id,
				book_id: row.book_id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, "Book-series link updated successfully.", {
				id: row.id,
				seriesId: row.series_id,
				bookId: row.book_id,
				bookOrder: row.book_order,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			});
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("BOOK_SERIES_LINK_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the link."]);
	}
});

// DELETE /bookseries/link - Remove a book-series link
router.delete("/link", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const seriesId = parseId(req.body?.seriesId);
	const seriesName = normalizeText(req.body?.seriesName ?? req.body?.name);
	const bookId = parseId(req.body?.bookId);

	const errors = [];
	if (!Number.isInteger(seriesId) && !seriesName) {
		errors.push("Please provide a series id or name to delete the link.");
	}
	if (!Number.isInteger(bookId)) {
		errors.push("Please provide a valid bookId for the link.");
	}
	if (seriesName) {
		errors.push(...validateSeriesName(seriesName));
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const resolved = await resolveSeriesId({ userId, id: seriesId, name: seriesName });
		if (resolved.mismatch) {
			return errorResponse(res, 400, "Validation Error", ["Series id and name must refer to the same record."]);
		}
		if (!Number.isInteger(resolved.id)) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}

		const result = await pool.query(
			`DELETE FROM book_series_books
			 WHERE user_id = $1 AND series_id = $2 AND book_id = $3`,
			[userId, resolved.id, bookId]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Link not found.", ["The requested book-series link could not be located."]);
		}

		logToFile("BOOK_SERIES_LINK_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			series_id: resolved.id,
			book_id: bookId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Book unlinked from series successfully.", {
			seriesId: resolved.id,
			bookId
		});
	} catch (error) {
		logToFile("BOOK_SERIES_LINK_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while removing the link."]);
	}
});

module.exports = router;
