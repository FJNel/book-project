require("dotenv").config();

const config = require("./config");
const { logToFile } = require("./utils/logging");

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || null;
const sslModeEnv = process.env.DB_SSL_MODE || "";
const sslMode = String(sslModeEnv).trim().toLowerCase();
const sslCa = process.env.DB_SSL_CA || "";

function parseConnectionString() {
	if (!connectionString) {
		return null;
	}

	try {
		return new URL(connectionString);
	} catch (_) {
		return null;
	}
}

function isLocalHost(host) {
	if (!host) return false;

	const normalized = String(host).trim().toLowerCase();
	return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function buildPgSslConfig(mode, host) {
	const explicitMode = Boolean(mode);
	if (!explicitMode && isLocalHost(host)) {
		return { ssl: false, sslMode: "disable" };
	}

	const effectiveMode = explicitMode ? mode : "require";
	if (effectiveMode === "disable") {
		return { ssl: false, sslMode: "disable" };
	}

	if (effectiveMode === "allow-self-signed") {
		return { ssl: { rejectUnauthorized: false }, sslMode: "allow-self-signed" };
	}

	if (effectiveMode === "verify-ca" || effectiveMode === "verify-full") {
		const ca = sslCa.trim();
		if (!ca) {
			logToFile("DB_SSL_CONFIG", { status: "WARN", reason: "MISSING_CA", ssl_mode: effectiveMode }, "warn");
			return { ssl: { rejectUnauthorized: true }, sslMode: "require" };
		}

		return { ssl: { rejectUnauthorized: true, ca }, sslMode: effectiveMode };
	}

	return { ssl: { rejectUnauthorized: true }, sslMode: "require" };
}

function getResolvedDatabaseConfig() {
	const parsedConnectionString = parseConnectionString();
	const resolvedHost = parsedConnectionString?.hostname || config.db.host || null;
	const resolvedPort = parsedConnectionString?.port ? Number(parsedConnectionString.port) : config.db.port;
	const resolvedDatabase = parsedConnectionString?.pathname
		? decodeURIComponent(parsedConnectionString.pathname.replace(/^\/+/, "")) || config.db.name
		: config.db.name;
	const resolvedUser = parsedConnectionString?.username
		? decodeURIComponent(parsedConnectionString.username)
		: config.db.user;
	const sslConfig = buildPgSslConfig(sslMode, resolvedHost);

	return {
		connectionString,
		host: resolvedHost,
		port: resolvedPort,
		user: resolvedUser,
		password: config.db.password,
		database: resolvedDatabase,
		ssl: sslConfig.ssl,
		sslMode: sslConfig.sslMode,
	};
}

function buildPgPoolOptions() {
	const resolved = getResolvedDatabaseConfig();

	if (resolved.connectionString) {
		return {
			connectionString: resolved.connectionString,
			ssl: resolved.ssl,
		};
	}

	return {
		host: resolved.host,
		port: resolved.port,
		user: resolved.user,
		password: resolved.password,
		database: resolved.database,
		ssl: resolved.ssl,
	};
}

function buildTypeOrmDataSourceOptions(extraOptions = {}) {
	const resolved = getResolvedDatabaseConfig();
	const baseOptions = resolved.connectionString
		? {
			type: "postgres",
			url: resolved.connectionString,
			ssl: resolved.ssl,
		}
		: {
			type: "postgres",
			host: resolved.host,
			port: resolved.port,
			username: resolved.user,
			password: resolved.password,
			database: resolved.database,
			ssl: resolved.ssl,
		};

	return {
		...baseOptions,
		synchronize: false,
		migrationsRun: false,
		logging: false,
		...extraOptions,
	};
}

module.exports = {
	buildPgPoolOptions,
	buildTypeOrmDataSourceOptions,
	getResolvedDatabaseConfig,
};
