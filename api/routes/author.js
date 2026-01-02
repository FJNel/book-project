const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { validatePartialDateObject } = require("../utils/partial-date");

const MAX_DISPLAY_NAME_LENGTH = 150;
const MAX_FIRST_NAMES_LENGTH = 150;
const MAX_LAST_NAME_LENGTH = 100;
const MAX_BIO_LENGTH = 1000;
const MAX_LIST_LIMIT = 200;

function normalizeText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
}

function validateDisplayName(name) {
	const errors = [];
	if (!name) {
		errors.push("Display Name must be provided.");
		return errors;
	}
	if (name.length < 2 || name.length > MAX_DISPLAY_NAME_LENGTH) {
		errors.push(`Display Name must be between 2 and ${MAX_DISPLAY_NAME_LENGTH} characters.`);
	}
	return errors;
}

function validateNameField(value, fieldLabel, maxLength) {
	const errors = [];
	if (value === undefined || value === null || value === "") {
		return errors;
	}
	if (typeof value !== "string") {
		errors.push(`${fieldLabel} must be a string.`);
		return errors;
	}
	const trimmed = value.trim();
	if (trimmed.length < 2 || trimmed.length > maxLength) {
		errors.push(`${fieldLabel} must be between 2 and ${maxLength} characters.`);
	}
	if (!/^[A-Za-z\s\-.'’]+$/.test(trimmed)) {
		errors.push(`${fieldLabel} can only contain alphabetic characters, spaces, hyphens, and apostrophes.`);
	}
	return errors;
}

function validateBio(value) {
	const errors = [];
	if (value === undefined || value === null || value === "") {
		return errors;
	}
	if (typeof value !== "string") {
		errors.push("Bio must be a string.");
		return errors;
	}
	if (value.trim().length > MAX_BIO_LENGTH) {
		errors.push(`Bio must be ${MAX_BIO_LENGTH} characters or fewer.`);
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

async function resolveAuthorId({ userId, id, displayName }) {
	const hasId = Number.isInteger(id);
	const hasName = Boolean(displayName);

	if (hasId && hasName) {
		const result = await pool.query(
			`SELECT id, display_name FROM authors WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
			[userId, id]
		);
		if (result.rows.length === 0 || result.rows[0].display_name !== displayName) {
			return { id: null, mismatch: true };
		}
		return { id };
	}

	if (hasId) {
		return { id };
	}

	if (hasName) {
		const result = await pool.query(
			`SELECT id FROM authors WHERE user_id = $1 AND display_name = $2 AND deleted_at IS NULL`,
			[userId, displayName]
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

// GET /author - List or fetch a specific author
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly) ?? false;
	const includeDeleted = parseBooleanFlag(listParams.includeDeleted) ?? false;
	const targetId = parseId(req.query.id ?? req.body?.id);
	const targetName = normalizeText(req.query.displayName ?? req.body?.displayName);

	if (targetId !== null || targetName) {
		if (targetName) {
			const nameErrors = validateDisplayName(targetName);
			if (nameErrors.length > 0) {
				return errorResponse(res, 400, "Validation Error", nameErrors);
			}
		}

		try {
			const resolved = await resolveAuthorId({ userId, id: targetId, displayName: targetName });
			if (resolved.mismatch) {
				return errorResponse(res, 400, "Validation Error", ["Author id and display name must refer to the same record."]);
			}
			if (!Number.isInteger(resolved.id)) {
				return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
			}

			const result = await pool.query(
				`SELECT a.id, a.display_name, a.first_names, a.last_name, a.deceased, a.bio,
				        a.created_at, a.updated_at,
				        bd.id AS birth_date_id, bd.day AS birth_day, bd.month AS birth_month, bd.year AS birth_year, bd.text AS birth_text,
				        dd.id AS death_date_id, dd.day AS death_day, dd.month AS death_month, dd.year AS death_year, dd.text AS death_text
				 FROM authors a
				 LEFT JOIN dates bd ON a.birth_date_id = bd.id
				 LEFT JOIN dates dd ON a.death_date_id = dd.id
				 WHERE a.user_id = $1 AND a.id = $2 AND a.deleted_at IS NULL`,
				[userId, resolved.id]
			);

			const row = result.rows[0];
			const payload = nameOnly
				? { id: row.id, displayName: row.display_name }
				: {
					id: row.id,
					displayName: row.display_name,
					firstNames: row.first_names,
					lastName: row.last_name,
					birthDate: row.birth_date_id
						? { id: row.birth_date_id, day: row.birth_day, month: row.birth_month, year: row.birth_year, text: row.birth_text }
						: null,
					deceased: row.deceased,
					deathDate: row.death_date_id
						? { id: row.death_date_id, day: row.death_day, month: row.death_month, year: row.death_year, text: row.death_text }
						: null,
					bio: row.bio,
					createdAt: row.created_at,
					updatedAt: row.updated_at
				};

			return successResponse(res, 200, "Author retrieved successfully.", payload);
		} catch (error) {
			logToFile("AUTHOR_GET", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the author."]);
		}
	}

	const errors = [];
	const sortFields = {
		id: "a.id",
		displayName: "a.display_name",
		firstNames: "a.first_names",
		lastName: "a.last_name",
		deceased: "a.deceased",
		bio: "a.bio",
		createdAt: "a.created_at",
		updatedAt: "a.updated_at",
		birthDateId: "a.birth_date_id",
		deathDateId: "a.death_date_id",
		birthDay: "bd.day",
		birthMonth: "bd.month",
		birthYear: "bd.year",
		birthText: "bd.text",
		deathDay: "dd.day",
		deathMonth: "dd.month",
		deathYear: "dd.year",
		deathText: "dd.text"
	};
	const sortBy = normalizeText(listParams.sortBy) || "displayName";
	const sortColumn = sortFields[sortBy];
	if (!sortColumn) {
		errors.push("sortBy must be one of: id, displayName, firstNames, lastName, deceased, bio, createdAt, updatedAt, birthDateId, deathDateId, birthDay, birthMonth, birthYear, birthText, deathDay, deathMonth, deathYear, deathText.");
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
		filters.push("a.deleted_at IS NULL");
	}

	const filterIdRaw = listParams.filterId;
	if (filterIdRaw !== undefined) {
		const filterId = parseId(filterIdRaw);
		if (!Number.isInteger(filterId)) {
			errors.push("filterId must be a valid integer.");
		} else {
			filters.push(`a.id = $${paramIndex++}`);
			values.push(filterId);
		}
	}

	const filterDisplayName = normalizeText(listParams.filterDisplayName);
	if (filterDisplayName) {
		if (filterDisplayName.length > MAX_DISPLAY_NAME_LENGTH) {
			errors.push(`filterDisplayName must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`);
		} else {
			filters.push(`a.display_name ILIKE $${paramIndex++}`);
			values.push(`%${filterDisplayName}%`);
		}
	}

	const filterFirstNames = normalizeText(listParams.filterFirstNames);
	if (filterFirstNames) {
		if (filterFirstNames.length > MAX_FIRST_NAMES_LENGTH) {
			errors.push(`filterFirstNames must be ${MAX_FIRST_NAMES_LENGTH} characters or fewer.`);
		} else {
			filters.push(`a.first_names ILIKE $${paramIndex++}`);
			values.push(`%${filterFirstNames}%`);
		}
	}

	const filterLastName = normalizeText(listParams.filterLastName);
	if (filterLastName) {
		if (filterLastName.length > MAX_LAST_NAME_LENGTH) {
			errors.push(`filterLastName must be ${MAX_LAST_NAME_LENGTH} characters or fewer.`);
		} else {
			filters.push(`a.last_name ILIKE $${paramIndex++}`);
			values.push(`%${filterLastName}%`);
		}
	}

	const filterBio = normalizeText(listParams.filterBio);
	if (filterBio) {
		if (filterBio.length > MAX_BIO_LENGTH) {
			errors.push(`filterBio must be ${MAX_BIO_LENGTH} characters or fewer.`);
		} else {
			filters.push(`a.bio ILIKE $${paramIndex++}`);
			values.push(`%${filterBio}%`);
		}
	}

	if (listParams.filterDeceased !== undefined) {
		const filterDeceased = parseBooleanFlag(listParams.filterDeceased);
		if (filterDeceased === null) {
			errors.push("filterDeceased must be a boolean.");
		} else {
			filters.push(`a.deceased = $${paramIndex++}`);
			values.push(filterDeceased);
		}
	}

	if (listParams.filterBirthDateId !== undefined) {
		const filterBirthDateId = parseId(listParams.filterBirthDateId);
		if (!Number.isInteger(filterBirthDateId)) {
			errors.push("filterBirthDateId must be a valid integer.");
		} else {
			filters.push(`a.birth_date_id = $${paramIndex++}`);
			values.push(filterBirthDateId);
		}
	}

	if (listParams.filterDeathDateId !== undefined) {
		const filterDeathDateId = parseId(listParams.filterDeathDateId);
		if (!Number.isInteger(filterDeathDateId)) {
			errors.push("filterDeathDateId must be a valid integer.");
		} else {
			filters.push(`a.death_date_id = $${paramIndex++}`);
			values.push(filterDeathDateId);
		}
	}

	const birthDay = parseOptionalIntRange(listParams.filterBirthDay, "filterBirthDay", { min: 1, max: 31 });
	if (birthDay.error) errors.push(birthDay.error);
	if (birthDay.value !== null) {
		filters.push(`bd.day = $${paramIndex++}`);
		values.push(birthDay.value);
	}

	const birthMonth = parseOptionalIntRange(listParams.filterBirthMonth, "filterBirthMonth", { min: 1, max: 12 });
	if (birthMonth.error) errors.push(birthMonth.error);
	if (birthMonth.value !== null) {
		filters.push(`bd.month = $${paramIndex++}`);
		values.push(birthMonth.value);
	}

	const birthYear = parseOptionalIntRange(listParams.filterBirthYear, "filterBirthYear", { min: 1, max: 9999 });
	if (birthYear.error) errors.push(birthYear.error);
	if (birthYear.value !== null) {
		filters.push(`bd.year = $${paramIndex++}`);
		values.push(birthYear.value);
	}

	const birthText = normalizeText(listParams.filterBirthText);
	if (birthText) {
		filters.push(`bd.text ILIKE $${paramIndex++}`);
		values.push(`%${birthText}%`);
	}

	const deathDay = parseOptionalIntRange(listParams.filterDeathDay, "filterDeathDay", { min: 1, max: 31 });
	if (deathDay.error) errors.push(deathDay.error);
	if (deathDay.value !== null) {
		filters.push(`dd.day = $${paramIndex++}`);
		values.push(deathDay.value);
	}

	const deathMonth = parseOptionalIntRange(listParams.filterDeathMonth, "filterDeathMonth", { min: 1, max: 12 });
	if (deathMonth.error) errors.push(deathMonth.error);
	if (deathMonth.value !== null) {
		filters.push(`dd.month = $${paramIndex++}`);
		values.push(deathMonth.value);
	}

	const deathYear = parseOptionalIntRange(listParams.filterDeathYear, "filterDeathYear", { min: 1, max: 9999 });
	if (deathYear.error) errors.push(deathYear.error);
	if (deathYear.value !== null) {
		filters.push(`dd.year = $${paramIndex++}`);
		values.push(deathYear.value);
	}

	const deathText = normalizeText(listParams.filterDeathText);
	if (deathText) {
		filters.push(`dd.text ILIKE $${paramIndex++}`);
		values.push(`%${deathText}%`);
	}

	const dateFilters = [
		{ key: "filterCreatedAt", column: "a.created_at", op: "=" },
		{ key: "filterUpdatedAt", column: "a.updated_at", op: "=" },
		{ key: "filterCreatedAfter", column: "a.created_at", op: ">=" },
		{ key: "filterCreatedBefore", column: "a.created_at", op: "<=" },
		{ key: "filterUpdatedAfter", column: "a.updated_at", op: ">=" },
		{ key: "filterUpdatedBefore", column: "a.updated_at", op: "<=" }
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

	const birthBefore = parseDateFilter(listParams.filterBornBefore, "filterBornBefore");
	if (birthBefore.error) errors.push(birthBefore.error);
	if (birthBefore.value) {
		filters.push(`make_date(bd.year, COALESCE(bd.month, 1), COALESCE(bd.day, 1)) <= $${paramIndex++}::date`);
		values.push(birthBefore.value);
	}

	const birthAfter = parseDateFilter(listParams.filterBornAfter, "filterBornAfter");
	if (birthAfter.error) errors.push(birthAfter.error);
	if (birthAfter.value) {
		filters.push(`make_date(bd.year, COALESCE(bd.month, 1), COALESCE(bd.day, 1)) >= $${paramIndex++}::date`);
		values.push(birthAfter.value);
	}

	const deathBefore = parseDateFilter(listParams.filterDiedBefore, "filterDiedBefore");
	if (deathBefore.error) errors.push(deathBefore.error);
	if (deathBefore.value) {
		filters.push(`make_date(dd.year, COALESCE(dd.month, 1), COALESCE(dd.day, 1)) <= $${paramIndex++}::date`);
		values.push(deathBefore.value);
	}

	const deathAfter = parseDateFilter(listParams.filterDiedAfter, "filterDiedAfter");
	if (deathAfter.error) errors.push(deathAfter.error);
	if (deathAfter.value) {
		filters.push(`make_date(dd.year, COALESCE(dd.month, 1), COALESCE(dd.day, 1)) >= $${paramIndex++}::date`);
		values.push(deathAfter.value);
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	let query = `SELECT a.id, a.display_name, a.first_names, a.last_name, a.deceased, a.bio,
			        a.created_at, a.updated_at,
			        bd.id AS birth_date_id, bd.day AS birth_day, bd.month AS birth_month, bd.year AS birth_year, bd.text AS birth_text,
			        dd.id AS death_date_id, dd.day AS death_day, dd.month AS death_month, dd.year AS death_year, dd.text AS death_text
			 FROM authors a
			 LEFT JOIN dates bd ON a.birth_date_id = bd.id
			 LEFT JOIN dates dd ON a.death_date_id = dd.id
			 WHERE a.user_id = $1`;
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
		const result = await pool.query(
			query,
			values
		);

		const payload = result.rows.map((row) => {
			if (nameOnly) {
				return { id: row.id, displayName: row.display_name };
			}
			return {
				id: row.id,
				displayName: row.display_name,
				firstNames: row.first_names,
				lastName: row.last_name,
				birthDate: row.birth_date_id
					? { id: row.birth_date_id, day: row.birth_day, month: row.birth_month, year: row.birth_year, text: row.birth_text }
					: null,
				deceased: row.deceased,
				deathDate: row.death_date_id
					? { id: row.death_date_id, day: row.death_day, month: row.death_month, year: row.death_year, text: row.death_text }
					: null,
				bio: row.bio,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			};
		});

		logToFile("AUTHOR_LIST", {
			status: "SUCCESS",
			user_id: userId,
			count: payload.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Authors retrieved successfully.", { authors: payload });
	} catch (error) {
		logToFile("AUTHOR_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving authors."]);
	}
});

// POST /author - Create a new author
router.post("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const displayName = normalizeText(req.body?.displayName);
	const firstNames = normalizeText(req.body?.firstNames);
	const lastName = normalizeText(req.body?.lastName);
	let deceased = parseBooleanFlag(req.body?.deceased);
	const bio = normalizeText(req.body?.bio);
	const birthDate = req.body?.birthDate ?? null;
	const deathDate = req.body?.deathDate ?? null;

	const errors = [
		...validateDisplayName(displayName),
		...validateNameField(firstNames, "First Names", MAX_FIRST_NAMES_LENGTH),
		...validateNameField(lastName, "Last Name", MAX_LAST_NAME_LENGTH),
		...validateBio(bio),
		...validatePartialDateObject(birthDate, "Birth Date"),
		...validatePartialDateObject(deathDate, "Death Date")
	];

	if (deceased === false && deathDate) {
		errors.push("Death Date must be null when the author is not deceased.");
	}
	if (deceased === null && deathDate) {
		deceased = true;
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query(
			`SELECT id FROM authors WHERE user_id = $1 AND LOWER(display_name) = LOWER($2)`,
			[userId, displayName]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Author already exists.", ["An author with this display name already exists."]);
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const birthDateId = await insertPartialDate(client, birthDate);
			const deathDateId = deceased ? await insertPartialDate(client, deathDate) : null;

			const result = await client.query(
				`INSERT INTO authors (user_id, display_name, first_names, last_name, birth_date_id, deceased, death_date_id, bio, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
				 RETURNING id, display_name, first_names, last_name, birth_date_id, deceased, death_date_id, bio, created_at, updated_at`,
				[userId, displayName, firstNames || null, lastName || null, birthDateId, deceased ?? false, deathDateId, bio || null]
			);

			await client.query("COMMIT");

			const row = result.rows[0];
			logToFile("AUTHOR_CREATE", {
				status: "SUCCESS",
				user_id: userId,
				author_id: row.id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			const payload = {
				id: row.id,
				displayName: row.display_name,
				firstNames: row.first_names,
				lastName: row.last_name,
				birthDate: birthDateId ? { ...birthDate, id: birthDateId } : null,
				deceased: row.deceased,
				deathDate: deathDateId ? { ...deathDate, id: deathDateId } : null,
				bio: row.bio,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			};

			return successResponse(res, 201, "Author created successfully.", payload);
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("AUTHOR_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the author."]);
	}
});

// GET /author/by-name?displayName=... - Fetch an author by display name
router.get("/by-name", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const displayName = normalizeText(req.query.displayName ?? req.query.name ?? req.body?.displayName ?? req.body?.name);
	const targetId = parseId(req.query.id ?? req.body?.id);

	const errors = validateDisplayName(displayName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (Number.isInteger(targetId)) {
			const resolved = await resolveAuthorId({ userId, id: targetId, displayName });
			if (resolved.mismatch) {
				return errorResponse(res, 400, "Validation Error", ["Author id and display name must refer to the same record."]);
			}
		}

		const result = await pool.query(
			`SELECT a.id, a.display_name, a.first_names, a.last_name, a.deceased, a.bio,
			        a.created_at, a.updated_at,
			        bd.id AS birth_date_id, bd.day AS birth_day, bd.month AS birth_month, bd.year AS birth_year, bd.text AS birth_text,
			        dd.id AS death_date_id, dd.day AS death_day, dd.month AS death_month, dd.year AS death_year, dd.text AS death_text
			 FROM authors a
			 LEFT JOIN dates bd ON a.birth_date_id = bd.id
			 LEFT JOIN dates dd ON a.death_date_id = dd.id
			 WHERE a.user_id = $1 AND a.display_name = $2 AND a.deleted_at IS NULL`,
			[userId, displayName]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
		}

		const row = result.rows[0];
		return successResponse(res, 200, "Author retrieved successfully.", {
			id: row.id,
			displayName: row.display_name,
			firstNames: row.first_names,
			lastName: row.last_name,
			birthDate: row.birth_date_id
				? { id: row.birth_date_id, day: row.birth_day, month: row.birth_month, year: row.birth_year, text: row.birth_text }
				: null,
			deceased: row.deceased,
			deathDate: row.death_date_id
				? { id: row.death_date_id, day: row.death_day, month: row.death_month, year: row.death_year, text: row.death_text }
				: null,
			bio: row.bio,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
	} catch (error) {
		logToFile("AUTHOR_GET", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the author."]);
	}
});

// GET /author/trash - List deleted authors
router.get("/trash", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	try {
		const result = await pool.query(
			`SELECT id, display_name, first_names, last_name, deceased, bio, deleted_at, created_at, updated_at
			 FROM authors
			 WHERE user_id = $1 AND deleted_at IS NOT NULL
			 ORDER BY deleted_at DESC`,
			[userId]
		);

		const payload = result.rows.map((row) => ({
			id: row.id,
			displayName: row.display_name,
			firstNames: row.first_names,
			lastName: row.last_name,
			deceased: row.deceased,
			bio: row.bio,
			deletedAt: row.deleted_at,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		}));

		return successResponse(res, 200, "Deleted authors retrieved successfully.", { authors: payload });
	} catch (error) {
		logToFile("AUTHOR_TRASH", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving deleted authors."]);
	}
});

// GET /author/stats - Author statistics
router.get("/stats", requiresAuth, statsLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => normalizeText(field)).filter(Boolean)
		: [];

	const fieldMap = {
		total: "COUNT(*) FILTER (WHERE a.deleted_at IS NULL) AS total",
		deleted: "COUNT(*) FILTER (WHERE a.deleted_at IS NOT NULL) AS deleted",
		deceased: "COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.deceased = true) AS deceased",
		alive: "COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.deceased = false) AS alive",
		withBirthDate: "COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.birth_date_id IS NOT NULL) AS with_birth_date",
		withDeathDate: "COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.death_date_id IS NOT NULL) AS with_death_date",
		withBio: "COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND a.bio IS NOT NULL AND a.bio <> '') AS with_bio",
		earliestBirthYear: "MIN(bd.year) FILTER (WHERE a.deleted_at IS NULL) AS earliest_birth_year",
		latestBirthYear: "MAX(bd.year) FILTER (WHERE a.deleted_at IS NULL) AS latest_birth_year",
		earliestDeathYear: "MIN(dd.year) FILTER (WHERE a.deleted_at IS NULL) AS earliest_death_year",
		latestDeathYear: "MAX(dd.year) FILTER (WHERE a.deleted_at IS NULL) AS latest_death_year"
	};

	const selected = fields.length > 0 ? fields : Object.keys(fieldMap);
	const invalid = selected.filter((field) => !fieldMap[field]);
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}

	try {
		const query = `SELECT ${selected.map((field) => fieldMap[field]).join(", ")}
			FROM authors a
			LEFT JOIN dates bd ON a.birth_date_id = bd.id
			LEFT JOIN dates dd ON a.death_date_id = dd.id
			WHERE a.user_id = $1`;

		const result = await pool.query(query, [userId]);
		const row = result.rows[0] || {};
		const payload = {};
		selected.forEach((field) => {
			const key = field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
			payload[field] = row[key] ?? null;
		});

		return successResponse(res, 200, "Author stats retrieved successfully.", { stats: payload });
	} catch (error) {
		logToFile("AUTHOR_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve author stats at this time."]);
	}
});

// GET /author/:id - Fetch an author by id
router.get("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Author id must be a valid integer."]);
	}

	try {
		const result = await pool.query(
			`SELECT a.id, a.display_name, a.first_names, a.last_name, a.deceased, a.bio,
			        a.created_at, a.updated_at,
			        bd.id AS birth_date_id, bd.day AS birth_day, bd.month AS birth_month, bd.year AS birth_year, bd.text AS birth_text,
			        dd.id AS death_date_id, dd.day AS death_day, dd.month AS death_month, dd.year AS death_year, dd.text AS death_text
			 FROM authors a
			 LEFT JOIN dates bd ON a.birth_date_id = bd.id
			 LEFT JOIN dates dd ON a.death_date_id = dd.id
			 WHERE a.user_id = $1 AND a.id = $2 AND a.deleted_at IS NULL`,
			[userId, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
		}

		const row = result.rows[0];
		return successResponse(res, 200, "Author retrieved successfully.", {
			id: row.id,
			displayName: row.display_name,
			firstNames: row.first_names,
			lastName: row.last_name,
			birthDate: row.birth_date_id
				? { id: row.birth_date_id, day: row.birth_day, month: row.birth_month, year: row.birth_year, text: row.birth_text }
				: null,
			deceased: row.deceased,
			deathDate: row.death_date_id
				? { id: row.death_date_id, day: row.death_day, month: row.death_month, year: row.death_year, text: row.death_text }
				: null,
			bio: row.bio,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
	} catch (error) {
		logToFile("AUTHOR_GET", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the author."]);
	}
});

async function handleAuthorUpdate(req, res, authorId) {
	const userId = req.user.id;
	const hasDisplayName = Object.prototype.hasOwnProperty.call(req.body || {}, "displayName");
	const hasFirstNames = Object.prototype.hasOwnProperty.call(req.body || {}, "firstNames");
	const hasLastName = Object.prototype.hasOwnProperty.call(req.body || {}, "lastName");
	let hasDeceased = Object.prototype.hasOwnProperty.call(req.body || {}, "deceased");
	const hasBirthDate = Object.prototype.hasOwnProperty.call(req.body || {}, "birthDate");
	const hasDeathDate = Object.prototype.hasOwnProperty.call(req.body || {}, "deathDate");
	const hasBio = Object.prototype.hasOwnProperty.call(req.body || {}, "bio");

	const displayName = hasDisplayName ? normalizeText(req.body?.displayName) : undefined;
	const firstNames = hasFirstNames ? normalizeText(req.body?.firstNames) : undefined;
	const lastName = hasLastName ? normalizeText(req.body?.lastName) : undefined;
	let deceased = hasDeceased ? parseBooleanFlag(req.body?.deceased) : undefined;
	const birthDate = hasBirthDate ? req.body?.birthDate : undefined;
	const deathDate = hasDeathDate ? req.body?.deathDate : undefined;
	const bio = hasBio ? normalizeText(req.body?.bio) : undefined;

	const errors = [
		...(hasDisplayName ? validateDisplayName(displayName) : []),
		...(hasFirstNames ? validateNameField(firstNames, "First Names", MAX_FIRST_NAMES_LENGTH) : []),
		...(hasLastName ? validateNameField(lastName, "Last Name", MAX_LAST_NAME_LENGTH) : []),
		...(hasBio ? validateBio(bio) : []),
		...(hasBirthDate ? validatePartialDateObject(birthDate, "Birth Date") : []),
		...(hasDeathDate ? validatePartialDateObject(deathDate, "Death Date") : [])
	];

	if (hasDeceased && deceased === null) {
		errors.push("Deceased must be provided as true or false.");
	}
	if (hasDeceased && deceased === false && hasDeathDate && deathDate) {
		errors.push("Death Date must be null when the author is not deceased.");
	}
	if (!hasDeceased && hasDeathDate && deathDate) {
		deceased = true;
		hasDeceased = true;
	}

	if (!hasDisplayName && !hasFirstNames && !hasLastName && !hasDeceased && !hasBirthDate && !hasDeathDate && !hasBio) {
		return errorResponse(res, 400, "No changes were provided.", ["Please provide at least one field to update."]);
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (hasDeathDate && !hasDeceased) {
			const current = await pool.query(
				`SELECT deceased FROM authors WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
				[userId, authorId]
			);
			if (current.rows.length === 0) {
				return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
			}
			if (current.rows[0].deceased === false && deathDate) {
				return errorResponse(res, 400, "Validation Error", ["Death Date must be null when the author is not deceased."]);
			}
		}

		if (hasDisplayName) {
			const existing = await pool.query(
				`SELECT id FROM authors WHERE user_id = $1 AND LOWER(display_name) = LOWER($2) AND id <> $3 AND deleted_at IS NULL`,
				[userId, displayName, authorId]
			);
			if (existing.rows.length > 0) {
				return errorResponse(res, 409, "Author already exists.", ["An author with this display name already exists."]);
			}
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const updateFields = [];
			const params = [userId, authorId];
			let index = 3;

			let birthDateId;
			let deathDateId;

			if (hasDisplayName) {
				updateFields.push(`display_name = $${index++}`);
				params.push(displayName);
			}
			if (hasFirstNames) {
				updateFields.push(`first_names = $${index++}`);
				params.push(firstNames || null);
			}
			if (hasLastName) {
				updateFields.push(`last_name = $${index++}`);
				params.push(lastName || null);
			}
			if (hasBirthDate) {
				birthDateId = await insertPartialDate(client, birthDate);
				updateFields.push(`birth_date_id = $${index++}`);
				params.push(birthDateId);
			}
			if (hasDeceased) {
				updateFields.push(`deceased = $${index++}`);
				params.push(deceased);
				if (deceased === false) {
					updateFields.push(`death_date_id = $${index++}`);
					params.push(null);
				}
			}
			if (hasDeathDate && (deceased === undefined || deceased === true)) {
				deathDateId = await insertPartialDate(client, deathDate);
				updateFields.push(`death_date_id = $${index++}`);
				params.push(deathDateId);
			}
			if (hasBio) {
				updateFields.push(`bio = $${index++}`);
				params.push(bio || null);
			}

			const result = await client.query(
				`UPDATE authors
				 SET ${updateFields.join(", ")}, updated_at = NOW()
				 WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
				 RETURNING id, display_name, first_names, last_name, birth_date_id, deceased, death_date_id, bio, created_at, updated_at`,
				params
			);

			if (result.rows.length === 0) {
				await client.query("ROLLBACK");
				return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
			}

			await client.query("COMMIT");

			const row = result.rows[0];
			logToFile("AUTHOR_UPDATE", {
				status: "SUCCESS",
				user_id: userId,
				author_id: row.id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			const payload = {
				id: row.id,
				displayName: row.display_name,
				firstNames: row.first_names,
				lastName: row.last_name,
				birthDate: hasBirthDate && birthDateId ? { ...birthDate, id: birthDateId } : null,
				deceased: row.deceased,
				deathDate: hasDeathDate && deathDateId ? { ...deathDate, id: deathDateId } : null,
				bio: row.bio,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			};

			return successResponse(res, 200, "Author updated successfully.", payload);
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("AUTHOR_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the author."]);
	}
}

// PUT /author/:id - Update an author by id
router.put("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Author id must be a valid integer."]);
	}
	return handleAuthorUpdate(req, res, id);
});

// PUT /author - Update an author by id or display name
router.put("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetName = normalizeText(req.body?.targetDisplayName ?? req.body?.displayName);

	if (!Number.isInteger(targetId) && !targetName) {
		return errorResponse(res, 400, "Validation Error", ["Please provide an author id or display name to update."]);
	}
	if (targetName) {
		const nameErrors = validateDisplayName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
	}

	const resolved = await resolveAuthorId({ userId, id: targetId, displayName: targetName });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Author id and display name must refer to the same record."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
	}
	return handleAuthorUpdate(req, res, resolved.id);
});

