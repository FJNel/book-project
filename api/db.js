const { Pool } = require("pg"); // PostgreSQL client
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

// Export the pool instance for use in other parts of the application
module.exports = pool;
