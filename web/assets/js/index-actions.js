//Allows the URL path to specify an action to perform on the index page
//E.g. ?action=login, ?action=register, ?action=request-password-reset, ?action=request-verification-email

function getTokensPresent() {
	const accessToken = localStorage.getItem('accessToken');
	const refreshToken = localStorage.getItem('refreshToken');
	return Boolean(accessToken || refreshToken);
}

async function waitForAppInitialization() {
	const initPromise = window.appInitializationPromise;
	if (initPromise && typeof initPromise.then === 'function') {
		try {
			return await initPromise;
		} catch (error) {
			console.error('[Index Actions] App initialization promise rejected.', error);
			return { apiHealthy: false };
		}
	}
	return { apiHealthy: true };
}

async function waitForMaintenanceModal() {
	const maintenancePromise = window.maintenanceModalPromise;
	if (maintenancePromise && typeof maintenancePromise.then === 'function') {
		try {
			console.log('[Index Actions] Waiting for maintenance modal resolution...');
			const result = await maintenancePromise;
			console.log('[Index Actions] Maintenance flow resolved:', result);
			return result;
		} catch (error) {
			console.warn('[Index Actions] Maintenance promise rejected.', error);
		}
	}
	return null;
}

async function showModalElement(modalElement, options = {}) {
	if (!modalElement) {
		return null;
	}
	if (window.modalManager && typeof window.modalManager.showModal === 'function') {
		return window.modalManager.showModal(modalElement, options);
	}
	const fallbackModal = bootstrap && bootstrap.Modal
		? bootstrap.Modal.getOrCreateInstance(modalElement, options)
		: null;
	if (fallbackModal) {
		fallbackModal.show();
	}
	return fallbackModal;
}

async function hideModalElement(modalElement) {
	if (!modalElement) {
		return;
	}
	if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
		await window.modalManager.hideModal(modalElement);
		return;
	}
	const instance = bootstrap && bootstrap.Modal
		? bootstrap.Modal.getInstance(modalElement)
		: null;
	if (instance) {
		instance.hide();
	}
}

async function handleActionModalFromQuery() {
	console.log('[Index Actions] Waiting to show action modal...');
	await waitForMaintenanceModal();
	const urlParams = new URLSearchParams(window.location.search);
	let action = urlParams.get('action');
	if (!action) {
		return;
	}
	action = action.toLowerCase();
	console.log('[Index Actions] Detected action in URL:', action);

	const actionToModalId = {
		'login': 'loginModal',
		'register': 'registerModal',
		'request-password-reset': 'forgotPasswordModal',
		'request-verification-email': 'resendVerificationEmailModal'
	};

	const modalId = actionToModalId[action];
	if (!modalId) {
		console.warn('[Index Actions] Unknown action:', action);
		return;
	}

	await new Promise(resolve => setTimeout(resolve, 500)); // wait for loading modal to finish
	console.log(`[Index Actions] Showing ${action} modal.`);
	const modalElement = document.getElementById(modalId);
	if (!modalElement) {
		console.error(`[Index Actions] Modal element "${modalId}" not found in DOM.`);
		return;
	}

	await showModalElement(modalElement);
	console.log(`[Index Actions] ${action} modal shown.`);
}

async function logoutCurrentUser() {
	const refreshToken = localStorage.getItem('refreshToken');
	if (!refreshToken) {
		console.warn('[Index Actions] No refresh token found; clearing local tokens only.');
		localStorage.removeItem('accessToken');
		localStorage.removeItem('refreshToken');
		return;
	}

	try {
		const response = await apiFetch('/auth/logout', {
			method: 'POST',
			body: JSON.stringify({ refreshToken, allDevices: false })
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			console.warn('[Index Actions] Logout request failed.', response.status, data);
		} else {
			console.log('[Index Actions] Logout successful.');
		}
	} catch (error) {
		console.error('[Index Actions] Logout request error:', error);
	}

	localStorage.removeItem('accessToken');
	localStorage.removeItem('refreshToken');
}

function attachAlreadyLoggedInHandlers(modalElement) {
	const logoutButton = document.getElementById('logoutBtn');
	const dashboardButton = document.getElementById('goToDashboardbtn');
	if (!logoutButton || !dashboardButton) {
		console.warn('[Index Actions] Already logged in modal buttons missing.');
		return;
	}

	// Prevent Bootstrap auto-dismiss so we can control the flow.
	logoutButton.removeAttribute('data-bs-dismiss');

	logoutButton.addEventListener('click', async (event) => {
		event.preventDefault();
		event.stopPropagation();
		logoutButton.disabled = true;
		dashboardButton.disabled = true;
		await logoutCurrentUser();
		await hideModalElement(modalElement);
		logoutButton.disabled = false;
		dashboardButton.disabled = false;
		await handleActionModalFromQuery();
	}, { once: true });

	dashboardButton.addEventListener('click', () => {
		window.location.href = 'https://bookproject.fjnel.co.za/add-book';
	}, { once: true });
}

async function showAlreadyLoggedInModalIfNeeded() {
	if (!getTokensPresent()) {
		return false;
	}
	const modalElement = document.getElementById('alreadyLoggedIn');
	if (!modalElement) {
		return false;
	}
	console.log('[Index Actions] User already logged in. Displaying modal.');
	attachAlreadyLoggedInHandlers(modalElement);
	await showModalElement(modalElement, { backdrop: 'static', keyboard: false });
	return true;
}

document.addEventListener('DOMContentLoaded', async () => {
	console.log('[Index Actions] Index modal flow starting.');
	const initResult = await waitForAppInitialization();
	if (!initResult || initResult.apiHealthy === false) {
		console.warn('[Index Actions] App initialization not healthy; skipping additional modals.');
		return;
	}

	await waitForMaintenanceModal();
	if (await showAlreadyLoggedInModalIfNeeded()) {
		console.log('[Index Actions] Already logged in modal shown; action modals deferred.');
		return;
	}
	await handleActionModalFromQuery();
	console.log('[Index Actions] Index modal flow complete.');
});
