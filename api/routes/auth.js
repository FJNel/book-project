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
const { sendVerificationEmail } = require("../utils/email");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, requiresAuth } = require("../utils/jwt");
const { v4: uuidv4 } = require("uuid");

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;
const RECAPTCHA_SECRET = process.env.GOOGLE_RECAPTCHA_SECRET;

const registerLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, //10 minutes
	max: 5, // 5 requests
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false
  });

const emailVerificationLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, //5 minutes
	max: 1, // 1 request
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false
  });

const loginLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, //10 minutes
	max: 10, // 10 requests
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
        // Log validation error, but respond generically
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
		const generalMessage = { "message":"If you have registered an account with this email address and it is unverified, you will receive a verification email.", "disclaimer":"If you did not receive an email when you should have, please check your spam folder or try again later."};
        const userRes = await pool.query("SELECT id, is_verified, preferred_name FROM users WHERE email = $1", [email]);
        if (userRes.rows.length === 0 || userRes.rows[0].is_verified) {
            // Log attempt, but respond generically
            await logUserAction({
                userId: userRes.rows[0]?.id || null,
                action: "EMAIL_VERIFICATION",
                status: "INFO",
                ip: req.ip,
                userAgent: req.get("user-agent"),
                errorMessage: "Resend attempted for non-existent or already verified email",
                details: { email }
            });
            logToFile("EMAIL_VERIFICATION", { reason: "NONEXISTENT_OR_VERIFIED", email }, "info");
            return successResponse(res, 200, generalMessage);
        }

        const user = userRes.rows[0];
        const { token, expiresAt, reused } = await ensureActiveVerificationToken(user.id);
        await logUserAction({
            userId: user.id,
            action: "EMAIL_VERIFICATION",
            status: "SUCCESS",
            ip: req.ip,
            userAgent: req.get("user-agent"),
            details: { email, mode: reused ? "REUSED_TOKEN" : "NEW_TOKEN", trigger: "RESEND_ENDPOINT" }
        });
        logToFile("EMAIL_VERIFICATION", { user_id: user.id, email, mode: reused ? "REUSED_TOKEN" : "NEW_TOKEN" }, "info");

        // Send email
        const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
        const emailSent = await sendVerificationEmail(email, token, user.preferred_name, expiresIn);

        if (!emailSent) {
            await logUserAction({
                userId: user.id,
                action: "EMAIL_VERIFICATION",
                status: "FAILURE",
                ip: req.ip,
                userAgent: req.get("user-agent"),
                errorMessage: "Failed to send verification email",
                details: { email, trigger: "RESEND_ENDPOINT" }
            });
            logToFile("EMAIL_VERIFICATION", { error: "Failed to send verification email", email }, "error");
            // Still respond generically
            return successResponse(res, 200, generalMessage);
        }

        return successResponse(res, 200, generalMessage);
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
        // Still respond generically
        return successResponse(res, 200, generalMessage);
    }
});



