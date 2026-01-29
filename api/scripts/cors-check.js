process.env.HEALTHCHECK_SKIP_DB = "true";

const http = require("http");
const app = require("../app");
const config = require("../config");

const originCandidates = Array.isArray(config?.cors?.allowedOrigins)
	? config.cors.allowedOrigins.filter((origin) => origin && origin !== "*")
	: [];
const testOrigin = originCandidates[0] || "http://localhost:8000";

function makeRequest({ method, path, headers }) {
	return new Promise((resolve, reject) => {
		const server = http.createServer(app);
		server.listen(0, () => {
			const address = server.address();
			const options = {
				method,
				host: "127.0.0.1",
				port: address.port,
				path,
				headers
			};
			const req = http.request(options, (res) => {
				const chunks = [];
				res.on("data", (chunk) => chunks.push(chunk));
				res.on("end", () => {
					server.close(() => {
						resolve({
							status: res.statusCode,
							headers: res.headers,
							body: Buffer.concat(chunks).toString("utf8")
						});
					});
				});
			});
			req.on("error", (err) => {
				server.close(() => reject(err));
			});
			req.end();
		});
	});
}

async function runChecks() {
	const healthResponse = await makeRequest({
		method: "GET",
		path: "/health",
		headers: {
			Origin: testOrigin
		}
	});
	if (!healthResponse.headers["access-control-allow-origin"]) {
		throw new Error("Missing CORS header on /health response.");
	}

	const optionsResponse = await makeRequest({
		method: "OPTIONS",
		path: "/book",
		headers: {
			Origin: testOrigin,
			"Access-Control-Request-Method": "GET"
		}
	});
	if (![200, 204].includes(optionsResponse.status)) {
		throw new Error(`Unexpected OPTIONS status: ${optionsResponse.status}`);
	}
	if (!optionsResponse.headers["access-control-allow-origin"]) {
		throw new Error("Missing CORS header on OPTIONS response.");
	}

	const missingResponse = await makeRequest({
		method: "GET",
		path: "/does-not-exist",
		headers: {
			Origin: testOrigin
		}
	});
	if (!missingResponse.headers["access-control-allow-origin"]) {
		throw new Error("Missing CORS header on 404 response.");
	}
}

runChecks()
	.then(() => {
		console.log("CORS checks passed.");
		process.exit(0);
	})
	.catch((error) => {
		console.error("CORS checks failed:", error.message);
		process.exit(1);
	});
