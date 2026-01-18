const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_LOCATION_NAME_LENGTH = 150;
const MAX_NOTES_LENGTH = 2000;
const MAX_LIST_LIMIT = 200;

//TODO: Base storage locations should not be able to have the same name.
router.use((req, res, next) => {
	logToFile("STORAGELOCATION_REQUEST", {
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
		logToFile("STORAGELOCATION_RESPONSE", {
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

async function fetchStorageLocationStats(userId, locationId) {
	const totalResult = await pool.query(
		`SELECT COUNT(b.id)::int AS count
		 FROM book_copies bc
		 JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
		 WHERE bc.user_id = $1`,
		[userId]
	);
	const totalCopies = totalResult.rows[0]?.count ?? 0;
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
		),
		location_tree AS (
			SELECT id AS ancestor_id, id AS descendant_id
			FROM storage_locations
			WHERE user_id = $1
			UNION ALL
			SELECT lt.ancestor_id, sl.id
			FROM location_tree lt
			JOIN storage_locations sl ON sl.parent_id = lt.descendant_id
			WHERE sl.user_id = $1
		),
		copy_counts AS (
			SELECT lt.ancestor_id, COUNT(b.id)::int AS nested_copy_count
			FROM location_tree lt
			LEFT JOIN book_copies bc ON bc.storage_location_id = lt.descendant_id AND bc.user_id = $1
			LEFT JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
			GROUP BY lt.ancestor_id
		),
		direct_counts AS (
			SELECT sl.id, COUNT(b.id)::int AS direct_copy_count
			FROM storage_locations sl
			LEFT JOIN book_copies bc ON bc.storage_location_id = sl.id AND bc.user_id = $1
			LEFT JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
			WHERE sl.user_id = $1
			GROUP BY sl.id
		)
		SELECT lp.path,
		       COALESCE(dc.direct_copy_count, 0)::int AS direct_copy_count,
		       COALESCE(cc.nested_copy_count, 0)::int AS nested_copy_count
		FROM location_paths lp
		LEFT JOIN direct_counts dc ON dc.id = lp.id
		LEFT JOIN copy_counts cc ON cc.ancestor_id = lp.id
		WHERE lp.id = $2
		LIMIT 1`,
		[userId, locationId]
	);
	const row = result.rows[0] || { direct_copy_count: 0, nested_copy_count: 0, path: null };
	const childResult = await pool.query(
		`SELECT COUNT(*)::int AS count
		 FROM storage_locations
		 WHERE user_id = $1 AND parent_id = $2`,
		[userId, locationId]
	);
	return {
		path: row.path,
		directCopyCount: row.direct_copy_count,
		nestedCopyCount: row.nested_copy_count,
		directPercentage: totalCopies > 0 ? Number(((row.direct_copy_count / totalCopies) * 100).toFixed(1)) : 0,
		nestedPercentage: totalCopies > 0 ? Number(((row.nested_copy_count / totalCopies) * 100).toFixed(1)) : 0,
		childLocations: childResult.rows[0]?.count ?? 0
	};
}

async function listStorageLocationsHandler(req, res) {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly) ?? false;
	const includeCounts = parseBooleanFlag(listParams.includeCounts) ?? false;

	const errors = [];
	const sortFields = {
		id: "lp.id",
		name: "lp.name",
		path: "lp.path",
		parentId: "lp.parent_id",
		notes: "lp.notes",
		createdAt: "lp.created_at",
		updatedAt: "lp.updated_at"
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
		const { ids, error } = parseIdArray(listParams.filterId, "filterId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterIdMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`lp.id = ANY($${paramIndex++}::int[])`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`lp.id = $${paramIndex++}`);
					values.push(id);
				});
			}
		}
	}

	const filterName = normalizeText(listParams.filterName);
	if (filterName) {
		filters.push(`lp.name ILIKE $${paramIndex++}`);
		values.push(`%${filterName}%`);
	}

	if (listParams.filterParentId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterParentId, "filterParentId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterParentMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`lp.parent_id = ANY($${paramIndex++}::int[])`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`lp.parent_id = $${paramIndex++}`);
					values.push(id);
				});
			}
		}
	}

	const filterRootOnly = parseBooleanFlag(listParams.filterRootOnly);
	if (filterRootOnly === true) {
		filters.push("lp.parent_id IS NULL");
	}

	const filterPath = normalizeText(listParams.filterPath);
	if (filterPath) {
		filters.push(`lp.path = $${paramIndex++}`);
		values.push(filterPath);
	}

	const filterPathContains = normalizeText(listParams.filterPathContains);
	if (filterPathContains) {
		filters.push(`lp.path ILIKE $${paramIndex++}`);
		values.push(`%${filterPathContains}%`);
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const fields = nameOnly
			? "lp.id, lp.name, lp.path"
			: "lp.id, lp.parent_id, lp.name, lp.notes, lp.created_at, lp.updated_at, lp.path";

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
		)`;

		if (includeCounts && !nameOnly) {
			query += `,
			location_tree AS (
				SELECT id AS ancestor_id, id AS descendant_id
				FROM storage_locations
				WHERE user_id = $1
				UNION ALL
				SELECT lt.ancestor_id, sl.id
				FROM location_tree lt
				JOIN storage_locations sl ON sl.parent_id = lt.descendant_id
				WHERE sl.user_id = $1
			),
			direct_counts AS (
				SELECT sl.id, COUNT(b.id)::int AS direct_copy_count
				FROM storage_locations sl
				LEFT JOIN book_copies bc ON bc.storage_location_id = sl.id AND bc.user_id = sl.user_id
				LEFT JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
				WHERE sl.user_id = $1
				GROUP BY sl.id
			),
			nested_counts AS (
				SELECT lt.ancestor_id, COUNT(b.id)::int AS nested_copy_count
				FROM location_tree lt
				LEFT JOIN book_copies bc ON bc.storage_location_id = lt.descendant_id AND bc.user_id = $1
				LEFT JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
				GROUP BY lt.ancestor_id
			),
			child_counts AS (
				SELECT parent_id AS id, COUNT(*)::int AS child_count
				FROM storage_locations
				WHERE user_id = $1 AND parent_id IS NOT NULL
				GROUP BY parent_id
			)`;
		}

		query += `
		SELECT ${fields}`;
		if (includeCounts && !nameOnly) {
			query += `,
			       COALESCE(cc.child_count, 0)::int AS child_count,
			       COALESCE(dc.direct_copy_count, 0)::int AS direct_copy_count,
			       COALESCE(nc.nested_copy_count, 0)::int AS nested_copy_count`;
		}
		query += `
		FROM location_paths lp`;

		if (includeCounts && !nameOnly) {
			query += `
		LEFT JOIN child_counts cc ON cc.id = lp.id
		LEFT JOIN direct_counts dc ON dc.id = lp.id
		LEFT JOIN nested_counts nc ON nc.ancestor_id = lp.id`;
		}

		query += `
		WHERE lp.user_id = $1`;

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
		const payload = result.rows.map((row) => {
			const base = buildLocationPayload(row, nameOnly);
			if (includeCounts && !nameOnly) {
				base.childrenCount = row.child_count ?? 0;
				base.booksDirectCount = row.direct_copy_count ?? 0;
				base.booksTotalCount = row.nested_copy_count ?? 0;
			}
			return base;
		});

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
}

// GET /storagelocation - List or fetch a specific storage location
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly) ?? false;
	const returnStats = parseBooleanFlag(listParams.returnStats);
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
			if (returnStats) {
				payload.stats = await fetchStorageLocationStats(userId, result.rows[0].id);
			}
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
		filters.push(`name ILIKE $${paramIndex++}`);
		values.push(`%${filterName}%`);
	}

	if (listParams.filterParentId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterParentId, "filterParentId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterParentMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`parent_id = ANY($${paramIndex++}::int[])`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`parent_id = $${paramIndex++}`);
					values.push(id);
				});
			}
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

// POST /storagelocation/list - List storage locations with JSON body (tree-friendly)
router.post("/list", requiresAuth, authenticatedLimiter, async (req, res) => {
	return listStorageLocationsHandler(req, res);
});

// GET /storagelocation/:id/bookcopies - List book copies stored in a location (recursive optional)
async function handleBookCopiesByLocation(req, res, { locationId, locationPath }) {
	const userId = req.user.id;
	const recursive = parseBooleanFlag(req.query.recursive ?? req.body?.recursive) ?? true;

	if (!Number.isInteger(locationId) && !locationPath) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a storage location id or path."]);
	}

	try {
		let resolvedId = locationId;
		if (locationPath) {
			const pathId = await resolveLocationPath(userId, locationPath);
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

		const idsResult = await pool.query(locationIdsQuery, [userId, resolvedId]);
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
			locationId: resolvedId,
			locationPath: locationPath || null,
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
}

router.get("/:id/bookcopies", requiresAuth, authenticatedLimiter, async (req, res) => {
	const locationId = parseId(req.params.id);
	const locationPath = normalizeText(req.query.path ?? req.body?.path);

	if (!Number.isInteger(locationId)) {
		return errorResponse(res, 400, "Validation Error", ["Storage location id must be a valid integer."]);
	}

	return handleBookCopiesByLocation(req, res, { locationId, locationPath });
});

// GET /storagelocation/bookcopies - List book copies by location id or path (JSON body preferred)
router.get("/bookcopies", requiresAuth, authenticatedLimiter, async (req, res) => {
	const locationId = parseId(req.body?.id ?? req.query.id);
	const locationPath = normalizeText(req.body?.path ?? req.query.path);

	return handleBookCopiesByLocation(req, res, { locationId, locationPath });
});

// GET /storagelocation/stats - Storage location statistics
router.get("/stats", requiresAuth, statsLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => normalizeText(field)).filter(Boolean)
		: [];
	const { value: emptyLimit, error: emptyLimitError } = parseOptionalInt(params.emptyLimit, "emptyLimit", { min: 1, max: MAX_LIST_LIMIT });
	const { value: emptyOffset, error: emptyOffsetError } = parseOptionalInt(params.emptyOffset, "emptyOffset", { min: 0 });

	const availableFields = new Set([
		"totalLocations",
		"maxDepth",
		"largestLocation",
		"emptyLocations",
		"locationDistribution",
		"mostCrowdedBranch",
		"breakdownPerLocation"
	]);
	const selected = fields.length > 0 ? fields : Array.from(availableFields);
	const invalid = selected.filter((field) => !availableFields.has(field));
	const limitErrors = [emptyLimitError, emptyOffsetError].filter(Boolean);
	if (limitErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", limitErrors);
	}
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}

	try {
		const payload = {};
		let totalCopies = null;
		if (selected.includes("breakdownPerLocation")) {
			const totalResult = await pool.query(
				`SELECT COUNT(b.id)::int AS count
				 FROM book_copies bc
				 JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
				 WHERE bc.user_id = $1`,
				[userId]
			);
			totalCopies = totalResult.rows[0]?.count ?? 0;
		}
		const needsPaths = selected.some((field) =>
			["largestLocation", "emptyLocations", "locationDistribution", "mostCrowdedBranch"].includes(field)
		);
		const needsTree = selected.some((field) =>
			["maxDepth", "locationDistribution", "mostCrowdedBranch"].includes(field)
		);

		let pathRows = [];
		if (needsPaths) {
			const pathResult = await pool.query(
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
				SELECT id, parent_id, path
				FROM location_paths`,
				[userId]
			);
			pathRows = pathResult.rows;
		}

		if (selected.includes("totalLocations")) {
			const totalResult = await pool.query(
				`SELECT COUNT(*)::int AS count FROM storage_locations WHERE user_id = $1`,
				[userId]
			);
			payload.totalLocations = totalResult.rows[0]?.count ?? 0;
		}

		if (selected.includes("maxDepth")) {
			const depthResult = await pool.query(
				`WITH RECURSIVE location_tree AS (
					SELECT id, parent_id, 1 AS depth
					FROM storage_locations
					WHERE user_id = $1 AND parent_id IS NULL
					UNION ALL
					SELECT sl.id, sl.parent_id, lt.depth + 1
					FROM storage_locations sl
					JOIN location_tree lt ON sl.parent_id = lt.id
					WHERE sl.user_id = $1
				)
				SELECT COALESCE(MAX(depth), 0) AS max_depth
				FROM location_tree`,
				[userId]
			);
			payload.maxDepth = Number(depthResult.rows[0]?.max_depth ?? 0);
		}

		if (selected.includes("largestLocation")) {
			const largestResult = await pool.query(
				`SELECT sl.id, sl.name, sl.parent_id,
				        COUNT(b.id)::int AS direct_copy_count
				 FROM storage_locations sl
				 LEFT JOIN book_copies bc ON bc.storage_location_id = sl.id AND bc.user_id = sl.user_id
				 LEFT JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
				 WHERE sl.user_id = $1
				 GROUP BY sl.id, sl.name, sl.parent_id
				 ORDER BY direct_copy_count DESC, sl.name ASC
				 LIMIT 1`,
				[userId]
			);
			const row = largestResult.rows[0];
			const path = row && pathRows.length > 0
				? pathRows.find((entry) => entry.id === row.id)?.path ?? row.name
				: null;
			payload.largestLocation = row
				? {
					id: row.id,
					name: row.name,
					path,
					directCopyCount: row.direct_copy_count
				}
				: null;
		}

		if (selected.includes("emptyLocations")) {
			const limitValue = emptyLimit ?? 50;
			const offsetValue = emptyOffset ?? 0;
			const emptyResult = await pool.query(
				`SELECT sl.id, sl.name, sl.parent_id,
				        COUNT(b.id)::int AS direct_copy_count
				 FROM storage_locations sl
				 LEFT JOIN book_copies bc ON bc.storage_location_id = sl.id AND bc.user_id = sl.user_id
				 LEFT JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
				 WHERE sl.user_id = $1
				 GROUP BY sl.id, sl.name, sl.parent_id
				 HAVING COUNT(b.id) = 0
				 ORDER BY sl.name ASC
				 LIMIT $2 OFFSET $3`,
				[userId, limitValue, offsetValue]
			);
			payload.emptyLocations = emptyResult.rows.map((row) => ({
				id: row.id,
				name: row.name,
				path: pathRows.find((entry) => entry.id === row.id)?.path ?? row.name,
				directCopyCount: row.direct_copy_count
			}));
		}

		if (selected.includes("breakdownPerLocation")) {
			const breakdownResult = await pool.query(
				`WITH RECURSIVE location_paths AS (
					SELECT id, parent_id, name, name::text AS path
					FROM storage_locations
					WHERE user_id = $1 AND parent_id IS NULL
					UNION ALL
					SELECT sl.id, sl.parent_id, sl.name, (lp.path || ' -> ' || sl.name) AS path
					FROM storage_locations sl
					JOIN location_paths lp ON sl.parent_id = lp.id
					WHERE sl.user_id = $1
				),
				location_tree AS (
					SELECT id AS ancestor_id, id AS descendant_id
					FROM storage_locations
					WHERE user_id = $1
					UNION ALL
					SELECT lt.ancestor_id, sl.id
					FROM location_tree lt
					JOIN storage_locations sl ON sl.parent_id = lt.descendant_id
					WHERE sl.user_id = $1
				),
				copy_counts AS (
					SELECT lt.ancestor_id, COUNT(b.id)::int AS nested_copy_count
					FROM location_tree lt
					LEFT JOIN book_copies bc ON bc.storage_location_id = lt.descendant_id AND bc.user_id = $1
					LEFT JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
					GROUP BY lt.ancestor_id
				),
				direct_counts AS (
					SELECT sl.id, COUNT(b.id)::int AS direct_copy_count
					FROM storage_locations sl
					LEFT JOIN book_copies bc ON bc.storage_location_id = sl.id AND bc.user_id = $1
					LEFT JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
					WHERE sl.user_id = $1
					GROUP BY sl.id
				)
				SELECT lp.id, lp.path,
				       COALESCE(dc.direct_copy_count, 0)::int AS direct_copy_count,
				       COALESCE(cc.nested_copy_count, 0)::int AS nested_copy_count
				FROM location_paths lp
				LEFT JOIN direct_counts dc ON dc.id = lp.id
				LEFT JOIN copy_counts cc ON cc.ancestor_id = lp.id
				ORDER BY lp.path ASC`,
				[userId]
			);
			payload.breakdownPerLocation = breakdownResult.rows.map((row) => ({
				id: row.id,
				path: row.path,
				directCopyCount: row.direct_copy_count,
				nestedCopyCount: row.nested_copy_count,
				directPercentage: totalCopies > 0 ? Number(((row.direct_copy_count / totalCopies) * 100).toFixed(1)) : 0,
				nestedPercentage: totalCopies > 0 ? Number(((row.nested_copy_count / totalCopies) * 100).toFixed(1)) : 0
			}));
		}

		if (selected.includes("locationDistribution") || selected.includes("mostCrowdedBranch")) {
			const distributionResult = await pool.query(
				`WITH RECURSIVE top_level AS (
					SELECT id, name
					FROM storage_locations
					WHERE user_id = $1 AND parent_id IS NULL
				),
				location_tree AS (
					SELECT tl.id AS root_id, tl.id AS descendant_id
					FROM top_level tl
					UNION ALL
					SELECT lt.root_id, sl.id
					FROM location_tree lt
					JOIN storage_locations sl ON sl.parent_id = lt.descendant_id
					WHERE sl.user_id = $1
				),
				copy_counts AS (
					SELECT lt.root_id, COUNT(b.id)::int AS copy_count
					FROM location_tree lt
					LEFT JOIN book_copies bc ON bc.storage_location_id = lt.descendant_id AND bc.user_id = $1
					LEFT JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
					GROUP BY lt.root_id
				),
				total AS (
					SELECT SUM(copy_count)::int AS total_copies FROM copy_counts
				)
				SELECT tl.id, tl.name, COALESCE(cc.copy_count, 0)::int AS copy_count,
				       (SELECT total_copies FROM total) AS total_copies
				FROM top_level tl
				LEFT JOIN copy_counts cc ON cc.root_id = tl.id
				ORDER BY tl.name ASC`,
				[userId]
			);

			const totalBranchCopies = distributionResult.rows[0]?.total_copies ?? 0;
			if (totalCopies === null) {
				totalCopies = totalBranchCopies;
			}
			if (selected.includes("locationDistribution")) {
				payload.locationDistribution = distributionResult.rows.map((row) => ({
					id: row.id,
					name: row.name,
					copyCount: row.copy_count,
					percentage: totalBranchCopies > 0 ? Number(((row.copy_count / totalBranchCopies) * 100).toFixed(1)) : 0
				}));
			}

			if (selected.includes("mostCrowdedBranch")) {
				const top = distributionResult.rows.reduce((acc, row) => {
					if (!acc || row.copy_count > acc.copy_count) {
						return row;
					}
					return acc;
				}, null);
				payload.mostCrowdedBranch = top
					? {
						id: top.id,
						name: top.name,
						copyCount: top.copy_count,
						percentage: totalBranchCopies > 0 ? Number(((top.copy_count / totalBranchCopies) * 100).toFixed(1)) : 0
					}
					: null;
			}
		}

		return successResponse(res, 200, "Storage location stats retrieved successfully.", { stats: payload });
	} catch (error) {
		logToFile("STORAGE_LOCATION_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve storage location stats at this time."]);
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

		if (!Number.isInteger(parentId)) {
			const duplicateBase = await pool.query(
				`SELECT id FROM storage_locations
				 WHERE user_id = $1 AND parent_id IS NULL AND LOWER(name) = LOWER($2)
				 LIMIT 1`,
				[userId, name]
			);
			if (duplicateBase.rows.length > 0) {
				return errorResponse(res, 409, "Storage location already exists.", ["A base storage location with this name already exists."]);
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
		const currentResult = await pool.query(
			`SELECT id, name, parent_id FROM storage_locations WHERE user_id = $1 AND id = $2`,
			[userId, targetId]
		);
		if (currentResult.rows.length === 0) {
			return errorResponse(res, 404, "Storage location not found.", ["The requested storage location could not be located."]);
		}
		const current = currentResult.rows[0];

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

		const effectiveName = hasName ? name : current.name;
		const effectiveParentId = hasParentId ? parentId : current.parent_id;
		if (effectiveParentId === null || effectiveParentId === undefined) {
			const duplicateBase = await pool.query(
				`SELECT id FROM storage_locations
				 WHERE user_id = $1 AND parent_id IS NULL AND LOWER(name) = LOWER($2) AND id <> $3
				 LIMIT 1`,
				[userId, effectiveName, targetId]
			);
			if (duplicateBase.rows.length > 0) {
				return errorResponse(res, 409, "Storage location already exists.", ["A base storage location with this name already exists."]);
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
		const childResult = await pool.query(
			`SELECT COUNT(*)::int AS count
			 FROM storage_locations
			 WHERE user_id = $1 AND parent_id = $2`,
			[userId, targetId]
		);
		const childCount = childResult.rows[0]?.count ?? 0;

		const copyResult = await pool.query(
			`WITH RECURSIVE location_tree AS (
				SELECT id FROM storage_locations WHERE user_id = $1 AND id = $2
				UNION ALL
				SELECT sl.id
				FROM storage_locations sl
				JOIN location_tree lt ON sl.parent_id = lt.id
				WHERE sl.user_id = $1
			)
			SELECT COUNT(b.id)::int AS count
			FROM location_tree lt
			LEFT JOIN book_copies bc ON bc.storage_location_id = lt.id AND bc.user_id = $1
			LEFT JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL`,
			[userId, targetId]
		);
		const copyCount = copyResult.rows[0]?.count ?? 0;

		if (childCount > 0 || copyCount > 0) {
			const details = [];
			if (childCount > 0) {
				details.push(`This location has ${childCount} child location${childCount === 1 ? "" : "s"}.`);
			}
			if (copyCount > 0) {
				details.push(`This location contains ${copyCount} book${copyCount === 1 ? "" : "s"} (directly or in sub-locations).`);
			}
			return errorResponse(res, 409, "Storage location cannot be deleted.", details);
		}

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
