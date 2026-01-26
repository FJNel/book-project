const express = require("express");
const router = express.Router();

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { requiresAuth } = require("../utils/jwt");
const { statsLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const {
	DEFAULT_USER_TTL_SECONDS,
	buildCacheKey,
	getCacheEntry,
	setCacheEntry
} = require("../utils/stats-cache");

const MAX_BUCKETS = 200;

router.use((req, res, next) => {
	logToFile("TIMELINE_REQUEST", {
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
		logToFile("TIMELINE_RESPONSE", {
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

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];

function parsePartialDateInput(value, { forEnd = false } = {}) {
	if (typeof value !== "string") return { error: "Date must be a string." };
	const raw = value.trim();
	if (!raw) return { error: "Date must be provided." };

	const parts = raw.split("-");
	if (parts.length < 1 || parts.length > 3) {
		return { error: "Date must be in YYYY, YYYY-MM, or YYYY-MM-DD format." };
	}

	const year = Number.parseInt(parts[0], 10);
	if (!Number.isInteger(year) || year < 1 || year > 9999) {
		return { error: "Year must be between 1 and 9999." };
	}

	let month = null;
	let day = null;
	if (parts.length >= 2) {
		month = Number.parseInt(parts[1], 10);
		if (!Number.isInteger(month) || month < 1 || month > 12) {
			return { error: "Month must be between 1 and 12." };
		}
	}
	if (parts.length === 3) {
		day = Number.parseInt(parts[2], 10);
		const maxDay = new Date(Date.UTC(year, month ?? 1, 0)).getUTCDate();
		if (!Number.isInteger(day) || day < 1 || day > maxDay) {
			return { error: "Day must be valid for the given month and year." };
		}
	}

	if (!forEnd) {
		const startMonth = month ?? 1;
		const startDay = day ?? 1;
		return { date: new Date(Date.UTC(year, startMonth - 1, startDay)) };
	}

	if (day !== null) {
		return { date: new Date(Date.UTC(year, month - 1, day)) };
	}
	if (month !== null) {
		const nextMonth = month + 1;
		const nextYear = nextMonth > 12 ? year + 1 : year;
		const normalizedMonth = nextMonth > 12 ? 1 : nextMonth;
		return { date: new Date(Date.UTC(nextYear, normalizedMonth - 1, 1)) };
	}
	return { date: new Date(Date.UTC(year + 1, 0, 1)) };
}

function addInterval(date, step, unit) {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();
	const day = date.getUTCDate();
	if (unit === "day") {
		return new Date(Date.UTC(year, month, day + step));
	}
	if (unit === "month") {
		return new Date(Date.UTC(year, month + step, day));
	}
	return new Date(Date.UTC(year + step, month, day));
}

function parseBooleanFlag(value) {
	if (value === undefined || value === null) return null;
	if (typeof value === "boolean") return value;
	const normalized = String(value).trim().toLowerCase();
	if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
	if (normalized === "false" || normalized === "0" || normalized === "no") return false;
	return null;
}

function countIntervals(startDate, endDateExclusive, unit) {
	let count = 0;
	let cursor = new Date(startDate.getTime());
	while (cursor < endDateExclusive) {
		count += 1;
		cursor = addInterval(cursor, 1, unit);
		if (count > MAX_BUCKETS * 10) break;
	}
	return count;
}

function chooseAutoUnit(startDate, endDateExclusive) {
	const diffMs = endDateExclusive.getTime() - startDate.getTime();
	const diffDays = diffMs / (24 * 60 * 60 * 1000);
	if (diffDays <= 31) return "day";
	if (diffDays <= 730) return "month";
	return "year";
}

function formatDateWords(date) {
	const day = date.getUTCDate();
	const monthName = MONTH_NAMES[date.getUTCMonth()];
	const year = date.getUTCFullYear();
	return `${day} ${monthName} ${year}`;
}

function formatBucketLabel(startDate, endDateExclusive) {
	const endInclusive = new Date(endDateExclusive.getTime() - 24 * 60 * 60 * 1000);
	return `${formatDateWords(startDate)} to ${formatDateWords(endInclusive)}`;
}

function resolveEntityConfig(entity, field) {
	if (entity === "books" && field === "datePublished") {
		return {
			table: "books",
			alias: "b",
			dateColumn: "publication_date_id",
			joinDeleted: "b.deleted_at IS NULL"
		};
	}
	if (entity === "authors" && (field === "birthDate" || field === "deathDate")) {
		return {
			table: "authors",
			alias: "a",
			dateColumn: field === "birthDate" ? "birth_date_id" : "death_date_id",
			joinDeleted: "a.deleted_at IS NULL"
		};
	}
	if (entity === "bookCopies" && field === "acquisitionDate") {
		return {
			table: "book_copies",
			alias: "bc",
			dateColumn: "acquisition_date_id",
			joinDeleted: "b.deleted_at IS NULL",
			joins: "JOIN books b ON b.id = bc.book_id"
		};
	}
	if (entity === "publishers" && field === "foundedDate") {
		return {
			table: "publishers",
			alias: "p",
			dateColumn: "founded_date_id",
			joinDeleted: "p.deleted_at IS NULL"
		};
	}
	return null;
}

// GET/POST /timeline/buckets - Timeline bucket statistics
const timelineBucketsHandler = async (req, res) => {
	const userId = req.user.id;
	const entity = typeof req.body?.entity === "string" ? req.body.entity.trim() : "";
	const field = typeof req.body?.field === "string" ? req.body.field.trim() : "";
	let step = Number.parseInt(req.body?.step ?? 1, 10);
	let stepUnit = typeof req.body?.stepUnit === "string" ? req.body.stepUnit.trim().toLowerCase() : "year";
	const autoMode = parseBooleanFlag(req.body?.auto) === true
		|| (typeof req.body?.mode === "string" && req.body.mode.trim().toLowerCase() === "automatic");
	const { value: requestedBuckets, error: bucketsError } = (() => {
		if (req.body?.numberOfBuckets === undefined && req.body?.buckets === undefined) return { value: null };
		const raw = req.body?.numberOfBuckets ?? req.body?.buckets;
		const parsed = Number.parseInt(raw, 10);
		if (!Number.isInteger(parsed) || parsed < 1) {
			return { error: "Number of buckets must be an integer greater than 0." };
		}
		return { value: parsed };
	})();
	const hideEmptyBuckets = parseBooleanFlag(req.body?.hideEmptyBuckets) === true;
	const startInput = req.body?.start;
	const endInput = req.body?.end;

	if (!entity || !field) {
		return errorResponse(res, 400, "Validation Error", ["Entity and field must be provided."]);
	}
	if (bucketsError) {
		return errorResponse(res, 400, "Validation Error", [bucketsError]);
	}
	if (!autoMode && (!Number.isInteger(step) || step < 1)) {
		return errorResponse(res, 400, "Validation Error", ["Step must be an integer greater than 0."]);
	}
	if (!["day", "month", "year"].includes(stepUnit)) {
		return errorResponse(res, 400, "Validation Error", ["stepUnit must be one of: day, month, year."]);
	}

	const config = resolveEntityConfig(entity, field);
	if (!config) {
		return errorResponse(res, 400, "Validation Error", ["Entity and field combination is not supported."]);
	}

	const cacheKey = buildCacheKey({
		scope: "user",
		userId,
		endpoint: "timeline/buckets",
		params: {
			entity,
			field,
			auto: autoMode,
			step: autoMode ? null : step,
			stepUnit: autoMode ? (req.body?.stepUnit ? stepUnit : "auto") : stepUnit,
			numberOfBuckets: requestedBuckets ?? null,
			hideEmptyBuckets,
			start: startInput ?? null,
			end: endInput ?? null
		}
	});
	const cached = getCacheEntry(cacheKey);
	if (cached) {
		return successResponse(res, 200, "Timeline buckets retrieved successfully.", {
			...cached.data,
			cache: { hit: true, ageSeconds: cached.ageSeconds }
		});
	}

	const baseJoin = config.joins ? `${config.joins}` : "";

	let startDate = null;
	let endDateExclusive = null;

	if (autoMode) {
		try {
			const rangeResult = await pool.query(
				`SELECT
					MIN(make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1))) AS min_date,
					MAX(make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1))) AS max_date
				 FROM ${config.table} ${config.alias}
				 ${baseJoin}
				 JOIN dates d ON ${config.alias}.${config.dateColumn} = d.id
				 WHERE ${config.alias}.user_id = $1
				   AND ${config.joinDeleted}
				   AND d.year IS NOT NULL`,
				[userId]
			);
			const minDate = rangeResult.rows[0]?.min_date;
			const maxDate = rangeResult.rows[0]?.max_date;
			if (!minDate || !maxDate) {
				const responseData = {
					entity,
					field,
					start: null,
					end: null,
					step: null,
					stepUnit: null,
					buckets: [],
					beforeStart: 0,
					afterEnd: 0,
					unknown: 0,
					cache: { hit: false, ageSeconds: 0 }
				};
				setCacheEntry(cacheKey, responseData, DEFAULT_USER_TTL_SECONDS);
				return successResponse(res, 200, "Timeline buckets retrieved successfully.", responseData);
			}
			startDate = new Date(minDate);
			endDateExclusive = addInterval(new Date(maxDate), 1, "day");
			stepUnit = req.body?.stepUnit ? stepUnit : chooseAutoUnit(startDate, endDateExclusive);
		} catch (error) {
			logToFile("TIMELINE_BUCKETS", {
				status: "FAILURE",
				error_message: error.message,
				user_id: userId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["Unable to determine automatic timeline bounds."]);
		}
	} else {
		const startParse = parsePartialDateInput(startInput, { forEnd: false });
		if (startParse.error) {
			return errorResponse(res, 400, "Validation Error", [`Start date: ${startParse.error}`]);
		}
		const endParse = parsePartialDateInput(endInput, { forEnd: true });
		if (endParse.error) {
			return errorResponse(res, 400, "Validation Error", [`End date: ${endParse.error}`]);
		}
		startDate = startParse.date;
		endDateExclusive = endParse.date;
	}

	if (startDate >= endDateExclusive) {
		return errorResponse(res, 400, "Validation Error", ["Start date must be before end date."]);
	}

	const targetBuckets = autoMode ? (requestedBuckets ?? 10) : requestedBuckets;
	if (targetBuckets) {
		const intervalCount = countIntervals(startDate, endDateExclusive, stepUnit);
		step = Math.max(1, Math.ceil(intervalCount / targetBuckets));
		endDateExclusive = addInterval(startDate, step * targetBuckets, stepUnit);
	}

	const firstBucketEnd = addInterval(startDate, step, stepUnit);
	if (firstBucketEnd > endDateExclusive) {
		return errorResponse(res, 400, "Validation Error", ["End date must be at least one step after start date."]);
	}

	let bucketCount = 0;
	let cursor = new Date(startDate.getTime());
	while (cursor < endDateExclusive) {
		bucketCount += 1;
		if (bucketCount > MAX_BUCKETS) {
			return errorResponse(res, 400, "Validation Error", [`Too many buckets requested (max ${MAX_BUCKETS}).`]);
		}
		cursor = addInterval(cursor, step, stepUnit);
	}

	const intervalLiteral = `${step} ${stepUnit}`;

	try {
		const bucketResult = await pool.query(
			`WITH entity_dates AS (
				SELECT make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1)) AS anchored_date
				FROM ${config.table} ${config.alias}
				${baseJoin}
				JOIN dates d ON ${config.alias}.${config.dateColumn} = d.id
				WHERE ${config.alias}.user_id = $1
				  AND ${config.joinDeleted}
				  AND d.year IS NOT NULL
			),
			buckets AS (
				SELECT gs AS bucket_start, (gs + INTERVAL '${intervalLiteral}')::date AS bucket_end
				FROM generate_series($2::date, ($3::date - INTERVAL '${intervalLiteral}'), INTERVAL '${intervalLiteral}') gs
			)
			SELECT bucket_start, bucket_end, COUNT(ed.anchored_date)::int AS count
			FROM buckets b
			LEFT JOIN entity_dates ed
			  ON ed.anchored_date >= b.bucket_start
			 AND ed.anchored_date < b.bucket_end
			GROUP BY bucket_start, bucket_end
			ORDER BY bucket_start ASC`,
			[userId, startDate, endDateExclusive]
		);

		const beforeResult = await pool.query(
			`SELECT COUNT(*)::int AS count
			 FROM ${config.table} ${config.alias}
			 ${baseJoin}
			 JOIN dates d ON ${config.alias}.${config.dateColumn} = d.id
			 WHERE ${config.alias}.user_id = $1
			   AND ${config.joinDeleted}
			   AND d.year IS NOT NULL
			   AND make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1)) < $2::date`,
			[userId, startDate]
		);

		const afterResult = await pool.query(
			`SELECT COUNT(*)::int AS count
			 FROM ${config.table} ${config.alias}
			 ${baseJoin}
			 JOIN dates d ON ${config.alias}.${config.dateColumn} = d.id
			 WHERE ${config.alias}.user_id = $1
			   AND ${config.joinDeleted}
			   AND d.year IS NOT NULL
			   AND make_date(d.year, COALESCE(d.month, 1), COALESCE(d.day, 1)) >= $2::date`,
			[userId, endDateExclusive]
		);

		const unknownResult = await pool.query(
			`SELECT COUNT(*)::int AS count
			 FROM ${config.table} ${config.alias}
			 ${baseJoin}
			 LEFT JOIN dates d ON ${config.alias}.${config.dateColumn} = d.id
			 WHERE ${config.alias}.user_id = $1
			   AND ${config.joinDeleted}
			   AND (${config.alias}.${config.dateColumn} IS NULL OR d.year IS NULL)`,
			[userId]
		);

		let buckets = bucketResult.rows.map((row) => ({
			start: row.bucket_start,
			end: row.bucket_end,
			label: formatBucketLabel(new Date(row.bucket_start), new Date(row.bucket_end)),
			count: row.count
		}));
		if (hideEmptyBuckets) {
			buckets = buckets.filter((row) => row.count > 0);
		}

		const payload = {
			entity,
			field,
			start: startDate.toISOString().slice(0, 10),
			end: endDateExclusive.toISOString().slice(0, 10),
			step,
			stepUnit,
			numberOfBuckets: bucketCount,
			hideEmptyBuckets,
			buckets,
			beforeStart: beforeResult.rows[0]?.count ?? 0,
			afterEnd: afterResult.rows[0]?.count ?? 0,
			unknown: unknownResult.rows[0]?.count ?? 0
		};

		const responseData = {
			...payload,
			cache: { hit: false, ageSeconds: 0 }
		};
		setCacheEntry(cacheKey, responseData, DEFAULT_USER_TTL_SECONDS);
		return successResponse(res, 200, "Timeline buckets retrieved successfully.", responseData);
	} catch (error) {
		logToFile("TIMELINE_BUCKETS", {
			status: "FAILURE",
			error_message: error.message,
			user_id: userId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["Unable to retrieve timeline buckets at this time."]);
	}
};

router.get("/buckets", requiresAuth, statsLimiter, timelineBucketsHandler);
router.post("/buckets", requiresAuth, statsLimiter, timelineBucketsHandler);

module.exports = router;
