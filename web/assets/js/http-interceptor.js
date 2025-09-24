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
	const accessToken = localStorage.getItem('authToken');
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
		console.log('[HTTP Interceptor] API request successful. Response:', await response.json());
		return response;
	}

	//If the error is not 401, just return the error response
	if (response.status !== 401) {
		console.warn('[HTTP Interceptor] The response is an error but not 401. Passing it back to caller. Status:', response.status, 'Message:', response.message);
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

		console.log('[HTTP Interceptor] Retried request response:', await response.json());

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
	localStorage.setItem('accessToken', data.accessToken);

	console.log('[HTTP Interceptor] New access token stored in local storage. Returning new access token to refreshAccessToken() caller.');
	return data.accessToken;
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
		window.location.href = 'https://fjnel.co.za';
		return;
	}

	const sessionExpiredModal = new bootstrap.Modal(modal);
	sessionExpiredModal.show();

	//Redirect to homepage on modal close
	modal.addEventListener('hidden.bs.modal', () => {
		window.location.href = 'https://fjnel.co.za';
	}, { once: true });
}