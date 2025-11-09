// Checks if the API is reachable
async function checkApiHealth() {
    console.log('[API Health Check] Checking API health...');
    const apiUrl = 'https://api.fjnel.co.za/'; // Root endpoint for health check

    try {
        const response = await apiFetch('/', { method: 'GET' });

        if (!response.ok) {
            console.error('[API Health Check] Failed:', response.status, response.statusText);
            showApiErrorModal();
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
        showApiErrorModal();
        return false;
    } catch (error) {
        console.error('[API Health Check] Error while checking API health:', error);
        showApiErrorModal();
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
function showApiErrorModal() {
    console.log('[Modal] Showing API Error Modal');
    const modalElement = document.getElementById('apiErrorModal');
    if (!modalElement) {
        console.error('[Modal] API Error Modal element not found.');
        return;
    }

    if (window.modalManager && typeof window.modalManager.showModal === 'function') {
        window.modalManager.showModal(modalElement);
        return;
    }

    const apiErrorModal = new bootstrap.Modal(modalElement);
    apiErrorModal.show();
}

// Show modal if viewport is too small
// function showViewportErrorModal() {
//     console.log('[Modal] Showing Desktop Error Modal');
//     const desktopErrorModal = new bootstrap.Modal(document.getElementById('desktopErrorModal'));
//     desktopErrorModal.show();
// }

//Run checks on page load
async function initializeApp() {
    try {
        showPageLoadingModal();
        // Run the original checks
        const apiHealthy = await checkApiHealth();
        //Deprecated:

        if (apiHealthy) {
            console.log('[Initialization] All checks passed.');
        } else {
            console.warn('[Initialization] API health check failed. Application may not function correctly.');
        }

    } catch (error) {
        console.error('[Initialization] An unexpected error occurred:', error);
    } finally {
        await hidePageLoadingModal();
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);
