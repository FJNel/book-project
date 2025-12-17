const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const { successResponse, errorResponse } = require("../utils/response");
const { logToFile } = require("../utils/logging");
const { incorrectDateReportLimiter } = require("../utils/rate-limiters");

const REPORT_DIR = path.join(__dirname, "..", "temp");
const REPORT_FILE = path.join(REPORT_DIR, "incorrect-date-reports.log");

function ensureReportFile() {
	if (!fs.existsSync(REPORT_DIR)) {
		fs.mkdirSync(REPORT_DIR, { recursive: true });
	}
	if (!fs.existsSync(REPORT_FILE)) {
		fs.writeFileSync(REPORT_FILE, "", "utf8");
	}
}

router.post("/incorrect-date", incorrectDateReportLimiter, (req, res) => {
	const { input, parsed, expected, notes } = req.body || {};

	if (typeof input !== "string" || input.trim().length === 0) {
		return errorResponse(res, 400, "Validation Error", ["'input' must be a non-empty string."]);
	}
	if (typeof expected !== "string" || expected.trim().length === 0) {
		return errorResponse(res, 400, "Validation Error", ["'expected' must be a non-empty string describing the correct date."]);
	}
	if (typeof parsed !== "object" || parsed === null) {
		return errorResponse(res, 400, "Validation Error", ["'parsed' must be the parser output object."]);
	}

	const trimmedInput = input.trim();
	const trimmedExpected = expected.trim();
	if (trimmedInput.length > 512 || trimmedExpected.length > 512) {
		return errorResponse(res, 400, "Validation Error", ["'input' and 'expected' must be 512 characters or fewer."]);
	}

	ensureReportFile();

	const payload = {
		timestamp: new Date().toISOString(),
		ip: req.ip,
		user_agent: req.get("user-agent"),
		input: trimmedInput,
		expected: trimmedExpected,
		parsed,
		notes: typeof notes === "string" && notes.trim() ? notes.trim() : undefined
	};

	try {
		fs.appendFileSync(REPORT_FILE, JSON.stringify(payload) + "\n", "utf8");
		logToFile("INCORRECT_DATE_REPORT", { status: "SUCCESS", ...payload }, "info");
		return successResponse(res, 201, "Report saved.", {});
	} catch (err) {
		logToFile("INCORRECT_DATE_REPORT", { status: "FAILURE", error_message: err.message, ...payload }, "error");
		return errorResponse(res, 500, "Unable to save report", ["Please try again later."]);
	}
});

module.exports = router;
