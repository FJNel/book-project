/**
 * Handles the "Forgot Password" request process, including UI updates,
 * form validation, and API communication.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    // Input Field
    const emailInput = document.getElementById('resetEmail');

    // Help Text Element
    const emailHelp = document.getElementById('resetPasswordEmailHelp');

    // Button and Spinner
    const sendLinkButton = forgotPasswordModal.querySelector('.modal-footer .btn-primary');
    const spinner = document.getElementById('forgotPasswordSpinner');
    const buttonText = document.createTextNode('Send Link');
    sendLinkButton.appendChild(buttonText);

    // Alerts
    const successAlert = document.getElementById('forgotPasswordAlert');
    const errorAlert = document.getElementById('forgotPasswordErrorAlert');

    // API and Language Configuration
    const API_BASE_URL = 'https://api.fjnel.co.za';
    let lang = {};

    // --- Language File Handler ---
    /**
     * Fetches and loads the language file (e.g., en.json).
     */
    async function loadLanguageFile() {
        try {
            // This mirrors the other handlers. In a real app, this might be a shared module.
            const response = await fetch('../../lang/en.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            lang = await response.json();
            console.log('[Language] Password reset language data loaded.');
        } catch (error) {
            console.error('[Language] Failed to load language file for password reset:', error);
            // Fallback strings are essential if the fetch fails
            lang = {
                "PASSWORD_RESET_MESSAGE": "If you have registered an account with this email address, you will receive a password reset email.",
                "PASSWORD_RESET_DISCLAIMER": "If you did not receive an email when you should have, please check your spam folder or try again later.",
                "VALIDATION_ERROR": "Validation Error",
                "EMAIL_REQUIRED": "Email is required.",
                "EMAIL_FORMAT": "Please enter a valid email format."
            };
        }
    }

    const getLangString = (key) => lang[key] || key;

    // --- UI Initialization and State Management ---
    function initializeUI() {
        console.log('[UI] Initializing password reset form UI state.');
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        spinner.style.display = 'none';
        buttonText.textContent = 'Send Link';
    }

    function toggleSpinner(show) {
        if (show) {
            console.log('[UI] Showing password reset spinner.');
            spinner.style.display = 'inline-block';
            buttonText.textContent = '';
            sendLinkButton.disabled = true;
        } else {
            console.log('[UI] Hiding password reset spinner.');
            spinner.style.display = 'none';
            buttonText.textContent = 'Send Link';
            sendLinkButton.disabled = false;
        }
    }

    function showAlert(type, htmlContent) {
        console.log(`[UI] Displaying password reset ${type} alert.`);
        // Hide both alerts first
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';

        const alertToShow = type === 'success' ? successAlert : errorAlert;
        alertToShow.innerHTML = htmlContent;
        alertToShow.style.display = 'block';
    }

    function clearAlertsAndErrors() {
        console.log('[UI] Clearing password reset alerts and help text.');
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        emailHelp.textContent = '';
    }

    // --- Form Validation ---
    function validateForm() {
        clearAlertsAndErrors();
        let isValid = true;
        const email = emailInput.value.trim();

        if (!emailInput.checkValidity()) {
            isValid = false;
            if (email.length === 0) {
                emailHelp.textContent = 'Please enter your email address.';
            } else {
                emailHelp.textContent = 'Please enter a valid email address format.';
            }
        }

        console.log(`[Validation] Password reset form validation result: ${isValid ? 'Valid' : 'Invalid'}`);
        return isValid;
    }

    // --- Main Handler ---
	async function handlePasswordResetRequest(event) {
		event.preventDefault();
		console.log('[Password Reset] Request process initiated.');

		if (!validateForm()) {
			return;
		}

		toggleSpinner(true);

		try {
			const response = await fetch(`${API_BASE_URL}/auth/request-password-reset`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: emailInput.value.trim(),
					captchaToken: 'test-bypass-token'
				}),
			});

			// Handle Too Many Requests (429)
			if (response.status === 429) {
				console.warn('[Password Reset] Too many requests (429).');
				showAlert('error', '<strong>Too many requests:</strong> Please try again later.');
				return;
			}

			const data = await response.json();
			console.log('[API] Received password reset response:', { status: response.status, data });

			if (response.ok) {
				handleSuccess(data);
			} else {
				handleError(response.status, data);
			}
		} catch (error) {
			console.error('[API] Network or fetch error during password reset request:', error);
			showAlert('error', '<strong>Connection Error:</strong> Could not connect to the server. Please try again.');
		} finally {
			toggleSpinner(false);
		}
	}

    function handleSuccess(data) {
        console.log('[Password Reset] API request successful.');
        const message = getLangString(data.message.message || 'PASSWORD_RESET_MESSAGE');
        const disclaimer = getLangString(data.message.disclaimer || 'PASSWORD_RESET_DISCLAIMER');
        showAlert('success', `<strong>${message}</strong><br><em>${disclaimer}</em>`);
        forgotPasswordForm.reset(); // Reset the form after success
    }

    function handleError(status, data) {
        console.warn('[Password Reset] API request failed with status:', status);
        if (status === 400 && data.message === 'VALIDATION_ERROR') {
            const message = `<strong>${getLangString(data.message)}:</strong>`;
            const details = data.errors.map(getLangString).join(' ');
            showAlert('error', `${message} ${details}`);
        } else {
            showAlert('error', '<strong>An unexpected error occurred:</strong> Please try again.');
        }
    }

    // --- Event Listeners ---
    forgotPasswordForm.addEventListener('submit', handlePasswordResetRequest);
    sendLinkButton.addEventListener('click', handlePasswordResetRequest);
    emailInput.addEventListener('input', clearAlertsAndErrors);

    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});