const http = require("http");
const https = require("https");

const config = require("../../config");
const { logToFile } = require("../logging");
const { validatePartialDateObject } = require("../partial-date");
const { normalizeTagName } = require("../tag-normalization");
const { getCacheEntry, setCacheEntry, deleteCacheEntry } = require("../stats-cache");

const MAX_TITLE_LENGTH = 255;
const MAX_SUBTITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TAG_LENGTH = 50;
const DEFAULT_EXTERNAL_CACHE_TTL_SECONDS = Number.parseInt(config?.isbnLookup?.externalCacheTtlSeconds, 10) || 21600;
const NEGATIVE_CACHE_TTL_SECONDS = 90;
const MAX_EXTERNAL_CACHE_ENTRIES = 750;

const inFlightRequests = new Map();
const negativeCacheStore = new Map();
const externalCacheInsertionOrder = [];

const BOOK_TYPE_CATALOG = {
	Hardcover: "A durable hardbound edition with rigid boards and a protective jacket or printed cover.",
	Softcover: "A flexible paperback edition with a card cover that is lighter and easier to carry than hardcover.",
	Magazine: "A magazine or other periodical issue published in serial form.",
	Pamphlet: "A small booklet or pamphlet format intended for short-form reading."
};

function normalizeOptionalText(value) {
	if (value === undefined || value === null) return null;
	if (typeof value !== "string") return value;
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

function stripDiacritics(value) {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "");
}

function normalizeLookupName(value) {
	if (typeof value !== "string") return "";
	return stripDiacritics(value)
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function normalizeLookupCompact(value) {
	return normalizeLookupName(value).replace(/\s+/g, "");
}

function sanitizeLookupText(value, maxLength) {
	const normalized = normalizeOptionalText(value);
	if (!normalized || typeof normalized !== "string") return null;
	const collapsed = normalized.replace(/\s+/g, " ").trim();
	if (!collapsed) return null;
	return maxLength ? collapsed.slice(0, maxLength) : collapsed;
}

function sanitizeLookupDescription(value) {
	return sanitizeLookupText(extractStringValue(value), MAX_DESCRIPTION_LENGTH);
}

function sanitizeLookupCoverUrl(value) {
	const normalized = sanitizeLookupText(value, 500);
	if (!normalized || /\s/.test(normalized)) return null;
	try {
		const parsed = new URL(normalized);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
		return normalized;
	} catch (_) {
		return null;
	}
}

function sanitizeLookupPageCount(value) {
	if (value === undefined || value === null || value === "") return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10000) return null;
	return parsed;
}

function lookupDateSpecificity(dateValue) {
	if (!dateValue || typeof dateValue !== "object") return 0;
	if (Number.isInteger(dateValue.day) && Number.isInteger(dateValue.month) && Number.isInteger(dateValue.year)) return 3;
	if (Number.isInteger(dateValue.month) && Number.isInteger(dateValue.year)) return 2;
	if (Number.isInteger(dateValue.year)) return 1;
	return 0;
}

function buildPartialDate(text, { year = null, month = null, day = null } = {}) {
	const normalizedText = sanitizeLookupText(text, 120);
	if (!normalizedText) return null;
	const payload = {
		text: normalizedText,
		year: Number.isInteger(year) ? year : null,
		month: Number.isInteger(month) ? month : null,
		day: Number.isInteger(day) ? day : null
	};
	return validatePartialDateObject(payload, "Publication Date").length === 0 ? payload : null;
}

function parsePartialDateFromSource(rawValue) {
	const value = sanitizeLookupText(rawValue, 120);
	if (!value) return null;

	const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (isoMatch) {
		return buildPartialDate(value, {
			year: Number.parseInt(isoMatch[1], 10),
			month: Number.parseInt(isoMatch[2], 10),
			day: Number.parseInt(isoMatch[3], 10)
		});
	}

	const yearOnlyMatch = value.match(/^(\d{4})$/);
	if (yearOnlyMatch) {
		return buildPartialDate(value, { year: Number.parseInt(yearOnlyMatch[1], 10) });
	}

	const monthYearMatch = value.match(/^([A-Za-z]+)\s+(\d{4})$/);
	if (monthYearMatch) {
		const parsed = Date.parse(`${monthYearMatch[1]} 1, ${monthYearMatch[2]}`);
		if (!Number.isNaN(parsed)) {
			const date = new Date(parsed);
			return buildPartialDate(value, {
				year: date.getUTCFullYear(),
				month: date.getUTCMonth() + 1
			});
		}
	}

	const parsed = Date.parse(value);
	if (!Number.isNaN(parsed)) {
		const date = new Date(parsed);
		return buildPartialDate(value, {
			year: date.getUTCFullYear(),
			month: date.getUTCMonth() + 1,
			day: date.getUTCDate()
		});
	}

	return null;
}