//POST /auth/verify-email: Verifies a user's email address using the token sent via email
router.post("/verify-email", async (req, res) => {
  let { email, token } = req.body || {};
  email = email ? email.trim().toLowerCase() : null;
  token = token ? token.trim() : null;

  // Validate input
  const errors = [
    ...validateEmail(email),
    ...(typeof token !== "string" || token.length < 10 ? ["A valid verification token must be provided."] : [])
  ].filter(Boolean);

  if (errors.length > 0) {
    await logUserAction({
      userId: null,
      action: "EMAIL_VERIFICATION",
      status: "FAILURE",
      ip: req.ip,
      userAgent: req.get("user-agent"),
      errorMessage: "Validation Error",
      details: { email, errors }
    });
    logToFile("EMAIL_VERIFICATION", { reason: "VALIDATION", email, errors }, "warn");
    return errorResponse(res, 400, "Incorrect email address, or invalid or expired token.", errors);
  }

  try {
    // Find user by email
    const userRes = await pool.query("SELECT id, is_verified FROM users WHERE email = $1", [email]);
    if (userRes.rows.length === 0) {
      await logUserAction({
        userId: null,
        action: "EMAIL_VERIFICATION",
        status: "FAILURE",
        ip: req.ip,
        userAgent: req.get("user-agent"),
        errorMessage: "No user found for email",
        details: { email }
      });
      logToFile("EMAIL_VERIFICATION", { reason: "NO_USER", email }, "warn");
      return errorResponse(res, 400, "Incorrect email address, or invalid or expired token.", [
        "The provided token is invalid or has expired OR the email address is incorrect.",
        "Please request a new verification email."
      ]);
    }

    const user = userRes.rows[0];
    if (user.is_verified) {
      await logUserAction({
        userId: user.id,
        action: "EMAIL_VERIFICATION",
        status: "INFO",
        ip: req.ip,
        userAgent: req.get("user-agent"),
        errorMessage: "Already verified",
        details: { email }
      });
      logToFile("EMAIL_VERIFICATION", { reason: "ALREADY_VERIFIED", email }, "info");
      return successResponse(res, 200, "Email already verified. You can log in.", {
        id: user.id,
        email
      });
    }

    // Find token
    const tokenRes = await pool.query(
      `SELECT id, user_id, expires_at, used
       FROM verification_tokens
       WHERE user_id = $1
         AND token_type = 'email_verification'
         AND token = $2
       LIMIT 1`,
      [user.id, token]
    );

    if (
      tokenRes.rows.length === 0 ||
      tokenRes.rows[0].used ||
      new Date(tokenRes.rows[0].expires_at) < new Date()
    ) {
      await logUserAction({
        userId: user.id,
        action: "EMAIL_VERIFICATION",
        status: "FAILURE",
        ip: req.ip,
        userAgent: req.get("user-agent"),
        errorMessage: "Invalid or expired token",
        details: { email, token }
      });
      logToFile("EMAIL_VERIFICATION", { reason: "INVALID_OR_EXPIRED_TOKEN", email }, "warn");
      return errorResponse(res, 400, "Incorrect email address, or invalid or expired token.", [
        "The provided token is invalid or has expired OR the email address is incorrect.",
        "Please request a new verification email."
      ]);
    }

    // Mark token as used and user as verified in a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE verification_tokens SET used = true WHERE id = $1 AND token_type = 'email_verification' AND used = false`, 
        [tokenRes.rows[0].id]
      );
      await client.query(
        `UPDATE users SET is_verified = true WHERE id = $1`,
        [user.id]
      );
      await client.query("COMMIT");

      await logUserAction({
        userId: user.id,
        action: "EMAIL_VERIFICATION",
        status: "SUCCESS",
        ip: req.ip,
        userAgent: req.get("user-agent"),
        details: { email }
      });
      logToFile("EMAIL_VERIFICATION", { user_id: user.id, email, verified: true }, "info");

      return successResponse(res, 200, "Email verified successfully. You can now log in.", {
        id: user.id,
        email
      });
    } catch (e) {
      await client.query("ROLLBACK");
      await logUserAction({
        userId: user.id,
        action: "EMAIL_VERIFICATION",
        status: "FAILURE",
        ip: req.ip,
        userAgent: req.get("user-agent"),
        errorMessage: e.message,
        details: { email, token }
      });
      logToFile("EMAIL_VERIFICATION", { error: e.message, email }, "error");
      return errorResponse(res, 500, "Database error during verification.", [
        "An error occurred while verifying your email. Please try again."
      ]);
    } finally {
      client.release();
    }
  } catch (e) {
    await logUserAction({
      userId: null,
      action: "EMAIL_VERIFICATION",
      status: "FAILURE",
      ip: req.ip,
      userAgent: req.get("user-agent"),
      errorMessage: e.message,
      details: { email, token }
    });
    logToFile("EMAIL_VERIFICATION", { error: e.message, email }, "error");
    return errorResponse(res, 500, "Server error.", [
      "An error occurred while verifying your email. Please try again."
    ]);
  }
});



