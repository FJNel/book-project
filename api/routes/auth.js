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
const { OAuth2Client } = require("google-auth-library");

const pool = require("../db");
const { successResponse, errorResponse } = require("../utils/response");
const { validateFullName, validatePreferredName, validateEmail, validatePassword } = require("../utils/validators");
const { logUserAction, logToFile } = require("../utils/logging");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, requiresAuth } = require("../utils/jwt");
const { v4: uuidv4 } = require("uuid");

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 10;
const RECAPTCHA_SECRET = process.env.GOOGLE_RECAPTCHA_SECRET;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const registerLimiter = rateLimit({
	windowMs: 10 * 60 * 1000, //10 minutes
	max: 5, // 5 requests
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false
  });

const emailVerificationLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, //5 minutes
	max: 5, // 5 requests
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false
  });

  const passwordVerificationLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, //5 minutes
	max: 1, // 1 request
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false
  });

  const passwordResetLimiter = rateLimit({
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
		return data.success && data.score && data.score >= 0.7; //Accept scores >= 0.7
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



async function maybeDelay(start, minMs, jitterMs = 400) {
    const elapsed = Date.now() - start;
    const randomMs = Math.floor(Math.random() * jitterMs); // 0 to jitterMs-1
    const totalMin = minMs + randomMs;
    if (elapsed < totalMin) {
        await new Promise(resolve => setTimeout(resolve, totalMin - elapsed));
    }
}

// POST auth/resend-verification: Resend email verification for existing, unverified users
router.post("/resend-verification", emailVerificationLimiter, async (req, res) => {
    const start = Date.now();
	const MIN_RESPONSE_MS = 600; //Mitigates timing attacks

	let { email, captchaToken } = req.body || {};

	//Verify CAPTCHA before doing anything else
	const captchaValid = await verifyCaptcha(captchaToken, req.ip);
	if (!captchaValid) {
	await logUserAction({ userId: null, action: "EMAIL_VERIFICATION", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: "CAPTCHA_FAILED", details: { email } });
	logToFile("EMAIL_VERIFICATION", { reason: "CAPTCHA_FAILED", email }, "warn");
		return errorResponse(res, 400, "CAPTCHA verification failed", ["CAPTCHA verification failed. Please try again.", "Make sure that you provided a captchaToken in your request."]);
	}

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
            await maybeDelay(start, MIN_RESPONSE_MS);
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
			await maybeDelay(start, MIN_RESPONSE_MS);
            return successResponse(res, 200, generalMessage);
        }
		await maybeDelay(start, MIN_RESPONSE_MS);
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
		await maybeDelay(start, MIN_RESPONSE_MS);
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
	  let user;
	  let passwordMatch = false;

	  if (userRes.rows.length > 0) {
		user = userRes.rows[0];
		if (user.is_verified) {
		  passwordMatch = await bcrypt.compare(password, user.password_hash);
		}
	  } else {
		//Hash a dummy password to mitigate timing attacks
		await bcrypt.compare(password, "$2b$10$CwTycUXWue0Thq9StjUM0uJ8m5rRZ1h6h4b1a8u7d1yK5j1y6q9e");
	  }

	  if (!user || !user.is_verified || !passwordMatch) {
		await logUserAction({ userId: user ? user.id : null, action: "LOGIN_ATTEMPT", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: "INVALID_CREDENTIALS", details: { email } });
		logToFile("LOGIN_ATTEMPT", { reason: "INVALID_CREDENTIALS", email }, "warn");
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
	//Use user id from refresh-token payload
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

	if (payload.id !== req.user.id) {
		return errorResponse(res, 403, "Forbidden", ["You can only log out your own session.",
			"The access token and refresh token do not belong to the same user."]);
	}

	try {
		// Revoke the refresh token
		const result = await pool.query(
			`UPDATE refresh_tokens
			 SET revoked = true
			 WHERE user_id = $1
			   AND token_fingerprint = $2
			   AND revoked = false
			   AND expires_at > NOW()`,
			[req.user.id, payload.fingerprint]
		);
	} catch (e) {
		return errorResponse(res, 500, "Server error.", ["An error occurred while logging out. Please try again."]);
	}

	await logUserAction({ userId: payload.id, action: "LOGOUT", status: "SUCCESS", ip: req.ip, userAgent: req.get("user-agent"), details: {} });
	logToFile("LOGOUT", { user_id: payload.id, outcome: "SUCCESS" });

	return successResponse(res, 200, "Logged out successfully.", {});
});



//POST /refresh-token: Get a new accessToken using a valid refreshToken
router.post("/refresh-token", async (req, res) => {
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
		// Check if the refresh token is valid and not revoked
		const tokenRes = await pool.query(
			`SELECT id FROM refresh_tokens
			 WHERE user_id = $1
			   AND token_fingerprint = $2
			   AND revoked = false
			   AND expires_at > NOW()`,
			[payload.id, payload.fingerprint]
		);

		if (tokenRes.rows.length === 0) {
			return errorResponse(res, 401, "Invalid refresh token", ["The provided refresh token is invalid or has expired."]);
		}

		// Fetch user details
		const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [payload.id]);
		if (userRes.rows.length === 0) {
			return errorResponse(res, 401, "Invalid refresh token", ["User associated with token not found."]);
		}
		const user = userRes.rows[0];

		// Generate a new access token
		const newAccessToken = generateAccessToken(user);

		return successResponse(res, 200, "Access token refreshed.", { accessToken: newAccessToken });
	} catch (e) {
		return errorResponse(res, 500, "Server error.", ["An error occurred while refreshing the access token."]);
	}
});



