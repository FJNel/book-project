const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const pool = require('../db');
const { sanitizeInput, logToFile } = require('./logging');

const DEFAULT_MAX_BODY_BYTES = Number.parseInt(config?.logging?.maxBodyBytes, 10) || 20000;
const DEFAULT_MAX_HEADER_BYTES = Number.parseInt(config?.logging?.maxHeaderBytes, 10) || 8000;
const DEFAULT_MAX_QUERY_BYTES = Number.parseInt(config?.logging?.maxQueryBytes, 10) || 8000;

const SENSITIVE_HEADER_KEYS = new Set([
	'authorization',
	'cookie',
	'set-cookie',
	'x-api-key',
	'api-key',
	'proxy-authorization'
]);

function normalizeHeaderKey(key = '') {
	return String(key || '').trim().toLowerCase();
}

function sanitizeHeaders(headers = {}) {
	const sanitized = {};
	Object.entries(headers || {}).forEach(([key, value]) => {
		const normalizedKey = normalizeHeaderKey(key);
		if (!normalizedKey) return;
		if (SENSITIVE_HEADER_KEYS.has(normalizedKey)) {
			sanitized[normalizedKey] = '[REDACTED]';
			return;
		}
		sanitized[normalizedKey] = sanitizeInput(value, normalizedKey);
	});
	return sanitized;
}

function sanitizeAndSerialize(value, maxBytes) {
	try {
		const sanitized = sanitizeInput(value);
		const json = JSON.stringify(sanitized);
		const bytes = Buffer.byteLength(json || '', 'utf8');
		if (bytes > maxBytes) {
			return {
				data: json.slice(0, maxBytes),
				truncated: true,
				bytes
			};
		}
		return {
			data: sanitized,
			truncated: false,
			bytes
		};
	} catch (error) {
		return {
			data: '[UNSERIALIZABLE]',
			truncated: false,
			bytes: 0
		};
	}
}

function getRoutePattern(req) {
	if (!req) return null;
	if (req.route && req.route.path) {
		const base = req.baseUrl || '';
		return `${base}${req.route.path}`;
	}
	return null;
}

function getActorContext(req) {
	if (req?.authMethod === 'apiKey' && req.apiKey) {
		return {
			actorType: 'api_key',
			userId: req.user?.id ?? null,
			userEmail: req.user?.email ?? null,
			userRole: req.user?.role ?? null,
			apiKeyId: req.apiKey?.id ?? null,
			apiKeyLabel: req.apiKey?.name ?? null,
			apiKeyPrefix: req.apiKey?.prefix ?? null
		};
	}
	if (req?.user) {
		return {
			actorType: 'user',
			userId: req.user?.id ?? null,
			userEmail: req.user?.email ?? null,
			userRole: req.user?.role ?? null,
			apiKeyId: null,
			apiKeyLabel: null,
			apiKeyPrefix: null
		};
	}
	return {
		actorType: 'anonymous',
		userId: null,
		userEmail: null,
		userRole: null,
		apiKeyId: null,
		apiKeyLabel: null,
		apiKeyPrefix: null
	};
}

function computeCostUnits({ method, path, durationMs, responseBytes }) {
	const normalizedPath = String(path || '').toLowerCase();
	const normalizedMethod = String(method || '').toUpperCase();
	let endpointWeight = 1;
	if (normalizedPath.includes('/stats') || normalizedPath.includes('/search') || normalizedPath.includes('/timeline')) {
		endpointWeight = 4;
	} else if (normalizedPath.includes('/admin')) {
		endpointWeight = 3;
	} else if (normalizedPath.includes('/import') || normalizedPath.includes('/export')) {
		endpointWeight = 4;
	} else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
		endpointWeight = 2;
	}

	let durationWeight = 0;
	if (durationMs >= 3000) durationWeight = 3;
	else if (durationMs >= 1000) durationWeight = 2;
	else if (durationMs >= 200) durationWeight = 1;

	let sizeWeight = 0;
	if (responseBytes >= 100 * 1024) sizeWeight = 2;
	else if (responseBytes >= 10 * 1024) sizeWeight = 1;

	return endpointWeight + durationWeight + sizeWeight;
}

function summarizeError(responseBody) {
	if (!responseBody) return null;
	if (typeof responseBody === 'string') {
		return responseBody.slice(0, 240);
	}
	if (typeof responseBody === 'object') {
		const message = responseBody?.message || responseBody?.error || responseBody?.status;
		const errors = Array.isArray(responseBody?.errors) ? responseBody.errors.join(' | ') : null;
		return [message, errors].filter(Boolean).join(' - ').slice(0, 240) || null;
	}
	return null;
}

