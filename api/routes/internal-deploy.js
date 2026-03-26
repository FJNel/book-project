const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const { spawn, spawnSync } = require("child_process");

const config = require("../config");
const { successResponse, errorResponse } = require("../utils/response");
const { logToFile } = require("../utils/logging");

const router = express.Router();

function getWebhookContext(req) {
	return {
		method: req.method,
		path: req.originalUrl || req.url,
		ip: req.ip,
		user_agent: req.get("user-agent"),
		github_event: req.get("X-GitHub-Event") || null,
		github_delivery: req.get("X-GitHub-Delivery") || null,
	};
}

function verifySignature(rawBody, signatureHeader, secret) {
	if (!Buffer.isBuffer(rawBody) || !signatureHeader || !secret) {
		return false;
	}

	const normalizedSignature = String(signatureHeader).trim();
	if (!normalizedSignature.startsWith("sha256=")) {
		return false;
	}

	const expectedSignature = `sha256=${crypto
		.createHmac("sha256", secret)
		.update(rawBody)
		.digest("hex")}`;

	const providedBuffer = Buffer.from(normalizedSignature, "utf8");
	const expectedBuffer = Buffer.from(expectedSignature, "utf8");
	if (providedBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function getDeployServiceState() {
	const result = spawnSync(
		config.deploy.sudoPath,
		[config.deploy.systemctlPath, "is-active", config.deploy.serviceName],
		{
			encoding: "utf8",
			timeout: 10000,
		}
	);

	if (result.error) {
		throw result.error;
	}

	const state = String(result.stdout || "").trim().toLowerCase();
	return {
		state,
		status: result.status,
		stderr: String(result.stderr || "").trim(),
	};
}

function isRunningServiceState(state) {
	return state === "active" || state === "activating" || state === "reloading";
}

function requestDeployServiceStart(context) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const child = spawn(
			config.deploy.sudoPath,
			[config.deploy.systemctlPath, "start", "--no-block", config.deploy.serviceName],
			{
				cwd: config.deploy.workingDirectory,
				env: process.env,
				stdio: "ignore",
			}
		);

		child.once("error", (error) => {
			if (settled) return;
			settled = true;
			reject(error);
		});
		child.once("exit", (code, signal) => {
			logToFile("DEPLOY_WEBHOOK_SYSTEMD", {
				status: code === 0 ? "SUCCESS" : "FAILURE",
				reason: "SYSTEMD_START_EXIT",
				exit_code: code,
				signal: signal || null,
				service_name: config.deploy.serviceName,
				...context,
			}, code === 0 ? "info" : "error");

			if (settled) return;
			settled = true;
			if (code === 0) {
				resolve(child.pid || null);
				return;
			}
			reject(new Error(`systemctl start exited with code ${code}${signal ? ` (signal: ${signal})` : ""}`));
		});
		child.unref();
	});
}

function ensureDeployServiceConfig(context) {
	if (!fs.existsSync(config.deploy.scriptPath)) {
		logToFile("DEPLOY_WEBHOOK_CONFIG", {
			status: "FAILURE",
			reason: "SCRIPT_NOT_FOUND",
			script_path: config.deploy.scriptPath,
			...context,
		}, "error");
		return {
			ok: false,
			response: errorResponse,
			args: [503, "Deploy Unavailable", ["Deploy script is not available."]],
		};
	}

	if (!fs.existsSync(config.deploy.workingDirectory)) {
		logToFile("DEPLOY_WEBHOOK_CONFIG", {
			status: "FAILURE",
			reason: "WORKING_DIRECTORY_NOT_FOUND",
			working_directory: config.deploy.workingDirectory,
			...context,
		}, "error");
		return {
			ok: false,
			response: errorResponse,
			args: [503, "Deploy Unavailable", ["Deploy working directory is not available."]],
		};
	}

	if (!fs.existsSync(config.deploy.systemctlPath)) {
		logToFile("DEPLOY_WEBHOOK_CONFIG", {
			status: "FAILURE",
			reason: "SYSTEMCTL_NOT_FOUND",
			systemctl_path: config.deploy.systemctlPath,
			...context,
		}, "error");
		return {
			ok: false,
			response: errorResponse,
			args: [503, "Deploy Unavailable", ["systemctl is not available."]],
		};
	}

	if (!fs.existsSync(config.deploy.sudoPath)) {
		logToFile("DEPLOY_WEBHOOK_CONFIG", {
			status: "FAILURE",
			reason: "SUDO_NOT_FOUND",
			sudo_path: config.deploy.sudoPath,
			...context,
		}, "error");
		return {
			ok: false,
			response: errorResponse,
			args: [503, "Deploy Unavailable", ["sudo is not available."]],
		};
	}

	return { ok: true };
}

