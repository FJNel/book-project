/**
 * Handles the password reset process by reading a token from the URL,
 * collecting the user's email and new password, and sending them to the API.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const emailInput = document.getElementById('passwordEmail');
    const passwordInput = document.getElementById('passwordPassword');
    const emailHelp = document.getElementById('passwordEmailHelp');
    const passwordHelp = document.getElementById('passwordPasswordHelp');
    const successAlert = document.getElementById('passwordAlertSuccess');
    const errorAlert = document.getElementById('passwordAlertError');
    const resetForm = document.getElementById('resetPasswordForm');
    const resetButton = document.getElementById('resetPasswordButton');
    const resetSpinner = document.getElementById('resetPasswordSpinner');
    const resetButtonText = document.createTextNode('Reset Password');
    resetButton.appendChild(resetButtonText);

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
            console.log('[Language] Password reset language data loaded.');
        } catch (error) {
            console.error('[Language] Failed to load language file:', error);
            // Fallback strings
            lang = {
                "PASSWORD_RESET_SUCCESS": "Your password has been successfully reset.",
                "VALIDATION_ERROR": "Validation Error",
                "EMAIL_VERIFICATION_ERROR": "Reset Error",
                "EMAIL_VERIFICATION_ERROR_DETAIL_1": "The reset link is invalid or has expired.",
                "PASSWORD_RESET_ERROR_DETAIL_2": "Please request a new link.",
                "INTERNAL_SERVER_ERROR": "An internal server error occurred.",
                "INVALID_TOKEN": "The password reset token is missing or invalid. Please use the link from your email."
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
        [emailInput, passwordInput, resetButton].forEach((element) => {
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

    // --- Toggle Spinner on Button ---
    function toggleSpinner(show) {
        if (show) {
            console.log('[UI] Showing password reset spinner.');
            resetSpinner.style.display = 'inline-block';
            resetButtonText.textContent = ''; // Clear button text
            resetButton.disabled = true;
        } else {
            console.log('[UI] Hiding password reset spinner.');
            resetSpinner.style.display = 'none';
            resetButtonText.textContent = 'Reset Password'; // Restore button text
            refreshResetState();
        }
    }

    // --- UI Initialization and State Management ---
    let desktopModalShown = false;
    async function initializeUI() {
        redirectScheduled = false;
        setFormDisabledState(false);
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        toggleSpinner(false);
        refreshResetState();
    
        const invalidLinkModalEl = document.getElementById('invalidLinkModal');
        const token = getQueryParam('token');
    
        if (!invalidLinkModalEl) {
            console.error('[UI] invalidLinkModal not found in DOM.');
            //Fallback use alert
            alert('The password reset link is invalid. Please request a new link.');
            window.location.href = 'https://bookproject.fjnel.co.za?action=request-password-reset';
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
                window.location.href = 'https://bookproject.fjnel.co.za?action=request-password-reset';
            }, { once: true });
            // Do NOT show desktop modal
            return;
        }
    }

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

    function showSuccessAlert(messageText, detailText = '') {
        console.log('[UI] Displaying password reset success alert.');
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

    function clearErrors() {
        errorAlert.style.display = 'none';
        setHelpText(emailHelp, '', false);
        setHelpText(passwordHelp, '', false);
    }

    function updateValidationHints() {
        const email = emailInput.value.trim();
        if (!email) {
            setHelpText(emailHelp, '', false);
        } else if (!emailInput.checkValidity()) {
            setHelpText(emailHelp, 'Please enter a valid email address.', true);
        } else {
            setHelpText(emailHelp, '', false);
        }

        const password = passwordInput.value;
        if (!password) {
            setHelpText(passwordHelp, '', false);
        } else if (!passwordInput.checkValidity()) {
            setHelpText(passwordHelp, 'Password must be 10-100 characters and include uppercase, lowercase, a number, and a special character.', true);
        } else {
            setHelpText(passwordHelp, '', false);
        }
    }

    function refreshResetState() {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const isValid = email.length > 0 && password.length > 0 && emailInput.checkValidity() && passwordInput.checkValidity();
        resetButton.disabled = redirectScheduled || !isValid;
    }

    // --- Form Validation ---
    function validateForm() {
        clearErrors();
        let isValid = true;

        if (!emailInput.checkValidity()) {
            isValid = false;
            if (!email) {
                setHelpText(emailHelp, 'Please enter your email address.', true);
            } else {
                setHelpText(emailHelp, 'Please enter a valid email address.', true);
            }
        }
        if (!passwordInput.checkValidity()) {
            isValid = false;
            if (!passwordInput.value) {
                setHelpText(passwordHelp, 'Please enter your password.', true);
            } else {
                setHelpText(passwordHelp, 'Password must be 10-100 characters and include uppercase, lowercase, a number, and a special character.', true);
            }
        }
        
        console.log(`[Validation] Password reset form validation result: ${isValid ? 'Valid' : 'Invalid'}`);
        return isValid;
    }

    // --- Main Reset Handler ---
    async function handlePasswordReset(event) {
        event.preventDefault();
        console.log('[Password Reset] Password reset process initiated.');

        if (!validateForm()) {
            return;
        }

        const email = emailInput.value.trim();
        const newPassword = passwordInput.value;
        const token = getQueryParam('token');

        if (!token) {
            showErrorAlert(getLangString('INVALID_TOKEN'));
            toggleSpinner(false);
            return;
        }

        setFormDisabledState(true);
        toggleSpinner(true);

        // Obtain reCAPTCHA token
        let captchaToken;
        try {
            captchaToken = await window.recaptchaV3.getToken('reset_password');
        } catch (e) {
            console.error('[reCAPTCHA] Failed to obtain token for reset-password:', e);
            showErrorAlert(SECURITY_CHECK_ERROR);
            setFormDisabledState(false);
            toggleSpinner(false);
            return;
        }

        try {
            const response = await apiFetch(`/auth/reset-password`, {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    token,
                    newPassword,
                    captchaToken
                }),
            });

            const data = await response.json();
            console.log('[API] Received password reset response:', { status: response.status, data });

            if (response.ok) {
                const message = getLangString(data.message);
                showSuccessAlert(message, 'You can now log in with your new password.');
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
                    const message = rawMessage;
                    const details = data.errors ? data.errors.map(getLangString).join(' ') : '';
                    showErrorAlert(message, details ? [details] : []);
                }
            }
        } catch (error) {
            console.error('[API] Network or fetch error during password reset:', error);
            showErrorAlert('Connection Error', ['Could not connect to the server.']);
        } finally {
            if (!redirectScheduled) {
                setFormDisabledState(false);
            }
            toggleSpinner(false);
        }
    }

    // --- Event Listeners ---
    resetForm.addEventListener('submit', handlePasswordReset);
    resetButton.addEventListener('click', handlePasswordReset);
    [emailInput, passwordInput].forEach(input => input.addEventListener('input', () => {
        errorAlert.style.display = 'none';
        updateValidationHints();
        refreshResetState();
    }));

    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});
