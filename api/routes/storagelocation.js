const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_LOCATION_NAME_LENGTH = 150;
const MAX_NOTES_LENGTH = 2000;
const MAX_LIST_LIMIT = 200;

function normalizeText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
}

function normalizeOptionalText(value) {
	if (value === undefined || value === null) return null;
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
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

function validateLocationName(name) {
	const errors = [];
	if (!name) {
		errors.push("Location name must be provided.");
		return errors;
	}
	if (name.length < 2 || name.length > MAX_LOCATION_NAME_LENGTH) {
		errors.push(`Location name must be between 2 and ${MAX_LOCATION_NAME_LENGTH} characters.`);
	}
	if (!/^[A-Za-z0-9\s\-.'’&/]+$/.test(name)) {
		errors.push("Location name contains invalid characters.");
	}
	return errors;
}

function validateNotes(notes) {
	const errors = [];
	if (notes === undefined || notes === null || notes === "") {
		return errors;
	}
	if (typeof notes !== "string") {
		errors.push("Notes must be a string.");
		return errors;
	}
	if (notes.trim().length > MAX_NOTES_LENGTH) {
		errors.push(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`);
	}
	return errors;
}

async function resolveLocationPath(userId, path) {
	const result = await pool.query(
		`WITH RECURSIVE location_paths AS (
			SELECT id, user_id, parent_id, name, notes, created_at, updated_at, name::text AS path
			FROM storage_locations
			WHERE user_id = $1 AND parent_id IS NULL
			UNION ALL
			SELECT sl.id, sl.user_id, sl.parent_id, sl.name, sl.notes, sl.created_at, sl.updated_at,
				(lp.path || ' -> ' || sl.name) AS path
			FROM storage_locations sl
			JOIN location_paths lp ON sl.parent_id = lp.id
			WHERE sl.user_id = $1
		)
		SELECT id FROM location_paths WHERE path = $2 LIMIT 1`,
		[userId, path]
	);
	return result.rows[0]?.id ?? null;
}

function buildLocationPayload(row, nameOnly) {
	if (nameOnly) {
		return {
			id: row.id,
			name: row.name,
			path: row.path
		};
	}

	return {
		id: row.id,
		name: row.name,
		parentId: row.parent_id,
		notes: row.notes,
		path: row.path,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

// GET /storagelocation - List or fetch a specific storage location
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly) ?? false;
	const targetId = parseId(req.query.id ?? req.body?.id);
	const targetPath = normalizeText(req.query.path ?? req.body?.path);

	if (targetId !== null || targetPath) {
		try {
			if (targetId !== null && targetPath) {
				const resolvedPathId = await resolveLocationPath(userId, targetPath);
				if (!Number.isInteger(resolvedPathId) || resolvedPathId !== targetId) {
					return errorResponse(res, 400, "Validation Error", ["Storage location id and path must refer to the same record."]);
				}
			}

			const result = await pool.query(
				`WITH RECURSIVE location_paths AS (
					SELECT id, user_id, parent_id, name, notes, created_at, updated_at, name::text AS path
					FROM storage_locations
					WHERE user_id = $1 AND parent_id IS NULL
					UNION ALL
					SELECT sl.id, sl.user_id, sl.parent_id, sl.name, sl.notes, sl.created_at, sl.updated_at,
						(lp.path || ' -> ' || sl.name) AS path
					FROM storage_locations sl
					JOIN location_paths lp ON sl.parent_id = lp.id
					WHERE sl.user_id = $1
				)
				SELECT id, parent_id, name, notes, created_at, updated_at, path
				FROM location_paths
				WHERE ${targetId !== null ? "id = $2" : "path = $2"}
				LIMIT 1`,
				[userId, targetId !== null ? targetId : targetPath]
			);

			if (result.rows.length === 0) {
				return errorResponse(res, 404, "Storage location not found.", ["The requested storage location could not be located."]);
			}

			const payload = buildLocationPayload(result.rows[0], nameOnly);
			return successResponse(res, 200, "Storage location retrieved successfully.", payload);
		} catch (error) {
			logToFile("STORAGE_LOCATION_GET", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the storage location."]);
		}
	}

	const errors = [];
	const sortFields = {
		id: "id",
		name: "name",
		path: "path",
		parentId: "parent_id",
		notes: "notes",
		createdAt: "created_at",
		updatedAt: "updated_at"
	};
	const sortBy = normalizeText(listParams.sortBy) || "path";
	const sortColumn = sortFields[sortBy];
	if (!sortColumn) {
		errors.push("sortBy must be one of: id, name, path, parentId, notes, createdAt, updatedAt.");
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
		filters.push(`name ILIKE $${paramIndex++}`);
		values.push(`%${filterName}%`);
	}

	if (listParams.filterParentId !== undefined) {
		const filterParentId = parseId(listParams.filterParentId);
		if (!Number.isInteger(filterParentId)) {
			errors.push("filterParentId must be a valid integer.");
		} else {
			filters.push(`parent_id = $${paramIndex++}`);
			values.push(filterParentId);
		}
	}

	const filterRootOnly = parseBooleanFlag(listParams.filterRootOnly);
	if (filterRootOnly === true) {
		filters.push("parent_id IS NULL");
	}

	const filterPath = normalizeText(listParams.filterPath);
	if (filterPath) {
		filters.push(`path = $${paramIndex++}`);
		values.push(filterPath);
	}

	const filterPathContains = normalizeText(listParams.filterPathContains);
	if (filterPathContains) {
		filters.push(`path ILIKE $${paramIndex++}`);
		values.push(`%${filterPathContains}%`);
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const fields = nameOnly
			? "id, name, path"
			: "id, parent_id, name, notes, created_at, updated_at, path";

		let query = `WITH RECURSIVE location_paths AS (
			SELECT id, user_id, parent_id, name, notes, created_at, updated_at, name::text AS path
			FROM storage_locations
			WHERE user_id = $1 AND parent_id IS NULL
			UNION ALL
			SELECT sl.id, sl.user_id, sl.parent_id, sl.name, sl.notes, sl.created_at, sl.updated_at,
				(lp.path || ' -> ' || sl.name) AS path
			FROM storage_locations sl
			JOIN location_paths lp ON sl.parent_id = lp.id
			WHERE sl.user_id = $1
		)
		SELECT ${fields}
		FROM location_paths
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
		const payload = result.rows.map((row) => buildLocationPayload(row, nameOnly));

		logToFile("STORAGE_LOCATION_LIST", {
			status: "SUCCESS",
			user_id: userId,
			count: payload.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Storage locations retrieved successfully.", { storageLocations: payload });
	} catch (error) {
		logToFile("STORAGE_LOCATION_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving storage locations."]);
	}
});

// GET /storagelocation/:id/bookcopies - List book copies stored in a location (recursive optional)
router.get("/:id/bookcopies", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const locationId = parseId(req.params.id);
	const recursive = parseBooleanFlag(req.query.recursive ?? req.body?.recursive) ?? true;

	if (!Number.isInteger(locationId)) {
		return errorResponse(res, 400, "Validation Error", ["Storage location id must be a valid integer."]);
	}

	try {
		const locationCheck = await pool.query(
			`SELECT id FROM storage_locations WHERE user_id = $1 AND id = $2`,
			[userId, locationId]
		);
		if (locationCheck.rows.length === 0) {
			return errorResponse(res, 404, "Storage location not found.", ["The requested storage location could not be located."]);
		}

		const locationIdsQuery = recursive
			? `WITH RECURSIVE location_tree AS (
					SELECT id, parent_id FROM storage_locations WHERE user_id = $1 AND id = $2
					UNION ALL
					SELECT sl.id, sl.parent_id
					FROM storage_locations sl
					JOIN location_tree lt ON sl.parent_id = lt.id
					WHERE sl.user_id = $1
				)
				SELECT id FROM location_tree`
			: `SELECT id FROM storage_locations WHERE user_id = $1 AND id = $2`;

		const idsResult = await pool.query(locationIdsQuery, [userId, locationId]);
		const ids = idsResult.rows.map((row) => row.id);

		const result = await pool.query(
			`WITH RECURSIVE location_paths AS (
				SELECT id, parent_id, name, name::text AS path
				FROM storage_locations
				WHERE user_id = $1 AND parent_id IS NULL
				UNION ALL
				SELECT sl.id, sl.parent_id, sl.name, (lp.path || ' -> ' || sl.name) AS path
				FROM storage_locations sl
				JOIN location_paths lp ON sl.parent_id = lp.id
				WHERE sl.user_id = $1
			)
			SELECT bc.id, bc.book_id, bc.storage_location_id, bc.acquisition_story, bc.acquisition_date_id,
			       bc.acquired_from, bc.acquisition_type, bc.acquisition_location, bc.notes,
			       bc.created_at, bc.updated_at,
			       b.title, b.subtitle, b.isbn,
			       d.day AS acq_day, d.month AS acq_month, d.year AS acq_year, d.text AS acq_text,
			       lp.path AS storage_location_path
			FROM book_copies bc
			JOIN books b ON bc.book_id = b.id
			LEFT JOIN dates d ON bc.acquisition_date_id = d.id
			LEFT JOIN location_paths lp ON bc.storage_location_id = lp.id
			WHERE bc.user_id = $1
			  AND bc.storage_location_id = ANY($2::int[])
			  AND b.deleted_at IS NULL
			ORDER BY lp.path ASC NULLS LAST, bc.id ASC`,
			[userId, ids]
		);

		const payload = result.rows.map((row) => ({
			id: row.id,
			book: {
				id: row.book_id,
				title: row.title,
				subtitle: row.subtitle,
				isbn: row.isbn
			},
			storageLocationId: row.storage_location_id,
			storageLocationPath: row.storage_location_path,
			acquisitionStory: row.acquisition_story,
			acquisitionDate: row.acquisition_date_id
				? { id: row.acquisition_date_id, day: row.acq_day, month: row.acq_month, year: row.acq_year, text: row.acq_text }
				: null,
			acquiredFrom: row.acquired_from,
			acquisitionType: row.acquisition_type,
			acquisitionLocation: row.acquisition_location,
			notes: row.notes,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		}));

		return successResponse(res, 200, "Book copies retrieved successfully.", {
			locationId,
			recursive,
			bookCopies: payload
		});
	} catch (error) {
		logToFile("STORAGE_LOCATION_BOOKCOPIES", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving book copies for this location."]);
	}
});

// POST /storagelocation - Create a storage location
router.post("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const name = normalizeText(req.body?.name);
	const hasParentId = Object.prototype.hasOwnProperty.call(req.body || {}, "parentId");
	const parentIdRaw = hasParentId ? req.body?.parentId : undefined;
	const parentId = parentIdRaw === null || parentIdRaw === undefined ? null : parseId(parentIdRaw);
	const notes = normalizeOptionalText(req.body?.notes);

	const errors = [
		...validateLocationName(name),
		...validateNotes(req.body?.notes)
	];
	if (hasParentId && parentIdRaw !== null && parentIdRaw !== undefined && !Number.isInteger(parentId)) {
		errors.push("Parent location id must be a valid integer.");
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (Number.isInteger(parentId)) {
			const existing = await pool.query(
				`SELECT id FROM storage_locations WHERE user_id = $1 AND id = $2`,
				[userId, parentId]
			);
			if (existing.rows.length === 0) {
				return errorResponse(res, 400, "Validation Error", ["Parent location could not be located."]);
			}
		}

		const result = await pool.query(
			`INSERT INTO storage_locations (user_id, name, parent_id, notes, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, NOW(), NOW())
			 RETURNING id, name, parent_id, notes, created_at, updated_at`,
			[userId, name, parentId, notes]
		);

		const row = result.rows[0];
		const pathResult = await pool.query(
			`WITH RECURSIVE location_paths AS (
				SELECT id, user_id, parent_id, name, notes, created_at, updated_at, name::text AS path
				FROM storage_locations
				WHERE user_id = $1 AND parent_id IS NULL
				UNION ALL
				SELECT sl.id, sl.user_id, sl.parent_id, sl.name, sl.notes, sl.created_at, sl.updated_at,
					(lp.path || ' -> ' || sl.name) AS path
				FROM storage_locations sl
				JOIN location_paths lp ON sl.parent_id = lp.id
				WHERE sl.user_id = $1
			)
			SELECT path FROM location_paths WHERE id = $2`,
			[userId, row.id]
		);

		logToFile("STORAGE_LOCATION_CREATE", {
			status: "SUCCESS",
			user_id: userId,
			location_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 201, "Storage location created successfully.", {
			id: row.id,
			name: row.name,
			parentId: row.parent_id,
			notes: row.notes,
			path: pathResult.rows[0]?.path ?? row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
	} catch (error) {
		if (error.code === "23505") {
			return errorResponse(res, 409, "Storage location already exists.", ["A storage location with this name already exists at the same level."]);
		}
		logToFile("STORAGE_LOCATION_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the storage location."]);
	}
});

async function handleStorageLocationUpdate(req, res, targetId) {
	const userId = req.user.id;
	const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
	const hasParentId = Object.prototype.hasOwnProperty.call(req.body || {}, "parentId");
	const hasNotes = Object.prototype.hasOwnProperty.call(req.body || {}, "notes");

	const name = hasName ? normalizeText(req.body?.name) : undefined;
	const parentIdRaw = hasParentId ? req.body?.parentId : undefined;
	const parentId = parentIdRaw === null || parentIdRaw === undefined ? null : parseId(parentIdRaw);
	const notes = hasNotes ? normalizeOptionalText(req.body?.notes) : undefined;

	const errors = [];
	if (hasName) {
		errors.push(...validateLocationName(name));
	}
	if (hasNotes) {
		errors.push(...validateNotes(req.body?.notes));
	}
	if (hasParentId && parentIdRaw !== null && parentIdRaw !== undefined && !Number.isInteger(parentId)) {
		errors.push("Parent location id must be a valid integer.");
	}
	if (!hasName && !hasParentId && !hasNotes) {
		return errorResponse(res, 400, "No changes were provided.", ["Please provide at least one field to update."]);
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (hasParentId && Number.isInteger(parentId)) {
			const existing = await pool.query(
				`SELECT id FROM storage_locations WHERE user_id = $1 AND id = $2`,
				[userId, parentId]
			);
			if (existing.rows.length === 0) {
				return errorResponse(res, 400, "Validation Error", ["Parent location could not be located."]);
			}
			const cycleCheck = await pool.query(
				`WITH RECURSIVE descendants AS (
					SELECT id FROM storage_locations WHERE user_id = $1 AND id = $2
					UNION ALL
					SELECT sl.id FROM storage_locations sl
					JOIN descendants d ON sl.parent_id = d.id
					WHERE sl.user_id = $1
				)
				SELECT 1 FROM descendants WHERE id = $3 LIMIT 1`,
				[userId, targetId, parentId]
			);
			if (cycleCheck.rows.length > 0) {
				return errorResponse(res, 400, "Validation Error", ["Parent location cannot be a child of this location."]);
			}
		}

		const updateFields = [];
		const params = [userId, targetId];
		let index = 3;

		if (hasName) {
			updateFields.push(`name = $${index++}`);
			params.push(name);
		}
		if (hasParentId) {
			updateFields.push(`parent_id = $${index++}`);
			params.push(parentId);
		}
		if (hasNotes) {
			updateFields.push(`notes = $${index++}`);
			params.push(notes || null);
		}

		const query = `
			UPDATE storage_locations
			SET ${updateFields.join(", ")}, updated_at = NOW()
			WHERE user_id = $1 AND id = $2
			RETURNING id, parent_id, name, notes, created_at, updated_at;
		`;

		const result = await pool.query(query, params);
		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Storage location not found.", ["The requested storage location could not be located."]);
		}

		const row = result.rows[0];
		const pathResult = await pool.query(
			`WITH RECURSIVE location_paths AS (
				SELECT id, user_id, parent_id, name, notes, created_at, updated_at, name::text AS path
				FROM storage_locations
				WHERE user_id = $1 AND parent_id IS NULL
				UNION ALL
				SELECT sl.id, sl.user_id, sl.parent_id, sl.name, sl.notes, sl.created_at, sl.updated_at,
					(lp.path || ' -> ' || sl.name) AS path
				FROM storage_locations sl
				JOIN location_paths lp ON sl.parent_id = lp.id
				WHERE sl.user_id = $1
			)
			SELECT path FROM location_paths WHERE id = $2`,
			[userId, row.id]
		);

		logToFile("STORAGE_LOCATION_UPDATE", {
			status: "SUCCESS",
			user_id: userId,
			location_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Storage location updated successfully.", {
			id: row.id,
			name: row.name,
			parentId: row.parent_id,
			notes: row.notes,
			path: pathResult.rows[0]?.path ?? row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
	} catch (error) {
		if (error.code === "23505") {
			return errorResponse(res, 409, "Storage location already exists.", ["A storage location with this name already exists at the same level."]);
		}
		logToFile("STORAGE_LOCATION_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the storage location."]);
	}
}

// PUT /storagelocation/:id - Update a storage location by id
router.put("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Storage location id must be a valid integer."]);
	}
	return handleStorageLocationUpdate(req, res, id);
});

