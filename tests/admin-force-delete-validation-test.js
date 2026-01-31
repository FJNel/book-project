/* eslint-disable no-console */
const assert = require("assert");
const { validateForceDeleteConfirmations } = require("../api/utils/admin-force-delete");

const missing = validateForceDeleteConfirmations({
	targetId: 7,
	confirmUserId: null,
	confirmEmail: "",
	confirmText: ""
});

assert(missing.errors.length >= 3, "Expected multiple validation errors for missing confirmations.");
assert(
	missing.errors.some((err) => err.toLowerCase().includes("confirmuserid")),
	"Expected confirmUserId validation error."
);
assert(
	missing.errors.some((err) => err.toLowerCase().includes("confirmtext")),
	"Expected confirmText validation error."
);

const mismatchId = validateForceDeleteConfirmations({
	targetId: 7,
	confirmUserId: 9,
	confirmEmail: "admin@example.com",
	confirmText: "DELETE"
});

assert(
	mismatchId.errors.some((err) => err.toLowerCase().includes("does not match")),
	"Expected confirmUserId mismatch error."
);

const badConfirmText = validateForceDeleteConfirmations({
	targetId: 7,
	confirmUserId: 7,
	confirmEmail: "admin@example.com",
	confirmText: "REMOVE"
});

assert(
	badConfirmText.errors.some((err) => err.toLowerCase().includes("confirmtext")),
	"Expected confirmText mismatch error."
);

console.log("✓ Forced deletion confirmation validation verified.");