function pickBetterString(currentValue, nextValue, { maxLength = null } = {}) {
	const current = sanitizeLookupText(currentValue, maxLength);
	const next = sanitizeLookupText(nextValue, maxLength);
	if (!next) return current;
	if (!current) return next;
	const currentCompact = normalizeLookupCompact(current);
	const nextCompact = normalizeLookupCompact(next);
	if (currentCompact === nextCompact) {
		return next.length > current.length ? next : current;
	}
	return next.length > current.length ? next : current;
}

function pickBetterDate(currentValue, nextValue) {
	if (!nextValue) return currentValue || null;
	if (!currentValue) return nextValue;
	const currentScore = lookupDateSpecificity(currentValue);
	const nextScore = lookupDateSpecificity(nextValue);
	return nextScore > currentScore ? nextValue : currentValue;
}

function pickBetterCover(currentValue, nextValue) {
	const current = sanitizeLookupCoverUrl(currentValue);
	const next = sanitizeLookupCoverUrl(nextValue);
	if (!next) return current;
	if (!current) return next;
	if (current.startsWith("https://") && !next.startsWith("https://")) return current;
	if (next.startsWith("https://") && !current.startsWith("https://")) return next;
	return next.length > current.length ? next : current;
}

function mergeNamedItems(items, getName) {
	const merged = [];
	const seen = new Set();
	for (const item of items || []) {
		const name = sanitizeLookupText(getName(item), 150);
		if (!name) continue;
		const key = normalizeLookupCompact(name);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		merged.push(item);
	}
	return merged;
}

function deriveLanguageName(rawValue) {
	const value = sanitizeLookupText(rawValue, 64);
	if (!value) return null;
	if (/^[a-z]{2,3}$/i.test(value)) {
		try {
			const display = new Intl.DisplayNames(["en"], { type: "language" }).of(value.toLowerCase());
			return sanitizeLookupText(display || value, 64);
		} catch (_) {
			return value;
		}
	}
	return value;
}

function splitAuthorNameParts(name) {
	const normalized = sanitizeLookupText(name, 150);
	if (!normalized) return { displayName: null, firstNames: null, lastName: null };
	const parts = normalized.split(" ").filter(Boolean);
	if (parts.length < 2) {
		return { displayName: normalized, firstNames: null, lastName: null };
	}
	return {
		displayName: normalized,
		firstNames: parts.slice(0, -1).join(" ") || null,
		lastName: parts[parts.length - 1] || null
	};
}

function normalizeIsbnValue(value) {
	if (value === undefined || value === null || value === "") return null;
	if (typeof value !== "string") return null;
	const cleaned = value.replace(/[^0-9xX]/g, "").toUpperCase();
	if (cleaned.length === 10 && /^[0-9]{9}[0-9X]$/.test(cleaned)) return cleaned;
	if (cleaned.length === 13 && /^[0-9]{13}$/.test(cleaned)) return cleaned;
	return null;
}

function extractStringValue(value) {
	if (typeof value === "string") return value;
	if (value && typeof value === "object" && typeof value.value === "string") return value.value;
	return null;
}

async function fetchJsonWithTimeout(url, { timeoutMs = 4500, headers = {} } = {}) {
	const target = new URL(url);
	const transport = target.protocol === "http:" ? http : https;
	return new Promise((resolve, reject) => {
		const request = transport.request(target, {
			method: "GET",
			headers: {
				accept: "application/json",
				...headers
			}
		}, (response) => {
			const chunks = [];
			response.on("data", (chunk) => chunks.push(chunk));
			response.on("end", () => {
				const body = Buffer.concat(chunks).toString("utf8");
				if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
					reject(new Error(`HTTP ${response.statusCode}`));
					return;
				}
				try {
					resolve(body ? JSON.parse(body) : {});
				} catch (error) {
					reject(error);
				}
			});
		});

		request.setTimeout(timeoutMs, () => {
			request.destroy(new Error("Request timed out."));
		});
		request.on("error", reject);
		request.end();
	});
}

