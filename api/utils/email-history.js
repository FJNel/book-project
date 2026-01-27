const pool = require("../db");
const { logToFile, sanitizeInput } = require("./logging");

function normalizeStatus(value) {
	if (!value) return "queued";
	return String(value).trim().toLowerCase();
}

function sanitizeFailureReason(reason) {
	if (!reason) return null;
	const sanitized = sanitizeInput(reason);
	const text = typeof sanitized === "string" ? sanitized : String(sanitized);
	return text.slice(0, 500);
}

async function recordEmailHistory({
	jobId,
	emailType,
	recipientEmail,
	queuedAt = new Date().toISOString(),
	status = "queued",
	failureReason = null,
	retryCount = 0
}) {
	if (!emailType || !recipientEmail) return null;
	try {
		const result = await pool.query(
			`INSERT INTO email_send_history (
				job_id, email_type, recipient_email, queued_at, status, failure_reason, retry_count
			) VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id`,
			[
				jobId || null,
				String(emailType),
				String(recipientEmail).toLowerCase(),
				queuedAt,
				normalizeStatus(status),
				sanitizeFailureReason(failureReason),
				Number.isInteger(retryCount) ? retryCount : 0
			]
		);
		return result.rows[0]?.id ?? null;
	} catch (error) {
		if (error?.code === "42P01") return null;
		logToFile("EMAIL_HISTORY_WRITE", {
			status: "FAILURE",
			error_message: error.message,
			email_type: emailType,
			to_email: recipientEmail
		}, "error");
		return null;
	}
}

async function updateEmailHistory(jobId, {
	status,
	sentAt,
	failureReason,
	retryCount
} = {}) {
	if (!jobId) return null;
	const updates = [];
	const values = [];
	let idx = 1;

	if (status) {
		updates.push(`status = $${idx++}`);
		values.push(normalizeStatus(status));
	}
	if (sentAt) {
		updates.push(`sent_at = $${idx++}`);
		values.push(sentAt);
	}
	if (failureReason !== undefined) {
		updates.push(`failure_reason = $${idx++}`);
		values.push(sanitizeFailureReason(failureReason));
	}
	if (retryCount !== undefined) {
		updates.push(`retry_count = $${idx++}`);
		values.push(Number.isInteger(retryCount) ? retryCount : 0);
	}
	if (!updates.length) return null;

	try {
		await pool.query(
			`UPDATE email_send_history
			 SET ${updates.join(", ")}
			 WHERE job_id = $${idx}`,
			[...values, jobId]
		);
		return true;
	} catch (error) {
		if (error?.code === "42P01") return null;
		logToFile("EMAIL_HISTORY_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			job_id: jobId
		}, "error");
		return null;
	}
}

module.exports = {
	recordEmailHistory,
	updateEmailHistory
};
