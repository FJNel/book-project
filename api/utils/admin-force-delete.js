const { validateEmail } = require("./validators");

function normalizeEmail(value) {
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseConfirmUserId(value) {
	if (value === undefined || value === null) return null;
	const parsed = Number.parseInt(String(value), 10);
	return Number.isInteger(parsed) ? parsed : null;
}

function validateForceDeleteConfirmations({
	targetId,
	confirmUserId,
	confirmEmail,
	confirmText,
	expectedConfirmText = "DELETE"
}) {
	const errors = [];
	const parsedConfirmUserId = parseConfirmUserId(confirmUserId);

	if (!Number.isInteger(parsedConfirmUserId)) {
		errors.push("confirmUserId must be a valid integer.");
	} else if (Number.isInteger(targetId) && parsedConfirmUserId !== targetId) {
		errors.push("confirmUserId does not match the requested user.");
	}

	const emailErrors = validateEmail(confirmEmail);
	if (emailErrors.length > 0) {
		errors.push(...emailErrors);
	}

	const normalizedConfirmText = typeof confirmText === "string" ? confirmText.trim().toUpperCase() : "";
	if (!normalizedConfirmText || normalizedConfirmText !== expectedConfirmText.toUpperCase()) {
		errors.push(`confirmText must match ${expectedConfirmText}.`);
	}

	return {
		errors,
		confirmUserId: parsedConfirmUserId,
		confirmEmail: normalizeEmail(confirmEmail)
	};
}

module.exports = {
	validateForceDeleteConfirmations
};
