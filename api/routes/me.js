const express = require("express");

const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { successResponse, errorResponse } = require("../utils/response");
const { logToFile } = require("../utils/logging");
const { getEffectiveDeweyDataset } = require("../utils/dewey");
const pool = require("../db");
const { buildUserFeatureContext } = require("../utils/feature-settings");

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

	try {
		const userResult = await pool.query(
			"SELECT dewey_enabled FROM users WHERE id = $1 AND is_disabled = false",
			[userId]
		);

		if (userResult.rows.length === 0) {
			logToFile("DEWEY_DATASET_REQUEST", {
				status: "FAILURE",
				user_id: userId,
				reason: "user_not_found",
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "warn");
			return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		}

		const featureContext = buildUserFeatureContext(userResult.rows[0]);
		if (!featureContext.features.dewey.enabled) {
			logToFile("DEWEY_DATASET_REQUEST", {
				status: "SKIPPED",
				user_id: userId,
				reason: featureContext.features.dewey.available ? "feature_disabled_for_user" : "feature_unavailable",
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");
			return errorResponse(res, 403, "Dewey dataset is not available for this account.", [
				"Dewey Decimal support is not currently active for this account."
			]);
		}

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
