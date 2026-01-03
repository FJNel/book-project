// All endpoints should be logged thoroughly with user ID and admin ID, along with action etc.

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const { requiresAuth, requireRole } = require("../utils/jwt");
const { authenticatedLimiter, emailCostLimiter, sensitiveActionLimiter, adminDeletionLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { successResponse, errorResponse } = require("../utils/response");
const { validateFullName, validatePreferredName, validateEmail, validatePassword } = require("../utils/validators");
const { enqueueEmail } = require("../utils/email-queue");
const config = require("../config");
const pool = require("../db");

router.use((req, res, next) => {
	const start = process.hrtime();
	res.on("finish", () => {
		const diff = process.hrtime(start);
		const durationMs = Number((diff[0] * 1e3 + diff[1] / 1e6).toFixed(2));
		logToFile("ADMIN_RESPONSE", {
			admin_id: req.user ? req.user.id : null,
			method: req.method,
			path: req.originalUrl || req.url,
			http_status: res.statusCode,
			duration_ms: durationMs,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");
	});
	next();
});

function logAdminRequest(req, res, next) {
	logToFile("ADMIN_REQUEST", {
		admin_id: req.user ? req.user.id : null,
		method: req.method,
		path: req.originalUrl || req.url,
		ip: req.ip,
		user_agent: req.get("user-agent"),
		query: req.query || {},
		request: req.body || {}
	}, "info");
	next();
}

// Middleware to ensure the user is an authenticated admin
const adminAuth = [requiresAuth, authenticatedLimiter, requireRole(["admin"]), logAdminRequest];

const MAX_LANGUAGE_NAME_LENGTH = 100;
const MAX_LIST_LIMIT = 200;
const MAX_REASON_LENGTH = 500;
const MAX_EMAIL_LENGTH = 255;
const VALID_ROLES = new Set(["user", "admin"]);
const TOKEN_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
let lastTokenCleanupAt = 0;

function normalizeText(value) {
	if (typeof value !== "string") return "";
	return value.trim();
}

function normalizeEmail(value) {
	if (typeof value !== "string") return "";
	return value.trim().toLowerCase();
}

function parseBooleanFlag(value) {
	if (value === undefined || value === null || value === "") return null;
	if (typeof value === "boolean") return value;
	const normalized = String(value).trim().toLowerCase();
	if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
	if (normalized === "false" || normalized === "0" || normalized === "no") return false;
	return null;
}

function parseId(value) {
	if (value === undefined || value === null || value === "") return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) return null;
	return parsed;
}

function parseSortOrder(value) {
	if (!value) return "asc";
	const normalized = String(value).trim().toLowerCase();
	if (normalized === "asc" || normalized === "desc") return normalized;
	return null;
}

function parseOptionalInt(value, fieldLabel, { min = 0, max = null } = {}) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed)) {
		return { error: `${fieldLabel} must be an integer.` };
	}
	if (parsed < min || (max !== null && parsed > max)) {
		const range = max !== null ? `between ${min} and ${max}` : `greater than or equal to ${min}`;
		return { error: `${fieldLabel} must be ${range}.` };
	}
	return { value: parsed };
}

function parseDateFilter(value, fieldLabel) {
	if (value === undefined || value === null || value === "") return { value: null };
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) {
		return { error: `${fieldLabel} must be a valid ISO 8601 date.` };
	}
	return { value: new Date(parsed).toISOString() };
}

function validateRole(role) {
	const errors = [];
	if (!role) {
		return errors;
	}
	if (!VALID_ROLES.has(role)) {
		errors.push("Role must be one of: user, admin.");
	}
	return errors;
}

function validateReason(reason) {
	const errors = [];
	if (!reason || typeof reason !== "string" || !reason.trim()) {
		errors.push("Reason must be provided.");
		return errors;
	}
	if (reason.trim().length > MAX_REASON_LENGTH) {
		errors.push(`Reason must be ${MAX_REASON_LENGTH} characters or fewer.`);
	}
	return errors;
}

function summarizeUserAgent(userAgent) {
	if (!userAgent || typeof userAgent !== "string") {
		return { browser: "Unknown", device: "Unknown", operatingSystem: "Unknown", raw: "" };
	}

	const raw = userAgent;
	const ua = raw.toLowerCase();

	let browser = "Unknown";
	if (/edg\//.test(ua)) {
		browser = "Microsoft Edge";
	} else if (/opr\//.test(ua) || /opera/.test(ua)) {
		browser = "Opera";
	} else if (/chrome/.test(ua) && !/edg|opr/.test(ua)) {
		browser = "Chrome";
	} else if (/safari/.test(ua) && !/chrome|crios|opr|edg/.test(ua)) {
		browser = "Safari";
	} else if (/firefox/.test(ua)) {
		browser = "Firefox";
	} else if (/msie|trident/.test(ua)) {
		browser = "Internet Explorer";
	}

	let operatingSystem = "Unknown";
	if (/windows nt/.test(ua)) {
		operatingSystem = "Windows";
	} else if (/mac os x/.test(ua)) {
		operatingSystem = "macOS";
	} else if (/android/.test(ua)) {
		operatingSystem = "Android";
	} else if (/iphone|ipad|ipod/.test(ua)) {
		operatingSystem = "iOS";
	} else if (/linux/.test(ua)) {
		operatingSystem = "Linux";
	}

	let device = "Desktop";
	if (/ipad|tablet/.test(ua)) {
		device = "Tablet";
	} else if (/mobile|iphone|android/.test(ua)) {
		device = "Mobile";
	}

	return { browser, device, operatingSystem, raw };
}

function generateActionToken() {
	return crypto.randomBytes(32).toString("hex");
}

function addMinutesToNow(minutes) {
	return new Date(Date.now() + minutes * 60 * 1000);
}

function normalizeDurationMinutes(value, defaultMinutes) {
	if (value === undefined || value === null || value === "") return { value: defaultMinutes };
	const parsed = parseId(value);
	if (!Number.isInteger(parsed)) {
		return { error: "duration must be an integer between 1 and 1440 minutes." };
	}
	if (parsed < 1 || parsed > 1440) {
		return { error: "duration must be between 1 and 1440 minutes." };
	}
	return { value: parsed };
}

async function maybeCleanupVerificationTokens(client = pool) {
	const now = Date.now();
	if (now - lastTokenCleanupAt < TOKEN_CLEANUP_INTERVAL_MS) {
		return;
	}
	lastTokenCleanupAt = now;
	try {
		await client.query(`
			DELETE FROM verification_tokens
			WHERE (expires_at < NOW() - INTERVAL '1 day')
			   OR (used = true AND created_at < NOW() - INTERVAL '1 day')
			   OR (created_at < NOW() - INTERVAL '30 days')
		`);
		logToFile("VERIFICATION_TOKEN_CLEANUP", { status: "INFO" }, "info");
	} catch (error) {
		logToFile("VERIFICATION_TOKEN_CLEANUP", { status: "FAILURE", error_message: error.message }, "error");
		lastTokenCleanupAt = now - TOKEN_CLEANUP_INTERVAL_MS + 60 * 1000;
	}
}

