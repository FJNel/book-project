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

function runPartialDateParser(input, preferMdy) {
	return new Promise((resolve, reject) => {
		const args = [SCRIPT_PATH, input];
		if (preferMdy) {
			args.push("--mdy");
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
	const { dateString, preferMdy = false } = req.body || {};
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

	try {
		const result = await runPartialDateParser(trimmedInput, useMdy);
		const textValue = Object.prototype.hasOwnProperty.call(result.parsed, "text") ? result.parsed.text : result.renderedText;
		const parsedDate = {
			day: Object.prototype.hasOwnProperty.call(result.parsed, "day") ? result.parsed.day : null,
			month: Object.prototype.hasOwnProperty.call(result.parsed, "month") ? result.parsed.month : null,
			year: Object.prototype.hasOwnProperty.call(result.parsed, "year") ? result.parsed.year : null,
			text: typeof textValue === "string" ? textValue : "",
		};

		logToFile("PARTIAL_DATE_PREVIEW", {
			status: "SUCCESS",
			path: req.originalUrl,
			method: req.method,
			ip: req.ip,
			user_agent: req.get("user-agent"),
			input_length: trimmedInput.length,
			prefer_mdy: useMdy,
			parsed_day: parsedDate.day,
			parsed_month: parsedDate.month,
			parsed_year: parsedDate.year,
		}, "info");

		return successResponse(res, 200, "Date preview generated.", {
			date: parsedDate,
			input: trimmedInput,
			preferMdy: useMdy,
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
			"The date preview service is temporarily unavailable. Please try again shortly.",
		]);
	}
});

module.exports = router;
