const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter, statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

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
		"rarestLanguage",
		"languageDiversityScore",
		"languageBreakdown"
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

		if (selected.includes("mostCommonLanguage") || selected.includes("rarestLanguage") || selected.includes("languageBreakdown")) {
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

			if (selected.includes("languageBreakdown")) {
				payload.languageBreakdown = rows.map((row) => ({
					id: row.id,
					name: row.name,
					bookCount: row.book_count,
					percentage: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
				}));
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
