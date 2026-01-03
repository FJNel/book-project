const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

const MAX_LIST_LIMIT = 200;

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

// GET /booktags/stats - Book tag usage statistics
router.get("/stats", requiresAuth, statsLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => (typeof field === "string" ? field.trim() : "")).filter(Boolean)
		: [];

	const availableFields = new Set([
		"averageTagsPerBook",
		"untaggedBooks",
		"mostTaggedBook",
		"coOccurringTags",
		"tagEntropy",
		"tagBreakdown"
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
	const { value: pairLimit, error: pairLimitError } = parseOptionalInt(params.pairLimit, "pairLimit", { min: 1, max: 50 });
	if (pairLimitError) {
		return errorResponse(res, 400, "Validation Error", [pairLimitError]);
	}
	const breakdownLimitValue = breakdownLimit ?? 50;
	const pairLimitValue = pairLimit ?? 10;

	try {
		const payload = {};

		const totalBooksResult = await pool.query(
			`SELECT COUNT(*)::int AS count
			 FROM books
			 WHERE user_id = $1 AND deleted_at IS NULL`,
			[userId]
		);
		const totalBooks = totalBooksResult.rows[0]?.count ?? 0;

		if (selected.includes("averageTagsPerBook") || selected.includes("tagEntropy") || selected.includes("tagBreakdown")) {
			const totalTagLinksResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM book_tags bt
				 JOIN books b ON bt.book_id = b.id
				 WHERE bt.user_id = $1 AND b.deleted_at IS NULL`,
				[userId]
			);
			const totalTagLinks = totalTagLinksResult.rows[0]?.count ?? 0;

			if (selected.includes("averageTagsPerBook")) {
				payload.averageTagsPerBook = totalBooks > 0 ? Number((totalTagLinks / totalBooks).toFixed(2)) : 0;
			}

			if (selected.includes("tagEntropy")) {
				const usageResult = await pool.query(
					`SELECT bt.tag_id, COUNT(*)::int AS use_count
					 FROM book_tags bt
					 JOIN books b ON bt.book_id = b.id
					 WHERE bt.user_id = $1 AND b.deleted_at IS NULL
					 GROUP BY bt.tag_id`,
					[userId]
				);
				const uses = usageResult.rows.map((row) => row.use_count);
				const totalUses = uses.reduce((sum, count) => sum + count, 0);
				let entropy = 0;
				for (const count of uses) {
					const p = totalUses > 0 ? count / totalUses : 0;
					if (p > 0) {
						entropy -= p * Math.log(p);
					}
				}
				const distinctTagsUsed = uses.length;
				const normalizedEntropy = distinctTagsUsed > 1 ? Number((entropy / Math.log(distinctTagsUsed)).toFixed(3)) : 0;
				payload.tagEntropy = {
					totalUses,
					distinctTagsUsed,
					entropy: Number(entropy.toFixed(3)),
					normalizedEntropy
				};
			}

		if (selected.includes("tagBreakdown")) {
			const breakdownResult = await pool.query(
				`SELECT t.id, t.name,
				        COUNT(DISTINCT bt.book_id)::int AS book_count,
				        COUNT(*)::int AS tag_use_count
				 FROM tags t
				 JOIN book_tags bt ON bt.tag_id = t.id AND bt.user_id = t.user_id
				 JOIN books b ON b.id = bt.book_id AND b.deleted_at IS NULL
				 WHERE t.user_id = $1
				 GROUP BY t.id, t.name
				 ORDER BY book_count DESC, t.name ASC
				 LIMIT $2`,
				[userId, breakdownLimitValue]
			);
			payload.tagBreakdown = breakdownResult.rows.map((row) => ({
				id: row.id,
				name: row.name,
				bookCount: row.book_count,
				tagUseCount: row.tag_use_count,
				percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0,
				percentageOfTagUses: totalTagLinks > 0 ? Number(((row.tag_use_count / totalTagLinks) * 100).toFixed(1)) : 0
			}));
		}
		}

		if (selected.includes("untaggedBooks")) {
			const untaggedResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM books b
				 WHERE b.user_id = $1
				   AND b.deleted_at IS NULL
				   AND NOT EXISTS (
				     SELECT 1 FROM book_tags bt
				     WHERE bt.book_id = b.id AND bt.user_id = b.user_id
				   )`,
				[userId]
			);
			const untaggedCount = untaggedResult.rows[0]?.count ?? 0;
			payload.untaggedBooks = {
				count: untaggedCount,
				percentage: totalBooks > 0 ? Number(((untaggedCount / totalBooks) * 100).toFixed(1)) : 0
			};
		}

		if (selected.includes("mostTaggedBook")) {
			const mostTaggedResult = await pool.query(
				`SELECT b.id, b.title, COUNT(bt.tag_id)::int AS tag_count
				 FROM books b
				 JOIN book_tags bt ON bt.book_id = b.id AND bt.user_id = b.user_id
				 WHERE b.user_id = $1 AND b.deleted_at IS NULL
				 GROUP BY b.id, b.title
				 ORDER BY tag_count DESC, b.title ASC
				 LIMIT 1`,
				[userId]
			);
			const row = mostTaggedResult.rows[0];
			payload.mostTaggedBook = row
				? {
					id: row.id,
					title: row.title,
					tagCount: row.tag_count,
					percentageOfBooks: totalBooks > 0 ? Number(((1 / totalBooks) * 100).toFixed(1)) : 0
				}
				: null;
		}

		if (selected.includes("coOccurringTags")) {
			const pairResult = await pool.query(
				`SELECT t1.name AS tag_a, t2.name AS tag_b, COUNT(DISTINCT bt1.book_id)::int AS book_count
				 FROM book_tags bt1
				 JOIN book_tags bt2
				   ON bt1.book_id = bt2.book_id
				  AND bt1.tag_id < bt2.tag_id
				  AND bt1.user_id = bt2.user_id
				 JOIN books b ON b.id = bt1.book_id AND b.deleted_at IS NULL
				 JOIN tags t1 ON t1.id = bt1.tag_id
				 JOIN tags t2 ON t2.id = bt2.tag_id
				 WHERE bt1.user_id = $1
				 GROUP BY t1.name, t2.name
				 ORDER BY book_count DESC, tag_a ASC, tag_b ASC
				 LIMIT $2`,
				[userId, pairLimitValue]
			);
			payload.coOccurringTags = pairResult.rows.map((row) => ({
				tags: [row.tag_a, row.tag_b],
				bookCount: row.book_count,
				percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0
			}));
		}

		return successResponse(res, 200, "Book tag stats retrieved successfully.", { stats: payload });
	} catch (error) {
		logToFile("BOOK_TAG_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve book tag stats at this time."]);
	}
});

module.exports = router;
