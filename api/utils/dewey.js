const fs = require("fs");
const path = require("path");

const { logToFile } = require("./logging");

const DATASET_PATH = path.join(__dirname, "..", "..", "data", "dewey", "default.json");
const DEWEY_CODE_PATTERN = /^\d{1,3}(\.\d+)?$/;

let defaultDatasetCache = null;
let defaultDatasetErrorLogged = false;

function normalizeDeweyCode(value) {
	if (value === undefined || value === null || value === "") return null;
	const normalized = String(value)
		.trim()
		.replace(/,/g, ".")
		.replace(/\.+/g, ".");
	return normalized || null;
}

function isValidDeweyCode(value) {
	if (!value) return false;
	return DEWEY_CODE_PATTERN.test(value);
}

function validateDeweyCodeInput(rawValue) {
	const normalized = normalizeDeweyCode(rawValue);
	if (!normalized) {
		return { normalized: null, errors: [] };
	}
	if (!isValidDeweyCode(normalized)) {
		return {
			normalized,
			errors: ["Dewey Code must be 1 to 3 digits, with an optional decimal part such as 513.2."]
		};
	}
	return { normalized, errors: [] };
}

function normalizeEntry(entry) {
	if (!entry || typeof entry !== "object") return null;
	const normalizedCode = normalizeDeweyCode(entry.code);
	const caption = typeof entry.caption === "string" ? entry.caption.trim() : "";
	if (!normalizedCode || !caption || !isValidDeweyCode(normalizedCode)) {
		return null;
	}
	return {
		code: normalizedCode,
		caption
	};
}

function loadDefaultDataset() {
	if (defaultDatasetCache) {
		return defaultDatasetCache;
	}

	try {
		const raw = fs.readFileSync(DATASET_PATH, "utf8");
		const parsed = JSON.parse(raw);
		const entries = Array.isArray(parsed) ? parsed.map(normalizeEntry).filter(Boolean) : [];
		defaultDatasetCache = entries;
		logToFile("DEWEY_DATASET_LOAD", {
			status: "SUCCESS",
			source: "default",
			entry_count: entries.length,
			path: DATASET_PATH
		}, "info");
		return defaultDatasetCache;
	} catch (error) {
		if (!defaultDatasetErrorLogged) {
			defaultDatasetErrorLogged = true;
			logToFile("DEWEY_DATASET_LOAD", {
				status: "FAILURE",
				source: "default",
				path: DATASET_PATH,
				error_message: error.message
			}, "error");
		}
		throw error;
	}
}

function mergeDeweyDatasets(defaultEntries, userEntries = []) {
	const merged = new Map();

	for (const entry of defaultEntries || []) {
		merged.set(entry.code, entry);
	}

	for (const entry of userEntries || []) {
		const normalized = normalizeEntry(entry);
		if (!normalized) continue;
		merged.set(normalized.code, normalized);
	}

	return Array.from(merged.values()).sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true }));
}

async function getEffectiveDeweyDataset(userId) {
	const defaultEntries = loadDefaultDataset();
	const userEntries = [];

	return {
		userId: Number.isInteger(userId) ? userId : null,
		source: userEntries.length > 0 ? "merged" : "default",
		entries: mergeDeweyDatasets(defaultEntries, userEntries)
	};
}

function buildLookupMap(entries) {
	const lookup = new Map();
	for (const entry of entries || []) {
		if (!entry || !entry.code) continue;
		lookup.set(entry.code, entry);
	}
	return lookup;
}

function buildDeweyCandidateCodes(code) {
	const normalized = normalizeDeweyCode(code);
	if (!normalized || !isValidDeweyCode(normalized)) return [];

	const candidates = [];
	const seen = new Set();

	const pushCandidate = (value) => {
		if (!value || seen.has(value)) return;
		seen.add(value);
		candidates.push(value);
	};

	pushCandidate(normalized);

	if (normalized.includes(".")) {
		let decimalCandidate = normalized;
		while (decimalCandidate.includes(".")) {
			const dotIndex = decimalCandidate.indexOf(".");
			const decimalPart = decimalCandidate.slice(dotIndex + 1);
			if (decimalPart.length > 1) {
				decimalCandidate = `${decimalCandidate.slice(0, -1)}`;
				pushCandidate(decimalCandidate);
				continue;
			}
			decimalCandidate = decimalCandidate.slice(0, dotIndex);
			pushCandidate(decimalCandidate);
		}
	}

	const integerPart = normalized.split(".")[0];
	if (integerPart.length === 3) {
		for (let length = 2; length >= 1; length -= 1) {
			pushCandidate(integerPart.slice(0, length).padEnd(3, "0"));
		}
	}

	return candidates;
}

function buildDeweyPathCodes(code) {
	const normalized = normalizeDeweyCode(code);
	if (!normalized || !isValidDeweyCode(normalized)) return [];

	const integerPart = normalized.split(".")[0].padStart(3, "0");
	const pathCodes = [];
	const seen = new Set();

	const pushCode = (value) => {
		if (!value || seen.has(value)) return;
		seen.add(value);
		pathCodes.push(value);
	};

	pushCode(integerPart[0] + "00");
	if (integerPart.length >= 2) pushCode(integerPart.slice(0, 2) + "0");
	pushCode(integerPart);

	if (normalized.includes(".")) {
		const decimals = normalized.split(".")[1];
		for (let index = 1; index <= decimals.length; index += 1) {
			pushCode(`${integerPart}.${decimals.slice(0, index)}`);
		}
	}

	return pathCodes;
}

function resolveDeweyCode(code, entries) {
	const normalized = normalizeDeweyCode(code);
	if (!normalized) {
		return {
			code: null,
			resolved: false,
			caption: null,
			matchedCode: null,
			path: []
		};
	}

	const lookup = buildLookupMap(entries);
	const candidates = buildDeweyCandidateCodes(normalized);
	const match = candidates.map((candidate) => lookup.get(candidate)).find(Boolean) || null;
	const path = buildDeweyPathCodes(match?.code || normalized)
		.map((pathCode) => lookup.get(pathCode))
		.filter(Boolean)
		.map((entry) => entry.caption);

	return {
		code: normalized,
		resolved: Boolean(match),
		caption: match ? match.caption : null,
		matchedCode: match ? match.code : null,
		path
	};
}

module.exports = {
	DATASET_PATH,
	DEWEY_CODE_PATTERN,
	normalizeDeweyCode,
	isValidDeweyCode,
	validateDeweyCodeInput,
	loadDefaultDataset,
	mergeDeweyDatasets,
	getEffectiveDeweyDataset,
	buildDeweyCandidateCodes,
	buildDeweyPathCodes,
	resolveDeweyCode
};
