const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { validatePartialDateObject } = require("../utils/partial-date");
const { normalizeTagName, buildTagDisplayName } = require("../utils/tag-normalization");

const MAX_TITLE_LENGTH = 255;
const MAX_SUBTITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TAG_LENGTH = 50;
const MAX_LIST_LIMIT = 200;

function normalizeText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
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
	const trimmed = value.replace(/\s+/g, "").toUpperCase();
	if (!/^[0-9X-]{10,17}$/.test(trimmed)) {
		return null;
	}
	return trimmed;
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

async function resolveBookId({ userId, id, isbn, title }) {
	if (Number.isInteger(id)) {
		return { id };
	}
	if (isbn) {
		const result = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND isbn = $2`,
			[userId, isbn]
		);
		if (result.rows.length === 0) {
			return { id: null };
		}
		return { id: result.rows[0].id };
	}
	if (title) {
		const result = await pool.query(
			`SELECT id FROM books WHERE user_id = $1 AND title = $2`,
			[userId, title]
		);
		if (result.rows.length === 0) {
			return { id: null };
		}
		if (result.rows.length > 1) {
			return { id: null, conflict: true };
		}
		return { id: result.rows[0].id };
	}
	return { id: null };
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
	const [authors, languages, tags, series] = await Promise.all([
		pool.query(
			`SELECT author_id FROM book_authors WHERE user_id = $1 AND book_id = $2 ORDER BY author_id ASC`,
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
			`SELECT series_id, book_order, d.id AS published_date_id, d.day, d.month, d.year, d.text
			 FROM book_series_books bsb
			 LEFT JOIN dates d ON bsb.book_published_date_id = d.id
			 WHERE bsb.user_id = $1 AND bsb.book_id = $2
			 ORDER BY series_id ASC`,
			[userId, bookId]
		)
	]);

	return {
		authorIds: authors.rows.map((row) => row.author_id),
		languages: languages.rows,
		tags: tags.rows,
		series: series.rows.map((row) => ({
			seriesId: row.series_id,
			bookOrder: row.book_order,
			bookPublishedDate: row.published_date_id
				? { id: row.published_date_id, day: row.day, month: row.month, year: row.year, text: row.text }
				: null
		}))
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
			publisherId: base.publisherId,
			languages: relations?.languages || [],
			tags: relations?.tags || []
		};
	}

	return {
		...base,
		authors: relations?.authorIds || [],
		languages: relations?.languages || [],
		tags: relations?.tags || [],
		series: relations?.series || []
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
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const view = parseView(listParams);

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
			if (resolved.conflict) {
				return errorResponse(res, 409, "Multiple books matched.", ["Multiple books share this title. Please use id or ISBN."]);
			}
			if (!Number.isInteger(resolved.id)) {
				return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
			}

			const result = await pool.query(
				`SELECT b.id, b.title, b.subtitle, b.isbn, b.page_count, b.cover_image_url,
				        b.description, b.created_at, b.updated_at, b.book_type_id, b.publisher_id,
				        pd.id AS publication_date_id, pd.day AS pub_day, pd.month AS pub_month, pd.year AS pub_year, pd.text AS pub_text
				 FROM books b
				 LEFT JOIN dates pd ON b.publication_date_id = pd.id
				 WHERE b.user_id = $1 AND b.id = $2`,
				[userId, resolved.id]
			);

			const row = result.rows[0];
			const relations = view === "nameOnly" ? null : await fetchBookRelations(userId, resolved.id);
			const payload = buildBookPayload(row, view, relations);

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
		const parsed = parseId(listParams.filterBookTypeId);
		if (!Number.isInteger(parsed)) {
			errors.push("filterBookTypeId must be a valid integer.");
		} else {
			filters.push(`b.book_type_id = $${paramIndex++}`);
			values.push(parsed);
		}
	}

	if (listParams.filterPublisherId !== undefined) {
		const parsed = parseId(listParams.filterPublisherId);
		if (!Number.isInteger(parsed)) {
			errors.push("filterPublisherId must be a valid integer.");
		} else {
			filters.push(`b.publisher_id = $${paramIndex++}`);
			values.push(parsed);
		}
	}

	if (listParams.filterPageMin !== undefined) {
		const { value: pageMin, error } = parseOptionalInt(listParams.filterPageMin, "filterPageMin", { min: 1 });
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
		const authorId = parseId(listParams.filterAuthorId);
		if (!Number.isInteger(authorId)) {
			errors.push("filterAuthorId must be a valid integer.");
		} else {
			filters.push(`EXISTS (SELECT 1 FROM book_authors ba WHERE ba.user_id = $1 AND ba.book_id = b.id AND ba.author_id = $${paramIndex++})`);
			values.push(authorId);
		}
	}

	if (listParams.filterSeriesId !== undefined) {
		const seriesId = parseId(listParams.filterSeriesId);
		if (!Number.isInteger(seriesId)) {
			errors.push("filterSeriesId must be a valid integer.");
		} else {
			filters.push(`EXISTS (SELECT 1 FROM book_series_books bsb WHERE bsb.user_id = $1 AND bsb.book_id = b.id AND bsb.series_id = $${paramIndex++})`);
			values.push(seriesId);
		}
	}

	const filterTag = normalizeText(listParams.filterTag);
	if (filterTag) {
		const normalizedTag = normalizeTagName(filterTag);
		if (!normalizedTag) {
			errors.push("filterTag must be a valid tag.");
		} else {
			filters.push(`EXISTS (
				SELECT 1 FROM book_tags bt
				JOIN tags t ON bt.tag_id = t.id
				WHERE bt.user_id = $1 AND bt.book_id = b.id AND t.name_normalized = $${paramIndex++}
			)`);
			values.push(normalizedTag);
		}
	}

	if (listParams.filterLanguageId !== undefined) {
		const languageId = parseId(listParams.filterLanguageId);
		if (!Number.isInteger(languageId)) {
			errors.push("filterLanguageId must be a valid integer.");
		} else {
			filters.push(`EXISTS (
				SELECT 1 FROM book_languages bl
				WHERE bl.user_id = $1 AND bl.book_id = b.id AND bl.language_id = $${paramIndex++}
			)`);
			values.push(languageId);
		}
	}

	const filterLanguage = normalizeText(listParams.filterLanguage);
	if (filterLanguage) {
		filters.push(`EXISTS (
			SELECT 1 FROM book_languages bl
			JOIN languages l ON bl.language_id = l.id
			WHERE bl.user_id = $1 AND bl.book_id = b.id AND l.name_normalized = $${paramIndex++}
		)`);
		values.push(filterLanguage.toLowerCase());
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
			            pd.id AS publication_date_id, pd.day AS pub_day, pd.month AS pub_month, pd.year AS pub_year, pd.text AS pub_text,
			            make_date(pd.year, COALESCE(pd.month, 1), COALESCE(pd.day, 1)) AS pub_date_sort
			 FROM books b
			 LEFT JOIN dates pd ON b.publication_date_id = pd.id
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
});

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
	const rawAuthorIds = Array.isArray(req.body?.authorIds) ? req.body.authorIds : [];
	const authorIds = rawAuthorIds.map((value) => parseId(value)).filter(Number.isInteger);
	const hasInvalidAuthorIds = rawAuthorIds.length !== authorIds.length;

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
	if (hasInvalidAuthorIds) errors.push("authorIds must contain valid integers.");
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
			errors.push(...validatePartialDateObject(entry.bookPublishedDate, "Book Published Date"));
		}
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (isbn) {
			const existing = await pool.query(
				`SELECT id FROM books WHERE user_id = $1 AND isbn = $2`,
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
				const insertValues = authorIds.map((authorId) => `(${userId}, ${row.id}, ${authorId}, NOW(), NOW())`).join(", ");
				await client.query(
					`INSERT INTO book_authors (user_id, book_id, author_id, created_at, updated_at)
					 VALUES ${insertValues}
					 ON CONFLICT DO NOTHING`
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

			if (series.length > 0) {
				for (const entry of series) {
					const seriesId = parseId(typeof entry === "number" ? entry : entry?.seriesId ?? entry?.id);
					const { value: bookOrder, error: orderError } = parseOptionalInt(entry?.bookOrder, "Book order", { min: 1, max: 10000 });
					if (!Number.isInteger(seriesId) || orderError) {
						throw new Error("Series link data is invalid.");
					}
					let publishedDateId = publicationDateId;
					if (entry?.bookPublishedDate) {
						publishedDateId = await insertPartialDate(client, entry.bookPublishedDate);
					}
					await client.query(
						`INSERT INTO book_series_books (user_id, series_id, book_id, book_order, book_published_date_id, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
						[userId, seriesId, row.id, bookOrder ?? null, publishedDateId]
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

			const relations = await fetchBookRelations(userId, row.id);
			const payload = buildBookPayload({
				...row,
				pub_day: publicationDate?.day ?? null,
				pub_month: publicationDate?.month ?? null,
				pub_year: publicationDate?.year ?? null,
				pub_text: publicationDate?.text ?? null
			}, "all", relations);

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
	const hasAuthorIds = Object.prototype.hasOwnProperty.call(req.body || {}, "authorIds");
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
	const rawAuthorIds = hasAuthorIds && Array.isArray(req.body?.authorIds) ? req.body.authorIds : [];
	const authorIds = hasAuthorIds ? rawAuthorIds.map((value) => parseId(value)).filter(Number.isInteger) : null;
	const hasInvalidAuthorIds = hasAuthorIds && rawAuthorIds.length !== authorIds.length;

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
	if (hasInvalidAuthorIds) errors.push("authorIds must contain valid integers.");
	if (hasSeries && Array.isArray(req.body?.series)) {
		for (const entry of req.body.series) {
			if (entry && typeof entry === "object" && entry.bookPublishedDate) {
				errors.push(...validatePartialDateObject(entry.bookPublishedDate, "Book Published Date"));
			}
		}
	}

	if (!hasTitle && !hasSubtitle && !hasIsbn && !hasPublicationDate && !hasPageCount && !hasCoverImageUrl && !hasDescription
		&& !hasBookTypeId && !hasPublisherId && !hasAuthorIds && !hasLanguageIds && !hasLanguageNames && !hasTags && !hasSeries) {
		return errorResponse(res, 400, "No changes were provided.", ["Please provide at least one field to update."]);
	}
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		if (hasIsbn && isbn) {
			const existing = await pool.query(
				`SELECT id FROM books WHERE user_id = $1 AND isbn = $2 AND id <> $3`,
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
		if (hasAuthorIds && authorIds && authorIds.length > 0) {
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
					 WHERE user_id = $1 AND id = $2
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
					 WHERE user_id = $1 AND id = $2`,
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
					const insertValues = authorIds.map((authorId) => `(${userId}, ${bookId}, ${authorId}, NOW(), NOW())`).join(", ");
					await client.query(
						`INSERT INTO book_authors (user_id, book_id, author_id, created_at, updated_at)
						 VALUES ${insertValues}
						 ON CONFLICT DO NOTHING`
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
					let publishedDateId = updatedRow.publication_date_id;
					if (entry?.bookPublishedDate) {
						publishedDateId = await insertPartialDate(client, entry.bookPublishedDate);
					}
					await client.query(
						`INSERT INTO book_series_books (user_id, series_id, book_id, book_order, book_published_date_id, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
						[userId, seriesId, bookId, bookOrder ?? null, publishedDateId]
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
				        pd.id AS publication_date_id, pd.day AS pub_day, pd.month AS pub_month, pd.year AS pub_year, pd.text AS pub_text
				 FROM books b
				 LEFT JOIN dates pd ON b.publication_date_id = pd.id
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
	if (resolved.conflict) {
		return errorResponse(res, 409, "Multiple books matched.", ["Multiple books share this title. Please use id or ISBN."]);
	}
	if (!Number.isInteger(resolved.id)) {
		return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
	}
	return handleBookUpdate(req, res, resolved.id);
});

// DELETE /book/:id - Remove a book by id
router.delete("/:id", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const id = parseId(req.params.id);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Book id must be a valid integer."]);
	}

	try {
		const result = await pool.query(
			`DELETE FROM books WHERE user_id = $1 AND id = $2`,
			[userId, id]
		);
		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Book not found.", ["The requested book could not be located."]);
		}

		logToFile("BOOK_DELETE", {
			status: "SUCCESS",
			user_id: userId,
			book_id: id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Book deleted successfully.", { id });
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
});

module.exports = router;
