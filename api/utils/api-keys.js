const crypto = require("crypto");
const { logToFile } = require("./logging");

function hashApiKey(token) {
	const hash = crypto.createHash("sha256").update(token).digest("hex");
	logToFile("API_KEY_HASHED", { status: "SUCCESS" }, "info");
	return hash;
}

function generateApiKey() {
	const token = crypto.randomBytes(32).toString("base64url");
	const prefix = token.slice(0, 8);
	const hash = hashApiKey(token);
	logToFile("API_KEY_GENERATED", { status: "SUCCESS", prefix }, "info");
	return { token, prefix, hash };
}

module.exports = { generateApiKey, hashApiKey };