async function insertRequestLog(entry) {
	const text = `
		INSERT INTO request_logs (
			logged_at,
			level,
			category,
			correlation_id,
			method,
			path,
			route_pattern,
			query,
			headers,
			body,
			body_truncated,
			ip,
			user_agent,
			actor_type,
			user_id,
			user_email,
			user_role,
			api_key_id,
			api_key_label,
			api_key_prefix,
			status_code,
			response_body,
			response_truncated,
			duration_ms,
			error_summary,
			request_bytes,
			response_bytes,
			cost_units
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
		)`;
	const values = [
		entry.loggedAt,
		entry.level,
		entry.category,
		entry.correlationId,
		entry.method,
		entry.path,
		entry.routePattern,
		entry.query,
		entry.headers,
		entry.body,
		entry.bodyTruncated,
		entry.ip,
		entry.userAgent,
		entry.actorType,
		entry.userId,
		entry.userEmail,
		entry.userRole,
		entry.apiKeyId,
		entry.apiKeyLabel,
		entry.apiKeyPrefix,
		entry.statusCode,
		entry.responseBody,
		entry.responseTruncated,
		entry.durationMs,
		entry.errorSummary,
		entry.requestBytes,
		entry.responseBytes,
		entry.costUnits
	];
	try {
		await pool.query(text, values);
	} catch (error) {
		logToFile("REQUEST_LOG_INSERT", {
			status: "FAILURE",
			error_message: error.message
		}, "error");
	}
}

function attachCorrelationId(req, res, next) {
	const incoming = req.headers['x-correlation-id'];
	const correlationId = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : uuidv4();
	req.correlationId = correlationId;
	res.setHeader('X-Correlation-Id', correlationId);
	next();
}

function createRequestLogger() {
	return function requestLogger(req, res, next) {
		const startedAt = process.hrtime();
		const requestLoggedAt = new Date();
		const requestPayload = sanitizeAndSerialize(req.body || {}, DEFAULT_MAX_BODY_BYTES);
		const queryPayload = sanitizeAndSerialize(req.query || {}, DEFAULT_MAX_QUERY_BYTES);
		const headersPayload = sanitizeAndSerialize(sanitizeHeaders(req.headers || {}), DEFAULT_MAX_HEADER_BYTES);
		let responsePayload = null;

		const originalJson = res.json.bind(res);
		const originalSend = res.send.bind(res);

		res.json = (body) => {
			responsePayload = body;
			return originalJson(body);
		};

		res.send = (body) => {
			if (responsePayload === null) {
				responsePayload = body;
			}
			return originalSend(body);
		};

		res.on('finish', () => {
			const diff = process.hrtime(startedAt);
			const durationMs = Number((diff[0] * 1e3 + diff[1] / 1e6).toFixed(2));
			const responseSerialized = sanitizeAndSerialize(responsePayload, DEFAULT_MAX_BODY_BYTES);
			const actorContext = getActorContext(req);
			const costUnits = computeCostUnits({
				method: req.method,
				path: req.originalUrl || req.url,
				durationMs,
				responseBytes: responseSerialized.bytes
			});

			void insertRequestLog({
				loggedAt: requestLoggedAt,
				level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
				category: 'response',
				correlationId: req.correlationId || null,
				method: req.method,
				path: req.originalUrl || req.url,
				routePattern: getRoutePattern(req),
				query: queryPayload.data,
				headers: headersPayload.data,
				body: requestPayload.data,
				bodyTruncated: requestPayload.truncated,
				ip: req.ip || null,
				userAgent: req.get('user-agent') || null,
				actorType: actorContext.actorType,
				userId: actorContext.userId,
				userEmail: actorContext.userEmail,
				userRole: actorContext.userRole,
				apiKeyId: actorContext.apiKeyId,
				apiKeyLabel: actorContext.apiKeyLabel,
				apiKeyPrefix: actorContext.apiKeyPrefix,
				statusCode: res.statusCode,
				responseBody: responseSerialized.data,
				responseTruncated: responseSerialized.truncated,
				durationMs,
				errorSummary: res.statusCode >= 400 ? summarizeError(responsePayload) : null,
				requestBytes: requestPayload.bytes,
				responseBytes: responseSerialized.bytes,
				costUnits
			});
		});

		next();
	};
}

module.exports = {
	attachCorrelationId,
	createRequestLogger,
	sanitizeHeaders,
	sanitizeAndSerialize,
	computeCostUnits
};
