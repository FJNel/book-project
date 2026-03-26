#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

const command = process.argv[2];
const extraArgs = process.argv.slice(3);
const cliPath = require.resolve("typeorm/cli");
const apiRoot = path.resolve(__dirname, "..");
const dataSourcePath = path.join(apiRoot, "typeorm", "data-source.js");
const dataSourceCommands = new Set([
	"migration:run",
	"migration:revert",
	"migration:show",
	"migration:generate",
]);

if (!command) {
	console.error("Missing TypeORM command. Example: node ./scripts/typeorm-cli.js migration:run");
	process.exit(1);
}

const args = [cliPath, command, ...extraArgs];
if (dataSourceCommands.has(command)) {
	args.push("-d", dataSourcePath);
}

const result = spawnSync(process.execPath, args, {
	cwd: apiRoot,
	stdio: "inherit",
});

if (result.error) {
	console.error(result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 1);
