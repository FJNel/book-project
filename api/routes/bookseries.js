const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { validatePartialDateObject } = require("../utils/partial-date");

const MAX_SERIES_NAME_LENGTH = 150;
const MAX_SERIES_DESCRIPTION_LENGTH = 1000;
const MAX_LIST_LIMIT = 200;

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
	if (Number.isInteger(id)) {
		return id;
	}
	if (name) {
		const result = await pool.query(
			`SELECT id FROM book_series WHERE user_id = $1 AND name = $2`,
			[userId, name]
		);
		if (result.rows.length === 0) {
			return null;
		}
		return result.rows[0].id;
	}
	return null;
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
		`SELECT book_id, book_order
		 FROM book_series_books
		 WHERE user_id = $1 AND series_id = $2
		 ORDER BY book_order ASC NULLS LAST, book_id ASC`,
		[userId, seriesId]
	);
	return result.rows.map((row) => ({
		bookId: row.book_id,
		bookOrder: row.book_order
	}));
}

// GET /bookseries - List or fetch a specific series
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly) ?? false;
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
			const resolvedId = await resolveSeriesId({ userId, id: targetId, name: targetName });
			if (!Number.isInteger(resolvedId)) {
				return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
			}

			const result = await pool.query(
				`SELECT s.id, s.name, s.description, s.created_at, s.updated_at,
				        sd.id AS start_date_id, sd.day AS start_day, sd.month AS start_month, sd.year AS start_year, sd.text AS start_text
				 FROM book_series s
				 LEFT JOIN dates sd ON s.start_date_id = sd.id
				 WHERE s.user_id = $1 AND s.id = $2`,
				[userId, resolvedId]
			);

			const row = result.rows[0];
			const books = await fetchSeriesBooks(userId, resolvedId);
			const payload = nameOnly
				? { id: row.id, name: row.name }
				: {
					id: row.id,
					name: row.name,
					startDate: row.start_date_id
						? { id: row.start_date_id, day: row.start_day, month: row.start_month, year: row.start_year, text: row.start_text }
						: null,
					description: row.description,
					books,
					createdAt: row.created_at,
					updatedAt: row.updated_at
				};

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
		: `s.id, s.name, s.description, s.created_at, s.updated_at,
		   sd.id AS start_date_id, sd.day AS start_day, sd.month AS start_month, sd.year AS start_year, sd.text AS start_text`;

	const errors = [];
	const sortFields = {
		id: "s.id",
		name: "s.name",
		description: "s.description",
		createdAt: "s.created_at",
		updatedAt: "s.updated_at",
		startDateId: "s.start_date_id",
		startDay: "sd.day",
		startMonth: "sd.month",
		startYear: "sd.year",
		startText: "sd.text"
	};
	const sortBy = normalizeText(listParams.sortBy) || "name";
	const sortColumn = sortFields[sortBy];
	if (!sortColumn) {
		errors.push("sortBy must be one of: id, name, description, createdAt, updatedAt, startDateId, startDay, startMonth, startYear, startText.");
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

	if (listParams.filterStartDateId !== undefined) {
		const filterStartDateId = parseId(listParams.filterStartDateId);
		if (!Number.isInteger(filterStartDateId)) {
			errors.push("filterStartDateId must be a valid integer.");
		} else {
			filters.push(`s.start_date_id = $${paramIndex++}`);
			values.push(filterStartDateId);
		}
	}

	const startDay = parseOptionalIntRange(listParams.filterStartDay, "filterStartDay", { min: 1, max: 31 });
	if (startDay.error) errors.push(startDay.error);
	if (startDay.value !== null) {
		filters.push(`sd.day = $${paramIndex++}`);
		values.push(startDay.value);
	}

	const startMonth = parseOptionalIntRange(listParams.filterStartMonth, "filterStartMonth", { min: 1, max: 12 });
	if (startMonth.error) errors.push(startMonth.error);
	if (startMonth.value !== null) {
		filters.push(`sd.month = $${paramIndex++}`);
		values.push(startMonth.value);
	}

	const startYear = parseOptionalIntRange(listParams.filterStartYear, "filterStartYear", { min: 1, max: 9999 });
	if (startYear.error) errors.push(startYear.error);
	if (startYear.value !== null) {
		filters.push(`sd.year = $${paramIndex++}`);
		values.push(startYear.value);
	}

	const startText = normalizeText(listParams.filterStartText);
	if (startText) {
		filters.push(`sd.text ILIKE $${paramIndex++}`);
		values.push(`%${startText}%`);
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
		filters.push(`make_date(sd.year, COALESCE(sd.month, 1), COALESCE(sd.day, 1)) <= $${paramIndex++}::date`);
		values.push(startBefore.value);
	}

	const startAfter = parseDateFilter(listParams.filterStartedAfter, "filterStartedAfter");
	if (startAfter.error) errors.push(startAfter.error);
	if (startAfter.value) {
		filters.push(`make_date(sd.year, COALESCE(sd.month, 1), COALESCE(sd.day, 1)) >= $${paramIndex++}::date`);
		values.push(startAfter.value);
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	let query = `SELECT ${fields}
			 FROM book_series s
			 LEFT JOIN dates sd ON s.start_date_id = sd.id
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
				description: row.description,
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
	const startDate = req.body?.startDate ?? null;

	const errors = [
		...validateSeriesName(name),
		...validateSeriesDescription(description),
		...validatePartialDateObject(startDate, "Series Start Date")
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
			const startDateId = await insertPartialDate(client, startDate);

			const result = await client.query(
				`INSERT INTO book_series (user_id, name, start_date_id, description, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, NOW(), NOW())
				 RETURNING id, name, start_date_id, description, created_at, updated_at`,
				[userId, name, startDateId, description || null]
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
				startDate: startDateId ? { ...startDate, id: startDateId } : null,
				description: row.description,
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

	const errors = validateSeriesName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const result = await pool.query(
			`SELECT s.id, s.name, s.description, s.created_at, s.updated_at,
			        sd.id AS start_date_id, sd.day AS start_day, sd.month AS start_month, sd.year AS start_year, sd.text AS start_text
			 FROM book_series s
			 LEFT JOIN dates sd ON s.start_date_id = sd.id
			 WHERE s.user_id = $1 AND s.name = $2`,
			[userId, rawName]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}

		const row = result.rows[0];
		const books = await fetchSeriesBooks(userId, row.id);
		return successResponse(res, 200, "Series retrieved successfully.", {
			id: row.id,
			name: row.name,
			startDate: row.start_date_id
				? { id: row.start_date_id, day: row.start_day, month: row.start_month, year: row.start_year, text: row.start_text }
				: null,
			description: row.description,
			books,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
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

// GET /bookseries/:id - Fetch a specific series by ID
router.get("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Series id must be a valid integer."]);
	}

	try {
		const result = await pool.query(
			`SELECT s.id, s.name, s.description, s.created_at, s.updated_at,
			        sd.id AS start_date_id, sd.day AS start_day, sd.month AS start_month, sd.year AS start_year, sd.text AS start_text
			 FROM book_series s
			 LEFT JOIN dates sd ON s.start_date_id = sd.id
			 WHERE s.user_id = $1 AND s.id = $2`,
			[userId, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}

		const row = result.rows[0];
		const books = await fetchSeriesBooks(userId, row.id);
		return successResponse(res, 200, "Series retrieved successfully.", {
			id: row.id,
			name: row.name,
			startDate: row.start_date_id
				? { id: row.start_date_id, day: row.start_day, month: row.start_month, year: row.start_year, text: row.start_text }
				: null,
			description: row.description,
			books,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
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
	const hasStartDate = Object.prototype.hasOwnProperty.call(req.body || {}, "startDate");
	const hasDescription = Object.prototype.hasOwnProperty.call(req.body || {}, "description");

	const name = hasName ? normalizeText(req.body?.name) : undefined;
	const startDate = hasStartDate ? req.body?.startDate : undefined;
	const description = hasDescription ? normalizeText(req.body?.description) : undefined;

	const errors = [
		...(hasName ? validateSeriesName(name) : []),
		...(hasDescription ? validateSeriesDescription(description) : []),
		...(hasStartDate ? validatePartialDateObject(startDate, "Series Start Date") : [])
	];

	if (!hasName && !hasStartDate && !hasDescription) {
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

			let startDateId;

			if (hasName) {
				updateFields.push(`name = $${index++}`);
				params.push(name);
			}
			if (hasStartDate) {
				startDateId = await insertPartialDate(client, startDate);
				updateFields.push(`start_date_id = $${index++}`);
				params.push(startDateId);
			}
			if (hasDescription) {
				updateFields.push(`description = $${index++}`);
				params.push(description || null);
			}

			const result = await client.query(
				`UPDATE book_series
				 SET ${updateFields.join(", ")}, updated_at = NOW()
				 WHERE user_id = $1 AND id = $2
				 RETURNING id, name, start_date_id, description, created_at, updated_at`,
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
				startDate: hasStartDate && startDateId ? { ...startDate, id: startDateId } : null,
				description: row.description,
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

	const resolvedId = await resolveSeriesId({ userId, id: targetId, name: targetName });
	if (!Number.isInteger(resolvedId)) {
		return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
	}
	return handleSeriesUpdate(req, res, resolvedId);
});

async function handleSeriesDelete(req, res, seriesId) {
	const userId = req.user.id;
	try {
		const result = await pool.query(
			`DELETE FROM book_series WHERE user_id = $1 AND id = $2`,
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

		return successResponse(res, 200, "Series deleted successfully.", { id: seriesId });
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

	const resolvedId = await resolveSeriesId({ userId, id: targetId, name: targetName });
	if (!Number.isInteger(resolvedId)) {
		return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
	}
	return handleSeriesDelete(req, res, resolvedId);
});

// POST /bookseries/link - Link a book to a series
router.post("/link", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const seriesId = parseId(req.body?.seriesId);
	const seriesName = normalizeText(req.body?.seriesName ?? req.body?.name);
	const bookId = parseId(req.body?.bookId);
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
	if (orderError) {
		errors.push(orderError);
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const resolvedId = await resolveSeriesId({ userId, id: seriesId, name: seriesName });
		if (!Number.isInteger(resolvedId)) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}

		const existing = await pool.query(
			`SELECT id FROM book_series_books WHERE user_id = $1 AND series_id = $2 AND book_id = $3`,
			[userId, resolvedId, bookId]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Link already exists.", ["This book is already linked to the series."]);
		}

		const result = await pool.query(
			`INSERT INTO book_series_books (user_id, series_id, book_id, book_order, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, NOW(), NOW())
			 RETURNING id, series_id, book_id, book_order, created_at, updated_at`,
			[userId, resolvedId, bookId, bookOrder]
		);

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
	if (orderError) {
		errors.push(orderError);
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const resolvedId = await resolveSeriesId({ userId, id: seriesId, name: seriesName });
		if (!Number.isInteger(resolvedId)) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}

		const result = await pool.query(
			`UPDATE book_series_books
			 SET book_order = $1, updated_at = NOW()
			 WHERE user_id = $2 AND series_id = $3 AND book_id = $4
			 RETURNING id, series_id, book_id, book_order, created_at, updated_at`,
			[bookOrder, userId, resolvedId, bookId]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Link not found.", ["The requested book-series link could not be located."]);
		}

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
		const resolvedId = await resolveSeriesId({ userId, id: seriesId, name: seriesName });
		if (!Number.isInteger(resolvedId)) {
			return errorResponse(res, 404, "Series not found.", ["The requested series could not be located."]);
		}

		const result = await pool.query(
			`DELETE FROM book_series_books
			 WHERE user_id = $1 AND series_id = $2 AND book_id = $3`,
			[userId, resolvedId, bookId]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Link not found.", ["The requested book-series link could not be located."]);
		}

		logToFile("BOOK_SERIES_LINK_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			series_id: resolvedId,
			book_id: bookId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Book unlinked from series successfully.", {
			seriesId: resolvedId,
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
