const { Pool } = require("pg"); // PostgreSQL client
const { logToFile } = require("./utils/logging");
require("dotenv").config();		// Load environment variables from .env file

// Create a new pool instance to manage PostgreSQL connections
// A pool allows multiple clients to connect to the database efficiently
const pool = new Pool({
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
});

let hasLoggedConnect = false;
pool.on("connect", (client) => {
	if (hasLoggedConnect) return;
	hasLoggedConnect = true;
	logToFile("DB_POOL_CONNECTED", {
		host: process.env.DB_HOST || null,
		port: process.env.DB_PORT ? Number(process.env.DB_PORT) : null,
		database: process.env.DB_NAME || null
	}, "info");
});

pool.on("error", (err) => {
	logToFile("DB_POOL_ERROR", { error_message: err.message }, "error");
});

// Export the pool instance for use in other parts of the application
module.exports = pool;