// PUT /storagelocation - Update a storage location by id or path
router.put("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetPath = normalizeText(req.body?.path);

	if (!Number.isInteger(targetId) && !targetPath) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a storage location id or path to update."]);
	}

	let resolvedId = targetId;
	if (targetPath) {
		const pathId = await resolveLocationPath(userId, targetPath);
		if (!Number.isInteger(pathId)) {
			return errorResponse(res, 404, "Storage location not found.", ["The requested storage location could not be located."]);
		}
		if (Number.isInteger(resolvedId) && resolvedId !== pathId) {
			return errorResponse(res, 400, "Validation Error", ["Storage location id and path must refer to the same record."]);
		}
		resolvedId = pathId;
	}

	if (!Number.isInteger(resolvedId)) {
		return errorResponse(res, 404, "Storage location not found.", ["The requested storage location could not be located."]);
	}

	return handleStorageLocationUpdate(req, res, resolvedId);
});

async function handleStorageLocationDelete(req, res, targetId) {
	const userId = req.user.id;

	try {
		const result = await pool.query(
			`DELETE FROM storage_locations WHERE user_id = $1 AND id = $2 RETURNING id, name`,
			[userId, targetId]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Storage location not found.", ["The requested storage location could not be located."]);
		}

		const row = result.rows[0];
		logToFile("STORAGE_LOCATION_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			location_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Storage location deleted successfully.", { id: row.id, name: row.name });
	} catch (error) {
		logToFile("STORAGE_LOCATION_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the storage location."]);
	}
}

// DELETE /storagelocation/:id - Delete a storage location by id
router.delete("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Storage location id must be a valid integer."]);
	}
	return handleStorageLocationDelete(req, res, id);
});

// DELETE /storagelocation - Delete a storage location by id or path
router.delete("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetPath = normalizeText(req.body?.path);

	if (!Number.isInteger(targetId) && !targetPath) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a storage location id or path to delete."]);
	}

	let resolvedId = targetId;
	if (targetPath) {
		const pathId = await resolveLocationPath(userId, targetPath);
		if (!Number.isInteger(pathId)) {
			return errorResponse(res, 404, "Storage location not found.", ["The requested storage location could not be located."]);
		}
		if (Number.isInteger(resolvedId) && resolvedId !== pathId) {
			return errorResponse(res, 400, "Validation Error", ["Storage location id and path must refer to the same record."]);
		}
		resolvedId = pathId;
	}

	if (!Number.isInteger(resolvedId)) {
		return errorResponse(res, 404, "Storage location not found.", ["The requested storage location could not be located."]);
	}

	return handleStorageLocationDelete(req, res, resolvedId);
});

module.exports = router;
