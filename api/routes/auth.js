//the Auth endpoints will be used to authenticate users
//POST auth/register: Create a new user account with email and password 
//POST auth/login: Authenticate and log in a user with email and password (returns refreshToken)
//POST auth/logout: Revoke refreshToken to log user out
//POST auth/verify-email: Verify user's email address using the token sent to their email
//POST auth/google: Sign in or register a user using Google OAuth2
//POST auth/refresh-token: Get a new accessToken using a valid refreshToken
//POST auth/request-password-reset: Request a password reset email
//POST auth/reset-password: Reset password using the token sent to user's email

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { validateFullName, validatePreferredName, validateEmail, validatePassword } = require("../utils/validators");
const { logUserAction, logToFile } = require("../utils/logging");

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;
const RECAPTCHA_SECRET = process.env.GOOGLE_RECAPTCHA_SECRET;

const registerLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, //10 minutes
	max: 5, // 5 requests
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false
  });

// Helper: get an active (unexpired, unused) email verification token for a user, or create a new one
async function ensureActiveVerificationToken(userId, client = null) {
	const q = client || pool;
	// Try get an existing non-expired, unused token
	const existing = await q.query(
		`SELECT token, expires_at
		 FROM verification_tokens
		 WHERE user_id = $1
			 AND token_type = 'email_verification'
			 AND used = false
			 AND expires_at > NOW()
		 ORDER BY created_at DESC
		 LIMIT 1`,
		[userId]
	);

	if (existing.rows.length > 0) {
		return { token: existing.rows[0].token, expiresAt: existing.rows[0].expires_at, reused: true };
	}

	// Create a new token
	const token = crypto.randomBytes(32).toString("hex");
	const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
	await q.query(
		`INSERT INTO verification_tokens (user_id, token, token_type, expires_at, used, created_at)
		 VALUES ($1, $2, 'email_verification', $3, false, NOW())`,
		[userId, token, expiresAt]
	);
	return { token, expiresAt, reused: false };
}

// CAPTCHA Helper (v3)
async function verifyCaptcha(token, ip) {
	if (!RECAPTCHA_SECRET) {
		logToFile("CAPTCHA_MISCONFIGURED", { message: "RECAPTCHA_SECRET is not set in environment variables" }, "warn");
		return false;
	}

	if (!token) {
		return false;
	}
	if (typeof token !== "string") {
		return false;
	}

	try {
		const params = new URLSearchParams();
		params.append("secret", RECAPTCHA_SECRET);
		params.append("response", token);
		if (ip) {
			params.append("remoteip", ip);
		}

		const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: params
		});
		const data = await response.json();
	// Log minimal info only; avoid dumping entire CAPTCHA payload
	logToFile("CAPTCHA_VERIFICATION", { success: data?.success === true, score: data?.score }, "info");
		return data.success && data.score && data.score >= 0.5; //Accept scores >= 0.5
	} catch (e) {
		logToFile("CAPTCHA_VERIFICATION_ERROR", { message: e.message }, "error");
		return false;
	}
}



