// Checks if the API is reachable
async function checkApiHealth() {
    console.log('[API Health Check] Checking API health...');
    const apiUrl = 'https://api.fjnel.co.za/'; // Root endpoint for health check

    try {
        const response = await apiFetch('/', { method: 'GET' });

        if (response.ok) {
            const data = await response.json();
            if (data.status === 'success' && data.message === 'API_IS_WORKING') {
                console.log('[API Health Check] API is working:', data.message);
                return true;
            } else {
                console.error('[API Health Check] Unexpected API response:', data);
                showApiErrorModal();
                return false;
            }
        } else {
            console.error('[API Health Check] Failed:', response.status, response.statusText);
            showApiErrorModal();
            return false;
        }
    } catch (error) {
        console.error('[API Health Check] Error while checking API health:', error);
        showApiErrorModal();
        return false;
    }
}

function checkViewport() {
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

            window.location.href = 'https://fjnel.co.za';
        }
        console.log('[Login Check] Already on page that does not require login.');
        return false;
    }
}

// Show modal if API is unreachable
function showApiErrorModal() {
    console.log('[Modal] Showing API Error Modal');
    const apiErrorModal = new bootstrap.Modal(document.getElementById('apiErrorModal'));
    apiErrorModal.show();
}

// Show modal if viewport is too small
function showViewportErrorModal() {
    console.log('[Modal] Showing Desktop Error Modal');
    const desktopErrorModal = new bootstrap.Modal(document.getElementById('desktopErrorModal'));
    desktopErrorModal.show();
}

// Run checks on page load
async function initializeApp() {
    const pageLoadingModalElement = document.getElementById('pageLoadingModal');
    const pageLoadingModal = new bootstrap.Modal(pageLoadingModalElement);

    try {
        // Show the loading modal immediately
        pageLoadingModal.show();
        console.log('[Initialization] Page loading modal shown.');

        // Run the original checks
        const apiHealthy = await checkApiHealth();
        const viewportOk = checkViewport();
        const loggedIn = checkLoginStatus();

        if (apiHealthy && viewportOk) {
            console.log('[Initialization] All checks passed. Application is ready.');
        } else {
            console.warn('[Initialization] One or more checks failed. Application may not function correctly.');
        }

    } catch (error) {
        console.error('[Initialization] An unexpected error occurred:', error);
    } finally {
        // This block will always execute, ensuring the modal is hidden
        // after all checks are complete or if an error was caught.
        pageLoadingModal.hide();
        console.log('[Initialization] Page loading modal hidden.');
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);