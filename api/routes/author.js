const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_DISPLAY_NAME_LENGTH = 150;
const MAX_FIRST_NAMES_LENGTH = 150;
const MAX_LAST_NAME_LENGTH = 100;
const MAX_BIO_LENGTH = 1000;

const MONTH_NAMES = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December"
];

function normalizeText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
}

function normalizeDateText(value) {
	if (typeof value !== "string") return "";
	return value.trim().replace(/\s+/g, " ");
}

function formatPartialDate(day, month, year) {
	if (day && month && year) return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
	if (!day && month && year) return `${MONTH_NAMES[month - 1]} ${year}`;
	if (!day && !month && year) return String(year);
	return "";
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

function validatePartialDateObject(dateValue, fieldLabel) {
	const errors = [];
	if (dateValue === undefined || dateValue === null) {
		return errors;
	}
	if (typeof dateValue !== "object" || Array.isArray(dateValue)) {
		errors.push(`${fieldLabel} must be an object with day, month, year, and text.`);
		return errors;
	}

	const { day, month, year, text } = dateValue;
	const textValue = normalizeDateText(text);

	if (!textValue) {
		errors.push(`${fieldLabel} text must be provided.`);
	}

	const hasDay = day !== null && day !== undefined;
	const hasMonth = month !== null && month !== undefined;
	const hasYear = year !== null && year !== undefined;

	if (hasDay && (!hasMonth || !hasYear)) {
		errors.push(`${fieldLabel} requires month and year when day is provided.`);
	}
	if (hasMonth && !hasYear) {
		errors.push(`${fieldLabel} requires year when month is provided.`);
	}

	if (hasDay && (!Number.isInteger(day) || day < 1 || day > 31)) {
		errors.push(`${fieldLabel} day must be an integer between 1 and 31.`);
	}
	if (hasMonth && (!Number.isInteger(month) || month < 1 || month > 12)) {
		errors.push(`${fieldLabel} month must be an integer between 1 and 12.`);
	}
	if (hasYear && (!Number.isInteger(year) || year < 1 || year > 9999)) {
		errors.push(`${fieldLabel} year must be an integer between 1 and 9999.`);
	}

	if (errors.length > 0) {
		return errors;
	}

	if (hasDay && hasMonth && hasYear) {
		const probe = new Date(year, month - 1, day);
		if (probe.getFullYear() !== year || probe.getMonth() + 1 !== month || probe.getDate() !== day) {
			errors.push(`${fieldLabel} is not a valid calendar date.`);
		}
	}

	const expectedText = formatPartialDate(hasDay ? day : null, hasMonth ? month : null, hasYear ? year : null);
	if (!expectedText) {
		errors.push(`${fieldLabel} must include at least a year.`);
	} else if (expectedText.toLowerCase() !== textValue.toLowerCase()) {
		errors.push(`${fieldLabel} text must match the provided day, month, and year.`);
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

async function resolveAuthorId({ userId, id, displayName }) {
	if (Number.isInteger(id)) {
		return id;
	}
	if (displayName) {
		const result = await pool.query(
			`SELECT id FROM authors WHERE user_id = $1 AND display_name = $2`,
			[userId, displayName]
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

// GET /author - List or fetch a specific author
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const nameOnly = req.query.nameOnly === "true" || req.query.nameOnly === "1";
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
			const resolvedId = await resolveAuthorId({ userId, id: targetId, displayName: targetName });
			if (!Number.isInteger(resolvedId)) {
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
				 WHERE a.user_id = $1 AND a.id = $2`,
				[userId, resolvedId]
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

	try {
		const result = await pool.query(
			`SELECT a.id, a.display_name, a.first_names, a.last_name, a.deceased, a.bio,
			        a.created_at, a.updated_at,
			        bd.id AS birth_date_id, bd.day AS birth_day, bd.month AS birth_month, bd.year AS birth_year, bd.text AS birth_text,
			        dd.id AS death_date_id, dd.day AS death_day, dd.month AS death_month, dd.year AS death_year, dd.text AS death_text
			 FROM authors a
			 LEFT JOIN dates bd ON a.birth_date_id = bd.id
			 LEFT JOIN dates dd ON a.death_date_id = dd.id
			 WHERE a.user_id = $1
			 ORDER BY a.display_name ASC`,
			[userId]
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
	const displayName = normalizeText(req.query.displayName ?? req.query.name);

	const errors = validateDisplayName(displayName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
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
			 WHERE a.user_id = $1 AND a.display_name = $2`,
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
			 WHERE a.user_id = $1 AND a.id = $2`,
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
				`SELECT deceased FROM authors WHERE user_id = $1 AND id = $2`,
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
				`SELECT id FROM authors WHERE user_id = $1 AND LOWER(display_name) = LOWER($2) AND id <> $3`,
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
				 WHERE user_id = $1 AND id = $2
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

	const resolvedId = await resolveAuthorId({ userId, id: targetId, displayName: targetName });
	if (!Number.isInteger(resolvedId)) {
		return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
	}
	return handleAuthorUpdate(req, res, resolvedId);
});

async function handleAuthorDelete(req, res, authorId) {
	const userId = req.user.id;
	try {
		const result = await pool.query(
			`DELETE FROM authors WHERE user_id = $1 AND id = $2`,
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

		return successResponse(res, 200, "Author deleted successfully.", { id: authorId });
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

	const resolvedId = await resolveAuthorId({ userId, id: targetId, displayName: targetName });
	if (!Number.isInteger(resolvedId)) {
		return errorResponse(res, 404, "Author not found.", ["The requested author could not be located."]);
	}
	return handleAuthorDelete(req, res, resolvedId);
});

module.exports = router;
