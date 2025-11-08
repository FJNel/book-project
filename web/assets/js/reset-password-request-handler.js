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
    const sendLinkButton = document.getElementById('forgotPasswordButton');
    const spinner = document.getElementById('forgotPasswordSpinner');
    const buttonText = document.createTextNode('Send Link');
    sendLinkButton.appendChild(buttonText);

    // Alerts
    const successAlert = document.getElementById('forgotPasswordAlert');
    const errorAlert = document.getElementById('forgotPasswordErrorAlert');

    // API and Language Configuration
    const API_BASE_URL = 'https://api.fjnel.co.za';
    let lang = {};

    let controlsLocked = false;

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
    const SECURITY_CHECK_ERROR_HTML = '<strong>CAPTCHA verification failed:</strong> Please refresh the page and try again.';
    const isCaptchaFailureMessage = (message) => typeof message === 'string' && message.toLowerCase().includes('captcha verification failed');

    // --- UI Initialization and State Management ---
    function resetControlsState() {
        controlsLocked = false;
        emailInput.removeAttribute('disabled');
        sendLinkButton.removeAttribute('disabled');
        spinner.style.display = 'none';
        buttonText.textContent = 'Send Link';
    }

    function initializeUI() {
        console.log('[UI] Initializing password reset form UI state.');
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        resetControlsState();
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

    function showAlert(type, htmlContent, { disableControls = false } = {}) {
        console.log(`[UI] Displaying password reset ${type} alert.`);
        // Hide both alerts first
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';

        const alertToShow = type === 'success' ? successAlert : errorAlert;
        alertToShow.innerHTML = htmlContent;
        alertToShow.style.display = 'block';

        if (disableControls && type === 'success') {
            controlsLocked = true;
            spinner.style.display = 'none';
            buttonText.textContent = 'Send Link';
            emailInput.setAttribute('disabled', 'disabled');
            sendLinkButton.setAttribute('disabled', 'disabled');
        }
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
            let captchaToken;
            try {
                captchaToken = await window.recaptchaV3.getToken('request_password_reset');
            } catch (e) {
                console.error('[reCAPTCHA] Failed to obtain token for request-password-reset:', e);
                showAlert('error', '<strong>Security Check Failed:</strong> Please refresh the page and try again.');
                return;
            }

            const response = await apiFetch(`/auth/request-password-reset`, {
                method: 'POST',
                body: JSON.stringify({
                    email: emailInput.value.trim(),
                    captchaToken
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
            if (controlsLocked) {
                spinner.style.display = 'none';
                buttonText.textContent = 'Send Link';
            } else {
                toggleSpinner(false);
            }
        }
    }

    function handleSuccess(data) {
        console.log('[Password Reset] API request successful.');
        const rawMessage = typeof data?.message === 'string'
            ? data.message
            : data?.message?.message;
        const messageText = getLangString(rawMessage || 'PASSWORD_RESET_MESSAGE');
        const disclaimerSource = typeof data?.data?.disclaimer === 'string'
            ? data.data.disclaimer
            : data?.message?.disclaimer || '';
        const disclaimerText = disclaimerSource ? getLangString(disclaimerSource) : '';
        const alertHtml = disclaimerText
            ? `<strong>${messageText}</strong><br><em>${disclaimerText}</em>`
            : `<strong>${messageText}</strong>`;
        showAlert('success', alertHtml, { disableControls: true });
    }

    function handleError(status, data) {
        console.warn('[Password Reset] API request failed with status:', status);
        const rawMessage = getLangString(data?.message || 'An unexpected error occurred.');
        if (isCaptchaFailureMessage(rawMessage)) {
            showAlert('error', SECURITY_CHECK_ERROR_HTML);
            return;
        }
        const messageText = rawMessage;
        const detailsText = Array.isArray(data?.errors) && data.errors.length
            ? data.errors.map(getLangString).join(' ')
            : '';
        const alertHtml = `<strong>${messageText}</strong>${detailsText ? ` ${detailsText}` : ''}`;

        if (status === 400) {
            showAlert('error', alertHtml);
            return;
        }

        showAlert('error', '<strong>An unexpected error occurred:</strong> Please try again.');
    }

    // --- Event Listeners ---
    forgotPasswordForm.addEventListener('submit', handlePasswordResetRequest);
    sendLinkButton.addEventListener('click', handlePasswordResetRequest);
    emailInput.addEventListener('input', clearAlertsAndErrors);

    // --- App Initialization ---
    forgotPasswordModal.addEventListener('hidden.bs.modal', () => {
        emailInput.value = '';
        clearAlertsAndErrors();
        resetControlsState();
    });

    loadLanguageFile();
    initializeUI();
});
