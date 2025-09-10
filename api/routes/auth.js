// api/routes/auth.js
// Routes for user authentication (registration and login)
// 
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const rateLimit = require("express-rate-limit");
const axios = require("axios"); // For reCAPTCHA verification
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;
const { success, error } = require("../utils/response");
const {
	validateName,
	validateEmail,
	validatePassword,
	validatePhone,
	validateRole
  	} = require("../utils/validators");
const {signAccessToken, requireAuth} = require("../utils/jwt");
const crypto = require("crypto");

//RATE LIMITING
// Limit registration attempts to 10 per minute per IP
// Limit login attempts to 5 per minute per IP
const registerLimiter = rateLimit({
	windowMs: 60*1000*5, // 5 minutes
	max: 10, // limit each IP to 10 requests per windowMs
	handler: (req, res) => {
		return error(res, ["Too many registration attempts from this IP"], "Rate limit exceeded", 429);
	  }
});
const loginLimiter = rateLimit({
	windowMs: 60*1000*5, // 5 minutes
	max: 10, // limit each IP to 5 requests per windowMs
	handler: (req, res) => {
		return error(res, ["Too many login attempts from this IP"], "Rate limit exceeded", 429);
	}
});



//CAPTCHA
async function verifyRecaptcha(token) {
  const secretKey = process.env.RECAPTCHA_SECRET;
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
  const response = await axios.post(url);
  return response.data.success;
}



//SECURE REFRESH TOKEN
//Generate
function generateRefreshToken() {
	return crypto.randomBytes(64).toString('hex'); // 128 characters
}
//Store in DB
async function issueRefreshToken(userId) {
	const refreshToken = generateRefreshToken();
	const expiresAt = new Date(Date.now() + 7*24*60*60*1000); // 7 days
	
	await pool.query(
		"INSERT INTO refresh_tokens (user_id, token_fingerprint, expires_at, revoked) VALUES ($1, $2, $3, false)",
		[userId, refreshToken, expiresAt]
	);
	return refreshToken;
}



//REGISTER ENDPOINT
/**
 * @openapi
 * /auth/register
 * 
 */
router.post("/register", registerLimiter, async (req, res) => {
	//Passed in parameters:
	// name: The user's full name (string, required)
	// email: The user's email address (string, required, must be unique)
	// password: The user's password (string, required)
	// role: The user's role (string, optional, defaults to 'user')
	let { name, email, password, role, phone, captchaToken } = req.body;

	// //Check if captcha token is provided and valid before doing anything else
	// if (!captchaToken) {
	// 	return error(res, ["Captcha token missing"], "Validation Error", 400);
	// }
	// const captchaValid = await verifyRecaptcha(captchaToken);
	// if (!captchaValid) {
	// 	return error(res, ["Captcha verification failed"], "Validation Error", 400);
	// }

	//Check if name, email and password are provided
	email = email ? email.toLowerCase().trim() : "";
	name = name ? name.trim() : "";
	//Other fields
	phone = phone ? phone.trim() : "";
	password = password ? password.trim() : "";
	role = role ? role.trim() : "";

	//Trim and normalize inputs
	let errors = [
		...validateName(name),
		...validateEmail(email),
		...validatePassword(password),
		...validatePhone(phone),
		...validateRole(role)
	  ];
	errors = errors.flat();
	errors = errors.filter(Boolean); // Remove empty strings or nulls

	//Check if 
	if (errors.length > 0) {
		return error(res, errors, "Validation Error", 400);
	}

	// Check if user is allowed to register (name in approved_users)
    try {
        const approved = await pool.query(
            "SELECT id FROM approved_users WHERE email = $1 AND name = $2", [email, name]
        );
        if (approved.rowCount === 0) {
            return error(res, "Registration not allowed: Name and email do not match an approved user.", "Registration not allowed", 403);
        }
    } catch (err) {
        console.error("Error checking approved_users:", err);
        return error(res, "Server error: Could not check approved users list", "Registration failed due to server error", 500);
    }

	//Check if email is already registered
	try {
		if (email) {
		  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
		  if (existing.rowCount > 0) {
			errors.push("Email already registered. Please use a different email or login.");
		  }
		}
	} catch (err) {
		console.error("Error checking existing email:", err);
		return error(res, "Server error: Could not check if email already exists", "Registration failed due to server error", 500);
	}

	if (errors.length > 0) {
	return error(res, errors, "Validation Error", 400);
	}
	
	// All validations passed - proceed to create user
	try {
	const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

	const result = await pool.query(
		"INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, created_at",
		[name, email, phone, hashedPassword, role || 'user']
	);

	return success(res, result.rows[0], "User registered successfully", 201);
	} catch (err) {
	console.error(err);
	return error(res, err.message, "Server error during user registration", 500);
	}

});