//POST auth/login: Authenticate and log in a user with email and password (returns refreshToken)
router.post("/login", loginLimiter, async (req, res) => {
	const { captchaToken, email, password } = req.body || {};
  
	// CAPTCHA check
	const captchaValid = await verifyCaptcha(captchaToken, req.ip);
	if (!captchaValid) {
	  await logUserAction({ userId: null, action: "LOGIN_ATTEMPT", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: "CAPTCHA_FAILED", details: { email } });
	  logToFile("LOGIN_ATTEMPT", { reason: "CAPTCHA_FAILED", email }, "warn");
	  return errorResponse(res, 400, "CAPTCHA verification failed", ["CAPTCHA verification failed. Please try again.", "Make sure that you provided a captchaToken in your request."]);
	}
  
	// Basic input check (do not reveal which field is wrong)
	if (!email || !password) {
	  return errorResponse(res, 401, "Invalid email or password.", ["The provided email or password is incorrect."]);
	}
  
	try {
	  const userRes = await pool.query("SELECT * FROM users WHERE email = $1", [email.trim().toLowerCase()]);
	  if (userRes.rows.length === 0) {
		await logUserAction({ userId: null, action: "LOGIN_ATTEMPT", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: "NO_USER", details: { email } });
		logToFile("LOGIN_ATTEMPT", { reason: "NO_USER", email }, "warn");
		return errorResponse(res, 401, "Invalid email or password.", ["The provided email or password is incorrect."]);
	  }
  
	  const user = userRes.rows[0];
	  if (!user.is_verified) {
		await logUserAction({ userId: user.id, action: "LOGIN_ATTEMPT", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: "NOT_VERIFIED", details: { email } });
		logToFile("LOGIN_ATTEMPT", { reason: "NOT_VERIFIED", email }, "warn");
		return errorResponse(res, 401, "Invalid email or password.", ["The provided email or password is incorrect."]);
	  }
  
	  const passwordMatch = await bcrypt.compare(password, user.password_hash);
	  if (!passwordMatch) {
		await logUserAction({ userId: user.id, action: "LOGIN_ATTEMPT", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: "WRONG_PASSWORD", details: { email } });
		logToFile("LOGIN_ATTEMPT", { reason: "WRONG_PASSWORD", email }, "warn");
		return errorResponse(res, 401, "Invalid email or password.", ["The provided email or password is incorrect."]);
	  }
  
	  // Generate fingerprint for refresh token
	  const fingerprint = uuidv4();
  
	  // Generate tokens
	  const accessToken = generateAccessToken(user);
	  const refreshToken = generateRefreshToken(user, fingerprint);
  
	  // Store refresh token in DB
	  const now = new Date();
	  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
	  await pool.query(
		`INSERT INTO refresh_tokens (user_id, token_fingerprint, issued_at, expires_at, revoked, ip_address, user_agent)
		 VALUES ($1, $2, $3, $4, false, $5, $6)`,
		[user.id, fingerprint, now, expiresAt, req.ip, req.get("user-agent")]
	  );
  
	  await logUserAction({ userId: user.id, action: "LOGIN_ATTEMPT", status: "SUCCESS", ip: req.ip, userAgent: req.get("user-agent"), details: { email } });
	  logToFile("LOGIN_ATTEMPT", { user_id: user.id, email, outcome: "SUCCESS" });
  
	  return successResponse(res, 200, "Login successful.", {
		accessToken,
		refreshToken,
		user: {
		  id: user.id,
		  email: user.email,
		  fullName: user.full_name,
		  preferredName: user.preferred_name,
		  role: user.role,
		  isVerified: user.is_verified
		}
	  });
	} catch (e) {
	  await logUserAction({ userId: null, action: "LOGIN_ATTEMPT", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: e.message, details: { email } });
	  logToFile("LOGIN_ATTEMPT", { error: e.message, email }, "error");
	  return errorResponse(res, 500, "Server error.", ["An error occurred during login. Please try again."]);
	}
});



//POST auth/logout: Revoke refreshToken to log user out
router.post("/logout", requiresAuth, async (req, res) => {
	const { refreshToken } = req.body || {};

	if (!refreshToken || typeof refreshToken !== "string") {
		return errorResponse(res, 400, "Refresh token required", ["Please provide a valid refresh token in the request body."]);
	}

	let payload;
	try {
		payload = verifyRefreshToken(refreshToken);
	} catch (e) {
		return errorResponse(res, 401, "Invalid refresh token", ["The provided refresh token is invalid or has expired."]);
	}

	try {
		// Revoke the refresh token in the database
		const result = await pool.query(
			`UPDATE refresh_tokens
			 SET revoked = true, revoked_at = NOW()
			 WHERE user_id = $1
			   AND token_fingerprint = $2
			   AND revoked = false
			   AND expires_at > NOW()`,
			[req.user.id, payload.fingerprint]
		);

		if (result.rowCount === 0) {
			return errorResponse(res, 401, "Invalid refresh token", ["The provided refresh token is invalid or has expired."]);
		}

		await logUserAction({ userId: payload.userId, action: "LOGOUT", status: "SUCCESS", ip: req.ip, userAgent: req.get("user-agent"), details: {} });
		logToFile("LOGOUT", { user_id: payload.userId, outcome: "SUCCESS" });

		return successResponse(res, 200, "Logout successful.", {});
	} catch (e) {
		await logUserAction({ userId: payload.userId, action: "LOGOUT", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: e.message, details: {} });
		logToFile("LOGOUT", { error: e.message, user_id: payload.userId }, "error");
		return errorResponse(res, 500, "Server error.", ["An error occurred during logout. Please try again."]);
	}
});


// Temporary test endpoint: POST /auth/test-email
router.post("/test-email", emailVerificationLimiter, async (req, res) => {
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