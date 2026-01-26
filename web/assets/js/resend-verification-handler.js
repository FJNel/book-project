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
        clearAlerts();
        resetControlsState();
        setModalLocked(false);
        refreshResendState();
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

    function focusInvalidField(field) {
        if (!field) return;
        if (typeof field.scrollIntoView === 'function') {
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        field.focus({ preventScroll: true });
    }

    resendModal.addEventListener('hide.bs.modal', (event) => {
        if (isSubmitting && event.isTrusted) {
            event.preventDefault();
        }
    });

    function showAlert(type, message, { errors = [], disableControls = false } = {}) {
        console.log(`[UI] Displaying resend verification ${type} alert.`);
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';

        if (type === 'success') {
            successAlert.textContent = message || '';
            successAlert.style.display = 'block';
        } else {
            if (typeof window.renderApiErrorAlert === 'function') {
                window.renderApiErrorAlert(errorAlert, { message, errors }, message);
            } else {
                errorAlert.textContent = `${message}${errors.length ? `: ${errors.join(' ')}` : ''}`;
            }
            errorAlert.style.display = 'block';
        }

        if (disableControls && type === 'success') {
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
        console.log('[UI] Clearing resend verification alerts and help text.');
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
        } else {
            setHelpText(emailHelp, '', false);
        }

        console.log(`[Validation] Resend verification form validation result: ${isValid ? 'Valid' : 'Invalid'}`);
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

    function refreshResendState() {
        const { isValid } = validateForm();
        sendLinkButton.disabled = controlsLocked || !isValid;
    }

    // --- Main Handler ---
    async function handleResendVerificationRequest(event) {
        event.preventDefault();
        console.log('[Resend Verification] Request process initiated.');

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
                captchaToken = await window.recaptchaV3.getToken('resend_verification');
            } catch (e) {
                console.error('[reCAPTCHA] Failed to obtain token for resend-verification:', e);
                showAlert('error', 'Security Check Failed', { errors: ['Please refresh the page and try again.'] });
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
            showAlert('error', 'Connection Error', { errors: ['Could not connect to the server. Please try again.'] });
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
        const message = disclaimerText ? `${messageText} ${disclaimerText}` : messageText;
        showAlert('success', message, { disableControls: true });
    }

    function handleError(status, data) {
        console.warn('[Resend Verification] API request failed with status:', status);
        const rawMessage = getLangString(data?.message || 'An unexpected error occurred.');
        if (isCaptchaFailureMessage(rawMessage)) {
            showAlert('error', 'Security Check Failed', { errors: ['Please refresh the page and try again.'] });
            return;
        }
        const messageText = rawMessage;
        const detailErrors = Array.isArray(data?.errors) && data.errors.length
            ? data.errors.map(getLangString)
            : [];

        if (status === 429 || status === 400) {
            showAlert('error', messageText, { errors: detailErrors });
            return;
        }

        showAlert('error', 'Unexpected error', { errors: ['Please try again.'] });
    }

    // --- Event Listeners ---
    resendForm.addEventListener('submit', handleResendVerificationRequest);
    emailInput.addEventListener('input', refreshResendState);
    sendLinkButton.addEventListener('click', handleResendVerificationRequest);
    emailInput.addEventListener('input', clearAlerts);

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
