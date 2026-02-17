const appInitializationDeferred = {};
window.appInitializationPromise = new Promise((resolve) => {
	appInitializationDeferred.resolve = resolve;
});

const pageContentDeferred = {};
window.pageContentReady = window.pageContentReady || {};
window.pageContentReady.promise = new Promise((resolve) => {
	pageContentDeferred.resolve = resolve;
});
window.pageContentReady.resolve = (payload) => {
	if (pageContentDeferred.resolve) {
		pageContentDeferred.resolve(payload);
		pageContentDeferred.resolve = null;
	}
};
window.pageContentReady.reset = () => {
	const deferred = {};
	const promise = new Promise((resolve) => {
		deferred.resolve = resolve;
	});
	window.pageContentReady.promise = promise;
	window.pageContentReady.resolve = (payload) => {
		if (deferred.resolve) {
			deferred.resolve(payload);
			deferred.resolve = null;
		}
	};
};
window.pageContentReady.resolve({ success: true, default: true });

function renderApiErrorAlert(alertEl, apiResponse = {}, fallbackMessage = 'Request failed.') {
	if (!alertEl) return;
	const message = apiResponse.message || fallbackMessage;
	const errors = Array.isArray(apiResponse.errors) ? apiResponse.errors.filter(Boolean) : [];
	const detail = errors.length ? `: ${errors.join(' ')}` : '';
	alertEl.innerHTML = '';
	const strong = document.createElement('strong');
	strong.textContent = message;
	alertEl.appendChild(strong);
	if (detail) {
		alertEl.appendChild(document.createTextNode(detail));
	}
	alertEl.classList.remove('d-none');
}

function clearApiAlert(alertEl) {
	if (!alertEl) return;
	alertEl.classList.add('d-none');
	alertEl.innerHTML = '';
}

window.renderApiErrorAlert = renderApiErrorAlert;
window.clearApiAlert = clearApiAlert;

const THEME_STORAGE_KEY = 'themePreference';
const THEME_VALUES = new Set(['device', 'light', 'dark']);

function normalizeThemePreference(value) {
	if (!value) return 'device';
	const normalized = String(value).trim().toLowerCase();
	if (normalized === 'system') return 'device';
	return THEME_VALUES.has(normalized) ? normalized : 'device';
}

function resolveSystemTheme() {
	try {
		return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	} catch (error) {
		return 'light';
	}
}

function applyTheme(preference) {
	const normalized = normalizeThemePreference(preference);
	const resolved = normalized === 'device' ? resolveSystemTheme() : normalized;
	document.documentElement.setAttribute('data-bs-theme', resolved);
	return { preference: normalized, resolved };
}

function setThemePreference(preference, { persist = true } = {}) {
	const normalized = normalizeThemePreference(preference);
	if (persist) {
		try {
			localStorage.setItem(THEME_STORAGE_KEY, normalized);
		} catch (error) {
			console.warn('[Theme] Unable to persist preference.', error);
		}
	}
	return applyTheme(normalized);
}

function getStoredThemePreference() {
	try {
		return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
	} catch (error) {
		return 'device';
	}
}

function watchSystemThemeChanges() {
	if (!window.matchMedia) return;
	const media = window.matchMedia('(prefers-color-scheme: dark)');
	const handler = () => {
		const pref = getStoredThemePreference();
		if (pref === 'device') {
			applyTheme(pref);
		}
	};
	try {
		media.addEventListener('change', handler);
	} catch (error) {
		media.addListener(handler);
	}
}

window.themeManager = {
	getPreference: getStoredThemePreference,
	setPreference: setThemePreference,
	apply: applyTheme
};

document.addEventListener('DOMContentLoaded', () => {
	applyTheme(getStoredThemePreference());
	watchSystemThemeChanges();
});

window.modalLock = window.modalLock || {};
window.modalLock.registry = window.modalLock.registry || {};
window.modalLock.watchdogTimeoutMs = window.modalLock.watchdogTimeoutMs || 25000;
window.modalLock.showWatchdogAlert = (element, message = 'Something went wrong. The form has been unlocked. Please try again.') => {
	if (!element) return;
	const container = element.querySelector('.modal-body') || element;
	let alert = element.querySelector('.modal-lock-watchdog');
	if (!alert) {
		alert = document.createElement('div');
		alert.className = 'alert alert-warning modal-lock-watchdog';
		container.prepend(alert);
	}
	alert.textContent = message;
	alert.classList.remove('d-none');
};
window.modalLock.forceUnlock = (modal, reason = 'watchdog') => {
	const element = window.modalLock.getElement(modal);
	const id = element?.id || (typeof modal === 'string' ? modal : 'unknown');
	const registry = window.modalLock.registry;
	const entry = registry[id] || { lockCount: 0, locked: false };
	console.error(`[ModalLock] Force unlock triggered for ${id}`, { reason, entry });
	entry.lockCount = 1;
	entry.locked = false;
	registry[id] = entry;
	window.modalLock.unlock(element || id, reason);
};
window.modalLock.scheduleWatchdog = (id, element) => {
	const registry = window.modalLock.registry;
	const entry = registry[id];
	if (!entry) return;
	if (entry.watchdogTimer) clearTimeout(entry.watchdogTimer);
	entry.watchdogTimer = setTimeout(() => {
		const current = registry[id];
		if (!current || current.lockCount <= 0) return;
		console.error(`[ModalLock] Watchdog timeout reached for ${id}; forcing unlock.`, { lockCount: current.lockCount, action: current.actionName });
		window.modalLock.showWatchdogAlert(element, 'Something went wrong. The form has been unlocked. Please try again.');
		window.modalLock.forceUnlock(element || id, 'watchdog');
	}, window.modalLock.watchdogTimeoutMs);
};
window.modalLock.getElement = (modal) => (typeof modal === 'string' ? document.getElementById(modal) : modal);
window.modalLock.countDisabled = (element) => {
	if (!element) return 0;
	return element.querySelectorAll('button:disabled, input:disabled, select:disabled, textarea:disabled').length;
};
window.modalLock.collectControls = (element) => (element
	? Array.from(element.querySelectorAll('button, input, select, textarea'))
	: []);
