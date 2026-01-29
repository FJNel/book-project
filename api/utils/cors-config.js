const config = require("../config");

const DEFAULT_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
const DEFAULT_HEADERS = ["Content-Type", "Authorization"];

function normalizeArray(value, fallback) {
	if (Array.isArray(value)) {
		const filtered = value.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
		return filtered.length > 0 ? filtered : fallback;
	}
	return fallback;
}

const rawCors = (config && config.cors) || {};
const allowedOrigins = normalizeArray(rawCors.allowedOrigins, []);
const allowAll = allowedOrigins.includes("*");
const methods = normalizeArray(rawCors.methods, DEFAULT_METHODS);
const allowedHeaders = normalizeArray(rawCors.allowedHeaders, DEFAULT_HEADERS);
const credentials = rawCors.credentials !== false;
const optionsSuccessStatus = Number.isFinite(rawCors.optionsSuccessStatus)
	? rawCors.optionsSuccessStatus
	: 204;

function isOriginAllowed(origin) {
	if (!origin) return true;
	if (allowAll) return true;
	return allowedOrigins.includes(origin);
}

const corsOptions = {
	origin: (origin, callback) => {
		try {
			if (!origin) return callback(null, true);
			if (isOriginAllowed(origin)) return callback(null, origin);
			return callback(null, false);
		} catch (error) {
			return callback(null, false);
		}
	},
	credentials,
	methods,
	allowedHeaders,
	optionsSuccessStatus,
};

function applyCorsHeaders(req, res) {
	const origin = req.get("origin");
	if (origin && isOriginAllowed(origin)) {
		const headerValue = allowAll && !credentials ? "*" : origin;
		res.setHeader("Access-Control-Allow-Origin", headerValue);
	}
	res.setHeader("Vary", "Origin");
	if (credentials) {
		res.setHeader("Access-Control-Allow-Credentials", "true");
	}
	if (methods && methods.length > 0) {
		res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
	}
	if (allowedHeaders && allowedHeaders.length > 0) {
		res.setHeader("Access-Control-Allow-Headers", allowedHeaders.join(", "));
	}
	return res;
}

module.exports = {
	corsOptions,
	applyCorsHeaders,
};
