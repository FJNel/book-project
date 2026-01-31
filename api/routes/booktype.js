const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const {
	DEFAULT_USER_TTL_SECONDS,
	buildCacheKey,
	getCacheEntry,
	setCacheEntry
} = require("../utils/stats-cache");

const MAX_BOOK_TYPE_NAME_LENGTH = 100;
const MAX_BOOK_TYPE_DESCRIPTION_LENGTH = 1000;
const MAX_LIST_LIMIT = 200;

router.use((req, res, next) => {
	logToFile("BOOKTYPE_REQUEST", {
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
		logToFile("BOOKTYPE_RESPONSE", {
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

function validateBookTypeName(name) {
	const errors = [];
	if (!name) {
		errors.push("Book Type Name must be provided.");
		return errors;
	}
	if (name.length < 2 || name.length > MAX_BOOK_TYPE_NAME_LENGTH) {
		errors.push(`Book Type Name must be between 2 and ${MAX_BOOK_TYPE_NAME_LENGTH} characters.`);
	}
	if (!/^[A-Za-z0-9\s\-.'’&/]+$/.test(name)) {
		errors.push("Book Type Name contains invalid characters.");
	}
	return errors;
}

function validateBookTypeDescription(description) {
	const errors = [];
	if (description === undefined || description === null || description === "") {
		return errors;
	}
	if (typeof description !== "string") {
		errors.push("Description must be a string.");
		return errors;
	}
	if (description.trim().length > MAX_BOOK_TYPE_DESCRIPTION_LENGTH) {
		errors.push(`Description must be ${MAX_BOOK_TYPE_DESCRIPTION_LENGTH} characters or fewer.`);
	}
	return errors;
}

function parseBooleanFlag(value) {
	if (value === undefined || value === null) return false;
	if (typeof value === "boolean") return value;
	const normalized = String(value).trim().toLowerCase();
	return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseId(value) {
	if (value === undefined || value === null || value === "") return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) return null;
	return parsed;
}

function parseIdArray(input, label) {
	if (input === undefined || input === null) return { ids: [], error: null };
	const raw = Array.isArray(input) ? input : [input];
	const ids = [];
	for (const item of raw) {
		const parsed = parseId(item);
		if (!Number.isInteger(parsed)) {
			return { ids: [], error: `${label} must be an integer or array of integers.` };
		}
		ids.push(parsed);
	}
	return { ids, error: null };
}

function parseSortOrder(value) {
	if (!value) return "asc";
	const normalized = String(value).trim().toLowerCase();
	if (normalized === "asc" || normalized === "desc") return normalized;
	return null;
}

function parseConflictMode(value) {
	if (!value) return "decline";
	const normalized = String(value).trim().toLowerCase();
	if (["decline", "merge", "override"].includes(normalized)) return normalized;
	return null;
}

function parseIdsInput(value) {
	if (value === undefined || value === null || value === "") return { ids: [] };
	if (Array.isArray(value)) {
		const ids = value.map((entry) => Number.parseInt(entry, 10)).filter(Number.isInteger);
		return { ids };
	}
	if (typeof value === "number") {
		return Number.isInteger(value) ? { ids: [value] } : { ids: [] };
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return { ids: [] };
		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				const ids = parsed.map((entry) => Number.parseInt(entry, 10)).filter(Number.isInteger);
				return { ids };
			}
		} catch (e) {
			const parsed = Number.parseInt(trimmed, 10);
			if (Number.isInteger(parsed)) return { ids: [parsed] };
		}
	}
	return { ids: [] };
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

function parseDateFilter(value, fieldLabel) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) {
		return { error: `${fieldLabel} must be a valid ISO 8601 date.` };
	}
	return { value: new Date(parsed).toISOString() };
}

async function fetchBookTypeStats(userId, bookTypeId) {
	const totalBooksResult = await pool.query(
		`SELECT COUNT(*)::int AS count FROM books WHERE user_id = $1 AND deleted_at IS NULL`,
		[userId]
	);
	const totalBooks = totalBooksResult.rows[0]?.count ?? 0;
	const result = await pool.query(
		`SELECT COUNT(b.id)::int AS book_count,
	        AVG(b.page_count) AS avg_page_count
	 FROM book_types bt
	 LEFT JOIN books b
	   ON b.book_type_id = bt.id
	  AND b.user_id = bt.user_id
	  AND b.deleted_at IS NULL
	 WHERE bt.user_id = $1 AND bt.id = $2
	 GROUP BY bt.id`,
		[userId, bookTypeId]
	);
	const row = result.rows[0] || { book_count: 0, avg_page_count: null };
	return {
		bookCount: row.book_count ?? 0,
		percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0,
		avgPageCount: row.avg_page_count === null ? null : Number.parseFloat(row.avg_page_count)
	};
}

async function resolveBookTypeId({ userId, id, name, includeDeleted = false }) {
	const hasId = Number.isInteger(id);
	const hasName = Boolean(name);

	if (hasId && hasName) {
		const result = await pool.query(
			`SELECT id, name FROM book_types WHERE user_id = $1 AND id = $2${includeDeleted ? "" : " AND deleted_at IS NULL"}`,
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
			`SELECT id FROM book_types WHERE user_id = $1 AND name = $2${includeDeleted ? "" : " AND deleted_at IS NULL"}`,
			[userId, name]
		);
		if (result.rows.length === 0) {
			return { id: null };
		}
		return { id: result.rows[0].id };
	}
	return { id: null };
}

// GET /booktype - List all book types for the authenticated user
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly);
	const returnStats = parseBooleanFlag(listParams.returnStats);
	const includeDeleted = parseBooleanFlag(listParams.includeDeleted);
	const targetId = parseId(req.query.id ?? req.body?.id);
	const targetName = normalizeText(req.query.name ?? req.body?.name);

	if (targetId !== null || targetName) {
		if (targetName) {
			const nameErrors = validateBookTypeName(targetName);
			if (nameErrors.length > 0) {
				return errorResponse(res, 400, "Validation Error", nameErrors);
			}
		}

		try {
			const resolved = await resolveBookTypeId({ userId, id: targetId, name: targetName, includeDeleted });
			if (resolved.mismatch) {
				return errorResponse(res, 400, "Validation Error", ["Book type id and name must refer to the same record."]);
			}
			if (!Number.isInteger(resolved.id)) {
				return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
			}

			const result = await pool.query(
				`SELECT id, name, description, created_at, updated_at, deleted_at
				 FROM book_types
				 WHERE user_id = $1 AND id = $2${includeDeleted ? "" : " AND deleted_at IS NULL"}`,
				[userId, resolved.id]
			);

			if (result.rows.length === 0) {
				return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
			}

			const row = result.rows[0];
			const payload = nameOnly
				? { id: row.id, name: row.name }
				: {
					id: row.id,
					name: row.name,
					description: row.description,
					createdAt: row.created_at,
					updatedAt: row.updated_at,
					deletedAt: row.deleted_at
				};

			if (returnStats) {
				payload.stats = await fetchBookTypeStats(userId, row.id);
			}

			return successResponse(res, 200, "Book type retrieved successfully.", payload);
		} catch (error) {
			logToFile("BOOK_TYPE_GET", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the book type."]);
		}
	}

	const fields = nameOnly
		? "id, name"
		: "id, name, description, created_at, updated_at, deleted_at";

	try {
		const errors = [];
		const sortFields = {
			id: "id",
			name: "name",
			description: "description",
			createdAt: "created_at",
			updatedAt: "updated_at"
		};
		const sortBy = normalizeText(listParams.sortBy) || "name";
		const sortColumn = sortFields[sortBy];
		if (!sortColumn) {
			errors.push("sortBy must be one of: id, name, description, createdAt, updatedAt.");
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
		const includeDeleted = parseBooleanFlag(listParams.includeDeleted);
		if (!includeDeleted) {
			filters.push("deleted_at IS NULL");
		}

		if (listParams.filterId !== undefined) {
			const { ids, error } = parseIdArray(listParams.filterId, "filterId");
			if (error) {
				errors.push(error);
			} else if (ids.length > 0) {
				const mode = String(listParams.filterIdMode || "and").toLowerCase() === "or" ? "or" : "and";
				if (mode === "or") {
					filters.push(`id = ANY($${paramIndex++}::int[])`);
					values.push(ids);
				} else {
					ids.forEach((id) => {
						filters.push(`id = $${paramIndex++}`);
						values.push(id);
					});
				}
			}
		}

		const filterName = normalizeText(listParams.filterName);
		if (filterName) {
			if (filterName.length > MAX_BOOK_TYPE_NAME_LENGTH) {
				errors.push(`filterName must be ${MAX_BOOK_TYPE_NAME_LENGTH} characters or fewer.`);
			} else {
				filters.push(`name ILIKE $${paramIndex++}`);
				values.push(`%${filterName}%`);
			}
		}

		const filterDescription = normalizeText(listParams.filterDescription);
		if (filterDescription) {
			if (filterDescription.length > MAX_BOOK_TYPE_DESCRIPTION_LENGTH) {
				errors.push(`filterDescription must be ${MAX_BOOK_TYPE_DESCRIPTION_LENGTH} characters or fewer.`);
			} else {
				filters.push(`description ILIKE $${paramIndex++}`);
				values.push(`%${filterDescription}%`);
			}
		}

		const dateFilters = [
			{ key: "filterCreatedAt", column: "created_at", op: "=" },
			{ key: "filterUpdatedAt", column: "updated_at", op: "=" },
			{ key: "filterCreatedAfter", column: "created_at", op: ">=" },
			{ key: "filterCreatedBefore", column: "created_at", op: "<=" },
			{ key: "filterUpdatedAfter", column: "updated_at", op: ">=" },
			{ key: "filterUpdatedBefore", column: "updated_at", op: "<=" }
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

		let query = `SELECT ${fields}
			 FROM book_types
			 WHERE user_id = $1`;
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

		const result = await pool.query(
			query,
			values
		);

		logToFile("BOOK_TYPE_LIST", {
			status: "SUCCESS",
			user_id: userId,
			count: result.rows.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		const payload = nameOnly
			? result.rows.map((row) => ({ id: row.id, name: row.name }))
			: result.rows.map((row) => ({
				id: row.id,
				name: row.name,
				description: row.description,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				deletedAt: row.deleted_at
			}));

		return successResponse(res, 200, "Book types retrieved successfully.", { bookTypes: payload });
	} catch (error) {
		logToFile("BOOK_TYPE_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving book types."]);
	}
});

// POST /booktype/list - List book types with JSON body
router.post("/list", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...(req.query || {}), ...(req.body || {}) };
	listParams.sortBy = listParams.sortBy ?? listParams.sort;
	listParams.filterName = listParams.filterName ?? listParams.name;
	listParams.filterDescription = listParams.filterDescription ?? listParams.description;
	listParams.filterCreatedAfter = listParams.filterCreatedAfter ?? listParams.createdAfter;
	listParams.filterCreatedBefore = listParams.filterCreatedBefore ?? listParams.createdBefore;
	listParams.filterUpdatedAfter = listParams.filterUpdatedAfter ?? listParams.updatedAfter;
	listParams.filterUpdatedBefore = listParams.filterUpdatedBefore ?? listParams.updatedBefore;

	const nameOnly = parseBooleanFlag(listParams.nameOnly);
	const fields = nameOnly
		? "id, name"
		: "id, name, description, created_at, updated_at, deleted_at";

	try {
		const errors = [];
		const sortFields = {
			id: "id",
			name: "name",
			description: "description",
			createdAt: "created_at",
			updatedAt: "updated_at"
		};
		const sortBy = normalizeText(listParams.sortBy) || "name";
		const sortColumn = sortFields[sortBy];
		if (!sortColumn) {
			errors.push("sortBy must be one of: id, name, description, createdAt, updatedAt.");
		}

		const order = parseSortOrder(listParams.order);
		if (!order) {
			errors.push("order must be either asc or desc.");
		}

		const { value: limit, error: limitError } = parseOptionalInt(listParams.limit, "limit", { min: 1, max: MAX_LIST_LIMIT });
		if (limitError) errors.push(limitError);
		const { value: page, error: pageError } = parseOptionalInt(listParams.page, "page", { min: 1 });
		if (pageError) errors.push(pageError);
		let { value: offset, error: offsetError } = parseOptionalInt(listParams.offset, "offset", { min: 0 });
		if (offsetError) errors.push(offsetError);
		if (offset === null && page !== null && limit !== null) {
			offset = Math.max(0, (page - 1) * limit);
		}

		const filters = [];
		const values = [userId];
		let paramIndex = 2;
		const includeDeleted = parseBooleanFlag(listParams.includeDeleted);
		if (!includeDeleted) {
			filters.push("deleted_at IS NULL");
		}

		if (listParams.filterId !== undefined) {
			const { ids, error } = parseIdArray(listParams.filterId, "filterId");
			if (error) {
				errors.push(error);
			} else if (ids.length > 0) {
				const mode = String(listParams.filterIdMode || "and").toLowerCase() === "or" ? "or" : "and";
				if (mode === "or") {
					filters.push(`id = ANY($${paramIndex++}::int[])`);
					values.push(ids);
				} else {
					ids.forEach((id) => {
						filters.push(`id = $${paramIndex++}`);
						values.push(id);
					});
				}
			}
		}

		const filterName = normalizeText(listParams.filterName);
		if (filterName) {
			if (filterName.length > MAX_BOOK_TYPE_NAME_LENGTH) {
				errors.push(`filterName must be ${MAX_BOOK_TYPE_NAME_LENGTH} characters or fewer.`);
			} else {
				filters.push(`name ILIKE $${paramIndex++}`);
				values.push(`%${filterName}%`);
			}
		}

		const filterDescription = normalizeText(listParams.filterDescription);
		if (filterDescription) {
			if (filterDescription.length > MAX_BOOK_TYPE_DESCRIPTION_LENGTH) {
				errors.push(`filterDescription must be ${MAX_BOOK_TYPE_DESCRIPTION_LENGTH} characters or fewer.`);
			} else {
				filters.push(`description ILIKE $${paramIndex++}`);
				values.push(`%${filterDescription}%`);
			}
		}

		const dateFilters = [
			{ key: "filterCreatedAt", column: "created_at", op: "=" },
			{ key: "filterUpdatedAt", column: "updated_at", op: "=" },
			{ key: "filterCreatedAfter", column: "created_at", op: ">=" },
			{ key: "filterCreatedBefore", column: "created_at", op: "<=" },
			{ key: "filterUpdatedAfter", column: "updated_at", op: ">=" },
			{ key: "filterUpdatedBefore", column: "updated_at", op: "<=" }
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

		let query = `SELECT ${fields}
			 FROM book_types
			 WHERE user_id = $1`;
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

		const result = await pool.query(query, values);

		logToFile("BOOK_TYPE_LIST", {
			status: "SUCCESS",
			user_id: userId,
			count: result.rows.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		const payload = nameOnly
			? result.rows.map((row) => ({ id: row.id, name: row.name }))
			: result.rows.map((row) => ({
				id: row.id,
				name: row.name,
				description: row.description,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				deletedAt: row.deleted_at
			}));

		return successResponse(res, 200, "Book types retrieved successfully.", { bookTypes: payload });
	} catch (error) {
		logToFile("BOOK_TYPE_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving book types."]);
	}
});

// POST /booktype/get - Fetch a specific book type
router.post("/get", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id ?? req.query?.id);
	const targetName = normalizeText(req.body?.name ?? req.query?.name);
	const nameOnly = parseBooleanFlag(req.body?.nameOnly ?? req.query?.nameOnly);
	const returnStats = parseBooleanFlag(req.body?.returnStats ?? req.query?.returnStats);
	const includeDeleted = parseBooleanFlag(req.body?.includeDeleted ?? req.query?.includeDeleted);

	if (targetName) {
		const nameErrors = validateBookTypeName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
	}

	try {
		const resolved = await resolveBookTypeId({ userId, id: targetId, name: targetName, includeDeleted });
		if (resolved.mismatch) {
			return errorResponse(res, 400, "Validation Error", ["Book type id and name must refer to the same record."]);
		}
		if (!Number.isInteger(resolved.id)) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		const result = await pool.query(
			`SELECT id, name, description, created_at, updated_at, deleted_at
			 FROM book_types
			 WHERE user_id = $1 AND id = $2${includeDeleted ? "" : " AND deleted_at IS NULL"}`,
			[userId, resolved.id]
		);
		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		const row = result.rows[0];
		const payload = nameOnly
			? { id: row.id, name: row.name }
			: {
				id: row.id,
				name: row.name,
				description: row.description,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				deletedAt: row.deleted_at
			};

		if (returnStats) {
			payload.stats = await fetchBookTypeStats(userId, row.id);
		}

		return successResponse(res, 200, "Book type retrieved successfully.", payload);
	} catch (error) {
		logToFile("BOOK_TYPE_GET", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the book type."]);
	}
});

// GET/POST /booktype/stats - Book type statistics
const bookTypeStatsHandler = async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => normalizeText(field)).filter(Boolean)
		: [];

	const availableFields = new Set([
		"bookTypeBreakdown",
		"mostCollectedType",
		"leastCollectedType",
		"avgPageCountByType",
		"booksMissingType",
		"breakdownPerBookType"
	]);
	const selected = fields.length > 0 ? fields : Array.from(availableFields);
	const invalid = selected.filter((field) => !availableFields.has(field));
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}

	const needsTypeCounts = selected.some((field) => ["bookTypeBreakdown", "mostCollectedType", "leastCollectedType", "avgPageCountByType"].includes(field));
	const needsMissing = selected.includes("booksMissingType");

	try {
		const cacheKey = buildCacheKey({
			scope: "user",
			userId,
			endpoint: "booktype/stats",
			params: { fields: [...selected].sort() }
		});
		const cached = getCacheEntry(cacheKey);
		if (cached) {
			return successResponse(res, 200, "Book type stats retrieved successfully.", {
				...cached.data,
				cache: { hit: true, ageSeconds: cached.ageSeconds }
			});
		}

		const payload = {};

		const totalBooksResult = await pool.query(
			`SELECT COUNT(*)::int AS count FROM books WHERE user_id = $1 AND deleted_at IS NULL`,
			[userId]
		);
		const totalBooks = totalBooksResult.rows[0]?.count ?? 0;

		let typeCounts = [];
		if (needsTypeCounts) {
			const result = await pool.query(
				`SELECT bt.id, bt.name,
				        COUNT(b.id)::int AS book_count,
				        AVG(b.page_count) AS avg_page_count
				 FROM book_types bt
				 LEFT JOIN books b
				   ON b.book_type_id = bt.id
				  AND b.user_id = bt.user_id
				  AND b.deleted_at IS NULL
				 WHERE bt.user_id = $1 AND bt.deleted_at IS NULL
				 GROUP BY bt.id, bt.name
				 ORDER BY bt.name ASC`,
				[userId]
			);
			typeCounts = result.rows.map((row) => ({
				id: row.id,
				name: row.name,
				bookCount: row.book_count,
				avgPageCount: row.avg_page_count === null ? null : Number.parseFloat(row.avg_page_count)
			}));
		}

		if (selected.includes("bookTypeBreakdown") || selected.includes("breakdownPerBookType")) {
			const breakdown = typeCounts.map((row) => ({
				id: row.id,
				name: row.name,
				bookCount: row.bookCount,
				percentage: totalBooks > 0 ? Number(((row.bookCount / totalBooks) * 100).toFixed(1)) : 0,
				avgPageCount: row.avgPageCount
			}));
			if (selected.includes("breakdownPerBookType")) {
				payload.breakdownPerBookType = breakdown;
			}
			if (selected.includes("bookTypeBreakdown")) {
				payload.bookTypeBreakdown = breakdown.map((row) => ({
					id: row.id,
					name: row.name,
					bookCount: row.bookCount,
					percentage: row.percentage
				}));
			}
		}

		if (selected.includes("mostCollectedType")) {
			const most = typeCounts.reduce((acc, row) => (row.bookCount > (acc?.bookCount ?? 0) ? row : acc), null);
			payload.mostCollectedType = most && most.bookCount > 0 ? {
				id: most.id,
				name: most.name,
				bookCount: most.bookCount,
				percentage: totalBooks > 0 ? Number(((most.bookCount / totalBooks) * 100).toFixed(1)) : 0
			} : null;
		}

		if (selected.includes("leastCollectedType")) {
			const nonZero = typeCounts.filter((row) => row.bookCount > 0);
			const least = nonZero.reduce((acc, row) => (acc === null || row.bookCount < acc.bookCount ? row : acc), null);
			payload.leastCollectedType = least ? {
				id: least.id,
				name: least.name,
				bookCount: least.bookCount,
				percentage: totalBooks > 0 ? Number(((least.bookCount / totalBooks) * 100).toFixed(1)) : 0
			} : null;
		}

		if (selected.includes("avgPageCountByType")) {
			payload.avgPageCountByType = typeCounts.map((row) => ({
				id: row.id,
				name: row.name,
				avgPageCount: row.avgPageCount
			}));
		}

		if (needsMissing) {
			const missingResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM books b
				 LEFT JOIN book_types bt ON bt.id = b.book_type_id AND bt.user_id = b.user_id
				 WHERE b.user_id = $1
				   AND b.deleted_at IS NULL
				   AND (b.book_type_id IS NULL OR bt.deleted_at IS NOT NULL)`,
				[userId]
			);
			payload.booksMissingType = missingResult.rows[0]?.count ?? 0;
		}

		const responseData = {
			stats: payload,
			cache: { hit: false, ageSeconds: 0 }
		};
		setCacheEntry(cacheKey, responseData, DEFAULT_USER_TTL_SECONDS);
		return successResponse(res, 200, "Book type stats retrieved successfully.", responseData);
	} catch (error) {
		logToFile("BOOK_TYPE_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve book type stats at this time."]);
	}
};

router.get("/stats", requiresAuth, statsLimiter, bookTypeStatsHandler);
router.post("/stats", requiresAuth, statsLimiter, bookTypeStatsHandler);

// GET /booktype/by-name?name=Hardcover - Fetch a specific book type by name
router.get("/by-name", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const rawName = normalizeText(req.query.name ?? req.body?.name);
	const targetId = parseId(req.query.id ?? req.body?.id);
	const returnStats = parseBooleanFlag(req.query.returnStats ?? req.body?.returnStats);
	const includeDeleted = parseBooleanFlag(req.query.includeDeleted ?? req.body?.includeDeleted);

	const errors = validateBookTypeName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (Number.isInteger(targetId)) {
			const resolved = await resolveBookTypeId({ userId, id: targetId, name: rawName, includeDeleted });
			if (resolved.mismatch) {
				return errorResponse(res, 400, "Validation Error", ["Book type id and name must refer to the same record."]);
			}
		}

		const result = await pool.query(
			`SELECT id, name, description, created_at, updated_at, deleted_at
			 FROM book_types
			 WHERE user_id = $1 AND name = $2${includeDeleted ? "" : " AND deleted_at IS NULL"}`,
			[userId, rawName]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		const row = result.rows[0];
		const payload = {
			id: row.id,
			name: row.name,
			description: row.description,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			deletedAt: row.deleted_at
		};
		if (returnStats) {
			payload.stats = await fetchBookTypeStats(userId, row.id);
		}
		return successResponse(res, 200, "Book type retrieved successfully.", payload);
	} catch (error) {
		logToFile("BOOK_TYPE_GET", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the book type."]);
	}
});

// GET /booktype/trash - List deleted book types
router.get("/trash", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	try {
		const result = await pool.query(
			`SELECT id, name, description, created_at, updated_at, deleted_at
			 FROM book_types
			 WHERE user_id = $1 AND deleted_at IS NOT NULL
			 ORDER BY deleted_at DESC`,
			[userId]
		);

		const payload = result.rows.map((row) => ({
			id: row.id,
			name: row.name,
			description: row.description,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			deletedAt: row.deleted_at
		}));

		return successResponse(res, 200, "Deleted book types retrieved successfully.", { bookTypes: payload });
	} catch (error) {
		logToFile("BOOK_TYPE_TRASH", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving deleted book types."]);
	}
});

// GET /booktype/:id - Fetch a specific book type by ID
router.get("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = Number.parseInt(req.params.id, 10);
	const returnStats = parseBooleanFlag(req.query.returnStats ?? req.body?.returnStats);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book type id must be a valid integer."]);
	}

	try {
		const includeDeleted = parseBooleanFlag(req.query?.includeDeleted);
		const result = await pool.query(
			`SELECT id, name, description, created_at, updated_at, deleted_at
			 FROM book_types
			 WHERE user_id = $1 AND id = $2${includeDeleted ? "" : " AND deleted_at IS NULL"}`,
			[userId, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		const row = result.rows[0];
		const payload = {
			id: row.id,
			name: row.name,
			description: row.description,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			deletedAt: row.deleted_at
		};
		if (returnStats) {
			payload.stats = await fetchBookTypeStats(userId, row.id);
		}
		return successResponse(res, 200, "Book type retrieved successfully.", payload);
	} catch (error) {
		logToFile("BOOK_TYPE_GET", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the book type."]);
	}
});

router.get("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = parseId(req.params.id);
	const returnStats = parseBooleanFlag(req.query.returnStats ?? req.body?.returnStats);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book type id must be a valid integer."]);
	}

	try {
		const includeDeleted = parseBooleanFlag(req.query?.includeDeleted);
		const result = await pool.query(
			`SELECT id, name, description, created_at, updated_at, deleted_at
			 FROM book_types
			 WHERE user_id = $1 AND id = $2${includeDeleted ? "" : " AND deleted_at IS NULL"}`,
			[userId, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		const row = result.rows[0];
		const payload = {
			id: row.id,
			name: row.name,
			description: row.description,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			deletedAt: row.deleted_at
		};
		if (returnStats) {
			payload.stats = await fetchBookTypeStats(userId, row.id);
		}
		return successResponse(res, 200, "Book type retrieved successfully.", payload);
	} catch (error) {
		logToFile("BOOK_TYPE_GET", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the book type."]);
	}
});
// POST /booktype - Create a new book type
router.post("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const rawName = normalizeText(req.body?.name);
	const rawDescription = normalizeText(req.body?.description);

	const errors = [
		...validateBookTypeName(rawName),
		...validateBookTypeDescription(rawDescription)
	];
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query(
			`SELECT id FROM book_types WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND deleted_at IS NULL`,
			[userId, rawName]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Book type already exists.", ["A book type with this name already exists."]);
		}

		const result = await pool.query(
			`INSERT INTO book_types (user_id, name, description, created_at, updated_at)
			 VALUES ($1, $2, $3, NOW(), NOW())
			 RETURNING id, name, description, created_at, updated_at, deleted_at`,
			[userId, rawName, rawDescription || null]
		);

		const row = result.rows[0];
		logToFile("BOOK_TYPE_CREATE", {
			status: "SUCCESS",
			user_id: userId,
			book_type_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 201, "Book type created successfully.", {
			id: row.id,
			name: row.name,
			description: row.description,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			deletedAt: row.deleted_at ?? null
		});
	} catch (error) {
		logToFile("BOOK_TYPE_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the book type."]);
	}
});

async function handleBookTypeUpdate(req, res, targetId) {
	const userId = req.user.id;

	const rawName = req.body?.name !== undefined ? normalizeText(req.body.name) : undefined;
	const rawDescription = req.body?.description !== undefined ? normalizeText(req.body.description) : undefined;

	const errors = [];
	if (rawName !== undefined) {
		errors.push(...validateBookTypeName(rawName));
	}
	if (rawDescription !== undefined) {
		errors.push(...validateBookTypeDescription(rawDescription));
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	if (rawName === undefined && rawDescription === undefined) {
		return errorResponse(res, 400, "No changes were provided.", ["Please provide at least one field to update."]);
	}

	try {
		if (rawName !== undefined) {
			const existing = await pool.query(
				`SELECT id FROM book_types WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3 AND deleted_at IS NULL`,
				[userId, rawName, targetId]
			);
			if (existing.rows.length > 0) {
				return errorResponse(res, 409, "Book type already exists.", ["A book type with this name already exists."]);
			}
		}

		const updateFields = [];
		const params = [userId, targetId];
		let index = 3;

		if (rawName !== undefined) {
			updateFields.push(`name = $${index++}`);
			params.push(rawName);
		}
		if (rawDescription !== undefined) {
			updateFields.push(`description = $${index++}`);
			params.push(rawDescription || null);
		}

		const query = `
			UPDATE book_types
			SET ${updateFields.join(", ")}, updated_at = NOW()
			WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
			RETURNING id, name, description, created_at, updated_at, deleted_at;
		`;

		const result = await pool.query(query, params);
		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		const row = result.rows[0];
		logToFile("BOOK_TYPE_UPDATE", {
			status: "SUCCESS",
			user_id: userId,
			book_type_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Book type updated successfully.", {
			id: row.id,
			name: row.name,
			description: row.description,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			deletedAt: row.deleted_at
		});
	} catch (error) {
		logToFile("BOOK_TYPE_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the book type."]);
	}
}

// PUT /booktype/:id - Update a book type by id
router.put("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book type id must be a valid integer."]);
	}
	return handleBookTypeUpdate(req, res, id);
});

// PUT /booktype - Update a book type by id or name
router.put("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetName = normalizeText(req.body?.targetName ?? req.body?.name);

	if (!Number.isInteger(targetId) && !targetName) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a book type id or name to update."]);
	}
	if (targetName) {
		const nameErrors = validateBookTypeName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
	}

	const resolved = await resolveBookTypeId({ userId, id: targetId, name: targetName });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Book type id and name must refer to the same record."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
	}
	return handleBookTypeUpdate(req, res, resolved.id);
});

async function handleBookTypeDelete(req, res, targetId) {
	const userId = req.user.id;
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const target = await client.query(
			`SELECT id, name FROM book_types WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
			[userId, targetId]
		);
		if (target.rowCount === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}
		const name = target.rows[0].name;
		const cleanup = await client.query(
			`DELETE FROM book_types
			 WHERE user_id = $1
			   AND deleted_at IS NOT NULL
			   AND LOWER(name) = LOWER($2)
			   AND id <> $3
			 RETURNING id`,
			[userId, name, targetId]
		);
		const result = await client.query(
			`UPDATE book_types
			 SET deleted_at = NOW()
			 WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
			 RETURNING id, deleted_at`,
			[userId, targetId]
		);
		await client.query("COMMIT");

		logToFile("BOOK_TYPE_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			book_type_id: targetId,
			cleanup_count: cleanup.rowCount,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Book type moved to trash.", {
			id: result.rows[0].id,
			deletedAt: result.rows[0].deleted_at,
			removedDeletedDuplicates: cleanup.rowCount
		});
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("BOOK_TYPE_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the book type."]);
	} finally {
		client.release();
	}
}

