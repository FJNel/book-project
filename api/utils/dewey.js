const fs = require("fs");
const path = require("path");

const pool = require("../db");
const { logToFile } = require("./logging");

const DATASET_PATH = path.join(__dirname, "..", "..", "data", "dewey", "default.json");
const DEWEY_CODE_PATTERN = /^\d{1,3}(\.\d+)?$/;
const DEWEY_SOURCE_STATUS = {
	ACTIVE: "active",
	INVALID: "invalid",
	REPLACED: "replaced"
};

let defaultDatasetCache = null;
let defaultDatasetErrorLogged = false;
const activeSourceCache = new Map();
const userEntriesCache = new Map();
const effectiveDatasetCache = new Map();

function normalizeDeweyCode(value) {
	if (value === undefined || value === null || value === "") return null;
	const normalized = String(value)
		.trim()
		.replace(/,/g, ".")
		.replace(/\.+/g, ".");
	return normalized || null;
}

function normalizeDeweyCaption(value) {
	if (value === undefined || value === null) return "";
	return String(value).trim();
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
	const caption = normalizeDeweyCaption(entry.caption);
	const normalizedParentCode = normalizeDeweyCode(entry.parentCode ?? entry.parent_code);

	if (!normalizedCode || !caption || !isValidDeweyCode(normalizedCode)) {
		return null;
	}

	return {
		code: normalizedCode,
		caption,
		parentCode: normalizedParentCode && isValidDeweyCode(normalizedParentCode) ? normalizedParentCode : null
	};
}

