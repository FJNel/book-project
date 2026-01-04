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

window.authGuard = window.authGuard || {};
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
	const accessToken = localStorage.getItem('accessToken');
	const refreshToken = localStorage.getItem('refreshToken');
	if (accessToken || refreshToken) {
		return true;
	}
	if (waitForMaintenance) {
		await window.authGuard.waitForMaintenance();
	}
	if (typeof window.showSessionExpiredModal === 'function') {
		console.log('[Auth Guard] No tokens found; showing session expired modal.');
		window.showSessionExpiredModal();
		return false;
	}
	console.warn('[Auth Guard] Session expired modal unavailable; redirecting to login.');
	window.location.href = 'https://bookproject.fjnel.co.za?action=login';
	return false;
};

window.rateLimitGuard = window.rateLimitGuard || (function createRateLimitGuard() {
	let resetAt = null;

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
		const nextReset = parseRateLimitReset(response);
		resetAt = Math.max(resetAt || 0, nextReset);
		console.log('[Rate Limit] Recorded reset time:', new Date(resetAt).toISOString());
	}

	async function showModal({ modalId = 'rateLimitModal' } = {}) {
		if (!resetAt) return false;
		const modalEl = document.getElementById(modalId);
		const resetTimeEl = document.getElementById('rateLimitResetTime');
		const progressEl = document.getElementById('rateLimitProgress');
		if (!modalEl) return false;

		if (window.authGuard && typeof window.authGuard.waitForMaintenance === 'function') {
			await window.authGuard.waitForMaintenance();
		}

		const startTime = Date.now();
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
			const elapsed = Math.min(now - startTime, total);
			const percent = Math.min(Math.max((elapsed / total) * 100, 0), 100);
			if (progressEl) {
				progressEl.style.width = `${percent.toFixed(1)}%`;
			}
		};

		updateProgress();
		const interval = setInterval(updateProgress, 250);
		const delay = Math.max(endTime - Date.now(), 0) + 2000;
		setTimeout(() => {
			clearInterval(interval);
			window.location.reload();
		}, delay);
		return true;
	}

	function hasReset() {
		return Boolean(resetAt);
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

function checkViewport() {
    //Deprecated: The UI has been redesigned to be mobile-friendly
    return true;

    const path = window.location.pathname;
    if (
        path === '/verify-email.html' || path === '/verify-email' ||
        path === '/reset-password.html' || path === '/reset-password'
    ) {
        //Check for token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (!token) {
            //Don't show desktop modal if token is missing
            return true;
        }
    }

    // Require desktop for all other pages
    if (window.innerWidth >= 1200) {
        console.log('[Viewport Check] Viewport is large enough:', window.innerWidth);
        return true;
    } else {
        console.warn('[Viewport Check] Viewport too small:', window.innerWidth);
        showViewportErrorModal();
        return false;
    }
}

// Checks if the user is logged in
function checkLoginStatus() {
    //Deprecated: The HTTP interceptor will handle this
    //If the token is invalid, the user will be logged out automatically by the interceptor
    return true;

    const token = localStorage.getItem('accessToken');

    
    //Check if token refresh token is still valid
    //Not needed: The HTTP interceptor will handle this
    //If the token is invalid, the user will be logged out automatically by the interceptor
    
    //Placeholder logic
    if (token) {
        console.log('[Login Check] User is logged in:', token);
        return true;
    } else {
        console.warn('[Login Check] User is not logged in.');
        //If not homepage, redirect
        if (window.location.pathname !== '/' 
            && window.location.pathname !== '/index.html' 
            && window.location.pathname !== '/index'
            && window.location.pathname !== '/reset-password.html'
            && window.location.pathname !== '/reset-password'
            && window.location.pathname !== '/verify-email.html'
            && window.location.pathname !== '/verify-email'
        ) {
            console.log('[Login Check] Redirecting to homepage.');

            window.location.href = 'https://bookproject.fjnel.co.za';
        }
        console.log('[Login Check] Already on page that does not require login.');
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

let legacyPageLoadingModalInstance;

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

// Show modal if viewport is too small
// function showViewportErrorModal() {
//     console.log('[Modal] Showing Desktop Error Modal');
//     const desktopErrorModal = new bootstrap.Modal(document.getElementById('desktopErrorModal'));
//     desktopErrorModal.show();
// }

//Run checks on page load
async function initializeApp() {
	let apiHealthy = false;
	try {
		showPageLoadingModal();
		console.log('[Initialization] Waiting for API health check...');
		apiHealthy = await checkApiHealth();
		if (apiHealthy) {
			console.log('[Initialization] All checks passed.');
		} else {
			console.warn('[Initialization] API health check failed. Application may not function correctly.');
		}
		if (window.pageContentReady && window.pageContentReady.promise) {
			console.log('[Initialization] Waiting for page content readiness...');
			const result = await window.pageContentReady.promise;
			console.log('[Initialization] Page content readiness resolved:', result);
		}
	} catch (error) {
		console.error('[Initialization] An unexpected error occurred:', error);
	} finally {
		console.log('[Initialization] Hiding page loading modal...');
		await hidePageLoadingModal();
		console.log('[Initialization] Page loading modal hidden.');
	}

	if (!apiHealthy) {
		await showApiErrorModal();
	}

	if (appInitializationDeferred.resolve) {
		appInitializationDeferred.resolve({ apiHealthy });
	}
}

document.addEventListener('DOMContentLoaded', initializeApp);
