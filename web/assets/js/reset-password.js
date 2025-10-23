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

    // --- Helper to get URL Query Parameters ---
    const getQueryParam = (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    };

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
            resetButton.disabled = false;
        }
    }

    // --- UI Initialization and State Management ---
    let desktopModalShown = false;
    function initializeUI() {
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        toggleSpinner(false);
    
        const invalidLinkModalEl = document.getElementById('invalidLinkModal');
        const token = getQueryParam('token');
    
        if (!invalidLinkModalEl) {
            console.error('[UI] invalidLinkModal not found in DOM.');
            //Fallback use alert
            alert('The password reset link is invalid. Please request a new link.');
            window.location.href = 'https://bookproject.fjnel.co.za?action=request-password-reset';
            return;
        }
        const invalidLinkModal = new bootstrap.Modal(invalidLinkModalEl);
    
        if (!token) {
            // Show only the invalid link modal
            invalidLinkModal.show();
            invalidLinkModalEl.addEventListener('hidden.bs.modal', () => {
                window.location.href = 'https://bookproject.fjnel.co.za?action=request-password-reset';
            }, { once: true });
            // Do NOT show desktop modal
            return;
        }
    }

    function showAlert(type, htmlContent) {
        console.log(`[UI] Displaying password reset ${type} alert.`);
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        const alertToShow = type === 'success' ? successAlert : errorAlert;
        alertToShow.innerHTML = htmlContent;
        alertToShow.style.display = 'block';
    }

    function clearErrors() {
        errorAlert.style.display = 'none';
        emailHelp.textContent = '';
        passwordHelp.textContent = '';
    }

    // --- Form Validation ---
    function validateForm() {
        clearErrors();
        let isValid = true;

        if (!emailInput.checkValidity()) {
            isValid = false;
            emailHelp.textContent = 'Please enter a valid email address.';
        }
        if (!passwordInput.checkValidity()) {
            isValid = false;
            passwordHelp.textContent = 'Password must be 10-100 characters and include uppercase, lowercase, a number, and a special character.';
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

        toggleSpinner(true);

        const email = emailInput.value.trim();
        const newPassword = passwordInput.value;
        const token = getQueryParam('token');

        if (!token) {
            showAlert('error', getLangString("INVALID_TOKEN"));
            toggleSpinner(false);
            return;
        }

        // Obtain reCAPTCHA token
        let captchaToken;
        try {
            captchaToken = await window.recaptchaV3.getToken('reset-password');
        } catch (e) {
            console.error('[reCAPTCHA] Failed to obtain token for reset-password:', e);
            showAlert('error', '<strong>Security Check Failed:</strong> Please refresh the page and try again.');
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
                showAlert('success', `<strong>${message}</strong> You can now log in with your new password.`);
                setTimeout(() => {
                    console.log('[Redirect] Redirecting to homepage...');
                    window.location.href = 'https://bookproject.fjnel.co.za?action=login';
                }, 5000);
            } else {
                const message = `<strong>${getLangString(data.message)}:</strong>`;
                const details = data.errors ? data.errors.map(getLangString).join(' ') : '';
                showAlert('error', `${message} ${details}`);
            }
        } catch (error) {
            console.error('[API] Network or fetch error during password reset:', error);
            showAlert('error', '<strong>Connection Error:</strong> Could not connect to the server.');
        } finally {
            toggleSpinner(false);
        }
    }

    // --- Event Listeners ---
    resetForm.addEventListener('submit', handlePasswordReset);
    resetButton.addEventListener('click', handlePasswordReset);
    [emailInput, passwordInput].forEach(input => input.addEventListener('input', clearErrors));

    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});
