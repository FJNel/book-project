const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_LIST_LIMIT = 200;
const MAX_PAIR_LIMIT = 50;

function normalizeText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
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

// GET /bookauthor/stats - Book author statistics
router.get("/stats", requiresAuth, statsLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => normalizeText(field)).filter(Boolean)
		: [];

	const { value: pairLimit, error: pairLimitError } = parseOptionalInt(params.pairLimit, "pairLimit", { min: 1, max: MAX_PAIR_LIMIT });

	const availableFields = new Set([
		"averageAuthorsPerBook",
		"singleVsMultiBreakdown",
		"authorRoleBreakdown",
		"collaborationPairs",
		"contributorDiversity"
	]);
	const selected = fields.length > 0 ? fields : Array.from(availableFields);
	const invalid = selected.filter((field) => !availableFields.has(field));
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}
	if (pairLimitError) {
		return errorResponse(res, 400, "Validation Error", [pairLimitError]);
	}

	try {
		const payload = {};
		const needsBookCounts = selected.includes("averageAuthorsPerBook")
			|| selected.includes("singleVsMultiBreakdown")
			|| selected.includes("contributorDiversity");

		let totalBooks = 0;
		if (needsBookCounts) {
			const countsResult = await pool.query(
				`WITH author_counts AS (
					SELECT b.id, COUNT(DISTINCT ba.author_id)::int AS author_count
					FROM books b
					LEFT JOIN book_authors ba
					  ON ba.book_id = b.id
					 AND ba.user_id = b.user_id
					WHERE b.user_id = $1 AND b.deleted_at IS NULL
					GROUP BY b.id
				)
				SELECT COUNT(*)::int AS total_books,
				       AVG(author_count)::numeric AS avg_authors_per_book,
				       SUM(CASE WHEN author_count = 1 THEN 1 ELSE 0 END)::int AS single_author_books,
				       SUM(CASE WHEN author_count >= 2 THEN 1 ELSE 0 END)::int AS multi_author_books,
				       SUM(CASE WHEN author_count = 0 THEN 1 ELSE 0 END)::int AS no_author_books
				FROM author_counts`,
				[userId]
			);
			const row = countsResult.rows[0] || {};
			totalBooks = row.total_books ?? 0;

			if (selected.includes("averageAuthorsPerBook")) {
				payload.averageAuthorsPerBook = row.avg_authors_per_book === null
					? null
					: Number(Number.parseFloat(row.avg_authors_per_book).toFixed(2));
			}

			if (selected.includes("singleVsMultiBreakdown")) {
				const total = row.total_books ?? 0;
				payload.singleVsMultiBreakdown = {
					totalBooks: total,
					singleAuthorBooks: row.single_author_books ?? 0,
					multiAuthorBooks: row.multi_author_books ?? 0,
					noAuthorBooks: row.no_author_books ?? 0,
					singleAuthorPercentage: total > 0 ? Number(((row.single_author_books ?? 0) / total * 100).toFixed(1)) : 0,
					multiAuthorPercentage: total > 0 ? Number(((row.multi_author_books ?? 0) / total * 100).toFixed(1)) : 0,
					noAuthorPercentage: total > 0 ? Number(((row.no_author_books ?? 0) / total * 100).toFixed(1)) : 0
				};
			}
		}

		if (selected.includes("contributorDiversity")) {
			const distinctResult = await pool.query(
				`SELECT COUNT(DISTINCT ba.author_id)::int AS distinct_authors
				 FROM book_authors ba
				 JOIN books b ON b.id = ba.book_id AND b.deleted_at IS NULL
				 WHERE ba.user_id = $1`,
				[userId]
			);
			const distinctAuthors = distinctResult.rows[0]?.distinct_authors ?? 0;
			payload.contributorDiversity = {
				distinctAuthors,
				totalBooks,
				score: totalBooks > 0 ? Number((distinctAuthors / totalBooks).toFixed(3)) : 0
			};
		}

		if (selected.includes("authorRoleBreakdown")) {
			const totalRoleResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM book_authors ba
				 JOIN books b ON b.id = ba.book_id AND b.deleted_at IS NULL
				 WHERE ba.user_id = $1`,
				[userId]
			);
			const totalRoles = totalRoleResult.rows[0]?.count ?? 0;
			const roleResult = await pool.query(
				`SELECT COALESCE(NULLIF(TRIM(ba.role), ''), 'Unspecified') AS role,
				        COUNT(*)::int AS count
				 FROM book_authors ba
				 JOIN books b ON b.id = ba.book_id AND b.deleted_at IS NULL
				 WHERE ba.user_id = $1
				 GROUP BY role
				 ORDER BY count DESC, role ASC`,
				[userId]
			);
			payload.authorRoleBreakdown = roleResult.rows.map((row) => ({
				role: row.role,
				count: row.count,
				percentage: totalRoles > 0 ? Number(((row.count / totalRoles) * 100).toFixed(1)) : 0
			}));
		}

		if (selected.includes("collaborationPairs")) {
			const totalCoauthoredResult = await pool.query(
				`WITH book_counts AS (
					SELECT ba.book_id, COUNT(DISTINCT ba.author_id)::int AS author_count
					FROM book_authors ba
					JOIN books b ON b.id = ba.book_id AND b.deleted_at IS NULL
					WHERE ba.user_id = $1
					GROUP BY ba.book_id
				)
				SELECT COUNT(*)::int AS count
				FROM book_counts
				WHERE author_count >= 2`,
				[userId]
			);
			const totalCoauthored = totalCoauthoredResult.rows[0]?.count ?? 0;
			const limitValue = pairLimit ?? 10;
			const pairResult = await pool.query(
				`SELECT a1.id AS author1_id, a1.display_name AS author1_name,
				        a2.id AS author2_id, a2.display_name AS author2_name,
				        COUNT(*)::int AS book_count
				 FROM book_authors ba1
				 JOIN book_authors ba2
				   ON ba1.book_id = ba2.book_id
				  AND ba1.author_id < ba2.author_id
				  AND ba1.user_id = ba2.user_id
				 JOIN books b
				   ON b.id = ba1.book_id
				  AND b.user_id = ba1.user_id
				  AND b.deleted_at IS NULL
				 JOIN authors a1 ON a1.id = ba1.author_id AND a1.deleted_at IS NULL
				 JOIN authors a2 ON a2.id = ba2.author_id AND a2.deleted_at IS NULL
				 WHERE ba1.user_id = $1
				 GROUP BY a1.id, a1.display_name, a2.id, a2.display_name
				 ORDER BY book_count DESC, a1.display_name ASC, a2.display_name ASC
				 LIMIT $2`,
				[userId, limitValue]
			);
			payload.collaborationPairs = pairResult.rows.map((row) => ({
				authors: [
					{ id: row.author1_id, displayName: row.author1_name },
					{ id: row.author2_id, displayName: row.author2_name }
				],
				bookCount: row.book_count,
				percentageOfCoauthoredBooks: totalCoauthored > 0 ? Number(((row.book_count / totalCoauthored) * 100).toFixed(1)) : 0
			}));
		}

		return successResponse(res, 200, "Book author stats retrieved successfully.", { stats: payload });
	} catch (error) {
		logToFile("BOOK_AUTHOR_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve book author stats at this time."]);
	}
});

module.exports = router;