async function issueVerificationToken(client, userId, durationMinutes) {
	const token = generateActionToken();
	const expiresAt = addMinutesToNow(durationMinutes);
	await client.query(
		`UPDATE verification_tokens
		 SET used = true
		 WHERE user_id = $1 AND token_type = 'email_verification' AND used = false`,
		[userId]
	);
	await client.query(
		`INSERT INTO verification_tokens (user_id, token, token_type, expires_at, used, created_at)
		 VALUES ($1, $2, 'email_verification', $3, false, NOW())`,
		[userId, token, expiresAt]
	);
	return { token, expiresAt };
}

async function issuePasswordResetToken(client, userId, durationMinutes) {
	const token = generateActionToken();
	const expiresAt = addMinutesToNow(durationMinutes);
	await client.query(
		`UPDATE verification_tokens
		 SET used = true
		 WHERE user_id = $1 AND token_type = 'password_reset' AND used = false`,
		[userId]
	);
	await client.query(
		`INSERT INTO verification_tokens (user_id, token, token_type, expires_at, used, created_at)
		 VALUES ($1, $2, 'password_reset', $3, false, NOW())`,
		[userId, token, expiresAt]
	);
	return { token, expiresAt };
}

async function resolveTargetUserId({ idValue, emailValue }) {
	const id = parseId(idValue);
	const email = normalizeEmail(emailValue);

	if (!id && !email) {
		return {
			error: {
				status: 400,
				message: "Validation Error",
				errors: ["User id or email must be provided."]
			}
		};
	}

	if (email) {
		const emailErrors = validateEmail(email);
		if (emailErrors.length > 0) {
			return {
				error: {
					status: 400,
					message: "Validation Error",
					errors: emailErrors
				}
			};
		}
	}

	if (id && email) {
		const match = await pool.query(
			`SELECT id FROM users WHERE id = $1 AND email = $2`,
			[id, email]
		);
		if (match.rows.length === 0) {
			return {
				error: {
					status: 400,
					message: "Validation Error",
					errors: ["User id and email do not match."]
				}
			};
		}
		return { id, email };
	}

	if (id) {
		return { id, email: null };
	}

	const result = await pool.query(
		`SELECT id FROM users WHERE email = $1`,
		[email]
	);
	if (result.rows.length === 0) {
		return {
			error: {
				status: 404,
				message: "User not found.",
				errors: ["The requested user could not be located."]
			}
		};
	}

	return { id: result.rows[0].id, email };
}

async function ensureEmailMatchesTargetId(targetId, emailValue) {
	const email = normalizeEmail(emailValue);
	if (!email) {
		return null;
	}
	const emailErrors = validateEmail(email);
	if (emailErrors.length > 0) {
		return {
			status: 400,
			message: "Validation Error",
			errors: emailErrors
		};
	}

	const match = await pool.query(
		`SELECT id FROM users WHERE id = $1 AND email = $2`,
		[targetId, email]
	);
	if (match.rows.length === 0) {
		return {
			status: 400,
			message: "Validation Error",
			errors: ["User id and email do not match."]
		};
	}
	return null;
}

async function enforceEmailMatch(res, targetId, emailValue) {
	const matchError = await ensureEmailMatchesTargetId(targetId, emailValue);
	if (matchError) {
		errorResponse(res, matchError.status, matchError.message, matchError.errors);
		return false;
	}
	return true;
}

function formatUserRow(row, { nameOnly = false, includeOauthProviders = false } = {}) {
	if (nameOnly) {
		return {
			id: row.id,
			email: row.email,
			fullName: row.full_name
		};
	}

	const payload = {
		id: row.id,
		email: row.email,
		fullName: row.full_name,
		preferredName: row.preferred_name,
		role: row.role,
		isVerified: row.is_verified,
		isDisabled: row.is_disabled,
		passwordUpdated: row.password_updated,
		lastLogin: row.last_login,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};

	if (includeOauthProviders) {
		payload.oauthProviders = row.oauth_providers || [];
	}

	return payload;
}

async function createDefaultBookTypes(client, userId) {
	await client.query(
		`INSERT INTO book_types (user_id, name, description, created_at, updated_at)
		 VALUES ($1, 'Hardcover', 'A durable hardbound edition with rigid boards and a protective jacket or printed cover. Built to last, it resists wear and warping better than paperbacks and is ideal for collectors, frequent readers, and long-term shelving.', NOW(), NOW()),
		        ($1, 'Softcover', 'A flexible paperback edition with a card cover. Lighter and more portable than hardcover, it''s usually more affordable and easy to handle. Great for everyday reading, travel, and casual collections.', NOW(), NOW())
		 ON CONFLICT (user_id, name) DO NOTHING`,
		[userId]
	);
}

function normalizeLanguageName(value) {
	const trimmed = normalizeText(value);
	return trimmed.toLowerCase();
}

