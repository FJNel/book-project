// --- HARD TRAP: show who is exiting the process
const _exit = process.exit.bind(process);
process.exit = (code = 0) => {
	const err = new Error(`process.exit(${code}) called`);
	console.error(err.stack);
	_exit(code);
};

const _setExitCode = Object.getOwnPropertyDescriptor(process, "exitCode")?.set;
if (_setExitCode) {
	Object.defineProperty(process, "exitCode", {
		set(v) {
			console.error(new Error(`process.exitCode set to ${v}`).stack);
			_setExitCode.call(process, v);
		},
		get() {
			return undefined;
		},
		configurable: true,
	});
}

for (const sig of ["SIGTERM", "SIGINT", "SIGHUP", "SIGQUIT"]) {
	process.on(sig, () => {
		console.error(new Error(`Received ${sig}`).stack);
	});
}

process.on("beforeExit", (code) => {
	console.error(new Error(`beforeExit(${code})`).stack);
});
process.on("exit", (code) => {
	console.error(`exit(${code})`);
});

const cp = require("child_process");
for (const fn of ["exec", "execFile", "spawn", "fork"]) {
	const orig = cp[fn];
	if (!orig) continue;
	cp[fn] = function (...args) {
		console.error(new Error(`child_process.${fn} called`).stack);
		return orig.apply(this, args);
	};
}

require("dotenv").config();
const config = require("./config");
const { logToFile } = require("./utils/logging");
const app = require("./app");

app.use((req, res, next) => {
	req._debugStage = 'index:post-app';
	next();
});

//Server start
const PORT = config.port;
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
	logToFile("SERVER_START", {
		port: PORT,
		environment: process.env.NODE_ENV || "development"
	}, "info");
}); // app.listen
