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
    const resetButton = document.querySelector('#emailVerificationForm + button'); // Selects the button after the form
    const successAlert = document.getElementById('passwordAlertSuccess');
    const errorAlert = document.getElementById('passwordAlertError');
    const resetForm = document.getElementById('emailVerificationForm');

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

    // --- UI Initialization and State Management ---
    function initializeUI() {
        console.log('[UI] Initializing password reset page UI state.');
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
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

        const email = emailInput.value.trim();
        const newPassword = passwordInput.value;
        const token = getQueryParam('token');

        if (!token) {
            showAlert('error', getLangString("INVALID_TOKEN"));
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    token,
                    newPassword,
                    captchaToken: 'test-bypass-token'
                }),
            });

            const data = await response.json();
            console.log('[API] Received password reset response:', { status: response.status, data });

            if (response.ok) {
                const message = getLangString(data.message);
                showAlert('success', `<strong>${message}</strong> You can now log in with your new password.`);
                setTimeout(() => {
                    console.log('[Redirect] Redirecting to homepage...');
                    window.location.href = 'https://fjnel.co.za';
                }, 5000);
            } else {
                const message = `<strong>${getLangString(data.message)}:</strong>`;
                const details = data.errors ? data.errors.map(getLangString).join(' ') : '';
                showAlert('error', `${message} ${details}`);
            }
        } catch (error) {
            console.error('[API] Network or fetch error during password reset:', error);
            showAlert('error', '<strong>Connection Error:</strong> Could not connect to the server.');
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