function buildExternalCacheKey({ provider, resource, identifier }) {
	const safeProvider = sanitizeLookupText(provider, 50) || "unknown";
	const safeResource = sanitizeLookupText(resource, 100) || "request";
	const safeIdentifier = sanitizeLookupText(identifier, 300) || "";
	return `external:isbn:v1:${safeProvider}:${safeResource}:${safeIdentifier}`;
}

function buildNegativeCacheKey(cacheKey) {
	return `${cacheKey}:negative`;
}

function getNegativeCacheEntry(key) {
	const entry = negativeCacheStore.get(key);
	if (!entry) return null;
	const ageMs = Date.now() - entry.createdAt;
	if (ageMs > entry.ttlMs) {
		negativeCacheStore.delete(key);
		return null;
	}
	return entry;
}

function setNegativeCacheEntry(key, error, ttlSeconds = NEGATIVE_CACHE_TTL_SECONDS) {
	if (negativeCacheStore.size >= MAX_EXTERNAL_CACHE_ENTRIES) {
		const oldestKey = negativeCacheStore.keys().next().value;
		if (oldestKey) negativeCacheStore.delete(oldestKey);
	}
	negativeCacheStore.set(key, {
		errorMessage: error?.message || "External lookup failed.",
		createdAt: Date.now(),
		ttlMs: Math.max(1, ttlSeconds) * 1000
	});
}

function shouldNegativeCache(error) {
	const message = String(error?.message || "");
	if (error instanceof SyntaxError) return false;
	return /HTTP \d+/i.test(message)
		|| /timed out/i.test(message)
		|| /ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket hang up/i.test(message);
}

function recordExternalCacheEntry(cacheKey) {
	const existingIndex = externalCacheInsertionOrder.indexOf(cacheKey);
	if (existingIndex !== -1) {
		externalCacheInsertionOrder.splice(existingIndex, 1);
	}
	externalCacheInsertionOrder.push(cacheKey);
	while (externalCacheInsertionOrder.length > MAX_EXTERNAL_CACHE_ENTRIES) {
		const oldestKey = externalCacheInsertionOrder.shift();
		if (!oldestKey) continue;
		deleteCacheEntry(oldestKey);
		negativeCacheStore.delete(buildNegativeCacheKey(oldestKey));
	}
}

async function fetchCachedJson({
	provider,
	resource,
	identifier,
	url,
	timeoutMs = 4500,
	headers = {},
	ttlSeconds = DEFAULT_EXTERNAL_CACHE_TTL_SECONDS
} = {}) {
	const cacheKey = buildExternalCacheKey({ provider, resource, identifier });
	const negativeCacheKey = buildNegativeCacheKey(cacheKey);
	const cached = getCacheEntry(cacheKey);
	if (cached) {
		return cached.data;
	}

	const negativeCached = getNegativeCacheEntry(negativeCacheKey);
	if (negativeCached) {
		throw new Error(negativeCached.errorMessage);
	}

	if (inFlightRequests.has(cacheKey)) {
		return inFlightRequests.get(cacheKey);
	}

	logToFile("BOOK_ISBN_LOOKUP_CACHE", {
		status: "INFO",
		cache: "miss",
		provider,
		resource,
		identifier
	}, "info");

	const requestPromise = (async () => {
		try {
			const payload = await fetchJsonWithTimeout(url, { timeoutMs, headers });
			setCacheEntry(cacheKey, payload, ttlSeconds);
			recordExternalCacheEntry(cacheKey);
			negativeCacheStore.delete(negativeCacheKey);
			return payload;
		} catch (error) {
			if (shouldNegativeCache(error)) {
				setNegativeCacheEntry(negativeCacheKey, error, NEGATIVE_CACHE_TTL_SECONDS);
			}
			throw error;
		} finally {
			inFlightRequests.delete(cacheKey);
		}
	})();

	inFlightRequests.set(cacheKey, requestPromise);
	return requestPromise;
}

function resolveBookTypeDescription(name) {
	return BOOK_TYPE_CATALOG[name] || null;
}

