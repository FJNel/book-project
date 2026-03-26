const { Pool } = require("pg"); // PostgreSQL client
const { logToFile } = require("./utils/logging");
const { buildPgPoolOptions, getResolvedDatabaseConfig } = require("./db-connection-options");

const resolvedConfig = getResolvedDatabaseConfig();
const effectiveSslMode = resolvedConfig.sslMode;

// Create a new pool instance to manage PostgreSQL connections
// A pool allows multiple clients to connect to the database efficiently
const pool = new Pool(buildPgPoolOptions());
pool.sslMode = effectiveSslMode;

let hasLoggedConnect = false;
pool.on("connect", () => {
	if (hasLoggedConnect) return;
	hasLoggedConnect = true;
	logToFile("DB_POOL_CONNECTED", {
		host: resolvedConfig.host || null,
		port: resolvedConfig.port || null,
		database: resolvedConfig.database || null,
		ssl_mode: effectiveSslMode
	}, "info");
});

pool.on("error", (err) => {
	logToFile("DB_POOL_ERROR", { error_message: err.message }, "error");
});

// Startup connectivity check (non-fatal; logs actionable error)
pool.query("SELECT 1")
	.then(() => {
		logToFile("DB_STARTUP_CHECK", { status: "SUCCESS", ssl_mode: effectiveSslMode }, "info");
	})
	.catch((error) => {
		logToFile("DB_STARTUP_CHECK", {
			status: "FAILURE",
			error_message: error.message,
			ssl_mode: effectiveSslMode
		}, "error");
	});

// Export the pool instance for use in other parts of the application
module.exports = pool;