function validateLanguageName(name) {
	const errors = [];
	if (!name) {
		errors.push("Language name must be provided.");
		return errors;
	}
	if (name.length < 2 || name.length > MAX_LANGUAGE_NAME_LENGTH) {
		errors.push(`Language name must be between 2 and ${MAX_LANGUAGE_NAME_LENGTH} characters.`);
	}
	if (!/^[A-Za-z\s\-.'’]+$/.test(name)) {
		errors.push("Language name can only contain letters, spaces, hyphens, and apostrophes.");
	}
	return errors;
}

// `GET /admin/users/` - List all users (admin only, with pagination and filtering) and their appropriate information (from JSON body if provided)
router.get("/users", adminAuth, async (req, res) => {
	const adminId = req.user.id;
	const listParams = { ...req.query, ...(req.body || {}) };
	const nameOnly = parseBooleanFlag(listParams.nameOnly) ?? false;
	const targetId = parseId(listParams.id);
	const rawLookupEmail = listParams.email;
	const lookupEmail = rawLookupEmail ? normalizeEmail(rawLookupEmail) : "";

	if (targetId !== null || lookupEmail) {
		try {
			const resolved = await resolveTargetUserId({ idValue: targetId, emailValue: lookupEmail });
			if (resolved.error) {
				return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
			}
			const resolvedId = resolved.id;

			const result = await pool.query(
				`SELECT u.id, u.email, u.full_name, u.preferred_name, u.role, u.is_verified, u.is_disabled,
				        u.password_updated, u.last_login, u.created_at, u.updated_at,
				        COALESCE((SELECT json_agg(provider) FROM oauth_accounts WHERE user_id = u.id), '[]'::json) AS oauth_providers
				 FROM users u
				 WHERE u.id = $1`,
				[resolvedId]
			);

			const row = result.rows[0];
			logToFile("ADMIN_USERS_GET", {
				status: "SUCCESS",
				admin_id: adminId,
				user_id: row.id,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, "User retrieved successfully.", formatUserRow(row, {
				nameOnly,
				includeOauthProviders: !nameOnly
			}));
		} catch (error) {
			logToFile("ADMIN_USERS_GET", {
				status: "FAILURE",
				error_message: error.message,
				admin_id: adminId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the user."]);
		}
	}

	const errors = [];
	const sortFields = {
		id: "u.id",
		email: "u.email",
		fullName: "u.full_name",
		preferredName: "u.preferred_name",
		role: "u.role",
		isVerified: "u.is_verified",
		isDisabled: "u.is_disabled",
		lastLogin: "u.last_login",
		passwordUpdated: "u.password_updated",
		createdAt: "u.created_at",
		updatedAt: "u.updated_at"
	};
	const sortBy = normalizeText(listParams.sortBy) || "email";
	const sortColumn = sortFields[sortBy];
	if (!sortColumn) {
		errors.push("sortBy must be one of: id, email, fullName, preferredName, role, isVerified, isDisabled, lastLogin, passwordUpdated, createdAt, updatedAt.");
	}

	const order = parseSortOrder(listParams.order);
	if (!order) {
		errors.push("order must be either asc or desc.");
	}

	const { value: limit, error: limitError } = parseOptionalInt(listParams.limit, "limit", { min: 1, max: MAX_LIST_LIMIT });
	if (limitError) errors.push(limitError);
	const { value: offset, error: offsetError } = parseOptionalInt(listParams.offset, "offset", { min: 0 });
	if (offsetError) errors.push(offsetError);

	const filters = [];
	const values = [];
	let paramIndex = 1;

	if (listParams.filterId !== undefined) {
		const filterId = parseId(listParams.filterId);
		if (!Number.isInteger(filterId)) {
			errors.push("filterId must be a valid integer.");
		} else {
			filters.push(`u.id = $${paramIndex++}`);
			values.push(filterId);
		}
	}

	const filterEmail = normalizeText(listParams.filterEmail);
	if (filterEmail) {
		if (filterEmail.length > MAX_EMAIL_LENGTH) {
			errors.push(`filterEmail must be ${MAX_EMAIL_LENGTH} characters or fewer.`);
		} else {
			filters.push(`u.email ILIKE $${paramIndex++}`);
			values.push(`%${filterEmail}%`);
		}
	}

	const filterFullName = normalizeText(listParams.filterFullName);
	if (filterFullName) {
		filters.push(`u.full_name ILIKE $${paramIndex++}`);
		values.push(`%${filterFullName}%`);
	}

	const filterPreferredName = normalizeText(listParams.filterPreferredName);
	if (filterPreferredName) {
		filters.push(`u.preferred_name ILIKE $${paramIndex++}`);
		values.push(`%${filterPreferredName}%`);
	}

	if (listParams.filterRole !== undefined && listParams.filterRole !== null && listParams.filterRole !== "") {
		const roleValue = normalizeText(listParams.filterRole);
		if (!VALID_ROLES.has(roleValue)) {
			errors.push("filterRole must be one of: user, admin.");
		} else {
			filters.push(`u.role = $${paramIndex++}`);
			values.push(roleValue);
		}
	}

	if (listParams.filterIsVerified !== undefined) {
		const parsed = parseBooleanFlag(listParams.filterIsVerified);
		if (parsed === null) {
			errors.push("filterIsVerified must be a boolean.");
		} else {
			filters.push(`u.is_verified = $${paramIndex++}`);
			values.push(parsed);
		}
	}

	if (listParams.filterIsDisabled !== undefined) {
		const parsed = parseBooleanFlag(listParams.filterIsDisabled);
		if (parsed === null) {
			errors.push("filterIsDisabled must be a boolean.");
		} else {
			filters.push(`u.is_disabled = $${paramIndex++}`);
			values.push(parsed);
		}
	}

	const dateFilters = [
		{ key: "filterCreatedAt", column: "u.created_at", op: "=" },
		{ key: "filterUpdatedAt", column: "u.updated_at", op: "=" },
		{ key: "filterCreatedAfter", column: "u.created_at", op: ">=" },
		{ key: "filterCreatedBefore", column: "u.created_at", op: "<=" },
		{ key: "filterUpdatedAfter", column: "u.updated_at", op: ">=" },
		{ key: "filterUpdatedBefore", column: "u.updated_at", op: "<=" },
		{ key: "filterLastLogin", column: "u.last_login", op: "=" },
		{ key: "filterLastLoginAfter", column: "u.last_login", op: ">=" },
		{ key: "filterLastLoginBefore", column: "u.last_login", op: "<=" },
		{ key: "filterPasswordUpdated", column: "u.password_updated", op: "=" },
		{ key: "filterPasswordUpdatedAfter", column: "u.password_updated", op: ">=" },
		{ key: "filterPasswordUpdatedBefore", column: "u.password_updated", op: "<=" }
	];

	for (const filter of dateFilters) {
		const { value, error } = parseDateFilter(listParams[filter.key], filter.key);
		if (error) {
			errors.push(error);
		} else if (value) {
			filters.push(`${filter.column} ${filter.op} $${paramIndex++}`);
			values.push(value);
		}
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	const fields = nameOnly
		? "u.id, u.email, u.full_name"
		: "u.id, u.email, u.full_name, u.preferred_name, u.role, u.is_verified, u.is_disabled, u.password_updated, u.last_login, u.created_at, u.updated_at";

	try {
		let query = `SELECT ${fields} FROM users u`;
		if (filters.length > 0) {
			query += ` WHERE ${filters.join(" AND ")}`;
		}
		query += ` ORDER BY ${sortColumn} ${order.toUpperCase()}`;
		if (limit !== null) {
			query += ` LIMIT $${paramIndex++}`;
			values.push(limit);
		}
		if (offset !== null) {
			query += ` OFFSET $${paramIndex++}`;
			values.push(offset);
		}

		const result = await pool.query(query, values);

		logToFile("ADMIN_USERS_LIST", {
			status: "SUCCESS",
			admin_id: adminId,
			count: result.rows.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		const payload = result.rows.map((row) => formatUserRow(row, { nameOnly }));
		return successResponse(res, 200, "Users retrieved successfully.", { users: payload });
	} catch (error) {
		logToFile("ADMIN_USERS_LIST", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving users."]);
	}
});

// `POST /admin/users/` - Create a new user (admin only)
router.post("/users", adminAuth, async (req, res) => {
	const adminId = req.user.id;
	let { fullName, preferredName, email, password, role, noPassword, duration } = req.body || {};
	fullName = typeof fullName === "string" ? fullName.trim() : "";
	preferredName = typeof preferredName === "string" ? preferredName.trim() : null;
	email = normalizeEmail(email);
	password = typeof password === "string" ? password.trim() : "";
	role = typeof role === "string" ? role.trim() : "user";
	noPassword = parseBooleanFlag(noPassword) ?? false;

	const errors = [];
	errors.push(
		...validateFullName(fullName),
		...validatePreferredName(preferredName),
		...validateEmail(email),
		...validateRole(role)
	);

	const durationResult = normalizeDurationMinutes(duration, 60);
	if (durationResult.error) {
		errors.push(durationResult.error);
	}

	if (noPassword) {
		if (password) {
			errors.push("Password must not be provided when noPassword is true.");
		}
	} else {
		errors.push(...validatePassword(password));
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "User already exists.", ["A user with this email address already exists."]);
		}
	} catch (error) {
		logToFile("ADMIN_USER_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while checking for duplicate users."]);
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		const passwordHash = noPassword ? null : await bcrypt.hash(password, config.saltRounds);
		const passwordUpdated = noPassword ? null : new Date();
		const insertUser = await client.query(
			`INSERT INTO users (full_name, preferred_name, email, password_hash, role, is_verified, is_disabled, password_updated)
			 VALUES ($1, $2, $3, $4, $5, false, false, $6)
			 RETURNING id, email, full_name, preferred_name, role, is_verified, is_disabled, password_updated, last_login, created_at, updated_at`,
			[fullName, preferredName, email, passwordHash, role, passwordUpdated]
		);
		const newUser = insertUser.rows[0];

		await createDefaultBookTypes(client, newUser.id);

		const { token, expiresAt } = await issueVerificationToken(client, newUser.id, durationResult.value);
		let passwordResetPayload = null;
		if (noPassword) {
			const resetToken = await issuePasswordResetToken(client, newUser.id, durationResult.value);
			passwordResetPayload = {
				token: resetToken.token,
				expiresAt: resetToken.expiresAt
			};
		}

		await client.query("COMMIT");
		await maybeCleanupVerificationTokens();

		const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
		if (noPassword && passwordResetPayload) {
			const resetExpiresIn = Math.max(1, Math.round((new Date(passwordResetPayload.expiresAt) - Date.now()) / 60000));
			enqueueEmail({
				type: "admin_account_setup",
				params: {
					toEmail: email,
					preferredName: newUser.preferred_name,
					verificationToken: token,
					resetToken: passwordResetPayload.token,
					verificationExpiresIn: expiresIn,
					resetExpiresIn
				},
				context: "ADMIN_CREATE_USER_NO_PASSWORD",
				userId: newUser.id
			});
		} else {
			enqueueEmail({
				type: "verification",
				params: { toEmail: email, token, preferredName: newUser.preferred_name, expiresIn },
				context: "ADMIN_CREATE_USER",
				userId: newUser.id
			});
		}

		logToFile("ADMIN_USER_CREATE", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: newUser.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 201, "User created successfully.", formatUserRow(newUser));
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("ADMIN_USER_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the user."]);
	} finally {
		client.release();
	}
});

// `GET /admin/users/:id` - Get a specific user profile by ID (admin only)
// `GET /admin/users` with JSON body containing { id: userId } is also supported
router.get("/users/:id", adminAuth, async (req, res) => {
	const adminId = req.user.id;
	const pathId = parseId(req.params.id);
	if (!Number.isInteger(pathId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== pathId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, pathId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	const nameOnly = parseBooleanFlag(req.query.nameOnly ?? req.body?.nameOnly) ?? false;

	try {
		const result = await pool.query(
			`SELECT u.id, u.email, u.full_name, u.preferred_name, u.role, u.is_verified, u.is_disabled,
			        u.password_updated, u.last_login, u.created_at, u.updated_at,
			        COALESCE((SELECT json_agg(provider) FROM oauth_accounts WHERE user_id = u.id), '[]'::json) AS oauth_providers
			 FROM users u
			 WHERE u.id = $1`,
			[pathId]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const row = result.rows[0];
		logToFile("ADMIN_USERS_GET", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "User retrieved successfully.", formatUserRow(row, {
			nameOnly,
			includeOauthProviders: !nameOnly
		}));
	} catch (error) {
		logToFile("ADMIN_USERS_GET", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while retrieving the user."]);
	}
});

async function handleUserUpdate(req, res, targetId) {
	const adminId = req.user.id;
	const body = req.body || {};
	let { fullName, preferredName, email, role } = body;

	const errors = [];
	const hasFullName = fullName !== undefined;
	const hasPreferredName = preferredName !== undefined;
	const hasEmail = email !== undefined;
	const hasRole = role !== undefined;
	const hasDuration = body.duration !== undefined;
	let verificationDuration = 1440;

	if (!hasFullName && !hasPreferredName && !hasEmail && !hasRole) {
		return errorResponse(res, 400, "Validation Error", ["At least one field must be provided for update."]);
	}

	const normalizedEmail = hasEmail ? normalizeEmail(email) : null;
	if (hasFullName) {
		fullName = typeof fullName === "string" ? fullName.trim() : "";
		errors.push(...validateFullName(fullName));
	}

	if (hasPreferredName) {
		if (preferredName === null || preferredName === "") {
			preferredName = null;
		} else if (typeof preferredName === "string") {
			preferredName = preferredName.trim();
		}
		errors.push(...validatePreferredName(preferredName));
	}

	if (hasEmail) {
		errors.push(...validateEmail(normalizedEmail));
	}

	if (hasRole) {
		role = typeof role === "string" ? role.trim() : "";
		errors.push(...validateRole(role));
	}

	if (hasDuration) {
		const durationResult = normalizeDurationMinutes(body.duration, 1440);
		if (durationResult.error) {
			errors.push(durationResult.error);
		} else {
			verificationDuration = durationResult.value;
		}
	}

	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existingRes = await pool.query(
			`SELECT id, email, full_name, preferred_name, role, is_verified, is_disabled
			 FROM users WHERE id = $1`,
			[targetId]
		);
		if (existingRes.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const existingUser = existingRes.rows[0];
		if (hasRole && targetId === adminId && role !== existingUser.role) {
			return errorResponse(res, 403, "Forbidden", ["Admins cannot change their own role."]);
		}

		const emailChanged = hasEmail && normalizedEmail !== existingUser.email;
		if (emailChanged) {
			const duplicate = await pool.query(
				"SELECT 1 FROM users WHERE email = $1 AND id <> $2",
				[normalizedEmail, targetId]
			);
			if (duplicate.rows.length > 0) {
				return errorResponse(res, 409, "Email already in use.", ["Another user already uses this email address."]);
			}
		}

		const updates = [];
		const values = [];
		let paramIndex = 1;
		const changeSummary = [];

		if (hasFullName && fullName !== existingUser.full_name) {
			updates.push(`full_name = $${paramIndex++}`);
			values.push(fullName);
			changeSummary.push(`Full name updated.`);
		}
		if (hasPreferredName) {
			const preferredValue = preferredName || null;
			if (preferredValue !== existingUser.preferred_name) {
				updates.push(`preferred_name = $${paramIndex++}`);
				values.push(preferredValue);
				changeSummary.push("Preferred name updated.");
			}
		}
		if (hasEmail && normalizedEmail !== existingUser.email) {
			updates.push(`email = $${paramIndex++}`);
			values.push(normalizedEmail);
			updates.push(`is_verified = false`);
			changeSummary.push("Email address updated.");
		}
		if (hasRole && role !== existingUser.role) {
			updates.push(`role = $${paramIndex++}`);
			values.push(role);
			changeSummary.push("Role updated.");
		}

		if (updates.length === 0) {
			return successResponse(res, 200, "No changes were applied.", formatUserRow(existingUser));
		}

		values.push(targetId);
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const updateQuery = `
				UPDATE users
				SET ${updates.join(", ")}
				WHERE id = $${paramIndex}
				RETURNING id, email, full_name, preferred_name, role, is_verified, is_disabled, password_updated, last_login, created_at, updated_at
			`;
			const updateRes = await client.query(updateQuery, values);
			const updatedUser = updateRes.rows[0];

			let verificationPayload = null;
			if (emailChanged) {
				const { token, expiresAt } = await issueVerificationToken(client, targetId, verificationDuration);
				verificationPayload = { token, expiresAt };
			}

			await client.query("COMMIT");
			await maybeCleanupVerificationTokens();

			if (emailChanged && verificationPayload) {
				const expiresIn = Math.max(1, Math.round((new Date(verificationPayload.expiresAt) - Date.now()) / 60000));
				enqueueEmail({
					type: "verification",
					params: {
						toEmail: updatedUser.email,
						token: verificationPayload.token,
						preferredName: updatedUser.preferred_name,
						expiresIn
					},
					context: "ADMIN_UPDATE_EMAIL",
					userId: updatedUser.id
				});
			}

			if (changeSummary.length > 0) {
				enqueueEmail({
					type: "admin_profile_update",
					params: {
						toEmail: updatedUser.email,
						preferredName: updatedUser.preferred_name,
						changes: changeSummary
					},
					context: "ADMIN_UPDATE_USER",
					userId: updatedUser.id
				});
			}

			logToFile("ADMIN_USER_UPDATE", {
				status: "SUCCESS",
				admin_id: adminId,
				user_id: updatedUser.id,
				changes: changeSummary,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, "User updated successfully.", formatUserRow(updatedUser));
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("ADMIN_USER_UPDATE", {
				status: "FAILURE",
				error_message: error.message,
				admin_id: adminId,
				user_id: targetId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while updating the user."]);
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("ADMIN_USER_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the user."]);
	}
}

// `PUT /admin/users/:id` - Update a specific user’s profile by ID (including role and email, admin only)
router.put("/users/:id", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	return handleUserUpdate(req, res, targetId);
});

// `PUT /admin/users` with JSON body containing { id: userId, ...updates } is also supported
router.put("/users", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleUserUpdate(req, res, resolved.id);
});

async function handleDisableUser(req, res, targetId) {
	const adminId = req.user.id;
	try {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const userRes = await client.query(
				`SELECT id, email, preferred_name, is_disabled
				 FROM users WHERE id = $1`,
				[targetId]
			);
			if (userRes.rows.length === 0) {
				await client.query("ROLLBACK");
				return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
			}

			const user = userRes.rows[0];
			if (!user.is_disabled) {
				await client.query(
					`UPDATE users SET is_disabled = true WHERE id = $1`,
					[targetId]
				);
			}

			const sessionResult = await client.query(
				`UPDATE refresh_tokens
				 SET revoked = true
				 WHERE user_id = $1 AND revoked = false
				 RETURNING token_fingerprint`,
				[targetId]
			);

			await client.query("COMMIT");

			enqueueEmail({
				type: "admin_account_disabled",
				params: {
					toEmail: user.email,
					preferredName: user.preferred_name
				},
				context: "ADMIN_DISABLE_USER",
				userId: user.id
			});

			logToFile("ADMIN_USER_DISABLE", {
				status: "SUCCESS",
				admin_id: adminId,
				user_id: user.id,
				disabled: !user.is_disabled,
				revoked_sessions: sessionResult.rows.length,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "info");

			return successResponse(res, 200, user.is_disabled ? "User already disabled." : "User disabled successfully.", {
				id: user.id,
				wasDisabled: !user.is_disabled,
				revokedSessions: sessionResult.rows.length
			});
		} catch (error) {
			await client.query("ROLLBACK");
			logToFile("ADMIN_USER_DISABLE", {
				status: "FAILURE",
				error_message: error.message,
				admin_id: adminId,
				user_id: targetId,
				ip: req.ip,
				user_agent: req.get("user-agent")
			}, "error");
			return errorResponse(res, 500, "Database Error", ["An error occurred while disabling the user."]);
		} finally {
			client.release();
		}
	} catch (error) {
		logToFile("ADMIN_USER_DISABLE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while disabling the user."]);
	}
}

// `DELETE /admin/users/:id` - Disable a user profile by ID (admin only)
router.delete("/users/:id", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleDisableUser(req, res, targetId);
});

// `DELETE /admin/users` with JSON body containing { id: userId } is also supported
router.delete("/users", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleDisableUser(req, res, resolved.id);
});

async function handleEnableUser(req, res, targetId) {
	const adminId = req.user.id;
	try {
		const result = await pool.query(
			`UPDATE users
			 SET is_disabled = false
			 WHERE id = $1
			 RETURNING id, email, preferred_name, is_disabled`,
			[targetId]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = result.rows[0];
		enqueueEmail({
			type: "admin_account_enabled",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name
			},
			context: "ADMIN_ENABLE_USER",
			userId: user.id
		});

		logToFile("ADMIN_USER_ENABLE", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "User enabled successfully.", { id: user.id });
	} catch (error) {
		logToFile("ADMIN_USER_ENABLE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while enabling the user."]);
	}
}

// `POST /admin/users/:id/enable` - Re-enable a disabled user profile by ID (admin only)
router.post("/users/:id/enable", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleEnableUser(req, res, targetId);
});

// `POST /admin/users/enable` with JSON body containing { id: userId } is also supported
router.post("/users/enable", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleEnableUser(req, res, resolved.id);
});

async function handleUnverifyUser(req, res, targetId) {
	const adminId = req.user.id;
	const reasonErrors = validateReason(req.body?.reason);
	if (reasonErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", reasonErrors);
	}
	const reason = req.body.reason.trim();

	try {
		const result = await pool.query(
			`UPDATE users
			 SET is_verified = false
			 WHERE id = $1
			 RETURNING id, email, preferred_name`,
			[targetId]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = result.rows[0];
		enqueueEmail({
			type: "admin_email_unverified",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				reason
			},
			context: "ADMIN_UNVERIFY",
			userId: user.id
		});

		logToFile("ADMIN_USER_UNVERIFY", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			reason,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "User marked as unverified.", { id: user.id });
	} catch (error) {
		logToFile("ADMIN_USER_UNVERIFY", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while unverifying the user."]);
	}
}

// `POST /admin/users/:id/unverify` - Mark a user’s email as unverified by ID (admin only)
router.post("/users/:id/unverify", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleUnverifyUser(req, res, targetId);
});

// `POST /admin/users/unverify` with JSON body containing { id: userId } is also supported
router.post("/users/unverify", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleUnverifyUser(req, res, resolved.id);
});

async function handleVerifyUser(req, res, targetId) {
	const adminId = req.user.id;
	const reasonErrors = validateReason(req.body?.reason);
	if (reasonErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", reasonErrors);
	}
	const reason = req.body.reason.trim();

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const result = await client.query(
			`UPDATE users
			 SET is_verified = true
			 WHERE id = $1
			 RETURNING id, email, preferred_name`,
			[targetId]
		);

		if (result.rows.length === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		await client.query(
			`UPDATE verification_tokens
			 SET used = true
			 WHERE user_id = $1 AND token_type = 'email_verification' AND used = false`,
			[targetId]
		);

		await client.query("COMMIT");
		await maybeCleanupVerificationTokens(client);

		const user = result.rows[0];
		enqueueEmail({
			type: "admin_email_verified",
			params: {
				toEmail: user.email,
				preferredName: user.preferred_name,
				reason
			},
			context: "ADMIN_VERIFY",
			userId: user.id
		});

		logToFile("ADMIN_USER_VERIFY", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			reason,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "User marked as verified.", { id: user.id });
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("ADMIN_USER_VERIFY", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while verifying the user."]);
	} finally {
		client.release();
	}
}

// `POST /admin/users/:id/verify` - Mark a user’s email as verified by ID (admin only)
router.post("/users/:id/verify", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleVerifyUser(req, res, targetId);
});

// `POST /admin/users/verify` with JSON body containing { id: userId } is also supported
router.post("/users/verify", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleVerifyUser(req, res, resolved.id);
});

