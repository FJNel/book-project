const express = require("express");
const router = express.Router();

const pool = require("../db");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { successResponse, errorResponse } = require("../utils/response");
const { logToFile } = require("../utils/logging");
const { validatePartialDateObject } = require("../utils/partial-date");

const MAX_LIST_LIMIT = 2000;
const ENTITY_MAP = {
	all: "all",
	books: "books",
	authors: "authors",
	publishers: "publishers",
	bookseries: "bookSeries",
	booktypes: "bookTypes",
	tags: "tags",
	languages: "languages",
	storagelocations: "storageLocations"
};

router.use((req, res, next) => {
	logToFile("IMPORT_EXPORT_REQUEST", {
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
		logToFile("IMPORT_EXPORT_RESPONSE", {
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

function parseBooleanFlag(value) {
	if (value === undefined || value === null || value === "") return null;
	if (typeof value === "boolean") return value;
	const normalized = String(value).trim().toLowerCase();
	if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
	if (normalized === "false" || normalized === "0" || normalized === "no") return false;
	return null;
}

function parseOptionalInt(value, fieldLabel, { min = 1, max = MAX_LIST_LIMIT } = {}) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) return { error: `${fieldLabel} must be an integer.` };
	if (parsed < min || parsed > max) {
		return { error: `${fieldLabel} must be between ${min} and ${max}.` };
	}
	return { value: parsed };
}

function parseCsv(content) {
	const rows = [];
	let current = "";
	let inQuotes = false;
	let row = [];

	for (let i = 0; i < content.length; i += 1) {
		const char = content[i];
		const next = content[i + 1];

		if (char === "\"") {
			if (inQuotes && next === "\"") {
				current += "\"";
				i += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (char === "," && !inQuotes) {
			row.push(current);
			current = "";
			continue;
		}

		if ((char === "\n" || char === "\r") && !inQuotes) {
			if (char === "\r" && next === "\n") i += 1;
			row.push(current);
			current = "";
			if (row.length > 1 || row[0] !== "") {
				rows.push(row);
			}
			row = [];
			continue;
		}

		current += char;
	}

	if (current.length > 0 || row.length > 0) {
		row.push(current);
		rows.push(row);
	}

	return rows;
}

function toCsv(rows) {
	return rows.map((row) =>
		row.map((value) => {
			if (value === null || value === undefined) return "";
			const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
			if (stringValue.includes("\"") || stringValue.includes(",") || stringValue.includes("\n")) {
				return `"${stringValue.replace(/\"/g, "\"\"")}"`;
			}
			return stringValue;
		}).join(",")
	).join("\n");
}

function parseJsonish(value) {
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	if (!trimmed) return value;
	if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
		try {
			return JSON.parse(trimmed);
		} catch (_) {
			return value;
		}
	}
	if (trimmed.includes(";")) {
		return trimmed.split(";").map((entry) => entry.trim()).filter(Boolean);
	}
	return value;
}

async function fetchStoragePaths(userId) {
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
		SELECT id, path FROM location_paths`,
		[userId]
	);
	return new Map(result.rows.map((row) => [row.id, row.path]));
}

async function exportJsonLibrary(userId, includeDeleted) {
	const [bookTypes, languages, tags, authors, publishers, series, locations] = await Promise.all([
		pool.query(
			`SELECT id, name, description, created_at, updated_at FROM book_types WHERE user_id = $1 ORDER BY name ASC`,
			[userId]
		),
		pool.query(
			`SELECT id, name, name_normalized, created_at, updated_at FROM languages ORDER BY name ASC`
		),
		pool.query(
			`SELECT id, name, name_normalized, created_at, updated_at FROM tags WHERE user_id = $1 ORDER BY name ASC`,
			[userId]
		),
		pool.query(
			`SELECT a.id, a.display_name, a.first_names, a.last_name, a.deceased, a.bio, a.deleted_at,
			        a.created_at, a.updated_at,
			        bd.day AS birth_day, bd.month AS birth_month, bd.year AS birth_year, bd.text AS birth_text,
			        dd.day AS death_day, dd.month AS death_month, dd.year AS death_year, dd.text AS death_text
			 FROM authors a
			 LEFT JOIN dates bd ON a.birth_date_id = bd.id
			 LEFT JOIN dates dd ON a.death_date_id = dd.id
			 WHERE a.user_id = $1 ${includeDeleted ? "" : "AND a.deleted_at IS NULL"}
			 ORDER BY a.display_name ASC`,
			[userId]
		),
		pool.query(
			`SELECT p.id, p.name, p.website, p.notes, p.deleted_at, p.created_at, p.updated_at,
			        fd.day AS founded_day, fd.month AS founded_month, fd.year AS founded_year, fd.text AS founded_text
			 FROM publishers p
			 LEFT JOIN dates fd ON p.founded_date_id = fd.id
			 WHERE p.user_id = $1 ${includeDeleted ? "" : "AND p.deleted_at IS NULL"}
			 ORDER BY p.name ASC`,
			[userId]
		),
		pool.query(
			`SELECT id, name, description, website, deleted_at, created_at, updated_at
			 FROM book_series
			 WHERE user_id = $1 ${includeDeleted ? "" : "AND deleted_at IS NULL"}
			 ORDER BY name ASC`,
			[userId]
		),
		pool.query(
			`SELECT id, name, parent_id, notes, created_at, updated_at
			 FROM storage_locations
			 WHERE user_id = $1
			 ORDER BY name ASC`,
			[userId]
		)
	]);

	const locationPaths = await fetchStoragePaths(userId);

	const bookResult = await pool.query(
		`SELECT b.id, b.title, b.subtitle, b.isbn, b.page_count, b.cover_image_url, b.description,
		        b.book_type_id, bt.name AS book_type_name,
		        b.publisher_id, p.name AS publisher_name,
		        b.deleted_at, b.created_at, b.updated_at,
		        pd.day AS pub_day, pd.month AS pub_month, pd.year AS pub_year, pd.text AS pub_text
		 FROM books b
		 LEFT JOIN dates pd ON b.publication_date_id = pd.id
		 LEFT JOIN book_types bt ON b.book_type_id = bt.id
		 LEFT JOIN publishers p ON b.publisher_id = p.id
		 WHERE b.user_id = $1 ${includeDeleted ? "" : "AND b.deleted_at IS NULL"}
		 ORDER BY b.title ASC`,
		[userId]
	);

	const bookIds = bookResult.rows.map((row) => row.id);

	const [bookAuthors, bookLanguages, bookTags, bookSeriesRows, bookCopies] = await Promise.all([
		pool.query(
			`SELECT ba.book_id, a.display_name
			 FROM book_authors ba
			 JOIN authors a ON ba.author_id = a.id
			 WHERE ba.user_id = $1 AND ba.book_id = ANY($2::int[])`,
			[userId, bookIds.length > 0 ? bookIds : [0]]
		),
		pool.query(
			`SELECT bl.book_id, l.name
			 FROM book_languages bl
			 JOIN languages l ON bl.language_id = l.id
			 WHERE bl.user_id = $1 AND bl.book_id = ANY($2::int[])`,
			[userId, bookIds.length > 0 ? bookIds : [0]]
		),
		pool.query(
			`SELECT bt.book_id, t.name
			 FROM book_tags bt
			 JOIN tags t ON bt.tag_id = t.id
			 WHERE bt.user_id = $1 AND bt.book_id = ANY($2::int[])`,
			[userId, bookIds.length > 0 ? bookIds : [0]]
		),
		pool.query(
			`SELECT bsb.book_id, bs.name, bsb.book_order
			 FROM book_series_books bsb
			 JOIN book_series bs ON bsb.series_id = bs.id
			 WHERE bsb.user_id = $1 AND bsb.book_id = ANY($2::int[])`,
			[userId, bookIds.length > 0 ? bookIds : [0]]
		),
		pool.query(
			`SELECT bc.book_id, bc.storage_location_id, bc.acquisition_story, bc.acquisition_date_id,
			        bc.acquired_from, bc.acquisition_type, bc.acquisition_location, bc.notes,
			        d.day AS acq_day, d.month AS acq_month, d.year AS acq_year, d.text AS acq_text
			 FROM book_copies bc
			 LEFT JOIN dates d ON bc.acquisition_date_id = d.id
			 WHERE bc.user_id = $1 AND bc.book_id = ANY($2::int[])`,
			[userId, bookIds.length > 0 ? bookIds : [0]]
		)
	]);

	const authorMap = new Map();
	for (const row of bookAuthors.rows) {
		if (!authorMap.has(row.book_id)) authorMap.set(row.book_id, []);
		authorMap.get(row.book_id).push(row.display_name);
	}

	const languageMap = new Map();
	for (const row of bookLanguages.rows) {
		if (!languageMap.has(row.book_id)) languageMap.set(row.book_id, []);
		languageMap.get(row.book_id).push(row.name);
	}

	const tagMap = new Map();
	for (const row of bookTags.rows) {
		if (!tagMap.has(row.book_id)) tagMap.set(row.book_id, []);
		tagMap.get(row.book_id).push(row.name);
	}

	const seriesMap = new Map();
	for (const row of bookSeriesRows.rows) {
		if (!seriesMap.has(row.book_id)) seriesMap.set(row.book_id, []);
		seriesMap.get(row.book_id).push({ name: row.name, bookOrder: row.book_order });
	}

	const copyMap = new Map();
	for (const row of bookCopies.rows) {
		if (!copyMap.has(row.book_id)) copyMap.set(row.book_id, []);
		copyMap.get(row.book_id).push({
			storageLocationPath: row.storage_location_id ? locationPaths.get(row.storage_location_id) : null,
			acquisitionStory: row.acquisition_story,
			acquisitionDate: row.acquisition_date_id
				? { day: row.acq_day, month: row.acq_month, year: row.acq_year, text: row.acq_text }
				: null,
			acquiredFrom: row.acquired_from,
			acquisitionType: row.acquisition_type,
			acquisitionLocation: row.acquisition_location,
			notes: row.notes
		});
	}

	const books = bookResult.rows.map((row) => ({
		title: row.title,
		subtitle: row.subtitle,
		isbn: row.isbn,
		publicationDate: row.pub_text
			? { day: row.pub_day, month: row.pub_month, year: row.pub_year, text: row.pub_text }
			: null,
		pageCount: row.page_count,
		coverImageUrl: row.cover_image_url,
		description: row.description,
		bookTypeName: row.book_type_name,
		publisherName: row.publisher_name,
		authorDisplayNames: authorMap.get(row.id) || [],
		languageNames: languageMap.get(row.id) || [],
		tagNames: tagMap.get(row.id) || [],
		series: seriesMap.get(row.id) || [],
		bookCopies: copyMap.get(row.id) || [],
		deletedAt: row.deleted_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	}));

	return {
		bookTypes: bookTypes.rows,
		languages: languages.rows,
		tags: tags.rows,
		authors: authors.rows.map((row) => ({
			displayName: row.display_name,
			firstNames: row.first_names,
			lastName: row.last_name,
			birthDate: row.birth_text
				? { day: row.birth_day, month: row.birth_month, year: row.birth_year, text: row.birth_text }
				: null,
			deceased: row.deceased,
			deathDate: row.death_text
				? { day: row.death_day, month: row.death_month, year: row.death_year, text: row.death_text }
				: null,
			bio: row.bio,
			deletedAt: row.deleted_at,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		})),
		publishers: publishers.rows.map((row) => ({
			name: row.name,
			foundedDate: row.founded_text
				? { day: row.founded_day, month: row.founded_month, year: row.founded_year, text: row.founded_text }
				: null,
			website: row.website,
			notes: row.notes,
			deletedAt: row.deleted_at,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		})),
		bookSeries: series.rows.map((row) => ({
			name: row.name,
			description: row.description,
			website: row.website,
			deletedAt: row.deleted_at,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		})),
		storageLocations: locations.rows.map((row) => ({
			name: row.name,
			parentId: row.parent_id,
			notes: row.notes,
			path: locationPaths.get(row.id) || row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		})),
		books
	};
}

router.get("/export", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const format = normalizeText(params.format || "json").toLowerCase();
	const entity = normalizeText(params.entity || "all").toLowerCase();
	const includeDeleted = parseBooleanFlag(params.includeDeleted) ?? false;
	const entityKey = ENTITY_MAP[entity];

	if (!["json", "csv"].includes(format)) {
		return errorResponse(res, 400, "Validation Error", ["format must be json or csv."]);
	}
	if (!entityKey) {
		return errorResponse(res, 400, "Validation Error", ["Unknown entity for export."]);
	}

	try {
		if (format === "json") {
			const data = await exportJsonLibrary(userId, includeDeleted);
			if (entityKey !== "all") {
				return successResponse(res, 200, "Export generated successfully.", {
					format,
					entity,
					exportedAt: new Date().toISOString(),
					data: { [entityKey]: data[entityKey] }
				});
			}
			return successResponse(res, 200, "Export generated successfully.", {
				format,
				entity,
				exportedAt: new Date().toISOString(),
				data
			});
		}

		if (entityKey === "all") {
			return errorResponse(res, 400, "Validation Error", ["CSV export requires a specific entity."]);
		}

		const data = await exportJsonLibrary(userId, includeDeleted);
		const rows = data[entityKey];
		if (!Array.isArray(rows)) {
			return errorResponse(res, 400, "Validation Error", ["CSV export is only available for list entities."]);
		}

		const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
		const csvRows = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
		const csv = toCsv(csvRows);

		return successResponse(res, 200, "Export generated successfully.", {
			format,
			entity,
			exportedAt: new Date().toISOString(),
			csv
		});
	} catch (error) {
		logToFile("EXPORT", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while exporting data."]);
	}
});

function validateDateField(value, label) {
	if (!value) return [];
	return validatePartialDateObject(value, label);
}

router.post("/import", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const format = normalizeText(req.body?.format || "json").toLowerCase();
	const entity = normalizeText(req.body?.entity || "all").toLowerCase();
	const dryRun = parseBooleanFlag(req.body?.dryRun) ?? false;
	const data = req.body?.data;
	const csv = normalizeText(req.body?.csv);
	const entityKey = ENTITY_MAP[entity];

	if (!["json", "csv"].includes(format)) {
		return errorResponse(res, 400, "Validation Error", ["format must be json or csv."]);
	}
	if (!entityKey) {
		return errorResponse(res, 400, "Validation Error", ["Unknown entity for import."]);
	}

	if (format === "csv" && !entity) {
		return errorResponse(res, 400, "Validation Error", ["CSV import requires an entity."]);
	}

	let payload = data;
	if (format === "csv") {
		if (!csv) {
			return errorResponse(res, 400, "Validation Error", ["CSV content must be provided."]);
		}
		const rows = parseCsv(csv);
		if (rows.length < 2) {
			return errorResponse(res, 400, "Validation Error", ["CSV must include a header row and at least one data row."]);
		}
		const headers = rows[0].map((header) => normalizeText(header));
		payload = rows.slice(1).map((row) => {
			const entry = {};
			headers.forEach((header, index) => {
				entry[header] = row[index] ?? "";
			});
			return entry;
		});
	}

	if (!payload) {
		return errorResponse(res, 400, "Validation Error", ["Import data must be provided."]);
	}

	const summary = {
		entity,
		format,
		dryRun,
		processed: 0,
		created: 0,
		updated: 0,
		errors: []
	};

	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		// Basic upsert for simple entities
		const upsertSimple = async (table, nameField, items) => {
			for (const item of items) {
				const name = normalizeText(item[nameField]);
				if (!name) {
					summary.errors.push(`${table}: name is required.`);
					continue;
				}
				summary.processed += 1;
				if (dryRun) continue;
				const result = await client.query(
					`INSERT INTO ${table} (user_id, ${nameField}, created_at, updated_at)
					 VALUES ($1, $2, NOW(), NOW())
					 ON CONFLICT (user_id, ${nameField})
					 DO UPDATE SET ${nameField} = EXCLUDED.${nameField}, updated_at = NOW()
					 RETURNING id`,
					[userId, name]
				);
				if (result.rowCount > 0) summary.updated += 1;
			}
		};
		const upsertTags = async (items) => {
			for (const item of items) {
				const name = normalizeText(item.name);
				if (!name) {
					summary.errors.push("tags: name is required.");
					continue;
				}
				summary.processed += 1;
				if (dryRun) continue;
				const normalized = name.toLowerCase();
				await client.query(
					`INSERT INTO tags (user_id, name, name_normalized, created_at, updated_at)
					 VALUES ($1, $2, $3, NOW(), NOW())
					 ON CONFLICT (user_id, name_normalized)
					 DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
					[userId, name, normalized]
				);
				summary.updated += 1;
			}
		};

		const locationPathMap = new Map();
		const loadExistingLocations = async () => {
			const existing = await client.query(
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
				SELECT id, path FROM location_paths`,
				[userId]
			);
			existing.rows.forEach((row) => locationPathMap.set(row.path, row.id));
		};

		const ensureLocationPath = async (path, notes) => {
			if (locationPathMap.has(path)) {
				return locationPathMap.get(path);
			}
			const segments = path.split("->").map((seg) => seg.trim()).filter(Boolean);
			let parentId = null;
			let currentPath = "";
			for (const segment of segments) {
				currentPath = currentPath ? `${currentPath} -> ${segment}` : segment;
				if (locationPathMap.has(currentPath)) {
					parentId = locationPathMap.get(currentPath);
					continue;
				}
				const result = await client.query(
					`INSERT INTO storage_locations (user_id, name, parent_id, notes, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, NOW(), NOW())
					 RETURNING id`,
					[userId, segment, parentId, normalizeText(notes) || null]
				);
				const newId = result.rows[0].id;
				locationPathMap.set(currentPath, newId);
				parentId = newId;
			}
			return locationPathMap.get(path);
		};

		if (entityKey === "all" || entityKey === "authors") {
			const authors = entityKey === "authors" ? payload : payload.authors || [];
			for (const author of authors) {
				const displayName = normalizeText(author.displayName || author.display_name);
				if (!displayName) {
					summary.errors.push("authors: displayName is required.");
					continue;
				}
				const birthDateValue = parseJsonish(author.birthDate);
				const deathDateValue = parseJsonish(author.deathDate);
				const birthErrors = validateDateField(birthDateValue, "Birth Date");
				const deathErrors = validateDateField(deathDateValue, "Death Date");
				if (birthErrors.length > 0 || deathErrors.length > 0) {
					summary.errors.push(...birthErrors, ...deathErrors);
					continue;
				}
				summary.processed += 1;
				if (dryRun) continue;

				const birthDateId = birthDateValue
					? (await client.query(
						`INSERT INTO dates (day, month, year, text, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
						[birthDateValue.day ?? null, birthDateValue.month ?? null, birthDateValue.year ?? null, birthDateValue.text]
					)).rows[0].id
					: null;
				const deathDateId = deathDateValue
					? (await client.query(
						`INSERT INTO dates (day, month, year, text, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
						[deathDateValue.day ?? null, deathDateValue.month ?? null, deathDateValue.year ?? null, deathDateValue.text]
					)).rows[0].id
					: null;

				await client.query(
					`INSERT INTO authors (user_id, display_name, first_names, last_name, birth_date_id, deceased, death_date_id, bio, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
					 ON CONFLICT (user_id, display_name)
					 DO UPDATE SET first_names = EXCLUDED.first_names, last_name = EXCLUDED.last_name,
					              birth_date_id = EXCLUDED.birth_date_id, deceased = EXCLUDED.deceased,
					              death_date_id = EXCLUDED.death_date_id, bio = EXCLUDED.bio, updated_at = NOW()`,
					[
						userId,
						displayName,
						normalizeText(author.firstNames),
						normalizeText(author.lastName),
						birthDateId,
						Boolean(author.deceased),
						deathDateId,
						normalizeText(author.bio)
					]
				);
				summary.updated += 1;
			}
		}

		if (entityKey === "all" || entityKey === "publishers") {
			const publishers = entityKey === "publishers" ? payload : payload.publishers || [];
			for (const publisher of publishers) {
				const name = normalizeText(publisher.name);
				if (!name) {
					summary.errors.push("publishers: name is required.");
					continue;
				}
				const foundedDateValue = parseJsonish(publisher.foundedDate);
				const foundedErrors = validateDateField(foundedDateValue, "Founded Date");
				if (foundedErrors.length > 0) {
					summary.errors.push(...foundedErrors);
					continue;
				}
				summary.processed += 1;
				if (dryRun) continue;

				const foundedDateId = foundedDateValue
					? (await client.query(
						`INSERT INTO dates (day, month, year, text, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
						[foundedDateValue.day ?? null, foundedDateValue.month ?? null, foundedDateValue.year ?? null, foundedDateValue.text]
					)).rows[0].id
					: null;

				await client.query(
					`INSERT INTO publishers (user_id, name, founded_date_id, website, notes, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
					 ON CONFLICT (user_id, name)
					 DO UPDATE SET founded_date_id = EXCLUDED.founded_date_id, website = EXCLUDED.website,
					              notes = EXCLUDED.notes, updated_at = NOW()`,
					[userId, name, foundedDateId, normalizeText(publisher.website), normalizeText(publisher.notes)]
				);
				summary.updated += 1;
			}
		}

		if (entityKey === "all" || entityKey === "bookSeries") {
			const series = entityKey === "bookSeries" ? payload : payload.bookSeries || [];
			for (const entry of series) {
				const name = normalizeText(entry.name);
				if (!name) {
					summary.errors.push("bookSeries: name is required.");
					continue;
				}
				summary.processed += 1;
				if (dryRun) continue;
				await client.query(
					`INSERT INTO book_series (user_id, name, description, website, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, NOW(), NOW())
					 ON CONFLICT (user_id, name)
					 DO UPDATE SET description = EXCLUDED.description, website = EXCLUDED.website, updated_at = NOW()`,
					[userId, name, normalizeText(entry.description), normalizeText(entry.website)]
				);
				summary.updated += 1;
			}
		}

		if (entityKey === "all" || entityKey === "tags") {
			const tags = entityKey === "tags" ? payload : payload.tags || [];
			await upsertTags(tags);
		}

		if (entityKey === "all" || entityKey === "bookTypes") {
			const types = entityKey === "bookTypes" ? payload : payload.bookTypes || [];
			for (const entry of types) {
				const name = normalizeText(entry.name);
				if (!name) {
					summary.errors.push("bookTypes: name is required.");
					continue;
				}
				summary.processed += 1;
				if (dryRun) continue;
				await client.query(
					`INSERT INTO book_types (user_id, name, description, created_at, updated_at)
					 VALUES ($1, $2, $3, NOW(), NOW())
					 ON CONFLICT (user_id, name)
					 DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()`,
					[userId, name, normalizeText(entry.description)]
				);
				summary.updated += 1;
			}
		}

		if (entityKey === "all" || entityKey === "languages") {
			const languages = entityKey === "languages" ? payload : payload.languages || [];
			for (const entry of languages) {
				const name = normalizeText(entry.name);
				if (!name) {
					summary.errors.push("languages: name is required.");
					continue;
				}
				summary.processed += 1;
				if (dryRun) continue;
				const normalized = name.toLowerCase();
				await client.query(
					`INSERT INTO languages (name, name_normalized, created_at, updated_at)
					 VALUES ($1, $2, NOW(), NOW())
					 ON CONFLICT (name_normalized)
					 DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
					[name, normalized]
				);
				summary.updated += 1;
			}
		}

		if (entityKey === "all" || entityKey === "storageLocations") {
			const locations = entityKey === "storageLocations" ? payload : payload.storageLocations || [];
			await loadExistingLocations();
			for (const location of locations) {
				const path = normalizeText(location.path);
				const name = normalizeText(location.name);
				if (!path && !name) {
					summary.errors.push("storageLocations: path or name is required.");
					continue;
				}
				const resolvedPath = path || name;
				summary.processed += 1;
				if (dryRun) continue;
				await ensureLocationPath(resolvedPath, location.notes);
				summary.updated += 1;
			}
		}

		if (entityKey === "all" || entityKey === "books") {
			const books = entityKey === "books" ? payload : payload.books || [];
			if (books.length > 0) {
				await loadExistingLocations();
			}

			const [authorRows, publisherRows, seriesRows, typeRows, tagRows, languageRows] = await Promise.all([
				client.query(`SELECT id, display_name FROM authors WHERE user_id = $1`, [userId]),
				client.query(`SELECT id, name FROM publishers WHERE user_id = $1`, [userId]),
				client.query(`SELECT id, name FROM book_series WHERE user_id = $1`, [userId]),
				client.query(`SELECT id, name FROM book_types WHERE user_id = $1`, [userId]),
				client.query(`SELECT id, name, name_normalized FROM tags WHERE user_id = $1`, [userId]),
				client.query(`SELECT id, name, name_normalized FROM languages`, [])
			]);

			const authorMap = new Map(authorRows.rows.map((row) => [row.display_name, row.id]));
			const publisherMap = new Map(publisherRows.rows.map((row) => [row.name, row.id]));
			const seriesMap = new Map(seriesRows.rows.map((row) => [row.name, row.id]));
			const typeMap = new Map(typeRows.rows.map((row) => [row.name, row.id]));
			const tagMap = new Map(tagRows.rows.map((row) => [row.name_normalized, row.id]));
			const languageMap = new Map(languageRows.rows.map((row) => [row.name_normalized, row.id]));

			for (const book of books) {
				const title = normalizeText(book.title);
				if (!title) {
					summary.errors.push("books: title is required.");
					continue;
				}
				if (title.length < 2 || title.length > 255) {
					summary.errors.push("books: title must be between 2 and 255 characters.");
					continue;
				}
				const publicationDateValue = parseJsonish(book.publicationDate);
				const publicationErrors = validateDateField(publicationDateValue, "Publication Date");
				if (publicationErrors.length > 0) {
					summary.errors.push(...publicationErrors);
					continue;
				}

				summary.processed += 1;
				if (dryRun) continue;

				let publicationDateId = null;
				if (publicationDateValue) {
					const dateResult = await client.query(
						`INSERT INTO dates (day, month, year, text, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, NOW(), NOW())
						 RETURNING id`,
						[
							publicationDateValue.day ?? null,
							publicationDateValue.month ?? null,
							publicationDateValue.year ?? null,
							publicationDateValue.text
						]
					);
					publicationDateId = dateResult.rows[0].id;
				}

				const bookTypeName = normalizeText(book.bookTypeName);
				const publisherName = normalizeText(book.publisherName);
				const bookTypeId = bookTypeName ? typeMap.get(bookTypeName) || null : null;
				const publisherId = publisherName ? publisherMap.get(publisherName) || null : null;
				if (bookTypeName && !bookTypeId) {
					summary.errors.push(`books: bookTypeName "${bookTypeName}" was not found.`);
					continue;
				}
				if (publisherName && !publisherId) {
					summary.errors.push(`books: publisherName "${publisherName}" was not found.`);
					continue;
				}

				const isbn = normalizeText(book.isbn);
				const insertResult = await client.query(
					`INSERT INTO books (user_id, title, subtitle, isbn, publication_date_id, page_count, cover_image_url, description, book_type_id, publisher_id, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
					 RETURNING id`,
					[
						userId,
						title,
						normalizeText(book.subtitle) || null,
						isbn || null,
						publicationDateId,
						book.pageCount ?? null,
						normalizeText(book.coverImageUrl) || null,
						normalizeText(book.description) || null,
						bookTypeId,
						publisherId
					]
				);
				const bookId = insertResult.rows[0].id;

				const authorDisplayNamesRaw = parseJsonish(book.authorDisplayNames ?? book.authorDisplayNamesRaw ?? book.authorDisplayNamesCsv ?? book.authorDisplayNames);
				const authorDisplayNames = Array.isArray(authorDisplayNamesRaw)
					? authorDisplayNamesRaw
					: (typeof authorDisplayNamesRaw === "string" && authorDisplayNamesRaw ? [authorDisplayNamesRaw] : []);
				for (const authorName of authorDisplayNames) {
					const authorId = authorMap.get(normalizeText(authorName));
					if (!authorId) {
						summary.errors.push(`books: author "${authorName}" was not found.`);
						continue;
					}
					await client.query(
						`INSERT INTO book_authors (user_id, book_id, author_id, created_at, updated_at)
						 VALUES ($1, $2, $3, NOW(), NOW())
						 ON CONFLICT (user_id, book_id, author_id) DO NOTHING`,
						[userId, bookId, authorId]
					);
				}

				const languageNamesRaw = parseJsonish(book.languageNames ?? book.languageNamesRaw ?? book.languageNamesCsv ?? book.languageNames);
				const languageNames = Array.isArray(languageNamesRaw)
					? languageNamesRaw
					: (typeof languageNamesRaw === "string" && languageNamesRaw ? [languageNamesRaw] : []);
				for (const languageName of languageNames) {
					const normalized = normalizeText(languageName).toLowerCase();
					const languageId = languageMap.get(normalized);
					if (!languageId) {
						summary.errors.push(`books: language "${languageName}" was not found.`);
						continue;
					}
					await client.query(
						`INSERT INTO book_languages (user_id, book_id, language_id, created_at, updated_at)
						 VALUES ($1, $2, $3, NOW(), NOW())
						 ON CONFLICT (user_id, book_id, language_id) DO NOTHING`,
						[userId, bookId, languageId]
					);
				}

				const tagNamesRaw = parseJsonish(book.tagNames ?? book.tagNamesRaw ?? book.tagNamesCsv ?? book.tagNames);
				const tagNames = Array.isArray(tagNamesRaw)
					? tagNamesRaw
					: (typeof tagNamesRaw === "string" && tagNamesRaw ? [tagNamesRaw] : []);
				for (const tagName of tagNames) {
					const normalized = normalizeText(tagName).toLowerCase();
					let tagId = tagMap.get(normalized);
					if (!tagId) {
						const created = await client.query(
							`INSERT INTO tags (user_id, name, name_normalized, created_at, updated_at)
							 VALUES ($1, $2, $3, NOW(), NOW())
							 RETURNING id`,
							[userId, normalizeText(tagName), normalized]
						);
						tagId = created.rows[0].id;
						tagMap.set(normalized, tagId);
					}
					await client.query(
						`INSERT INTO book_tags (user_id, book_id, tag_id, created_at, updated_at)
						 VALUES ($1, $2, $3, NOW(), NOW())
						 ON CONFLICT (user_id, book_id, tag_id) DO NOTHING`,
						[userId, bookId, tagId]
					);
				}

				const seriesRaw = parseJsonish(book.series ?? book.seriesRaw ?? book.seriesCsv ?? book.series);
				const seriesEntries = Array.isArray(seriesRaw)
					? seriesRaw
					: (seriesRaw ? [seriesRaw] : []);
				for (const seriesEntry of seriesEntries) {
					const seriesName = normalizeText(seriesEntry.name || seriesEntry.seriesName);
					const seriesId = seriesMap.get(seriesName);
					if (!seriesId) {
						summary.errors.push(`books: series "${seriesName}" was not found.`);
						continue;
					}
					await client.query(
						`INSERT INTO book_series_books (user_id, series_id, book_id, book_order, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, NOW(), NOW())
						 ON CONFLICT (user_id, series_id, book_id) DO UPDATE SET book_order = EXCLUDED.book_order, updated_at = NOW()`,
						[userId, seriesId, bookId, seriesEntry.bookOrder ?? null]
					);
				}

				const copiesRaw = parseJsonish(book.bookCopies ?? book.bookCopiesRaw ?? book.bookCopiesCsv ?? book.bookCopies);
				const copies = Array.isArray(copiesRaw)
					? copiesRaw
					: (copiesRaw ? [copiesRaw] : []);
				for (const copy of copies) {
					const storagePath = normalizeText(copy.storageLocationPath);
					const storageId = storagePath ? await ensureLocationPath(storagePath, null) : null;
					const acquisitionDateValue = parseJsonish(copy.acquisitionDate);
					const acquisitionErrors = validateDateField(acquisitionDateValue, "Acquisition Date");
					if (acquisitionErrors.length > 0) {
						summary.errors.push(...acquisitionErrors);
						continue;
					}

					let acquisitionDateId = null;
					if (acquisitionDateValue) {
						const acq = await client.query(
							`INSERT INTO dates (day, month, year, text, created_at, updated_at)
							 VALUES ($1, $2, $3, $4, NOW(), NOW())
							 RETURNING id`,
							[
								acquisitionDateValue.day ?? null,
								acquisitionDateValue.month ?? null,
								acquisitionDateValue.year ?? null,
								acquisitionDateValue.text
							]
						);
						acquisitionDateId = acq.rows[0].id;
					}

					await client.query(
						`INSERT INTO book_copies (user_id, book_id, storage_location_id, acquisition_story, acquisition_date_id,
						 acquired_from, acquisition_type, acquisition_location, notes, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
						[
							userId,
							bookId,
							storageId,
							normalizeText(copy.acquisitionStory) || null,
							acquisitionDateId,
							normalizeText(copy.acquiredFrom) || null,
							normalizeText(copy.acquisitionType) || null,
							normalizeText(copy.acquisitionLocation) || null,
							normalizeText(copy.notes) || null
						]
					);
				}

				summary.created += 1;
			}
		}

		if (summary.errors.length > 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 400, "Validation Error", summary.errors);
		}

		if (dryRun) {
			await client.query("ROLLBACK");
			return successResponse(res, 200, "Dry run completed.", summary);
		}

		await client.query("COMMIT");
		return successResponse(res, 200, "Import completed.", summary);
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("IMPORT", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while importing data."]);
	} finally {
		client.release();
	}
});

module.exports = router;