//POST auth/register: Create a new user account with email and password 
router.post("/register", registerLimiter, async (req, res) => {
	let { captchaToken, fullName, preferredName, email, password } = req.body || {};

	//Validate CAPTCHA before doing anything else
	const captchaValid = await verifyCaptcha(captchaToken, req.ip);
	if (!captchaValid) {
	await logUserAction({ userId: null, action: "USER_REGISTERED", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: "CAPTCHA_FAILED", details: { email } });
	logToFile("USER_REGISTERED", { reason: "CAPTCHA_FAILED", email }, "warn");
		return errorResponse(res, 400, "CAPTCHA verification failed", ["CAPTCHA verification failed. Please try again.", "Make sure that you provided a captchaToken in your request."]);
	}

	//Sanitize and validate inputs
	const errors = [];
	fullName = fullName ? fullName.trim() : null;
	preferredName = preferredName ? preferredName.trim() : null;
	email = email ? email.trim().toLowerCase() : null;
	password = password ? password.trim() : null;

	errors.push(
		...validateFullName(fullName),
		...validatePreferredName(preferredName),
		...validateEmail(email),
		...validatePassword(password)
	);

	if (errors.length > 0) {
		await logUserAction({
			userId: null,
			action: "USER_REGISTERED",
			status: "FAILURE",
			ip: req.ip,
			userAgent: req.get("user-agent"),
			errorMessage: "Validation Error",
			details: { email, errors }
		  });
		logToFile("USER_REGISTERED", { reason: "VALIDATION", email, errors }, "warn");
		return errorResponse(res, 400, "Validation Error", errors);
	}

	//Check if Email is Unique
	try {
			const userRes = await pool.query("SELECT id, is_verified FROM users WHERE email = $1", [email]);
			if (userRes.rows.length > 0) {
				const existingUser = userRes.rows[0];
				if (existingUser.is_verified) {
					await logUserAction({
						userId: existingUser.id,
						action: "USER_REGISTERED",
						status: "FAILURE",
						ip: req.ip,
						userAgent: req.get("user-agent"),
						errorMessage: "Email already in use",
						details: { email }
					});
					logToFile("USER_REGISTERED", { reason: "EMAIL_IN_USE", email }, "warn");
					return errorResponse(res, 409, "Email already in use", ["The provided email is already associated with another account."]);
				}

				// If not verified, (re)issue verification token and respond 200
				try {
					const { token, expiresAt, reused } = await ensureActiveVerificationToken(existingUser.id);
					await logUserAction({
						userId: existingUser.id,
						action: "EMAIL_VERIFICATION",
						status: "SUCCESS",
						ip: req.ip,
						userAgent: req.get("user-agent"),
						details: { email, mode: reused ? "REUSED_TOKEN" : "NEW_TOKEN", trigger: "REGISTER_ATTEMPT" }
					});
					logToFile("EMAIL_VERIFICATION", { user_id: existingUser.id, email, mode: reused ? "REUSED_TOKEN" : "NEW_TOKEN" }, "info");

					//SEND EMAIL HERE
					const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
					const emailSent = await sendVerificationEmail(email, token, preferredName, expiresIn);

					if (!emailSent) {
						await logUserAction({
						  userId: existingUser.id,
						  action: "EMAIL_VERIFICATION",
						  status: "FAILURE",
						  ip: req.ip,
						  userAgent: req.get("user-agent"),
						  errorMessage: "Failed to send verification email",
						  details: { email, trigger: "REGISTER_ATTEMPT" }
						});
						logToFile("EMAIL_VERIFICATION", { error: "Failed to send verification email", email }, "error");
						return errorResponse(res, 500, "Failed to send verification email", [
						  "Could not send verification email. Please try again later."
						]);
					  }

					return successResponse(res, 200, "Account already exists but not verified. Verification email has been (re)sent. The existing account was not modified.", {});
				} catch (e) {
					await logUserAction({
						userId: existingUser.id,
						action: "EMAIL_VERIFICATION",
						status: "FAILURE",
						ip: req.ip,
						userAgent: req.get("user-agent"),
						errorMessage: e.message,
						details: { email, trigger: "REGISTER_ATTEMPT" }
					});
					logToFile("EMAIL_VERIFICATION", { error: e.message, email }, "error");
					return errorResponse(res, 500, "Failed to issue verification token", [e.message]);
				}
			}
	} catch(e) {
		await logUserAction({
			userId: null,
			action: "USER_REGISTERED",
			status: "FAILURE",
			ip: req.ip,
			userAgent: req.get("user-agent"),
			errorMessage: e.message,
			details: { email }
		  });
		logToFile("USER_REGISTERED", { error: e.message, email }, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while checking for a duplicate email", e.message]);
	}


	//Create user (use a transaction)
	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
		const insertUserText = `
			INSERT INTO users (full_name, preferred_name, email, password_hash, is_verified)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING *
		`;
		const insertUserValues = [fullName, preferredName, email, passwordHash, false];
		const result = await client.query(insertUserText, insertUserValues);
		const newUser = result.rows[0];

		//Generate email verification token
		// Issue verification token (new if none active)
		const { token, expiresAt } = await ensureActiveVerificationToken(newUser.id, client);

		await client.query("COMMIT");

		await logUserAction({
			userId: newUser.id,
			action: "USER_REGISTERED",
			status: "SUCCESS",
			ip : req.ip,
			userAgent: req.get("user-agent"),
			details: { email: newUser.email }
		});
	logToFile("USER_REGISTERED", { user_id: newUser.id, email: newUser.email }, "info");

		//SEND EMAIL HERE
		const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
		const emailSent = await sendVerificationEmail(email, token, preferredName, expiresIn);

		if (!emailSent) {
			await logUserAction({
				userId: existingUser.id,
				action: "EMAIL_VERIFICATION",
				status: "FAILURE",
				ip: req.ip,
				userAgent: req.get("user-agent"),
				errorMessage: "Failed to send verification email",
				details: { email, trigger: "REGISTER_ATTEMPT" }
			});
			logToFile("EMAIL_VERIFICATION", { error: "Failed to send verification email", email }, "error");
			return errorResponse(res, 500, "Failed to send verification email", [
				"Could not send verification email. Please try again later.",
				"Note: Your account was created, but you will need to verify your email before logging in."
			]);
		}

		return successResponse(res, 201, "User registered successfully. Please verify your email before logging in.", 
			{   id: newUser.id,
				email: newUser.email,
				fullName: newUser.full_name,
				preferredName: newUser.preferred_name,
				role: newUser.role,
				isVerified: newUser.is_verified
			});
	} catch (e) {
		await client.query("ROLLBACK");
		await logUserAction({
			userId: null,
			action: "USER_REGISTERED",
			status: "FAILURE",
			ip: req.ip,
			userAgent: req.get("user-agent"),
			errorMessage: e.message,
			details: { email }
		  });
		logToFile("USER_REGISTERED", { error: e.message, email }, "error");
		return errorResponse(res, 500, "Database Error", ["An error occurred while creating the user", e.message]);
	} finally {
		client.release();
	}

});



