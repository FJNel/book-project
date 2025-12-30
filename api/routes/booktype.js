const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_BOOK_TYPE_NAME_LENGTH = 100;
const MAX_BOOK_TYPE_DESCRIPTION_LENGTH = 500;

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

// GET /booktype - List all book types for the authenticated user
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const nameOnly = parseBooleanFlag(req.query.nameOnly);

	const fields = nameOnly
		? "id, name"
		: "id, name, description, created_at, updated_at";

	try {
		const result = await pool.query(
			`SELECT ${fields}
			 FROM book_types
			 WHERE user_id = $1
			 ORDER BY name ASC`,
			[userId]
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
	const rawName = normalizeText(req.query.name);

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

// PUT /booktype/:id - Update a book type
router.put("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = Number.parseInt(req.params.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book type id must be a valid integer."]);
	}

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
				[userId, rawName, id]
			);
			if (existing.rows.length > 0) {
				return errorResponse(res, 409, "Book type already exists.", ["A book type with this name already exists."]);
			}
		}

		const updateFields = [];
		const params = [userId, id];
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
});

// DELETE /booktype/:id - Remove a book type
router.delete("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = Number.parseInt(req.params.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book type id must be a valid integer."]);
	}

	try {
		const result = await pool.query(
			`DELETE FROM book_types WHERE user_id = $1 AND id = $2`,
			[userId, id]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Book type not found.", ["The requested book type could not be located."]);
		}

		logToFile("BOOK_TYPE_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			book_type_id: id,
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
});

module.exports = router;
