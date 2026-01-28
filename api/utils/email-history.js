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
	retryCount = 0,
	targetUserId = null,
	templateSignature = null
}) {
	if (!emailType || !recipientEmail) return null;
	try {
		const result = await pool.query(
			`INSERT INTO email_send_history (
				job_id, email_type, recipient_email, queued_at, status, failure_reason, retry_count, target_user_id, template_signature
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id`,
			[
				jobId || null,
				String(emailType),
				String(recipientEmail).toLowerCase(),
				queuedAt,
				normalizeStatus(status),
				sanitizeFailureReason(failureReason),
				Number.isInteger(retryCount) ? retryCount : 0,
				Number.isInteger(targetUserId) ? targetUserId : null,
				typeof templateSignature === "string" && templateSignature.trim() ? templateSignature.trim() : null
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

async function wasEmailSentRecently({
	emailType,
	recipientEmail,
	targetUserId = null,
	templateSignature = null,
	withinHours = 24,
	client = pool
}) {
	if (!emailType || !recipientEmail) return false;
	try {
		const result = await client.query(
			`SELECT 1
			 FROM email_send_history
			 WHERE email_type = $1
			   AND recipient_email = $2
			   AND ($3::int IS NULL OR target_user_id = $3)
			   AND ($4::text IS NULL OR template_signature = $4)
			   AND queued_at >= NOW() - ($5::int * INTERVAL '1 hour')
			 LIMIT 1`,
			[
				String(emailType),
				String(recipientEmail).toLowerCase(),
				Number.isInteger(targetUserId) ? targetUserId : null,
				typeof templateSignature === "string" && templateSignature.trim() ? templateSignature.trim() : null,
				Number.isInteger(withinHours) ? withinHours : 24
			]
		);
		return result.rows.length > 0;
	} catch (error) {
		if (error?.code === "42P01") return false;
		logToFile("EMAIL_HISTORY_QUERY", {
			status: "FAILURE",
			error_message: error.message,
			email_type: emailType,
			to_email: recipientEmail
		}, "error");
		return false;
	}
}

async function wasTemplateSentRecently({
	emailType,
	templateSignature,
	withinHours = 24,
	client = pool
}) {
	if (!emailType || !templateSignature) return false;
	try {
		const result = await client.query(
			`SELECT 1
			 FROM email_send_history
			 WHERE email_type = $1
			   AND template_signature = $2
			   AND status = 'sent'
			   AND queued_at >= NOW() - ($3::int * INTERVAL '1 hour')
			 LIMIT 1`,
			[
				String(emailType),
				String(templateSignature).trim(),
				Number.isInteger(withinHours) ? withinHours : 24
			]
		);
		return result.rows.length > 0;
	} catch (error) {
		if (error?.code === "42P01") return false;
		logToFile("EMAIL_HISTORY_QUERY", {
			status: "FAILURE",
			error_message: error.message,
			email_type: emailType
		}, "error");
		return false;
	}
}

module.exports = {
	recordEmailHistory,
	updateEmailHistory,
	wasEmailSentRecently,
	wasTemplateSentRecently
};