// POST auth/resend-verification: Resend email verification for existing, unverified users
router.post("/resend-verification", async (req, res) => {
	let { email } = req.body || {};
	email = email ? email.trim().toLowerCase() : null;

	const emailErrors = validateEmail(email);
	if (emailErrors.length > 0) {
		await logUserAction({
			userId: null,
			action: "EMAIL_VERIFICATION",
			status: "FAILURE",
			ip: req.ip,
			userAgent: req.get("user-agent"),
			errorMessage: "Validation Error",
			details: { email, errors: emailErrors }
		});
		logToFile("EMAIL_VERIFICATION", { reason: "VALIDATION", email, errors: emailErrors }, "warn");
		return errorResponse(res, 400, "Validation Error", emailErrors);
	}

	try {
		const userRes = await pool.query("SELECT id, is_verified FROM users WHERE email = $1", [email]);
		if (userRes.rows.length === 0) {
			await logUserAction({
				userId: null,
				action: "EMAIL_VERIFICATION",
				status: "FAILURE",
				ip: req.ip,
				userAgent: req.get("user-agent"),
				errorMessage: "User not found",
				details: { email }
			});
			logToFile("EMAIL_VERIFICATION", { reason: "USER_NOT_FOUND", email }, "warn");
			return errorResponse(res, 404, "User not found", ["No account is registered with this email. Please register a new account."]);
		}

		const user = userRes.rows[0];
		if (user.is_verified) {
			await logUserAction({
				userId: user.id,
				action: "EMAIL_VERIFICATION",
				status: "FAILURE",
				ip: req.ip,
				userAgent: req.get("user-agent"),
				errorMessage: "Already verified",
				details: { email }
			});
			logToFile("EMAIL_VERIFICATION", { reason: "ALREADY_VERIFIED", email }, "info");
			return errorResponse(res, 400, "Email already verified", ["This account is already verified. Please log in instead."]);
		}

		const { token, expiresAt, reused } = await ensureActiveVerificationToken(newUser.id, client);
		await logUserAction({
			userId: user.id,
			action: "EMAIL_VERIFICATION",
			status: "SUCCESS",
			ip: req.ip,
			userAgent: req.get("user-agent"),
			details: { email, mode: reused ? "REUSED_TOKEN" : "NEW_TOKEN", trigger: "RESEND_ENDPOINT" }
		});
		logToFile("EMAIL_VERIFICATION", { user_id: user.id, email, mode: reused ? "REUSED_TOKEN" : "NEW_TOKEN" }, "info");

		//SEND EMAIL HERE
		const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
		const emailSent = await sendVerificationEmail(email, token, preferredName, expiresIn);

		if (!emailSent) {
			await logUserAction({
				userId: existingUser.id,
				action: "EMAIL_VERIFICATION",
				status: "FAILURE",
				ip: req.ip,
				userAgent: req.get("user-agent"),
				errorMessage: "Failed to send verification email",
				details: { email, trigger: "REGISTER_ATTEMPT" }
			});
			logToFile("EMAIL_VERIFICATION", { error: "Failed to send verification email", email }, "error");
			return errorResponse(res, 500, "Failed to send verification email", [
				"Could not send verification email. Please try again later."
			]);
		}

		return successResponse(res, 200, "Verification email has been (re)sent.");
	} catch (e) {
		await logUserAction({
			userId: null,
			action: "EMAIL_VERIFICATION",
			status: "FAILURE",
			ip: req.ip,
			userAgent: req.get("user-agent"),
			errorMessage: e.message,
			details: { email, trigger: "RESEND_ENDPOINT" }
		});
		logToFile("EMAIL_VERIFICATION", { error: e.message, email }, "error");
		return errorResponse(res, 500, "Failed to (re)send verification email", [e.message]);
	}
});

const { sendVerificationEmail } = require("../utils/email");

// ...existing code...

// Temporary test endpoint: POST /auth/test-email
router.post("/test-email", async (req, res) => {
  const { email, preferredName } = req.body || {};
  const testToken = crypto.randomBytes(32).toString("hex");

  if (!email) {
    return errorResponse(res, 400, "Email required", ["Please provide an email address in the request body."]);
  }

  try {
    const sent = await sendVerificationEmail(email, testToken, preferredName);
    if (sent) {
      return successResponse(res, 200, "Test verification email sent.", { email });
    } else {
      return errorResponse(res, 500, "Failed to send test email", ["Email service error."]);
    }
  } catch (err) {
    return errorResponse(res, 500, "Error sending test email", [err.message]);
  }
});

// ...existing

module.exports = router;