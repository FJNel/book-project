const rateLimit = require("express-rate-limit");
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
	max: 240, // generous cap: 4 requests/sec sustained
	standardHeaders: true,
	legacyHeaders: false,
	handler: rateLimitHandler,
	keyGenerator: (req) => (req.user && req.user.id ? req.user.id : req.ip)
});

module.exports = {
	rateLimitHandler,
	authenticatedLimiter
};
