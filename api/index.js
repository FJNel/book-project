// --- HARD TRAP: show who is exiting the process
const _exit = process.exit.bind(process);
process.exit = (code = 0) => {
	const err = new Error(`process.exit(${code}) called`);
	console.error(err.stack);
	_exit(code);
};

const exitCodeDescriptor = Object.getOwnPropertyDescriptor(process, "exitCode");
const _setExitCode = exitCodeDescriptor?.set;
if (_setExitCode && exitCodeDescriptor?.configurable) {
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

// ===================== ACTIVE_HANDLES_DEBUG =====================
(() => {
	try {
		const net = require("net");
		const http = require("http");

		// Trap server.close() calls (net.Server + http.Server)
		const trapClose = (Proto, label) => {
			if (!Proto || !Proto.close || Proto.close.__trapped) return;
			const orig = Proto.close;
			function wrappedClose(...args) {
				console.error(new Error(`[TRAP] ${label}.close() called`).stack);
				return orig.apply(this, args);
			}
			wrappedClose.__trapped = true;
			Proto.close = wrappedClose;
		};

		trapClose(net.Server && net.Server.prototype, "net.Server");
		trapClose(http.Server && http.Server.prototype, "http.Server");

		// Dump active handles/requests right before exit
		const dump = (tag) => {
			try {
				const handles = process._getActiveHandles ? process._getActiveHandles() : [];
				const requests = process._getActiveRequests ? process._getActiveRequests() : [];
				console.error(`[${tag}] activeHandles=${handles.length} activeRequests=${requests.length}`);
				for (const h of handles) {
					const name = (h && h.constructor && h.constructor.name) ? h.constructor.name : typeof h;
					console.error(`  - handle: ${name}`);
				}
			} catch (e) {
				console.error(`[${tag}] dump failed`, e);
			}
		};

		process.on("beforeExit", () => dump("beforeExit"));
		process.on("exit", () => dump("exit"));
	} catch (e) {
		console.error("[ACTIVE_HANDLES_DEBUG] init failed", e);
	}
})();
// =================== /ACTIVE_HANDLES_DEBUG ======================

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