window.modalLock.lock = (modal, action) => {
	const element = window.modalLock.getElement(modal);
	const id = element?.id || (typeof modal === 'string' ? modal : 'unknown');
	const registry = window.modalLock.registry;
	const entry = registry[id] || { lockCount: 0, locked: false };
	const wasLocked = entry.lockCount > 0;
	entry.lockCount += 1;
	entry.locked = true;
	entry.lockedAt = new Date().toISOString();
	entry.actionName = action || entry.actionName || 'unknown';
	registry[id] = entry;
	if (entry.lockCount === 1) {
		window.modalLock.scheduleWatchdog(id, element);
	}
	let disabledCount = window.modalLock.countDisabled(element);
	const closeButtons = element ? element.querySelectorAll('[data-bs-dismiss="modal"], .btn-close') : [];
	if (element && !wasLocked) {
		const controls = window.modalLock.collectControls(element);
		controls.forEach((control) => {
			if (!control.disabled) {
				control.dataset.modalLock = 'true';
				control.disabled = true;
			}
		});
		closeButtons.forEach((btn) => {
			if (!btn.disabled) {
				btn.dataset.modalLockClose = 'true';
				btn.disabled = true;
			}
		});
		element.dataset.modalLocked = 'true';
		disabledCount = window.modalLock.countDisabled(element);
	}
	console.log(`[ModalLock] Locking modal ${id} for action ${entry.actionName}`, {
		found: Boolean(element),
		lockCount: entry.lockCount,
		disabledCount,
		closeButtons: closeButtons.length,
		appliedDataset: element ? { modalLocked: element.dataset.modalLocked } : null
	});
	console.log('[ModalLock] Registry state', JSON.parse(JSON.stringify(registry)));
};
window.modalLock.unlock = (modal, reason = 'finally') => {
	const element = window.modalLock.getElement(modal);
	const id = element?.id || (typeof modal === 'string' ? modal : 'unknown');
	const registry = window.modalLock.registry;
	const entry = registry[id] || { lockCount: 0, locked: false };
	entry.lockCount = Math.max(0, (entry.lockCount || 0) - 1);
	if (entry.lockCount === 0) {
		entry.locked = false;
		entry.unlockedAt = new Date().toISOString();
		if (entry.watchdogTimer) {
			clearTimeout(entry.watchdogTimer);
			entry.watchdogTimer = null;
		}
	}
	registry[id] = entry;
	try {
		let disabledCount = window.modalLock.countDisabled(element);
		const closeButtons = element ? element.querySelectorAll('[data-bs-dismiss="modal"], .btn-close') : [];
		if (element && entry.lockCount === 0) {
			const controls = window.modalLock.collectControls(element);
			let restoredCount = 0;
			controls.forEach((control) => {
				if (control.dataset.modalLock === 'true') {
					control.disabled = false;
					delete control.dataset.modalLock;
					restoredCount += 1;
				}
			});
			closeButtons.forEach((btn) => {
				if (btn.dataset.modalLockClose === 'true') {
					btn.disabled = false;
					delete btn.dataset.modalLockClose;
				}
			});
			delete element.dataset.modalLocked;
			disabledCount = window.modalLock.countDisabled(element);
			console.log('[ModalLock] Restored controls', { id, restoredCount });
		}
		console.log(`[ModalLock] Unlocking modal ${id} (reason: ${reason})`, {
			found: Boolean(element),
			lockCount: entry.lockCount,
			disabledCount,
			closeButtons: closeButtons.length,
			removedDataset: element ? { modalLocked: element.dataset.modalLocked } : null
		});
		if (!element) {
			console.warn('[ModalLock] Unlock invoked but modal element not found.', { id, reason });
		}
	} catch (error) {
		console.error('[ModalLock] Unlock threw an exception.', { id, reason, error });
	} finally {
		console.log('[ModalLock] Registry state', JSON.parse(JSON.stringify(registry)));
	}
};
window.modalLock.withLock = async function withLock({ modal, action, lock, unlock }, fn) {
	if (typeof lock === 'function') lock(true);
	window.modalLock.lock(modal, action);
	try {
		return await fn();
	} finally {
		try {
			if (typeof unlock === 'function') unlock(false);
		} catch (error) {
			console.error('[ModalLock] Unlock handler threw.', { action, error });
		}
		window.modalLock.unlock(modal, 'finally');
	}
};

window.modalStack = window.modalStack || (function createModalStack() {
	const stack = [];

	const resolveElement = (modalId) => (typeof modalId === 'string' ? document.getElementById(modalId) : modalId);

	const show = async (modalId, options) => {
		if (window.modalManager && typeof window.modalManager.showModal === 'function') {
			await window.modalManager.showModal(modalId, options);
			return;
		}
		const element = resolveElement(modalId);
		if (!element) return;
		bootstrap.Modal.getOrCreateInstance(element, options || {}).show();
	};

	const hide = async (modalId) => {
		if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
			await window.modalManager.hideModal(modalId);
			return;
		}
		const element = resolveElement(modalId);
		if (!element) return;
		const instance = bootstrap.Modal.getInstance(element);
		if (instance) instance.hide();
	};

	const push = async (parentModalId, childModalId, options) => {
		if (!parentModalId || !childModalId) return;
		console.log('[ModalStack] push', { parentModalId, childModalId });
		stack.push({ parentModalId, childModalId });
		await hide(parentModalId);
		await show(childModalId, options || { backdrop: 'static', keyboard: false });
	};

	const pop = async (childModalId) => {
		if (!stack.length) return;
		const top = stack[stack.length - 1];
		if (childModalId && top.childModalId !== childModalId) return;
		stack.pop();
		console.log('[ModalStack] pop', { parentModalId: top.parentModalId, childModalId: top.childModalId });
		await show(top.parentModalId, { backdrop: 'static', keyboard: false });
	};

	return { push, pop };
})();

