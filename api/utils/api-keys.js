const crypto = require("crypto");
const { logToFile } = require("./logging");

function toBase64Url(buffer) {
	return buffer
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function hashApiKey(token) {
	const hash = crypto.createHash("sha256").update(token).digest("hex");
	logToFile("API_KEY_HASHED", { status: "SUCCESS" }, "info");
	return hash;
}

function generateApiKey() {
	const raw = crypto.randomBytes(32);
	let token;
	try {
		token = raw.toString("base64url");
	} catch (error) {
		token = toBase64Url(raw);
		logToFile("API_KEY_BASE64URL_FALLBACK", { status: "USED", reason: error.message }, "warn");
	}
	const prefix = token.slice(0, 8);
	const hash = hashApiKey(token);
	logToFile("API_KEY_GENERATED", { status: "SUCCESS", prefix }, "info");
	return { token, prefix, hash };
}

module.exports = { generateApiKey, hashApiKey };
