// Launch express router
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;
const { success, error } = require("../utils/response");
const {
  validateName,
  validateEmail,
  validatePassword,
  validatePhone,
  validateRole
    } = require("../utils/validators");
const {requireAuth, requireRole} = require("../utils/jwt");
const crypto = require("crypto");

//GET ME ENDPOINT
router.get("/me", requireAuth, async (req, res) => {
	try {
		const {id} = req.user;
		const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
		if (result.rowCount === 0) {
			return error(res, ["User not found"], "Not Found", 404);
		}
		const user = result.rows[0];
		delete user.password_hash; // Remove sensitive info
		return success(res, user, "User profile fetched successfully", 200);
	} catch (err) {
		console.error(err);
		return error(res, err.message, "Server Error while fetching user profile", 500);
	}
});

//EDIT ME ENDPOINT
router.put("/me", requireAuth, async (req, res) => {
  const { id } = req.user;
  let { name, email, phone, currentPassword, password, role } = req.body;
  let errors = [];

  // Validate fields if provided
  if (name) {
    name = name.trim();
    errors.push(...validateName(name));
  }
  if (email) {
    email = email.toLowerCase().trim();
    errors.push(...validateEmail(email));
  }
  if (phone) {
    phone = phone.trim();
    errors.push(...validatePhone(phone));
  }
  if (role) {
    return error(res, ["Role cannot be changed"], "Forbidden", 403);
  }

  errors = errors.filter(Boolean);
  if (errors.length > 0) {
    return error(res, errors, "Validation Error", 400);
  }
  errors = [];

  // Password change logic
  let hashedPassword;
  if (password !== undefined) {
    // Must provide current password
    if (!currentPassword) {
      errors.push("Current password is required to change password.");
    } else {
      errors.push(...validatePassword(password));
      // Check current password
      try {
        const userRes = await pool.query("SELECT password_hash FROM users WHERE id = $1", [id]);
        if (userRes.rowCount === 0) {
          errors.push("User not found.");
        } else {
          const match = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
          if (!match) errors.push("Current password is incorrect.");
        }
      } catch (err) {
        console.error(err);
        return error(res, [err.message], "Server Error while verifying current password", 500);
      }
    }
  }

  errors = errors.filter(Boolean);
  if (errors.length > 0) {
    return error(res, errors, "Password Verification Error", 400);
  }  

  // Build update query
  const updatedFields = {};
  if (name) updatedFields.name = name;
  if (email) updatedFields.email = email;
  if (phone) updatedFields.phone = phone;
  if (password !== undefined) {
    hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    updatedFields.password_hash = hashedPassword;
  }

  // If nothing to update, return error
  if (Object.keys(updatedFields).length === 0) {
    return error(res, ["No fields to update"], "Bad Request", 400);
  }

  // Transaction: update user and invalidate tokens if password changed
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const setClause = Object.keys(updatedFields)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(", ");
    const values = [...Object.values(updatedFields), id];
    const result = await client.query(
      `UPDATE users SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (password !== undefined) {
      await client.query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1", [id]);
    }
    await client.query("COMMIT");
    const user = result.rows[0];
    delete user.password_hash;
    return success(res, user, "User profile updated successfully", 200);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return error(res, [err.message], "Server Error while updating user profile", 500);
  } finally {
    client.release();
  }
});

//DELETE ME ENDPOINT
router.delete("/me", requireAuth, async (req, res) => {
  return error(res, ["Self-deletion of user accounts is not allowed"], "Forbidden", 403);
});

//ADD USER (admin)
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  let { name, email, password, phone, role } = req.body;
  email = email ? email.toLowerCase().trim() : "";
  name = name ? name.trim() : "";
  phone = phone ? phone.trim() : "";
  role = role ? role.trim() : "user";
  let errors = [
    ...validateName(name),
    ...validateEmail(email),
    ...validatePassword(password),
    ...validatePhone(phone),
    ...validateRole(role)
  ].filter(Boolean);

  // Check if email already exists
  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount > 0) {
      errors.push("Email already registered. Please use a different email.");
    }
  } catch (err) {
    console.error(err);
    return error(res, [err.message], "Server Error while checking email", 500);
  }

  if (errors.length > 0) {
    return error(res, errors, "Validation Error", 400);
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, created_at",
      [name, email, phone, hashedPassword, role]
    );
    return success(res, result.rows[0], "User added successfully", 201);
  } catch (err) {
    console.error(err);
    return error(res, [err.message], "Server Error while adding user", 500);
  }
});

//EDIT USER (admin)
router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  let { name, email, phone, password, role } = req.body;
  let errors = [];

  if (name !== undefined) {
    name = name ? name.trim() : "";
    errors.push(...validateName(name));
  }
  if (email !== undefined) {
    email = email ? email.toLowerCase().trim() : "";
    errors.push(...validateEmail(email));
  }
  if (phone !== undefined) {
    phone = phone.trim();
    errors.push(...validatePhone(phone));
  }
  if (role !== undefined) {
    role = role.trim();
    errors.push(...validateRole(role));
  }
  let hashedPassword;
  if (password !== undefined) {
    errors.push(...validatePassword(password));
    hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  }

  errors = errors.filter(Boolean);
  if (errors.length > 0) {
    return error(res, errors, "Validation Error", 400);
  }

  // Build update query
  const updatedFields = {};
  if (name !== undefined) updatedFields.name = name;
  if (email !== undefined) updatedFields.email = email;
  if (phone !== undefined) updatedFields.phone = phone;
  if (role !== undefined) updatedFields.role = role;
  if (password !== undefined) updatedFields.password_hash = hashedPassword;

  if (Object.keys(updatedFields).length === 0) {
    return error(res, ["No fields to update"], "Bad Request", 400);
  }

  // Transaction: update user and invalidate tokens if password changed
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const setClause = Object.keys(updatedFields)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(", ");
    const values = [...Object.values(updatedFields), id];
    const result = await client.query(
      `UPDATE users SET ${setClause} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (password !== undefined) {
      await client.query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1", [id]);
    }
    await client.query("COMMIT");
    const user = result.rows[0];
    delete user.password_hash;
    return success(res, user, "User updated successfully", 200);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return error(res, [err.message], "Server Error while updating user", 500);
  } finally {
    client.release();
  }
});

//DELETE USER (admin)
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || typeof name !== "string") {
    return error(res, ["Name must be provided for deletion"], "Validation Error", 400);
  }
  try {
    const userRes = await pool.query("SELECT name FROM users WHERE id = $1", [id]);
    if (userRes.rowCount === 0) {
      return error(res, ["User not found"], "Not Found", 404);
    }
    if (userRes.rows[0].name.trim() !== name.trim()) {
      return error(res, ["Provided name does not match user"], "Forbidden", 403);
    }
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    await pool.query("UPDATE refresh_tokens SET revoked = true WHERE user_id = $1", [id]);
    return success(res, {}, "User deleted successfully", 200);
  } catch (err) {
    console.error(err);
    return error(res, [err.message], "Server Error while deleting user", 500);
  }
});

//GET ALL USERS (admin only)
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY id ASC");
    //Remove password hash
    result.rows.forEach(user => delete user.password_hash);

    return success(res, result.rows, "User list fetched successfully", 200);
  } catch (err) {
    console.error(err);
    return error(res, err.message, "Server Error while fetching user list", 500);
  }
});

// Export the router to be used in index.js
module.exports = router;
