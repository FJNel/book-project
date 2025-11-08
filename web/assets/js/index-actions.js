//Allows the URL path to specify an action to perform on the index page
//E.g. ?action=login, ?action=register, ?action=request-password-reset, ?action=request-verification-email

document.addEventListener('DOMContentLoaded', async () => {
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

	if (window.modalManager && typeof window.modalManager.showModal === 'function') {
		await window.modalManager.showModal(modalElement);
	} else {
		const fallbackModal = new bootstrap.Modal(modalElement);
		fallbackModal.show();
	}
	console.log(`[Index Actions] ${action} modal shown.`);
});

