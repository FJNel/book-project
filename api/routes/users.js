// Launch express router
const express = require("express");
const router = express.Router();
const pool = require("../db"); // Import the database connection pool

// GET all users
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role, created_at FROM users");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Export the router to be used in index.js
module.exports = router;
