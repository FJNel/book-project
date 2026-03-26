const express = require("express");
const multer = require("multer");

const { requiresAuth } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { successResponse, errorResponse } = require("../utils/response");
const { logToFile } = require("../utils/logging");
const {
	getEffectiveDeweyDataset,
	getUserDeweySourceStatus,
	uploadUserDeweySource
} = require("../utils/dewey");
const pool = require("../db");
const { buildUserFeatureContext } = require("../utils/feature-settings");

const router = express.Router();
const deweyUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 1024 * 1024
	}
});

async function getDeweyFeatureContextForRequest(userId) {
	const userResult = await pool.query(
		"SELECT dewey_enabled FROM users WHERE id = $1 AND is_disabled = false",
		[userId]
	);

	if (userResult.rows.length === 0) {
		return { featureContext: null, userFound: false };
	}

	return {
		featureContext: buildUserFeatureContext(userResult.rows[0]),
		userFound: true
	};
}

function runDeweyUploadMiddleware(req, res) {
	return new Promise((resolve, reject) => {
		deweyUpload.single("file")(req, res, (error) => {
			if (error) reject(error);
			else resolve();
		});
	});
}

router.get("/dewey-source/status", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user?.id || null;

	try {
		const { userFound } = await getDeweyFeatureContextForRequest(userId);
		if (!userFound) {
			return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		}

		const status = await getUserDeweySourceStatus(userId);
		return successResponse(res, 200, "Dewey source status retrieved successfully.", status);
	} catch (error) {
		logToFile("DEWEY_SOURCE_STATUS", {
			status: "FAILURE",
			user_id: userId,
			error_message: error.message,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Dewey source status unavailable.", ["Unable to retrieve the Dewey source status right now."]);
	}
});

router.post("/dewey-source/upload", requiresAuth, authenticatedLimiter, async (req, res) => {
	const userId = req.user?.id || null;

	logToFile("DEWEY_SOURCE_UPLOAD", {
		status: "INFO",
		user_id: userId,
		path: req.originalUrl || req.url,
		ip: req.ip,
		user_agent: req.get("user-agent")
	}, "info");

	try {
		const { featureContext, userFound } = await getDeweyFeatureContextForRequest(userId);
		if (!userFound) {
			return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		}

		if (!featureContext.features.dewey.available) {
			return errorResponse(res, 403, "Dewey upload is not available.", [
				"Dewey Decimal support is currently unavailable for this deployment."
			]);
		}

		await runDeweyUploadMiddleware(req, res);
	} catch (error) {
		const isFileTooLarge = error && error.code === "LIMIT_FILE_SIZE";
		logToFile("DEWEY_SOURCE_UPLOAD", {
			status: "FAILURE",
			user_id: userId,
			error_message: error.message,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, isFileTooLarge ? "warn" : "error");
		return errorResponse(res, 400, "Dewey upload failed.", [
			isFileTooLarge
				? "The CSV file is too large. Please keep uploads under 1 MB."
				: "Unable to read the uploaded CSV file."
		]);
	}

	const uploadedFile = req.file;
	if (!uploadedFile || !uploadedFile.buffer || uploadedFile.buffer.length === 0) {
		return errorResponse(res, 400, "Validation Error", ["Please choose a CSV file to upload."]);
	}

	try {
		const uploadResult = await uploadUserDeweySource(userId, {
			originalFilename: uploadedFile.originalname || "dewey-upload.csv",
			csvText: uploadedFile.buffer.toString("utf8")
		});

		const message = uploadResult.uploadAccepted
			? "Dewey source uploaded successfully."
			: "Dewey source validation failed.";
		return successResponse(res, 200, message, uploadResult);
	} catch (error) {
		logToFile("DEWEY_SOURCE_UPLOAD", {
			status: "FAILURE",
			user_id: userId,
			error_message: error.message,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Dewey upload failed.", ["Unable to process the Dewey source right now."]);
	}
});

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
		const { featureContext, userFound } = await getDeweyFeatureContextForRequest(userId);
		if (!userFound) {
			logToFile("DEWEY_DATASET_REQUEST", {
				status: "FAILURE",
				user_id: userId,
				reason: "user_not_found",
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "warn");
			return errorResponse(res, 404, "User not found.", ["The requested user record could not be located."]);
		}

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