function serializeValidationReport(report = {}) {
	const fatalErrors = Array.isArray(report.fatalErrors) ? report.fatalErrors : [];
	const warnings = Array.isArray(report.warnings) ? report.warnings : [];
	const summary = report.summary && typeof report.summary === "object" ? report.summary : {};

	return {
		fatalErrors,
		warnings,
		summary: {
			totalRows: Number.isInteger(summary.totalRows) ? summary.totalRows : 0,
			acceptedEntries: Number.isInteger(summary.acceptedEntries) ? summary.acceptedEntries : 0,
			fatalCount: fatalErrors.length,
			warningCount: warnings.length
		}
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
				decimalCandidate = decimalCandidate.slice(0, -1);
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

function mergeDeweyDatasets(defaultEntries, userEntries = []) {
	const merged = new Map();

	for (const entry of defaultEntries || []) {
		const normalized = normalizeEntry(entry);
		if (!normalized) continue;
		merged.set(normalized.code, normalized);
	}

	for (const entry of userEntries || []) {
		const normalized = normalizeEntry(entry);
		if (!normalized) continue;
		merged.set(normalized.code, normalized);
	}

	return Array.from(merged.values()).sort((left, right) => left.code.localeCompare(right.code, undefined, { numeric: true }));
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

function compareDeweyCodes(left, right) {
	return String(left || "").localeCompare(String(right || ""), undefined, { numeric: true });
}

function findNearestExistingParentCode(code, lookup) {
	const normalized = normalizeDeweyCode(code);
	if (!normalized || !lookup || !lookup.size) return null;

	const candidates = buildDeweyCandidateCodes(normalized).slice(1);
	for (const candidate of candidates) {
		if (lookup.has(candidate)) return candidate;
	}
	return null;
}

function buildHierarchyMetadata(entries = []) {
	const normalizedEntries = Array.isArray(entries) ? entries.map(normalizeEntry).filter(Boolean) : [];
	const lookup = buildLookupMap(normalizedEntries);
	const childrenMap = new Map();
	const parentMap = new Map();
	const roots = [];

	for (const entry of normalizedEntries) {
		const parentCode = findNearestExistingParentCode(entry.code, lookup);
		parentMap.set(entry.code, parentCode);
		if (parentCode) {
			if (!childrenMap.has(parentCode)) childrenMap.set(parentCode, []);
			childrenMap.get(parentCode).push(entry.code);
		} else {
			roots.push(entry.code);
		}
	}

	for (const childCodes of childrenMap.values()) {
		childCodes.sort(compareDeweyCodes);
	}
	roots.sort(compareDeweyCodes);

	return {
		lookup,
		parentMap,
		childrenMap,
		roots
	};
}

function buildBreadcrumbNodes(code, entries = [], hierarchy = null) {
	const normalized = normalizeDeweyCode(code);
	if (!normalized) return [];

	const metadata = hierarchy || buildHierarchyMetadata(entries);
	if (!metadata.lookup.has(normalized)) {
		return buildDeweyPathCodes(normalized)
			.map((pathCode) => metadata.lookup.get(pathCode))
			.filter(Boolean)
			.map((entry) => ({ code: entry.code, caption: entry.caption }));
	}

	const breadcrumb = [];
	let currentCode = normalized;
	while (currentCode) {
		const entry = metadata.lookup.get(currentCode);
		if (entry) breadcrumb.unshift({ code: entry.code, caption: entry.caption });
		currentCode = metadata.parentMap.get(currentCode) || null;
	}
	return breadcrumb;
}

function isCodeWithinDeweyBranch(descendantCode, ancestorCode) {
	const normalizedDescendant = normalizeDeweyCode(descendantCode);
	const normalizedAncestor = normalizeDeweyCode(ancestorCode);
	if (!normalizedDescendant || !normalizedAncestor) return false;
	if (!isValidDeweyCode(normalizedDescendant) || !isValidDeweyCode(normalizedAncestor)) return false;
	return buildDeweyPathCodes(normalizedDescendant).includes(normalizedAncestor);
}

function buildExactBookCountMap(books = []) {
	const counts = new Map();
	for (const book of books) {
		const code = normalizeDeweyCode(book?.deweyCode ?? book?.dewey_code);
		if (!code || !isValidDeweyCode(code)) continue;
		counts.set(code, (counts.get(code) || 0) + 1);
	}
	return counts;
}

function buildDescendantBookCountMap(books = [], hierarchy = null) {
	const counts = new Map();
	if (!hierarchy) return counts;

	for (const code of hierarchy.lookup.keys()) {
		let total = 0;
		for (const book of books) {
			if (isCodeWithinDeweyBranch(book?.deweyCode ?? book?.dewey_code, code)) {
				total += 1;
			}
		}
		counts.set(code, total);
	}

	return counts;
}

function buildBrowsableTree(entries = [], books = []) {
	const hierarchy = buildHierarchyMetadata(entries);
	const exactCounts = buildExactBookCountMap(books);
	const descendantCounts = buildDescendantBookCountMap(books, hierarchy);

	const buildNode = (code) => {
		const entry = hierarchy.lookup.get(code);
		const childCodes = hierarchy.childrenMap.get(code) || [];
		return {
			code,
			caption: entry?.caption || null,
			parentCode: hierarchy.parentMap.get(code) || null,
			exactBookCount: exactCounts.get(code) || 0,
			descendantBookCount: descendantCounts.get(code) || 0,
			childCount: childCodes.length,
			breadcrumb: buildBreadcrumbNodes(code, entries, hierarchy),
			children: childCodes.map((childCode) => buildNode(childCode))
		};
	};

	return {
		roots: (hierarchy.roots || []).map((code) => buildNode(code)),
		hierarchy,
		exactCounts,
		descendantCounts
	};
}

function getBrowsableNode(code, entries = [], books = []) {
	const normalized = normalizeDeweyCode(code);
	if (!normalized || !isValidDeweyCode(normalized)) return null;

	const tree = buildBrowsableTree(entries, books);
	if (!tree.hierarchy.lookup.has(normalized)) return null;

	const entry = tree.hierarchy.lookup.get(normalized);
	const childCodes = tree.hierarchy.childrenMap.get(normalized) || [];
	return {
		code: normalized,
		caption: entry?.caption || null,
		parentCode: tree.hierarchy.parentMap.get(normalized) || null,
		exactBookCount: tree.exactCounts.get(normalized) || 0,
		descendantBookCount: tree.descendantCounts.get(normalized) || 0,
		childCount: childCodes.length,
		breadcrumb: buildBreadcrumbNodes(normalized, entries, tree.hierarchy),
		children: childCodes.map((childCode) => {
			const childEntry = tree.hierarchy.lookup.get(childCode);
			return {
				code: childCode,
				caption: childEntry?.caption || null,
				parentCode: tree.hierarchy.parentMap.get(childCode) || null,
				exactBookCount: tree.exactCounts.get(childCode) || 0,
				descendantBookCount: tree.descendantCounts.get(childCode) || 0,
				childCount: (tree.hierarchy.childrenMap.get(childCode) || []).length,
				breadcrumb: buildBreadcrumbNodes(childCode, entries, tree.hierarchy)
			};
		})
	};
}

function searchBrowsableNodes(query, entries = [], books = [], { limit = 25 } = {}) {
	const normalizedQuery = String(query || "").trim().toLowerCase();
	if (!normalizedQuery) return [];

	const tree = buildBrowsableTree(entries, books);
	const matches = [];

	for (const entry of entries || []) {
		const normalizedEntry = normalizeEntry(entry);
		if (!normalizedEntry) continue;
		const code = normalizedEntry.code;
		const caption = normalizedEntry.caption || "";
		const codeLower = code.toLowerCase();
		const captionLower = caption.toLowerCase();

		let rank = null;
		if (codeLower === normalizedQuery) rank = 0;
		else if (captionLower === normalizedQuery) rank = 1;
		else if (codeLower.startsWith(normalizedQuery)) rank = 2;
		else if (captionLower.startsWith(normalizedQuery)) rank = 3;
		else if (codeLower.includes(normalizedQuery)) rank = 4;
		else if (captionLower.includes(normalizedQuery)) rank = 5;

		if (rank === null) continue;

		matches.push({
			code,
			caption,
			parentCode: tree.hierarchy.parentMap.get(code) || null,
			exactBookCount: tree.exactCounts.get(code) || 0,
			descendantBookCount: tree.descendantCounts.get(code) || 0,
			childCount: (tree.hierarchy.childrenMap.get(code) || []).length,
			breadcrumb: buildBreadcrumbNodes(code, entries, tree.hierarchy),
			rank
		});
	}

	return matches
		.sort((left, right) => {
			if (left.rank !== right.rank) return left.rank - right.rank;
			return compareDeweyCodes(left.code, right.code);
		})
		.slice(0, Math.max(1, Math.min(limit, 100)))
		.map(({ rank, ...match }) => match);
}

function clearUserDeweyCaches(userId) {
	if (!Number.isInteger(userId)) return;
	activeSourceCache.delete(userId);
	userEntriesCache.delete(userId);
	effectiveDatasetCache.delete(userId);
	logToFile("DEWEY_DATASET_CACHE_INVALIDATED", { user_id: userId }, "info");
}

function normalizeCsvHeader(value) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_")
		.replace(/[^a-z0-9_]/g, "");
}

function parseCsvText(text) {
	const sourceText = typeof text === "string" ? text.replace(/^\uFEFF/, "") : "";
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;

	for (let index = 0; index < sourceText.length; index += 1) {
		const character = sourceText[index];

		if (inQuotes) {
			if (character === "\"") {
				if (sourceText[index + 1] === "\"") {
					field += "\"";
					index += 1;
				} else {
					inQuotes = false;
				}
			} else {
				field += character;
			}
			continue;
		}

		if (character === "\"") {
			if (field.length > 0) {
				throw new Error("CSV contains an unexpected quote inside an unquoted field.");
			}
			inQuotes = true;
			continue;
		}

		if (character === ",") {
			row.push(field);
			field = "";
			continue;
		}

		if (character === "\r") {
			continue;
		}

		if (character === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			continue;
		}

		field += character;
	}

	if (inQuotes) {
		throw new Error("CSV contains an unterminated quoted field.");
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((cells) => cells.some((value) => String(value || "").trim() !== ""));
}

function parseUserDeweyCsv(csvText) {
	const rows = parseCsvText(csvText);
	if (rows.length === 0) {
		throw new Error("The CSV file is empty.");
	}

	const headerRow = rows[0].map((value) => String(value || ""));
	const headers = headerRow.map(normalizeCsvHeader);
	const duplicateHeaders = headers.filter((header, index) => header && headers.indexOf(header) !== index);
	if (duplicateHeaders.length > 0) {
		throw new Error(`The CSV file contains duplicate headers: ${Array.from(new Set(duplicateHeaders)).join(", ")}.`);
	}

	const dataRows = rows.slice(1).map((cells, index) => {
		const normalizedCells = headerRow.map((_, headerIndex) => (cells[headerIndex] === undefined ? "" : String(cells[headerIndex])));
		const extraCells = cells.slice(headerRow.length).map((value) => String(value || "").trim()).filter(Boolean);
		if (extraCells.length > 0) {
			throw new Error(`Row ${index + 2} contains unexpected extra columns.`);
		}

		return {
			rowNumber: index + 2,
			cells: normalizedCells
		};
	});

	return { headers, dataRows };
}

function buildValidationMessage(rowNumber, message, code = null) {
	return code
		? `Row ${rowNumber} (${code}): ${message}`
		: `Row ${rowNumber}: ${message}`;
}

function getUploadedHierarchyCodes(code) {
	return buildDeweyPathCodes(code).slice(0, -1);
}

function validateUserDeweyCsv(parsedCsv) {
	const report = {
		fatalErrors: [],
		warnings: [],
		summary: {
			totalRows: Array.isArray(parsedCsv?.dataRows) ? parsedCsv.dataRows.length : 0,
			acceptedEntries: 0,
			fatalCount: 0,
			warningCount: 0
		}
	};

	const headers = Array.isArray(parsedCsv?.headers) ? parsedCsv.headers : [];
	const dataRows = Array.isArray(parsedCsv?.dataRows) ? parsedCsv.dataRows : [];
	const codeIndex = headers.indexOf("code");
	const captionIndex = headers.indexOf("caption");
	const parentCodeIndex = headers.indexOf("parent_code");
	const hasParentCodeColumn = parentCodeIndex !== -1;
	const missingHeaders = [];

	if (codeIndex === -1) missingHeaders.push("code");
	if (captionIndex === -1) missingHeaders.push("caption");

	if (missingHeaders.length > 0) {
		report.fatalErrors.push(`The CSV file is missing required column(s): ${missingHeaders.join(", ")}.`);
	}

	if (dataRows.length === 0) {
		report.fatalErrors.push("The CSV file does not contain any data rows.");
	}

	if (!hasParentCodeColumn) {
		report.warnings.push("Optional parent_code column was not provided. Prefix hierarchy will be used.");
	}

	if (report.fatalErrors.length > 0) {
		report.summary.fatalCount = report.fatalErrors.length;
		report.summary.warningCount = report.warnings.length;
		return { normalizedEntries: [], validationReport: serializeValidationReport(report) };
	}

	const normalizedEntries = [];
	const duplicateTracker = new Map();

	for (const row of dataRows) {
		const codeRaw = row.cells[codeIndex];
		const captionRaw = row.cells[captionIndex];
		const parentCodeRaw = hasParentCodeColumn ? row.cells[parentCodeIndex] : "";
		const normalizedCode = normalizeDeweyCode(codeRaw);
		const normalizedCaption = normalizeDeweyCaption(captionRaw);
		const normalizedParentCode = normalizeDeweyCode(parentCodeRaw);

		if (!normalizedCode) {
			report.fatalErrors.push(buildValidationMessage(row.rowNumber, "code is required."));
			continue;
		}

		if (!isValidDeweyCode(normalizedCode)) {
			report.fatalErrors.push(buildValidationMessage(row.rowNumber, "code is not a valid Dewey Decimal value.", normalizedCode));
			continue;
		}

		if (!normalizedCaption) {
			report.fatalErrors.push(buildValidationMessage(row.rowNumber, "caption is required.", normalizedCode));
			continue;
		}

		if (hasParentCodeColumn && (!parentCodeRaw || String(parentCodeRaw).trim() === "")) {
			report.warnings.push(buildValidationMessage(row.rowNumber, "parent_code is missing. Prefix hierarchy will be inferred.", normalizedCode));
		} else if (hasParentCodeColumn && (!normalizedParentCode || !isValidDeweyCode(normalizedParentCode))) {
			report.warnings.push(buildValidationMessage(row.rowNumber, "parent_code is invalid and will be ignored.", normalizedCode));
		}

		normalizedEntries.push({
			rowNumber: row.rowNumber,
			code: normalizedCode,
			caption: normalizedCaption,
			parentCode: normalizedParentCode && isValidDeweyCode(normalizedParentCode) ? normalizedParentCode : null
		});

		const duplicateRows = duplicateTracker.get(normalizedCode) || [];
		duplicateRows.push(row.rowNumber);
		duplicateTracker.set(normalizedCode, duplicateRows);
	}

	for (const [code, rowsForCode] of duplicateTracker.entries()) {
		if (rowsForCode.length > 1) {
			report.fatalErrors.push(`Duplicate code '${code}' appears on rows ${rowsForCode.join(", ")}.`);
		}
	}

	if (report.fatalErrors.length === 0) {
		const uploadedCodes = new Set(normalizedEntries.map((entry) => entry.code));

		for (const entry of normalizedEntries) {
			if (entry.parentCode && !uploadedCodes.has(entry.parentCode)) {
				report.warnings.push(buildValidationMessage(entry.rowNumber, "parent_code does not exist in the uploaded dataset.", entry.code));
			}

			const broaderCodes = getUploadedHierarchyCodes(entry.code);
			const hasBroaderUploadedMatch = broaderCodes.some((code) => uploadedCodes.has(code));
			if (broaderCodes.length > 0 && !hasBroaderUploadedMatch) {
				report.warnings.push(buildValidationMessage(entry.rowNumber, "the uploaded dataset is sparse around this code; broader hierarchy will fall back to defaults where available.", entry.code));
			}
		}
	}

	report.summary.acceptedEntries = report.fatalErrors.length === 0 ? normalizedEntries.length : 0;
	report.summary.fatalCount = report.fatalErrors.length;
	report.summary.warningCount = report.warnings.length;

	return {
		normalizedEntries,
		validationReport: serializeValidationReport(report)
	};
}

function serializeSourceRow(row) {
	if (!row) return null;
	return {
		id: row.id,
		userId: row.user_id,
		originalFilename: row.original_filename,
		status: row.status,
		isActive: row.is_active === true,
		entryCount: Number.parseInt(row.entry_count, 10) || 0,
		validationReport: serializeValidationReport(row.validation_report),
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

async function getActiveUserDeweySource(userId, { force = false } = {}) {
	if (!Number.isInteger(userId)) return null;
	if (!force && activeSourceCache.has(userId)) {
		return activeSourceCache.get(userId);
	}

	const query = `
		SELECT
			s.*,
			COALESCE(COUNT(e.id), 0)::int AS entry_count
		FROM user_dewey_sources s
		LEFT JOIN user_dewey_entries e ON e.source_id = s.id
		WHERE s.user_id = $1 AND s.is_active = TRUE
		GROUP BY s.id
		ORDER BY s.created_at DESC, s.id DESC
		LIMIT 1
	`;
	const result = await pool.query(query, [userId]);
	const source = result.rows.length > 0 ? serializeSourceRow(result.rows[0]) : null;
	activeSourceCache.set(userId, source);
	return source;
}

async function getLatestUserDeweySource(userId) {
	if (!Number.isInteger(userId)) return null;

	const query = `
		SELECT
			s.*,
			COALESCE(COUNT(e.id), 0)::int AS entry_count
		FROM user_dewey_sources s
		LEFT JOIN user_dewey_entries e ON e.source_id = s.id
		WHERE s.user_id = $1
		GROUP BY s.id
		ORDER BY s.created_at DESC, s.id DESC
		LIMIT 1
	`;
	const result = await pool.query(query, [userId]);
	return result.rows.length > 0 ? serializeSourceRow(result.rows[0]) : null;
}

async function getUserDeweyEntries(userId, { force = false } = {}) {
	if (!Number.isInteger(userId)) return [];
	if (!force && userEntriesCache.has(userId)) {
		return userEntriesCache.get(userId);
	}

	const activeSource = await getActiveUserDeweySource(userId, { force });
	if (!activeSource) {
		userEntriesCache.set(userId, []);
		return [];
	}

	const result = await pool.query(
		`SELECT code, caption, parent_code
		 FROM user_dewey_entries
		 WHERE source_id = $1
		 ORDER BY code ASC`,
		[activeSource.id]
	);
	const entries = result.rows.map((row) => normalizeEntry({
		code: row.code,
		caption: row.caption,
		parentCode: row.parent_code
	})).filter(Boolean);
	userEntriesCache.set(userId, entries);
	return entries;
}

async function getEffectiveDeweyDataset(userId, { force = false } = {}) {
	const normalizedUserId = Number.isInteger(userId) ? userId : null;
	if (normalizedUserId !== null && !force && effectiveDatasetCache.has(normalizedUserId)) {
		return effectiveDatasetCache.get(normalizedUserId);
	}

	const defaultEntries = loadDefaultDataset();
	const userEntries = normalizedUserId === null ? [] : await getUserDeweyEntries(normalizedUserId, { force });
	const dataset = {
		userId: normalizedUserId,
		source: userEntries.length > 0 ? "merged" : "default",
		entries: mergeDeweyDatasets(defaultEntries, userEntries)
	};

	if (normalizedUserId !== null) {
		effectiveDatasetCache.set(normalizedUserId, dataset);
	}

	return dataset;
}

async function getUserDeweySourceStatus(userId) {
	const normalizedUserId = Number.isInteger(userId) ? userId : null;
	const [activeSource, latestSource] = await Promise.all([
		getActiveUserDeweySource(normalizedUserId, { force: true }),
		getLatestUserDeweySource(normalizedUserId)
	]);

	const status = {
		hasUploadedSource: Boolean(latestSource),
		hasActiveUserSource: Boolean(activeSource),
		usingDefaultOnly: !activeSource,
		effectiveDatasetMode: activeSource ? "merged" : "default",
		activeSource,
		latestSource
	};

	logToFile("DEWEY_SOURCE_STATUS", {
		status: "SUCCESS",
		user_id: normalizedUserId,
		has_uploaded_source: status.hasUploadedSource,
		has_active_user_source: status.hasActiveUserSource,
		effective_dataset_mode: status.effectiveDatasetMode
	}, "info");

	return status;
}

async function storeInvalidUserDeweySource(client, userId, originalFilename, validationReport) {
	const result = await client.query(
		`INSERT INTO user_dewey_sources (user_id, original_filename, status, is_active, validation_report, created_at, updated_at)
		 VALUES ($1, $2, $3, FALSE, $4::jsonb, NOW(), NOW())
		 RETURNING *`,
		[userId, originalFilename, DEWEY_SOURCE_STATUS.INVALID, JSON.stringify(validationReport)]
	);
	return result.rows[0];
}

async function replaceActiveUserDeweySource(client, userId) {
	await client.query(
		`UPDATE user_dewey_sources
		 SET is_active = FALSE,
		     status = $2,
		     updated_at = NOW()
		 WHERE user_id = $1
		   AND is_active = TRUE`,
		[userId, DEWEY_SOURCE_STATUS.REPLACED]
	);
}

async function storeActiveUserDeweySource(client, userId, originalFilename, validationReport, normalizedEntries) {
	await replaceActiveUserDeweySource(client, userId);

	const sourceResult = await client.query(
		`INSERT INTO user_dewey_sources (user_id, original_filename, status, is_active, validation_report, created_at, updated_at)
		 VALUES ($1, $2, $3, TRUE, $4::jsonb, NOW(), NOW())
		 RETURNING *`,
		[userId, originalFilename, DEWEY_SOURCE_STATUS.ACTIVE, JSON.stringify(validationReport)]
	);

	const source = sourceResult.rows[0];
	if (normalizedEntries.length > 0) {
		await client.query(
			`INSERT INTO user_dewey_entries (source_id, code, caption, parent_code, created_at, updated_at)
			 SELECT $1,
			        UNNEST($2::varchar[]),
			        UNNEST($3::text[]),
			        UNNEST($4::varchar[]),
			        NOW(),
			        NOW()`,
			[
				source.id,
				normalizedEntries.map((entry) => entry.code),
				normalizedEntries.map((entry) => entry.caption),
				normalizedEntries.map((entry) => entry.parentCode)
			]
		);
	}

	return source;
}

async function uploadUserDeweySource(userId, { originalFilename, csvText }) {
	const normalizedUserId = Number.isInteger(userId) ? userId : null;
	if (!normalizedUserId) {
		throw new Error("A valid user id is required.");
	}

	const safeFilename = typeof originalFilename === "string" && originalFilename.trim()
		? originalFilename.trim()
		: "dewey-upload.csv";

	logToFile("DEWEY_SOURCE_UPLOAD", {
		status: "INFO",
		user_id: normalizedUserId,
		original_filename: safeFilename
	}, "info");

	let parsedCsv;
	try {
		parsedCsv = parseUserDeweyCsv(csvText);
		logToFile("DEWEY_SOURCE_UPLOAD", {
			status: "PARSED",
			user_id: normalizedUserId,
			original_filename: safeFilename,
			row_count: parsedCsv.dataRows.length
		}, "info");
	} catch (error) {
		const validationReport = serializeValidationReport({
			fatalErrors: [error.message],
			warnings: [],
			summary: { totalRows: 0, acceptedEntries: 0 }
		});
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const storedRow = await storeInvalidUserDeweySource(client, normalizedUserId, safeFilename, validationReport);
			await client.query("COMMIT");
			return {
				uploadAccepted: false,
				activeUsable: false,
				source: serializeSourceRow(storedRow),
				validationReport,
				datasetStatus: await getUserDeweySourceStatus(normalizedUserId)
			};
		} catch (storageError) {
			await client.query("ROLLBACK");
			throw storageError;
		} finally {
			client.release();
		}
	}

	const { normalizedEntries, validationReport } = validateUserDeweyCsv(parsedCsv);
	const hasFatalErrors = validationReport.fatalErrors.length > 0;

	logToFile("DEWEY_SOURCE_UPLOAD", {
		status: hasFatalErrors ? "INVALID" : "VALID",
		user_id: normalizedUserId,
		original_filename: safeFilename,
		accepted_entries: validationReport.summary.acceptedEntries,
		fatal_count: validationReport.summary.fatalCount,
		warning_count: validationReport.summary.warningCount
	}, hasFatalErrors ? "warn" : "info");

	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		let storedRow;
		if (hasFatalErrors) {
			storedRow = await storeInvalidUserDeweySource(client, normalizedUserId, safeFilename, validationReport);
		} else {
			storedRow = await storeActiveUserDeweySource(client, normalizedUserId, safeFilename, validationReport, normalizedEntries);
		}

		await client.query("COMMIT");

		if (!hasFatalErrors) {
			clearUserDeweyCaches(normalizedUserId);
			logToFile("DEWEY_SOURCE_UPLOAD", {
				status: "STORED",
				user_id: normalizedUserId,
				source_id: storedRow.id,
				entry_count: normalizedEntries.length,
				warning_count: validationReport.summary.warningCount
			}, "info");
		}

		return {
			uploadAccepted: !hasFatalErrors,
			activeUsable: !hasFatalErrors,
			source: serializeSourceRow({
				...storedRow,
				entry_count: !hasFatalErrors ? normalizedEntries.length : 0
			}),
			validationReport,
			datasetStatus: await getUserDeweySourceStatus(normalizedUserId)
		};
	} catch (error) {
		await client.query("ROLLBACK");
		logToFile("DEWEY_SOURCE_UPLOAD", {
			status: "FAILURE",
			user_id: normalizedUserId,
			original_filename: safeFilename,
			error_message: error.message
		}, "error");
		throw error;
	} finally {
		client.release();
	}
}

module.exports = {
	DATASET_PATH,
	DEWEY_CODE_PATTERN,
	DEWEY_SOURCE_STATUS,
	normalizeDeweyCode,
	isValidDeweyCode,
	validateDeweyCodeInput,
	loadDefaultDataset,
	mergeDeweyDatasets,
	getEffectiveDeweyDataset,
	buildDeweyCandidateCodes,
	buildDeweyPathCodes,
	buildBreadcrumbNodes,
	isCodeWithinDeweyBranch,
	buildBrowsableTree,
	getBrowsableNode,
	searchBrowsableNodes,
	resolveDeweyCode,
	parseUserDeweyCsv,
	validateUserDeweyCsv,
	getUserDeweySourceStatus,
	uploadUserDeweySource,
	clearUserDeweyCaches
};
