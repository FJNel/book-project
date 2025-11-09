const express = require("express");
const router = express.Router();

const { requiresAuth, requireRole } = require("../utils/jwt");
const { authenticatedLimiter } = require("../utils/rate-limiters");
const { logToFile } = require("../utils/logging");
const { errorResponse } = require("../utils/response");

// Middleware to ensure the user is an authenticated admin
const adminAuth = [requiresAuth, authenticatedLimiter, requireRole(["admin"])];

/**
 * A reusable handler for endpoints that are not yet implemented.
 * Returns a 300 status code as requested.
 */
const notImplemented = (req, res) => {
	const message = "This admin endpoint is not yet implemented.";
	logToFile("ADMIN_ENDPOINT", {
		status: "INFO",
		user_id: req.user?.id || null,
		ip: req.ip,
		user_agent: req.get("user-agent"),
		path: req.originalUrl,
		method: req.method,
		reason: message,
	}, "info");
	return errorResponse(res, 300, message, [message]);
}; // notImplemented

// `GET /admin/users/` - List all users (admin only, with pagination and filtering) and their appropriate information
router.get("/users", adminAuth, notImplemented); // router.get("/users")

// `POST /admin/users/` - Create a new user (admin only)
router.post("/users", adminAuth, notImplemented); // router.post("/users")

// `GET /admin/users/:id` - Get a specific user profile by ID (admin only)
router.get("/users/:id", adminAuth, notImplemented); // router.get("/users/:id")

// `PUT /admin/users/:id` - Update a specific user’s profile by ID (including role and email, admin only)
router.put("/users/:id", adminAuth, notImplemented); // router.put("/users/:id")

// `DELETE /admin/users/:id` - Permanently delete a user by ID (hard delete, admin only)
router.delete("/users/:id", adminAuth, notImplemented); // router.delete("/users/:id")

// `POST /admin/users/:id/disable` - Disable a user profile by ID (admin only)
router.post("/users/:id/disable", adminAuth, notImplemented); // router.post("/users/:id/disable")

// `POST /admin/users/:id/enable` - Re-enable a disabled user profile by ID (admin only)
router.post("/users/:id/enable", adminAuth, notImplemented); // router.post("/users/:id/enable")

// `POST /admin/users/:id/unverify` - Mark a user’s email as unverified by ID (admin only)
router.post("/users/:id/unverify", adminAuth, notImplemented); // router.post("/users/:id/unverify")

// `POST /admin/users/:id/verify` - Mark a user’s email as verified by ID (bypassing verification, admin only)
router.post("/users/:id/verify", adminAuth, notImplemented); // router.post("/users/:id/verify")

// `POST /admin/users/:id/send-verification` - Resend email verification for a user (admin only)
router.post("/users/:id/send-verification", adminAuth, notImplemented); // router.post("/users/:id/send-verification")

// `POST /admin/users/:id/reset-password` - Trigger a password reset for a user by ID (admin only)
router.post("/users/:id/reset-password", adminAuth, notImplemented); // router.post("/users/:id/reset-password")

// `POST /admin/users/:id/force-logout` - Force logout a user (invalidate all sessions, admin only)
router.post("/users/:id/force-logout", adminAuth, notImplemented); // router.post("/users/:id/force-logout")

// `POST /admin/users/:id/handle-account-deletion` - Permanently delete a user and all associated data after review (admin only)
router.post("/users/:id/handle-account-deletion", adminAuth, notImplemented); // router.post("/users/:id/handle-account-deletion")


module.exports = router;
