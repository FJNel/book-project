const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { validatePartialDateObject } = require("../utils/partial-date");

const MAX_ACQUISITION_STORY_LENGTH = 2000;
const MAX_ACQUIRED_FROM_LENGTH = 255;
const MAX_ACQUISITION_TYPE_LENGTH = 100;
const MAX_ACQUISITION_LOCATION_LENGTH = 255;
const MAX_COPY_NOTES_LENGTH = 2000;
const MAX_LIST_LIMIT = 200;

router.use((req, res, next) => {
	logToFile("BOOKCOPY_REQUEST", {
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
		logToFile("BOOKCOPY_RESPONSE", {
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

function validateOptionalText(value, fieldLabel, maxLength) {
	const errors = [];
	if (value === undefined || value === null || value === "") {
		return errors;
	}
	if (typeof value !== "string") {
		errors.push(`${fieldLabel} must be a string.`);
		return errors;
	}
	if (value.trim().length > maxLength) {
		errors.push(`${fieldLabel} must be ${maxLength} characters or fewer.`);
	}
	return errors;
}

function validateBookCopyPayload(input) {
	const errors = [];
	if (input === undefined || input === null) {
		return { errors, normalized: null };
	}
	if (typeof input !== "object" || Array.isArray(input)) {
		return { errors: ["Book copy must be an object."], normalized: null };
	}

	const storageLocationIdRaw = input.storageLocationId;
	const storageLocationPathRaw = input.storageLocationPath;
	const storageLocationId = storageLocationIdRaw !== undefined ? parseId(storageLocationIdRaw) : null;
	const storageLocationPath = normalizeOptionalText(storageLocationPathRaw);

	if (storageLocationIdRaw !== undefined && !Number.isInteger(storageLocationId)) {
		errors.push("Storage location id must be a valid integer.");
	}
	if (storageLocationPathRaw !== undefined && storageLocationPathRaw !== null && typeof storageLocationPathRaw !== "string") {
		errors.push("Storage location path must be a string.");
	} else if (storageLocationPathRaw !== undefined && !storageLocationPath) {
		errors.push("Storage location path must be a non-empty string.");
	}

	errors.push(...validateOptionalText(input.acquisitionStory, "Acquisition story", MAX_ACQUISITION_STORY_LENGTH));
	errors.push(...validatePartialDateObject(input.acquisitionDate, "Acquisition date"));
	errors.push(...validateOptionalText(input.acquiredFrom, "Acquired from", MAX_ACQUIRED_FROM_LENGTH));
	errors.push(...validateOptionalText(input.acquisitionType, "Acquisition type", MAX_ACQUISITION_TYPE_LENGTH));
	errors.push(...validateOptionalText(input.acquisitionLocation, "Acquisition location", MAX_ACQUISITION_LOCATION_LENGTH));
	errors.push(...validateOptionalText(input.notes, "Notes", MAX_COPY_NOTES_LENGTH));

	const normalized = {
		storageLocationId,
		storageLocationPath,
		acquisitionStory: normalizeOptionalText(input.acquisitionStory),
		acquisitionDate: input.acquisitionDate ?? null,
		acquiredFrom: normalizeOptionalText(input.acquiredFrom),
		acquisitionType: normalizeOptionalText(input.acquisitionType),
		acquisitionLocation: normalizeOptionalText(input.acquisitionLocation),
		notes: normalizeOptionalText(input.notes)
	};

	return { errors, normalized };
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

async function resolveStorageLocationId(client, userId, { id, path }) {
	let resolvedId = null;
	if (Number.isInteger(id)) {
		const existing = await client.query(
			`SELECT id FROM storage_locations WHERE user_id = $1 AND id = $2`,
			[userId, id]
		);
		if (existing.rows.length === 0) {
			return { error: "Storage location not found." };
		}
		resolvedId = id;
	}

	if (path) {
		const result = await client.query(
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
			SELECT id FROM location_paths WHERE path = $2 LIMIT 1`,
			[userId, path]
		);
		if (result.rows.length === 0) {
			return { error: "Storage location path not found." };
		}
		const pathId = result.rows[0].id;
		if (resolvedId && resolvedId !== pathId) {
			return { error: "Storage location id and path do not match." };
		}
		resolvedId = pathId;
	}

	return { id: resolvedId };
}

function buildBookCopyPayload(row) {
	return {
		id: row.id,
		bookId: row.book_id,
		bookTitle: row.book_title,
		bookIsbn: row.book_isbn,
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
	};
}

async function fetchBookCopyStats(userId, copyRow) {
	const countResult = await pool.query(
		`SELECT COUNT(*)::int AS count
		 FROM book_copies
		 WHERE user_id = $1 AND book_id = $2`,
		[userId, copyRow.book_id]
	);
	const totalCopiesForBook = countResult.rows[0]?.count ?? 0;
	const hasStorageLocation = Number.isInteger(copyRow.storage_location_id);
	const hasAcquisitionStory = Boolean(copyRow.acquisition_story && String(copyRow.acquisition_story).trim());
	const hasAcquisitionDate = Number.isInteger(copyRow.acquisition_date_id);
	const hasAcquiredFrom = Boolean(copyRow.acquired_from && String(copyRow.acquired_from).trim());
	const hasAcquisitionType = Boolean(copyRow.acquisition_type && String(copyRow.acquisition_type).trim());
	const hasAcquisitionLocation = Boolean(copyRow.acquisition_location && String(copyRow.acquisition_location).trim());
	const isMysteryCopy = !hasAcquisitionDate || !hasAcquiredFrom || !hasAcquisitionType || !hasAcquisitionLocation;

	return {
		copiesForBook: totalCopiesForBook,
		duplicateCount: Math.max(totalCopiesForBook - 1, 0),
		isDuplicate: totalCopiesForBook > 1,
		hasStorageLocation,
		hasAcquisitionStory,
		hasAcquisitionDate,
		hasAcquiredFrom,
		hasAcquisitionType,
		hasAcquisitionLocation,
		isMysteryCopy
	};
}

async function resolveLocationFilterIds(userId, { locationId, locationPath, includeNested }) {
	let resolvedId = locationId;
	if (!Number.isInteger(resolvedId) && locationPath) {
		resolvedId = await resolveLocationPath(userId, locationPath);
	}
	if (!Number.isInteger(resolvedId)) {
		return { error: "Storage location could not be located." };
	}

	if (!includeNested) {
		return { ids: [resolvedId] };
	}

	const result = await pool.query(
		`WITH RECURSIVE descendants AS (
			SELECT id FROM storage_locations WHERE user_id = $1 AND id = $2
			UNION ALL
			SELECT sl.id FROM storage_locations sl
			JOIN descendants d ON sl.parent_id = d.id
			WHERE sl.user_id = $1
		)
		SELECT id FROM descendants`,
		[userId, resolvedId]
	);

	return { ids: result.rows.map((row) => row.id) };
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

// GET /bookcopy - List or fetch a specific book copy
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const returnStats = parseBooleanFlag(listParams.returnStats);
	const targetId = parseId(req.query.id ?? req.body?.id);

	if (targetId !== null) {
		try {
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
				SELECT bc.id, bc.book_id, b.title AS book_title, b.isbn AS book_isbn,
					bc.storage_location_id, bc.acquisition_story, bc.acquisition_date_id, bc.acquired_from,
					bc.acquisition_type, bc.acquisition_location, bc.notes, bc.created_at, bc.updated_at,
					d.day AS acq_day, d.month AS acq_month, d.year AS acq_year, d.text AS acq_text,
					lp.path AS storage_location_path
				FROM book_copies bc
				JOIN books b ON bc.book_id = b.id
				LEFT JOIN dates d ON bc.acquisition_date_id = d.id
				LEFT JOIN location_paths lp ON bc.storage_location_id = lp.id
				WHERE bc.user_id = $1 AND bc.id = $2
				LIMIT 1`,
				[userId, targetId]
			);

			if (result.rows.length === 0) {
				return errorResponse(res, 404, "Book copy not found.", ["The requested book copy could not be located."]);
			}

			const payload = buildBookCopyPayload(result.rows[0]);
			if (returnStats) {
				payload.stats = await fetchBookCopyStats(userId, result.rows[0]);
			}
			return successResponse(res, 200, "Book copy retrieved successfully.", payload);
		} catch (error) {
			logToFile("BOOK_COPY_GET", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the book copy."]);
		}
	}

	const errors = [];
	const sortFields = {
		id: "bc.id",
		bookId: "bc.book_id",
		storageLocationId: "bc.storage_location_id",
		acquisitionStory: "bc.acquisition_story",
		acquisitionDateId: "bc.acquisition_date_id",
		acquiredFrom: "bc.acquired_from",
		acquisitionType: "bc.acquisition_type",
		acquisitionLocation: "bc.acquisition_location",
		notes: "bc.notes",
		createdAt: "bc.created_at",
		updatedAt: "bc.updated_at",
		acquisitionDay: "d.day",
		acquisitionMonth: "d.month",
		acquisitionYear: "d.year",
		acquisitionText: "d.text",
		acquisitionDate: "acq_sort"
	};

	const sortBy = normalizeText(listParams.sortBy) || "createdAt";
	const sortColumn = sortFields[sortBy];
	if (!sortColumn) {
		errors.push("sortBy must be one of: id, bookId, storageLocationId, acquisitionStory, acquisitionDateId, acquiredFrom, acquisitionType, acquisitionLocation, notes, createdAt, updatedAt, acquisitionDay, acquisitionMonth, acquisitionYear, acquisitionText, acquisitionDate.");
	}

	const order = parseSortOrder(listParams.order);
	if (!order) {
		errors.push("order must be either asc or desc.");
	}

	const { value: limit, error: limitError } = parseOptionalInt(listParams.limit, "limit", { min: 1, max: MAX_LIST_LIMIT });
	if (limitError) errors.push(limitError);
	const { value: offset, error: offsetError } = parseOptionalInt(listParams.offset, "offset", { min: 0 });
	if (offsetError) errors.push(offsetError);

	let locationIds = null;
	const filterLocationId = parseId(listParams.filterStorageLocationId);
	const filterLocationPath = normalizeText(listParams.filterStorageLocationPath);
	if (listParams.filterStorageLocationId !== undefined || filterLocationPath) {
		if (listParams.filterStorageLocationId !== undefined && !Number.isInteger(filterLocationId)) {
			errors.push("filterStorageLocationId must be a valid integer.");
		} else if (filterLocationPath && !filterLocationId) {
			const includeNested = parseBooleanFlag(listParams.includeNested);
			const resolved = await resolveLocationFilterIds(userId, {
				locationId: null,
				locationPath: filterLocationPath,
				includeNested: includeNested === null ? true : includeNested
			});
			if (resolved.error) {
				errors.push(resolved.error);
			} else {
				locationIds = resolved.ids;
			}
		} else if (Number.isInteger(filterLocationId)) {
			const includeNested = parseBooleanFlag(listParams.includeNested);
			const resolved = await resolveLocationFilterIds(userId, {
				locationId: filterLocationId,
				locationPath: filterLocationPath || null,
				includeNested: includeNested === null ? true : includeNested
			});
			if (resolved.error) {
				errors.push(resolved.error);
			} else {
				locationIds = resolved.ids;
			}
		}
	}

	const filters = [];
	const values = [userId];
	let paramIndex = 2;

	if (listParams.filterId !== undefined) {
		const filterId = parseId(listParams.filterId);
		if (!Number.isInteger(filterId)) {
			errors.push("filterId must be a valid integer.");
		} else {
			filters.push(`bc.id = $${paramIndex++}`);
			values.push(filterId);
		}
	}

	if (listParams.filterBookId !== undefined) {
		const filterBookId = parseId(listParams.filterBookId);
		if (!Number.isInteger(filterBookId)) {
			errors.push("filterBookId must be a valid integer.");
		} else {
			filters.push(`bc.book_id = $${paramIndex++}`);
			values.push(filterBookId);
		}
	}

	if (locationIds && locationIds.length > 0) {
		filters.push(`bc.storage_location_id = ANY($${paramIndex++}::int[])`);
		values.push(locationIds);
	}

	const filterStory = normalizeText(listParams.filterAcquisitionStory);
	if (filterStory) {
		filters.push(`bc.acquisition_story ILIKE $${paramIndex++}`);
		values.push(`%${filterStory}%`);
	}

	const filterAcquiredFrom = normalizeText(listParams.filterAcquiredFrom);
	if (filterAcquiredFrom) {
		filters.push(`bc.acquired_from ILIKE $${paramIndex++}`);
		values.push(`%${filterAcquiredFrom}%`);
	}

	const filterAcquisitionType = normalizeText(listParams.filterAcquisitionType);
	if (filterAcquisitionType) {
		filters.push(`bc.acquisition_type ILIKE $${paramIndex++}`);
		values.push(`%${filterAcquisitionType}%`);
	}

	const filterAcquisitionLocation = normalizeText(listParams.filterAcquisitionLocation);
	if (filterAcquisitionLocation) {
		filters.push(`bc.acquisition_location ILIKE $${paramIndex++}`);
		values.push(`%${filterAcquisitionLocation}%`);
	}

	const filterNotes = normalizeText(listParams.filterNotes);
	if (filterNotes) {
		filters.push(`bc.notes ILIKE $${paramIndex++}`);
		values.push(`%${filterNotes}%`);
	}

	if (listParams.filterAcquisitionDateId !== undefined) {
		const filterDateId = parseId(listParams.filterAcquisitionDateId);
		if (!Number.isInteger(filterDateId)) {
			errors.push("filterAcquisitionDateId must be a valid integer.");
		} else {
			filters.push(`bc.acquisition_date_id = $${paramIndex++}`);
			values.push(filterDateId);
		}
	}

	const acqDay = parseOptionalInt(listParams.filterAcquisitionDay, "filterAcquisitionDay", { min: 1, max: 31 });
	if (acqDay.error) errors.push(acqDay.error);
	if (acqDay.value !== null) {
		filters.push(`d.day = $${paramIndex++}`);
		values.push(acqDay.value);
	}

	const acqMonth = parseOptionalInt(listParams.filterAcquisitionMonth, "filterAcquisitionMonth", { min: 1, max: 12 });
	if (acqMonth.error) errors.push(acqMonth.error);
	if (acqMonth.value !== null) {
		filters.push(`d.month = $${paramIndex++}`);
		values.push(acqMonth.value);
	}

	const acqYear = parseOptionalInt(listParams.filterAcquisitionYear, "filterAcquisitionYear", { min: 1, max: 9999 });
	if (acqYear.error) errors.push(acqYear.error);
	if (acqYear.value !== null) {
		filters.push(`d.year = $${paramIndex++}`);
		values.push(acqYear.value);
	}

	const acqText = normalizeText(listParams.filterAcquisitionText);
	if (acqText) {
		filters.push(`d.text ILIKE $${paramIndex++}`);
		values.push(`%${acqText}%`);
	}

	const acquiredBefore = parseDateFilter(listParams.filterAcquiredBefore, "filterAcquiredBefore");
	if (acquiredBefore.error) errors.push(acquiredBefore.error);
	if (acquiredBefore.value) {
		filters.push(`acq_sort <= $${paramIndex++}::date`);
		values.push(acquiredBefore.value);
	}

	const acquiredAfter = parseDateFilter(listParams.filterAcquiredAfter, "filterAcquiredAfter");
	if (acquiredAfter.error) errors.push(acquiredAfter.error);
	if (acquiredAfter.value) {
		filters.push(`acq_sort >= $${paramIndex++}::date`);
		values.push(acquiredAfter.value);
	}

	const createdBefore = parseDateFilter(listParams.filterCreatedBefore, "filterCreatedBefore");
	if (createdBefore.error) errors.push(createdBefore.error);
	if (createdBefore.value) {
		filters.push(`bc.created_at <= $${paramIndex++}::timestamptz`);
		values.push(createdBefore.value);
	}

	const createdAfter = parseDateFilter(listParams.filterCreatedAfter, "filterCreatedAfter");
	if (createdAfter.error) errors.push(createdAfter.error);
	if (createdAfter.value) {
		filters.push(`bc.created_at >= $${paramIndex++}::timestamptz`);
		values.push(createdAfter.value);
	}

	const updatedBefore = parseDateFilter(listParams.filterUpdatedBefore, "filterUpdatedBefore");
	if (updatedBefore.error) errors.push(updatedBefore.error);
	if (updatedBefore.value) {
		filters.push(`bc.updated_at <= $${paramIndex++}::timestamptz`);
		values.push(updatedBefore.value);
	}

	const updatedAfter = parseDateFilter(listParams.filterUpdatedAfter, "filterUpdatedAfter");
	if (updatedAfter.error) errors.push(updatedAfter.error);
	if (updatedAfter.value) {
		filters.push(`bc.updated_at >= $${paramIndex++}::timestamptz`);
		values.push(updatedAfter.value);
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		let query = `WITH RECURSIVE location_paths AS (
			SELECT id, parent_id, name, name::text AS path
			FROM storage_locations
			WHERE user_id = $1 AND parent_id IS NULL
			UNION ALL
			SELECT sl.id, sl.parent_id, sl.name, (lp.path || ' -> ' || sl.name) AS path
			FROM storage_locations sl
			JOIN location_paths lp ON sl.parent_id = lp.id
			WHERE sl.user_id = $1
		)
		SELECT bc.id, bc.book_id, b.title AS book_title, b.isbn AS book_isbn,
			bc.storage_location_id, bc.acquisition_story, bc.acquisition_date_id, bc.acquired_from,
			bc.acquisition_type, bc.acquisition_location, bc.notes, bc.created_at, bc.updated_at,
			d.day AS acq_day, d.month AS acq_month, d.year AS acq_year, d.text AS acq_text,
			lp.path AS storage_location_path,
			CASE WHEN d.year IS NULL THEN NULL ELSE make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1)) END AS acq_sort
		FROM book_copies bc
		JOIN books b ON bc.book_id = b.id
		LEFT JOIN dates d ON bc.acquisition_date_id = d.id
		LEFT JOIN location_paths lp ON bc.storage_location_id = lp.id
		WHERE bc.user_id = $1`;

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
		const payload = result.rows.map(buildBookCopyPayload);

		logToFile("BOOK_COPY_LIST", {
			status: "SUCCESS",
			user_id: userId,
			count: payload.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Book copies retrieved successfully.", { bookCopies: payload });
	} catch (error) {
		logToFile("BOOK_COPY_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving book copies."]);
	}
});

// GET /bookcopy/stats - Book copy statistics
router.get("/stats", requiresAuth, statsLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => normalizeText(field)).filter(Boolean)
		: [];

	const availableFields = new Set([
		"totalCopies",
		"uniqueBooks",
		"duplicateCopies",
		"uniqueVsDuplicate",
		"mostDuplicatedBook",
		"storageCoverage",
		"acquisitionTimeline",
		"acquiredFromBreakdown",
		"topAcquisitionType",
		"topAcquisitionLocation",
		"storyRichCopies",
		"mysteryCopies"
	]);

	const selected = fields.length > 0 ? fields : Array.from(availableFields);
	const invalid = selected.filter((field) => !availableFields.has(field));
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}

	const { value: breakdownLimit, error: breakdownLimitError } = parseOptionalInt(params.breakdownLimit, "breakdownLimit", { min: 1, max: MAX_LIST_LIMIT });
	if (breakdownLimitError) {
		return errorResponse(res, 400, "Validation Error", [breakdownLimitError]);
	}
	const limitValue = breakdownLimit ?? 50;

	try {
		const payload = {};

		const totalResult = await pool.query(
			`SELECT COUNT(*)::int AS total_copies,
			        COUNT(DISTINCT bc.book_id)::int AS unique_books,
			        COUNT(*) FILTER (WHERE bc.storage_location_id IS NOT NULL)::int AS with_storage,
			        COUNT(*) FILTER (WHERE bc.acquisition_story IS NOT NULL AND TRIM(bc.acquisition_story) <> '')::int AS with_story,
			        COUNT(*) FILTER (
			          WHERE bc.acquisition_date_id IS NULL
			             OR bc.acquired_from IS NULL OR TRIM(bc.acquired_from) = ''
			             OR bc.acquisition_type IS NULL OR TRIM(bc.acquisition_type) = ''
			             OR bc.acquisition_location IS NULL OR TRIM(bc.acquisition_location) = ''
			        )::int AS mystery_count
			 FROM book_copies bc
			 JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
			 WHERE bc.user_id = $1`,
			[userId]
		);
		const totals = totalResult.rows[0] || {};
		const totalCopies = totals.total_copies ?? 0;
		const uniqueBooks = totals.unique_books ?? 0;
		const duplicateCopies = totalCopies - uniqueBooks;

		if (selected.includes("totalCopies")) payload.totalCopies = totalCopies;
		if (selected.includes("uniqueBooks")) payload.uniqueBooks = uniqueBooks;
		if (selected.includes("duplicateCopies")) payload.duplicateCopies = duplicateCopies;
		if (selected.includes("uniqueVsDuplicate")) {
			payload.uniqueVsDuplicate = {
				uniqueBooks,
				duplicateCopies,
				uniqueBooksPercentage: totalCopies > 0 ? Number(((uniqueBooks / totalCopies) * 100).toFixed(1)) : 0,
				duplicateCopiesPercentage: totalCopies > 0 ? Number(((duplicateCopies / totalCopies) * 100).toFixed(1)) : 0
			};
		}

		if (selected.includes("storageCoverage")) {
			payload.storageCoverage = {
				withStorageLocation: totals.with_storage ?? 0,
				totalCopies,
				percentage: totalCopies > 0 ? Number(((totals.with_storage ?? 0) / totalCopies * 100).toFixed(1)) : 0
			};
		}

		if (selected.includes("storyRichCopies")) {
			payload.storyRichCopies = {
				count: totals.with_story ?? 0,
				percentage: totalCopies > 0 ? Number(((totals.with_story ?? 0) / totalCopies * 100).toFixed(1)) : 0
			};
		}

		if (selected.includes("mysteryCopies")) {
			payload.mysteryCopies = {
				count: totals.mystery_count ?? 0,
				percentage: totalCopies > 0 ? Number(((totals.mystery_count ?? 0) / totalCopies * 100).toFixed(1)) : 0
			};
		}

		if (selected.includes("mostDuplicatedBook")) {
			const duplicatedResult = await pool.query(
				`SELECT bc.book_id, b.title, COUNT(*)::int AS copy_count
				 FROM book_copies bc
				 JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
				 WHERE bc.user_id = $1
				 GROUP BY bc.book_id, b.title
				 ORDER BY copy_count DESC, b.title ASC
				 LIMIT 1`,
				[userId]
			);
			const row = duplicatedResult.rows[0];
			payload.mostDuplicatedBook = row
				? {
					bookId: row.book_id,
					title: row.title,
					copyCount: row.copy_count,
					percentageOfCopies: totalCopies > 0 ? Number(((row.copy_count / totalCopies) * 100).toFixed(1)) : 0
				}
				: null;
		}

		if (selected.includes("acquisitionTimeline")) {
			const timelineResult = await pool.query(
				`SELECT d.year::int AS year, d.month::int AS month, COUNT(*)::int AS count
				 FROM book_copies bc
				 JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
				 JOIN dates d ON bc.acquisition_date_id = d.id
				 WHERE bc.user_id = $1 AND d.year IS NOT NULL
				 GROUP BY d.year, d.month
				 ORDER BY d.year ASC, d.month ASC NULLS LAST`,
				[userId]
			);
			payload.acquisitionTimeline = timelineResult.rows.map((row) => ({
				year: row.year,
				month: row.month,
				copyCount: row.count
			}));
		}

		if (selected.includes("acquiredFromBreakdown")) {
			const acquiredResult = await pool.query(
				`SELECT TRIM(bc.acquired_from) AS acquired_from, COUNT(*)::int AS count
				 FROM book_copies bc
				 JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
				 WHERE bc.user_id = $1 AND bc.acquired_from IS NOT NULL AND TRIM(bc.acquired_from) <> ''
				 GROUP BY TRIM(bc.acquired_from)
				 ORDER BY count DESC, acquired_from ASC
				 LIMIT $2`,
				[userId, limitValue]
			);
			payload.acquiredFromBreakdown = acquiredResult.rows.map((row) => ({
				value: row.acquired_from,
				count: row.count,
				percentage: totalCopies > 0 ? Number(((row.count / totalCopies) * 100).toFixed(1)) : 0
			}));
		}

		if (selected.includes("topAcquisitionType")) {
			const typeResult = await pool.query(
				`SELECT TRIM(bc.acquisition_type) AS acquisition_type, COUNT(*)::int AS count
				 FROM book_copies bc
				 JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
				 WHERE bc.user_id = $1 AND bc.acquisition_type IS NOT NULL AND TRIM(bc.acquisition_type) <> ''
				 GROUP BY TRIM(bc.acquisition_type)
				 ORDER BY count DESC, acquisition_type ASC
				 LIMIT 1`,
				[userId]
			);
			const row = typeResult.rows[0];
			payload.topAcquisitionType = row
				? {
					value: row.acquisition_type,
					count: row.count,
					percentage: totalCopies > 0 ? Number(((row.count / totalCopies) * 100).toFixed(1)) : 0
				}
				: null;
		}

		if (selected.includes("topAcquisitionLocation")) {
			const locationResult = await pool.query(
				`SELECT TRIM(bc.acquisition_location) AS acquisition_location, COUNT(*)::int AS count
				 FROM book_copies bc
				 JOIN books b ON b.id = bc.book_id AND b.deleted_at IS NULL
				 WHERE bc.user_id = $1 AND bc.acquisition_location IS NOT NULL AND TRIM(bc.acquisition_location) <> ''
				 GROUP BY TRIM(bc.acquisition_location)
				 ORDER BY count DESC, acquisition_location ASC
				 LIMIT 1`,
				[userId]
			);
			const row = locationResult.rows[0];
			payload.topAcquisitionLocation = row
				? {
					value: row.acquisition_location,
					count: row.count,
					percentage: totalCopies > 0 ? Number(((row.count / totalCopies) * 100).toFixed(1)) : 0
				}
				: null;
		}

		return successResponse(res, 200, "Book copy stats retrieved successfully.", { stats: payload });
	} catch (error) {
		logToFile("BOOK_COPY_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve book copy stats at this time."]);
	}
});

// POST /bookcopy - Add a new book copy
router.post("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const bookId = parseId(req.body?.bookId);
	const { errors: copyErrors, normalized } = validateBookCopyPayload(req.body);

	const errors = [...copyErrors];
	if (!Number.isInteger(bookId)) {
		errors.push("Book id must be a valid integer.");
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const bookResult = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND id = $2`,
			[userId, bookId]
		);
		if (bookResult.rows.length === 0) {
			return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");

			const locationResolution = await resolveStorageLocationId(client, userId, {
				id: normalized?.storageLocationId ?? null,
				path: normalized?.storageLocationPath ?? null
			});
			if (locationResolution.error) {
				throw new Error(locationResolution.error);
			}

			const acquisitionDateId = await insertPartialDate(client, normalized?.acquisitionDate ?? null);

			const result = await client.query(
				`INSERT INTO book_copies (
					user_id, book_id, storage_location_id, acquisition_story, acquisition_date_id,
					acquired_from, acquisition_type, acquisition_location, notes, created_at, updated_at
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
				RETURNING id`,
				[
					userId,
					bookId,
					locationResolution.id ?? null,
					normalized?.acquisitionStory ?? null,
					acquisitionDateId,
					normalized?.acquiredFrom ?? null,
					normalized?.acquisitionType ?? null,
					normalized?.acquisitionLocation ?? null,
					normalized?.notes ?? null
				]
			);

			await client.query("COMMIT");

			logToFile("BOOK_COPY_CREATE", {
				status: "SUCCESS",
				user_id: userId,
				book_copy_id: result.rows[0].id,
				book_id: bookId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 201, "Book copy created successfully.", { id: result.rows[0].id });
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		if (["Storage location not found.", "Storage location path not found.", "Storage location id and path do not match."].includes(error.message)) {
			return errorResponse(res, 400, "Validation Error", [error.message]);
		}
		logToFile("BOOK_COPY_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the book copy."]);
	}
});

async function handleBookCopyUpdate(req, res, targetId) {
	const userId = req.user.id;
	const hasStorageLocationId = Object.prototype.hasOwnProperty.call(req.body || {}, "storageLocationId");
	const hasStorageLocationPath = Object.prototype.hasOwnProperty.call(req.body || {}, "storageLocationPath");
	const hasAcquisitionStory = Object.prototype.hasOwnProperty.call(req.body || {}, "acquisitionStory");
	const hasAcquisitionDate = Object.prototype.hasOwnProperty.call(req.body || {}, "acquisitionDate");
	const hasAcquiredFrom = Object.prototype.hasOwnProperty.call(req.body || {}, "acquiredFrom");
	const hasAcquisitionType = Object.prototype.hasOwnProperty.call(req.body || {}, "acquisitionType");
	const hasAcquisitionLocation = Object.prototype.hasOwnProperty.call(req.body || {}, "acquisitionLocation");
	const hasNotes = Object.prototype.hasOwnProperty.call(req.body || {}, "notes");

	const storageLocationIdRaw = hasStorageLocationId ? req.body?.storageLocationId : undefined;
	const storageLocationPathRaw = hasStorageLocationPath ? req.body?.storageLocationPath : undefined;
	const storageLocationId = hasStorageLocationId && storageLocationIdRaw !== null ? parseId(storageLocationIdRaw) : null;
	const storageLocationPath = hasStorageLocationPath ? normalizeOptionalText(storageLocationPathRaw) : null;

	const acquisitionStory = hasAcquisitionStory ? normalizeOptionalText(req.body?.acquisitionStory) : undefined;
	const acquisitionDate = hasAcquisitionDate ? req.body?.acquisitionDate : undefined;
	const acquiredFrom = hasAcquiredFrom ? normalizeOptionalText(req.body?.acquiredFrom) : undefined;
	const acquisitionType = hasAcquisitionType ? normalizeOptionalText(req.body?.acquisitionType) : undefined;
	const acquisitionLocation = hasAcquisitionLocation ? normalizeOptionalText(req.body?.acquisitionLocation) : undefined;
	const notes = hasNotes ? normalizeOptionalText(req.body?.notes) : undefined;

	const errors = [];
	if (hasStorageLocationId && storageLocationIdRaw !== null && !Number.isInteger(storageLocationId)) {
		errors.push("Storage location id must be a valid integer.");
	}
	if (hasStorageLocationPath && storageLocationPathRaw !== null && typeof storageLocationPathRaw !== "string") {
		errors.push("Storage location path must be a string.");
	} else if (hasStorageLocationPath && storageLocationPathRaw !== null && !storageLocationPath) {
		errors.push("Storage location path must be a non-empty string.");
	}
	if (hasAcquisitionStory) errors.push(...validateOptionalText(req.body?.acquisitionStory, "Acquisition story", MAX_ACQUISITION_STORY_LENGTH));
	if (hasAcquisitionDate) errors.push(...validatePartialDateObject(acquisitionDate, "Acquisition date"));
	if (hasAcquiredFrom) errors.push(...validateOptionalText(req.body?.acquiredFrom, "Acquired from", MAX_ACQUIRED_FROM_LENGTH));
	if (hasAcquisitionType) errors.push(...validateOptionalText(req.body?.acquisitionType, "Acquisition type", MAX_ACQUISITION_TYPE_LENGTH));
	if (hasAcquisitionLocation) errors.push(...validateOptionalText(req.body?.acquisitionLocation, "Acquisition location", MAX_ACQUISITION_LOCATION_LENGTH));
	if (hasNotes) errors.push(...validateOptionalText(req.body?.notes, "Notes", MAX_COPY_NOTES_LENGTH));

	if (!hasStorageLocationId && !hasStorageLocationPath && !hasAcquisitionStory && !hasAcquisitionDate
		&& !hasAcquiredFrom && !hasAcquisitionType && !hasAcquisitionLocation && !hasNotes) {
		return errorResponse(res, 400, "No changes were provided.", ["Please provide at least one field to update."]);
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");

			let storageLocationIdResolved = null;
			if (hasStorageLocationId || hasStorageLocationPath) {
				const resolution = await resolveStorageLocationId(client, userId, {
					id: hasStorageLocationId ? storageLocationId : null,
					path: hasStorageLocationPath ? storageLocationPath : null
				});
				if (resolution.error) {
					throw new Error(resolution.error);
				}
				storageLocationIdResolved = resolution.id ?? null;
			}

			const updateFields = [];
			const params = [userId, targetId];
			let index = 3;

			if (hasStorageLocationId || hasStorageLocationPath) {
				updateFields.push(`storage_location_id = $${index++}`);
				params.push(storageLocationIdResolved);
			}
			if (hasAcquisitionStory) {
				updateFields.push(`acquisition_story = $${index++}`);
				params.push(acquisitionStory || null);
			}
			if (hasAcquisitionDate) {
				const acquisitionDateId = await insertPartialDate(client, acquisitionDate ?? null);
				updateFields.push(`acquisition_date_id = $${index++}`);
				params.push(acquisitionDateId);
			}
			if (hasAcquiredFrom) {
				updateFields.push(`acquired_from = $${index++}`);
				params.push(acquiredFrom || null);
			}
			if (hasAcquisitionType) {
				updateFields.push(`acquisition_type = $${index++}`);
				params.push(acquisitionType || null);
			}
			if (hasAcquisitionLocation) {
				updateFields.push(`acquisition_location = $${index++}`);
				params.push(acquisitionLocation || null);
			}
			if (hasNotes) {
				updateFields.push(`notes = $${index++}`);
				params.push(notes || null);
			}

			const result = await client.query(
				`UPDATE book_copies
				SET ${updateFields.join(", ")}, updated_at = NOW()
				WHERE user_id = $1 AND id = $2
				RETURNING id, book_id`,
				params
			);

			if (result.rows.length === 0) {
				await client.query("ROLLBACK");
				return errorResponse(res, 404, "Book copy not found.", ["The requested book copy could not be located."]);
			}

			await client.query("COMMIT");

			logToFile("BOOK_COPY_UPDATE", {
				status: "SUCCESS",
				user_id: userId,
				book_copy_id: targetId,
				book_id: result.rows[0].book_id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, "Book copy updated successfully.", { id: targetId });
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		if (["Storage location not found.", "Storage location path not found.", "Storage location id and path do not match."].includes(error.message)) {
			return errorResponse(res, 400, "Validation Error", [error.message]);
		}
		logToFile("BOOK_COPY_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the book copy."]);
	}
}

// PUT /bookcopy/:id - Update a book copy by id
router.put("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book copy id must be a valid integer."]);
	}
	return handleBookCopyUpdate(req, res, id);
});

// PUT /bookcopy - Update a book copy by id
router.put("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.body?.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a book copy id to update."]);
	}
	return handleBookCopyUpdate(req, res, id);
});

async function handleBookCopyDelete(req, res, targetId) {
	const userId = req.user.id;

	try {
		const existing = await pool.query(
			`SELECT id, book_id FROM book_copies WHERE user_id = $1 AND id = $2`,
			[userId, targetId]
		);
		if (existing.rows.length === 0) {
			return errorResponse(res, 404, "Book copy not found.", ["The requested book copy could not be located."]);
		}

		const bookId = existing.rows[0].book_id;
		const countResult = await pool.query(
			`SELECT COUNT(*)::int AS total FROM book_copies WHERE user_id = $1 AND book_id = $2`,
			[userId, bookId]
		);
		const total = countResult.rows[0]?.total ?? 0;
		if (total <= 1) {
			return errorResponse(res, 409, "Book copy required.", ["A book must have at least one copy."]);
		}

		await pool.query(
			`DELETE FROM book_copies WHERE user_id = $1 AND id = $2`,
			[userId, targetId]
		);

		logToFile("BOOK_COPY_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			book_copy_id: targetId,
			book_id: bookId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Book copy deleted successfully.", { id: targetId });
	} catch (error) {
		logToFile("BOOK_COPY_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the book copy."]);
	}
}

// DELETE /bookcopy/:id - Delete a book copy by id
router.delete("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book copy id must be a valid integer."]);
	}
	return handleBookCopyDelete(req, res, id);
});

// DELETE /bookcopy - Delete a book copy by id
router.delete("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.body?.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a book copy id to delete."]);
	}
	return handleBookCopyDelete(req, res, id);
});

module.exports = router;
