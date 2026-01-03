//Used to intercept HTTP requests and responses to enforce HTTPS and handle errors globally
//This file is included in all JS files to ensure consistent behavior across the application

//Its main usage:
// - Attach the access token to any API requests (that require authorisation)
// - If there is no error in the API response (2xx), just pass the response back
// - If the API responds with access token expired, the interceptor calls the refresh-token endpoint.
// - If the access token is refreshed successfully, the interceptor retries the original request that failed
// - If the refresh-token request fails (refresh token expired), clear all tokens (local storage), and
//   notify user and redirect user to login again
// - If any other error occurs, just pass the error back to the calling function to handle it

// -----------------------------------------------------------------------------
// Global Modal Manager
// Ensures only one Bootstrap modal is visible at a time across the application.
// -----------------------------------------------------------------------------
(function initModalManager() {
	if (window.modalManager) {
		return;
	}

	const Modal = window.bootstrap && window.bootstrap.Modal;
	if (!Modal) {
		console.error('[Modal Manager] Bootstrap Modal is required but not available.');
		window.modalManager = {
			showModal: () => Promise.reject(new Error('Bootstrap Modal is not available.')),
			hideModal: () => Promise.resolve(),
			getActiveModal: () => null,
			getActiveModalId: () => null
		};
		return;
	}

	const modalState = { active: null };

	function resolveElement(target) {
		if (!target) return null;
		if (typeof target === 'string') {
			return document.getElementById(target);
		}
		if (target instanceof Element) {
			return target;
		}
		return null;
	}

	function ensureBackdropExists() {
		if (document.querySelector('.modal-backdrop')) {
			return;
		}
		const backdrop = document.createElement('div');
		backdrop.className = 'modal-backdrop fade show';
		document.body.appendChild(backdrop);
	}

	function cleanupBackdrops() {
		const openModals = document.querySelectorAll('.modal.show');
		const backdrops = document.querySelectorAll('.modal-backdrop');
		if (openModals.length === 0) {
			document.body.classList.remove('modal-open');
			backdrops.forEach((bd) => bd.remove());
			return;
		}

		document.body.classList.add('modal-open');

		if (backdrops.length === 0) {
			ensureBackdropExists();
			return;
		}

		if (backdrops.length > 1) {
			backdrops.forEach((bd, index) => {
				if (index < backdrops.length - 1) {
					bd.remove();
				}
			});
		}
	}

	async function hideModal(target) {
		const element = resolveElement(target) || (modalState.active && modalState.active.element);
		if (!element) {
			return;
		}
		const instance = Modal.getInstance(element);
		if (!instance || !element.classList.contains('show')) {
			if (modalState.active && modalState.active.element === element) {
				modalState.active = null;
			}
			cleanupBackdrops();
			return;
		}
		await new Promise((resolve) => {
			element.addEventListener('hidden.bs.modal', () => {
				if (modalState.active && modalState.active.element === element) {
					modalState.active = null;
				}
				cleanupBackdrops();
				resolve();
			}, { once: true });
			instance.hide();
		});
	}

	async function showModal(target, options = {}) {
		const element = resolveElement(target);
		if (!element) {
			console.warn('[Modal Manager] Cannot show modal. Element not found for target:', target);
			return null;
		}

		if (modalState.active && modalState.active.element === element && element.classList.contains('show')) {
			return modalState.active.instance;
		}

		if (modalState.active && modalState.active.element !== element) {
			await hideModal(modalState.active.element);
		}

		const instance = Modal.getOrCreateInstance(element, options);
		modalState.active = { element, instance };

		return new Promise((resolve) => {
			element.addEventListener('shown.bs.modal', () => {
				cleanupBackdrops();
				resolve(instance);
			}, { once: true });
			instance.show();
		});
	}

	// Ensure only one modal is visible even if triggered via data attributes.
	document.addEventListener('show.bs.modal', (event) => {
		const activeElement = modalState.active && modalState.active.element;
		if (activeElement && activeElement !== event.target && activeElement.classList.contains('show')) {
			const activeInstance = Modal.getInstance(activeElement);
			if (activeInstance) {
				activeInstance.hide();
			}
		}
	});

	document.addEventListener('shown.bs.modal', (event) => {
		const instance = Modal.getInstance(event.target);
		modalState.active = { element: event.target, instance };
		cleanupBackdrops();
	});

	document.addEventListener('hidden.bs.modal', (event) => {
		if (modalState.active && modalState.active.element === event.target) {
			modalState.active = null;
		}
		cleanupBackdrops();
	});

	window.modalManager = {
		showModal,
		hideModal,
		getActiveModal: () => modalState.active && modalState.active.element,
		getActiveModalId: () => (modalState.active && modalState.active.element && modalState.active.element.id) || null
	};
})();

const API_BASE_URL = 'https://api.fjnel.co.za/';

// A list of public paths that do not require an Authorization header.
const PUBLIC_PATHS = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh-token',
    '/auth/resend-verification',
    '/auth/verify-email',
    '/auth/request-password-reset',
    '/auth/reset-password',
    '/', // Root health check
];

