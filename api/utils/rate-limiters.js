const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { logToFile } = require("./logging");
const { errorResponse } = require("./response");

function rateLimitHandler(req, res, _next, options) {
	logToFile("RATE_LIMIT_EXCEEDED", {
		status: "FAILURE",
		path: req.originalUrl,
		ip: req.ip,
		user_agent: req.get("user-agent"),
		limit: options.max,
		window_seconds: options.windowMs / 1000,
		user_id: req.user ? req.user.id : null
	}, "warn");

	return errorResponse(res, 429, "Too many requests", ["You have exceeded the maximum number of requests. Please try again later."]);
}

function logLimiterConfig(name, config) {
	logToFile("RATE_LIMIT_CONFIG", {
		status: "INFO",
		name,
		window_seconds: config.windowMs / 1000,
		max: config.max
	}, "info");
}

function buildLimiter(name, config) {
	const limiter = rateLimit(config);
	logLimiterConfig(name, config);
	return limiter;
}

const authenticatedLimiter = buildLimiter("authenticatedLimiter", {
	windowMs: 60 * 1000, // 1 minute window
	max: 60, // Cap: 60 requests per 1 minute per user
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : ipKeyGenerator(req))
});

const emailCostLimiter = buildLimiter("emailCostLimiter", {
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 1,
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => ipKeyGenerator(req)
});

const sensitiveActionLimiter = buildLimiter("sensitiveActionLimiter", {
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 3,
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : ipKeyGenerator(req))
});

const incorrectDateReportLimiter = buildLimiter("incorrectDateReportLimiter", {
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => ipKeyGenerator(req)
});

const adminDeletionLimiter = buildLimiter("adminDeletionLimiter", {
	windowMs: 10 * 60 * 1000, // 10 minutes
	max: 2,
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : ipKeyGenerator(req))
});

const statsLimiter = buildLimiter("statsLimiter", {
	windowMs: 60 * 1000, // 1 minute window
	max: 20, // Cap: 20 requests per 1 minute per user
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : ipKeyGenerator(req))
});

module.exports = {
	rateLimitHandler,
	authenticatedLimiter,
	emailCostLimiter,
	sensitiveActionLimiter,
	incorrectDateReportLimiter,
	adminDeletionLimiter,
	statsLimiter
};
