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

// Checks if the viewport is large enough (>= 1200px)
function checkViewport() {
    //Only run this logic on pages that require a token
    const path = window.location.pathname;
    if (
        path === '/verify-email.html' || path === '/verify-email' ||
        path === '/reset-password.html' || path === '/reset-password'
    ) {
        console.log('[Viewport Check] Page requires token. Checking token presence.');
        //Check for token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (!token) {
            //Don't show desktop modal if token is missing
            console.warn('[Viewport Check] Token is missing in URL. Not showing desktop error modal.');
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
    //TODO: Implement token validation logic here
    
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
    const apiHealthy = await checkApiHealth();
    const viewportOk = checkViewport();
    const loggedIn = checkLoginStatus();

    if (apiHealthy && viewportOk && !loggedIn) {
        console.log('[Initialization] All checks passed. Application is ready.');
        // Proceed with application initialization
    } else {
        console.warn('[Initialization] One or more checks failed. Application may not function correctly.');
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);