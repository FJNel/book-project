const crypto = require("crypto");

function hashApiKey(token) {
	return crypto.createHash("sha256").update(token).digest("hex");
}

function generateApiKey() {
	const token = crypto.randomBytes(32).toString("base64url");
	const prefix = token.slice(0, 8);
	return { token, prefix, hash: hashApiKey(token) };
}

module.exports = { generateApiKey, hashApiKey };
