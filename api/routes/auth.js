// api/routes/auth.js
// Routes for user authentication (registration and login)
// 
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const rateLimit = require("express-rate-limit");
const axios = require("axios"); // For reCAPTCHA verification
const SALT_ROUNDS = 10;
const { success, error } = require("../utils/response");
const {
	validateName,
	validateEmail,
	validatePassword,
	validatePhone,
	validateRole
  } = require("../utils/validators");

const registerLimiter = rateLimit({
	windowMs: 60*1000, // 1 minute
	max: 10, // limit each IP to 10 requests per windowMs
	handler: (req, res) => {
		return error(res, ["Too many registration attempts from this IP"], "Rate limit exceeded", 429);
	  }
});
const loginLimiter = rateLimit({
	windowMs: 60*1000, // 1 minute
	max: 5, // limit each IP to 5 requests per windowMs
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


//Endpoint to register a new user
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
	phone = phone ? phone.trim() : "";
	name = name ? name.trim() : "";
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





// Login
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
		const result = await pool.query("SELECT id, name, email, role, password_hash FROM users WHERE email = $1", [email]);
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

		await pool.query(
			"UPDATE users SET last_login = now() WHERE id = $1",
			[user.id]
		);

		const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

		return success(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }, "Login successful", 200);
	} catch (err) {
		console.error(err);
		return error(res, err.message, "Server Error while attempting login", 500);
	}
});

module.exports = router;