async function handleSendVerification(req, res, targetId) {
	const adminId = req.user.id;
	const { value: durationMinutes, error: durationError } = normalizeDurationMinutes(req.body?.duration, 30);
	if (durationError) {
		return errorResponse(res, 400, "Validation Error", [durationError]);
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const userRes = await client.query(
			`SELECT id, email, preferred_name, is_verified
			 FROM users WHERE id = $1`,
			[targetId]
		);

		if (userRes.rows.length === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = userRes.rows[0];
		if (user.is_verified) {
			await client.query("ROLLBACK");
			return errorResponse(res, 400, "Already verified.", ["This user is already verified."]);
		}

		const { token, expiresAt } = await issueVerificationToken(client, targetId, durationMinutes);
		await client.query("COMMIT");
		await maybeCleanupVerificationTokens(client);

		const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
		enqueueEmail({
			type: "verification",
			params: { toEmail: user.email, token, preferredName: user.preferred_name, expiresIn },
			context: "ADMIN_SEND_VERIFICATION",
			userId: user.id
		});

		logToFile("ADMIN_SEND_VERIFICATION", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			duration_minutes: durationMinutes,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Verification email sent successfully.", {
			id: user.id,
			expiresInMinutes: durationMinutes
		});
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("ADMIN_SEND_VERIFICATION", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while sending verification email."]);
	} finally {
		client.release();
	}
}

// `POST /admin/users/:id/send-verification` - Resend email verification email for a user (admin only)
router.post("/users/:id/send-verification", [...adminAuth, emailCostLimiter], async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleSendVerification(req, res, targetId);
});