//path - The api endpoint path as a string (e.g. '/users/me')
//options - Fetch options object (method, headers, body, etc.)
async function apiFetch(path, options = {}) {
	const url = new URL(path, API_BASE_URL);
	console.log('[HTTP Interceptor] Api request initiated. Request URL:', url.href);

	const headers = new Headers(options.headers || {});
	headers.set('Content-Type', 'application/json');

	// If the path is not public, attach the Authorization header
	const accessToken = localStorage.getItem('accessToken');
	if (accessToken && !PUBLIC_PATHS.includes(path)) {
		console.log('[HTTP Interceptor] Private endpoint: Attaching access token to request headers for path:', path);
		headers.set('Authorization', `Bearer ${accessToken}`);
	}
	console.log('[HTTP Interceptor] Request headers:', Object.fromEntries(headers.entries()));

	//Now execute the fetch request
	console.log('[HTTP Interceptor] Now sending API request to:', url.href);
	let response = await fetch(url.href, {
		...options,
		headers,
	});

	//Now, intercept the response
	if (response.ok) {
		// If the response is successful (2xx), just return it
		console.log('[HTTP Interceptor] API request successful. Response:', response);
		return response;
	}

	//If the error is not 401, just return the error response
	if (response.status !== 401) {
		console.warn('[HTTP Interceptor] The response is an error but not 401. Passing it back to caller. Status:', response.status, 'Message:', response.message);
		return response;
	}

	// Only attempt refresh for protected endpoints (not login/register)
	if (PUBLIC_PATHS.includes(path) && path !== '/auth/refresh-token') {
		console.warn('[HTTP Interceptor] 401 on public endpoint:', path, 'Passing error back to caller.');
		return response;
	}

	//If we tried to refresh-token and it failed, don't try again
	if (path === '/auth/refresh-token') {
		console.error('[HTTP Interceptor] Refresh token request failed. Since this is a refresh token request, not retrying. Must be handled by caller.');
		return response;
	}

	//Handle token expired (401 Unauthorized) errors
	console.warn('[HTTP Interceptor] Access token expired, attempting to refresh token...');

	try {
		const newAccessToken = await refreshAccessToken();
		console.log('[API Interceptor] Token refreshed successfully. Retrying original request.');
		
		//Update the Authorization header with the new access token
		headers.set('Authorization', `Bearer ${newAccessToken}`);

		//Retry the original request with the new access token
		response = await fetch(url.href, {
			...options,
			headers,
		});

		console.log('[HTTP Interceptor] Retried request response:', response);

		return response;
	} catch (error) {
		console.error('[HTTP Interceptor] Token refresh failed:', error);
		//If refresh fails, clear tokens and redirect to login
		localStorage.removeItem('accessToken');
		localStorage.removeItem('refreshToken');
		showSessionExpiredModal();
		throw new Error('Session expired. Please log in again.');
	}
}

async function refreshAccessToken() {
	const refreshToken = localStorage.getItem('refreshToken');

	if (!refreshToken) {
		console.error('[HTTP Interceptor] No refresh token in local storage');
		throw new Error('No refresh token in local storage');
	}

	const refreshURL = new URL('/auth/refresh-token', API_BASE_URL);
	console.log('[HTTP Interceptor] Attempting to refresh access token. Request URL:', refreshURL.href);
	const response = await fetch(refreshURL.href, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ refreshToken }),
	});

	const data = await response.json();

	if (!response.ok) {
		console.error('[HTTP Interceptor] Refresh token request failed. Response:', data);
		throw new Error(`${data.message} Failed to refresh token`);
	}

	console.log('[HTTP Interceptor] Token refreshed successfully. New access token received.');
	const accessToken = data.accessToken || data.data?.accessToken;
	if (!accessToken) {
		console.error('[HTTP Interceptor] Refresh response did not include an access token.', data);
		throw new Error('Refresh response missing access token.');
	}
	localStorage.setItem('accessToken', accessToken);

	console.log('[HTTP Interceptor] New access token stored in local storage. Returning new access token to refreshAccessToken() caller.');
	return accessToken;
}

// Displays a modal informing the user that their session has expired
function showSessionExpiredModal() {
	//Check if modal  exists
	console.log('[Session Expired Modal] Displaying session expired modal to user.');

	const modal = document.getElementById('sessionExpiredModal');
	if (!modal) {
		console.error('[Session Expired Modal] Modal element not found in DOM.');
		//Fallback
		alert('Your session has expired. Please log in again.');
		window.location.href = 'https://bookproject.fjnel.co.za?action=login';
		return;
	}

	if (window.modalManager && typeof window.modalManager.showModal === 'function') {
		window.modalManager.showModal(modal);
	} else {
		const sessionExpiredModal = new bootstrap.Modal(modal);
		sessionExpiredModal.show();
	}

	//Redirect to homepage on modal close
	modal.addEventListener('hidden.bs.modal', () => {
		window.location.href = 'https://bookproject.fjnel.co.za?action=login';
	}, { once: true });
}
