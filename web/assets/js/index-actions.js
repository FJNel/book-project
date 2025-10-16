//Allows the URL path to specify an action to perform on the index page
//E.g. ?action=login, ?action=register, ?action=request-password-reset, ?action=request-verification-email

document.addEventListener('DOMContentLoaded', () => {
	const urlParams = new URLSearchParams(window.location.search);
	const action = urlParams.get('action');
	if (action) {
		console.log('[Index Actions] Detected action in URL:', action);

		//Show the appropriate modal based on the action
		switch (action) {
			case 'login':
				console.log('[Index Actions] Showing login modal.');

				//Get login modal (loginModal)
				const loginModalEl = document.getElementById('loginModal');
				if (loginModalEl) {
					const loginModal = new bootstrap.Modal(loginModalEl);
					loginModal.show();
					console.log('[Index Actions] Login modal shown.');
				} else 
				{
					console.error('[Index Actions] Login modal element not found in DOM.');
				}
				break;
			case 'register':
				console.log('[Index Actions] Showing registration modal.');

				//Get registration modal (registerModal)
				const registerModalEl = document.getElementById('registerModal');
				if (registerModalEl) {
					const registerModal = new bootstrap.Modal(registerModalEl);
					registerModal.show();
					console.log('[Index Actions] Registration modal shown.');
				} else {
					console.error('[Index Actions] Registration modal element not found in DOM.');
				}
				break;
			case 'request-password-reset':
				console.log('[Index Actions] Showing password reset modal.');

				//Get password reset modal (passwordResetModal)
				const passwordResetModalEl = document.getElementById('forgotPasswordModal');
				if (passwordResetModalEl) {
					const passwordResetModal = new bootstrap.Modal(passwordResetModalEl);
					passwordResetModal.show();
					console.log('[Index Actions] Password reset modal shown.');
				} else {
					console.error('[Index Actions] Password reset modal element not found in DOM.');
				}
				break;
			case 'request-verification-email':
				console.log('[Index Actions] Showing email verification modal.');

				//Get email verification modal (emailVerificationModal)
				const emailVerificationModalEl = document.getElementById('resendVerificationEmailModal');
				if (emailVerificationModalEl) {
					const emailVerificationModal = new bootstrap.Modal(emailVerificationModalEl);
					emailVerificationModal.show();
					console.log('[Index Actions] Email verification modal shown.');
				} else {
					console.error('[Index Actions] Email verification modal element not found in DOM.');
				}
				break;
			default:
				console.warn('[Index Actions] Unknown action:', action);
		}//switch (action)
	}//if action
});//DOMContentLoaded

