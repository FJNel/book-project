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

    if (!forgotPasswordModal || !forgotPasswordForm || !emailInput || !sendLinkButton || !successAlert || !errorAlert) {
        console.warn('[Password Reset Request] Required modal elements are missing. Handler will not initialize.');
        return;
    }

    // API and Language Configuration
    const API_BASE_URL = 'https://api.fjnel.co.za';
    let lang = {};

    let controlsLocked = false;
    let isSubmitting = false;

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
    const SECURITY_CHECK_ERROR = 'Security check failed. Please refresh the page and try again.';
    const isCaptchaFailureMessage = (message) => typeof message === 'string' && message.toLowerCase().includes('captcha verification failed');

    // --- UI Initialization and State Management ---
    function resetControlsState() {
        controlsLocked = false;
        emailInput.removeAttribute('disabled');
        spinner.style.display = 'none';
        buttonText.textContent = 'Send Link';
        refreshSendLinkState();
    }

    function initializeUI() {
        console.log('[UI] Initializing password reset form UI state.');
        clearAlerts();
        resetControlsState();
        setModalLocked(false);
    }

    function toggleSpinner(show) {
        if (show) {
            console.log('[UI] Showing password reset spinner.');
            spinner.style.display = 'inline-block';
            buttonText.textContent = '';
            sendLinkButton.disabled = true;
            setModalLocked(true);
        } else {
            console.log('[UI] Hiding password reset spinner.');
            spinner.style.display = 'none';
            buttonText.textContent = 'Send Link';
            refreshSendLinkState();
            setModalLocked(false);
        }
    }

    function setModalLocked(locked) {
        if (!forgotPasswordModal) return;
        forgotPasswordModal.dataset.locked = locked ? 'true' : 'false';
        const closeButtons = forgotPasswordModal.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
        closeButtons.forEach((btn) => {
            btn.disabled = locked;
        });
    }

    function focusInvalidField(field) {
        if (!field) return;
        if (typeof field.scrollIntoView === 'function') {
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        field.focus({ preventScroll: true });
    }

    forgotPasswordModal.addEventListener('hide.bs.modal', (event) => {
        if (isSubmitting && event.isTrusted) {
            event.preventDefault();
        }
    });

    function showErrorAlert(message, errors = []) {
        console.log('[UI] Displaying password reset error alert.');
        successAlert.style.display = 'none';
        if (typeof window.renderApiErrorAlert === 'function') {
            window.renderApiErrorAlert(errorAlert, { message, errors }, message);
        } else {
            errorAlert.textContent = `${message}${errors.length ? `: ${errors.join(' ')}` : ''}`;
        }
        errorAlert.style.display = 'block';
    }

    function showSuccessAlert(messageText, disclaimerText = '', { disableControls = false } = {}) {
        console.log('[UI] Displaying password reset success alert.');
        errorAlert.style.display = 'none';
        successAlert.innerHTML = '';
        const strong = document.createElement('strong');
        strong.textContent = messageText;
        successAlert.appendChild(strong);
        if (disclaimerText) {
            successAlert.appendChild(document.createElement('br'));
            const em = document.createElement('em');
            em.textContent = disclaimerText;
            successAlert.appendChild(em);
        }
        successAlert.style.display = 'block';

        if (disableControls) {
            controlsLocked = true;
            spinner.style.display = 'none';
            buttonText.textContent = 'Send Link';
            emailInput.setAttribute('disabled', 'disabled');
            sendLinkButton.setAttribute('disabled', 'disabled');
        }
    }

    function clearAlerts() {
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
    }

    function setHelpText(el, message, isError) {
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('text-danger', Boolean(isError));
        el.classList.toggle('text-muted', !isError);
    }

    function clearAlertsAndErrors() {
        console.log('[UI] Clearing password reset alerts and help text.');
        clearAlerts();
        setHelpText(emailHelp, '', false);
    }

    // --- Form Validation ---
    function validateForm() {
        clearAlertsAndErrors();
        let isValid = true;
        let firstInvalidField = null;
        const email = emailInput.value.trim();

        if (!emailInput.checkValidity()) {
            isValid = false;
            if (email.length === 0) {
                setHelpText(emailHelp, 'Please enter your email address.', true);
            } else {
                setHelpText(emailHelp, 'Please enter a valid email address format.', true);
            }
            if (!firstInvalidField) firstInvalidField = emailInput;
        }

        console.log(`[Validation] Password reset form validation result: ${isValid ? 'Valid' : 'Invalid'}`);
        return { isValid, firstInvalidField };
    }

    function validateEmailRealtime() {
        clearAlerts();
        const email = emailInput.value.trim();
        if (!email) {
            setHelpText(emailHelp, 'Please enter your email address.', true);
            return false;
        }
        if (!emailInput.checkValidity()) {
            setHelpText(emailHelp, 'Please enter a valid email address format.', true);
            return false;
        }
        setHelpText(emailHelp, '', false);
        return true;
    }

    function refreshSendLinkState() {
        const email = emailInput.value.trim();
        const emailValid = email.length > 0 && emailInput.checkValidity();
        const canSubmit = !controlsLocked && !isSubmitting && emailValid;
        sendLinkButton.disabled = !canSubmit;
    }

    // --- Main Handler ---
	async function handlePasswordResetRequest(event) {
		event.preventDefault();
		console.log('[Password Reset] Request process initiated.');

		const { isValid, firstInvalidField } = validateForm();
		if (!isValid) {
            focusInvalidField(firstInvalidField);
			return;
		}

        if (isSubmitting) {
            return;
        }
        isSubmitting = true;
		toggleSpinner(true);

		try {
            let captchaToken;
            try {
                captchaToken = await window.recaptchaV3.getToken('request_password_reset');
            } catch (e) {
                console.error('[reCAPTCHA] Failed to obtain token for request-password-reset:', e);
                showErrorAlert(SECURITY_CHECK_ERROR);
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
                showErrorAlert('Too many requests', ['Please try again later.']);
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
			showErrorAlert('Connection Error', ['Could not connect to the server. Please try again.']);
		} finally {
            if (controlsLocked) {
                spinner.style.display = 'none';
                buttonText.textContent = 'Send Link';
                setModalLocked(false);
            } else {
                toggleSpinner(false);
            }
            isSubmitting = false;
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
        showSuccessAlert(messageText, disclaimerText, { disableControls: true });
    }

    function handleError(status, data) {
        console.warn('[Password Reset] API request failed with status:', status);
        const rawMessage = getLangString(data?.message || 'An unexpected error occurred.');
        if (isCaptchaFailureMessage(rawMessage)) {
            showErrorAlert(SECURITY_CHECK_ERROR);
            return;
        }
        const messageText = rawMessage;
        const detailsText = Array.isArray(data?.errors) && data.errors.length
            ? data.errors.map(getLangString).join(' ')
            : '';
        if (status === 400) {
            showErrorAlert(messageText, detailsText ? [detailsText] : []);
            return;
        }

        showErrorAlert('An unexpected error occurred', ['Please try again.']);
    }

    // --- Event Listeners ---
    forgotPasswordForm.addEventListener('submit', handlePasswordResetRequest);
    emailInput.addEventListener('input', () => {
        validateEmailRealtime();
        refreshSendLinkState();
    });
    sendLinkButton.addEventListener('click', handlePasswordResetRequest);
    emailInput.addEventListener('input', clearAlerts);

    // --- App Initialization ---
    forgotPasswordModal.addEventListener('show.bs.modal', () => {
        initializeUI();
        emailInput.focus();
    });

    forgotPasswordModal.addEventListener('hidden.bs.modal', () => {
        emailInput.value = '';
        clearAlertsAndErrors();
        resetControlsState();
    });

    loadLanguageFile();
    initializeUI();
});