//POST auth/request-password-reset: Request a password reset email
router.post("/request-password-reset", passwordVerificationLimiter, async (req, res) => {
    const start = Date.now();
    const MIN_RESPONSE_MS = 600; // Mitigate timing attacks

    let { email, captchaToken } = req.body || {};

    // CAPTCHA check
    const captchaValid = await verifyCaptcha(captchaToken, req.ip);
    if (!captchaValid) {
        await logUserAction({ userId: null, action: "PASSWORD_RESET_REQUEST", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: "CAPTCHA_FAILED", details: { email } });
        logToFile("PASSWORD_RESET_REQUEST", { reason: "CAPTCHA_FAILED", email }, "warn");
        return errorResponse(res, 400, "CAPTCHA verification failed", ["CAPTCHA verification failed. Please try again.", "Make sure that you provided a captchaToken in your request."]);
    }

    email = email ? email.trim().toLowerCase() : null;
    const emailErrors = validateEmail(email);
    const generalMessage = {
        message: "If you have registered an account with this email address, you will receive a password reset email.",
        disclaimer: "If you did not receive an email when you should have, please check your spam folder or try again later."
    };

    if (emailErrors.length > 0) {
        await logUserAction({
            userId: null,
            action: "PASSWORD_RESET_REQUEST",
            status: "FAILURE",
            ip: req.ip,
            userAgent: req.get("user-agent"),
            errorMessage: "Validation Error",
            details: { email, errors: emailErrors }
        });
        logToFile("PASSWORD_RESET_REQUEST", { reason: "VALIDATION", email, errors: emailErrors }, "warn");
        return errorResponse(res, 400, "Validation Error", emailErrors);
    }

    try {
        const userRes = await pool.query("SELECT id, preferred_name FROM users WHERE email = $1", [email]);
        if (userRes.rows.length === 0) {
            // Log attempt, but respond generically
            await logUserAction({
                userId: null,
                action: "PASSWORD_RESET_REQUEST",
                status: "INFO",
                ip: req.ip,
                userAgent: req.get("user-agent"),
                errorMessage: "Password reset requested for non-existent email",
                details: { email }
            });
            logToFile("PASSWORD_RESET_REQUEST", { reason: "NONEXISTENT_EMAIL", email }, "info");
            await maybeDelay(start, MIN_RESPONSE_MS);
            return successResponse(res, 200, generalMessage);
        }

        const user = userRes.rows[0];
        // Try to get an active password reset token or create a new one
        const existing = await pool.query(
            `SELECT token, expires_at
             FROM verification_tokens
             WHERE user_id = $1
               AND token_type = 'password_reset'
               AND used = false
               AND expires_at > NOW()
             ORDER BY created_at DESC
             LIMIT 1`,
            [user.id]
        );

        let token, expiresAt, reused;
        if (existing.rows.length > 0) {
            token = existing.rows[0].token;
            expiresAt = existing.rows[0].expires_at;
            reused = true;
        } else {
            token = crypto.randomBytes(32).toString("hex");
            expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
            await pool.query(
                `INSERT INTO verification_tokens (user_id, token, token_type, expires_at, used, created_at)
                 VALUES ($1, $2, 'password_reset', $3, false, NOW())`,
                [user.id, token, expiresAt]
            );
            reused = false;
        }

        await logUserAction({
            userId: user.id,
            action: "PASSWORD_RESET_REQUEST",
            status: "SUCCESS",
            ip: req.ip,
            userAgent: req.get("user-agent"),
            details: { email, mode: reused ? "REUSED_TOKEN" : "NEW_TOKEN", trigger: "REQUEST_PASSWORD_RESET" }
        });
        logToFile("PASSWORD_RESET_REQUEST", { user_id: user.id, email, mode: reused ? "REUSED_TOKEN" : "NEW_TOKEN" }, "info");

        // Send password reset email (implement sendPasswordResetEmail similar to sendVerificationEmail)
        const expiresIn = Math.max(1, Math.round((new Date(expiresAt) - Date.now()) / 60000));
        await sendPasswordResetEmail(email, token, user.preferred_name, expiresIn);
        await maybeDelay(start, MIN_RESPONSE_MS);
        return successResponse(res, 200, generalMessage);
    } catch (e) {
        await logUserAction({
            userId: null,
            action: "PASSWORD_RESET_REQUEST",
            status: "FAILURE",
            ip: req.ip,
            userAgent: req.get("user-agent"),
            errorMessage: e.message,
            details: { email, trigger: "REQUEST_PASSWORD_RESET" }
        });
        logToFile("PASSWORD_RESET_REQUEST", { error: e.message, email }, "error");
        await maybeDelay(start, MIN_RESPONSE_MS);
        return successResponse(res, 200, generalMessage);
    }
});

