const config = require("../config");

const DEFAULT_USER_TTL_SECONDS = Number.parseInt(config?.stats?.userCacheTtlSeconds, 10) || 300;
const DEFAULT_ADMIN_TTL_SECONDS = Number.parseInt(config?.stats?.adminCacheTtlSeconds, 10) || 180;

const cacheStore = new Map();

function stableStringify(value) {
	if (value === null || value === undefined) return "";
	if (typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")} ]`;
	}
	const keys = Object.keys(value).sort();
	return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function buildCacheKey({ scope, userId, endpoint, params }) {
	const scopeKey = scope === "admin" ? "admin" : `user:${userId}`;
	const paramsKey = params ? stableStringify(params) : "";
	return `${scopeKey}:${endpoint}:${paramsKey}`;
}

function getCacheEntry(key) {
	const entry = cacheStore.get(key);
	if (!entry) return null;
	const ageMs = Date.now() - entry.createdAt;
	if (ageMs > entry.ttlMs) {
		cacheStore.delete(key);
		return null;
	}
	return {
		data: entry.data,
		ageSeconds: Math.floor(ageMs / 1000)
	};
}

function setCacheEntry(key, data, ttlSeconds) {
	const ttlMs = Math.max(1, ttlSeconds) * 1000;
	cacheStore.set(key, {
		data,
		createdAt: Date.now(),
		ttlMs
	});
}

function invalidateByPrefix(prefix) {
	for (const key of cacheStore.keys()) {
		if (key.startsWith(prefix)) {
			cacheStore.delete(key);
		}
	}
}

function invalidateUserStatsCache(userId) {
	if (!Number.isInteger(userId)) return;
	invalidateByPrefix(`user:${userId}:`);
}

function invalidateAdminStatsCache() {
	invalidateByPrefix("admin:");
}

module.exports = {
	DEFAULT_USER_TTL_SECONDS,
	DEFAULT_ADMIN_TTL_SECONDS,
	buildCacheKey,
	getCacheEntry,
	setCacheEntry,
	invalidateUserStatsCache,
	invalidateAdminStatsCache
};
