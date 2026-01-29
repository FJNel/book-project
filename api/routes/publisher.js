const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { validatePartialDateObject } = require("../utils/partial-date");
const { resolveLibraryReadUserId, enforceLibraryWriteScope } = require("../utils/library-permissions");
const {
	DEFAULT_USER_TTL_SECONDS,
	buildCacheKey,
	getCacheEntry,
	setCacheEntry
} = require("../utils/stats-cache");

const MAX_PUBLISHER_NAME_LENGTH = 150;
const MAX_WEBSITE_LENGTH = 300;
const MAX_NOTES_LENGTH = 1000;
const MAX_LIST_LIMIT = 200;

router.use((req, res, next) => {
	logToFile("PUBLISHER_REQUEST", {
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
		logToFile("PUBLISHER_RESPONSE", {
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

const READ_ONLY_POST_PATHS = new Set(["/list", "/stats"]);
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

function validatePublisherName(name) {
	const errors = [];
	if (!name) {
		errors.push("Publisher Name must be provided.");
		return errors;
	}
	if (name.length < 2 || name.length > MAX_PUBLISHER_NAME_LENGTH) {
		errors.push(`Publisher Name must be between 2 and ${MAX_PUBLISHER_NAME_LENGTH} characters.`);
	}
	if (!/^[A-Za-z0-9\s\-.'’&/(),]+$/.test(name)) {
		errors.push("Publisher Name contains invalid characters.");
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

function validateNotes(value) {
	const errors = [];
	if (value === undefined || value === null || value === "") {
		return errors;
	}
	if (typeof value !== "string") {
		errors.push("Notes must be a string.");
		return errors;
	}
	if (value.trim().length > MAX_NOTES_LENGTH) {
		errors.push(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`);
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
			// Ignore JSON parse errors and fallback to comma parsing.
		}
		const ids = trimmed.split(",").map((entry) => Number.parseInt(entry.trim(), 10)).filter(Number.isInteger);
		return { ids };
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

async function fetchPublisherStats(userId, publisherId) {
	const totalBooksResult = await pool.query(
		`SELECT COUNT(*)::int AS count FROM books WHERE user_id = $1 AND deleted_at IS NULL`,
		[userId]
	);
	const totalBooks = totalBooksResult.rows[0]?.count ?? 0;
	const result = await pool.query(
		`SELECT COUNT(b.id)::int AS book_count
		 FROM books b
		 WHERE b.user_id = $1 AND b.publisher_id = $2 AND b.deleted_at IS NULL`,
		[userId, publisherId]
	);
	const bookCount = result.rows[0]?.book_count ?? 0;
	return {
		bookCount,
		percentageOfBooks: totalBooks > 0 ? Number(((bookCount / totalBooks) * 100).toFixed(1)) : 0
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

async function resolvePublisherId({ userId, id, name, includeDeleted = false }) {
	const hasId = Number.isInteger(id);
	const hasName = Boolean(name);
	const deletedClause = includeDeleted ? "" : " AND deleted_at IS NULL";

	if (hasId && hasName) {
		const result = await pool.query(
			`SELECT id, name FROM publishers WHERE user_id = $1 AND id = $2${deletedClause}`,
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
			`SELECT id FROM publishers WHERE user_id = $1 AND name = $2${deletedClause}`,
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

// GET /publisher - List or fetch a specific publisher
async function listPublishersHandler(req, res) {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly) ?? false;
	const includeDeleted = parseBooleanFlag(listParams.includeDeleted) ?? false;
	const returnStats = parseBooleanFlag(listParams.returnStats);
	const targetId = parseId(req.query.id ?? req.body?.id);
	const targetName = normalizeText(req.query.name ?? req.body?.name);

	if (targetId !== null || targetName) {
		if (targetName) {
			const nameErrors = validatePublisherName(targetName);
			if (nameErrors.length > 0) {
				return errorResponse(res, 400, "Validation Error", nameErrors);
			}
		}

		try {
			const resolved = await resolvePublisherId({ userId, id: targetId, name: targetName, includeDeleted });
			if (resolved.mismatch) {
				return errorResponse(res, 400, "Validation Error", ["Publisher id and name must refer to the same record."]);
			}
			if (!Number.isInteger(resolved.id)) {
				return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
			}

			const result = await pool.query(
				`SELECT p.id, p.name, p.website, p.notes, p.created_at, p.updated_at, p.deleted_at,
				        fd.id AS founded_date_id, fd.day AS founded_day, fd.month AS founded_month, fd.year AS founded_year, fd.text AS founded_text
				 FROM publishers p
				 LEFT JOIN dates fd ON p.founded_date_id = fd.id
				 WHERE p.user_id = $1 AND p.id = $2${includeDeleted ? "" : " AND p.deleted_at IS NULL"}`,
				[userId, resolved.id]
			);

			const row = result.rows[0];
			const payload = nameOnly
				? { id: row.id, name: row.name }
				: {
					id: row.id,
					name: row.name,
					foundedDate: row.founded_date_id
						? { id: row.founded_date_id, day: row.founded_day, month: row.founded_month, year: row.founded_year, text: row.founded_text }
						: null,
					website: row.website,
					notes: row.notes,
					createdAt: row.created_at,
					updatedAt: row.updated_at,
					deletedAt: row.deleted_at
				};

			if (returnStats) {
				payload.stats = await fetchPublisherStats(userId, row.id);
			}

			return successResponse(res, 200, "Publisher retrieved successfully.", payload);
		} catch (error) {
			logToFile("PUBLISHER_GET", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the publisher."]);
		}
	}

	const fields = nameOnly
		? "p.id, p.name"
		: `p.id, p.name, p.website, p.notes, p.created_at, p.updated_at,
		   fd.id AS founded_date_id, fd.day AS founded_day, fd.month AS founded_month, fd.year AS founded_year, fd.text AS founded_text`;

	const errors = [];
	const sortFields = {
		id: "p.id",
		name: "p.name",
		website: "p.website",
		notes: "p.notes",
		createdAt: "p.created_at",
		updatedAt: "p.updated_at",
		foundedDateId: "p.founded_date_id",
		foundedDay: "fd.day",
		foundedMonth: "fd.month",
		foundedYear: "fd.year",
		foundedText: "fd.text"
	};
	const sortBy = normalizeText(listParams.sortBy) || "name";
	const sortColumn = sortFields[sortBy];
	if (!sortColumn) {
		errors.push("sortBy must be one of: id, name, website, notes, createdAt, updatedAt, foundedDateId, foundedDay, foundedMonth, foundedYear, foundedText.");
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
		filters.push("p.deleted_at IS NULL");
	}

	if (listParams.filterId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterId, "filterId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterIdMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`p.id = ANY($${paramIndex++}::int[])`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`p.id = $${paramIndex++}`);
					values.push(id);
				});
			}
		}
	}

	const filterName = normalizeText(listParams.filterName);
	if (filterName) {
		if (filterName.length > MAX_PUBLISHER_NAME_LENGTH) {
			errors.push(`filterName must be ${MAX_PUBLISHER_NAME_LENGTH} characters or fewer.`);
		} else {
			filters.push(`p.name ILIKE $${paramIndex++}`);
			values.push(`%${filterName}%`);
		}
	}

	const filterWebsite = normalizeText(listParams.filterWebsite);
	if (filterWebsite) {
		if (filterWebsite.length > MAX_WEBSITE_LENGTH) {
			errors.push(`filterWebsite must be ${MAX_WEBSITE_LENGTH} characters or fewer.`);
		} else {
			filters.push(`p.website ILIKE $${paramIndex++}`);
			values.push(`%${filterWebsite}%`);
		}
	}

	const filterNotes = normalizeText(listParams.filterNotes);
	if (filterNotes) {
		if (filterNotes.length > MAX_NOTES_LENGTH) {
			errors.push(`filterNotes must be ${MAX_NOTES_LENGTH} characters or fewer.`);
		} else {
			filters.push(`p.notes ILIKE $${paramIndex++}`);
			values.push(`%${filterNotes}%`);
		}
	}

	if (listParams.filterFoundedDateId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterFoundedDateId, "filterFoundedDateId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterFoundedDateMode || "or").toLowerCase() === "and" ? "and" : "or";
			if (mode === "or") {
				filters.push(`p.founded_date_id = ANY($${paramIndex++}::int[])`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`p.founded_date_id = $${paramIndex++}`);
					values.push(id);
				});
			}
		}
	}

	const foundedDay = parseOptionalIntRange(listParams.filterFoundedDay, "filterFoundedDay", { min: 1, max: 31 });
	if (foundedDay.error) errors.push(foundedDay.error);
	if (foundedDay.value !== null) {
		filters.push(`fd.day = $${paramIndex++}`);
		values.push(foundedDay.value);
	}

	const foundedMonth = parseOptionalIntRange(listParams.filterFoundedMonth, "filterFoundedMonth", { min: 1, max: 12 });
	if (foundedMonth.error) errors.push(foundedMonth.error);
	if (foundedMonth.value !== null) {
		filters.push(`fd.month = $${paramIndex++}`);
		values.push(foundedMonth.value);
	}

	const foundedYear = parseOptionalIntRange(listParams.filterFoundedYear, "filterFoundedYear", { min: 1, max: 9999 });
	if (foundedYear.error) errors.push(foundedYear.error);
	if (foundedYear.value !== null) {
		filters.push(`fd.year = $${paramIndex++}`);
		values.push(foundedYear.value);
	}

	const foundedText = normalizeText(listParams.filterFoundedText);
	if (foundedText) {
		filters.push(`fd.text ILIKE $${paramIndex++}`);
		values.push(`%${foundedText}%`);
	}

	const dateFilters = [
		{ key: "filterCreatedAt", column: "p.created_at", op: "=" },
		{ key: "filterUpdatedAt", column: "p.updated_at", op: "=" },
		{ key: "filterCreatedAfter", column: "p.created_at", op: ">=" },
		{ key: "filterCreatedBefore", column: "p.created_at", op: "<=" },
		{ key: "filterUpdatedAfter", column: "p.updated_at", op: ">=" },
		{ key: "filterUpdatedBefore", column: "p.updated_at", op: "<=" }
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

	const foundedBefore = parseDateFilter(listParams.filterFoundedBefore, "filterFoundedBefore");
	if (foundedBefore.error) errors.push(foundedBefore.error);
	if (foundedBefore.value) {
		filters.push(`make_date(fd.year, COALESCE(fd.month, 1), COALESCE(fd.day, 1)) <= $${paramIndex++}::date`);
		values.push(foundedBefore.value);
	}

	const foundedAfter = parseDateFilter(listParams.filterFoundedAfter, "filterFoundedAfter");
	if (foundedAfter.error) errors.push(foundedAfter.error);
	if (foundedAfter.value) {
		filters.push(`make_date(fd.year, COALESCE(fd.month, 1), COALESCE(fd.day, 1)) >= $${paramIndex++}::date`);
		values.push(foundedAfter.value);
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	let query = `SELECT ${fields}
			 FROM publishers p
			 LEFT JOIN dates fd ON p.founded_date_id = fd.id
			 WHERE p.user_id = $1`;
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

		logToFile("PUBLISHER_LIST", {
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
				foundedDate: row.founded_date_id
					? { id: row.founded_date_id, day: row.founded_day, month: row.founded_month, year: row.founded_year, text: row.founded_text }
					: null,
				website: row.website,
				notes: row.notes,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			};
		});

		return successResponse(res, 200, "Publishers retrieved successfully.", { publishers: payload });
	} catch (error) {
		logToFile("PUBLISHER_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving publishers."]);
	}
}

router.get("/", requiresAuth, authenticatedLimiter, listPublishersHandler);
router.post("/list", requiresAuth, authenticatedLimiter, listPublishersHandler);

// POST /publisher - Create a new publisher
router.post("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const name = normalizeText(req.body?.name);
	const website = normalizeText(req.body?.website);
	const notes = normalizeText(req.body?.notes);
	const foundedDate = req.body?.foundedDate ?? null;

	const errors = [
		...validatePublisherName(name),
		...validateWebsite(website),
		...validateNotes(notes),
		...validatePartialDateObject(foundedDate, "Founded Date")
	];

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query(
			`SELECT id FROM publishers WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND deleted_at IS NULL`,
			[userId, name]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Publisher already exists.", ["A publisher with this name already exists."]);
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const foundedDateId = await insertPartialDate(client, foundedDate);

			const result = await client.query(
				`INSERT INTO publishers (user_id, name, founded_date_id, website, notes, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
				 RETURNING id, name, founded_date_id, website, notes, created_at, updated_at`,
				[userId, name, foundedDateId, website || null, notes || null]
			);

			await client.query("COMMIT");

			const row = result.rows[0];
			logToFile("PUBLISHER_CREATE", {
				status: "SUCCESS",
				user_id: userId,
				publisher_id: row.id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 201, "Publisher created successfully.", {
				id: row.id,
				name: row.name,
				foundedDate: foundedDateId ? { ...foundedDate, id: foundedDateId } : null,
				website: row.website,
				notes: row.notes,
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
		logToFile("PUBLISHER_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the publisher."]);
	}
});

// GET /publisher/by-name?name=HarperCollins - Fetch a specific publisher by name
router.get("/by-name", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const rawName = normalizeText(req.query.name ?? req.body?.name);
	const targetId = parseId(req.query.id ?? req.body?.id);
	const returnStats = parseBooleanFlag(req.query.returnStats ?? req.body?.returnStats);

	const errors = validatePublisherName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (Number.isInteger(targetId)) {
			const resolved = await resolvePublisherId({ userId, id: targetId, name: rawName });
			if (resolved.mismatch) {
				return errorResponse(res, 400, "Validation Error", ["Publisher id and name must refer to the same record."]);
			}
		}

		const result = await pool.query(
			`SELECT p.id, p.name, p.website, p.notes, p.created_at, p.updated_at,
			        fd.id AS founded_date_id, fd.day AS founded_day, fd.month AS founded_month, fd.year AS founded_year, fd.text AS founded_text
			 FROM publishers p
			 LEFT JOIN dates fd ON p.founded_date_id = fd.id
			 WHERE p.user_id = $1 AND p.name = $2 AND p.deleted_at IS NULL`,
			[userId, rawName]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
		}

		const row = result.rows[0];
		const payload = {
			id: row.id,
			name: row.name,
			foundedDate: row.founded_date_id
				? { id: row.founded_date_id, day: row.founded_day, month: row.founded_month, year: row.founded_year, text: row.founded_text }
				: null,
			website: row.website,
			notes: row.notes,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		};
		if (returnStats) {
			payload.stats = await fetchPublisherStats(userId, row.id);
		}
		return successResponse(res, 200, "Publisher retrieved successfully.", payload);
	} catch (error) {
		logToFile("PUBLISHER_GET", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the publisher."]);
	}
});

// GET /publisher/trash - List deleted publishers
router.get("/trash", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	try {
		const result = await pool.query(
			`SELECT id, name, website, notes, deleted_at, created_at, updated_at
			 FROM publishers
			 WHERE user_id = $1 AND deleted_at IS NOT NULL
			 ORDER BY deleted_at DESC`,
			[userId]
		);

		const payload = result.rows.map((row) => ({
			id: row.id,
			name: row.name,
			website: row.website,
			notes: row.notes,
			deletedAt: row.deleted_at,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		}));

		return successResponse(res, 200, "Deleted publishers retrieved successfully.", { publishers: payload });
	} catch (error) {
		logToFile("PUBLISHER_TRASH", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving deleted publishers."]);
	}
});

// GET/POST /publisher/stats - Publisher statistics
const publisherStatsHandler = async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => normalizeText(field)).filter(Boolean)
		: [];
	const { value: oneOffLimit, error: oneOffLimitError } = parseOptionalInt(params.oneOffLimit, "oneOffLimit", { min: 1, max: MAX_LIST_LIMIT });
	const { value: oneOffOffset, error: oneOffOffsetError } = parseOptionalInt(params.oneOffOffset, "oneOffOffset", { min: 0 });
	const { value: orphanLimit, error: orphanLimitError } = parseOptionalInt(params.orphanLimit, "orphanLimit", { min: 1, max: MAX_LIST_LIMIT });
	const { value: orphanOffset, error: orphanOffsetError } = parseOptionalInt(params.orphanOffset, "orphanOffset", { min: 0 });

	const fieldMap = {
		total: "COUNT(*) FILTER (WHERE p.deleted_at IS NULL) AS total",
		totalPublishers: "COUNT(*) FILTER (WHERE p.deleted_at IS NULL) AS total_publishers",
		deleted: "COUNT(*) FILTER (WHERE p.deleted_at IS NOT NULL) AS deleted",
		withFoundedDate: "COUNT(*) FILTER (WHERE p.deleted_at IS NULL AND p.founded_date_id IS NOT NULL) AS with_founded_date",
		withWebsite: "COUNT(*) FILTER (WHERE p.deleted_at IS NULL AND p.website IS NOT NULL AND p.website <> '') AS with_website",
		withNotes: "COUNT(*) FILTER (WHERE p.deleted_at IS NULL AND p.notes IS NOT NULL AND p.notes <> '') AS with_notes",
		earliestFoundedYear: "MIN(fd.year) FILTER (WHERE p.deleted_at IS NULL) AS earliest_founded_year",
		latestFoundedYear: "MAX(fd.year) FILTER (WHERE p.deleted_at IS NULL) AS latest_founded_year"
	};

	const derivedFields = [
		"mostCommonPublisher",
		"publishersWithOneBook",
		"publishersWithNoBooks",
		"oldestFoundedPublisher",
		"websiteCoverage",
		"breakdownPerPublisher"
	];
	const availableFields = new Set([...Object.keys(fieldMap), ...derivedFields]);
	const selected = fields.length > 0 ? fields : Array.from(availableFields);
	const invalid = selected.filter((field) => !availableFields.has(field));
	const limitErrors = [oneOffLimitError, oneOffOffsetError, orphanLimitError, orphanOffsetError].filter(Boolean);
	if (limitErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", limitErrors);
	}
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}

	try {
		const cacheKey = buildCacheKey({
			scope: "user",
			userId,
			endpoint: "publisher/stats",
			params: {
				fields: [...selected].sort(),
				oneOffLimit: oneOffLimit ?? null,
				oneOffOffset: oneOffOffset ?? null,
				orphanLimit: orphanLimit ?? null,
				orphanOffset: orphanOffset ?? null
			}
		});
		const cached = getCacheEntry(cacheKey);
		if (cached) {
			return successResponse(res, 200, "Publisher stats retrieved successfully.", {
				...cached.data,
				cache: { hit: true, ageSeconds: cached.ageSeconds }
			});
		}

		const payload = {};
		const scalarFields = selected.filter((field) => fieldMap[field]);
		let scalarRow = {};
		if (scalarFields.length > 0) {
			const query = `SELECT ${scalarFields.map((field) => fieldMap[field]).join(", ")}
				FROM publishers p
				LEFT JOIN dates fd ON p.founded_date_id = fd.id
				WHERE p.user_id = $1`;
			const result = await pool.query(query, [userId]);
			scalarRow = result.rows[0] || {};
			scalarFields.forEach((field) => {
				const key = field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
				payload[field] = scalarRow[key] ?? null;
			});
		}

		if (selected.includes("websiteCoverage")) {
			let totalPublishers = scalarRow.total_publishers ?? scalarRow.total ?? null;
			let withWebsite = scalarRow.with_website ?? null;
			if (totalPublishers === null || withWebsite === null) {
				const coverageResult = await pool.query(
					`SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total,
					        COUNT(*) FILTER (WHERE deleted_at IS NULL AND website IS NOT NULL AND website <> '')::int AS with_website
					 FROM publishers
					 WHERE user_id = $1`,
					[userId]
				);
				totalPublishers = coverageResult.rows[0]?.total ?? 0;
				withWebsite = coverageResult.rows[0]?.with_website ?? 0;
			}
			payload.websiteCoverage = {
				withWebsite,
				totalPublishers,
				percentage: totalPublishers > 0 ? Number(((withWebsite / totalPublishers) * 100).toFixed(1)) : 0
			};
		}

		if (selected.includes("mostCommonPublisher")) {
			const topResult = await pool.query(
				`SELECT p.id, p.name, COUNT(b.id)::int AS book_count
				 FROM publishers p
				 JOIN books b ON b.publisher_id = p.id AND b.user_id = p.user_id AND b.deleted_at IS NULL
				 WHERE p.user_id = $1 AND p.deleted_at IS NULL
				 GROUP BY p.id, p.name
				 ORDER BY book_count DESC, p.name ASC
				 LIMIT 1`,
				[userId]
			);
			const row = topResult.rows[0];
			const totalBooksResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL`,
				[userId]
			);
			const totalBooks = totalBooksResult.rows[0]?.count ?? 0;
			payload.mostCommonPublisher = row
				? {
					id: row.id,
					name: row.name,
					bookCount: row.book_count,
					percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
				}
				: null;
		}

		if (selected.includes("publishersWithOneBook")) {
			const limitValue = oneOffLimit ?? 50;
			const offsetValue = oneOffOffset ?? 0;
			const totalBooksResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL`,
				[userId]
			);
			const totalBooks = totalBooksResult.rows[0]?.count ?? 0;
			const oneOffResult = await pool.query(
				`SELECT p.id, p.name, COUNT(b.id)::int AS book_count
				 FROM publishers p
				 LEFT JOIN books b ON b.publisher_id = p.id AND b.user_id = p.user_id AND b.deleted_at IS NULL
				 WHERE p.user_id = $1 AND p.deleted_at IS NULL
				 GROUP BY p.id, p.name
				 HAVING COUNT(b.id) = 1
				 ORDER BY p.name ASC
				 LIMIT $2 OFFSET $3`,
				[userId, limitValue, offsetValue]
			);
			payload.publishersWithOneBook = oneOffResult.rows.map((row) => ({
				id: row.id,
				name: row.name,
				bookCount: row.book_count,
				percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
			}));
		}

		if (selected.includes("publishersWithNoBooks")) {
			const limitValue = orphanLimit ?? 50;
			const offsetValue = orphanOffset ?? 0;
			const orphanResult = await pool.query(
				`SELECT p.id, p.name, COUNT(b.id)::int AS book_count
				 FROM publishers p
				 LEFT JOIN books b ON b.publisher_id = p.id AND b.user_id = p.user_id AND b.deleted_at IS NULL
				 WHERE p.user_id = $1 AND p.deleted_at IS NULL
				 GROUP BY p.id, p.name
				 HAVING COUNT(b.id) = 0
				 ORDER BY p.name ASC
				 LIMIT $2 OFFSET $3`,
				[userId, limitValue, offsetValue]
			);
			payload.publishersWithNoBooks = orphanResult.rows.map((row) => ({
				id: row.id,
				name: row.name,
				bookCount: row.book_count
			}));
		}

		if (selected.includes("oldestFoundedPublisher")) {
			const oldestResult = await pool.query(
				`SELECT p.id, p.name, fd.year AS founded_year
				 FROM publishers p
				 JOIN dates fd ON p.founded_date_id = fd.id
				 WHERE p.user_id = $1 AND p.deleted_at IS NULL AND fd.year IS NOT NULL
				 ORDER BY fd.year ASC, p.name ASC
				 LIMIT 1`,
				[userId]
			);
			const row = oldestResult.rows[0];
			payload.oldestFoundedPublisher = row
				? { id: row.id, name: row.name, foundedYear: row.founded_year }
				: null;
		}

		if (selected.includes("breakdownPerPublisher")) {
			const totalBooksResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL`,
				[userId]
			);
			const totalBooks = totalBooksResult.rows[0]?.count ?? 0;
			const breakdownResult = await pool.query(
				`SELECT p.id, p.name,
				        COUNT(b.id)::int AS book_count
				 FROM publishers p
				 LEFT JOIN books b ON b.publisher_id = p.id AND b.user_id = p.user_id AND b.deleted_at IS NULL
				 WHERE p.user_id = $1 AND p.deleted_at IS NULL
				 GROUP BY p.id, p.name
				 ORDER BY p.name ASC`,
				[userId]
			);
			payload.breakdownPerPublisher = breakdownResult.rows.map((row) => ({
				id: row.id,
				name: row.name,
				bookCount: row.book_count,
				percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
			}));
		}

		const responseData = {
			stats: payload,
			cache: { hit: false, ageSeconds: 0 }
		};
		setCacheEntry(cacheKey, responseData, DEFAULT_USER_TTL_SECONDS);
		return successResponse(res, 200, "Publisher stats retrieved successfully.", responseData);
	} catch (error) {
		logToFile("PUBLISHER_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve publisher stats at this time."]);
	}
};

router.get("/stats", requiresAuth, statsLimiter, publisherStatsHandler);
router.post("/stats", requiresAuth, statsLimiter, publisherStatsHandler);

// GET /publisher/:id - Fetch a specific publisher by ID
router.get("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = parseId(req.params.id);
	const returnStats = parseBooleanFlag(req.query.returnStats ?? req.body?.returnStats);
	const includeDeleted = parseBooleanFlag(req.query.includeDeleted ?? req.body?.includeDeleted) ?? false;
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Publisher id must be a valid integer."]);
	}

	try {
		const result = await pool.query(
			`SELECT p.id, p.name, p.website, p.notes, p.created_at, p.updated_at, p.deleted_at,
			        fd.id AS founded_date_id, fd.day AS founded_day, fd.month AS founded_month, fd.year AS founded_year, fd.text AS founded_text
			 FROM publishers p
			 LEFT JOIN dates fd ON p.founded_date_id = fd.id
			 WHERE p.user_id = $1 AND p.id = $2${includeDeleted ? "" : " AND p.deleted_at IS NULL"}`,
			[userId, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
		}

		const row = result.rows[0];
		const payload = {
			id: row.id,
			name: row.name,
			foundedDate: row.founded_date_id
				? { id: row.founded_date_id, day: row.founded_day, month: row.founded_month, year: row.founded_year, text: row.founded_text }
				: null,
			website: row.website,
			notes: row.notes,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			deletedAt: row.deleted_at
		};
		if (returnStats) {
			payload.stats = await fetchPublisherStats(userId, row.id);
		}
		return successResponse(res, 200, "Publisher retrieved successfully.", payload);
	} catch (error) {
		logToFile("PUBLISHER_GET", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the publisher."]);
	}
});

async function handlePublisherUpdate(req, res, publisherId) {
	const userId = req.user.id;
	const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
	const hasFoundedDate = Object.prototype.hasOwnProperty.call(req.body || {}, "foundedDate");
	const hasWebsite = Object.prototype.hasOwnProperty.call(req.body || {}, "website");
	const hasNotes = Object.prototype.hasOwnProperty.call(req.body || {}, "notes");

	const name = hasName ? normalizeText(req.body?.name) : undefined;
	const foundedDate = hasFoundedDate ? req.body?.foundedDate : undefined;
	const website = hasWebsite ? normalizeText(req.body?.website) : undefined;
	const notes = hasNotes ? normalizeText(req.body?.notes) : undefined;

	const errors = [
		...(hasName ? validatePublisherName(name) : []),
		...(hasWebsite ? validateWebsite(website) : []),
		...(hasNotes ? validateNotes(notes) : []),
		...(hasFoundedDate ? validatePartialDateObject(foundedDate, "Founded Date") : [])
	];

	if (!hasName && !hasFoundedDate && !hasWebsite && !hasNotes) {
		return errorResponse(res, 400, "No changes were provided.", ["Please provide at least one field to update."]);
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (hasName) {
			const existing = await pool.query(
				`SELECT id FROM publishers WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3 AND deleted_at IS NULL`,
				[userId, name, publisherId]
			);
			if (existing.rows.length > 0) {
				return errorResponse(res, 409, "Publisher already exists.", ["A publisher with this name already exists."]);
			}
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const updateFields = [];
			const params = [userId, publisherId];
			let index = 3;

			let foundedDateId;

			if (hasName) {
				updateFields.push(`name = $${index++}`);
				params.push(name);
			}
			if (hasFoundedDate) {
				foundedDateId = await insertPartialDate(client, foundedDate);
				updateFields.push(`founded_date_id = $${index++}`);
				params.push(foundedDateId);
			}
			if (hasWebsite) {
				updateFields.push(`website = $${index++}`);
				params.push(website || null);
			}
			if (hasNotes) {
				updateFields.push(`notes = $${index++}`);
				params.push(notes || null);
			}

			const result = await client.query(
				`UPDATE publishers
				 SET ${updateFields.join(", ")}, updated_at = NOW()
				 WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
				 RETURNING id, name, founded_date_id, website, notes, created_at, updated_at`,
				params
			);

			if (result.rows.length === 0) {
				await client.query("ROLLBACK");
				return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
			}

			await client.query("COMMIT");

			const row = result.rows[0];
			logToFile("PUBLISHER_UPDATE", {
				status: "SUCCESS",
				user_id: userId,
				publisher_id: row.id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, "Publisher updated successfully.", {
				id: row.id,
				name: row.name,
				foundedDate: hasFoundedDate && foundedDateId ? { ...foundedDate, id: foundedDateId } : null,
				website: row.website,
				notes: row.notes,
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
		logToFile("PUBLISHER_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the publisher."]);
	}
}

// PUT /publisher/:id - Update a publisher by id
router.put("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Publisher id must be a valid integer."]);
	}
	return handlePublisherUpdate(req, res, id);
});

// PUT /publisher - Update a publisher by id or name
router.put("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetName = normalizeText(req.body?.targetName ?? req.body?.name);

	if (!Number.isInteger(targetId) && !targetName) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a publisher id or name to update."]);
	}
	if (targetName) {
		const nameErrors = validatePublisherName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
	}

	const resolved = await resolvePublisherId({ userId, id: targetId, name: targetName });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Publisher id and name must refer to the same record."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
	}
	return handlePublisherUpdate(req, res, resolved.id);
});

async function handlePublisherDelete(req, res, publisherId) {
	const userId = req.user.id;
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const target = await client.query(
			`SELECT id, name FROM publishers WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
			[userId, publisherId]
		);
		if (target.rowCount === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
		}
		const name = target.rows[0].name;
		const cleanup = await client.query(
			`DELETE FROM publishers
			 WHERE user_id = $1
			   AND deleted_at IS NOT NULL
			   AND LOWER(name) = LOWER($2)
			   AND id <> $3
			 RETURNING id`,
			[userId, name, publisherId]
		);
		const result = await client.query(
			`UPDATE publishers
			 SET deleted_at = NOW()
			 WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
			 RETURNING id, deleted_at`,
			[userId, publisherId]
		);
		await client.query("COMMIT");

		logToFile("PUBLISHER_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			publisher_id: publisherId,
			cleanup_count: cleanup.rowCount,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Publisher moved to trash.", {
			id: result.rows[0].id,
			deletedAt: result.rows[0].deleted_at,
			removedDeletedDuplicates: cleanup.rowCount
		});
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("PUBLISHER_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the publisher."]);
	} finally {
		client.release();
	}
}

// DELETE /publisher/:id - Remove a publisher by id
router.delete("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Publisher id must be a valid integer."]);
	}
	return handlePublisherDelete(req, res, id);
});

// DELETE /publisher - Remove a publisher by id or name
router.delete("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetName = normalizeText(req.body?.name);

	if (!Number.isInteger(targetId) && !targetName) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a publisher id or name to delete."]);
	}
	if (targetName) {
		const nameErrors = validatePublisherName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
	}

	const resolved = await resolvePublisherId({ userId, id: targetId, name: targetName });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Publisher id and name must refer to the same record."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
	}
	return handlePublisherDelete(req, res, resolved.id);
});

// POST /publisher/restore - Restore deleted publishers (single or bulk)
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
		const nameErrors = validatePublisherName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
		const match = await pool.query(
			`SELECT id FROM publishers WHERE user_id = $1 AND name = $2 AND deleted_at IS NOT NULL`,
			[userId, targetName]
		);
		ids = match.rows.map((row) => row.id);
	}

	if (!ids.length) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a publisher id, ids array, or name to restore."]);
	}

	const results = [];
	let restoredCount = 0;
	let failedCount = 0;

	for (const publisherId of ids) {
		if (!Number.isInteger(publisherId)) {
			results.push({ id: publisherId, status: "failed", reason: "Publisher id must be a valid integer." });
			failedCount += 1;
			continue;
		}
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const deletedRes = await client.query(
				`SELECT id, name, founded_date_id, website, notes
				 FROM publishers
				 WHERE user_id = $1 AND id = $2 AND deleted_at IS NOT NULL`,
				[userId, publisherId]
			);
			if (deletedRes.rowCount === 0) {
				await client.query("ROLLBACK");
				results.push({ id: publisherId, status: "failed", reason: "Publisher not found or not deleted." });
				failedCount += 1;
				continue;
			}
			const deleted = deletedRes.rows[0];
			const conflictRes = await client.query(
				`SELECT id, name, founded_date_id, website, notes
				 FROM publishers
				 WHERE user_id = $1 AND deleted_at IS NULL AND LOWER(name) = LOWER($2) AND id <> $3`,
				[userId, deleted.name, deleted.id]
			);
			const conflict = conflictRes.rows[0];

			if (conflict && mode === "decline") {
				await client.query("ROLLBACK");
				results.push({
					id: deleted.id,
					status: "failed",
					reason: `Could not restore '${deleted.name}' because another publisher with that name already exists in your library.`
				});
				failedCount += 1;
				continue;
			}

			if (conflict && mode === "merge") {
				await client.query(
					`UPDATE publishers SET
						founded_date_id = COALESCE(founded_date_id, $2),
						website = CASE WHEN (website IS NULL OR website = '') AND $3 IS NOT NULL AND $3 <> '' THEN $3 ELSE website END,
						notes = CASE WHEN (notes IS NULL OR notes = '') AND $4 IS NOT NULL AND $4 <> '' THEN $4 ELSE notes END
					 WHERE id = $1`,
					[conflict.id, deleted.founded_date_id, deleted.website, deleted.notes]
				);
				await client.query(
					`UPDATE books SET publisher_id = $1 WHERE user_id = $2 AND publisher_id = $3`,
					[conflict.id, userId, deleted.id]
				);
				await client.query(
					`DELETE FROM publishers WHERE user_id = $1 AND id = $2`,
					[userId, deleted.id]
				);
				await client.query("COMMIT");
				results.push({ id: deleted.id, status: "restored", effectiveId: conflict.id });
				restoredCount += 1;
				continue;
			}

			if (conflict && mode === "override") {
				await client.query(
					`UPDATE publishers SET deleted_at = NOW() WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
					[userId, conflict.id]
				);
				await client.query(
					`UPDATE books SET publisher_id = $1 WHERE user_id = $2 AND publisher_id = $3`,
					[deleted.id, userId, conflict.id]
				);
				await client.query(
					`UPDATE publishers SET deleted_at = NULL WHERE user_id = $1 AND id = $2`,
					[userId, deleted.id]
				);
				await client.query("COMMIT");
				results.push({ id: deleted.id, status: "restored" });
				restoredCount += 1;
				continue;
			}

			await client.query(
				`UPDATE publishers SET deleted_at = NULL WHERE user_id = $1 AND id = $2`,
				[userId, deleted.id]
			);
			await client.query("COMMIT");
			results.push({ id: deleted.id, status: "restored" });
			restoredCount += 1;
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("PUBLISHER_RESTORE", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				publisher_id: publisherId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			results.push({ id: publisherId, status: "failed", reason: "An error occurred while restoring this publisher." });
			failedCount += 1;
		} finally {
			client.release();
		}
	}

	const message = restoredCount > 0 && failedCount > 0
		? "Some items were restored successfully."
		: restoredCount > 0
			? "Publishers restored successfully."
			: "No publishers were restored.";

	return successResponse(res, 200, message, {
		results,
		restoredCount,
		failedCount
	});
});

