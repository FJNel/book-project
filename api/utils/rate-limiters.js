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

const authenticatedLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute window
	max: 60, // Cap: 60 requests per 1 minute per user
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : ipKeyGenerator(req))
});

const emailCostLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 1,
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => ipKeyGenerator(req)
});

const sensitiveActionLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 3,
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => (req.user && req.user.id ? `user:${req.user.id}` : ipKeyGenerator(req))
});

const incorrectDateReportLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => ipKeyGenerator(req)
});

module.exports = {
	rateLimitHandler,
	authenticatedLimiter,
	emailCostLimiter,
	sensitiveActionLimiter,
	incorrectDateReportLimiter
};
