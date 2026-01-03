const { logToFile } = require("./logging");

function normalizeTagName(value) {
	if (typeof value !== "string") {
		logToFile("TAG_NORMALIZE", { status: "FAILURE", reason: "NOT_STRING" }, "warn");
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		logToFile("TAG_NORMALIZE", { status: "FAILURE", reason: "EMPTY" }, "warn");
		return null;
	}
	const basic = trimmed
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
	const normalized = basic
		.replace(/[_/]+/g, " ")
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!normalized) {
		logToFile("TAG_NORMALIZE", { status: "FAILURE", reason: "NORMALIZED_EMPTY" }, "warn");
		return null;
	}
	logToFile("TAG_NORMALIZE", { status: "SUCCESS", value: normalized }, "info");
	return normalized;
}

function buildTagDisplayName(value) {
	if (typeof value !== "string") {
		logToFile("TAG_DISPLAY_NAME", { status: "FAILURE", reason: "NOT_STRING" }, "warn");
		return null;
	}
	const trimmed = value.trim().replace(/\s+/g, " ");
	if (!trimmed) {
		logToFile("TAG_DISPLAY_NAME", { status: "FAILURE", reason: "EMPTY" }, "warn");
		return null;
	}
	logToFile("TAG_DISPLAY_NAME", { status: "SUCCESS", value: trimmed }, "info");
	return trimmed;
}

module.exports = {
	normalizeTagName,
	buildTagDisplayName
};