// `POST /admin/users/send-verification` with JSON body containing { id: userId } is also supported
router.post("/users/send-verification", [...adminAuth, emailCostLimiter], async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleSendVerification(req, res, resolved.id);
});

async function handleResetPassword(req, res, targetId) {
	const adminId = req.user.id;
	const { value: durationMinutes, error: durationError } = normalizeDurationMinutes(req.body?.duration, 30);
	if (durationError) {
		return errorResponse(res, 400, "Validation Error", [durationError]);
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const userRes = await client.query(
			`SELECT id, email, preferred_name
			 FROM users WHERE id = $1`,
			[targetId]
		);
		if (userRes.rows.length === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = userRes.rows[0];
		const { token, expiresAt } = await issuePasswordResetToken(client, targetId, durationMinutes);
		await client.query("COMMIT");
		await maybeCleanupVerificationTokens(client);

		const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
		enqueueEmail({
			type: "password_reset",
			params: { toEmail: user.email, token, preferredName: user.preferred_name, expiresIn },
			context: "ADMIN_PASSWORD_RESET",
			userId: user.id
		});

		logToFile("ADMIN_PASSWORD_RESET", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: user.id,
			duration_minutes: durationMinutes,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Password reset email sent successfully.", {
			id: user.id,
			expiresInMinutes: durationMinutes
		});
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("ADMIN_PASSWORD_RESET", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while sending password reset email."]);
	} finally {
		client.release();
	}
}

async function handleListSessions(req, res, targetId) {
	const adminId = req.user.id;

	try {
		const userRes = await pool.query("SELECT id FROM users WHERE id = $1", [targetId]);
		if (userRes.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const { rows } = await pool.query(
			`SELECT token_fingerprint, issued_at, expires_at, ip_address::TEXT AS ip_address, user_agent
			 FROM refresh_tokens
			 WHERE user_id = $1
				 AND revoked = false
				 AND expires_at > NOW()
			 ORDER BY expires_at DESC`,
			[targetId]
		);

		const sessions = rows.map((session) => {
			const summary = summarizeUserAgent(session.user_agent);
			const expiresAt = session.expires_at;
			const millisecondsRemaining = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0;
			return {
				fingerprint: session.token_fingerprint,
				issuedAt: session.issued_at,
				expiresAt,
				expiresInSeconds: Math.floor(millisecondsRemaining / 1000),
				ipAddress: session.ip_address || null,
				locationHint: session.ip_address ? `IP ${session.ip_address}` : "Unknown",
				browser: summary.browser,
				device: summary.device,
				operatingSystem: summary.operatingSystem,
				rawUserAgent: summary.raw
			};
		});

		logToFile("ADMIN_LIST_SESSIONS", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: targetId,
			session_count: sessions.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Active sessions retrieved.", { sessions });
	} catch (error) {
		logToFile("ADMIN_LIST_SESSIONS", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["Unable to retrieve sessions at this time."]);
	}
}

// `POST /admin/users/:id/reset-password` - Trigger a password reset for a user by ID (admin only)
router.post("/users/:id/reset-password", [...adminAuth, emailCostLimiter], async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleResetPassword(req, res, targetId);
});

// `POST /admin/users/reset-password` with JSON body containing { id: userId } is also supported
router.post("/users/reset-password", [...adminAuth, emailCostLimiter], async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleResetPassword(req, res, resolved.id);
});

// POST /admin/users/:id/sessions - List all active sessions for a user (admin only)
router.post("/users/:id/sessions", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleListSessions(req, res, targetId);
});