//POST auth/reset-password: Reset password using the token sent to user's email
router.post("/reset-password", passwordResetLimiter, async (req, res) => {
    let { email, token, newPassword, captchaToken } = req.body || {};

    // CAPTCHA check
    const captchaValid = await verifyCaptcha(captchaToken, req.ip);
    if (!captchaValid) {
        await logUserAction({ userId: null, action: "PASSWORD_RESET_SUCCESS", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: "CAPTCHA_FAILED", details: { email } });
        logToFile("PASSWORD_RESET_SUCCESS", { reason: "CAPTCHA_FAILED", email }, "warn");
        return errorResponse(res, 400, "CAPTCHA verification failed", ["CAPTCHA verification failed. Please try again.", "Make sure that you provided a captchaToken in your request."]);
    }

    email = email ? email.trim().toLowerCase() : null;
    token = token ? token.trim() : null;
    newPassword = newPassword ? newPassword.trim() : null;

    // Validate input
    const errors = [
        ...validateEmail(email),
        ...(typeof token !== "string" || token.length < 10 ? ["A valid password reset token must be provided."] : []),
        ...validatePassword(newPassword)
    ].filter(Boolean);

    if (errors.length > 0) {
        await logUserAction({
            userId: null,
            action: "PASSWORD_RESET_SUCCESS",
            status: "FAILURE",
            ip: req.ip,
            userAgent: req.get("user-agent"),
            errorMessage: "Validation Error",
            details: { email, errors }
        });
        logToFile("PASSWORD_RESET_SUCCESS", { reason: "VALIDATION", email, errors }, "warn");
        return errorResponse(res, 400, "Validation Error", errors);
    }

    try {
        // Find user by email
        const userRes = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (userRes.rows.length === 0) {
            await logUserAction({
                userId: null,
                action: "PASSWORD_RESET_SUCCESS",
                status: "FAILURE",
                ip: req.ip,
                userAgent: req.get("user-agent"),
                errorMessage: "No user found for email",
                details: { email }
            });
            logToFile("PASSWORD_RESET_SUCCESS", { reason: "NO_USER", email }, "warn");
            return errorResponse(res, 400, "Incorrect email address, or invalid or expired token.", [
                "The provided token is invalid or has expired OR the email address is incorrect.",
                "Please request a new password reset email."
            ]);
        }

        const user = userRes.rows[0];

        // Find token
        const tokenRes = await pool.query(
            `SELECT id, user_id, expires_at, used
             FROM verification_tokens
             WHERE user_id = $1
               AND token_type = 'password_reset'
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
                action: "PASSWORD_RESET_SUCCESS",
                status: "FAILURE",
                ip: req.ip,
                userAgent: req.get("user-agent"),
                errorMessage: "Invalid or expired token",
                details: { email, token }
            });
            logToFile("PASSWORD_RESET_SUCCESS", { reason: "INVALID_OR_EXPIRED_TOKEN", email }, "warn");
            return errorResponse(res, 400, "Incorrect email address, or invalid or expired token.", [
                "The provided token is invalid or has expired OR the email address is incorrect.",
                "Please request a new password reset email."
            ]);
        }

        // Mark token as used and update password in a transaction
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(
                `UPDATE verification_tokens SET used = true WHERE id = $1 AND token_type = 'password_reset' AND used = false`,
                [tokenRes.rows[0].id]
            );
            const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
            await client.query(
                `UPDATE users SET password_hash = $1 WHERE id = $2`,
                [passwordHash, user.id]
            );

			await client.query(
				`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`,
				[user.id]
			);

            await client.query("COMMIT");

            await logUserAction({
                userId: user.id,
                action: "PASSWORD_RESET_SUCCESS",
                status: "SUCCESS",
                ip: req.ip,
                userAgent: req.get("user-agent"),
                details: { email }
            });
            logToFile("PASSWORD_RESET_SUCCESS", { user_id: user.id, email, reset: true }, "info");

            return successResponse(res, 200, "Password reset successfully. You can now log in.", {
                id: user.id,
                email
            });
        } catch (e) {
            await client.query("ROLLBACK");
            await logUserAction({
                userId: user.id,
                action: "PASSWORD_RESET_SUCCESS",
                status: "FAILURE",
                ip: req.ip,
                userAgent: req.get("user-agent"),
                errorMessage: e.message,
                details: { email, token }
            });
            logToFile("PASSWORD_RESET_SUCCESS", { error: e.message, email }, "error");
            return errorResponse(res, 500, "Database error during password reset.", [
                "An error occurred while resetting your password. Please try again."
            ]);
        } finally {
            client.release();
        }
    } catch (e) {
        await logUserAction({
            userId: null,
            action: "PASSWORD_RESET_SUCCESS",
            status: "FAILURE",
            ip: req.ip,
            userAgent: req.get("user-agent"),
            errorMessage: e.message,
            details: { email, token }
        });
        logToFile("PASSWORD_RESET_SUCCESS", { error: e.message, email }, "error");
        return errorResponse(res, 500, "Server error.", [
            "An error occurred while resetting your password. Please try again."
        ]);
    }
});


async function verifyGoogleIdToken(idToken) {
  const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload(); // Contains email, name, sub (Google user ID), etc.
}

//POST auth/google: Sign in or register a user using Google OAuth2
router.post("/google", async (req, res) => {
  const { idToken } = req.body || {};

  if (!idToken || typeof idToken !== "string") {
    return errorResponse(res, 400, "ID token required", ["Please provide a valid Google ID token in the request body."]);
  }

  try {
    const payload = await verifyGoogleIdToken(idToken);
  } catch (e) {
    return errorResponse(res, 401, "Invalid ID token", ["The provided Google ID token is invalid."]);
  }

  //Save userID, email, fullName and preferredName from payload
  const { email, email_verified, name, given_name, sub: providerUserId } = payload;

  if (!email_verified) {
    return errorResponse(res, 400, "Email not verified by Google", ["Your Google account email is not verified. Please verify your email with Google before signing in."]);
  }

  if (!providerUserId || typeof providerUserId !== "string") {
    return errorResponse(res, 400, "Invalid Google profile: No user ID", ["Could not retrieve valid user ID from Google profile."]);
  }

  if (!email || !name ) {
    return errorResponse(res, 400, "Incomplete Google profile", ["Your Google profile is missing required information.", "Please ensure your Google account has an email address and name associated with it.",
      "Or, if you still have issues, please register/login manually."
    ]);
  }

  if (!given_name) {
    given_name = null;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    //1. Check if user exists
    let userRes = await client.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    let user;

    if (userRes.rows.length > 0) {
      user = userRes.rows[0];

      //If user exists but is not verified, verify them now
      if (!user.is_verified) {
        await client.query("UPDATE users SET is_verified = true WHERE id = $1", [user.id]);
        user.is_verified = true;
      }

      //Check of OAuth account already exists
      let oauthRes = await client.query(
        "SELECT * FROM oauth_accounts WHERE provider = 'google' AND provider_user_id = $1",
        [providerUserId]
      );

      //If no linked OAuth account, create one (existing user)
      if (oauthRes.rows.length === 0) {
        await client.query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, created_at)
           VALUES ($1, 'google', $2, NOW())`,
          [user.id, providerUserId]
        );
      }
    } else //Create a complete new user in user table and oauth table
    {
      const insertUser = await client.query(
        `INSERT INTO users (email, full_name, preferred_name, is_verified, role, created_at)
         VALUES ($1, $2, $3, true, 'user', NOW())
         RETURNING *`,
        [email.toLowerCase(), name, given_name]
      );
      user = insertUser.rows[0];
 
      await client.query(
        `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, created_at)
         VALUES ($1, 'google', $2, NOW())`,
        [user.id, providerUserId]
      );
    }//else

    await client.query("COMMIT");

    //Generate tokens
    const fingerprint = uuidv4();
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user, fingerprint);

    //Store refresh token in DB
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_fingerprint, issued_at, expires_at, revoked, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, false, $5, $6)`,
      [user.id, fingerprint, now, expiresAt, req.ip, req.get("user-agent")]
    );

    await logUserAction({ userId: user.id, action: "OAUTH_LOGIN", status: "SUCCESS", ip: req.ip, userAgent: req.get("user-agent"), details: { email, provider: "google" } });
    logToFile("OAUTH_LOGIN", { user_id: user.id, email, provider: "google", outcome: "SUCCESS" });

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
    await client.query("ROLLBACK");
    await logUserAction({ userId: null, action: "OAUTH_LOGIN", status: "FAILURE", ip: req.ip, userAgent: req.get("user-agent"), errorMessage: e.message, details: { email, provider: "google" } });
    logToFile("OAUTH_LOGIN", { error: e.message , email, provider: "google" }, "error");
    return errorResponse(res, 500, "Server error.", ["An error occurred during Google login. Please try again."]);
  } finally {
    client.release();
  }
});

module.exports = router;