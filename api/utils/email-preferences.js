const pool = require('../db');
const { logToFile } = require('./logging');

const DEFAULT_EMAIL_PREFERENCES = {
	accountUpdates: true,
	devFeatures: false
};

const EMAIL_CATEGORIES = {
	ESSENTIAL: 'essential',
	ACCOUNT_UPDATES: 'account_updates',
	DEV_FEATURES: 'dev_features'
};

const EMAIL_TYPE_CATEGORY_MAP = {
	verification: EMAIL_CATEGORIES.ESSENTIAL,
	password_reset: EMAIL_CATEGORIES.ESSENTIAL,
	password_reset_success: EMAIL_CATEGORIES.ESSENTIAL,
	account_disable_verification: EMAIL_CATEGORIES.ESSENTIAL,
	account_disable_confirmation: EMAIL_CATEGORIES.ESSENTIAL,
	account_delete_verification: EMAIL_CATEGORIES.ESSENTIAL,
	account_delete_admin_notice: EMAIL_CATEGORIES.ESSENTIAL,
	email_change_verification: EMAIL_CATEGORIES.ESSENTIAL,
	email_change_confirmation: EMAIL_CATEGORIES.ESSENTIAL,
	admin_account_setup: EMAIL_CATEGORIES.ESSENTIAL,
	api_key_revoked: EMAIL_CATEGORIES.ESSENTIAL,
	api_key_ban_applied: EMAIL_CATEGORIES.ESSENTIAL,
	api_key_ban_removed: EMAIL_CATEGORIES.ESSENTIAL,
	usage_restriction_applied: EMAIL_CATEGORIES.ESSENTIAL,
	usage_restriction_removed: EMAIL_CATEGORIES.ESSENTIAL,
	welcome: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	admin_profile_update: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	admin_account_disabled: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	admin_account_enabled: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	admin_email_unverified: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	admin_email_verified: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	api_key_created: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	api_key_expiring: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	api_key_expired: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	usage_warning_user: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	usage_warning_api_key: EMAIL_CATEGORIES.ACCOUNT_UPDATES,
	dev_features_announcement: EMAIL_CATEGORIES.DEV_FEATURES
};

function getEmailCategoryForType(emailType) {
	if (!emailType) return EMAIL_CATEGORIES.ESSENTIAL;
	return EMAIL_TYPE_CATEGORY_MAP[emailType] || EMAIL_CATEGORIES.ESSENTIAL;
}

function normalizePreferencePayload(payload = {}) {
	return {
		accountUpdates: payload.accountUpdates !== undefined ? Boolean(payload.accountUpdates) : undefined,
		devFeatures: payload.devFeatures !== undefined ? Boolean(payload.devFeatures) : undefined
	};
}

async function getUserEmailPreferences(userId, client = pool) {
	const result = await client.query(
		`SELECT email_pref_account_updates, email_pref_dev_features
		 FROM users
		 WHERE id = $1`,
		[userId]
	);
	if (result.rows.length === 0) return null;
	const row = result.rows[0];
	return {
		accountUpdates: row.email_pref_account_updates ?? DEFAULT_EMAIL_PREFERENCES.accountUpdates,
		devFeatures: row.email_pref_dev_features ?? DEFAULT_EMAIL_PREFERENCES.devFeatures
	};
}

async function updateUserEmailPreferences(userId, payload, client = pool) {
	const normalized = normalizePreferencePayload(payload);
	const updates = [];
	const params = [userId];
	let index = 2;

	if (normalized.accountUpdates !== undefined) {
		updates.push(`email_pref_account_updates = $${index++}`);
		params.push(normalized.accountUpdates);
	}
	if (normalized.devFeatures !== undefined) {
		updates.push(`email_pref_dev_features = $${index++}`);
		params.push(normalized.devFeatures);
	}

	if (updates.length === 0) {
		return { updated: false, preferences: await getUserEmailPreferences(userId, client) };
	}

	const result = await client.query(
		`UPDATE users
		 SET ${updates.join(', ')}, email_pref_updated_at = NOW()
		 WHERE id = $1
		 RETURNING email_pref_account_updates, email_pref_dev_features`,
		params
	);

	if (result.rows.length === 0) return null;
	const row = result.rows[0];
	return {
		updated: true,
		preferences: {
			accountUpdates: row.email_pref_account_updates,
			devFeatures: row.email_pref_dev_features
		}
	};
}

function isEssentialCategory(category) {
	return category === EMAIL_CATEGORIES.ESSENTIAL;
}

async function canSendEmailForUser({ userId, emailType, category = null, client = pool }) {
	const resolvedCategory = category || getEmailCategoryForType(emailType);
	if (isEssentialCategory(resolvedCategory)) {
		return { canSend: true, category: resolvedCategory, reason: 'Essential emails cannot be disabled.' };
	}

	if (!userId) {
		return { canSend: true, category: resolvedCategory, reason: 'No user preference linked to this email.' };
	}

	const preferences = await getUserEmailPreferences(userId, client);
	if (!preferences) {
		return { canSend: true, category: resolvedCategory, reason: 'No preference record found; using defaults.' };
	}

	if (resolvedCategory === EMAIL_CATEGORIES.ACCOUNT_UPDATES) {
		return {
			canSend: Boolean(preferences.accountUpdates),
			category: resolvedCategory,
			reason: preferences.accountUpdates ? 'User opted in to account updates.' : 'User opted out of account updates.'
		};
	}

	if (resolvedCategory === EMAIL_CATEGORIES.DEV_FEATURES) {
		return {
			canSend: Boolean(preferences.devFeatures),
			category: resolvedCategory,
			reason: preferences.devFeatures ? 'User opted in to development updates.' : 'User opted out of development updates.'
		};
	}

	return { canSend: true, category: resolvedCategory, reason: 'No preference restrictions found.' };
}

function preferenceSummary(preferences) {
	return {
		accountUpdates: Boolean(preferences?.accountUpdates ?? DEFAULT_EMAIL_PREFERENCES.accountUpdates),
		devFeatures: Boolean(preferences?.devFeatures ?? DEFAULT_EMAIL_PREFERENCES.devFeatures),
		essential: true
	};
}

function logPreferenceSkip({ userId, emailType, category, reason, context }) {
	logToFile(
		'EMAIL_PREFERENCE',
		{
			status: 'SKIPPED',
			user_id: userId,
			email_type: emailType,
			category,
			reason,
			context
		},
		'info'
	);
}

module.exports = {
	DEFAULT_EMAIL_PREFERENCES,
	EMAIL_CATEGORIES,
	getEmailCategoryForType,
	getUserEmailPreferences,
	updateUserEmailPreferences,
	canSendEmailForUser,
	preferenceSummary,
	logPreferenceSkip
};