function inferBookTypeFromHints(hints) {
	const normalizedHints = (Array.isArray(hints) ? hints : [hints])
		.map((value) => sanitizeLookupText(value, 120))
		.filter(Boolean);
	if (normalizedHints.length === 0) return null;

	const rules = [
		{
			name: "Hardcover",
			patterns: [/\bhard\s?cover\b/i, /\bhardback\b/i, /\bcasebound\b/i]
		},
		{
			name: "Softcover",
			patterns: [/\bpaperback\b/i, /\bsoft\s?cover\b/i, /\bsoftback\b/i, /\bmass market paperback\b/i, /\btrade paperback\b/i, /\bpbk\b/i]
		},
		{
			name: "Magazine",
			patterns: [/\bmagazine\b/i, /\bperiodical\b/i, /\bjournal\b/i]
		},
		{
			name: "Pamphlet",
			patterns: [/\bpamphlet\b/i, /\bbooklet\b/i, /\bleaflet\b/i]
		}
	];

	for (const rule of rules) {
		const matchedHint = normalizedHints.find((hint) => rule.patterns.some((pattern) => pattern.test(hint)));
		if (matchedHint) {
			return {
				id: null,
				name: rule.name,
				description: resolveBookTypeDescription(rule.name),
				sourceHint: matchedHint
			};
		}
	}
	return null;
}

function pickBetterPublisher(currentValue, nextValue) {
	if (!nextValue?.name) return currentValue || null;
	if (!currentValue?.name) return {
		id: null,
		name: nextValue.name,
		foundedDate: nextValue.foundedDate || null,
		website: nextValue.website || null,
		notes: nextValue.notes || null
	};
	return {
		id: currentValue.id ?? null,
		name: pickBetterString(currentValue.name, nextValue.name, { maxLength: 150 }),
		foundedDate: pickBetterDate(currentValue.foundedDate, nextValue.foundedDate),
		website: pickBetterString(currentValue.website, nextValue.website, { maxLength: 300 }),
		notes: pickBetterString(currentValue.notes, nextValue.notes, { maxLength: 1000 })
	};
}

function mergeLookupAuthors(items) {
	const merged = [];
	const indexByKey = new Map();
	for (const item of items || []) {
		const key = normalizeLookupCompact(item?.authorName || item?.displayName || "");
		if (!key) continue;
		if (!indexByKey.has(key)) {
			indexByKey.set(key, merged.length);
			merged.push({
				authorId: null,
				authorRole: item.authorRole || null,
				authorName: item.authorName || item.displayName || null,
				displayName: item.displayName || item.authorName || null,
				firstNames: item.firstNames || null,
				lastName: item.lastName || null,
				birthDate: item.birthDate || null,
				deathDate: item.deathDate || null,
				deceased: Boolean(item.deceased || item.deathDate),
				bio: item.bio || null
			});
			continue;
		}
		const existing = merged[indexByKey.get(key)];
		existing.authorRole = existing.authorRole || item.authorRole || null;
		existing.authorName = pickBetterString(existing.authorName, item.authorName, { maxLength: 150 });
		existing.displayName = pickBetterString(existing.displayName, item.displayName, { maxLength: 150 });
		existing.firstNames = pickBetterString(existing.firstNames, item.firstNames, { maxLength: 150 });
		existing.lastName = pickBetterString(existing.lastName, item.lastName, { maxLength: 100 });
		existing.birthDate = pickBetterDate(existing.birthDate, item.birthDate);
		existing.deathDate = pickBetterDate(existing.deathDate, item.deathDate);
		existing.deceased = Boolean(existing.deceased || item.deceased || existing.deathDate || item.deathDate);
		existing.bio = pickBetterString(existing.bio, item.bio, { maxLength: 1000 });
	}
	return merged;
}

function mergeLookupSeries(items) {
	const merged = [];
	const indexByKey = new Map();
	for (const item of items || []) {
		const key = normalizeLookupCompact(item?.seriesName || item?.name || "");
		if (!key) continue;
		if (!indexByKey.has(key)) {
			indexByKey.set(key, merged.length);
			merged.push({
				seriesId: null,
				seriesName: item.seriesName || item.name || null,
				name: item.seriesName || item.name || null,
				bookOrder: Number.isInteger(item.bookOrder) ? item.bookOrder : null,
				description: item.description || null,
				website: item.website || null
			});
			continue;
		}
		const existing = merged[indexByKey.get(key)];
		existing.seriesName = pickBetterString(existing.seriesName, item.seriesName || item.name, { maxLength: 150 });
		existing.name = existing.seriesName;
		if (!Number.isInteger(existing.bookOrder) && Number.isInteger(item.bookOrder)) {
			existing.bookOrder = item.bookOrder;
		}
		existing.description = pickBetterString(existing.description, item.description, { maxLength: 1000 });
		existing.website = pickBetterString(existing.website, item.website, { maxLength: 300 });
	}
	return merged;
}

