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
    const sendLinkButton = resendModal.querySelector('.modal-footer .btn-primary');
    const spinner = document.getElementById('resendVerificationLinkSpinner');
    const buttonText = document.createTextNode('Send Link');
    sendLinkButton.appendChild(buttonText);

    // Alerts
    const successAlert = document.getElementById('resendVerificationAlert');
    const errorAlert = document.getElementById('resendVerificationErrorAlert');

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

    // --- UI Initialization and State Management ---
    function initializeUI() {
        console.log('[UI] Initializing resend verification form UI state.');
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        spinner.style.display = 'none';
        buttonText.textContent = 'Send Link';
    }

    function toggleSpinner(show) {
        if (show) {
            console.log('[UI] Showing resend verification spinner.');
            spinner.style.display = 'inline-block';
            buttonText.textContent = '';
            sendLinkButton.disabled = true;
        } else {
            console.log('[UI] Hiding resend verification spinner.');
            spinner.style.display = 'none';
            buttonText.textContent = 'Send Link';
            sendLinkButton.disabled = false;
        }
    }

    function showAlert(type, htmlContent) {
        console.log(`[UI] Displaying resend verification ${type} alert.`);
        // Hide both alerts first
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';

        const alertToShow = type === 'success' ? successAlert : errorAlert;
        alertToShow.innerHTML = htmlContent;
        alertToShow.style.display = 'block';
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

    // --- Main Handler ---
    async function handleResendVerificationRequest(event) {
        event.preventDefault();
        console.log('[Resend Verification] Request process initiated.');

        if (!validateForm()) {
            return;
        }

        toggleSpinner(true);

        try {
            let captchaToken;
            try {
                captchaToken = await window.recaptchaV3.getToken('resend-verification');
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
            toggleSpinner(false);
        }
    }

    function handleSuccess(data) {
        console.log('[Resend Verification] API request successful.');
        const message = getLangString(data.message.message);
        const disclaimer = getLangString(data.message.disclaimer);
        showAlert('success', `<strong>${message}</strong><br><em>${disclaimer}</em>`);
        resendForm.reset();
    }

    function handleError(status, data) {
        console.warn('[Resend Verification] API request failed with status:', status);
        if (status === 429) {
            const message = `<strong>${getLangString(data.message)}:</strong>`;
            const details = data.errors.map(getLangString).join(' ');
            showAlert('error', `${message} ${details}`);
        } else if (status === 400 && data.message === 'VALIDATION_ERROR') {
            const message = `<strong>${getLangString(data.message)}:</strong>`;
            const details = data.errors.map(getLangString).join(' ');
            showAlert('error', `${message} ${details}`);
        } else {
            showAlert('error', '<strong>An unexpected error occurred:</strong> Please try again.');
        }
    }

    // --- Event Listeners ---
    resendForm.addEventListener('submit', handleResendVerificationRequest);
    sendLinkButton.addEventListener('click', handleResendVerificationRequest);
    emailInput.addEventListener('input', clearAlertsAndErrors);

    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});
