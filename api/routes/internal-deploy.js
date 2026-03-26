const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const { spawn } = require("child_process");

const config = require("../config");
const { successResponse, errorResponse } = require("../utils/response");
const { logToFile } = require("../utils/logging");

const router = express.Router();

let activeDeployProcess = null;

function isProcessRunning(pid) {
	if (!Number.isInteger(pid) || pid <= 0) {
		return false;
	}

	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (error && error.code === "ESRCH") {
			return false;
		}
		return true;
	}
}

function readLockFile() {
	if (!fs.existsSync(config.deploy.lockFilePath)) {
		return null;
	}

	try {
		return JSON.parse(fs.readFileSync(config.deploy.lockFilePath, "utf8"));
	} catch (_) {
		return null;
	}
}

function clearDeployLock(expectedPid = null) {
	if (!fs.existsSync(config.deploy.lockFilePath)) {
		return;
	}

	if (expectedPid !== null) {
		const existingLock = readLockFile();
		if (existingLock && existingLock.pid !== expectedPid) {
			return;
		}
	}

	try {
		fs.unlinkSync(config.deploy.lockFilePath);
	} catch (error) {
		if (error.code !== "ENOENT") {
			throw error;
		}
	}
}

function tryAcquireDeployLock(context) {
	const lockPayload = {
		pid: null,
		acquiredAt: new Date().toISOString(),
		githubDelivery: context.github_delivery || null,
	};

	try {
		const fd = fs.openSync(config.deploy.lockFilePath, "wx");
		fs.writeFileSync(fd, JSON.stringify(lockPayload, null, 2));
		fs.closeSync(fd);
		return { acquired: true, lock: lockPayload };
	} catch (error) {
		if (error.code !== "EEXIST") {
			throw error;
		}
	}

	const existingLock = readLockFile();
	if (existingLock && isProcessRunning(existingLock.pid)) {
		return { acquired: false, lock: existingLock };
	}

	clearDeployLock(existingLock && Number.isInteger(existingLock.pid) ? existingLock.pid : null);
	logToFile("DEPLOY_WEBHOOK_LOCKED", {
		status: "INFO",
		reason: "STALE_LOCK_CLEARED",
		lock_file_path: config.deploy.lockFilePath,
		stale_pid: existingLock && existingLock.pid ? existingLock.pid : null,
		...context,
	}, "info");

	const retryFd = fs.openSync(config.deploy.lockFilePath, "wx");
	fs.writeFileSync(retryFd, JSON.stringify(lockPayload, null, 2));
	fs.closeSync(retryFd);
	return { acquired: true, lock: lockPayload };
}

function updateDeployLockPid(pid) {
	const existingLock = readLockFile() || {};
	const nextLock = {
		...existingLock,
		pid,
	};
	fs.writeFileSync(config.deploy.lockFilePath, JSON.stringify(nextLock, null, 2));
}

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

function clearActiveDeploy(reference) {
	if (activeDeployProcess === reference) {
		activeDeployProcess = null;
	}
}

router.post("/", (req, res) => {
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

	let lockResult;
	try {
		lockResult = tryAcquireDeployLock(context);
	} catch (error) {
		logToFile("DEPLOY_WEBHOOK_LOCKED", {
			status: "FAILURE",
			reason: "LOCK_ACQUIRE_FAILED",
			error_message: error.message,
			lock_file_path: config.deploy.lockFilePath,
			...context,
		}, "error");
		return errorResponse(res, 503, "Deploy Unavailable", ["Deploy lock could not be acquired."]);
	}

	if (!lockResult.acquired) {
		logToFile("DEPLOY_WEBHOOK_LOCKED", {
			status: "SKIPPED",
			reason: "DEPLOY_ALREADY_RUNNING",
			active_pid: lockResult.lock && lockResult.lock.pid ? lockResult.lock.pid : null,
			lock_file_path: config.deploy.lockFilePath,
			...context,
		}, "warn");
		return successResponse(res, 202, "Deploy already in progress.", {
			accepted: false,
			deployInProgress: true,
		});
	}

	if (!fs.existsSync(config.deploy.scriptPath)) {
		clearDeployLock();
		logToFile("DEPLOY_WEBHOOK_CONFIG", {
			status: "FAILURE",
			reason: "SCRIPT_NOT_FOUND",
			script_path: config.deploy.scriptPath,
			...context,
		}, "error");
		return errorResponse(res, 503, "Deploy Unavailable", ["Deploy script is not available."]);
	}

	if (!fs.existsSync(config.deploy.workingDirectory)) {
		clearDeployLock();
		logToFile("DEPLOY_WEBHOOK_CONFIG", {
			status: "FAILURE",
			reason: "WORKING_DIRECTORY_NOT_FOUND",
			working_directory: config.deploy.workingDirectory,
			...context,
		}, "error");
		return errorResponse(res, 503, "Deploy Unavailable", ["Deploy working directory is not available."]);
	}

	const child = spawn("/bin/bash", [config.deploy.scriptPath], {
		cwd: config.deploy.workingDirectory,
		env: process.env,
		stdio: "ignore",
	});

	activeDeployProcess = child;

	child.on("spawn", () => {
		try {
			updateDeployLockPid(child.pid || null);
		} catch (error) {
			logToFile("DEPLOY_WEBHOOK_LOCKED", {
				status: "FAILURE",
				reason: "LOCK_UPDATE_FAILED",
				error_message: error.message,
				lock_file_path: config.deploy.lockFilePath,
				pid: child.pid || null,
				...context,
			}, "error");
		}
		logToFile("DEPLOY_WEBHOOK_STARTED", {
			status: "SUCCESS",
			pid: child.pid || null,
			script_path: config.deploy.scriptPath,
			working_directory: config.deploy.workingDirectory,
			lock_file_path: config.deploy.lockFilePath,
			ref: payload.ref,
			...context,
		}, "info");
	});

	child.on("error", (error) => {
		clearDeployLock(child.pid || null);
		clearActiveDeploy(child);
		logToFile("DEPLOY_WEBHOOK_PROCESS", {
			status: "FAILURE",
			reason: "SPAWN_ERROR",
			error_message: error.message,
			pid: child.pid || null,
			...context,
		}, "error");
	});

	child.on("exit", (code, signal) => {
		clearDeployLock(child.pid || null);
		clearActiveDeploy(child);
		logToFile("DEPLOY_WEBHOOK_PROCESS", {
			status: code === 0 ? "SUCCESS" : "FAILURE",
			exit_code: code,
			signal: signal || null,
			pid: child.pid || null,
			...context,
		}, code === 0 ? "info" : "error");
	});

	child.unref();

	return successResponse(res, 202, "Deploy accepted.", {
		accepted: true,
		deployStarted: true,
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
