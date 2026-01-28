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
	sendDevelopmentFeaturesEmail,
	sendApiKeyCreatedEmail,
	sendApiKeyRevokedEmail,
	sendApiKeyBanAppliedEmail,
	sendApiKeyBanRemovedEmail,
	sendUsageRestrictionAppliedEmail,
	sendUsageRestrictionRemovedEmail,
	sendUsageWarningUserEmail,
	sendUsageWarningApiKeyEmail,
	sendUsageAdminAlertEmail,
	sendApiKeyExpiringEmail,
	sendApiKeyExpiredEmail,
} = require('./email');
const {
	canSendEmailForUser,
	getEmailCategoryForType,
	logPreferenceSkip
} = require('./email-preferences');
const { recordEmailHistory, updateEmailHistory } = require("./email-history");

const config = {
	maxRetries: 3,
	initialDelayMs: 1000,
	backoffFactor: 2,
};

const queue = [];
let isProcessing = false;

function enqueueEmail({ type, params = {}, context = null, userId = null, targetUserId = null, templateSignature = null }) {
	const job = {
		id: uuidv4(),
		type,
		params,
		context,
		userId,
		targetUserId,
		templateSignature,
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
	recordEmailHistory({
		jobId: job.id,
		emailType: type,
		recipientEmail: params?.toEmail,
		queuedAt: new Date(job.enqueuedAt).toISOString(),
		status: "queued",
		retryCount: 0,
		targetUserId: job.targetUserId,
		templateSignature: job.templateSignature
	});

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
		const result = await runJob(job);
		if (result?.skipped) {
			logToFile(
				'EMAIL_SEND',
				{
					status: 'SKIPPED',
					job_id: job.id,
					type: job.type,
					user_id: job.userId,
					details: {
						context: job.context,
						wait_ms: waitMs,
						reason: result.reason
					}
				},
				'info',
			);
			await updateEmailHistory(job.id, {
				status: "skipped",
				sentAt: new Date().toISOString(),
				failureReason: result.reason,
				retryCount: job.attempt || 0
			});
			return;
		}
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
		await updateEmailHistory(job.id, {
			status: "sent",
			sentAt: new Date().toISOString(),
			failureReason: null,
			retryCount: job.attempt || 0
		});
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
			await updateEmailHistory(job.id, {
				status: "failed",
				failureReason: e.message,
				retryCount: job.attempt
			});
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
			await updateEmailHistory(job.id, {
				status: "failed",
				failureReason: e.message,
				retryCount: job.attempt
			});
		}
	} finally {
		isProcessing = false;
		if (queue.length > 0) processQueue();
	}
}

async function runJob(job) {
	const { type, params } = job;
	const category = getEmailCategoryForType(type);
	const preferenceCheck = await canSendEmailForUser({
		userId: job.userId,
		emailType: type,
		category
	});

	if (!preferenceCheck.canSend) {
		logPreferenceSkip({
			userId: job.userId,
			emailType: type,
			category,
			reason: preferenceCheck.reason,
			context: job.context
		});
		return { skipped: true, reason: preferenceCheck.reason };
	}

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
		case 'dev_features_announcement':
			return sendDevelopmentFeaturesEmail(params.toEmail, params.preferredName, params.subject, params.markdownBody);
		case 'api_key_created':
			return sendApiKeyCreatedEmail(params.toEmail, params.preferredName, params.keyName, params.keyPrefix, params.expiresAt);
		case 'api_key_revoked':
			return sendApiKeyRevokedEmail(params.toEmail, params.preferredName, params.keyName, params.keyPrefix, params.initiator);
		case 'api_key_ban_applied':
			return sendApiKeyBanAppliedEmail(params.toEmail, params.preferredName, params.reason);
		case 'api_key_ban_removed':
			return sendApiKeyBanRemovedEmail(params.toEmail, params.preferredName);
		case 'usage_restriction_applied':
			return sendUsageRestrictionAppliedEmail(params.toEmail, params.preferredName, params.reason, params.lockoutUntil);
		case 'usage_restriction_removed':
			return sendUsageRestrictionRemovedEmail(params.toEmail, params.preferredName);
		case 'usage_warning_user':
			return sendUsageWarningUserEmail(params.toEmail, params.preferredName, params.usageLevel);
		case 'usage_warning_api_key':
			return sendUsageWarningApiKeyEmail(params.toEmail, params.preferredName, params.keyName, params.keyPrefix, params.usageLevel);
		case 'usage_admin_alert_website':
			return sendUsageAdminAlertEmail({ ...params, emailType: type });
		case 'usage_admin_alert_api':
			return sendUsageAdminAlertEmail({ ...params, emailType: type });
		case 'api_key_expiring':
			return sendApiKeyExpiringEmail(params.toEmail, params.preferredName, params.keyName, params.expiresAt);
		case 'api_key_expired':
			return sendApiKeyExpiredEmail(params.toEmail, params.preferredName, params.keyName);
		default:
			logToFile(
				'EMAIL_SEND',
				{
					status: 'FAILURE',
					job_id: job.id,
					type,
					user_id: job.userId,
					error_message: 'Unknown email job type',
					details: {
						context: job.context,
						attempt: job.attempt + 1,
					},
				},
				'error',
			);
			throw new Error(`Unknown email job type: ${type}`);
	}
}

function getQueueStats() {
	return {
		queueLength: queue.length,
		isProcessing
	};
}

module.exports = { enqueueEmail, getQueueStats };