// DELETE /booktype/:id - Remove a book type by id
router.delete("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book type id must be a valid integer."]);
	}
	return handleBookTypeDelete(req, res, id);
});

// DELETE /booktype - Remove a book type by id or name
router.delete("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetName = normalizeText(req.body?.name);

	if (!Number.isInteger(targetId) && !targetName) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a book type id or name to delete."]);
	}
	if (targetName) {
		const nameErrors = validateBookTypeName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
	}

	const resolved = await resolveBookTypeId({ userId, id: targetId, name: targetName });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Book type id and name must refer to the same record."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
	}
	return handleBookTypeDelete(req, res, resolved.id);
});

// POST /booktype/restore - Restore deleted book types (single or bulk)
router.post("/restore", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const mode = parseConflictMode(params.mode);
	if (!mode) {
		return errorResponse(res, 400, "Validation Error", ["mode must be one of: decline, merge, override."]);
	}

	const idsPayload = params.ids ?? params.id;
	let { ids } = parseIdsInput(idsPayload);
	const targetName = normalizeText(params.name);

	if (!ids.length && targetName) {
		const nameErrors = validateBookTypeName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
		const match = await pool.query(
			`SELECT id FROM book_types WHERE user_id = $1 AND name = $2 AND deleted_at IS NOT NULL`,
			[userId, targetName]
		);
		ids = match.rows.map((row) => row.id);
	}

	if (!ids.length) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a book type id, ids array, or name to restore."]);
	}

	const results = [];
	let restoredCount = 0;
	let failedCount = 0;

	for (const bookTypeId of ids) {
		if (!Number.isInteger(bookTypeId)) {
			results.push({ id: bookTypeId, status: "failed", reason: "Book type id must be a valid integer." });
			failedCount += 1;
			continue;
		}
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const deletedRes = await client.query(
				`SELECT id, name, description
				 FROM book_types
				 WHERE user_id = $1 AND id = $2 AND deleted_at IS NOT NULL`,
				[userId, bookTypeId]
			);
			if (deletedRes.rowCount === 0) {
				await client.query("ROLLBACK");
				results.push({ id: bookTypeId, status: "failed", reason: "Book type not found or not deleted." });
				failedCount += 1;
				continue;
			}
			const deleted = deletedRes.rows[0];
			const conflictRes = await client.query(
				`SELECT id, name, description
				 FROM book_types
				 WHERE user_id = $1 AND deleted_at IS NULL AND LOWER(name) = LOWER($2) AND id <> $3`,
				[userId, deleted.name, deleted.id]
			);
			const conflict = conflictRes.rows[0];

			if (conflict && mode === "decline") {
				await client.query("ROLLBACK");
				results.push({
					id: deleted.id,
					status: "failed",
					reason: `Could not restore '${deleted.name}' because another book type with that name already exists in your library.`
				});
				failedCount += 1;
				continue;
			}

			if (conflict && mode === "merge") {
				await client.query(
					`UPDATE book_types SET
						description = CASE WHEN (description IS NULL OR description = '') AND $2 IS NOT NULL AND $2 <> '' THEN $2 ELSE description END
					 WHERE id = $1`,
					[conflict.id, deleted.description]
				);
				await client.query(
					`UPDATE books SET book_type_id = $1 WHERE user_id = $2 AND book_type_id = $3`,
					[conflict.id, userId, deleted.id]
				);
				await client.query(
					`DELETE FROM book_types WHERE user_id = $1 AND id = $2`,
					[userId, deleted.id]
				);
				await client.query("COMMIT");
				results.push({ id: deleted.id, status: "restored", effectiveId: conflict.id });
				restoredCount += 1;
				continue;
			}

			if (conflict && mode === "override") {
				await client.query(
					`UPDATE book_types SET deleted_at = NOW() WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
					[userId, conflict.id]
				);
				await client.query(
					`UPDATE books SET book_type_id = $1 WHERE user_id = $2 AND book_type_id = $3`,
					[deleted.id, userId, conflict.id]
				);
				await client.query(
					`UPDATE book_types SET deleted_at = NULL WHERE user_id = $1 AND id = $2`,
					[userId, deleted.id]
				);
				await client.query("COMMIT");
				results.push({ id: deleted.id, status: "restored" });
				restoredCount += 1;
				continue;
			}

			await client.query(
				`UPDATE book_types SET deleted_at = NULL WHERE user_id = $1 AND id = $2`,
				[userId, deleted.id]
			);
			await client.query("COMMIT");
			results.push({ id: deleted.id, status: "restored" });
			restoredCount += 1;
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("BOOK_TYPE_RESTORE", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				book_type_id: bookTypeId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			results.push({ id: bookTypeId, status: "failed", reason: "An error occurred while restoring this book type." });
			failedCount += 1;
		} finally {
			client.release();
		}
	}

	const message = restoredCount > 0 && failedCount > 0
		? "Some items were restored successfully."
		: restoredCount > 0
			? "Book types restored successfully."
			: "No book types were restored.";

	return successResponse(res, 200, message, {
		results,
		restoredCount,
		failedCount
	});
});

// POST /booktype/delete-permanent - Permanently delete deleted book types (single or bulk)
router.post("/delete-permanent", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const idsPayload = params.ids ?? params.id;
	const { ids } = parseIdsInput(idsPayload);

	if (!ids.length) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a book type id or ids array to permanently delete."]);
	}

	const results = [];
	let deletedCount = 0;
	let failedCount = 0;

	for (const bookTypeId of ids) {
		if (!Number.isInteger(bookTypeId)) {
			results.push({ id: bookTypeId, status: "failed", reason: "Book type id must be a valid integer." });
			failedCount += 1;
			continue;
		}
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const match = await client.query(
				`SELECT id FROM book_types WHERE user_id = $1 AND id = $2 AND deleted_at IS NOT NULL`,
				[userId, bookTypeId]
			);
			if (match.rowCount === 0) {
				await client.query("ROLLBACK");
				results.push({ id: bookTypeId, status: "failed", reason: "Book type not found or not deleted." });
				failedCount += 1;
				continue;
			}
			await client.query(
				`UPDATE books SET book_type_id = NULL WHERE user_id = $1 AND book_type_id = $2`,
				[userId, bookTypeId]
			);
			await client.query(
				`DELETE FROM book_types WHERE user_id = $1 AND id = $2`,
				[userId, bookTypeId]
			);
			await client.query("COMMIT");
			results.push({ id: bookTypeId, status: "deleted" });
			deletedCount += 1;
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("BOOK_TYPE_DELETE_PERMANENT", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				book_type_id: bookTypeId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			results.push({ id: bookTypeId, status: "failed", reason: "An error occurred while deleting this book type." });
			failedCount += 1;
		} finally {
			client.release();
		}
	}

	const message = deletedCount > 0 && failedCount > 0
		? "Some items were deleted successfully."
		: deletedCount > 0
			? "Book types deleted permanently."
			: "No book types were deleted.";

	return successResponse(res, 200, message, {
		results,
		deletedCount,
		failedCount
	});
});

module.exports = router;
