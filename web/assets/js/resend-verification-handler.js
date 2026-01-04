/**
 * Handles the "Resend Verification Email" process, including UI updates,
 * form validation, and API communication.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const resendModal = document.getElementById('resendVerificationEmailModal');
    const resendForm = document.getElementById('resendVerificationForm');

    // Input Field
    const emailInput = document.getElementById('resendEmail');

    // Help Text Element
    const emailHelp = document.getElementById('resendVerificationEmailHelp');

    // Button and Spinner
    const sendLinkButton = document.getElementById('resendVerificationButton');
    const spinner = document.getElementById('resendVerificationLinkSpinner');
    const buttonText = document.createTextNode('Send Link');
    sendLinkButton.appendChild(buttonText);

    // Alerts
    const successAlert = document.getElementById('resendVerificationAlert');
    const errorAlert = document.getElementById('resendVerificationErrorAlert');

    if (!resendModal || !resendForm || !emailInput || !sendLinkButton || !successAlert || !errorAlert) {
        console.warn('[Resend Verification] Required modal elements are missing. Handler will not initialize.');
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
            console.log('[Language] Resend verification language data loaded.');
        } catch (error) {
            console.error('[Language] Failed to load language file for resend verification:', error);
            // Fallback strings are essential if the fetch fails
            lang = {
                "RESEND_VERIFICATION_MESSAGE": "If you have registered an account with this email address and it is unverified, you will receive a verification email.",
                "RESEND_VERIFICATION_DISCLAIMER": "If you did not receive an email when you should have, please check your spam folder or try again later.",
                "VALIDATION_ERROR": "Validation Error",
                "EMAIL_REQUIRED": "Email is required.",
                "EMAIL_FORMAT": "Please enter a valid email format.",
                "TOO_MANY_REQUESTS": "Too many requests",
                "TOO_MANY_REQUESTS_DETAIL": "You have made too many requests. Please try again later."
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
        console.log('[UI] Initializing resend verification form UI state.');
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        resetControlsState();
        setModalLocked(false);
    }

    function toggleSpinner(show) {
        if (show) {
            console.log('[UI] Showing resend verification spinner.');
            spinner.style.display = 'inline-block';
            buttonText.textContent = '';
            sendLinkButton.disabled = true;
            setModalLocked(true);
        } else {
            console.log('[UI] Hiding resend verification spinner.');
            spinner.style.display = 'none';
            buttonText.textContent = 'Send Link';
            sendLinkButton.disabled = false;
            setModalLocked(false);
        }
    }

    function setModalLocked(locked) {
        if (!resendModal) return;
        resendModal.dataset.locked = locked ? 'true' : 'false';
        const closeButtons = resendModal.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
        closeButtons.forEach((btn) => {
            btn.disabled = locked;
        });
    }

    resendModal.addEventListener('hide.bs.modal', (event) => {
        if (isSubmitting && event.isTrusted) {
            event.preventDefault();
        }
    });

    function showAlert(type, htmlContent, { disableControls = false } = {}) {
        console.log(`[UI] Displaying resend verification ${type} alert.`);
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
        console.log('[UI] Clearing resend verification alerts and help text.');
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

        console.log(`[Validation] Resend verification form validation result: ${isValid ? 'Valid' : 'Invalid'}`);
        return isValid;
    }

    function validateEmailRealtime() {
        const email = emailInput.value.trim();
        if (!email) {
            emailHelp.textContent = 'Please enter your email address.';
            return false;
        }
        if (!emailInput.checkValidity()) {
            emailHelp.textContent = 'Please enter a valid email address format.';
            return false;
        }
        emailHelp.textContent = '';
        return true;
    }

    // --- Main Handler ---
    async function handleResendVerificationRequest(event) {
        event.preventDefault();
        console.log('[Resend Verification] Request process initiated.');

        if (!validateForm()) {
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
                captchaToken = await window.recaptchaV3.getToken('resend_verification');
            } catch (e) {
                console.error('[reCAPTCHA] Failed to obtain token for resend-verification:', e);
                showAlert('error', '<strong>Security Check Failed:</strong> Please refresh the page and try again.');
                return;
            }

            const response = await apiFetch(`/auth/resend-verification`, {
                method: 'POST',
                body: JSON.stringify({
                    email: emailInput.value.trim(),
                    captchaToken
                }),
            });

            const data = await response.json();
            console.log('[API] Received resend verification response:', { status: response.status, data });

            if (response.ok) {
                handleSuccess(data);
            } else {
                handleError(response.status, data);
            }
        } catch (error) {
            console.error('[API] Network or fetch error during resend verification request:', error);
            showAlert('error', '<strong>Connection Error:</strong> Could not connect to the server. Please try again.');
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
        console.log('[Resend Verification] API request successful.');
        const rawMessage = typeof data?.message === 'string'
            ? data.message
            : data?.message?.message;
        const messageText = getLangString(rawMessage || 'RESEND_VERIFICATION_MESSAGE');
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
        console.warn('[Resend Verification] API request failed with status:', status);
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

        if (status === 429 || status === 400) {
            showAlert('error', alertHtml);
            return;
        }

        showAlert('error', '<strong>An unexpected error occurred:</strong> Please try again.');
    }

    // --- Event Listeners ---
    resendForm.addEventListener('submit', handleResendVerificationRequest);
    emailInput.addEventListener('input', validateEmailRealtime);
    sendLinkButton.addEventListener('click', handleResendVerificationRequest);
    emailInput.addEventListener('input', clearAlertsAndErrors);

    resendModal.addEventListener('show.bs.modal', () => {
        initializeUI();
        emailInput.focus();
    });

    // --- App Initialization ---
    resendModal.addEventListener('hidden.bs.modal', () => {
        emailInput.value = '';
        clearAlertsAndErrors();
        resetControlsState();
    });

    loadLanguageFile();
    initializeUI();
});
