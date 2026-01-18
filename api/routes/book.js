const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { validatePartialDateObject } = require("../utils/partial-date");
const { normalizeTagName, buildTagDisplayName } = require("../utils/tag-normalization");

const MAX_TITLE_LENGTH = 255;
const MAX_SUBTITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TAG_LENGTH = 50;
const MAX_LIST_LIMIT = 200;
const MAX_ACQUISITION_STORY_LENGTH = 2000;
const MAX_ACQUIRED_FROM_LENGTH = 255;
const MAX_ACQUISITION_TYPE_LENGTH = 100;
const MAX_ACQUISITION_LOCATION_LENGTH = 255;
const MAX_COPY_NOTES_LENGTH = 2000;
const MAX_AUTHOR_ROLE_LENGTH = 100;

router.use((req, res, next) => {
	logToFile("BOOK_REQUEST", {
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
		logToFile("BOOK_RESPONSE", {
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

function parseStringArray(input, label) {
	if (input === undefined || input === null) return { values: [], error: null };
	const raw = Array.isArray(input) ? input : [input];
	const values = [];
	for (const item of raw) {
		const normalized = normalizeText(item);
		if (!normalized) {
			return { values: [], error: `${label} must be a non-empty string or array of strings.` };
		}
		values.push(normalized.toLowerCase());
	}
	return { values, error: null };
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

function extractBookCopyInput(body) {
	if (!body) return null;
	if (Object.prototype.hasOwnProperty.call(body, "bookCopy")) {
		return body.bookCopy;
	}
	if (Array.isArray(body.bookCopies) && body.bookCopies.length > 0) {
		return body.bookCopies[0];
	}
	return null;
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

async function fetchSingleBookStats(userId, bookId, bookRow) {
	const countResult = await pool.query(
		`SELECT
		   (SELECT COUNT(*)::int FROM book_copies bc WHERE bc.user_id = $1 AND bc.book_id = $2) AS copy_count,
		   (SELECT COUNT(*)::int FROM book_authors ba WHERE ba.user_id = $1 AND ba.book_id = $2) AS author_count,
		   (SELECT COUNT(*)::int FROM book_tags bt WHERE bt.user_id = $1 AND bt.book_id = $2) AS tag_count,
		   (SELECT COUNT(*)::int FROM book_languages bl WHERE bl.user_id = $1 AND bl.book_id = $2) AS language_count,
		   (SELECT COUNT(*)::int FROM book_series_books bsb WHERE bsb.user_id = $1 AND bsb.book_id = $2) AS series_count`,
		[userId, bookId]
	);
	const counts = countResult.rows[0] || {};
	return {
		copyCount: counts.copy_count ?? 0,
		authorCount: counts.author_count ?? 0,
		tagCount: counts.tag_count ?? 0,
		languageCount: counts.language_count ?? 0,
		seriesCount: counts.series_count ?? 0,
		hasIsbn: Boolean(bookRow?.isbn),
		hasPublicationDate: Boolean(bookRow?.publication_date_id),
		hasCoverImage: Boolean(bookRow?.cover_image_url),
		hasDescription: Boolean(bookRow?.description),
		hasPublisher: Boolean(bookRow?.publisher_id),
		hasBookType: Boolean(bookRow?.book_type_id),
		hasPageCount: Number.isInteger(bookRow?.page_count)
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

function parseSingleIdInput(value, fieldLabel) {
	if (value === undefined || value === null || value === "") return { value: null };
	if (Array.isArray(value)) {
		if (value.length === 0) return { value: null };
		if (value.length > 1) {
			return { error: `${fieldLabel} must be a single id or an array with one id.` };
		}
		const parsed = parseId(value[0]);
		if (!Number.isInteger(parsed)) {
			return { error: `${fieldLabel} must be a valid integer.` };
		}
		return { value: parsed };
	}
	const parsed = parseId(value);
	if (!Number.isInteger(parsed)) {
		return { error: `${fieldLabel} must be a valid integer.` };
	}
	return { value: parsed };
}

function normalizeIsbn(value) {
	if (value === undefined || value === null || value === "") return null;
	if (typeof value !== "string") return null;
	const cleaned = value.replace(/[^0-9xX]/g, "").toUpperCase();
	if (cleaned.length === 10 && /^[0-9]{9}[0-9X]$/.test(cleaned)) return cleaned;
	if (cleaned.length === 13 && /^[0-9]{13}$/.test(cleaned)) return cleaned;
	return null;
}

function validateTitle(title) {
	const errors = [];
	if (!title) {
		errors.push("Title must be provided.");
		return errors;
	}
	if (title.length < 2 || title.length > MAX_TITLE_LENGTH) {
		errors.push(`Title must be between 2 and ${MAX_TITLE_LENGTH} characters.`);
	}
	return errors;
}

function validateSubtitle(subtitle) {
	const errors = [];
	if (subtitle === undefined || subtitle === null || subtitle === "") {
		return errors;
	}
	if (typeof subtitle !== "string") {
		errors.push("Subtitle must be a string.");
		return errors;
	}
	if (subtitle.length < 2 || subtitle.length > MAX_SUBTITLE_LENGTH) {
		errors.push(`Subtitle must be between 2 and ${MAX_SUBTITLE_LENGTH} characters.`);
	}
	return errors;
}

function validateIsbn(isbn) {
	const errors = [];
	if (isbn === undefined || isbn === null || isbn === "") {
		return errors;
	}
	if (!normalizeIsbn(isbn)) {
		errors.push("ISBN must be 10–17 characters and contain only digits, hyphens, or X.");
	}
	return errors;
}

function validateDescription(description) {
	const errors = [];
	if (description === undefined || description === null || description === "") {
		return errors;
	}
	if (typeof description !== "string") {
		errors.push("Description must be a string.");
		return errors;
	}
	if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
		errors.push(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
	}
	return errors;
}

function validateCoverUrl(value) {
	const errors = [];
	if (value === undefined || value === null || value === "") {
		return errors;
	}
	if (typeof value !== "string") {
		errors.push("Cover Image URL must be a string.");
		return errors;
	}
	const trimmed = value.trim();
	if (/\s/.test(trimmed)) {
		errors.push("Cover Image URL must not contain spaces.");
		return errors;
	}
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			errors.push("Cover Image URL must start with http:// or https://.");
		}
	} catch (error) {
		errors.push("Cover Image URL must be a valid URL starting with http:// or https://.");
	}
	return errors;
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

async function fetchBookCopies(userId, bookId) {
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
		SELECT bc.id, bc.storage_location_id, bc.acquisition_story, bc.acquisition_date_id, bc.acquired_from,
		       bc.acquisition_type, bc.acquisition_location, bc.notes, bc.created_at, bc.updated_at,
		       d.day AS acq_day, d.month AS acq_month, d.year AS acq_year, d.text AS acq_text,
		       lp.path AS storage_location_path
		FROM book_copies bc
		LEFT JOIN dates d ON bc.acquisition_date_id = d.id
		LEFT JOIN location_paths lp ON bc.storage_location_id = lp.id
		WHERE bc.user_id = $1 AND bc.book_id = $2
		ORDER BY bc.id ASC`,
		[userId, bookId]
	);

	return result.rows.map((row) => ({
		id: row.id,
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
}

async function resolveBookId({ userId, id, isbn, title }) {
	const hasId = Number.isInteger(id);
	const hasIsbn = Boolean(isbn);
	const hasTitle = Boolean(title);
	const hasMultiple = Number(hasId) + Number(hasIsbn) + Number(hasTitle) > 1;
	let resolvedId = null;

	if (hasId) {
		const result = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
			[userId, id]
		);
		if (result.rows.length === 0) {
			return { id: null, mismatch: hasMultiple };
		}
		resolvedId = id;
	}

	if (hasIsbn) {
		const result = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND isbn = $2 AND deleted_at IS NULL`,
			[userId, isbn]
		);
		if (result.rows.length === 0) {
			return { id: null, mismatch: hasMultiple };
		}
		const foundId = result.rows[0].id;
		if (resolvedId && resolvedId !== foundId) {
			return { id: resolvedId, mismatch: true };
		}
		resolvedId = foundId;
	}

	if (hasTitle) {
		const result = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND title = $2 AND deleted_at IS NULL`,
			[userId, title]
		);
		if (result.rows.length === 0) {
			return { id: null, mismatch: hasMultiple };
		}
		if (result.rows.length > 1) {
			if (!resolvedId) {
				return { id: null, conflict: true };
			}
			const ids = result.rows.map((row) => row.id);
			if (!ids.includes(resolvedId)) {
				return { id: resolvedId, mismatch: true };
			}
			return { id: resolvedId };
		}
		const foundId = result.rows[0].id;
		if (resolvedId && resolvedId !== foundId) {
			return { id: resolvedId, mismatch: true };
		}
		resolvedId = foundId;
	}

	return { id: resolvedId };
}

async function resolveDeletedBookId({ userId, id, isbn, title }) {
	const hasId = Number.isInteger(id);
	const hasIsbn = Boolean(isbn);
	const hasTitle = Boolean(title);
	const hasMultiple = Number(hasId) + Number(hasIsbn) + Number(hasTitle) > 1;
	let resolvedId = null;

	if (hasId) {
		const result = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND id = $2 AND deleted_at IS NOT NULL`,
			[userId, id]
		);
		if (result.rows.length === 0) {
			return { id: null, mismatch: hasMultiple };
		}
		resolvedId = id;
	}

	if (hasIsbn) {
		const result = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND isbn = $2 AND deleted_at IS NOT NULL`,
			[userId, isbn]
		);
		if (result.rows.length === 0) {
			return { id: null, mismatch: hasMultiple };
		}
		const foundId = result.rows[0].id;
		if (resolvedId && resolvedId !== foundId) {
			return { id: resolvedId, mismatch: true };
		}
		resolvedId = foundId;
	}

	if (hasTitle) {
		const result = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND title = $2 AND deleted_at IS NOT NULL`,
			[userId, title]
		);
		if (result.rows.length === 0) {
			return { id: null, mismatch: hasMultiple };
		}
		if (result.rows.length > 1) {
			if (!resolvedId) {
				return { id: null, conflict: true };
			}
			const ids = result.rows.map((row) => row.id);
			if (!ids.includes(resolvedId)) {
				return { id: resolvedId, mismatch: true };
			}
			return { id: resolvedId };
		}
		const foundId = result.rows[0].id;
		if (resolvedId && resolvedId !== foundId) {
			return { id: resolvedId, mismatch: true };
		}
		resolvedId = foundId;
	}

	return { id: resolvedId };
}

async function resolveLanguageIds({ ids, names }) {
	const languageIds = new Set();
	if (Array.isArray(ids)) {
		for (const value of ids) {
			const parsed = parseId(value);
			if (Number.isInteger(parsed)) {
				languageIds.add(parsed);
			}
		}
	}

	const normalizedNames = Array.isArray(names)
		? names.map((name) => normalizeText(name).toLowerCase()).filter(Boolean)
		: [];

	let missingNames = [];
	if (normalizedNames.length > 0) {
		const uniqueNames = Array.from(new Set(normalizedNames));
		const result = await pool.query(
			`SELECT id, name_normalized FROM languages WHERE name_normalized = ANY($1::text[])`,
			[uniqueNames]
		);
		result.rows.forEach((row) => languageIds.add(row.id));

		const found = new Set(result.rows.map((row) => row.name_normalized));
		missingNames = uniqueNames.filter((name) => !found.has(name));
	}

	return { ids: Array.from(languageIds), missingNames };
}

async function ensureEntitiesExist({ userId, table, ids, label }) {
	if (!ids || ids.length === 0) return { ok: true };
	const result = await pool.query(
		`SELECT id FROM ${table} WHERE user_id = $1 AND id = ANY($2::int[])`,
		[userId, ids]
	);
	if (result.rows.length !== ids.length) {
		return { ok: false, error: `${label} includes one or more invalid ids.` };
	}
	return { ok: true };
}

async function ensureLanguageIdsExist(ids) {
	if (!ids || ids.length === 0) return { ok: true };
	const result = await pool.query(
		`SELECT id FROM languages WHERE id = ANY($1::int[])`,
		[ids]
	);
	if (result.rows.length !== ids.length) {
		return { ok: false, error: "One or more language ids are invalid." };
	}
	return { ok: true };
}

async function fetchBookRelations(userId, bookId) {
	const [authors, languages, tags, series, copies] = await Promise.all([
		pool.query(
			`SELECT ba.author_id, ba.role, a.display_name, a.deceased, a.bio,
			        bd.id AS birth_date_id, bd.day AS birth_day, bd.month AS birth_month, bd.year AS birth_year, bd.text AS birth_text,
			        dd.id AS death_date_id, dd.day AS death_day, dd.month AS death_month, dd.year AS death_year, dd.text AS death_text
			 FROM book_authors ba
			 LEFT JOIN authors a ON a.id = ba.author_id AND a.user_id = ba.user_id
			 LEFT JOIN dates bd ON a.birth_date_id = bd.id
			 LEFT JOIN dates dd ON a.death_date_id = dd.id
			 WHERE ba.user_id = $1 AND ba.book_id = $2
			 ORDER BY ba.author_id ASC`,
			[userId, bookId]
		),
		pool.query(
			`SELECT l.id, l.name
			 FROM book_languages bl
			 JOIN languages l ON bl.language_id = l.id
			 WHERE bl.user_id = $1 AND bl.book_id = $2
			 ORDER BY l.name ASC`,
			[userId, bookId]
		),
		pool.query(
			`SELECT t.id, t.name
			 FROM book_tags bt
			 JOIN tags t ON bt.tag_id = t.id
			 WHERE bt.user_id = $1 AND bt.book_id = $2
			 ORDER BY t.name ASC`,
			[userId, bookId]
		),
		pool.query(
			`SELECT bsb.series_id, bsb.book_order,
			        bs.name AS series_name, bs.description AS series_description, bs.website AS series_website,
			        d.id AS published_date_id, d.day, d.month, d.year, d.text
			 FROM book_series_books bsb
			 JOIN books b ON bsb.book_id = b.id
			 LEFT JOIN book_series bs ON bs.id = bsb.series_id AND bs.user_id = bsb.user_id
			 LEFT JOIN dates d ON b.publication_date_id = d.id
			 WHERE bsb.user_id = $1 AND bsb.book_id = $2
			 ORDER BY series_id ASC`,
			[userId, bookId]
		),
		fetchBookCopies(userId, bookId)
	]);

	return {
		authors: authors.rows.map((row) => ({
			authorId: row.author_id,
			authorRole: row.role ?? null,
			authorName: row.display_name ?? null,
			birthDate: row.birth_date_id
				? { id: row.birth_date_id, day: row.birth_day, month: row.birth_month, year: row.birth_year, text: row.birth_text }
				: null,
			deathDate: row.death_date_id
				? { id: row.death_date_id, day: row.death_day, month: row.death_month, year: row.death_year, text: row.death_text }
				: null,
			deceased: row.deceased ?? null,
			bio: row.bio ?? null
		})),
		languages: languages.rows,
		tags: tags.rows,
		series: series.rows.map((row) => ({
			seriesId: row.series_id,
			seriesName: row.series_name ?? null,
			seriesDescription: row.series_description ?? null,
			seriesWebsite: row.series_website ?? null,
			bookOrder: row.book_order,
			bookPublishedDate: row.published_date_id
				? { id: row.published_date_id, day: row.day, month: row.month, year: row.year, text: row.text }
				: null
		})),
		bookCopies: copies
	};
}

function buildBookPayload(row, view, relations) {
	if (view === "nameOnly") {
		return { id: row.id, title: row.title };
	}

	const base = {
		id: row.id,
		title: row.title,
		subtitle: row.subtitle,
		isbn: row.isbn,
		publicationDate: row.publication_date_id
			? { id: row.publication_date_id, day: row.pub_day, month: row.pub_month, year: row.pub_year, text: row.pub_text }
			: null,
		pageCount: row.page_count,
		bookTypeId: row.book_type_id,
		publisherId: row.publisher_id,
		coverImageUrl: row.cover_image_url,
		description: row.description,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};

	if (view === "card") {
		return {
			id: base.id,
			title: base.title,
			subtitle: base.subtitle,
			coverImageUrl: base.coverImageUrl,
			publicationDate: base.publicationDate,
			pageCount: base.pageCount,
			bookTypeId: base.bookTypeId,
			bookTypeName: row.book_type_name ?? null,
			authors: relations?.authors || [],
			languages: relations?.languages || [],
			tags: relations?.tags || []
		};
	}

	const publisher = base.publisherId
		? {
			id: base.publisherId,
			name: row.publisher_name ?? null,
			foundedDate: row.publisher_founded_date_id
				? {
					id: row.publisher_founded_date_id,
					day: row.publisher_founded_day,
					month: row.publisher_founded_month,
					year: row.publisher_founded_year,
					text: row.publisher_founded_text
				}
				: null,
			website: row.publisher_website ?? null,
			notes: row.publisher_notes ?? null
		}
		: null;
	const bookType = base.bookTypeId
		? {
			id: base.bookTypeId,
			name: row.book_type_name ?? null,
			description: row.book_type_description ?? null
		}
		: null;

	return {
		id: base.id,
		title: base.title,
		subtitle: base.subtitle,
		isbn: base.isbn,
		publicationDate: base.publicationDate,
		pageCount: base.pageCount,
		coverImageUrl: base.coverImageUrl,
		description: base.description,
		createdAt: base.createdAt,
		updatedAt: base.updatedAt,
		bookType,
		publisher,
		authors: relations?.authors || [],
		languages: relations?.languages || [],
		tags: relations?.tags || [],
		series: relations?.series || [],
		bookCopies: relations?.bookCopies || []
	};
}

function parseView(listParams) {
	if (parseBooleanFlag(listParams.nameOnly)) return "nameOnly";
	const view = normalizeText(listParams.view).toLowerCase();
	if (view === "nameonly" || view === "name") return "nameOnly";
	if (view === "card" || view === "cardview") return "card";
	return "all";
}

// GET /book - List or fetch a specific book
async function listBooksHandler(req, res) {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const view = parseView(listParams);
	const includeDeleted = parseBooleanFlag(listParams.includeDeleted) ?? false;
	const returnStats = parseBooleanFlag(listParams.returnStats);

	const targetId = parseId(req.query.id ?? req.body?.id);
	const targetIsbn = normalizeIsbn(req.query.isbn ?? req.body?.isbn);
	const targetTitle = normalizeText(req.query.title ?? req.body?.title);

	if (targetId !== null || targetIsbn || targetTitle) {
		if (targetTitle) {
			const titleErrors = validateTitle(targetTitle);
			if (titleErrors.length > 0) {
				return errorResponse(res, 400, "Validation Error", titleErrors);
			}
		}
		if ((req.query.isbn ?? req.body?.isbn) && !targetIsbn) {
			return errorResponse(res, 400, "Validation Error", ["ISBN must be 10–17 characters and contain only digits, hyphens, or X."]);
		}

		try {
			const resolved = await resolveBookId({ userId, id: targetId, isbn: targetIsbn, title: targetTitle });
			if (resolved.mismatch) {
				return errorResponse(res, 400, "Validation Error", ["Book id, ISBN, and title must refer to the same record."]);
			}
			if (resolved.conflict) {
				return errorResponse(res, 409, "Multiple books matched.", ["Multiple books share this title. Please use id or ISBN."]);
			}
			if (!Number.isInteger(resolved.id)) {
				return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
			}

			const result = await pool.query(
				`SELECT b.id, b.title, b.subtitle, b.isbn, b.page_count, b.cover_image_url,
				        b.description, b.created_at, b.updated_at, b.book_type_id, b.publisher_id,
				        bt.name AS book_type_name, bt.description AS book_type_description,
				        p.name AS publisher_name, p.website AS publisher_website, p.notes AS publisher_notes,
				        fd.id AS publisher_founded_date_id, fd.day AS publisher_founded_day,
				        fd.month AS publisher_founded_month, fd.year AS publisher_founded_year, fd.text AS publisher_founded_text,
				        pd.id AS publication_date_id, pd.day AS pub_day, pd.month AS pub_month, pd.year AS pub_year, pd.text AS pub_text
				 FROM books b
				 LEFT JOIN dates pd ON b.publication_date_id = pd.id
				 LEFT JOIN book_types bt ON bt.id = b.book_type_id AND bt.user_id = b.user_id
				 LEFT JOIN publishers p ON p.id = b.publisher_id AND p.user_id = b.user_id
				 LEFT JOIN dates fd ON p.founded_date_id = fd.id
				 WHERE b.user_id = $1 AND b.id = $2 AND b.deleted_at IS NULL`,
				[userId, resolved.id]
			);

			const row = result.rows[0];
			const relations = view === "nameOnly" ? null : await fetchBookRelations(userId, resolved.id);
			const payload = buildBookPayload(row, view, relations);
			if (returnStats) {
				payload.stats = await fetchSingleBookStats(userId, resolved.id, row);
			}

			return successResponse(res, 200, "Book retrieved successfully.", payload);
		} catch (error) {
			logToFile("BOOK_GET", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the book."]);
		}
	}

	const errors = [];
	const sortFields = {
		id: "b.id",
		title: "b.title",
		subtitle: "b.subtitle",
		isbn: "b.isbn",
		pageCount: "b.page_count",
		createdAt: "b.created_at",
		updatedAt: "b.updated_at",
		publicationDate: "pub_date_sort"
	};

	let sortSpec = [];
	if (Array.isArray(listParams.sort)) {
		sortSpec = listParams.sort;
	} else {
		const sortByRaw = normalizeText(listParams.sortBy);
		const orderRaw = normalizeText(listParams.order);
		const sortByList = sortByRaw ? sortByRaw.split(",").map((value) => value.trim()) : ["title"];
		const orderList = orderRaw ? orderRaw.split(",").map((value) => value.trim()) : [];
		sortSpec = sortByList.map((field, index) => ({
			field,
			order: orderList[index] || orderList[0] || "asc"
		}));
	}

	const sortClauses = [];
	for (const spec of sortSpec) {
		const field = normalizeText(spec.field);
		const column = sortFields[field];
		if (!column) {
			errors.push("sortBy must be one of: id, title, subtitle, isbn, pageCount, createdAt, updatedAt, publicationDate.");
			break;
		}
		const order = parseSortOrder(spec.order);
		if (!order) {
			errors.push("order must be either asc or desc.");
			break;
		}
		sortClauses.push(`${column} ${order.toUpperCase()}`);
	}
	if (sortClauses.length === 0 && errors.length === 0) {
		sortClauses.push("b.title ASC");
	}

	const { value: limit, error: limitError } = parseOptionalInt(listParams.limit, "limit", { min: 1, max: MAX_LIST_LIMIT });
	if (limitError) errors.push(limitError);
	const { value: offset, error: offsetError } = parseOptionalInt(listParams.offset, "offset", { min: 0 });
	if (offsetError) errors.push(offsetError);

	const filters = [];
	const values = [userId];
	let paramIndex = 2;

	if (!includeDeleted) {
		filters.push("b.deleted_at IS NULL");
	}

	if (listParams.filterId !== undefined) {
		const filterId = parseId(listParams.filterId);
		if (!Number.isInteger(filterId)) {
			errors.push("filterId must be a valid integer.");
		} else {
			filters.push(`b.id = $${paramIndex++}`);
			values.push(filterId);
		}
	}

	const filterTitle = normalizeText(listParams.filterTitle);
	if (filterTitle) {
		filters.push(`b.title ILIKE $${paramIndex++}`);
		values.push(`%${filterTitle}%`);
	}

	const filterSubtitle = normalizeText(listParams.filterSubtitle);
	if (filterSubtitle) {
		filters.push(`b.subtitle ILIKE $${paramIndex++}`);
		values.push(`%${filterSubtitle}%`);
	}

	if (listParams.filterIsbn !== undefined) {
		const isbn = normalizeIsbn(listParams.filterIsbn);
		if (!isbn) {
			errors.push("filterIsbn must be a valid ISBN.");
		} else {
			filters.push(`b.isbn = $${paramIndex++}`);
			values.push(isbn);
		}
	}

	if (listParams.filterBookTypeId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterBookTypeId, "filterBookTypeId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterBookTypeMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`b.book_type_id = ANY($${paramIndex++}::int[])`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`b.book_type_id = $${paramIndex++}`);
					values.push(id);
				});
			}
		}
	}

	if (listParams.filterPublisherId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterPublisherId, "filterPublisherId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterPublisherMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`b.publisher_id = ANY($${paramIndex++}::int[])`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`b.publisher_id = $${paramIndex++}`);
					values.push(id);
				});
			}
		}
	}

	if (listParams.filterPageMin !== undefined) {
		const { value: pageMin, error } = parseOptionalInt(listParams.filterPageMin, "filterPageMin", { min: 0 });
		if (error) {
			errors.push(error);
		} else if (pageMin !== null) {
			filters.push(`b.page_count >= $${paramIndex++}`);
			values.push(pageMin);
		}
	}

	if (listParams.filterPageMax !== undefined) {
		const { value: pageMax, error } = parseOptionalInt(listParams.filterPageMax, "filterPageMax", { min: 1 });
		if (error) {
			errors.push(error);
		} else if (pageMax !== null) {
			filters.push(`b.page_count <= $${paramIndex++}`);
			values.push(pageMax);
		}
	}

	if (listParams.filterAuthorId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterAuthorId, "filterAuthorId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterAuthorMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`EXISTS (SELECT 1 FROM book_authors ba WHERE ba.user_id = $1 AND ba.book_id = b.id AND ba.author_id = ANY($${paramIndex++}::int[]))`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`EXISTS (SELECT 1 FROM book_authors ba WHERE ba.user_id = $1 AND ba.book_id = b.id AND ba.author_id = $${paramIndex++})`);
					values.push(id);
				});
			}
		}
	}

	if (listParams.filterSeriesId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterSeriesId, "filterSeriesId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterSeriesMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`EXISTS (SELECT 1 FROM book_series_books bsb WHERE bsb.user_id = $1 AND bsb.book_id = b.id AND bsb.series_id = ANY($${paramIndex++}::int[]))`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`EXISTS (SELECT 1 FROM book_series_books bsb WHERE bsb.user_id = $1 AND bsb.book_id = b.id AND bsb.series_id = $${paramIndex++})`);
					values.push(id);
				});
			}
		}
	}

	if (listParams.filterStorageLocationId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterStorageLocationId, "filterStorageLocationId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const includeSubtree = parseBooleanFlag(
				listParams.includeSubtree ?? listParams.filterStorageLocationIncludeSubtree ?? listParams.filterStorageLocationRecursive
			) ?? false;
			if (includeSubtree) {
				filters.push(`EXISTS (
					WITH RECURSIVE location_tree AS (
						SELECT id FROM storage_locations WHERE user_id = $1 AND id = ANY($${paramIndex++}::int[])
						UNION ALL
						SELECT sl.id
						FROM storage_locations sl
						JOIN location_tree lt ON sl.parent_id = lt.id
						WHERE sl.user_id = $1
					)
					SELECT 1
					FROM book_copies bc
					JOIN location_tree lt ON bc.storage_location_id = lt.id
					WHERE bc.user_id = $1 AND bc.book_id = b.id
				)`);
				values.push(ids);
			} else {
				filters.push(`EXISTS (SELECT 1 FROM book_copies bc WHERE bc.user_id = $1 AND bc.book_id = b.id AND bc.storage_location_id = ANY($${paramIndex++}::int[]))`);
				values.push(ids);
			}
		}
	}

	const { values: tagNames, error: tagError } = parseStringArray(listParams.filterTag, "filterTag");
	if (tagError) {
		errors.push(tagError);
	} else if (tagNames.length > 0) {
		const normalizedTags = tagNames.map(normalizeTagName).filter(Boolean);
		if (normalizedTags.length !== tagNames.length) {
			errors.push("filterTag must contain valid tag names.");
		} else {
			const mode = String(listParams.filterTagMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`EXISTS (
					SELECT 1 FROM book_tags bt
					JOIN tags t ON bt.tag_id = t.id
					WHERE bt.user_id = $1 AND bt.book_id = b.id AND t.name_normalized = ANY($${paramIndex++}::text[])
				)`);
				values.push(normalizedTags);
			} else {
				normalizedTags.forEach((tag) => {
					filters.push(`EXISTS (
						SELECT 1 FROM book_tags bt
						JOIN tags t ON bt.tag_id = t.id
						WHERE bt.user_id = $1 AND bt.book_id = b.id AND t.name_normalized = $${paramIndex++}
					)`);
					values.push(tag);
				});
			}
		}
	}

	if (listParams.filterLanguageId !== undefined) {
		const { ids, error } = parseIdArray(listParams.filterLanguageId, "filterLanguageId");
		if (error) {
			errors.push(error);
		} else if (ids.length > 0) {
			const mode = String(listParams.filterLanguageIdMode || "and").toLowerCase() === "or" ? "or" : "and";
			if (mode === "or") {
				filters.push(`EXISTS (
					SELECT 1 FROM book_languages bl
					WHERE bl.user_id = $1 AND bl.book_id = b.id AND bl.language_id = ANY($${paramIndex++}::int[])
				)`);
				values.push(ids);
			} else {
				ids.forEach((id) => {
					filters.push(`EXISTS (
						SELECT 1 FROM book_languages bl
						WHERE bl.user_id = $1 AND bl.book_id = b.id AND bl.language_id = $${paramIndex++}
					)`);
					values.push(id);
				});
			}
		}
	}

	const { values: languageNames, error: languageError } = parseStringArray(listParams.filterLanguage, "filterLanguage");
	if (languageError) {
		errors.push(languageError);
	} else if (languageNames.length > 0) {
		const mode = String(listParams.filterLanguageMode || "and").toLowerCase() === "or" ? "or" : "and";
		if (mode === "or") {
			filters.push(`EXISTS (
				SELECT 1 FROM book_languages bl
				JOIN languages l ON bl.language_id = l.id
				WHERE bl.user_id = $1 AND bl.book_id = b.id AND l.name_normalized = ANY($${paramIndex++}::text[])
			)`);
			values.push(languageNames);
		} else {
			languageNames.forEach((lang) => {
				filters.push(`EXISTS (
					SELECT 1 FROM book_languages bl
					JOIN languages l ON bl.language_id = l.id
					WHERE bl.user_id = $1 AND bl.book_id = b.id AND l.name_normalized = $${paramIndex++}
				)`);
				values.push(lang);
			});
		}
	}

	const dateFilters = [
		{ key: "filterCreatedAt", column: "b.created_at", op: "=" },
		{ key: "filterUpdatedAt", column: "b.updated_at", op: "=" },
		{ key: "filterCreatedAfter", column: "b.created_at", op: ">=" },
		{ key: "filterCreatedBefore", column: "b.created_at", op: "<=" },
		{ key: "filterUpdatedAfter", column: "b.updated_at", op: ">=" },
		{ key: "filterUpdatedBefore", column: "b.updated_at", op: "<=" }
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

	const publishedBefore = parseDateFilter(listParams.filterPublishedBefore, "filterPublishedBefore");
	if (publishedBefore.error) errors.push(publishedBefore.error);
	if (publishedBefore.value) {
		filters.push(`pub_date_sort <= $${paramIndex++}::date`);
		values.push(publishedBefore.value);
	}

	const publishedAfter = parseDateFilter(listParams.filterPublishedAfter, "filterPublishedAfter");
	if (publishedAfter.error) errors.push(publishedAfter.error);
	if (publishedAfter.value) {
		filters.push(`pub_date_sort >= $${paramIndex++}::date`);
		values.push(publishedAfter.value);
	}

	const publishedYear = parseOptionalInt(listParams.filterPublishedYear, "filterPublishedYear", { min: 1, max: 9999 });
	if (publishedYear.error) errors.push(publishedYear.error);
	if (publishedYear.value !== null) {
		filters.push(`pd.year = $${paramIndex++}`);
		values.push(publishedYear.value);
	}

	const publishedMonth = parseOptionalInt(listParams.filterPublishedMonth, "filterPublishedMonth", { min: 1, max: 12 });
	if (publishedMonth.error) errors.push(publishedMonth.error);
	if (publishedMonth.value !== null) {
		filters.push(`pd.month = $${paramIndex++}`);
		values.push(publishedMonth.value);
	}

	const publishedDay = parseOptionalInt(listParams.filterPublishedDay, "filterPublishedDay", { min: 1, max: 31 });
	if (publishedDay.error) errors.push(publishedDay.error);
	if (publishedDay.value !== null) {
		filters.push(`pd.day = $${paramIndex++}`);
		values.push(publishedDay.value);
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	let query = `SELECT b.id, b.title, b.subtitle, b.isbn, b.page_count, b.cover_image_url,
			            b.description, b.created_at, b.updated_at, b.book_type_id, b.publisher_id,
			            bt.name AS book_type_name, bt.description AS book_type_description,
			            p.name AS publisher_name, p.website AS publisher_website, p.notes AS publisher_notes,
			            fd.id AS publisher_founded_date_id, fd.day AS publisher_founded_day,
			            fd.month AS publisher_founded_month, fd.year AS publisher_founded_year, fd.text AS publisher_founded_text,
			            pd.id AS publication_date_id, pd.day AS pub_day, pd.month AS pub_month, pd.year AS pub_year, pd.text AS pub_text,
			            make_date(pd.year, COALESCE(pd.month, 1), COALESCE(pd.day, 1)) AS pub_date_sort
			 FROM books b
			 LEFT JOIN dates pd ON b.publication_date_id = pd.id
			 LEFT JOIN book_types bt ON bt.id = b.book_type_id AND bt.user_id = b.user_id
			 LEFT JOIN publishers p ON p.id = b.publisher_id AND p.user_id = b.user_id
			 LEFT JOIN dates fd ON p.founded_date_id = fd.id
			 WHERE b.user_id = $1`;
	if (filters.length > 0) {
		query += ` AND ${filters.join(" AND ")}`;
	}
	query += ` ORDER BY ${sortClauses.join(", ")}`;
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
		const payload = [];

		for (const row of result.rows) {
			const relations = view === "nameOnly" ? null : await fetchBookRelations(userId, row.id);
			payload.push(buildBookPayload(row, view, relations));
		}

		logToFile("BOOK_LIST", {
			status: "SUCCESS",
			user_id: userId,
			count: payload.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Books retrieved successfully.", { books: payload });
	} catch (error) {
		logToFile("BOOK_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving books."]);
	}
}

// GET /book - List or fetch a specific book
router.get("/", requiresAuth, authenticatedLimiter, listBooksHandler);

// POST /book/list - List books with JSON body (browser-safe)
router.post("/list", requiresAuth, authenticatedLimiter, listBooksHandler);

// POST /book - Create a new book
router.post("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const title = normalizeText(req.body?.title);
	const subtitle = normalizeText(req.body?.subtitle);
	const isbnRaw = req.body?.isbn;
	const isbn = normalizeIsbn(isbnRaw);
	const publicationDate = req.body?.publicationDate ?? null;
	const { value: pageCount, error: pageError } = parseOptionalInt(req.body?.pageCount, "Number of pages", { min: 1, max: 10000 });
	const coverImageUrl = normalizeText(req.body?.coverImageUrl);
	const description = normalizeText(req.body?.description);

	const { value: bookTypeId, error: bookTypeError } = parseSingleIdInput(req.body?.bookTypeId, "Book Type");
	const { value: publisherId, error: publisherError } = parseSingleIdInput(req.body?.publisherId, "Publisher");
	const rawAuthors = Array.isArray(req.body?.authors) ? req.body.authors : [];
	const hasLegacyAuthorIds = Object.prototype.hasOwnProperty.call(req.body || {}, "authorIds");
	const hasLegacyAuthorRoles = Object.prototype.hasOwnProperty.call(req.body || {}, "authorRoles");

	let authorIds = [];
	let authorRoles = [];
	let hasInvalidAuthorIds = false;
	let hasInvalidAuthorRoles = false;

	const parsedAuthors = rawAuthors.map((entry) => {
		if (typeof entry === "number" || typeof entry === "string") {
			return { authorId: parseId(entry), authorRole: null };
		}
		if (entry && typeof entry === "object") {
			const authorId = parseId(entry.authorId ?? entry.id);
			const authorRoleRaw = entry.authorRole ?? entry.role ?? null;
			const authorRole = authorRoleRaw === undefined || authorRoleRaw === null || authorRoleRaw === ""
				? null
				: (typeof authorRoleRaw === "string" ? authorRoleRaw.trim() : authorRoleRaw);
			return { authorId, authorRole };
		}
		return { authorId: null, authorRole: null };
	});
	authorIds = parsedAuthors.map((entry) => entry.authorId).filter(Number.isInteger);
	authorRoles = parsedAuthors.map((entry) => entry.authorRole ?? null);
	hasInvalidAuthorIds = authorIds.length !== rawAuthors.length;
	hasInvalidAuthorRoles = authorRoles.some((role) =>
		role !== null && (typeof role !== "string" || role.length > MAX_AUTHOR_ROLE_LENGTH)
	);

	const rawLanguageIds = Array.isArray(req.body?.languageIds) ? req.body.languageIds : [];
	const parsedLanguageIds = rawLanguageIds.map((value) => parseId(value)).filter(Number.isInteger);
	const hasInvalidLanguageIds = rawLanguageIds.length !== parsedLanguageIds.length;
	const languageResolution = await resolveLanguageIds({
		ids: parsedLanguageIds,
		names: Array.isArray(req.body?.languageNames) ? req.body.languageNames : []
	});
	const languageIds = languageResolution.ids;

	const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
	const series = Array.isArray(req.body?.series) ? req.body.series : [];
	const bookCopyInput = extractBookCopyInput(req.body);
	const { errors: bookCopyErrors, normalized: normalizedBookCopy } = validateBookCopyPayload(bookCopyInput);
	const dryRun = parseBooleanFlag(req.body?.dryRun) === true;

	const errors = [
		...validateTitle(title),
		...validateSubtitle(subtitle),
		...validateDescription(description),
		...validateCoverUrl(coverImageUrl),
		...validatePartialDateObject(publicationDate, "Publication Date"),
		...validateIsbn(isbnRaw)
	];
	if (pageError) errors.push(pageError);
	if (bookTypeError) errors.push(bookTypeError);
	if (publisherError) errors.push(publisherError);
	if (hasLegacyAuthorIds || hasLegacyAuthorRoles) {
		errors.push("authorIds/authorRoles are no longer supported. Use authors instead.");
	}
	if (hasInvalidAuthorIds) errors.push("Authors must be ids or objects with authorId and optional authorRole.");
	if (authorRoles.length !== authorIds.length) {
		errors.push("Authors must be ids or objects with authorId and optional authorRole.");
	}
	if (hasInvalidAuthorRoles) {
		errors.push(`Author roles must be strings of ${MAX_AUTHOR_ROLE_LENGTH} characters or fewer.`);
	}
	if (hasInvalidLanguageIds) errors.push("languageIds must contain valid integers.");
	if (languageResolution.missingNames.length > 0) {
		errors.push(`Unknown language name(s): ${languageResolution.missingNames.join(", ")}.`);
	}

	const invalidTags = tags.filter((tag) => {
		const display = buildTagDisplayName(tag);
		return !display || display.length > MAX_TAG_LENGTH;
	});
	if (invalidTags.length > 0) {
		errors.push(`Tags must be ${MAX_TAG_LENGTH} characters or fewer.`);
	}
	for (const entry of series) {
		if (entry && typeof entry === "object" && entry.bookPublishedDate) {
			errors.push("bookPublishedDate is no longer supported. Series dates are derived from book publicationDate.");
		}
		if (entry && typeof entry === "object" && entry.bookOrder !== undefined) {
			const { error: orderError } = parseOptionalInt(entry.bookOrder, "Book order", { min: 1, max: 10000 });
			if (orderError) errors.push(orderError);
		}
	}
	errors.push(...bookCopyErrors);

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (isbn) {
			const existing = await pool.query(
				`SELECT id FROM books WHERE user_id = $1 AND isbn = $2 AND deleted_at IS NULL`,
				[userId, isbn]
			);
			if (existing.rows.length > 0) {
				return errorResponse(res, 409, "Book already exists.", ["A book with this ISBN already exists."]);
			}
		}

		if (bookTypeId) {
			const bookTypeCheck = await ensureEntitiesExist({ userId, table: "book_types", ids: [bookTypeId], label: "Book Type" });
			if (!bookTypeCheck.ok) {
				return errorResponse(res, 400, "Validation Error", [bookTypeCheck.error]);
			}
		}
		if (publisherId) {
			const publisherCheck = await ensureEntitiesExist({ userId, table: "publishers", ids: [publisherId], label: "Publisher" });
			if (!publisherCheck.ok) {
				return errorResponse(res, 400, "Validation Error", [publisherCheck.error]);
			}
		}
		if (authorIds.length > 0) {
			const authorCheck = await ensureEntitiesExist({ userId, table: "authors", ids: authorIds, label: "Author ids" });
			if (!authorCheck.ok) {
				return errorResponse(res, 400, "Validation Error", [authorCheck.error]);
			}
		}
		if (series.length > 0) {
			const seriesIds = series.map((entry) => (typeof entry === "number" ? entry : entry?.seriesId ?? entry?.id)).map(parseId).filter(Number.isInteger);
			if (seriesIds.length !== series.length) {
				return errorResponse(res, 400, "Validation Error", ["Series must be an array of ids or objects with seriesId."]);
			}
			const seriesCheck = await ensureEntitiesExist({ userId, table: "book_series", ids: seriesIds, label: "Series ids" });
			if (!seriesCheck.ok) {
				return errorResponse(res, 400, "Validation Error", [seriesCheck.error]);
			}
		}
		if (languageIds.length > 0) {
			const languageCheck = await ensureLanguageIdsExist(languageIds);
			if (!languageCheck.ok) {
				return errorResponse(res, 400, "Validation Error", [languageCheck.error]);
			}
		}

		if (normalizedBookCopy?.storageLocationId || normalizedBookCopy?.storageLocationPath) {
			const copyResolution = await resolveStorageLocationId(pool, userId, {
				id: normalizedBookCopy?.storageLocationId ?? null,
				path: normalizedBookCopy?.storageLocationPath ?? null
			});
			if (copyResolution.error) {
				return errorResponse(res, 400, "Validation Error", [copyResolution.error]);
			}
		}

		if (dryRun) {
			logToFile("BOOK_CREATE", {
				status: "INFO",
				user_id: userId,
				dry_run: true,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");
			return successResponse(res, 200, "Ready to be added.", { ready: true });
		}

		const client = await pool.connect();
		try {
			await client.query("BEGIN");

			const publicationDateId = await insertPartialDate(client, publicationDate);

			const result = await client.query(
				`INSERT INTO books (user_id, title, subtitle, isbn, publication_date_id, page_count, cover_image_url, description, book_type_id, publisher_id, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
				 RETURNING id, title, subtitle, isbn, publication_date_id, page_count, cover_image_url, description, book_type_id, publisher_id, created_at, updated_at`,
				[userId, title, subtitle || null, isbn, publicationDateId, pageCount, coverImageUrl || null, description || null, bookTypeId, publisherId]
			);
			const row = result.rows[0];

			if (authorIds.length > 0) {
				const roleValues = authorIds.map((_, index) => authorRoles[index] ?? null);
				await client.query(
					`INSERT INTO book_authors (user_id, book_id, author_id, role, created_at, updated_at)
					 SELECT $1, $2, UNNEST($3::int[]), UNNEST($4::text[]), NOW(), NOW()
					 ON CONFLICT DO NOTHING`,
					[userId, row.id, authorIds, roleValues]
				);
			}

			if (languageIds.length > 0) {
				const insertValues = languageIds.map((languageId) => `(${userId}, ${row.id}, ${languageId}, NOW(), NOW())`).join(", ");
				await client.query(
					`INSERT INTO book_languages (user_id, book_id, language_id, created_at, updated_at)
					 VALUES ${insertValues}
					 ON CONFLICT DO NOTHING`
				);
			}

			if (tags.length > 0) {
				for (const tag of tags) {
					const name = buildTagDisplayName(tag);
					const normalized = normalizeTagName(tag);
					if (!name || !normalized) {
						continue;
					}
					const tagResult = await client.query(
						`INSERT INTO tags (user_id, name, name_normalized, created_at, updated_at)
						 VALUES ($1, $2, $3, NOW(), NOW())
						 ON CONFLICT (user_id, name_normalized)
						 DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
						 RETURNING id`,
						[userId, name, normalized]
					);
					const tagId = tagResult.rows[0].id;
					await client.query(
						`INSERT INTO book_tags (user_id, book_id, tag_id, created_at, updated_at)
						 VALUES ($1, $2, $3, NOW(), NOW())
						 ON CONFLICT DO NOTHING`,
						[userId, row.id, tagId]
					);
				}
			}

			const copyResolution = await resolveStorageLocationId(client, userId, {
				id: normalizedBookCopy?.storageLocationId ?? null,
				path: normalizedBookCopy?.storageLocationPath ?? null
			});
			if (copyResolution.error) {
				throw new Error(copyResolution.error);
			}
			const acquisitionDateId = await insertPartialDate(client, normalizedBookCopy?.acquisitionDate ?? null);

			await client.query(
				`INSERT INTO book_copies (
					user_id, book_id, storage_location_id, acquisition_story, acquisition_date_id,
					acquired_from, acquisition_type, acquisition_location, notes, created_at, updated_at
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
				[
					userId,
					row.id,
					copyResolution.id ?? null,
					normalizedBookCopy?.acquisitionStory ?? null,
					acquisitionDateId,
					normalizedBookCopy?.acquiredFrom ?? null,
					normalizedBookCopy?.acquisitionType ?? null,
					normalizedBookCopy?.acquisitionLocation ?? null,
					normalizedBookCopy?.notes ?? null
				]
			);

			if (series.length > 0) {
				for (const entry of series) {
					const seriesId = parseId(typeof entry === "number" ? entry : entry?.seriesId ?? entry?.id);
					const { value: bookOrder, error: orderError } = parseOptionalInt(entry?.bookOrder, "Book order", { min: 1, max: 10000 });
					if (!Number.isInteger(seriesId) || orderError) {
						throw new Error("Series link data is invalid.");
					}
					await client.query(
						`INSERT INTO book_series_books (user_id, series_id, book_id, book_order, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
						[userId, seriesId, row.id, bookOrder ?? null]
					);
				}
			}

			await client.query("COMMIT");

			logToFile("BOOK_CREATE", {
				status: "SUCCESS",
				user_id: userId,
				book_id: row.id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			const full = await pool.query(
				`SELECT b.id, b.title, b.subtitle, b.isbn, b.page_count, b.cover_image_url,
				        b.description, b.created_at, b.updated_at, b.book_type_id, b.publisher_id,
				        bt.name AS book_type_name, bt.description AS book_type_description,
				        p.name AS publisher_name, p.website AS publisher_website, p.notes AS publisher_notes,
				        fd.id AS publisher_founded_date_id, fd.day AS publisher_founded_day,
				        fd.month AS publisher_founded_month, fd.year AS publisher_founded_year, fd.text AS publisher_founded_text,
				        pd.id AS publication_date_id, pd.day AS pub_day, pd.month AS pub_month, pd.year AS pub_year, pd.text AS pub_text
				 FROM books b
				 LEFT JOIN dates pd ON b.publication_date_id = pd.id
				 LEFT JOIN book_types bt ON bt.id = b.book_type_id AND bt.user_id = b.user_id
				 LEFT JOIN publishers p ON p.id = b.publisher_id AND p.user_id = b.user_id
				 LEFT JOIN dates fd ON p.founded_date_id = fd.id
				 WHERE b.user_id = $1 AND b.id = $2`,
				[userId, row.id]
			);

			const relations = await fetchBookRelations(userId, row.id);
			const payload = buildBookPayload(full.rows[0], "all", relations);

			return successResponse(res, 201, "Book created successfully.", payload);
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("BOOK_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		if (error.message === "Series link data is invalid.") {
			return errorResponse(res, 400, "Validation Error", ["Series entries must include a valid seriesId and optional bookOrder."]);
		}
		if (["Storage location not found.", "Storage location path not found.", "Storage location id and path do not match."].includes(error.message)) {
			return errorResponse(res, 400, "Validation Error", [error.message]);
		}
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the book."]);
	}
});

async function handleBookUpdate(req, res, bookId) {
	const userId = req.user.id;
	const hasTitle = Object.prototype.hasOwnProperty.call(req.body || {}, "title");
	const hasSubtitle = Object.prototype.hasOwnProperty.call(req.body || {}, "subtitle");
	const hasIsbn = Object.prototype.hasOwnProperty.call(req.body || {}, "isbn");
	const hasPublicationDate = Object.prototype.hasOwnProperty.call(req.body || {}, "publicationDate");
	const hasPageCount = Object.prototype.hasOwnProperty.call(req.body || {}, "pageCount");
	const hasCoverImageUrl = Object.prototype.hasOwnProperty.call(req.body || {}, "coverImageUrl");
	const hasDescription = Object.prototype.hasOwnProperty.call(req.body || {}, "description");
	const hasBookTypeId = Object.prototype.hasOwnProperty.call(req.body || {}, "bookTypeId");
	const hasPublisherId = Object.prototype.hasOwnProperty.call(req.body || {}, "publisherId");
	const hasAuthors = Object.prototype.hasOwnProperty.call(req.body || {}, "authors");
	const hasLegacyAuthorIds = Object.prototype.hasOwnProperty.call(req.body || {}, "authorIds");
	const hasLegacyAuthorRoles = Object.prototype.hasOwnProperty.call(req.body || {}, "authorRoles");
	const hasLanguageIds = Object.prototype.hasOwnProperty.call(req.body || {}, "languageIds");
	const hasLanguageNames = Object.prototype.hasOwnProperty.call(req.body || {}, "languageNames");
	const hasTags = Object.prototype.hasOwnProperty.call(req.body || {}, "tags");
	const hasSeries = Object.prototype.hasOwnProperty.call(req.body || {}, "series");

	const title = hasTitle ? normalizeText(req.body?.title) : undefined;
	const subtitle = hasSubtitle ? normalizeText(req.body?.subtitle) : undefined;
	const isbnRaw = hasIsbn ? req.body?.isbn : undefined;
	const isbn = hasIsbn ? normalizeIsbn(isbnRaw) : undefined;
	const publicationDate = hasPublicationDate ? req.body?.publicationDate : undefined;
	const { value: pageCount, error: pageError } = hasPageCount ? parseOptionalInt(req.body?.pageCount, "Number of pages", { min: 1, max: 10000 }) : { value: null };
	const coverImageUrl = hasCoverImageUrl ? normalizeText(req.body?.coverImageUrl) : undefined;
	const description = hasDescription ? normalizeText(req.body?.description) : undefined;

	const { value: bookTypeId, error: bookTypeError } = hasBookTypeId ? parseSingleIdInput(req.body?.bookTypeId, "Book Type") : { value: null };
	const { value: publisherId, error: publisherError } = hasPublisherId ? parseSingleIdInput(req.body?.publisherId, "Publisher") : { value: null };
	const rawAuthors = hasAuthors && Array.isArray(req.body?.authors) ? req.body.authors : [];
	const parsedAuthors = hasAuthors ? rawAuthors.map((entry) => {
		if (typeof entry === "number" || typeof entry === "string") {
			return { authorId: parseId(entry), authorRole: null };
		}
		if (entry && typeof entry === "object") {
			const authorId = parseId(entry.authorId ?? entry.id);
			const authorRoleRaw = entry.authorRole ?? entry.role ?? null;
			const authorRole = authorRoleRaw === undefined || authorRoleRaw === null || authorRoleRaw === ""
				? null
				: (typeof authorRoleRaw === "string" ? authorRoleRaw.trim() : authorRoleRaw);
			return { authorId, authorRole };
		}
		return { authorId: null, authorRole: null };
	}) : [];
	const authorIds = hasAuthors ? parsedAuthors.map((entry) => entry.authorId).filter(Number.isInteger) : null;
	const authorRoles = hasAuthors ? parsedAuthors.map((entry) => entry.authorRole ?? null) : null;
	const hasInvalidAuthorIds = hasAuthors && authorIds.length !== rawAuthors.length;
	const hasInvalidAuthorRoles = hasAuthors && authorRoles.some((role) =>
		role !== null && (typeof role !== "string" || role.length > MAX_AUTHOR_ROLE_LENGTH)
	);

	const errors = [
		...(hasTitle ? validateTitle(title) : []),
		...(hasSubtitle ? validateSubtitle(subtitle) : []),
		...(hasDescription ? validateDescription(description) : []),
		...(hasCoverImageUrl ? validateCoverUrl(coverImageUrl) : []),
		...(hasPublicationDate ? validatePartialDateObject(publicationDate, "Publication Date") : []),
		...(hasIsbn ? validateIsbn(isbnRaw) : [])
	];
	if (hasPageCount && pageError) errors.push(pageError);
	if (hasBookTypeId && bookTypeError) errors.push(bookTypeError);
	if (hasPublisherId && publisherError) errors.push(publisherError);
	if (hasLegacyAuthorIds || hasLegacyAuthorRoles) {
		errors.push("authorIds/authorRoles are no longer supported. Use authors instead.");
	}
	if (hasAuthors && !Array.isArray(req.body?.authors)) {
		errors.push("authors must be an array.");
	}
	if (hasInvalidAuthorIds || (hasAuthors && authorRoles.length !== authorIds.length)) {
		errors.push("authors must be ids or objects with authorId and optional authorRole.");
	}
	if (hasInvalidAuthorRoles) {
		errors.push(`Author roles must be strings of ${MAX_AUTHOR_ROLE_LENGTH} characters or fewer.`);
	}
	if (hasSeries && Array.isArray(req.body?.series)) {
		for (const entry of req.body.series) {
			if (entry && typeof entry === "object" && entry.bookPublishedDate) {
				errors.push("bookPublishedDate is no longer supported. Series dates are derived from book publicationDate.");
			}
		}
	}

	if (!hasTitle && !hasSubtitle && !hasIsbn && !hasPublicationDate && !hasPageCount && !hasCoverImageUrl && !hasDescription
		&& !hasBookTypeId && !hasPublisherId && !hasAuthors && !hasLanguageIds && !hasLanguageNames && !hasTags && !hasSeries) {
		return errorResponse(res, 400, "No changes were provided.", ["Please provide at least one field to update."]);
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (hasIsbn && isbn) {
			const existing = await pool.query(
				`SELECT id FROM books WHERE user_id = $1 AND isbn = $2 AND id <> $3 AND deleted_at IS NULL`,
				[userId, isbn, bookId]
			);
			if (existing.rows.length > 0) {
				return errorResponse(res, 409, "Book already exists.", ["A book with this ISBN already exists."]);
			}
		}

		if (hasBookTypeId && bookTypeId) {
			const check = await ensureEntitiesExist({ userId, table: "book_types", ids: [bookTypeId], label: "Book Type" });
			if (!check.ok) return errorResponse(res, 400, "Validation Error", [check.error]);
		}
		if (hasPublisherId && publisherId) {
			const check = await ensureEntitiesExist({ userId, table: "publishers", ids: [publisherId], label: "Publisher" });
			if (!check.ok) return errorResponse(res, 400, "Validation Error", [check.error]);
		}
		if (hasAuthors && authorIds && authorIds.length > 0) {
			const check = await ensureEntitiesExist({ userId, table: "authors", ids: authorIds, label: "Author ids" });
			if (!check.ok) return errorResponse(res, 400, "Validation Error", [check.error]);
		}

		const rawLanguageIds = hasLanguageIds && Array.isArray(req.body?.languageIds) ? req.body.languageIds : [];
		const parsedLanguageIds = rawLanguageIds.map((value) => parseId(value)).filter(Number.isInteger);
		const hasInvalidLanguageIds = hasLanguageIds && rawLanguageIds.length !== parsedLanguageIds.length;
		if (hasInvalidLanguageIds) {
			return errorResponse(res, 400, "Validation Error", ["languageIds must contain valid integers."]);
		}
		const languageResolution = (hasLanguageIds || hasLanguageNames)
			? await resolveLanguageIds({
				ids: parsedLanguageIds,
				names: Array.isArray(req.body?.languageNames) ? req.body.languageNames : []
			})
			: null;
		if (languageResolution && languageResolution.missingNames.length > 0) {
			return errorResponse(res, 400, "Validation Error", [`Unknown language name(s): ${languageResolution.missingNames.join(", ")}.`]);
		}
		const languageIds = languageResolution ? languageResolution.ids : null;
		if (languageIds && languageIds.length > 0) {
			const languageCheck = await ensureLanguageIdsExist(languageIds);
			if (!languageCheck.ok) {
				return errorResponse(res, 400, "Validation Error", [languageCheck.error]);
			}
		}

		const tags = hasTags ? (Array.isArray(req.body?.tags) ? req.body.tags : []) : null;
		if (hasTags) {
			const invalidTags = tags.filter((tag) => {
				const display = buildTagDisplayName(tag);
				return !display || display.length > MAX_TAG_LENGTH;
			});
			if (invalidTags.length > 0) {
				return errorResponse(res, 400, "Validation Error", [`Tags must be ${MAX_TAG_LENGTH} characters or fewer.`]);
			}
		}
		const series = hasSeries ? (Array.isArray(req.body?.series) ? req.body.series : []) : null;

		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const updateFields = [];
			const params = [userId, bookId];
			let index = 3;

			let publicationDateId;

			if (hasTitle) {
				updateFields.push(`title = $${index++}`);
				params.push(title);
			}
			if (hasSubtitle) {
				updateFields.push(`subtitle = $${index++}`);
				params.push(subtitle || null);
			}
			if (hasIsbn) {
				updateFields.push(`isbn = $${index++}`);
				params.push(isbn || null);
			}
			if (hasPublicationDate) {
				publicationDateId = await insertPartialDate(client, publicationDate);
				updateFields.push(`publication_date_id = $${index++}`);
				params.push(publicationDateId);
			}
			if (hasPageCount) {
				updateFields.push(`page_count = $${index++}`);
				params.push(pageCount);
			}
			if (hasCoverImageUrl) {
				updateFields.push(`cover_image_url = $${index++}`);
				params.push(coverImageUrl || null);
			}
			if (hasDescription) {
				updateFields.push(`description = $${index++}`);
				params.push(description || null);
			}
			if (hasBookTypeId) {
				updateFields.push(`book_type_id = $${index++}`);
				params.push(bookTypeId);
			}
			if (hasPublisherId) {
				updateFields.push(`publisher_id = $${index++}`);
				params.push(publisherId);
			}

			let updatedRow;
			if (updateFields.length > 0) {
				const result = await client.query(
					`UPDATE books
					 SET ${updateFields.join(", ")}, updated_at = NOW()
					 WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
					 RETURNING id, title, subtitle, isbn, publication_date_id, page_count, cover_image_url, description, book_type_id, publisher_id, created_at, updated_at`,
					params
				);
				if (result.rows.length === 0) {
					await client.query("ROLLBACK");
					return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
				}
				updatedRow = result.rows[0];
			} else {
				const result = await client.query(
					`SELECT id, title, subtitle, isbn, publication_date_id, page_count, cover_image_url, description, book_type_id, publisher_id, created_at, updated_at
					 FROM books
					 WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
					[userId, bookId]
				);
				if (result.rows.length === 0) {
					await client.query("ROLLBACK");
					return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
				}
				updatedRow = result.rows[0];
			}

			if (hasAuthorIds) {
				await client.query(
					`DELETE FROM book_authors WHERE user_id = $1 AND book_id = $2`,
					[userId, bookId]
				);
				if (authorIds && authorIds.length > 0) {
					const roleValues = authorIds.map((_, index) => (authorRoles ? authorRoles[index] ?? null : null));
					await client.query(
						`INSERT INTO book_authors (user_id, book_id, author_id, role, created_at, updated_at)
						 SELECT $1, $2, UNNEST($3::int[]), UNNEST($4::text[]), NOW(), NOW()
						 ON CONFLICT DO NOTHING`,
						[userId, bookId, authorIds, roleValues]
					);
				}
			}

			if (languageIds !== null) {
				await client.query(
					`DELETE FROM book_languages WHERE user_id = $1 AND book_id = $2`,
					[userId, bookId]
				);
				if (languageIds.length > 0) {
					const insertValues = languageIds.map((languageId) => `(${userId}, ${bookId}, ${languageId}, NOW(), NOW())`).join(", ");
					await client.query(
						`INSERT INTO book_languages (user_id, book_id, language_id, created_at, updated_at)
						 VALUES ${insertValues}
						 ON CONFLICT DO NOTHING`
					);
				}
			}

			if (hasTags) {
				await client.query(
					`DELETE FROM book_tags WHERE user_id = $1 AND book_id = $2`,
					[userId, bookId]
				);
				for (const tag of tags || []) {
					const name = buildTagDisplayName(tag);
					const normalized = normalizeTagName(tag);
					if (!name || !normalized) {
						continue;
					}
					const tagResult = await client.query(
						`INSERT INTO tags (user_id, name, name_normalized, created_at, updated_at)
						 VALUES ($1, $2, $3, NOW(), NOW())
						 ON CONFLICT (user_id, name_normalized)
						 DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
						 RETURNING id`,
						[userId, name, normalized]
					);
					const tagId = tagResult.rows[0].id;
					await client.query(
						`INSERT INTO book_tags (user_id, book_id, tag_id, created_at, updated_at)
						 VALUES ($1, $2, $3, NOW(), NOW())
						 ON CONFLICT DO NOTHING`,
						[userId, bookId, tagId]
					);
				}
			}

			if (hasSeries) {
				await client.query(
					`DELETE FROM book_series_books WHERE user_id = $1 AND book_id = $2`,
					[userId, bookId]
				);
				for (const entry of series || []) {
					const seriesId = parseId(typeof entry === "number" ? entry : entry?.seriesId ?? entry?.id);
					const { value: bookOrder, error: orderError } = parseOptionalInt(entry?.bookOrder, "Book order", { min: 1, max: 10000 });
					if (!Number.isInteger(seriesId) || orderError) {
						throw new Error("Series link data is invalid.");
					}
					await client.query(
						`INSERT INTO book_series_books (user_id, series_id, book_id, book_order, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
						[userId, seriesId, bookId, bookOrder ?? null]
					);
				}
			}

			await client.query("COMMIT");

			logToFile("BOOK_UPDATE", {
				status: "SUCCESS",
				user_id: userId,
				book_id: bookId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			const full = await pool.query(
				`SELECT b.id, b.title, b.subtitle, b.isbn, b.page_count, b.cover_image_url,
				        b.description, b.created_at, b.updated_at, b.book_type_id, b.publisher_id,
				        bt.name AS book_type_name, bt.description AS book_type_description,
				        p.name AS publisher_name, p.website AS publisher_website, p.notes AS publisher_notes,
				        fd.id AS publisher_founded_date_id, fd.day AS publisher_founded_day,
				        fd.month AS publisher_founded_month, fd.year AS publisher_founded_year, fd.text AS publisher_founded_text,
				        pd.id AS publication_date_id, pd.day AS pub_day, pd.month AS pub_month, pd.year AS pub_year, pd.text AS pub_text
				 FROM books b
				 LEFT JOIN dates pd ON b.publication_date_id = pd.id
				 LEFT JOIN book_types bt ON bt.id = b.book_type_id AND bt.user_id = b.user_id
				 LEFT JOIN publishers p ON p.id = b.publisher_id AND p.user_id = b.user_id
				 LEFT JOIN dates fd ON p.founded_date_id = fd.id
				 WHERE b.user_id = $1 AND b.id = $2`,
				[userId, bookId]
			);
			const row = full.rows[0];
			const relations = await fetchBookRelations(userId, bookId);
			const payload = buildBookPayload(row, "all", relations);

			return successResponse(res, 200, "Book updated successfully.", payload);
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("BOOK_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		if (error.message === "Series link data is invalid.") {
			return errorResponse(res, 400, "Validation Error", ["Series entries must include a valid seriesId and optional bookOrder."]);
		}
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the book."]);
	}
}

// PUT /book/:id - Update a book by id
router.put("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book id must be a valid integer."]);
	}
	return handleBookUpdate(req, res, id);
});

// PUT /book - Update a book by id, ISBN, or title
router.put("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetIsbn = normalizeIsbn(req.body?.isbn);
	const targetTitle = normalizeText(req.body?.title);

	if (!Number.isInteger(targetId) && !targetIsbn && !targetTitle) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a book id, ISBN, or title to update."]);
	}

	if (req.body?.isbn && !targetIsbn) {
		return errorResponse(res, 400, "Validation Error", ["ISBN must be 10–17 characters and contain only digits, hyphens, or X."]);
	}

	if (targetTitle) {
		const titleErrors = validateTitle(targetTitle);
		if (titleErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", titleErrors);
		}
	}

	const resolved = await resolveBookId({ userId, id: targetId, isbn: targetIsbn, title: targetTitle });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Book id, ISBN, and title must refer to the same record."]);
	}
	if (resolved.conflict) {
		return errorResponse(res, 409, "Multiple books matched.", ["Multiple books share this title. Please use id or ISBN."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
	}
	return handleBookUpdate(req, res, resolved.id);
});