// POST /admin/users/sessions with JSON body containing { id: userId } is also supported
router.post("/users/sessions", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleListSessions(req, res, resolved.id);
});

async function handleForceLogout(req, res, targetId) {
	const adminId = req.user.id;
	let fingerprints = [];
	const fingerprintValue = req.body?.fingerprint;
	if (Array.isArray(fingerprintValue)) {
		fingerprints = fingerprintValue.map((fp) => (typeof fp === "string" ? fp.trim() : "")).filter(Boolean);
	} else if (typeof fingerprintValue === "string") {
		fingerprints = [fingerprintValue.trim()];
	}

	try {
		const userRes = await pool.query("SELECT id FROM users WHERE id = $1", [targetId]);
		if (userRes.rows.length === 0) {
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		let revokedRows = [];
		if (fingerprints.length > 0) {
			const result = await pool.query(
				`UPDATE refresh_tokens
				 SET revoked = true
				 WHERE user_id = $1
					AND token_fingerprint = ANY($2)
					AND revoked = false
				 RETURNING token_fingerprint`,
				[targetId, fingerprints]
			);
			revokedRows = result.rows;
		} else {
			const result = await pool.query(
				`UPDATE refresh_tokens
				 SET revoked = true
				 WHERE user_id = $1 AND revoked = false
				 RETURNING token_fingerprint`,
				[targetId]
			);
			revokedRows = result.rows;
		}

		logToFile("ADMIN_FORCE_LOGOUT", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: targetId,
			revoked_count: revokedRows.length,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Sessions revoked successfully.", {
			id: targetId,
			revokedCount: revokedRows.length,
			fingerprints: revokedRows.map((row) => row.token_fingerprint)
		});
	} catch (error) {
		logToFile("ADMIN_FORCE_LOGOUT", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Internal Server Error", ["Unable to revoke the requested sessions."]);
	}
}

async function handleAccountDeletion(req, res, targetId) {
	const adminId = req.user.id;
	if (targetId === adminId) {
		return errorResponse(res, 403, "Forbidden", ["Admins cannot delete their own account."]);
	}

	const confirmFlag = parseBooleanFlag(req.body?.confirm);
	if (confirmFlag !== true) {
		return errorResponse(res, 400, "Validation Error", ["You must confirm this action before proceeding."]);
	}
	const reasonErrors = validateReason(req.body?.reason);
	if (reasonErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", reasonErrors);
	}
	const reason = req.body.reason.trim();
	const confirmationEmail = normalizeEmail(req.body?.userToBeDeletedEmail);
	if (!confirmationEmail) {
		return errorResponse(res, 400, "Validation Error", ["userToBeDeletedEmail must be provided."]);
	}
	const emailErrors = validateEmail(confirmationEmail);
	if (emailErrors.length > 0) {
		return errorResponse(res, 400, "Validation Error", emailErrors);
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const userRes = await client.query(
			`SELECT id, email, metadata
			 FROM users WHERE id = $1`,
			[targetId]
		);
		if (userRes.rows.length === 0) {
			await client.query("ROLLBACK");
			return errorResponse(res, 404, "User not found.", ["The requested user could not be located."]);
		}

		const user = userRes.rows[0];
		if (normalizeEmail(user.email) !== confirmationEmail) {
			await client.query("ROLLBACK");
			return errorResponse(res, 400, "Validation Error", ["userToBeDeletedEmail does not match the user's email."]);
		}

		const metadata = user.metadata && typeof user.metadata === "object" ? user.metadata : {};
		const deletionConfirmation = metadata.accountDeletionConfirmed;
		if (!deletionConfirmation || !deletionConfirmation.confirmedAt) {
			await client.query("ROLLBACK");
			return errorResponse(res, 409, "Deletion not confirmed.", ["The user has not completed the account deletion confirmation flow."]);
		}

		const tableCounts = {};
		const countQueries = [
			{ name: "verification_tokens", sql: "SELECT COUNT(*)::int AS count FROM verification_tokens WHERE user_id = $1" },
			{ name: "refresh_tokens", sql: "SELECT COUNT(*)::int AS count FROM refresh_tokens WHERE user_id = $1" },
			{ name: "oauth_accounts", sql: "SELECT COUNT(*)::int AS count FROM oauth_accounts WHERE user_id = $1" },
			{ name: "book_types", sql: "SELECT COUNT(*)::int AS count FROM book_types WHERE user_id = $1" },
			{ name: "authors", sql: "SELECT COUNT(*)::int AS count FROM authors WHERE user_id = $1" },
			{ name: "publishers", sql: "SELECT COUNT(*)::int AS count FROM publishers WHERE user_id = $1" },
			{ name: "book_authors", sql: "SELECT COUNT(*)::int AS count FROM book_authors WHERE user_id = $1" },
			{ name: "book_series", sql: "SELECT COUNT(*)::int AS count FROM book_series WHERE user_id = $1" },
			{ name: "book_series_books", sql: "SELECT COUNT(*)::int AS count FROM book_series_books WHERE user_id = $1" },
			{ name: "storage_locations", sql: "SELECT COUNT(*)::int AS count FROM storage_locations WHERE user_id = $1" },
			{ name: "books", sql: "SELECT COUNT(*)::int AS count FROM books WHERE user_id = $1" },
			{ name: "book_copies", sql: "SELECT COUNT(*)::int AS count FROM book_copies WHERE user_id = $1" },
			{ name: "book_languages", sql: "SELECT COUNT(*)::int AS count FROM book_languages WHERE user_id = $1" },
			{ name: "tags", sql: "SELECT COUNT(*)::int AS count FROM tags WHERE user_id = $1" },
			{ name: "book_tags", sql: "SELECT COUNT(*)::int AS count FROM book_tags WHERE user_id = $1" }
		];

		for (const query of countQueries) {
			const countRes = await client.query(query.sql, [targetId]);
			tableCounts[query.name] = countRes.rows[0]?.count ?? 0;
		}

		const dateIds = new Set();
		const authorDates = await client.query(
			`SELECT birth_date_id, death_date_id FROM authors WHERE user_id = $1`,
			[targetId]
		);
		for (const row of authorDates.rows) {
			if (row.birth_date_id) dateIds.add(row.birth_date_id);
			if (row.death_date_id) dateIds.add(row.death_date_id);
		}

		const publisherDates = await client.query(
			`SELECT founded_date_id FROM publishers WHERE user_id = $1`,
			[targetId]
		);
		for (const row of publisherDates.rows) {
			if (row.founded_date_id) dateIds.add(row.founded_date_id);
		}

		const bookDates = await client.query(
			`SELECT publication_date_id FROM books WHERE user_id = $1`,
			[targetId]
		);
		for (const row of bookDates.rows) {
			if (row.publication_date_id) dateIds.add(row.publication_date_id);
		}

		const copyDates = await client.query(
			`SELECT acquisition_date_id FROM book_copies WHERE user_id = $1`,
			[targetId]
		);
		for (const row of copyDates.rows) {
			if (row.acquisition_date_id) dateIds.add(row.acquisition_date_id);
		}

		await client.query(`DELETE FROM users WHERE id = $1`, [targetId]);

		if (dateIds.size > 0) {
			const ids = Array.from(dateIds);
			await client.query(
				`DELETE FROM dates d
				 WHERE d.id = ANY($1)
				   AND NOT EXISTS (SELECT 1 FROM authors a WHERE a.birth_date_id = d.id OR a.death_date_id = d.id)
				   AND NOT EXISTS (SELECT 1 FROM publishers p WHERE p.founded_date_id = d.id)
				   AND NOT EXISTS (SELECT 1 FROM books b WHERE b.publication_date_id = d.id)
				   AND NOT EXISTS (SELECT 1 FROM book_copies bc WHERE bc.acquisition_date_id = d.id)`,
				[ids]
			);
		}

		await client.query("COMMIT");

		logToFile("ADMIN_ACCOUNT_DELETE", {
			status: "SUCCESS",
			admin_id: adminId,
			user_id: targetId,
			reason,
			deleted_counts: tableCounts,
			date_cleanup_count: dateIds.size,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "User account deleted permanently.", {
			id: targetId,
			deletedCounts: tableCounts,
			datesCleaned: dateIds.size
		});
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("ADMIN_ACCOUNT_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			admin_id: adminId,
			user_id: targetId,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the user."]);
	} finally {
		client.release();
	}
}

// `POST /admin/users/:id/force-logout` - Force logout a user (invalidate all sessions, admin only)
router.post("/users/:id/force-logout", adminAuth, async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleForceLogout(req, res, targetId);
});

// `POST /admin/users/force-logout` with JSON body containing { id: userId } is also supported
router.post("/users/force-logout", adminAuth, async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleForceLogout(req, res, resolved.id);
});

// `POST /admin/users/:id/handle-account-deletion` - Permanently delete a user and all associated data after review (admin only)
router.post("/users/:id/handle-account-deletion", [...adminAuth, sensitiveActionLimiter, adminDeletionLimiter], async (req, res) => {
	const targetId = parseId(req.params.id);
	if (!Number.isInteger(targetId)) {
		return errorResponse(res, 400, "Validation Error", ["User id must be a valid integer."]);
	}
	const bodyId = parseId(req.body?.id);
	if (Number.isInteger(bodyId) && bodyId !== targetId) {
		return errorResponse(res, 400, "Validation Error", ["User id in body does not match the URL path."]);
	}
	const emailMatchOk = await enforceEmailMatch(res, targetId, req.body?.email);
	if (!emailMatchOk) {
		return;
	}
	return handleAccountDeletion(req, res, targetId);
});

// `POST /admin/users/handle-account-deletion` with JSON body containing { id: userId } is also supported
router.post("/users/handle-account-deletion", [...adminAuth, sensitiveActionLimiter, adminDeletionLimiter], async (req, res) => {
	const resolved = await resolveTargetUserId({ idValue: req.body?.id, emailValue: req.body?.email });
	if (resolved.error) {
		return errorResponse(res, resolved.error.status, resolved.error.message, resolved.error.errors);
	}
	return handleAccountDeletion(req, res, resolved.id);
});

// `POST /admin/languages` - Add a new language (admin only)
router.post("/languages", adminAuth, async (req, res) => {
	const rawName = normalizeText(req.body?.name);
	const normalized = normalizeLanguageName(rawName);

	const errors = validateLanguageName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query(
			`SELECT id FROM languages WHERE name_normalized = $1`,
			[normalized]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Language already exists.", ["A language with this name already exists."]);
		}

		const result = await pool.query(
			`INSERT INTO languages (name, name_normalized, created_at, updated_at)
			 VALUES ($1, $2, NOW(), NOW())
			 RETURNING id, name, created_at, updated_at`,
			[rawName, normalized]
		);

		const row = result.rows[0];
		logToFile("LANGUAGE_CREATE", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			language_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 201, "Language created successfully.", {
			id: row.id,
			name: row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
	} catch (error) {
		logToFile("LANGUAGE_CREATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the language."]);
	}
});

async function handleLanguageUpdate(req, res, id) {
	const rawName = normalizeText(req.body?.name);
	const normalized = normalizeLanguageName(rawName);
	const errors = validateLanguageName(rawName);
	if (errors.length > 0) {
		return errorResponse(res, 400, "Validation Error", errors);
	}

	try {
		const existing = await pool.query(
			`SELECT id FROM languages WHERE name_normalized = $1 AND id <> $2`,
			[normalized, id]
		);
		if (existing.rows.length > 0) {
			return errorResponse(res, 409, "Language already exists.", ["A language with this name already exists."]);
		}

		const result = await pool.query(
			`UPDATE languages
			 SET name = $1, name_normalized = $2, updated_at = NOW()
			 WHERE id = $3
			 RETURNING id, name, created_at, updated_at`,
			[rawName, normalized, id]
		);

		if (result.rows.length === 0) {
			return errorResponse(res, 404, "Language not found.", ["The requested language could not be located."]);
		}

		const row = result.rows[0];
		logToFile("LANGUAGE_UPDATE", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			language_id: row.id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Language updated successfully.", {
			id: row.id,
			name: row.name,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		});
	} catch (error) {
		logToFile("LANGUAGE_UPDATE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while updating the language."]);
	}
}

