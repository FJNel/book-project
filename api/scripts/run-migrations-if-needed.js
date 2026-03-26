#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const apiRoot = path.resolve(__dirname, "..");
const stateDir = path.join(apiRoot, ".deploy-state");
const stateFile = path.join(stateDir, "typeorm-schema-state.json");
const checkOnly = process.argv.includes("--check-only");
const relevantPaths = [
	path.join(apiRoot, "typeorm", "data-source.js"),
	path.join(apiRoot, "typeorm", "entities"),
	path.join(apiRoot, "typeorm", "migrations"),
	path.join(apiRoot, "db-connection-options.js"),
	path.join(apiRoot, "database-tables.txt"),
];

function collectFiles(targetPath) {
	if (!fs.existsSync(targetPath)) {
		return [];
	}

	const stat = fs.statSync(targetPath);
	if (stat.isFile()) {
		return [targetPath];
	}

	return fs.readdirSync(targetPath)
		.sort((left, right) => left.localeCompare(right))
		.flatMap((entry) => collectFiles(path.join(targetPath, entry)));
}

function buildFingerprint(files) {
	const hash = crypto.createHash("sha256");

	for (const filePath of files) {
		const relativePath = path.relative(apiRoot, filePath).split(path.sep).join("/");
		hash.update(relativePath);
		hash.update("\0");
		hash.update(fs.readFileSync(filePath));
		hash.update("\0");
	}

	return hash.digest("hex");
}

function readState() {
	if (!fs.existsSync(stateFile)) {
		return null;
	}

	try {
		return JSON.parse(fs.readFileSync(stateFile, "utf8"));
	} catch (_) {
		return null;
	}
}

function writeState(payload) {
	fs.mkdirSync(stateDir, { recursive: true });
	fs.writeFileSync(stateFile, JSON.stringify(payload, null, 2));
}

async function main() {
	const files = relevantPaths.flatMap((targetPath) => collectFiles(targetPath));
	const fingerprint = buildFingerprint(files);
	const previousState = readState();

	console.log(`[db-deploy] TypeORM fingerprint: ${fingerprint}`);
	if (previousState?.fingerprint === fingerprint) {
		console.log("[db-deploy] No TypeORM-relevant file changes detected. Skipping migration run.");
		return;
	}

	console.log("[db-deploy] Relevant database files changed.");
	if (checkOnly) {
		console.log("[db-deploy] Check-only mode enabled. Migration execution skipped.");
		return;
	}

	const dataSourceModule = require("../typeorm/data-source");
	const dataSource = dataSourceModule.appDataSource || dataSourceModule;

	try {
		await dataSource.initialize();
		const hasPendingMigrations = await dataSource.showMigrations();

		if (hasPendingMigrations) {
			console.log("[db-deploy] Pending migrations detected. Applying now.");
			const executed = await dataSource.runMigrations({ transaction: "all" });
			console.log(`[db-deploy] Applied ${executed.length} migration(s): ${executed.map((entry) => entry.name).join(", ")}`);
		} else {
			console.log("[db-deploy] No pending migrations found.");
		}

		writeState({
			fingerprint,
			updatedAt: new Date().toISOString(),
			files: files.map((filePath) => path.relative(apiRoot, filePath).split(path.sep).join("/")),
		});
		console.log("[db-deploy] Fingerprint state updated.");
	} catch (error) {
		console.error("[db-deploy] Migration step failed.");
		console.error(error && error.stack ? error.stack : error);
		process.exitCode = 1;
	} finally {
		if (dataSource.isInitialized) {
			await dataSource.destroy();
		}
	}
}

main().catch((error) => {
	console.error("[db-deploy] Unexpected failure.");
	console.error(error && error.stack ? error.stack : error);
	process.exit(1);
});