async function handleAuthorDelete(req, res, authorId) {
	const userId = req.user.id;
	try {
		const result = await pool.query(
			`UPDATE authors
			 SET deleted_at = NOW()
			 WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
			 RETURNING id, deleted_at`,
			[userId, authorId]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
		}

		logToFile("AUTHOR_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			author_id: authorId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Author moved to trash.", {
			id: result.rows[0].id,
			deletedAt: result.rows[0].deleted_at
		});
	} catch (error) {
		logToFile("AUTHOR_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the author."]);
	}
}

// DELETE /author/:id - Remove an author by id
router.delete("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Author id must be a valid integer."]);
	}
	return handleAuthorDelete(req, res, id);
});

// DELETE /author - Remove an author by id or display name
router.delete("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetName = normalizeText(req.body?.displayName);

	if (!Number.isInteger(targetId) && !targetName) {
		return errorResponse(res, 400, "Validation Error", ["Please provide an author id or display name to delete."]);
	}
	if (targetName) {
		const nameErrors = validateDisplayName(targetName);
		if (nameErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", nameErrors);
		}
	}

	const resolved = await resolveAuthorId({ userId, id: targetId, displayName: targetName });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Author id and display name must refer to the same record."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
	}
	return handleAuthorDelete(req, res, resolved.id);
});

// POST /author/restore - Restore a deleted author
router.post("/restore", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetName = normalizeText(req.body?.displayName);

	if (!Number.isInteger(targetId) && !targetName) {
		return errorResponse(res, 400, "Validation Error", ["Please provide an author id or display name to restore."]);
	}
	if (targetName) {
		const nameErrors = validateDisplayName(targetName);
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
		clauses.push(`display_name = $${idx++}`);
		values.push(targetName);
	}

	try {
		const match = await pool.query(
			`SELECT id FROM authors WHERE ${clauses.join(" AND ")}`,
			values
		);
		if (match.rows.length === 0) {
			return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
		}
		if (match.rows.length > 1) {
			return errorResponse(res, 400, "Validation Error", ["Please provide a more specific author identifier."]);
		}

		const restored = await pool.query(
			`UPDATE authors SET deleted_at = NULL WHERE id = $1 RETURNING id`,
			[match.rows[0].id]
		);

		return successResponse(res, 200, "Author restored successfully.", {
			id: restored.rows[0].id
		});
	} catch (error) {
		logToFile("AUTHOR_RESTORE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while restoring the author."]);
	}
});

module.exports = router;
