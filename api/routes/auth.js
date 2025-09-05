// api/routes/auth.js
// Routes for user authentication (registration and login)
// 
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const axios = require("axios"); // For reCAPTCHA verification
const SALT_ROUNDS = 10;
const { success, error } = require("../utils/response");


//CAPTHCA
async function verifyRecaptcha(token) {
  const secretKey = process.env.RECAPTCHA_SECRET;
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
  const response = await axios.post(url);
  return response.data.success;
}




//Endpoint to register a new user
router.post("/register", async (req, res) => {
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
	let errors = [];
	if (!name) errors.push("Name is required");
	if (!email) errors.push("Email is required");
	if (!password) errors.push("Password is required");
	if (!phone) errors.push("Phone number is required");
	//If any are missing, return error
	if (errors.length > 0) {
		return error(res, errors, "Validation Error", 400);
	}

	//Trim and normalize inputs
	email = email.toLowerCase().trim();
	phone = phone.trim();
	name = name.trim();
	password = password.trim();

	//Input Validations:
	//(These are in addition to the database constraints, to provide quicker and clearer feedback to users)	
	//Thorough name validation:
	errors = [];
	//Check length
	if (name.length < 2 || name.length > 100) {
		errors.push("Name must be between 2 and 100 characters");
	}
	//Check for invalid characters (only letters, spaces, hyphens, and apostrophes)
	const nameRegex = /^[a-zA-Z\s'-]+$/;
	if (!nameRegex.test(name)) {
		errors.push("Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed");
	}

	//Thorough Email validation:
	//Check length
	if (email.length > 255) {
		errors.push("Email must be less than 255 characters");
	}
	//Check format
	const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
	if (!emailRegex.test(email)) {
		errors.push("Invalid email format");
	}
	//Check if email is already used  
	//(This will also be checked later before inserting, but this gives a quicker response)
	try {
		const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
		if (existing.rowCount > 0) {
		errors.push("Email already registered. Please use a different email or login.");
		}
	} catch (err) {
		console.error("Error checking existing email:", err);
		return error(res, "Server error: Could not check if email already exists", "Registration failed due to server error", 500);
	}

	//Thorough Password validation
	if (password.length < 6) {
		errors.push("Password must be at least 6 characters");
	}
	if (password.length > 100) {
		errors.push("Password must be less than 100 characters");
	}
	//Check for complexity (at least one uppercase, one lowercase, one number, and one special character)
	const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
	if (!passwordRegex.test(password)) {
		errors.push("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
	}

	//Thorough Phone validation
	if (phone.length != 10) {
		errors.push("Phone number must be 10 digits. Do not include country code or special characters (e.g. +27)");
	}
	const phoneRegex = /^\d$/; //Only digits
	if (!phoneRegex.test(phone)) {
		errors.push("Phone number must contain only digits. Do not include country code or special characters (e.g. +27)");
	}

	//Role validation (if provided)
	if (role){
		role = role.toLowerCase().trim();
		//Check role validity
		if (role !== 'user' && role !== 'admin') {
			errors.push("Role must be either 'user' or 'admin'");
		}
	}

	//If there are validation errors, return them
	if (errors.length > 0) {
		return error(res, errors, "Validation Error", 400);
	}

	/////////////////////////////////////////////////
	
	//All validations passed - proceed to create user
	try {
		// Hash password
		const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); //Hash the password with bcrypt using 10 salt rounds

		// Insert user
		const result = await pool.query(
		"INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, created_at",
		[name, email, phone, hashedPassword, role || 'user']
		);

		return success(res, result.rows[0], "User registered successfully", 201);
	} catch (err) {
		console.error(err);
		return error(res, err.message, "Server Error while registering user", 500);
	}
});





// Login
router.post("/login", async (req, res) => {
  	let { email, password, captchaToken } = req.body;

	// //Check if captcha token is provided and valid before doing anything else
	// if (!captchaToken) {
	// 	return error(res, ["Captcha token missing"], "Validation Error", 400);
	// }
	// const captchaValid = await verifyRecaptcha(captchaToken);
	// if (!captchaValid) {
	// 	return error(res, ["Captcha verification failed"], "Validation Error", 400);
	// }

  	if (!email || !password) return error(res, ["Email and password required"], "Validation Error", 400);

	//Trim and normalize inputs
	email = email.toLowerCase().trim();
	password = password.trim();

	//Input Validations:
	errors = [];
	//Email validations
	if (email.length === 0) {
		errors.push("Email cannot be empty");
	} else {
		if (email.length > 255) {
			errors.push("Email must be less than 255 characters");
		}
		const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		if (!emailRegex.test(email)) {
			errors.push("Invalid email format");
		}
	}

	//Password validations
	if (password.length === 0) {
		errors.push("Password cannot be empty");
	} else {
		if (password.length > 100) {
			errors.push("Password must be less than 100 characters");
		}
	}
	//If there are validation errors, return them
	if (errors.length > 0) {
		return error(res, errors, "Validation Error", 400);
	}	


  try {
    const result = await pool.query("SELECT name, email, role, password_hash FROM users WHERE email = $1", [email]);
    if (result.rowCount === 0){
		console.log("No user found with that email");
		return error(res, ["Invalid credentials"], "Login Failed", 401);
	}

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash); //Compare provided password with stored hash: Do not need to pass in salt_rounds, as the hash already contains that info
	
    if (!match) {
		console.log("Password mismatch");
		return error(res, ["Invalid credentials"], "Login Failed", 401);
	}

    // Sign JWT
	// JWT payload contains user email
    const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return success(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }, "Login successful", 200);
  } catch (err) {
    console.error(err);
    return error(res, err.message, "Server Error while attempting login", 500);
  }
});

module.exports = router;
