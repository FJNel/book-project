#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
	console.log("Usage: npm run db:create -- <migration-name>");
	process.exit(0);
}

function getMigrationName() {
	const rawName = process.argv[2] || process.env.npm_config_name || "";
	const normalized = String(rawName).trim().toLowerCase().replace(/\s+/g, "-");
	if (!normalized) return null;
	if (!/^[a-z0-9_-]+$/.test(normalized)) return null;
	return normalized;
}

const name = getMigrationName();
if (!name) {
	console.error("Provide a migration name: npm run db:create -- add-book-status");
	process.exit(1);
}

const apiRoot = path.resolve(__dirname, "..");
const cliPath = require.resolve("typeorm/cli");
const migrationPath = path.join("typeorm", "migrations", name);
const result = spawnSync(
	process.execPath,
	[cliPath, "migration:create", migrationPath, "-o"],
	{ cwd: apiRoot, stdio: "inherit" }
);

if (result.error) {
	console.error(result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 1);