router.post("/", async (req, res) => {
	const context = getWebhookContext(req);
	logToFile("DEPLOY_WEBHOOK_RECEIVED", {
		status: "INFO",
		...context,
	}, "info");

	if (!config.deploy.webhookEnabled) {
		logToFile("DEPLOY_WEBHOOK_DISABLED", {
			status: "FAILURE",
			reason: "WEBHOOK_DISABLED",
			...context,
		}, "warn");
		return errorResponse(res, 503, "Webhook Disabled", ["Deploy webhook is not enabled."]);
	}

	if (!config.deploy.webhookSecret) {
		logToFile("DEPLOY_WEBHOOK_DISABLED", {
			status: "FAILURE",
			reason: "MISSING_SECRET",
			...context,
		}, "error");
		return errorResponse(res, 503, "Webhook Disabled", ["Deploy webhook is not configured."]);
	}

	if (!Buffer.isBuffer(req.body)) {
		logToFile("DEPLOY_WEBHOOK_BODY", {
			status: "FAILURE",
			reason: "RAW_BODY_MISSING",
			...context,
		}, "error");
		return errorResponse(res, 400, "Invalid Request", ["Invalid webhook payload."]);
	}

	const signatureHeader = req.get("X-Hub-Signature-256");
	if (!signatureHeader) {
		logToFile("DEPLOY_WEBHOOK_SIGNATURE", {
			status: "FAILURE",
			reason: "MISSING_SIGNATURE",
			...context,
		}, "warn");
		return errorResponse(res, 401, "Unauthorized", ["Invalid webhook signature."]);
	}

	if (!verifySignature(req.body, signatureHeader, config.deploy.webhookSecret)) {
		logToFile("DEPLOY_WEBHOOK_SIGNATURE", {
			status: "FAILURE",
			reason: "INVALID_SIGNATURE",
			...context,
		}, "warn");
		return errorResponse(res, 401, "Unauthorized", ["Invalid webhook signature."]);
	}

	logToFile("DEPLOY_WEBHOOK_SIGNATURE", {
		status: "SUCCESS",
		...context,
	}, "info");

	const githubEvent = req.get("X-GitHub-Event");
	if (githubEvent !== "push") {
		logToFile("DEPLOY_WEBHOOK_IGNORED", {
			status: "SKIPPED",
			reason: "UNSUPPORTED_EVENT",
			...context,
		}, "info");
		return successResponse(res, 200, "Webhook ignored.", {
			accepted: false,
			ignored: true,
			reason: "unsupported_event",
		});
	}

	let payload;
	try {
		payload = JSON.parse(req.body.toString("utf8"));
	} catch (error) {
		logToFile("DEPLOY_WEBHOOK_PAYLOAD", {
			status: "FAILURE",
			reason: "INVALID_JSON",
			error_message: error.message,
			...context,
		}, "warn");
		return errorResponse(res, 400, "Invalid Request", ["Invalid webhook payload."]);
	}

	if (payload.ref !== "refs/heads/main") {
		logToFile("DEPLOY_WEBHOOK_IGNORED", {
			status: "SKIPPED",
			reason: "NON_MAIN_BRANCH",
			ref: payload.ref || null,
			...context,
		}, "info");
		return successResponse(res, 200, "Webhook ignored.", {
			accepted: false,
			ignored: true,
			reason: "not_main_branch",
		});
	}

	const configCheck = ensureDeployServiceConfig(context);
	if (!configCheck.ok) {
		return configCheck.response(res, ...configCheck.args);
	}

	let serviceState;
	try {
		serviceState = getDeployServiceState();
	} catch (error) {
		logToFile("DEPLOY_WEBHOOK_LOCKED", {
			status: "FAILURE",
			reason: "SERVICE_STATE_CHECK_FAILED",
			error_message: error.message,
			service_name: config.deploy.serviceName,
			...context,
		}, "error");
		return errorResponse(res, 503, "Deploy Unavailable", ["Deploy service status could not be checked."]);
	}

	if (isRunningServiceState(serviceState.state)) {
		logToFile("DEPLOY_WEBHOOK_LOCKED", {
			status: "SKIPPED",
			reason: "DEPLOY_ALREADY_RUNNING",
			service_name: config.deploy.serviceName,
			service_state: serviceState.state || null,
			...context,
		}, "warn");
		return successResponse(res, 202, "Deploy already in progress.", {
			accepted: false,
			serviceName: config.deploy.serviceName,
			deployInProgress: true,
		});
	}

	try {
		const requestPid = await requestDeployServiceStart(context);
		logToFile("DEPLOY_WEBHOOK_STARTED", {
			status: "SUCCESS",
			pid: requestPid,
			script_path: config.deploy.scriptPath,
			working_directory: config.deploy.workingDirectory,
			service_name: config.deploy.serviceName,
			ref: payload.ref,
			...context,
		}, "info");
	} catch (error) {
		logToFile("DEPLOY_WEBHOOK_SYSTEMD", {
			status: "FAILURE",
			reason: "SYSTEMD_START_FAILED",
			error_message: error.message,
			service_name: config.deploy.serviceName,
			...context,
		}, "error");
		return errorResponse(res, 503, "Deploy Unavailable", ["Deploy service could not be started."]);
	}

	return successResponse(res, 202, "Deploy accepted.", {
		accepted: true,
		deployStarted: true,
		serviceName: config.deploy.serviceName,
	});
});

router.all("/", (req, res) => {
	const context = getWebhookContext(req);
	logToFile("DEPLOY_WEBHOOK_METHOD", {
		status: "FAILURE",
		reason: "METHOD_NOT_ALLOWED",
		...context,
	}, "warn");
	return errorResponse(res, 405, "Method Not Allowed", ["Only POST is allowed."]);
});

module.exports = router;