//LOGIN ENDPOINT
router.post("/login", loginLimiter, async (req, res) => {
  	let { email, password, captchaToken } = req.body;

	// //Check if captcha token is provided and valid before doing anything else
	// if (!captchaToken) {
	// 	return error(res, ["Captcha token missing"], "Validation Error", 400);
	// }
	// const captchaValid = await verifyRecaptcha(captchaToken);
	// if (!captchaValid) {
	// 	return error(res, ["Captcha verification failed"], "Validation Error", 400);
	// }

	email = email ? email.toLowerCase().trim() : "";
	password = password ? password.trim() : "";
  
	let errors = [
	  ...validateEmail(email),
	  ...validatePassword(password)
	];
  
	if (errors.length > 0) {
		return error(res, errors, "Validation Error", 400);
	}

	try {
		const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
		if (result.rowCount === 0) {
			console.log("No user found with that email");
			return error(res, ["Invalid credentials"], "Login Failed", 401);
		}

		const user = result.rows[0];
		const match = await bcrypt.compare(password, user.password_hash);

		if (!match) {
			console.log("Password mismatch");
			return error(res, ["Invalid credentials"], "Login Failed", 401);
		}

		// Update last login timestamp
		await pool.query(
			"UPDATE users SET last_login = now() WHERE id = $1",
			[user.id]
		);

		// Short-lived access token (15m); adjust if you prefer longer
    	const token = signAccessToken({ id: user.id, role: user.role }, "15m");
		// Long-lived refresh token (7 days)
		const refreshToken = await issueRefreshToken(user.id);	
		delete user.password_hash; // Remove sensitive info
		return success(res, 
			{ token, refreshToken, user }, "Login successful", 200);
	
	} catch (err) {
		console.error(err);
		return error(res, err.message, "Server Error while attempting login", 500);
	}
});

//REFRESH ENDPOINT
router.post("/refresh", async (req, res) => {
	const { refreshToken } = req.body;
	if (!refreshToken) return error(res, ["Missing refresh token"], "Unauthorized", 401);

	// Find session
	const session = await pool.query(
		"SELECT * FROM refresh_tokens WHERE token_fingerprint = $1 AND revoked = false AND expires_at > now()",
		[refreshToken]
	);

	if (session.rowCount === 0) return error(res, ["Invalid or expired refresh token"], "Unauthorized", 401);

	const userId = session.rows[0].user_id;
	const userRes = await pool.query("SELECT id, role FROM users WHERE id = $1", [userId]);
	if (userRes.rowCount === 0) return error(res, ["User not found"], "Unauthorized", 401);

	const token = signAccessToken({ id: userId, role: userRes.rows[0].role }, "15m");
	return success(res, { token }, "Token refreshed", 200);
});



//LOGOUT ENDPOINT
router.post("/logout", requireAuth, async (req, res) => {
	const { refreshToken } = req.body;
	if (!refreshToken) return error(res, ["Missing refresh token"], "Bad Request", 400);
	await pool.query(
		"UPDATE refresh_tokens SET revoked = true WHERE token_fingerprint = $1 AND user_id = $2",
		[refreshToken, req.user.id]
	);
	return success(res, {}, "Logged out", 200);
});

module.exports = router;