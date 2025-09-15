// Checks if the API is reachable
async function checkApiHealth() {
    console.log('[API Health Check] Checking API health...');
    const apiUrl = 'https://api.fjnel.co.za/'; // Root endpoint for health check

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

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
    const token = localStorage.getItem('authToken');
    if (token) {
        console.log('[Login Check] User is logged in:', token);
        return true;
    } else {
        console.warn('[Login Check] User is not logged in. Redirecting to homepage...');
        window.location.href = 'https://fjnel.co.za';
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

    if (apiHealthy && viewportOk && loggedIn) {
        console.log('[Initialization] All checks passed. Application is ready.');
        // Proceed with application initialization
    } else {
        console.warn('[Initialization] One or more checks failed. Application may not function correctly.');
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);