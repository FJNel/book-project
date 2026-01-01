function normalizeTagName(value) {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const basic = trimmed
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
	const normalized = basic
		.replace(/[_/]+/g, " ")
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return normalized || null;
}

function buildTagDisplayName(value) {
	if (typeof value !== "string") return null;
	const trimmed = value.trim().replace(/\s+/g, " ");
	return trimmed || null;
}

module.exports = {
	normalizeTagName,
	buildTagDisplayName
};