// POST /publisher/delete-permanent - Permanently delete deleted publishers (single or bulk)
router.post("/delete-permanent", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const idsPayload = params.ids ?? params.id;
	const { ids } = parseIdsInput(idsPayload);

	if (!ids.length) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a publisher id or ids array to permanently delete."]);
	}

	const results = [];
	let deletedCount = 0;
	let failedCount = 0;

	for (const publisherId of ids) {
		if (!Number.isInteger(publisherId)) {
			results.push({ id: publisherId, status: "failed", reason: "Publisher id must be a valid integer." });
			failedCount += 1;
			continue;
		}
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const match = await client.query(
				`SELECT id FROM publishers WHERE user_id = $1 AND id = $2 AND deleted_at IS NOT NULL`,
				[userId, publisherId]
			);
			if (match.rowCount === 0) {
				await client.query("ROLLBACK");
				results.push({ id: publisherId, status: "failed", reason: "Publisher not found or not deleted." });
				failedCount += 1;
				continue;
			}
			await client.query(
				`UPDATE books SET publisher_id = NULL WHERE user_id = $1 AND publisher_id = $2`,
				[userId, publisherId]
			);
			await client.query(
				`DELETE FROM publishers WHERE user_id = $1 AND id = $2`,
				[userId, publisherId]
			);
			await client.query("COMMIT");
			results.push({ id: publisherId, status: "deleted" });
			deletedCount += 1;
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("PUBLISHER_DELETE_PERMANENT", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				publisher_id: publisherId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			results.push({ id: publisherId, status: "failed", reason: "An error occurred while deleting this publisher." });
			failedCount += 1;
		} finally {
			client.release();
		}
	}

	const message = deletedCount > 0 && failedCount > 0
		? "Some items were deleted successfully."
		: deletedCount > 0
			? "Publishers deleted permanently."
			: "No publishers were deleted.";

	return successResponse(res, 200, message, {
		results,
		deletedCount,
		failedCount
	});
});

module.exports = router;