async function handleBookDelete(req, res, bookId) {
	const userId = req.user.id;

	try {
		const result = await pool.query(
			`UPDATE books
			 SET deleted_at = NOW()
			 WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
			 RETURNING id, deleted_at`,
			[userId, bookId]
		);
		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
		}

		logToFile("BOOK_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			book_id: bookId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Book moved to trash.", {
			id: result.rows[0].id,
			deletedAt: result.rows[0].deleted_at
		});
	} catch (error) {
		logToFile("BOOK_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the book."]);
	}
}

// DELETE /book/:id - Remove a book by id
router.delete("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book id must be a valid integer."]);
	}
	return handleBookDelete(req, res, id);
});

// DELETE /book - Remove a book by id, ISBN, or title
router.delete("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetIsbn = normalizeIsbn(req.body?.isbn);
	const targetTitle = normalizeText(req.body?.title);

	if (!Number.isInteger(targetId) && !targetIsbn && !targetTitle) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a book id, ISBN, or title to delete."]);
	}

	if (req.body?.isbn && !targetIsbn) {
		return errorResponse(res, 400, "Validation Error", ["ISBN must be 10–17 characters and contain only digits, hyphens, or X."]);
	}

	if (targetTitle) {
		const titleErrors = validateTitle(targetTitle);
		if (titleErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", titleErrors);
		}
	}

	const resolved = await resolveBookId({ userId, id: targetId, isbn: targetIsbn, title: targetTitle });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Book id, ISBN, and title must refer to the same record."]);
	}
	if (resolved.conflict) {
		return errorResponse(res, 409, "Multiple books matched.", ["Multiple books share this title. Please use id or ISBN."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
	}

	return handleBookDelete(req, res, resolved.id);
});

