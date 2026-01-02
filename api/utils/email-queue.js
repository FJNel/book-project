// Lightweight in-memory email queue with retry + backoff (non-blocking)
const { v4: uuidv4 } = require('uuid');
const { logToFile } = require('./logging');
const {
	sendVerificationEmail,
	sendPasswordResetEmail,
	sendWelcomeEmail,
	sendPasswordResetSuccessEmail,
	sendAccountDisableVerificationEmail,
	sendAccountDisableConfirmationEmail,
	sendAccountDeletionVerificationEmail,
	sendAccountDeletionAdminEmail,
	sendEmailChangeVerificationEmail,
	sendEmailChangeConfirmationEmail,
	sendAdminProfileUpdateEmail,
	sendAdminAccountDisabledEmail,
	sendAdminAccountEnabledEmail,
	sendAdminEmailUnverifiedEmail,
	sendAdminEmailVerifiedEmail,
	sendAdminAccountSetupEmail,
} = require('./email');

const config = {
	maxRetries: 3,
	initialDelayMs: 1000,
	backoffFactor: 2,
};

const queue = [];
let isProcessing = false;

function enqueueEmail({ type, params = {}, context = null, userId = null }) {
	const job = {
		id: uuidv4(),
		type,
		params,
		context,
		userId,
		attempt: 0,
		enqueuedAt: Date.now(),
	};

	queue.push(job);
	logToFile(
		'EMAIL_QUEUE',
		{
			status: 'INFO',
			action: 'ENQUEUED',
			job_id: job.id,
			type,
			user_id: userId,
			details: { context, queued_at: new Date(job.enqueuedAt).toISOString() },
		},
		'info',
	);

	processQueue();
}

async function processQueue() {
	if (isProcessing) return;
	const job = queue.shift();
	if (!job) return;

	const dequeuedAt = Date.now();
	job.dequeuedAt = dequeuedAt;
	const waitMs = dequeuedAt - (job.enqueuedAt || dequeuedAt);

	logToFile(
		'EMAIL_QUEUE',
		{
			status: 'INFO',
			action: 'DEQUEUED',
			job_id: job.id,
			type: job.type,
			user_id: job.userId,
			details: { context: job.context, wait_ms: waitMs },
		},
		'info',
	);

	isProcessing = true;
	const sendStartedAt = Date.now();
	try {
		await runJob(job);
		const sendDurationMs = Date.now() - sendStartedAt;
		logToFile(
			'EMAIL_SEND',
			{
				status: 'SUCCESS',
				job_id: job.id,
				type: job.type,
				user_id: job.userId,
				details: {
					context: job.context,
					wait_ms: waitMs,
					send_duration_ms: sendDurationMs,
					attempt: job.attempt + 1,
				},
			},
			'info',
		);
	} catch (e) {
		job.attempt += 1;
		const sendDurationMs = Date.now() - sendStartedAt;
		if (job.attempt <= config.maxRetries) {
			const delay = config.initialDelayMs * Math.pow(config.backoffFactor, job.attempt - 1);
			logToFile(
				'EMAIL_SEND',
				{
					status: 'FAILURE',
					job_id: job.id,
					type: job.type,
					user_id: job.userId,
					error_message: e.message,
					details: {
						context: job.context,
						attempt: job.attempt,
						retry_in_ms: delay,
						wait_ms: waitMs,
						send_duration_ms: sendDurationMs,
					},
				},
				'warn',
			);
			setTimeout(() => {
				job.enqueuedAt = Date.now();
				queue.push(job);
				processQueue();
			}, delay);
		} else {
			logToFile(
				'EMAIL_SEND',
				{
					status: 'FAILURE',
					job_id: job.id,
					type: job.type,
					user_id: job.userId,
					error_message: e.message,
					details: {
						context: job.context,
						terminal: true,
						attempt: job.attempt,
						wait_ms: waitMs,
						send_duration_ms: sendDurationMs,
					},
				},
				'error',
			);
		}
	} finally {
		isProcessing = false;
		if (queue.length > 0) processQueue();
	}
}

async function runJob(job) {
	const { type, params } = job;
	switch (type) {
		case 'verification':
			// params: toEmail, token, preferredName, expiresIn
			return sendVerificationEmail(params.toEmail, params.token, params.preferredName, params.expiresIn);
		case 'password_reset':
			// params: toEmail, token, preferredName, expiresIn
			return sendPasswordResetEmail(params.toEmail, params.token, params.preferredName, params.expiresIn);
		case 'welcome':
			// params: toEmail, preferredName
			return sendWelcomeEmail(params.toEmail, params.preferredName);
		case 'password_reset_success':
			// params: toEmail, preferredName
			return sendPasswordResetSuccessEmail(params.toEmail, params.preferredName);
		case 'account_disable_verification':
			return sendAccountDisableVerificationEmail(params.toEmail, params.preferredName, params.token, params.expiresIn);
		case 'account_disable_confirmation':
			return sendAccountDisableConfirmationEmail(params.toEmail, params.preferredName);
		case 'account_delete_verification':
			return sendAccountDeletionVerificationEmail(params.toEmail, params.preferredName, params.token, params.expiresIn);
		case 'account_delete_admin_notice':
			return sendAccountDeletionAdminEmail(params);
		case 'email_change_verification':
			return sendEmailChangeVerificationEmail(params.toEmail, params.preferredName, params.token, params.expiresIn);
		case 'email_change_confirmation':
			return sendEmailChangeConfirmationEmail(params.toEmail, params.newEmail, params.preferredName);
		case 'admin_profile_update':
			return sendAdminProfileUpdateEmail(params.toEmail, params.preferredName, params.changes);
		case 'admin_account_disabled':
			return sendAdminAccountDisabledEmail(params.toEmail, params.preferredName);
		case 'admin_account_enabled':
			return sendAdminAccountEnabledEmail(params.toEmail, params.preferredName);
		case 'admin_email_unverified':
			return sendAdminEmailUnverifiedEmail(params.toEmail, params.preferredName, params.reason);
		case 'admin_email_verified':
			return sendAdminEmailVerifiedEmail(params.toEmail, params.preferredName, params.reason);
		case 'admin_account_setup':
			return sendAdminAccountSetupEmail(
				params.toEmail,
				params.preferredName,
				params.verificationToken,
				params.resetToken,
				params.verificationExpiresIn,
				params.resetExpiresIn
			);
		default:
			throw new Error(`Unknown email job type: ${type}`);
	}
}

module.exports = { enqueueEmail };
