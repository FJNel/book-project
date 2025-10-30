const path = require("path");

// Load translations once; defaults to English bundle.
const translations = require(path.join("..", "en.json"));

function t(key) {
	if (key === null || key === undefined) {
		return "";
	}
	if (Array.isArray(key)) {
		return key.map((item) => t(item));
	}
	if (typeof key !== "string") {
		return key;
	}
	const trimmed = key.trim();
	if (!trimmed) {
		return "";
	}
	return Object.prototype.hasOwnProperty.call(translations, trimmed) ? translations[trimmed] : trimmed;
}

module.exports = { t, translations };