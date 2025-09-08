const express = require("express");
const router = express.Router();
const pool = require("../db");
const { success, error } = require("../utils/response");
const { requireAuth, requireRole } = require("../utils/jwt");
const {	validateName, validateEmail } = require("../utils/validators");

// Get all approved users (admin only)
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
	try {
		const result = await pool.query("SELECT * FROM approved_users ORDER BY name ASC");
		return success(res, { approvedUsers: result.rows });
	} catch (err) {
		console.error(err);
		return error(res, err.message, "Server Error while fetching approved users", 500);
	}
});

//Get a single approved user by ID (admin only)
router.get("/:id", requireAuth, requireRole("admin"), async (req, res) => {
	const { id } = req.params;
	try {
		const result = await pool.query("SELECT * FROM approved_users WHERE id = $1", [id]);
		if (result.rowCount === 0) {
			return error(res, ["Approved user not found"], "Not Found", 404);
		}
		return success(res, { approvedUser: result.rows[0] });
	} catch (err) {
		console.error(err);
		return error(res, err.message, "Server Error while fetching approved user", 500);
	}
});

// Add a new approved user (admin only)
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
	const { name, email } = req.body;
	email = email ? email.toLowerCase().trim() : "";
	name = name ? name.trim() : "";
	let errors = [validateName(name), ...validateEmail(email)];
	if (errors.length > 0) {
		return error(res, errors, "Validation Error", 400);
	}
	try {
		// Check if user already exists
		const existing = await pool.query("SELECT * FROM approved_users WHERE email = $1", [email]);
		if (existing.rowCount > 0) {
			return error(res, ["Email is already owned by an approved user"], "Conflict", 409);
		}

		// Insert new approved user		
		const result = await pool.query(
			"INSERT INTO approved_users (name, email) VALUES ($1, $2) RETURNING *",
			[name, email]
		);
		return success(res, { approvedUser: result.rows[0] }, "Approved user added", 201);
	} catch (err) {
		console.error(err);
		return error(res, err.message, "Server Error while adding approved user", 500);
	}
});

//Edit an approved user by ID (admin only)
router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
	const { id } = req.params;
	let { name, email } = req.body;
	email = email ? email.toLowerCase().trim() : "";
	name = name ? name.trim() : "";
	let errors = [validateName(name), ...validateEmail(email)];
	if (errors.length > 0) {
		return error(res, errors, "Validation Error", 400);
	}
	try {
		// Check if user exists
		const existing = await pool.query("SELECT * FROM approved_users WHERE id = $1", [id]);
		if (existing.rowCount === 0) {
			return error(res, ["Approved user not found"], "Not Found", 404);
		}

		// Check if new email is already owned by another approved user
		const emailCheck = await pool.query("SELECT * FROM approved_users WHERE email = $1 AND id != $2", [email, id]);
		if (emailCheck.rowCount > 0) {
			return error(res, ["New email is already owned by another approved user"], "Conflict", 409);
		}

		// Update approved user
		const result = await pool.query(
			"UPDATE approved_users SET name = $1, email = $2 WHERE id = $3 RETURNING *",
			[name, email, id]
		);
		return success(res, { approvedUser: result.rows[0] }, "Approved user updated", 200);
	} catch (err) {
		console.error(err);
		return error(res, err.message, "Server Error while updating approved user", 500);
	}
});

// Delete an approved user by ID (admin only)
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
	const { id } = req.params;
	try {
		const result = await pool.query("DELETE FROM approved_users WHERE id = $1 RETURNING *", [id]);
		if (result.rowCount === 0) {
			return error(res, ["Approved user not found"], "Not Found", 404);
		}
		return success(res, {}, "Approved user deleted", 200);
	} catch (err) {
		console.error(err);
		return error(res, err.message, "Server Error while deleting approved user", 500);
	}
});

module.exports = router;