// `PUT /admin/languages/:id` - Update a language (admin only)
router.put("/languages/:id", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.params.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageUpdate(req, res, id);
});

// `PUT /admin/languages` - Update a language using JSON body (admin only)
router.put("/languages", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.body?.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageUpdate(req, res, id);
});

async function handleLanguageDelete(req, res, id) {
	try {
		const result = await pool.query(
			`DELETE FROM languages WHERE id = $1`,
			[id]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 404, "Language not found.", ["The requested language could not be located."]);
		}

		logToFile("LANGUAGE_DELETE", {
			status: "SUCCESS",
			user_id: req.user?.id ?? null,
			language_id: id,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "info");

		return successResponse(res, 200, "Language deleted successfully.", { id });
	} catch (error) {
		logToFile("LANGUAGE_DELETE", {
			status: "FAILURE",
			error_message: error.message,
			user_id: req.user?.id ?? null,
			ip: req.ip,
			user_agent: req.get("user-agent")
		}, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while deleting the language."]);
	}
}

// `DELETE /admin/languages/:id` - Delete a language (admin only)
router.delete("/languages/:id", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.params.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageDelete(req, res, id);
});

// `DELETE /admin/languages` - Delete a language using JSON body (admin only)
router.delete("/languages", adminAuth, async (req, res) => {
	const id = Number.parseInt(req.body?.id, 10);
	if (!Number.isInteger(id)) {
		return errorResponse(res, 400, "Validation Error", ["Language id must be a valid integer."]);
	}
	return handleLanguageDelete(req, res, id);
});


module.exports = router;
