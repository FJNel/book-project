const express = require("express");
const router = express.Router();

const { requiresAuth, requireRole } = require("../utils/jwt");

// Middleware to ensure the user is an authenticated admin
const adminAuth = [requiresAuth, requireRole(["admin"])];

/**
 * A reusable handler for endpoints that are not yet implemented.
 * Returns a 300 status code as requested.
 */
const notImplemented = (req, res) => {
    return res.status(300).json({
        status: "redirect",
        httpCode: 300,
        message: "NOT_YET_IMPLEMENTED",
        data: {
            endpoint: `${req.method} ${req.originalUrl}`
        },
        errors: ["This admin endpoint is not yet implemented."]
    });
};

// `GET /admin/users/` - List all users (admin only, with pagination and filtering)
router.get("/users", adminAuth, notImplemented);

// `POST /admin/users/` - Create a new user (admin only)
router.post("/users", adminAuth, notImplemented);

// `GET /admin/users/:id` - Get a specific user profile by ID (admin only)
router.get("/users/:id", adminAuth, notImplemented);

// `PUT /admin/users/:id` - Update a specific user’s profile by ID (including role and email, admin only)
router.put("/users/:id", adminAuth, notImplemented);

// `DELETE /admin/users/:id` - Permanently delete a user by ID (hard delete, admin only)
router.delete("/users/:id", adminAuth, notImplemented);

// `POST /admin/users/:id/disable` - Disable a user profile by ID (admin only)
router.post("/users/:id/disable", adminAuth, notImplemented);

// `POST /admin/users/:id/enable` - Re-enable a disabled user profile by ID (admin only)
router.post("/users/:id/enable", adminAuth, notImplemented);

// `POST /admin/users/:id/unverify` - Mark a user’s email as unverified by ID (admin only)
router.post("/users/:id/unverify", adminAuth, notImplemented);

// `POST /admin/users/:id/verify` - Mark a user’s email as verified by ID (bypassing verification, admin only)
router.post("/users/:id/verify", adminAuth, notImplemented);

// `POST /admin/users/:id/send-verification` - Resend email verification for a user (admin only)
router.post("/users/:id/send-verification", adminAuth, notImplemented);

// `POST /admin/users/:id/reset-password` - Trigger a password reset for a user by ID (admin only)
router.post("/users/:id/reset-password", adminAuth, notImplemented);

// `POST /admin/users/:id/force-logout` - Force logout a user (invalidate all sessions, admin only)
router.post("/users/:id/force-logout", adminAuth, notImplemented);


module.exports = router;
