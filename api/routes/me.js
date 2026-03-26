const express = require("express");

const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { successResponse, errorResponse } = require("../utils/response");
const { logToFile } = require("../utils/logging");
const config = require("../config");
const { getEffectiveDeweyDataset } = require("../utils/dewey");

const router = express.Router();

router.get("/dewey-dataset", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user?.id || null;

	logToFile("DEWEY_DATASET_REQUEST", {
		status: "INFO",
		user_id: userId,
		path: req.originalUrl || req.url,
		ip: req.ip,
		user_agent: req.get("user-agent")
	}, "info");

	if (!config.dewey.enabled) {
		logToFile("DEWEY_DATASET_REQUEST", {
			status: "SKIPPED",
			user_id: userId,
			reason: "feature_disabled",
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");
		return errorResponse(res, 404, "Dewey dataset is not available.", ["Dewey Decimal support is currently disabled."]);
	}

	try {
		const dataset = await getEffectiveDeweyDataset(userId);
		logToFile("DEWEY_DATASET_REQUEST", {
			status: "SUCCESS",
			user_id: userId,
			source: dataset.source,
			entry_count: dataset.entries.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");
		return successResponse(res, 200, "Dewey dataset retrieved successfully.", {
			source: dataset.source,
			entries: dataset.entries
		});
	} catch (error) {
		logToFile("DEWEY_DATASET_REQUEST", {
			status: "FAILURE",
			user_id: userId,
			error_message: error.message,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Dewey dataset unavailable.", ["Unable to load the Dewey dataset right now."]);
	}
});

module.exports = router;
