const express = require("express");

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { buildUserFeatureContext } = require("../utils/feature-settings");
const {
	getEffectiveDeweyDataset,
	getBrowsableNode,
	searchBrowsableNodes,
	buildBrowsableTree,
	normalizeDeweyCode,
	isValidDeweyCode,
	isCodeWithinDeweyBranch
} = require("../utils/dewey");

const router = express.Router();

const NODE_MODES = new Set(["exact", "descendants"]);
const MAX_SEARCH_LIMIT = 50;
const MAX_BOOK_LIMIT = 50;

router.use((req, res, next) => {
	logToFile("DEWEY_REQUEST", {
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
		logToFile("DEWEY_RESPONSE", {
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

function parseOptionalInt(value, fieldLabel, { min = 0, max = null } = {}) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) return { error: `${fieldLabel} must be an integer.` };
	if (parsed < min || (max !== null && parsed > max)) {
		const range = max !== null ? `between ${min} and ${max}` : `greater than or equal to ${min}`;
		return { error: `${fieldLabel} must be ${range}.` };
	}
	return { value: parsed };
}

async function getDeweyFeatureContext(userId) {
	const result = await pool.query(
		"SELECT id, dewey_enabled FROM users WHERE id = $1 AND is_disabled = false",
		[userId]
	);
	if (result.rows.length === 0) return { userFound: false, featureContext: null };
	return {
		userFound: true,
		featureContext: buildUserFeatureContext(result.rows[0])
	};
}

async function ensureActiveDeweyFeature(req, res) {
	const userId = req.user?.id || null;
	const { userFound, featureContext } = await getDeweyFeatureContext(userId);
	if (!userFound) {
		errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		return null;
	}
	if (!featureContext.features.dewey.enabled) {
		errorResponse(res, 403, "Dewey dashboard is not available for this account.", [
			"Dewey Decimal support is not currently active for this account."
		]);
		return null;
	}
	return featureContext;
}

async function fetchUserDeweyBookStubs(userId) {
	const result = await pool.query(
		`SELECT id, title, dewey_code, created_at
		 FROM books
		 WHERE user_id = $1
		   AND deleted_at IS NULL
		   AND dewey_code IS NOT NULL
		   AND trim(dewey_code) <> ''`,
		[userId]
	);

	return result.rows.map((row) => ({
		id: row.id,
		title: row.title || "Untitled",
		deweyCode: row.dewey_code,
		createdAt: row.created_at
	}));
}

async function fetchBooksByIds(userId, bookIds = []) {
	if (!Array.isArray(bookIds) || bookIds.length === 0) return [];

	const result = await pool.query(
		`SELECT
			b.id,
			b.title,
			b.subtitle,
			b.dewey_code,
			b.cover_image_url,
			b.created_at,
			bt.name AS book_type_name,
			pd.id AS publication_date_id,
			pd.day AS pub_day,
			pd.month AS pub_month,
			pd.year AS pub_year,
			pd.text AS pub_text,
			COALESCE((
				SELECT json_agg(json_build_object(
					'authorId', a.id,
					'authorName', a.display_name,
					'authorRole', ba.role
				) ORDER BY a.display_name ASC)
				FROM book_authors ba
				JOIN authors a ON a.id = ba.author_id
				WHERE ba.user_id = b.user_id
				  AND ba.book_id = b.id
				  AND a.deleted_at IS NULL
			), '[]'::json) AS authors,
			COALESCE((
				SELECT json_agg(json_build_object(
					'id', l.id,
					'name', l.name
				) ORDER BY l.name ASC)
				FROM book_languages bl
				JOIN languages l ON l.id = bl.language_id
				WHERE bl.user_id = b.user_id
				  AND bl.book_id = b.id
			), '[]'::json) AS languages,
			COALESCE((
				SELECT json_agg(json_build_object(
					'id', t.id,
					'name', t.name
				) ORDER BY t.name ASC)
				FROM book_tags btag
				JOIN tags t ON t.id = btag.tag_id
				WHERE btag.user_id = b.user_id
				  AND btag.book_id = b.id
				  AND t.deleted_at IS NULL
			), '[]'::json) AS tags
		FROM books b
		LEFT JOIN dates pd ON pd.id = b.publication_date_id
		LEFT JOIN book_types bt ON bt.id = b.book_type_id AND bt.user_id = b.user_id AND bt.deleted_at IS NULL
		WHERE b.user_id = $1
		  AND b.id = ANY($2::int[])
		  AND b.deleted_at IS NULL`,
		[userId, bookIds]
	);

	const byId = new Map();
	for (const row of result.rows) {
		byId.set(row.id, {
			id: row.id,
			title: row.title,
			subtitle: row.subtitle,
			deweyCode: row.dewey_code,
			coverImageUrl: row.cover_image_url,
			createdAt: row.created_at,
			bookTypeName: row.book_type_name ?? null,
			publicationDate: row.publication_date_id
				? { id: row.publication_date_id, day: row.pub_day, month: row.pub_month, year: row.pub_year, text: row.pub_text }
				: null,
			authors: Array.isArray(row.authors) ? row.authors : [],
			languages: Array.isArray(row.languages) ? row.languages : [],
			tags: Array.isArray(row.tags) ? row.tags : []
		});
	}

	return bookIds.map((id) => byId.get(id)).filter(Boolean);
}

function getNodeMode(rawMode) {
	const mode = String(rawMode || "descendants").trim().toLowerCase();
	return NODE_MODES.has(mode) ? mode : null;
}

function sortBookStubs(stubs = []) {
	return [...stubs].sort((left, right) => {
		const titleCompare = String(left.title || "").localeCompare(String(right.title || ""), undefined, { sensitivity: "base" });
		if (titleCompare !== 0) return titleCompare;
		return left.id - right.id;
	});
}

router.get("/roots", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;

	try {
		const featureContext = await ensureActiveDeweyFeature(req, res);
		if (!featureContext) return;

		const [dataset, bookStubs] = await Promise.all([
			getEffectiveDeweyDataset(userId),
			fetchUserDeweyBookStubs(userId)
		]);
		const tree = buildBrowsableTree(dataset.entries, bookStubs);

		logToFile("DEWEY_ROOTS", {
			status: "SUCCESS",
			user_id: userId,
			root_count: tree.roots.length,
			source: dataset.source
		}, "info");

		return successResponse(res, 200, "Dewey roots retrieved successfully.", {
			source: dataset.source,
			nodes: tree.roots
		});
	} catch (error) {
		logToFile("DEWEY_ROOTS", {
			status: "FAILURE",
			user_id: userId,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Dewey roots unavailable.", ["Unable to load Dewey roots right now."]);
	}
});

router.get("/search", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const query = String(req.query?.q || "").trim();
	const limitResult = parseOptionalInt(req.query?.limit, "limit", { min: 1, max: MAX_SEARCH_LIMIT });
	const errors = [];

	if (!query) errors.push("q is required.");
	if (limitResult.error) errors.push(limitResult.error);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const featureContext = await ensureActiveDeweyFeature(req, res);
		if (!featureContext) return;

		const [dataset, bookStubs] = await Promise.all([
			getEffectiveDeweyDataset(userId),
			fetchUserDeweyBookStubs(userId)
		]);
		const matches = searchBrowsableNodes(query, dataset.entries, bookStubs, {
			limit: limitResult.value || 25
		});

		logToFile("DEWEY_SEARCH", {
			status: "SUCCESS",
			user_id: userId,
			query,
			result_count: matches.length
		}, "info");

		return successResponse(res, 200, "Dewey search completed successfully.", {
			query,
			results: matches
		});
	} catch (error) {
		logToFile("DEWEY_SEARCH", {
			status: "FAILURE",
			user_id: userId,
			query,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Dewey search unavailable.", ["Unable to search the Dewey dataset right now."]);
	}
});

router.get("/node/:code", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user.id;
	const normalizedCode = normalizeDeweyCode(req.params?.code);
	const mode = getNodeMode(req.query?.mode);
	const pageResult = parseOptionalInt(req.query?.page, "page", { min: 1, max: 5000 });
	const limitResult = parseOptionalInt(req.query?.limit, "limit", { min: 1, max: MAX_BOOK_LIMIT });
	const errors = [];

	if (!normalizedCode || !isValidDeweyCode(normalizedCode)) {
		errors.push("code must be a valid Dewey Decimal value.");
	}
	if (!mode) {
		errors.push("mode must be either exact or descendants.");
	}
	if (pageResult.error) errors.push(pageResult.error);
	if (limitResult.error) errors.push(limitResult.error);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const featureContext = await ensureActiveDeweyFeature(req, res);
		if (!featureContext) return;

		const [dataset, bookStubs] = await Promise.all([
			getEffectiveDeweyDataset(userId),
			fetchUserDeweyBookStubs(userId)
		]);

		const node = getBrowsableNode(normalizedCode, dataset.entries, bookStubs);
		if (!node) {
			return errorResponse(res, 404, "Dewey node not found.", ["The requested Dewey node could not be located in the effective dataset."]);
		}

		const matchingBookStubs = sortBookStubs(
			bookStubs.filter((book) => (
				mode === "exact"
					? normalizeDeweyCode(book.deweyCode) === normalizedCode
					: isCodeWithinDeweyBranch(book.deweyCode, normalizedCode)
			))
		);

		const page = pageResult.value || 1;
		const limit = limitResult.value || 10;
		const total = matchingBookStubs.length;
		const offset = (page - 1) * limit;
		const pagedStubs = matchingBookStubs.slice(offset, offset + limit);
		const books = await fetchBooksByIds(userId, pagedStubs.map((book) => book.id));

		logToFile("DEWEY_NODE", {
			status: "SUCCESS",
			user_id: userId,
			code: normalizedCode,
			mode,
			child_count: node.childCount,
			book_count: total
		}, "info");

		return successResponse(res, 200, "Dewey node retrieved successfully.", {
			source: dataset.source,
			mode,
			node,
			childNodes: node.children,
			books: {
				items: books,
				total,
				page,
				limit
			}
		});
	} catch (error) {
		logToFile("DEWEY_NODE", {
			status: "FAILURE",
			user_id: userId,
			code: normalizedCode,
			mode,
			error_message: error.message
		}, "error");
		return errorResponse(res, 500, "Dewey node unavailable.", ["Unable to load the Dewey node right now."]);
	}
});

module.exports = router;
