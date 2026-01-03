const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

router.use((req, res, next) => {
	logToFile("LANGUAGES_REQUEST", {
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
		logToFile("LANGUAGES_RESPONSE", {
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
	if (!Number.isInteger(parsed)) {
		return { error: `${fieldLabel} must be an integer.` };
	}
	if (parsed < min || (max !== null && parsed > max)) {
		const range = max !== null ? `between ${min} and ${max}` : `greater than or equal to ${min}`;
		return { error: `${fieldLabel} must be ${range}.` };
	}
	return { value: parsed };
}

// GET /languages/stats - Language usage statistics
router.get("/stats", requiresAuth, statsLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => (typeof field === "string" ? field.trim() : "")).filter(Boolean)
		: [];

	const availableFields = new Set([
		"languagesInLibrary",
		"mostCommonLanguage",
		"mostCommonLanguages",
		"rarestLanguage",
		"languageDiversityScore",
		"booksWithSingleLanguage",
		"booksWithMultipleLanguages",
		"booksMissingLanguage",
		"languageCombinations",
		"languageBreakdown",
		"breakdownPerLanguage"
	]);
	const selected = fields.length > 0 ? fields : Array.from(availableFields);
	const invalid = selected.filter((field) => !availableFields.has(field));
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}

	try {
		const payload = {};

		const totalBooksResult = await pool.query(
			`SELECT COUNT(*)::int AS count FROM books WHERE user_id = $1 AND deleted_at IS NULL`,
			[userId]
		);
		const totalBooks = totalBooksResult.rows[0]?.count ?? 0;

		const { value: topLimit, error: topLimitError } = parseOptionalInt(params.topLimit, "topLimit", { min: 1, max: 50 });
		if (topLimitError) {
			return errorResponse(res, 400, "Validation Error", [topLimitError]);
		}
		const { value: comboLimit, error: comboLimitError } = parseOptionalInt(params.comboLimit, "comboLimit", { min: 1, max: 50 });
		if (comboLimitError) {
			return errorResponse(res, 400, "Validation Error", [comboLimitError]);
		}
		const topLimitValue = topLimit ?? 5;
		const comboLimitValue = comboLimit ?? 10;

		let distinctLanguages = null;
		if (selected.includes("languagesInLibrary") || selected.includes("languageDiversityScore")) {
			const distinctResult = await pool.query(
				`SELECT COUNT(DISTINCT bl.language_id)::int AS count
				 FROM book_languages bl
				 JOIN books b ON bl.book_id = b.id
				 WHERE bl.user_id = $1 AND b.deleted_at IS NULL`,
				[userId]
			);
			distinctLanguages = distinctResult.rows[0]?.count ?? 0;
		}

		if (selected.includes("languagesInLibrary")) {
			payload.languagesInLibrary = distinctLanguages ?? 0;
		}

		if (selected.includes("languageDiversityScore")) {
			const diversity = totalBooks > 0 ? Number((distinctLanguages / totalBooks).toFixed(3)) : 0;
			payload.languageDiversityScore = diversity;
		}

		if (selected.includes("booksWithSingleLanguage")
			|| selected.includes("booksWithMultipleLanguages")
			|| selected.includes("booksMissingLanguage")) {
			const langCountsResult = await pool.query(
				`SELECT bl.book_id, COUNT(*)::int AS lang_count
				 FROM book_languages bl
				 JOIN books b ON bl.book_id = b.id
				 WHERE bl.user_id = $1 AND b.deleted_at IS NULL
				 GROUP BY bl.book_id`,
				[userId]
			);
			const counts = langCountsResult.rows.map((row) => row.lang_count);
			const withLanguages = counts.length;
			const singleLanguage = counts.filter((count) => count === 1).length;
			const multiLanguage = counts.filter((count) => count > 1).length;
			const missingLanguage = totalBooks - withLanguages;

			if (selected.includes("booksWithSingleLanguage")) {
				payload.booksWithSingleLanguage = {
					count: singleLanguage,
					percentage: totalBooks > 0 ? Number(((singleLanguage / totalBooks) * 100).toFixed(1)) : 0
				};
			}
			if (selected.includes("booksWithMultipleLanguages")) {
				payload.booksWithMultipleLanguages = {
					count: multiLanguage,
					percentage: totalBooks > 0 ? Number(((multiLanguage / totalBooks) * 100).toFixed(1)) : 0
				};
			}
			if (selected.includes("booksMissingLanguage")) {
				payload.booksMissingLanguage = {
					count: missingLanguage,
					percentage: totalBooks > 0 ? Number(((missingLanguage / totalBooks) * 100).toFixed(1)) : 0
				};
			}
		}

		if (selected.includes("mostCommonLanguage")
			|| selected.includes("mostCommonLanguages")
			|| selected.includes("rarestLanguage")
			|| selected.includes("languageBreakdown")
			|| selected.includes("breakdownPerLanguage")) {
			const countsResult = await pool.query(
				`SELECT l.id, l.name, COUNT(DISTINCT bl.book_id)::int AS book_count
				 FROM book_languages bl
				 JOIN books b ON bl.book_id = b.id
				 JOIN languages l ON bl.language_id = l.id
				 WHERE bl.user_id = $1 AND b.deleted_at IS NULL
				 GROUP BY l.id, l.name
				 ORDER BY book_count DESC, l.name ASC`,
				[userId]
			);
			const rows = countsResult.rows;
			const most = rows.find((row) => row.book_count > 0) || null;
			const least = [...rows].reverse().find((row) => row.book_count > 0) || null;

			if (selected.includes("languageBreakdown") || selected.includes("breakdownPerLanguage")) {
				const breakdown = rows.map((row) => ({
					id: row.id,
					name: row.name,
					bookCount: row.book_count,
					percentage: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
				}));
				if (selected.includes("languageBreakdown")) {
					payload.languageBreakdown = breakdown;
				}
				if (selected.includes("breakdownPerLanguage")) {
					payload.breakdownPerLanguage = breakdown;
				}
			}

			if (selected.includes("mostCommonLanguage")) {
				payload.mostCommonLanguage = most
					? {
						id: most.id,
						name: most.name,
						bookCount: most.book_count,
						percentage: totalBooks > 0 ? Number(((most.book_count / totalBooks) * 100).toFixed(1)) : 0
					}
					: null;
			}

			if (selected.includes("rarestLanguage")) {
				payload.rarestLanguage = least
					? {
						id: least.id,
						name: least.name,
						bookCount: least.book_count,
						percentage: totalBooks > 0 ? Number(((least.book_count / totalBooks) * 100).toFixed(1)) : 0
					}
					: null;
			}

			if (selected.includes("mostCommonLanguages")) {
				payload.mostCommonLanguages = rows.slice(0, topLimitValue).map((row) => ({
					id: row.id,
					name: row.name,
					bookCount: row.book_count,
					percentage: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
				}));
			}
		}

		if (selected.includes("languageCombinations")) {
			const comboResult = await pool.query(
				`SELECT l1.name AS language_a, l2.name AS language_b, COUNT(DISTINCT bl1.book_id)::int AS book_count
				 FROM book_languages bl1
				 JOIN book_languages bl2
				   ON bl1.book_id = bl2.book_id
				  AND bl1.language_id < bl2.language_id
				  AND bl1.user_id = bl2.user_id
				 JOIN books b ON bl1.book_id = b.id
				 JOIN languages l1 ON bl1.language_id = l1.id
				 JOIN languages l2 ON bl2.language_id = l2.id
				 WHERE bl1.user_id = $1 AND b.deleted_at IS NULL
				 GROUP BY l1.name, l2.name
				 ORDER BY book_count DESC, l1.name ASC, l2.name ASC
				 LIMIT $2`,
				[userId, comboLimitValue]
			);
			payload.languageCombinations = comboResult.rows.map((row) => ({
				languages: [row.language_a, row.language_b],
				bookCount: row.book_count,
				percentage: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
			}));
		}

		return successResponse(res, 200, "Language stats retrieved successfully.", { stats: payload });
	} catch (error) {
		logToFile("LANGUAGE_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve language stats at this time."]);
	}
});

// GET /languages - List available languages
router.get("/", requiresAuth, authenticatedLimiter, async (req, res) => {
	try {
		const result = await pool.query(
			`SELECT id, name
			 FROM languages
			 ORDER BY name ASC`
		);

		logToFile("LANGUAGES_LIST", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			count: result.rows.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Languages retrieved successfully.", {
			languages: result.rows
		});
	} catch (error) {
		logToFile("LANGUAGES_LIST", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving languages."]);
	}
});

module.exports = router;
