const { logToFile } = require("./logging");

function parseUserIdValue(rawValue) {
	if (rawValue === undefined || rawValue === null || rawValue === "") return { value: null };
	const parsed = Number.parseInt(rawValue, 10);
	if (!Number.isInteger(parsed)) {
		return { error: "userId must be a valid integer." };
	}
	return { value: parsed };
}

function resolveLibraryReadUserId(req) {
	const rawValue = req?.body?.userId ?? req?.query?.userId;
	const { value, error } = parseUserIdValue(rawValue);
	if (error) {
		return {
			error: {
				status: 400,
				message: "Validation Error",
				errors: [error]
			}
		};
	}
	if (!Number.isInteger(value)) {
		return { userId: req.user.id, override: false };
	}
	if (req.user?.role !== "admin") {
		logToFile("LIBRARY_READ_OVERRIDE", {
			status: "DENIED",
			user_id: req.user?.id ?? null,
			target_user_id: value,
			path: req.originalUrl || req.url,
			method: req.method
		}, "warn");
		return {
			error: {
				status: 403,
				message: "Forbidden",
				errors: ["You do not have permission to access another user's library."]
			}
		};
	}
	return { userId: value, override: true };
}

function enforceLibraryWriteScope(req) {
	const rawValue = req?.body?.userId ?? req?.query?.userId;
	const { value, error } = parseUserIdValue(rawValue);
	if (error) {
		return {
			status: 400,
			message: "Validation Error",
			errors: [error]
		};
	}
	if (!Number.isInteger(value)) {
		return null;
	}
	if (value !== req.user?.id) {
		logToFile("LIBRARY_WRITE_OVERRIDE", {
			status: "DENIED",
			user_id: req.user?.id ?? null,
			target_user_id: value,
			path: req.originalUrl || req.url,
			method: req.method
		}, "warn");
		return {
			status: 403,
			message: "Forbidden",
			errors: ["You do not have permission to modify another user's library."]
		};
	}
	return null;
}

module.exports = {
	resolveLibraryReadUserId,
	enforceLibraryWriteScope
};