function pickBetterBookType(currentValue, nextValue, warnings) {
	if (!nextValue?.name) return currentValue || null;
	if (!currentValue?.name) return { ...nextValue };
	if (normalizeLookupCompact(currentValue.name) === normalizeLookupCompact(nextValue.name)) {
		return {
			...currentValue,
			description: pickBetterString(currentValue.description, nextValue.description, { maxLength: 1000 }) || currentValue.description || nextValue.description || null,
			sourceHint: currentValue.sourceHint || nextValue.sourceHint || null
		};
	}
	if (Array.isArray(warnings)) {
		warnings.push(`Lookup sources suggested different book types ('${currentValue.name}' and '${nextValue.name}'), so no type was applied automatically.`);
	}
	return null;
}

function mergeLookupMetadata({ isbn, providers, warnings }) {
	const merged = {
		title: null,
		subtitle: null,
		isbn: normalizeIsbnValue(isbn),
		publicationDate: null,
		pageCount: null,
		coverImageUrl: null,
		description: null,
		bookType: null,
		publisher: null,
		authors: [],
		languages: [],
		tags: [],
		series: []
	};

	const successfulProviders = (providers || []).filter(Boolean);
	for (const provider of successfulProviders) {
		merged.title = pickBetterString(merged.title, provider.title, { maxLength: MAX_TITLE_LENGTH });
		merged.subtitle = pickBetterString(merged.subtitle, provider.subtitle, { maxLength: MAX_SUBTITLE_LENGTH });
		merged.description = pickBetterString(merged.description, provider.description, { maxLength: MAX_DESCRIPTION_LENGTH });
		merged.publicationDate = pickBetterDate(merged.publicationDate, provider.publicationDate);
		merged.coverImageUrl = pickBetterCover(merged.coverImageUrl, provider.coverImageUrl);
		if (!merged.pageCount && Number.isInteger(provider.pageCount)) {
			merged.pageCount = provider.pageCount;
		}
		merged.publisher = pickBetterPublisher(merged.publisher, provider.publisher);
		merged.bookType = pickBetterBookType(merged.bookType, provider.bookType, warnings);
		merged.authors = mergeLookupAuthors([...(merged.authors || []), ...(provider.authors || [])]);
		merged.languages = mergeNamedItems([...(merged.languages || []), ...(provider.languages || [])], (item) => item.name);
		merged.tags = mergeNamedItems([...(merged.tags || []), ...(provider.tags || [])], (item) => item.name)
			.filter((item) => normalizeTagName(item.name));
		merged.series = mergeLookupSeries([...(merged.series || []), ...(provider.series || [])]);
	}

	if (!merged.title) {
		return null;
	}
	if (successfulProviders.length === 2) {
		const [first, second] = successfulProviders;
		if (first?.pageCount && second?.pageCount && first.pageCount !== second.pageCount) {
			warnings.push("Some book details differed between sources, so one valid page count was used.");
		}
		if (first?.publicationDate && second?.publicationDate) {
			const firstText = first.publicationDate.text || "";
			const secondText = second.publicationDate.text || "";
			if (firstText && secondText && firstText !== secondText) {
				warnings.push("Some publication details differed between sources, so the most complete date available was used.");
			}
		}
	}
	return merged;
}

module.exports = {
	MAX_TITLE_LENGTH,
	MAX_SUBTITLE_LENGTH,
	MAX_DESCRIPTION_LENGTH,
	MAX_TAG_LENGTH,
	normalizeLookupName,
	normalizeLookupCompact,
	sanitizeLookupText,
	sanitizeLookupDescription,
	sanitizeLookupCoverUrl,
	sanitizeLookupPageCount,
	buildPartialDate,
	parsePartialDateFromSource,
	pickBetterString,
	pickBetterDate,
	pickBetterCover,
	mergeNamedItems,
	deriveLanguageName,
	splitAuthorNameParts,
	normalizeIsbnValue,
	extractStringValue,
	fetchJsonWithTimeout,
	fetchCachedJson,
	inferBookTypeFromHints,
	resolveBookTypeDescription,
	mergeLookupMetadata,
	NEGATIVE_CACHE_TTL_SECONDS,
	MAX_EXTERNAL_CACHE_ENTRIES
};
