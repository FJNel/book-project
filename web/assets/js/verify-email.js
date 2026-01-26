/**
 * Handles the email verification process by reading a token from the URL,
 * collecting the user's email, and sending them to the API.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const emailInput = document.getElementById('resendEmail');
    const verifyButton = document.getElementById('verifyButton');
    const emailHelp = document.getElementById('resendEmailHelp');
    const successAlert = document.getElementById('emailVerificationAlertSuccess');
    const errorAlert = document.getElementById('emailVerificationAlertError');
    const verificationForm = document.getElementById('emailVerificationForm');
    const verifySpinner = document.getElementById('verifySpinner');
    const verifyButtonText = document.createTextNode('Verify Email');
    verifyButton.appendChild(verifyButtonText);

    // API and Language Configuration
    const API_BASE_URL = 'https://api.fjnel.co.za';
    let lang = {};
    let redirectScheduled = false;

    // --- Language File Handler ---
    async function loadLanguageFile() {
        try {
            const response = await fetch('../../lang/en.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            lang = await response.json();
            console.log('[Language] Email verification language data loaded.');
        } catch (error) {
            console.error('[Language] Failed to load language file:', error);
            // Fallback strings
            lang = {
                "EMAIL_ALREADY_VERIFIED": "This email address has already been verified.",
                "EMAIL_VERIFICATION_SUCCESS": "Your email has been successfully verified!",
                "EMAIL_VERIFICATION_ERROR": "Verification Error",
                "EMAIL_VERIFICATION_ERROR_DETAIL_1": "The verification link is invalid or has expired.",
                "EMAIL_VERIFICATION_ERROR_DETAIL_2": "Please request a new link.",
                "DATABASE_ERROR": "A database error occurred.",
                "INVALID_TOKEN": "The verification token is missing or invalid. Please use the link from your email."
            };
        }
    }

    const getLangString = (key) => lang[key] || key;
    const SECURITY_CHECK_ERROR = 'Security check failed. Please refresh the page and try again.';
    const isCaptchaFailureMessage = (message) => typeof message === 'string' && message.toLowerCase().includes('captcha verification failed');

    // --- Helper to get URL Query Parameters ---
    const getQueryParam = (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    };

    function setFormDisabledState(disabled) {
        [emailInput, verifyButton].forEach((element) => {
            if (!element) return;
            element.disabled = disabled;
        });
    }

    function setHelpText(el, message, isError) {
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('text-danger', Boolean(isError));
        el.classList.toggle('text-muted', !isError);
    }

    // --- Spinner Toggle ---
    function toggleSpinner(show) {
        if (show) {
            console.log('[UI] Showing verification spinner.');
            verifySpinner.style.display = 'inline-block';
            verifyButtonText.textContent = ''; // Clear button text
            verifyButton.disabled = true;
        } else {
            console.log('[UI] Hiding verification spinner.');
            verifySpinner.style.display = 'none';
            verifyButtonText.textContent = 'Verify Email'; // Restore button text
            refreshVerifyState();
        }
    }

    // --- UI Initialization and State Management ---
    async function initializeUI() {
        redirectScheduled = false;
        setFormDisabledState(false);
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        toggleSpinner(false);
        refreshVerifyState();
    
        const invalidLinkModalEl = document.getElementById('invalidLinkModal');
        const token = getQueryParam('token');
    
        if (!invalidLinkModalEl) {
            console.error('[UI] invalidLinkModal not found in DOM.');
            return;
        }
        if (!token) {
            if (window.modalManager && typeof window.modalManager.showModal === 'function') {
                await window.modalManager.showModal(invalidLinkModalEl);
            } else {
                const invalidLinkModal = new bootstrap.Modal(invalidLinkModalEl);
                invalidLinkModal.show();
            }

            invalidLinkModalEl.addEventListener('hidden.bs.modal', () => {
                window.location.href = 'https://bookproject.fjnel.co.za?action=request-verification-email';
            }, { once: true });
            // Do NOT show desktop modal
            return;
        }

    }

    function showErrorAlert(message, errors = []) {
        console.log('[UI] Displaying email verification error alert.');
        successAlert.style.display = 'none';
        if (typeof window.renderApiErrorAlert === 'function') {
            window.renderApiErrorAlert(errorAlert, { message, errors }, message);
        } else {
            errorAlert.textContent = `${message}${errors.length ? `: ${errors.join(' ')}` : ''}`;
        }
        errorAlert.style.display = 'block';
    }

    function showSuccessAlert(messageText, detailText = '') {
        console.log('[UI] Displaying email verification success alert.');
        errorAlert.style.display = 'none';
        successAlert.innerHTML = '';
        const strong = document.createElement('strong');
        strong.textContent = messageText;
        successAlert.appendChild(strong);
        if (detailText) {
            successAlert.appendChild(document.createTextNode(` ${detailText}`));
        }
        successAlert.style.display = 'block';
    }

    function refreshVerifyState() {
        const email = emailInput.value.trim();
        const isValid = email.length > 0 && emailInput.checkValidity();
        verifyButton.disabled = redirectScheduled || !isValid;
    }

    function validateForm() {
        const email = emailInput.value.trim();
        let isValid = true;
        if (!email) {
            setHelpText(emailHelp, 'Please enter your email address.', true);
            isValid = false;
        } else if (!emailInput.checkValidity()) {
            setHelpText(emailHelp, 'Please enter a valid email address.', true);
            isValid = false;
        } else {
            setHelpText(emailHelp, '', false);
        }
        return isValid;
    }

    // --- Main Verification Handler ---
    async function handleVerification(event) {
        event.preventDefault();
        console.log('[Verification] Email verification process initiated.');

        const email = emailInput.value.trim();
        const token = getQueryParam('token');

        if (!validateForm()) {
            refreshVerifyState();
            return;
        }

        if (!token) {
            showErrorAlert(getLangString('INVALID_TOKEN'));
            return;
        }

        setFormDisabledState(true);
        toggleSpinner(true);

        // Obtain reCAPTCHA token (optional for backend; included for consistency)
        let captchaToken;
        try {
            captchaToken = await window.recaptchaV3.getToken('verify_email');
        } catch (e) {
            console.error('[reCAPTCHA] Failed to obtain token for verify-email:', e);
            showErrorAlert(SECURITY_CHECK_ERROR);
            setFormDisabledState(false);
            toggleSpinner(false);
            return;
        }

        try {
            const response = await apiFetch(`/auth/verify-email`, {
                method: 'POST',
                body: JSON.stringify({ email, token, captchaToken }),
            });

            const data = await response.json();
            console.log('[API] Received verification response:', { status: response.status, data });

            if (response.ok) {
                const message = getLangString(data.message);
                showSuccessAlert(message, 'You can now log in.');
                redirectScheduled = true;
                setFormDisabledState(true);
                setTimeout(() => {
                    console.log('[Redirect] Redirecting to homepage...');
                    window.location.href = 'https://bookproject.fjnel.co.za?action=login';
                }, 5000);
            } else {
                const rawMessage = getLangString(data.message);
                if (isCaptchaFailureMessage(rawMessage)) {
                    showErrorAlert(SECURITY_CHECK_ERROR);
                } else {
                    const details = data.errors ? data.errors.map(getLangString).join(' ') : '';
                    showErrorAlert(rawMessage, details ? [details] : []);
                }
            }
        } catch (error) {
            console.error('[API] Network or fetch error during verification:', error);
            showErrorAlert('Connection Error', ['Could not connect to the server.']);
        } finally {
            if (!redirectScheduled) {
                setFormDisabledState(false);
            }
            toggleSpinner(false);
        }
    }

    // --- Event Listeners ---
    verificationForm.addEventListener('submit', handleVerification);
    verifyButton.addEventListener('click', handleVerification);
    emailInput.addEventListener('input', () => {
        errorAlert.style.display = 'none';
        validateForm();
        refreshVerifyState();
    });

    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});
