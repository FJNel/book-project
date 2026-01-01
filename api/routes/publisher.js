const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { validatePartialDateObject } = require("../utils/partial-date");

const MAX_PUBLISHER_NAME_LENGTH = 150;
const MAX_WEBSITE_LENGTH = 300;
const MAX_NOTES_LENGTH = 1000;
const MAX_LIST_LIMIT = 200;

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

async function resolvePublisherId({ userId, id, name }) {
	if (Number.isInteger(id)) {
		return id;
	}
	if (name) {
		const result = await pool.query(
			`SELECT id FROM publishers WHERE user_id = $1 AND name = $2`,
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

// GET /publisher - List or fetch a specific publisher
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly) ?? false;
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
			const resolvedId = await resolvePublisherId({ userId, id: targetId, name: targetName });
			if (!Number.isInteger(resolvedId)) {
				return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
			}

			const result = await pool.query(
				`SELECT p.id, p.name, p.website, p.notes, p.created_at, p.updated_at,
				        fd.id AS founded_date_id, fd.day AS founded_day, fd.month AS founded_month, fd.year AS founded_year, fd.text AS founded_text
				 FROM publishers p
				 LEFT JOIN dates fd ON p.founded_date_id = fd.id
				 WHERE p.user_id = $1 AND p.id = $2`,
				[userId, resolvedId]
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
					updatedAt: row.updated_at
				};

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

	if (listParams.filterId !== undefined) {
		const filterId = parseId(listParams.filterId);
		if (!Number.isInteger(filterId)) {
			errors.push("filterId must be a valid integer.");
		} else {
			filters.push(`p.id = $${paramIndex++}`);
			values.push(filterId);
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
		const filterFoundedDateId = parseId(listParams.filterFoundedDateId);
		if (!Number.isInteger(filterFoundedDateId)) {
			errors.push("filterFoundedDateId must be a valid integer.");
		} else {
			filters.push(`p.founded_date_id = $${paramIndex++}`);
			values.push(filterFoundedDateId);
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
});

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
			`SELECT id FROM publishers WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
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

	const errors = validatePublisherName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const result = await pool.query(
			`SELECT p.id, p.name, p.website, p.notes, p.created_at, p.updated_at,
			        fd.id AS founded_date_id, fd.day AS founded_day, fd.month AS founded_month, fd.year AS founded_year, fd.text AS founded_text
			 FROM publishers p
			 LEFT JOIN dates fd ON p.founded_date_id = fd.id
			 WHERE p.user_id = $1 AND p.name = $2`,
			[userId, rawName]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
		}

		const row = result.rows[0];
		return successResponse(res, 200, "Publisher retrieved successfully.", {
			id: row.id,
			name: row.name,
			foundedDate: row.founded_date_id
				? { id: row.founded_date_id, day: row.founded_day, month: row.founded_month, year: row.founded_year, text: row.founded_text }
				: null,
			website: row.website,
			notes: row.notes,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
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

// GET /publisher/:id - Fetch a specific publisher by ID
router.get("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Publisher id must be a valid integer."]);
	}

	try {
		const result = await pool.query(
			`SELECT p.id, p.name, p.website, p.notes, p.created_at, p.updated_at,
			        fd.id AS founded_date_id, fd.day AS founded_day, fd.month AS founded_month, fd.year AS founded_year, fd.text AS founded_text
			 FROM publishers p
			 LEFT JOIN dates fd ON p.founded_date_id = fd.id
			 WHERE p.user_id = $1 AND p.id = $2`,
			[userId, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
		}

		const row = result.rows[0];
		return successResponse(res, 200, "Publisher retrieved successfully.", {
			id: row.id,
			name: row.name,
			foundedDate: row.founded_date_id
				? { id: row.founded_date_id, day: row.founded_day, month: row.founded_month, year: row.founded_year, text: row.founded_text }
				: null,
			website: row.website,
			notes: row.notes,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
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
				`SELECT id FROM publishers WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3`,
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
				 WHERE user_id = $1 AND id = $2
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

	const resolvedId = await resolvePublisherId({ userId, id: targetId, name: targetName });
	if (!Number.isInteger(resolvedId)) {
		return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
	}
	return handlePublisherUpdate(req, res, resolvedId);
});

async function handlePublisherDelete(req, res, publisherId) {
	const userId = req.user.id;
	try {
		const result = await pool.query(
			`DELETE FROM publishers WHERE user_id = $1 AND id = $2`,
			[userId, publisherId]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
		}

		logToFile("PUBLISHER_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			publisher_id: publisherId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Publisher deleted successfully.", { id: publisherId });
	} catch (error) {
		logToFile("PUBLISHER_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the publisher."]);
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

	const resolvedId = await resolvePublisherId({ userId, id: targetId, name: targetName });
	if (!Number.isInteger(resolvedId)) {
		return errorResponse(res, 404, "Publisher not found.", ["The requested publisher could not be located."]);
	}
	return handlePublisherDelete(req, res, resolvedId);
});

module.exports = router;
