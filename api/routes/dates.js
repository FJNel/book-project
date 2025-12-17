const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const router = express.Router();

const { successResponse, errorResponse } = require("../utils/response");
const { logToFile } = require("../utils/logging");
const { partialDatePreviewLimiter } = require("../utils/rate-limiters");

const PYTHON_BIN = process.env.PARTIAL_DATE_PYTHON || process.env.PYTHON || "python3";
const SCRIPT_PATH = path.join(__dirname, "..", "utils", "partial_date_parser.py");
const MAX_INPUT_LENGTH = 512;
const REFERENCE_DATE_FORMATS = [
	{ regex: /^(\d{4})-(\d{2})-(\d{2})$/, order: ["Y", "M", "D"] }, // YYYY-MM-DD
	{ regex: /^(\d{2})-(\d{2})-(\d{4})$/, order: ["D", "M", "Y"] }, // DD-MM-YYYY
	{ regex: /^(\d{4})\/(\d{2})\/(\d{2})$/, order: ["Y", "M", "D"] }, // YYYY/MM/DD
	{ regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, order: ["D", "M", "Y"] }, // DD/MM/YYYY
];

function parseReferenceDate(value) {
	for (const fmt of REFERENCE_DATE_FORMATS) {
		const match = fmt.regex.exec(value);
		if (!match) continue;
		let day, month, year;
		fmt.order.forEach((part, idx) => {
			const num = Number(match[idx + 1]);
			if (part === "Y") year = num;
			if (part === "M") month = num;
			if (part === "D") day = num;
		});
		if (!year || !month || !day) continue;
		const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		const parsed = new Date(iso);
		if (!Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day) {
			return iso;
		}
	}
	return null;
}

function runPartialDateParser(input, preferMdy, referenceDate) {
	return new Promise((resolve, reject) => {
		const args = [SCRIPT_PATH, input];
		if (preferMdy) {
			args.push("--mdy");
		}
		if (referenceDate) {
			args.push("--today", referenceDate);
		}

		const child = spawn(PYTHON_BIN, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString("utf8");
		});

		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString("utf8");
		});

		child.on("error", (err) => {
			reject(err);
		});

		child.on("close", (code) => {
			if (code !== 0) {
				const error = new Error(stderr || `partial_date_parser exited with code ${code}`);
				error.exitCode = code;
				return reject(error);
			}

			const normalized = stdout.replace(/\r/g, "");
			const lines = normalized.split("\n");
			const jsonLineIndex = lines.findIndex((line) => line.trim().startsWith("{"));
			if (jsonLineIndex === -1) {
				return reject(new Error("Parser did not return JSON output"));
			}
			const jsonLine = lines[jsonLineIndex].trim();
			let parsedResult;
			try {
				parsedResult = JSON.parse(jsonLine);
			} catch (parseErr) {
				return reject(new Error("Parser returned invalid JSON"));
			}

			const renderedRaw = lines.slice(jsonLineIndex + 1).join("\n");
			const renderedText = renderedRaw.replace(/\n+$/, "");
			return resolve({
				parsed: parsedResult,
				renderedText,
			});
		});
	});
}