// GET /book/trash - List deleted books
router.get("/trash", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	try {
		const result = await pool.query(
			`SELECT id, title, subtitle, isbn, deleted_at, created_at, updated_at
			 FROM books
			 WHERE user_id = $1 AND deleted_at IS NOT NULL
			 ORDER BY deleted_at DESC`,
			[userId]
		);

		const payload = result.rows.map((row) => ({
			id: row.id,
			title: row.title,
			subtitle: row.subtitle,
			isbn: row.isbn,
			deletedAt: row.deleted_at,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		}));

		return successResponse(res, 200, "Deleted books retrieved successfully.", { books: payload });
	} catch (error) {
		logToFile("BOOK_TRASH", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving deleted books."]);
	}
});

// GET /book/stats - Book statistics
router.get("/stats", requiresAuth, statsLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => normalizeText(field)).filter(Boolean)
		: [];

	const availableFields = new Set([
		"total",
		"deleted",
		"withIsbn",
		"withoutIsbn",
		"isbnBreakdown",
		"withPublicationDate",
		"withCoverImage",
		"withDescription",
		"withBookType",
		"withPublisher",
		"withPageCount",
		"avgPageCount",
		"medianPageCount",
		"minPageCount",
		"maxPageCount",
		"longestBook",
		"shortestBook",
		"withTags",
		"withLanguages",
		"withAuthors",
		"withSeries",
		"totalCopies",
		"publicationYearHistogram",
		"oldestPublicationYear",
		"newestPublicationYear",
		"metadataCompleteness",
		"recentlyAdded",
		"recentlyEdited"
	]);

	const selected = fields.length > 0 ? fields : Array.from(availableFields);
	const invalid = selected.filter((field) => !availableFields.has(field));
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}

	const needsBaseCounts = selected.some((field) => [
		"total",
		"deleted",
		"withIsbn",
		"withoutIsbn",
		"isbnBreakdown",
		"withPublicationDate",
		"withCoverImage",
		"withDescription",
		"withBookType",
		"withPublisher",
		"withPageCount",
		"avgPageCount",
		"medianPageCount",
		"minPageCount",
		"maxPageCount",
		"metadataCompleteness",
		"recentlyAdded",
		"recentlyEdited",
		"publicationYearHistogram",
		"oldestPublicationYear",
		"newestPublicationYear"
	].includes(field));

	try {
		const payload = {};
		let base = null;

		if (needsBaseCounts) {
			const baseResult = await pool.query(
				`SELECT
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL)::int AS total_active,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NOT NULL)::int AS deleted,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.isbn IS NOT NULL AND b.isbn <> '')::int AS with_isbn,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND (b.isbn IS NULL OR b.isbn = ''))::int AS without_isbn,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.publication_date_id IS NOT NULL)::int AS with_publication_date,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.cover_image_url IS NOT NULL AND b.cover_image_url <> '')::int AS with_cover_image,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.description IS NOT NULL AND b.description <> '')::int AS with_description,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.book_type_id IS NOT NULL)::int AS with_book_type,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.publisher_id IS NOT NULL)::int AS with_publisher,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.page_count IS NOT NULL)::int AS with_page_count,
				 AVG(b.page_count) FILTER (WHERE b.deleted_at IS NULL AND b.page_count IS NOT NULL) AS avg_page_count,
				 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.page_count)
				   FILTER (WHERE b.deleted_at IS NULL AND b.page_count IS NOT NULL) AS median_page_count,
				 MIN(b.page_count) FILTER (WHERE b.deleted_at IS NULL AND b.page_count IS NOT NULL) AS min_page_count,
				 MAX(b.page_count) FILTER (WHERE b.deleted_at IS NULL AND b.page_count IS NOT NULL) AS max_page_count,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.created_at >= NOW() - INTERVAL '7 days')::int AS added_7,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.created_at >= NOW() - INTERVAL '30 days')::int AS added_30,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.created_at >= NOW() - INTERVAL '365 days')::int AS added_365,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.updated_at >= NOW() - INTERVAL '7 days')::int AS edited_7,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.updated_at >= NOW() - INTERVAL '30 days')::int AS edited_30,
				 COUNT(*) FILTER (WHERE b.deleted_at IS NULL AND b.updated_at >= NOW() - INTERVAL '365 days')::int AS edited_365
				 FROM books b
				 WHERE b.user_id = $1`,
				[userId]
			);
			base = baseResult.rows[0] || {};
		}

		const totalActive = base?.total_active ?? 0;

		if (selected.includes("total")) payload.total = totalActive;
		if (selected.includes("deleted")) payload.deleted = base?.deleted ?? 0;
		if (selected.includes("withIsbn")) payload.withIsbn = base?.with_isbn ?? 0;
		if (selected.includes("withoutIsbn")) payload.withoutIsbn = base?.without_isbn ?? 0;
		if (selected.includes("withPublicationDate")) payload.withPublicationDate = base?.with_publication_date ?? 0;
		if (selected.includes("withCoverImage")) payload.withCoverImage = base?.with_cover_image ?? 0;
		if (selected.includes("withDescription")) payload.withDescription = base?.with_description ?? 0;
		if (selected.includes("withBookType")) payload.withBookType = base?.with_book_type ?? 0;
		if (selected.includes("withPublisher")) payload.withPublisher = base?.with_publisher ?? 0;
		if (selected.includes("withPageCount")) payload.withPageCount = base?.with_page_count ?? 0;

		if (selected.includes("isbnBreakdown")) {
			payload.isbnBreakdown = {
				withIsbn: base?.with_isbn ?? 0,
				withoutIsbn: base?.without_isbn ?? 0,
				withIsbnPercentage: totalActive > 0 ? Number(((base?.with_isbn ?? 0) / totalActive * 100).toFixed(1)) : 0,
				withoutIsbnPercentage: totalActive > 0 ? Number(((base?.without_isbn ?? 0) / totalActive * 100).toFixed(1)) : 0
			};
		}

		if (selected.includes("avgPageCount")) {
			payload.avgPageCount = base?.avg_page_count === null || base?.avg_page_count === undefined
				? null
				: Number.parseFloat(base.avg_page_count);
		}
		if (selected.includes("medianPageCount")) {
			payload.medianPageCount = base?.median_page_count === null || base?.median_page_count === undefined
				? null
				: Number.parseFloat(base.median_page_count);
		}
		if (selected.includes("minPageCount")) payload.minPageCount = base?.min_page_count ?? null;
		if (selected.includes("maxPageCount")) payload.maxPageCount = base?.max_page_count ?? null;

		if (selected.includes("recentlyAdded")) {
			payload.recentlyAdded = {
				last7Days: base?.added_7 ?? 0,
				last30Days: base?.added_30 ?? 0,
				last365Days: base?.added_365 ?? 0
			};
		}
		if (selected.includes("recentlyEdited")) {
			payload.recentlyEdited = {
				last7Days: base?.edited_7 ?? 0,
				last30Days: base?.edited_30 ?? 0,
				last365Days: base?.edited_365 ?? 0
			};
		}

		if (selected.includes("metadataCompleteness")) {
			const missingCover = totalActive - (base?.with_cover_image ?? 0);
			const missingDescription = totalActive - (base?.with_description ?? 0);
			const missingPublisher = totalActive - (base?.with_publisher ?? 0);
			const missingType = totalActive - (base?.with_book_type ?? 0);
			const missingPublicationDate = totalActive - (base?.with_publication_date ?? 0);
			const missingPageCount = totalActive - (base?.with_page_count ?? 0);
			payload.metadataCompleteness = {
				missingCover,
				missingDescription,
				missingPublisher,
				missingBookType: missingType,
				missingPublicationDate,
				missingPageCount,
				missingCoverPercentage: totalActive > 0 ? Number((missingCover / totalActive * 100).toFixed(1)) : 0,
				missingDescriptionPercentage: totalActive > 0 ? Number((missingDescription / totalActive * 100).toFixed(1)) : 0,
				missingPublisherPercentage: totalActive > 0 ? Number((missingPublisher / totalActive * 100).toFixed(1)) : 0,
				missingBookTypePercentage: totalActive > 0 ? Number((missingType / totalActive * 100).toFixed(1)) : 0,
				missingPublicationDatePercentage: totalActive > 0 ? Number((missingPublicationDate / totalActive * 100).toFixed(1)) : 0,
				missingPageCountPercentage: totalActive > 0 ? Number((missingPageCount / totalActive * 100).toFixed(1)) : 0
			};
		}

		if (selected.includes("withTags")) {
			const result = await pool.query(
				`SELECT COUNT(DISTINCT bt.book_id)::int AS count
				 FROM book_tags bt
				 JOIN books b2 ON bt.book_id = b2.id
				 WHERE bt.user_id = $1 AND b2.deleted_at IS NULL`,
				[userId]
			);
			payload.withTags = result.rows[0]?.count ?? 0;
		}
		if (selected.includes("withLanguages")) {
			const result = await pool.query(
				`SELECT COUNT(DISTINCT bl.book_id)::int AS count
				 FROM book_languages bl
				 JOIN books b2 ON bl.book_id = b2.id
				 WHERE bl.user_id = $1 AND b2.deleted_at IS NULL`,
				[userId]
			);
			payload.withLanguages = result.rows[0]?.count ?? 0;
		}
		if (selected.includes("withAuthors")) {
			const result = await pool.query(
				`SELECT COUNT(DISTINCT ba.book_id)::int AS count
				 FROM book_authors ba
				 JOIN books b2 ON ba.book_id = b2.id
				 WHERE ba.user_id = $1 AND b2.deleted_at IS NULL`,
				[userId]
			);
			payload.withAuthors = result.rows[0]?.count ?? 0;
		}
		if (selected.includes("withSeries")) {
			const result = await pool.query(
				`SELECT COUNT(DISTINCT bsb.book_id)::int AS count
				 FROM book_series_books bsb
				 JOIN books b2 ON bsb.book_id = b2.id
				 WHERE bsb.user_id = $1 AND b2.deleted_at IS NULL`,
				[userId]
			);
			payload.withSeries = result.rows[0]?.count ?? 0;
		}
		if (selected.includes("totalCopies")) {
			const result = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM book_copies bc
				 JOIN books b2 ON bc.book_id = b2.id
				 WHERE bc.user_id = $1 AND b2.deleted_at IS NULL`,
				[userId]
			);
			payload.totalCopies = result.rows[0]?.count ?? 0;
		}

		if (selected.includes("publicationYearHistogram") || selected.includes("oldestPublicationYear") || selected.includes("newestPublicationYear")) {
			const histResult = await pool.query(
				`SELECT d.year::int AS year, COUNT(*)::int AS count
				 FROM books b
				 JOIN dates d ON b.publication_date_id = d.id
				 WHERE b.user_id = $1 AND b.deleted_at IS NULL AND d.year IS NOT NULL
				 GROUP BY d.year
				 ORDER BY d.year ASC`,
				[userId]
			);
			const rows = histResult.rows;
			if (selected.includes("publicationYearHistogram")) {
				payload.publicationYearHistogram = rows.map((row) => ({
					year: row.year,
					bookCount: row.count,
					percentageOfBooks: totalActive > 0 ? Number(((row.count / totalActive) * 100).toFixed(1)) : 0
				}));
			}
			if (selected.includes("oldestPublicationYear")) {
				payload.oldestPublicationYear = rows.length > 0 ? rows[0].year : null;
			}
			if (selected.includes("newestPublicationYear")) {
				payload.newestPublicationYear = rows.length > 0 ? rows[rows.length - 1].year : null;
			}
		}

		if (selected.includes("longestBook")) {
			const longestResult = await pool.query(
				`SELECT id, title, page_count
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL AND page_count IS NOT NULL
				 ORDER BY page_count DESC, title ASC
				 LIMIT 1`,
				[userId]
			);
			const row = longestResult.rows[0];
			payload.longestBook = row ? { id: row.id, title: row.title, pageCount: row.page_count } : null;
		}

		if (selected.includes("shortestBook")) {
			const shortestResult = await pool.query(
				`SELECT id, title, page_count
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL AND page_count IS NOT NULL
				 ORDER BY page_count ASC, title ASC
				 LIMIT 1`,
				[userId]
			);
			const row = shortestResult.rows[0];
			payload.shortestBook = row ? { id: row.id, title: row.title, pageCount: row.page_count } : null;
		}

		return successResponse(res, 200, "Book stats retrieved successfully.", { stats: payload });
	} catch (error) {
		logToFile("BOOK_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve book stats at this time."]);
	}
});

// POST /book/restore - Restore a deleted book
router.post("/restore", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const targetId = parseId(req.body?.id);
	const targetIsbn = normalizeIsbn(req.body?.isbn);
	const targetTitle = normalizeText(req.body?.title);

	if (!Number.isInteger(targetId) && !targetIsbn && !targetTitle) {
		return errorResponse(res, 400, "Validation Error", ["Please provide a book id, ISBN, or title to restore."]);
	}
	if (req.body?.isbn && !targetIsbn) {
		return errorResponse(res, 400, "Validation Error", ["ISBN must be 10–17 characters and contain only digits, hyphens, or X."]);
	}
	if (targetTitle) {
		const titleErrors = validateTitle(targetTitle);
		if (titleErrors.length > 0) {
			return errorResponse(res, 400, "Validation Error", titleErrors);
		}
	}

	const resolved = await resolveDeletedBookId({ userId, id: targetId, isbn: targetIsbn, title: targetTitle });
	if (resolved.mismatch) {
		return errorResponse(res, 400, "Validation Error", ["Book id, ISBN, and title must refer to the same record."]);
	}
	if (resolved.conflict) {
		return errorResponse(res, 409, "Multiple books matched.", ["Multiple deleted books share this title. Please use id or ISBN."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
	}

	try {
		const result = await pool.query(
			`UPDATE books SET deleted_at = NULL WHERE user_id = $1 AND id = $2 RETURNING id`,
			[userId, resolved.id]
		);
		return successResponse(res, 200, "Book restored successfully.", { id: result.rows[0].id });
	} catch (error) {
		logToFile("BOOK_RESTORE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while restoring the book."]);
	}
});

module.exports = router;
