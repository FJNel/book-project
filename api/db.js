const { Pool } = require("pg"); // PostgreSQL client
const { logToFile } = require("./utils/logging");
const config = require("./config");
require("dotenv").config(); // Load environment variables from .env file

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || null;
const sslEnabled = process.env.DB_SSL === "true" || (process.env.NODE_ENV === "production" && process.env.DB_SSL !== "false");
const ssl = sslEnabled
	? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
	: false;

// Create a new pool instance to manage PostgreSQL connections
// A pool allows multiple clients to connect to the database efficiently
const pool = new Pool(connectionString ? {
	connectionString,
	ssl
} : {
	host: config.db.host,
	port: config.db.port,
	user: config.db.user,
	password: config.db.password,
	database: config.db.name,
	ssl
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

// Startup connectivity check (non-fatal; logs actionable error)
pool.query("SELECT 1")
	.then(() => {
		logToFile("DB_STARTUP_CHECK", { status: "SUCCESS" }, "info");
	})
	.catch((error) => {
		logToFile("DB_STARTUP_CHECK", { status: "FAILURE", error_message: error.message }, "error");
	});

// Export the pool instance for use in other parts of the application
module.exports = pool;