router.post("/preview", partialDatePreviewLimiter, async (req, res) => {
	const { dateString, preferMdy = false, referenceDate = null } = req.body || {};
	if (typeof dateString !== "string") {
		logToFile("PARTIAL_DATE_PREVIEW", {
			status: "FAILURE",
			reason: "INVALID_TYPE",
			path: req.originalUrl,
			method: req.method,
			ip: req.ip,
			user_agent: req.get("user-agent"),
		}, "warn");
		return errorResponse(res, 400, "Validation Error", ["dateString must be a string containing the date to parse."]);
	}

	const trimmedInput = dateString.trim();
	if (!trimmedInput) {
		logToFile("PARTIAL_DATE_PREVIEW", {
			status: "FAILURE",
			reason: "EMPTY_INPUT",
			path: req.originalUrl,
			method: req.method,
			ip: req.ip,
			user_agent: req.get("user-agent"),
		}, "warn");
		return errorResponse(res, 400, "Validation Error", ["An empty date cannot be parsed."]);
	}

	if (trimmedInput.length > MAX_INPUT_LENGTH) {
		logToFile("PARTIAL_DATE_PREVIEW", {
			status: "FAILURE",
			reason: "INPUT_TOO_LONG",
			input_length: trimmedInput.length,
			path: req.originalUrl,
			method: req.method,
			ip: req.ip,
			user_agent: req.get("user-agent"),
		}, "warn");
		return errorResponse(res, 400, "Validation Error", [
			`dateString must be ${MAX_INPUT_LENGTH} characters or fewer.`,
		]);
	}

	const useMdy = Boolean(preferMdy);
	let refDate = null;
	if (referenceDate !== null && referenceDate !== undefined) {
		if (typeof referenceDate !== "string") {
			logToFile("PARTIAL_DATE_PREVIEW", {
				status: "FAILURE",
				reason: "INVALID_REFERENCE_DATE_TYPE",
				path: req.originalUrl,
				method: req.method,
				ip: req.ip,
				user_agent: req.get("user-agent"),
			}, "warn");
			return errorResponse(res, 400, "Validation Error", ["referenceDate must be a string in a supported format."]);
		}
		const parsedRef = parseReferenceDate(referenceDate);
		if (!parsedRef) {
			logToFile("PARTIAL_DATE_PREVIEW", {
				status: "FAILURE",
				reason: "INVALID_REFERENCE_DATE_FORMAT",
				path: req.originalUrl,
				method: req.method,
				ip: req.ip,
				user_agent: req.get("user-agent"),
			}, "warn");
			return errorResponse(res, 400, "Validation Error", ["referenceDate must be a valid date in YYYY-MM-DD or DD-MM-YYYY (slashes also accepted)."]);
		}
		refDate = parsedRef;
	}

	try {
		const result = await runPartialDateParser(trimmedInput, useMdy, refDate);
		const textValue = Object.prototype.hasOwnProperty.call(result.parsed, "text") ? result.parsed.text : result.renderedText;
		const parsedDate = {
			day: Object.prototype.hasOwnProperty.call(result.parsed, "day") ? result.parsed.day : null,
			month: Object.prototype.hasOwnProperty.call(result.parsed, "month") ? result.parsed.month : null,
			year: Object.prototype.hasOwnProperty.call(result.parsed, "year") ? result.parsed.year : null,
			text: typeof textValue === "string" ? textValue : "",
		};

		if (!parsedDate.day && !parsedDate.month && !parsedDate.year && !parsedDate.text) {
			logToFile("PARTIAL_DATE_PREVIEW", {
				status: "FAILURE",
				reason: "UNPARSABLE",
				path: req.originalUrl,
				method: req.method,
				ip: req.ip,
				user_agent: req.get("user-agent"),
			}, "warn");
			return errorResponse(res, 400, "Validation Error", ["Could not parse the provided date."]);
		}

		logToFile("PARTIAL_DATE_PREVIEW", {
			status: "SUCCESS",
			path: req.originalUrl,
			method: req.method,
			ip: req.ip,
			user_agent: req.get("user-agent"),
			input_length: trimmedInput.length,
			prefer_mdy: useMdy,
			reference_date: refDate,
			parsed_day: parsedDate.day,
			parsed_month: parsedDate.month,
			parsed_year: parsedDate.year,
		}, "info");

		return successResponse(res, 200, "Date preview generated.", {
			date: parsedDate,
			input: trimmedInput,
			preferMdy: useMdy,
			referenceDate: refDate,
		});
	} catch (err) {
		logToFile("PARTIAL_DATE_PREVIEW", {
			status: "FAILURE",
			reason: "PARSER_ERROR",
			error_message: err && err.message ? err.message : err,
			path: req.originalUrl,
			method: req.method,
			ip: req.ip,
			user_agent: req.get("user-agent"),
		}, "error");
		return errorResponse(res, 500, "Failed to parse date", [
			"Something went wrong while parsing the date. Please try again later.",
		]);
	}
});

module.exports = router;