window.authGuard = window.authGuard || {};

window.authSessionManager = window.authSessionManager || (function createAuthSessionManager() {
	const RETURN_TO_STORAGE_KEY = 'returnToUrl';
	const FLASH_STORAGE_KEY = 'authFlashMessage';
	const listeners = new Set();
	const state = {
		status: 'unknown',
		token: null,
		refreshToken: null,
		user: null,
		lastAttemptedRoute: null,
		initializationStarted: false,
		initializationPromise: null,
		logoutInProgress: false
	};

	function notify() {
		const snapshot = { ...state };
		listeners.forEach((listener) => {
			try {
				listener(snapshot);
			} catch (error) {
				console.error('[Auth Session] Subscriber failed.', error);
			}
		});
	}

	function setStatus(nextStatus) {
		if (state.status === nextStatus) return;
		state.status = nextStatus;
		notify();
	}

	function normalizePath(pathname) {
		if (!pathname) return '';
		const normalized = pathname.replace(/\/+$/, '');
		if (!normalized) return '/';
		return normalized.toLowerCase();
	}

	function isLoginPath(pathname = window.location.pathname) {
		const normalized = normalizePath(pathname);
		return normalized === '/' || normalized === '/index' || normalized === '/index.html';
	}

	function isPublicPath(pathname = window.location.pathname) {
		const normalized = normalizePath(pathname);
		if (isLoginPath(normalized)) return true;
		const publicPaths = new Set([
			'/reset-password',
			'/verify-email',
			'/verify-delete',
			'/verify-account-deletion',
			'/verify-email-change',
			'/privacy-policy',
			'/404',
			'/health'
		]);
		return publicPaths.has(normalized);
	}

	function buildReturnTo() {
		try {
			return `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
		} catch (error) {
			return null;
		}
	}

	function setLastAttemptedRoute(route, { force = false } = {}) {
		const target = typeof route === 'string' ? route : buildReturnTo();
		if (!target) return null;
		try {
			const parsed = new URL(target, window.location.origin);
			const nextRoute = parsed.pathname + parsed.search + parsed.hash;
			if (isLoginPath(parsed.pathname)) return null;
			if (!force) {
				const existing = sessionStorage.getItem(RETURN_TO_STORAGE_KEY);
				if (existing) {
					state.lastAttemptedRoute = existing;
					return existing;
				}
			}
			sessionStorage.setItem(RETURN_TO_STORAGE_KEY, nextRoute);
			state.lastAttemptedRoute = nextRoute;
			notify();
			return nextRoute;
		} catch (error) {
			return null;
		}
	}

	function consumeLastAttemptedRoute() {
		try {
			const stored = sessionStorage.getItem(RETURN_TO_STORAGE_KEY);
			if (!stored) return null;
			sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
			state.lastAttemptedRoute = null;
			notify();
			return stored;
		} catch (error) {
			return null;
		}
	}

	function clearLastAttemptedRoute() {
		try {
			sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
		} catch (error) {
			// ignore
		}
		state.lastAttemptedRoute = null;
		notify();
	}

	function setFlashMessage(message, type = 'warning') {
		if (!message) return;
		try {
			sessionStorage.setItem(FLASH_STORAGE_KEY, JSON.stringify({ message, type }));
		} catch (error) {
			console.warn('[Auth Session] Unable to persist flash message.', error);
		}
	}

	function consumeFlashMessage() {
		try {
			const raw = sessionStorage.getItem(FLASH_STORAGE_KEY);
			if (!raw) return null;
			sessionStorage.removeItem(FLASH_STORAGE_KEY);
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed.message !== 'string') return null;
			return {
				message: parsed.message,
				type: typeof parsed.type === 'string' ? parsed.type : 'warning'
			};
		} catch (error) {
			return null;
		}
	}

	function upsertSessionMessageBanner(payload) {
		if (!payload || !payload.message) return;
		let container = document.getElementById('sessionMessageBanner');
		if (!container) {
			container = document.createElement('div');
			container.id = 'sessionMessageBanner';
			container.className = 'container mt-3';
			const target = document.querySelector('body > section') || document.querySelector('main') || document.body.firstElementChild || document.body;
			if (target && target.parentNode) {
				target.parentNode.insertBefore(container, target);
			} else {
				document.body.prepend(container);
			}
		}
		const type = payload.type || 'warning';
		container.innerHTML = `
			<div class="alert alert-${type} alert-dismissible fade show" role="status">
				${payload.message}
				<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
			</div>
		`;
	}

	function getStoredToken() {
		return localStorage.getItem('accessToken');
	}

	function getStoredRefreshToken() {
		return localStorage.getItem('refreshToken');
	}

	function parseStoredUser() {
		const raw = localStorage.getItem('userProfile');
		if (!raw) return null;
		try {
			return JSON.parse(raw);
		} catch (error) {
			return null;
		}
	}

	function syncStateFromStorage() {
		state.token = getStoredToken();
		state.refreshToken = getStoredRefreshToken();
		state.user = parseStoredUser();
	}

	function setToken(token) {
		if (token) {
			localStorage.setItem('accessToken', token);
			state.token = token;
		} else {
			localStorage.removeItem('accessToken');
			state.token = null;
		}
		notify();
	}

	function setRefreshToken(token) {
		if (token) {
			localStorage.setItem('refreshToken', token);
			state.refreshToken = token;
		} else {
			localStorage.removeItem('refreshToken');
			state.refreshToken = null;
		}
		notify();
	}

	function setUser(user) {
		if (user) {
			localStorage.setItem('userProfile', JSON.stringify(user));
			state.user = user;
		} else {
			localStorage.removeItem('userProfile');
			state.user = null;
		}
		notify();
	}

	function clearToken() {
		setToken(null);
	}

	function clearLocalSession() {
		localStorage.removeItem('accessToken');
		localStorage.removeItem('refreshToken');
		localStorage.removeItem('userProfile');
		state.token = null;
		state.refreshToken = null;
		state.user = null;
		notify();
	}

	function setAuthenticatedSession({ accessToken, refreshToken, user }) {
		if (accessToken) setToken(accessToken);
		if (refreshToken) setRefreshToken(refreshToken);
		if (user) setUser(user);
		setStatus('authenticated');
	}

	function isAuthenticated() {
		return state.status === 'authenticated';
	}

	async function validateSession({ source = 'startup' } = {}) {
		syncStateFromStorage();
		if (!state.token && !state.refreshToken) {
			setStatus('unauthenticated');
			return { valid: false, reason: 'missing-token' };
		}

		setStatus('loading');
		try {
			const response = await apiFetch('/users/me', { method: 'GET' });
			if (!response.ok) {
				if (response.status === 401 || response.status === 403) {
					clearLocalSession();
					setStatus('unauthenticated');
					return { valid: false, reason: `status-${response.status}` };
				}
				return { valid: false, reason: `status-${response.status}` };
			}
			const payload = await response.json().catch(() => ({}));
			const profile = payload?.data || null;
			if (profile) {
				setUser({
					id: profile.id,
					email: profile.email,
					fullName: profile.fullName,
					preferredName: profile.preferredName,
					role: profile.role,
					themePreference: profile.themePreference || 'device'
				});
			}
			setStatus('authenticated');
			console.log('[Auth Session] Session validated.', { source });
			return { valid: true, profile };
		} catch (error) {
			console.error('[Auth Session] Session validation failed.', { source, error });
			if (error?.isNetworkError) {
				setStatus('unknown');
				return { valid: false, reason: 'network-error', networkError: true };
			}
			setStatus(state.token || state.refreshToken ? 'unknown' : 'unauthenticated');
			return { valid: false, reason: 'request-failed' };
		}
	}

	function redirectToLogin({ reason = 'auth-required', message = 'Please log in to continue.', captureRoute = true } = {}) {
		if (captureRoute && !isLoginPath()) {
			setLastAttemptedRoute();
		}
		setFlashMessage(message, 'warning');
		setStatus('unauthenticated');
		if (isLoginPath()) return;
		console.warn('[Auth Session] Redirecting to login.', { reason });
		window.location.href = '/';
	}

	async function initializeForCurrentRoute() {
		if (state.initializationPromise) {
			return state.initializationPromise;
		}
		state.initializationStarted = true;
		state.initializationPromise = (async () => {
			syncStateFromStorage();
			if (!state.token && !state.refreshToken) {
				setStatus('unauthenticated');
				if (!isPublicPath()) {
					redirectToLogin({
						reason: 'missing-session',
						message: 'Your session expired, please log in again.',
						captureRoute: true
					});
				}
				return { status: state.status };
			}

			const validation = await validateSession({ source: 'startup' });
			if (!validation.valid && !validation.networkError) {
				if (!isPublicPath()) {
					redirectToLogin({
						reason: 'invalid-session',
						message: 'Your session expired, please log in again.',
						captureRoute: true
					});
				} else {
					setFlashMessage('Your session expired, please log in again.', 'warning');
				}
			}
			return { status: state.status, validation };
		})();
		return state.initializationPromise;
	}

	async function handleUnauthorized({ reason = 'session-expired', message = 'Your session expired, please log in again.' } = {}) {
		if (state.logoutInProgress) return;
		state.logoutInProgress = true;
		try {
			if (!isLoginPath()) {
				setLastAttemptedRoute();
			}
			clearLocalSession();
			setStatus('unauthenticated');
			setFlashMessage(message, 'warning');
			if (!isLoginPath()) {
				window.location.href = '/';
			} else {
				upsertSessionMessageBanner({ message, type: 'warning' });
			}
		} finally {
			state.logoutInProgress = false;
		}
		console.warn('[Auth Session] Unauthorized flow completed.', { reason });
	}

	async function logout({ allDevices = false, reason = 'manual-logout', redirect = true } = {}) {
		const refreshToken = getStoredRefreshToken();
		const accessToken = getStoredToken();
		const payload = {
			refreshToken: refreshToken || undefined,
			allDevices: Boolean(allDevices)
		};

		if (refreshToken || allDevices) {
			try {
				const response = await fetch(new URL('/auth/logout', 'https://api.fjnel.co.za/').href, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
					},
					body: JSON.stringify(payload)
				});
				if (!response.ok) {
					console.warn('[Auth Session] Logout request returned non-success.', { status: response.status });
				}
			} catch (error) {
				console.warn('[Auth Session] Logout request failed; clearing local session anyway.', error);
			}
		}

		clearLocalSession();
		setStatus('unauthenticated');
		setFlashMessage('You have logged out successfully.', 'success');

		if (redirect) {
			window.location.href = '/';
		}
		console.log('[Auth Session] Logout complete.', { reason, allDevices: Boolean(allDevices) });
		return { success: true };
	}

	function subscribe(listener) {
		if (typeof listener !== 'function') return () => {};
		listeners.add(listener);
		listener({ ...state });
		return () => listeners.delete(listener);
	}

	return {
		getState: () => ({ ...state }),
		getStatus: () => state.status,
		getToken: () => state.token || getStoredToken(),
		getRefreshToken: () => state.refreshToken || getStoredRefreshToken(),
		getUser: () => state.user,
		isAuthenticated,
		setToken,
		clearToken,
		setRefreshToken,
		clearLocalSession,
		setUser,
		setAuthenticatedSession,
		setLastAttemptedRoute,
		consumeLastAttemptedRoute,
		clearLastAttemptedRoute,
		buildReturnTo,
		consumeFlashMessage,
		showMessageBanner: upsertSessionMessageBanner,
		validateSession,
		initializeForCurrentRoute,
		handleUnauthorized,
		logout,
		subscribe,
		isPublicPath,
		isLoginPath
	};
})();

window.authRedirect = window.authRedirect || {};
window.authRedirect.storageKey = 'returnToUrl';
window.authRedirect.buildReturnTo = function buildReturnTo() {
	return window.authSessionManager.buildReturnTo();
};
window.authRedirect.capture = function captureReturnTo({ url, force = false } = {}) {
	return window.authSessionManager.setLastAttemptedRoute(url, { force });
};
window.authRedirect.consume = function consumeReturnTo() {
	return window.authSessionManager.consumeLastAttemptedRoute();
};
window.authRedirect.clear = function clearReturnTo() {
	window.authSessionManager.clearLastAttemptedRoute();
};

window.authGuard.waitForMaintenance = async function waitForMaintenance() {
	const maintenancePromise = window.maintenanceModalPromise;
	if (maintenancePromise && typeof maintenancePromise.then === 'function') {
		try {
			await maintenancePromise;
		} catch (error) {
			console.warn('[Auth Guard] Maintenance promise rejected.', error);
		}
	}
};

window.authGuard.checkSessionAndPrompt = async function checkSessionAndPrompt({ waitForMaintenance = true } = {}) {
	if (waitForMaintenance) {
		await window.authGuard.waitForMaintenance();
	}

	const manager = window.authSessionManager;
	if (!manager) return true;
	await manager.initializeForCurrentRoute();
	const status = manager.getStatus();
	if (status === 'authenticated') return true;
	if (status === 'loading' || status === 'unknown') return false;

	await manager.handleUnauthorized({
		reason: 'guard-blocked',
		message: 'Your session expired, please log in again.'
	});
	return false;
};

window.rateLimitGuard = window.rateLimitGuard || (function createRateLimitGuard() {
	let resetAt = null;
	let startedAt = null;
	const STORAGE_RESET_KEY = 'rateLimitResetAt';
	const STORAGE_START_KEY = 'rateLimitStartAt';

	function loadStoredTimes() {
		try {
			const storedReset = sessionStorage.getItem(STORAGE_RESET_KEY);
			const storedStart = sessionStorage.getItem(STORAGE_START_KEY);
			if (!storedReset) return null;
			const parsedReset = Number.parseInt(storedReset, 10);
			const parsedStart = storedStart ? Number.parseInt(storedStart, 10) : null;
			if (!Number.isFinite(parsedReset)) return null;
			if (parsedReset <= Date.now()) {
				sessionStorage.removeItem(STORAGE_RESET_KEY);
				sessionStorage.removeItem(STORAGE_START_KEY);
				return null;
			}
			return {
				resetAt: parsedReset,
				startedAt: Number.isFinite(parsedStart) ? parsedStart : null
			};
		} catch (error) {
			return null;
		}
	}

	function storeTimes({ reset, start }) {
		resetAt = reset;
		startedAt = start || Date.now();
		try {
			sessionStorage.setItem(STORAGE_RESET_KEY, String(resetAt));
			sessionStorage.setItem(STORAGE_START_KEY, String(startedAt));
		} catch (error) {
			// Ignore storage errors.
		}
	}

	function parseRateLimitReset(response) {
		const retryAfter = response.headers.get('Retry-After') || response.headers.get('retry-after');
		if (retryAfter) {
			const seconds = Number.parseInt(retryAfter, 10);
			if (Number.isFinite(seconds)) {
				return Date.now() + seconds * 1000;
			}
			const parsedDate = Date.parse(retryAfter);
			if (!Number.isNaN(parsedDate)) {
				return parsedDate;
			}
		}
		const resetHeader = response.headers.get('X-RateLimit-Reset') || response.headers.get('x-ratelimit-reset');
		if (resetHeader) {
			const seconds = Number.parseInt(resetHeader, 10);
			if (Number.isFinite(seconds)) {
				return seconds < 10_000_000_000 ? seconds * 1000 : seconds;
			}
		}
		return Date.now() + 60 * 1000;
	}

	function record(response) {
		const existing = loadStoredTimes();
		if (existing && existing.resetAt > Date.now()) {
			resetAt = existing.resetAt;
			startedAt = existing.startedAt || existing.resetAt - 60 * 1000;
			if (!existing.startedAt) {
				storeTimes({ reset: existing.resetAt, start: startedAt });
			}
			console.log('[Rate Limit] Using stored reset time:', new Date(resetAt).toISOString());
			return;
		}
		const nextReset = parseRateLimitReset(response);
		const now = Date.now();
		storeTimes({ reset: nextReset, start: now });
		console.log('[Rate Limit] Recorded reset time:', new Date(resetAt).toISOString());
	}

	async function showModal({ modalId = 'rateLimitModal' } = {}) {
		if (!resetAt || !startedAt) {
			const storedTimes = loadStoredTimes();
			if (storedTimes) {
				resetAt = storedTimes.resetAt;
				startedAt = storedTimes.startedAt || storedTimes.resetAt - 60 * 1000;
			}
		}
		if (!resetAt) return false;
		const modalEl = document.getElementById(modalId);
		const resetTimeEl = document.getElementById('rateLimitResetTime');
		const progressEl = document.getElementById('rateLimitProgress');
		if (!modalEl) return false;

		if (window.authGuard && typeof window.authGuard.waitForMaintenance === 'function') {
			await window.authGuard.waitForMaintenance();
		}

		const startTime = Math.min(startedAt || Date.now(), resetAt);
		const endTime = resetAt;
		if (resetTimeEl) {
			resetTimeEl.textContent = new Date(endTime).toLocaleTimeString();
		}

		if (window.modalManager && typeof window.modalManager.showModal === 'function') {
			await window.modalManager.showModal(modalEl, { backdrop: 'static', keyboard: false });
		} else if (window.bootstrap && window.bootstrap.Modal) {
			const instance = window.bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: 'static', keyboard: false });
			instance.show();
		} else {
			modalEl.style.display = 'block';
		}

		const updateProgress = () => {
			const now = Date.now();
			const total = Math.max(endTime - startTime, 1000);
			const elapsed = Math.min(Math.max(now - startTime, 0), total);
			const percent = Math.min(Math.max((elapsed / total) * 100, 0), 100);
			if (progressEl) {
				progressEl.style.width = `${percent.toFixed(1)}%`;
			}
		};

		updateProgress();
		//Progress bar update interval
		const interval = setInterval(updateProgress, 50);
		const delay = Math.max(endTime - Date.now(), 0) + 2000;
		setTimeout(() => {
			clearInterval(interval);
			window.location.reload();
		}, delay);
		return true;
	}

	function hasReset() {
		if (resetAt && resetAt > Date.now()) {
			return true;
		}
		const stored = loadStoredTimes();
		if (stored) {
			resetAt = stored.resetAt;
			startedAt = stored.startedAt || stored.resetAt - 60 * 1000;
			return true;
		}
		return false;
	}

	return {
		record,
		showModal,
		hasReset
	};
})();

// Checks if the API is reachable
async function checkApiHealth() {
	console.log('[API Health Check] Checking API health...');
	const apiUrl = 'https://api.fjnel.co.za/'; // Root endpoint for health check

	try {
		const response = await apiFetch('/', { method: 'GET' });

		if (!response.ok) {
			console.error('[API Health Check] Failed:', response.status, response.statusText);
			return false;
		}

		const data = await response.json();
		const responseStatus = typeof data.status === 'string' ? data.status.toLowerCase() : null;
		const isSuccess = responseStatus === 'success' || (!responseStatus && response.ok);

        if (isSuccess) {
            const message = typeof data.message === 'string' ? data.message : 'API responded successfully.';
            console.log('[API Health Check] API is working:', message);
            return true;
        }

		console.error('[API Health Check] Unexpected API response:', data);
		return false;
	} catch (error) {
		console.error('[API Health Check] Error while checking API health:', error);
		return false;
	}
}


(function enableModalDelegation() {
    document.addEventListener('click', async (event) => {
        const trigger = event.target.closest('[data-bs-toggle="modal"]');
        if (!trigger) {
            return;
        }

        const targetSelector = trigger.getAttribute('data-bs-target') || trigger.getAttribute('href');
        if (!targetSelector || !targetSelector.startsWith('#')) {
            return;
        }

        const modalManager = window.modalManager;
        if (!modalManager || typeof modalManager.showModal !== 'function') {
            return;
        }

        const targetElement = document.querySelector(targetSelector);
        if (!targetElement || !targetElement.classList || !targetElement.classList.contains('modal')) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const parentModal = trigger.closest('.modal');
        if (parentModal && parentModal !== targetElement) {
            await modalManager.hideModal(parentModal);
        }

        await modalManager.showModal(targetElement);
    }, true);
})();

function getLoginRedirectUrl() {
	const base = '/';
	const returnTo = window.authSessionManager && typeof window.authSessionManager.buildReturnTo === 'function'
		? window.authSessionManager.buildReturnTo()
		: null;
	if (returnTo) {
		return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
	}
	return base;
}

window.getLoginRedirectUrl = getLoginRedirectUrl;

window.actionRouter = window.actionRouter || (function createActionRouter() {
	const registry = new Map();

	function normalizeAction(action) {
		return typeof action === 'string' ? action.trim().toLowerCase() : '';
	}

	function parseUrl() {
		try {
			const url = new URL(window.location.href);
			const action = normalizeAction(url.searchParams.get('action'));
			if (!action) return null;
			const params = {};
			url.searchParams.forEach((value, key) => {
				params[key] = value;
			});
			return { action, params, url };
		} catch (error) {
			return null;
		}
	}

	function removeParams(url, keys = []) {
		if (!url) return;
		url.searchParams.delete('action');
		keys.forEach((key) => url.searchParams.delete(key));
		const nextQuery = url.searchParams.toString();
		const nextUrl = url.pathname + (nextQuery ? `?${nextQuery}` : '') + url.hash;
		window.history.replaceState({}, document.title, nextUrl);
	}

	async function run({ source = 'auto' } = {}) {
		const parsed = parseUrl();
		if (!parsed) return { ran: false, reason: 'no-action' };
		const entry = registry.get(parsed.action);
		if (!entry) {
			console.warn('[Action Router] No handler registered for action.', parsed.action);
			return { ran: false, reason: 'unregistered' };
		}
		if (window.authGuard && typeof window.authGuard.checkSessionAndPrompt === 'function') {
			const ok = await window.authGuard.checkSessionAndPrompt({ waitForMaintenance: true });
			if (!ok) return { ran: false, reason: 'auth-required' };
		}
		if (window.pageContentReady?.promise) {
			try {
				await window.pageContentReady.promise;
			} catch (error) {
				console.warn('[Action Router] Page readiness promise rejected.', error);
			}
		}
		await entry.handler({ action: parsed.action, params: parsed.params, source });
		if (entry.options?.removeQuery !== false) {
			removeParams(parsed.url, entry.options?.removeKeys || []);
		}
		return { ran: true };
	}

	function register(action, handler, options = {}) {
		const key = normalizeAction(action);
		if (!key || typeof handler !== 'function') return;
		registry.set(key, { handler, options });
	}

	return { register, run };
})();

window.authSession = window.authSession || {};
window.authSession.isAuthenticated = function isAuthenticated() {
	return window.authSessionManager?.isAuthenticated ? window.authSessionManager.isAuthenticated() : Boolean(localStorage.getItem('accessToken'));
};
window.authSession.setToken = function setToken(token) {
	if (window.authSessionManager?.setToken) {
		window.authSessionManager.setToken(token);
		return;
	}
	if (token) {
		localStorage.setItem('accessToken', token);
	} else {
		localStorage.removeItem('accessToken');
	}
};
window.authSession.clearToken = function clearToken() {
	window.authSession.setToken(null);
};
window.authSession.clearLocalSession = function clearLocalSession() {
	if (window.authSessionManager && typeof window.authSessionManager.clearLocalSession === 'function') {
		window.authSessionManager.clearLocalSession();
		return;
	}
	localStorage.removeItem('accessToken');
	localStorage.removeItem('refreshToken');
	localStorage.removeItem('userProfile');
};

window.authSession.logout = async function logoutSession({ allDevices = false } = {}) {
	const loadingModal = document.getElementById('pageLoadingModal');
	if (loadingModal && window.modalManager?.showModal) {
		await window.modalManager.showModal(loadingModal, { backdrop: 'static', keyboard: false });
	}

	try {
		if (window.authSessionManager && typeof window.authSessionManager.logout === 'function') {
			return await window.authSessionManager.logout({
				allDevices: Boolean(allDevices),
				reason: 'manual-logout',
				redirect: true
			});
		}
		window.authSession.clearLocalSession();
		window.location.href = getLoginRedirectUrl();
		return { success: true };
	} catch (error) {
		console.error('[Logout] Logout request failed.', error);
		return { success: false, error };
	} finally {
		if (loadingModal && window.modalManager?.hideModal) {
			await window.modalManager.hideModal(loadingModal);
		}
	}
};

function ensureLogoutModal() {
	if (document.getElementById('logoutConfirmModal')) {
		return document.getElementById('logoutConfirmModal');
	}

	const modal = document.createElement('div');
	modal.className = 'modal fade';
	modal.id = 'logoutConfirmModal';
	modal.tabIndex = -1;
	modal.setAttribute('aria-hidden', 'true');
	modal.innerHTML = `
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">Log out</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
				</div>
				<div class="modal-body">
					<p class="mb-2">How would you like to log out?</p>
					<p class="small text-muted mb-0">This device only ends the current session. All devices invalidates every active session for this account.</p>
					<div class="alert alert-danger d-none mt-3" id="logoutError"></div>
				</div>
				<div class="modal-footer">
					<button class="btn btn-primary" type="button" id="logoutDeviceBtn">This device only</button>
					<button class="btn btn-outline-danger" type="button" id="logoutAllBtn">All devices</button>
					<button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cancel</button>
				</div>
			</div>
		</div>
	`;
	document.body.appendChild(modal);
	return modal;
}

function attachLogoutHandlers() {
	const modal = ensureLogoutModal();
	if (!modal) return;

	const logoutButtons = document.querySelectorAll('.js-logout-btn');
	if (!logoutButtons.length) return;

	const deviceBtn = modal.querySelector('#logoutDeviceBtn');
	const allBtn = modal.querySelector('#logoutAllBtn');
	const errorEl = modal.querySelector('#logoutError');

	const showModal = async () => {
		if (errorEl) {
			errorEl.classList.add('d-none');
			errorEl.textContent = '';
		}
		if (window.modalManager?.showModal) {
			await window.modalManager.showModal(modal);
		} else if (window.bootstrap?.Modal) {
			window.bootstrap.Modal.getOrCreateInstance(modal).show();
		}
	};

	logoutButtons.forEach((btn) => {
		btn.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			showModal();
		});
	});

	const runLogout = async (allDevices) => {
		if (deviceBtn) deviceBtn.disabled = true;
		if (allBtn) allBtn.disabled = true;
		const result = await window.authSession.logout({ allDevices });
		if (!result || !result.success) {
			if (errorEl) {
				errorEl.textContent = 'Unable to log out right now. Please try again.';
				errorEl.classList.remove('d-none');
			}
			if (deviceBtn) deviceBtn.disabled = false;
			if (allBtn) allBtn.disabled = false;
		}
	};

	if (deviceBtn) {
		deviceBtn.addEventListener('click', () => runLogout(false));
	}
	if (allBtn) {
		allBtn.addEventListener('click', () => runLogout(true));
	}
}

window.attachLogoutHandlers = attachLogoutHandlers;

document.addEventListener('DOMContentLoaded', attachLogoutHandlers);

// Standard in-page loading pattern for list/lookup pages.
window.inPageLoading = window.inPageLoading || (function createInPageLoadingHelper() {
	function resolveElement(target) {
		if (!target) return null;
		if (typeof target === 'string') return document.getElementById(target);
		return target instanceof Element ? target : null;
	}

	function ensureMarkup(container) {
		if (!container) return;
		if (container.dataset.loadingTemplate === 'true') return;
		container.dataset.loadingTemplate = 'true';
		container.innerHTML = `
			<div class="spinner-border text-secondary mb-2" role="status" aria-hidden="true"></div>
			<div data-loading-message>Loading…</div>
		`;
	}

	function show({ target, message = 'Loading…', clearTargets = [] } = {}) {
		const container = resolveElement(target);
		if (!container) return;
		ensureMarkup(container);
		const messageEl = container.querySelector('[data-loading-message]');
		if (messageEl) messageEl.textContent = message;
		container.classList.remove('d-none');
		clearTargets.forEach((clearTarget) => {
			const el = resolveElement(clearTarget);
			if (el) el.innerHTML = '';
		});
	}

	function hide(target) {
		const container = resolveElement(target);
		if (!container) return;
		container.classList.add('d-none');
	}

	return { show, hide };
})();

let legacyPageLoadingModalInstance;

// Use global modal loading only for page-blocking startup flows.
function getPageLoadingMode() {
	const explicitMode = typeof window.pageLoadingMode === 'string' ? window.pageLoadingMode : '';
	if (explicitMode === 'inline') return 'inline';
	const bodyMode = document.body?.dataset?.pageLoadingMode;
	if (bodyMode === 'inline') return 'inline';
	return 'global';
}

function showPageLoadingModal() {
    console.log('[Modal] Showing Page Loading Modal');
    const modalElement = document.getElementById('pageLoadingModal');
    if (!modalElement) {
        console.warn('[Modal] Page Loading Modal element not found.');
        return;
    }

    if (window.modalManager && typeof window.modalManager.showModal === 'function') {
        window.modalManager.showModal(modalElement, { backdrop: 'static', keyboard: false });
        return;
    }

    if (!legacyPageLoadingModalInstance) {
        legacyPageLoadingModalInstance = new bootstrap.Modal(modalElement, {
            backdrop: 'static',
            keyboard: false
        });
    }
    legacyPageLoadingModalInstance.show();
    console.log('[Modal] Page Loading Modal shown (legacy fallback).');
}

async function hidePageLoadingModal() {
    console.log('[Modal] Hiding Page Loading Modal');
	const focusTarget = document.querySelector('[data-focus-default]')
		|| document.querySelector('.navbar-brand')
		|| document.querySelector('main')
		|| document.body;
	if (focusTarget && typeof focusTarget.focus === 'function') {
		let addedTabIndex = false;
		if (!focusTarget.hasAttribute('tabindex')) {
			focusTarget.setAttribute('tabindex', '-1');
			addedTabIndex = true;
		}
		focusTarget.focus({ preventScroll: true });
		if (addedTabIndex) {
			focusTarget.addEventListener('blur', () => focusTarget.removeAttribute('tabindex'), { once: true });
		}
	}
    await new Promise(resolve => setTimeout(resolve, 500)); // UX delay

    if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
        await window.modalManager.hideModal('pageLoadingModal');
        console.log('[Modal] Page Loading Modal hidden via modalManager.');
        return;
    }

    if (legacyPageLoadingModalInstance) {
        const modalElement = document.getElementById('pageLoadingModal');
        if (modalElement) {
            modalElement.addEventListener('hidden.bs.modal', () => {
                legacyPageLoadingModalInstance.dispose();
                legacyPageLoadingModalInstance = null;
            }, { once: true });
        }
        legacyPageLoadingModalInstance.hide();
        console.log('[Modal] Page Loading Modal hidden (legacy fallback).');
    } else {
        console.warn('[Modal] No modal instance to hide.');
    }
}

// Show modal if API is unreachable
async function showApiErrorModal() {
	console.log('[Modal] Showing API Error Modal');
	const modalElement = document.getElementById('apiErrorModal');
	if (!modalElement) {
		console.error('[Modal] API Error Modal element not found.');
		return;
	}

	if (window.modalManager && typeof window.modalManager.showModal === 'function') {
		await window.modalManager.showModal(modalElement, { backdrop: 'static', keyboard: false });
		return;
	}

	if (window.bootstrap && window.bootstrap.Modal) {
		const apiErrorModal = window.bootstrap.Modal.getOrCreateInstance(modalElement, { backdrop: 'static', keyboard: false });
		return new Promise((resolve) => {
			modalElement.addEventListener('shown.bs.modal', resolve, { once: true });
			apiErrorModal.show();
		});
	}

	modalElement.style.display = 'block';
	return Promise.resolve();
}

//Run checks on page load
async function initializeApp() {
	let apiHealthy = false;
	let authState = null;
	const useGlobalLoading = getPageLoadingMode() !== 'inline';
	try {
		if (useGlobalLoading) {
			showPageLoadingModal();
		}
		console.log('[Initialization] Waiting for API health check...');
		apiHealthy = await checkApiHealth();
		if (apiHealthy) {
			console.log('[Initialization] All checks passed.');
		} else {
			console.warn('[Initialization] API health check failed. Application may not function correctly.');
		}
		if (apiHealthy && window.authSessionManager && typeof window.authSessionManager.initializeForCurrentRoute === 'function') {
			const authResult = await window.authSessionManager.initializeForCurrentRoute();
			authState = authResult?.status || window.authSessionManager.getStatus();
			console.log('[Initialization] Auth state resolved:', authState);
		}
		if (window.pageContentReady && window.pageContentReady.promise) {
			console.log('[Initialization] Waiting for page content readiness...');
			const result = await window.pageContentReady.promise;
			console.log('[Initialization] Page content readiness resolved:', result);
		}
	} catch (error) {
		console.error('[Initialization] An unexpected error occurred:', error);
	} finally {
		if (useGlobalLoading) {
			console.log('[Initialization] Hiding page loading modal...');
			await hidePageLoadingModal();
			console.log('[Initialization] Page loading modal hidden.');
		}
	}

	if (!apiHealthy) {
		await showApiErrorModal();
	}
	if (window.authSessionManager && typeof window.authSessionManager.consumeFlashMessage === 'function') {
		const flash = window.authSessionManager.consumeFlashMessage();
		if (flash) {
			window.authSessionManager.showMessageBanner(flash);
		}
	}

	if (appInitializationDeferred.resolve) {
		appInitializationDeferred.resolve({ apiHealthy, authState });
	}
}

document.addEventListener('DOMContentLoaded', initializeApp);
