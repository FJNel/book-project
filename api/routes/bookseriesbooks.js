const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");

router.use((req, res, next) => {
	logToFile("BOOKSERIESBOOKS_REQUEST", {
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
		logToFile("BOOKSERIESBOOKS_RESPONSE", {
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

// GET /bookseriesbooks/stats - Book series link statistics
router.get("/stats", requiresAuth, statsLimiter, async (req, res) => {
	const userId = req.user.id;
	const params = { ...req.query, ...(req.body || {}) };
	const fields = Array.isArray(params.fields)
		? params.fields.map((field) => normalizeText(field)).filter(Boolean)
		: [];

	const availableFields = new Set([
		"booksInSeries",
		"standalones",
		"averageSeriesLengthBooks",
		"averageSeriesLengthPages",
		"outOfOrderEntries",
		"booksInMultipleSeries",
		"breakdownPerSeries"
	]);
	const selected = fields.length > 0 ? fields : Array.from(availableFields);
	const invalid = selected.filter((field) => !availableFields.has(field));
	if (invalid.length > 0) {
		return errorResponse(res, 400, "Validation Error", [`Unknown stats fields: ${invalid.join(", ")}.`]);
	}

	try {
		const payload = {};

		if (selected.includes("booksInSeries") || selected.includes("standalones")) {
			const seriesCountResult = await pool.query(
				`SELECT COUNT(DISTINCT bsb.book_id)::int AS books_in_series
				 FROM book_series_books bsb
				 JOIN book_series bs ON bs.id = bsb.series_id AND bs.deleted_at IS NULL
				 JOIN books b ON b.id = bsb.book_id AND b.deleted_at IS NULL
				 WHERE bsb.user_id = $1`,
				[userId]
			);
			const totalBooksResult = await pool.query(
				`SELECT COUNT(*)::int AS total_books
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL`,
				[userId]
			);
			const booksInSeries = seriesCountResult.rows[0]?.books_in_series ?? 0;
			const totalBooks = totalBooksResult.rows[0]?.total_books ?? 0;
			if (selected.includes("booksInSeries")) {
				payload.booksInSeries = {
					count: booksInSeries,
					percentageOfBooks: totalBooks > 0 ? Number(((booksInSeries / totalBooks) * 100).toFixed(1)) : 0
				};
			}
			if (selected.includes("standalones")) {
				const standaloneCount = Math.max(totalBooks - booksInSeries, 0);
				payload.standalones = {
					count: standaloneCount,
					percentageOfBooks: totalBooks > 0 ? Number(((standaloneCount / totalBooks) * 100).toFixed(1)) : 0
				};
			}
		}

		if (selected.includes("averageSeriesLengthBooks") || selected.includes("averageSeriesLengthPages")) {
			const avgResult = await pool.query(
				`WITH series_stats AS (
					SELECT bsb.series_id,
					       COUNT(DISTINCT b.id)::int AS book_count,
					       SUM(b.page_count)::int AS total_pages
					FROM book_series_books bsb
					JOIN book_series bs ON bs.id = bsb.series_id AND bs.deleted_at IS NULL
					JOIN books b ON b.id = bsb.book_id AND b.deleted_at IS NULL
					WHERE bsb.user_id = $1
					GROUP BY bsb.series_id
				)
				SELECT AVG(book_count)::numeric AS avg_books,
				       AVG(total_pages)::numeric AS avg_pages
				FROM series_stats`,
				[userId]
			);
			const row = avgResult.rows[0] || {};
			if (selected.includes("averageSeriesLengthBooks")) {
				payload.averageSeriesLengthBooks = row.avg_books === null
					? null
					: Number(Number.parseFloat(row.avg_books).toFixed(2));
			}
			if (selected.includes("averageSeriesLengthPages")) {
				payload.averageSeriesLengthPages = row.avg_pages === null
					? null
					: Number(Number.parseFloat(row.avg_pages).toFixed(2));
			}
		}

		if (selected.includes("outOfOrderEntries")) {
			const orderResult = await pool.query(
				`WITH ordered AS (
					SELECT bsb.series_id,
					       bsb.book_order
					FROM book_series_books bsb
					JOIN book_series bs ON bs.id = bsb.series_id AND bs.deleted_at IS NULL
					JOIN books b ON b.id = bsb.book_id AND b.deleted_at IS NULL
					WHERE bsb.user_id = $1
				),
				per_series AS (
					SELECT series_id,
					       COUNT(*) FILTER (WHERE book_order IS NULL)::int AS null_orders,
					       COUNT(DISTINCT book_order) FILTER (WHERE book_order IS NOT NULL)::int AS distinct_orders,
					       COUNT(book_order) FILTER (WHERE book_order IS NOT NULL)::int AS total_orders,
					       MIN(book_order) FILTER (WHERE book_order IS NOT NULL) AS min_order,
					       MAX(book_order) FILTER (WHERE book_order IS NOT NULL) AS max_order
					FROM ordered
					GROUP BY series_id
				)
				SELECT SUM(null_orders)::int AS null_order_count,
				       SUM(
				         CASE
				           WHEN min_order IS NULL OR max_order IS NULL THEN 0
				           ELSE GREATEST((max_order - min_order + 1) - distinct_orders, 0)
				         END
				       )::int AS gap_count
				FROM per_series`,
				[userId]
			);
			const row = orderResult.rows[0] || {};
			payload.outOfOrderEntries = {
				nullBookOrderCount: row.null_order_count ?? 0,
				gapCount: row.gap_count ?? 0
			};
		}

		if (selected.includes("booksInMultipleSeries")) {
			const multiResult = await pool.query(
				`SELECT COUNT(*)::int AS book_count
				 FROM (
					SELECT bsb.book_id
					FROM book_series_books bsb
					JOIN book_series bs ON bs.id = bsb.series_id AND bs.deleted_at IS NULL
					JOIN books b ON b.id = bsb.book_id AND b.deleted_at IS NULL
					WHERE bsb.user_id = $1
					GROUP BY bsb.book_id
					HAVING COUNT(DISTINCT bsb.series_id) > 1
				 ) sub`,
				[userId]
			);
			const multiCount = multiResult.rows[0]?.book_count ?? 0;
			const totalBooksResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL`,
				[userId]
			);
			const totalBooks = totalBooksResult.rows[0]?.count ?? 0;
			payload.booksInMultipleSeries = {
				count: multiCount,
				percentageOfBooks: totalBooks > 0 ? Number(((multiCount / totalBooks) * 100).toFixed(1)) : 0
			};
		}

		if (selected.includes("breakdownPerSeries")) {
			const totalBooksResult = await pool.query(
				`SELECT COUNT(*)::int AS count
				 FROM books
				 WHERE user_id = $1 AND deleted_at IS NULL`,
				[userId]
			);
			const totalBooks = totalBooksResult.rows[0]?.count ?? 0;
			const breakdownResult = await pool.query(
				`WITH ordered AS (
					SELECT bsb.series_id,
					       bsb.book_order,
					       b.page_count
					FROM book_series_books bsb
					JOIN book_series bs ON bs.id = bsb.series_id AND bs.deleted_at IS NULL
					JOIN books b ON b.id = bsb.book_id AND b.deleted_at IS NULL
					WHERE bsb.user_id = $1
				),
				per_series AS (
					SELECT series_id,
					       COUNT(*)::int AS book_count,
					       SUM(page_count)::int AS total_pages,
					       AVG(page_count)::numeric AS avg_pages,
					       COUNT(*) FILTER (WHERE book_order IS NULL)::int AS null_orders,
					       COUNT(DISTINCT book_order) FILTER (WHERE book_order IS NOT NULL)::int AS distinct_orders,
					       COUNT(book_order) FILTER (WHERE book_order IS NOT NULL)::int AS total_orders,
					       MIN(book_order) FILTER (WHERE book_order IS NOT NULL) AS min_order,
					       MAX(book_order) FILTER (WHERE book_order IS NOT NULL) AS max_order
					FROM ordered
					GROUP BY series_id
				)
				SELECT bs.id, bs.name,
				       COALESCE(ps.book_count, 0)::int AS book_count,
				       ps.total_pages,
				       ps.avg_pages,
				       COALESCE(ps.null_orders, 0)::int AS null_orders,
				       COALESCE(GREATEST(ps.total_orders - ps.distinct_orders, 0), 0)::int AS duplicate_orders,
				       CASE
				         WHEN ps.min_order IS NULL OR ps.max_order IS NULL THEN 0
				         ELSE GREATEST((ps.max_order - ps.min_order + 1) - ps.distinct_orders, 0)
				       END AS gap_count
				FROM book_series bs
				LEFT JOIN per_series ps ON ps.series_id = bs.id
				WHERE bs.user_id = $1 AND bs.deleted_at IS NULL
				ORDER BY bs.name ASC`,
				[userId]
			);
			payload.breakdownPerSeries = breakdownResult.rows.map((row) => ({
				id: row.id,
				name: row.name,
				bookCount: row.book_count,
				percentageOfBooks: totalBooks > 0 ? Number(((row.book_count / totalBooks) * 100).toFixed(1)) : 0,
				totalPages: row.total_pages === null ? null : Number(row.total_pages),
				avgPages: row.avg_pages === null ? null : Number(Number.parseFloat(row.avg_pages).toFixed(2)),
				nullBookOrderCount: row.null_orders,
				duplicateOrderNumbers: row.duplicate_orders,
				gapCount: row.gap_count
			}));
		}

		return successResponse(res, 200, "Book series link stats retrieved successfully.", { stats: payload });
	} catch (error) {
		logToFile("BOOK_SERIES_LINK_STATS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve book series link stats at this time."]);
	}
});

module.exports = router;
