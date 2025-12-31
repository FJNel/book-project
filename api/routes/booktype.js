const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_BOOK_TYPE_NAME_LENGTH = 100;
const MAX_BOOK_TYPE_DESCRIPTION_LENGTH = 1000;
const MAX_LIST_LIMIT = 200;

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

function parseDateFilter(value, fieldLabel) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) {
		return { error: `${fieldLabel} must be a valid ISO 8601 date.` };
	}
	return { value: new Date(parsed).toISOString() };
}

async function resolveBookTypeId({ userId, id, name }) {
	if (Number.isInteger(id)) {
		return id;
	}
	if (name) {
		const result = await pool.query(
			`SELECT id FROM book_types WHERE user_id = $1 AND name = $2`,
			[userId, name]
		);
		if (result.rows.length === 0) {
			return null;
		}
		return result.rows[0].id;
	}
	return null;
}

// GET /booktype - List all book types for the authenticated user
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly);
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
		const resolvedId = await resolveBookTypeId({ userId, id: targetId, name: targetName });
		if (!Number.isInteger(resolvedId)) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		const result = await pool.query(
			`SELECT id, name, description, created_at, updated_at
			 FROM book_types
			 WHERE user_id = $1 AND id = $2`,
			[userId, resolvedId]
		);

		const row = result.rows[0];
			const payload = nameOnly
				? { id: row.id, name: row.name }
				: {
					id: row.id,
					name: row.name,
					description: row.description,
					createdAt: row.created_at,
					updatedAt: row.updated_at
				};

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
		: "id, name, description, created_at, updated_at";

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

		if (listParams.filterId !== undefined) {
			const filterId = parseId(listParams.filterId);
			if (!Number.isInteger(filterId)) {
				errors.push("filterId must be a valid integer.");
			} else {
				filters.push(`id = $${paramIndex++}`);
				values.push(filterId);
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
				updatedAt: row.updated_at
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

// GET /booktype/by-name?name=Hardcover - Fetch a specific book type by name
router.get("/by-name", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const rawName = normalizeText(req.query.name ?? req.body?.name);

	const errors = validateBookTypeName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const result = await pool.query(
			`SELECT id, name, description, created_at, updated_at
			 FROM book_types
			 WHERE user_id = $1 AND name = $2`,
			[userId, rawName]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		const row = result.rows[0];
		return successResponse(res, 200, "Book type retrieved successfully.", {
			id: row.id,
			name: row.name,
			description: row.description,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
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

// GET /booktype/:id - Fetch a specific book type by ID
router.get("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = Number.parseInt(req.params.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book type id must be a valid integer."]);
	}

	try {
		const result = await pool.query(
			`SELECT id, name, description, created_at, updated_at
			 FROM book_types
			 WHERE user_id = $1 AND id = $2`,
			[userId, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		const row = result.rows[0];
		return successResponse(res, 200, "Book type retrieved successfully.", {
			id: row.id,
			name: row.name,
			description: row.description,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
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
			`SELECT id FROM book_types WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
			[userId, rawName]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Book type already exists.", ["A book type with this name already exists."]);
		}

		const result = await pool.query(
			`INSERT INTO book_types (user_id, name, description, created_at, updated_at)
			 VALUES ($1, $2, $3, NOW(), NOW())
			 RETURNING id, name, description, created_at, updated_at`,
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
			updatedAt: row.updated_at
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
				`SELECT id FROM book_types WHERE user_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3`,
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
			WHERE user_id = $1 AND id = $2
			RETURNING id, name, description, created_at, updated_at;
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
			updatedAt: row.updated_at
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

	const resolvedId = await resolveBookTypeId({ userId, id: targetId, name: targetName });
	if (!Number.isInteger(resolvedId)) {
		return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
	}
	return handleBookTypeUpdate(req, res, resolvedId);
});

async function handleBookTypeDelete(req, res, targetId) {
	const userId = req.user.id;

	try {
		const result = await pool.query(
			`DELETE FROM book_types WHERE user_id = $1 AND id = $2`,
			[userId, targetId]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		logToFile("BOOK_TYPE_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			book_type_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Book type deleted successfully.", { id });
	} catch (error) {
		logToFile("BOOK_TYPE_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the book type."]);
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

	const resolvedId = await resolveBookTypeId({ userId, id: targetId, name: targetName });
	if (!Number.isInteger(resolvedId)) {
		return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
	}
	return handleBookTypeDelete(req, res, resolvedId);
});

module.exports = router;
