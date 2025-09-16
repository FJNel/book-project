/**
 * Handles the email verification process by reading a token from the URL,
 * collecting the user's email, and sending them to the API.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const emailInput = document.getElementById('resendEmail'); // Note: ID in HTML is resendEmail
    const verifyButton = document.getElementById('verifyEmailButton');
    const successAlert = document.getElementById('emailVerificationAlertSuccess');
    const errorAlert = document.getElementById('emailVerificationAlertError');
    const verificationForm = document.getElementById('emailVerificationForm');

    // API and Language Configuration
    const API_BASE_URL = 'https://api.fjnel.co.za';
    let lang = {};

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

    // --- Helper to get URL Query Parameters ---
    const getQueryParam = (param) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    };

    // --- UI Initialization and State Management ---
    function initializeUI() {
        console.log('[UI] Initializing email verification page UI state.');
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
    }

    function showAlert(type, htmlContent) {
        console.log(`[UI] Displaying email verification ${type} alert.`);
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        const alertToShow = type === 'success' ? successAlert : errorAlert;
        alertToShow.innerHTML = htmlContent;
        alertToShow.style.display = 'block';
    }

    // --- Main Verification Handler ---
    async function handleVerification(event) {
        event.preventDefault();
        console.log('[Verification] Email verification process initiated.');

        const email = emailInput.value.trim();
        const token = getQueryParam('token');

        // Basic local validation
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showAlert('error', 'Please enter a valid email address.');
            return;
        }

        if (!token) {
            showAlert('error', getLangString("INVALID_TOKEN"));
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token }),
            });

            const data = await response.json();
            console.log('[API] Received verification response:', { status: response.status, data });

            if (response.ok) {
                const message = getLangString(data.message);
                showAlert('success', `<strong>${message}</strong> You can now log in.`);
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
            console.error('[API] Network or fetch error during verification:', error);
            showAlert('error', '<strong>Connection Error:</strong> Could not connect to the server.');
        }
    }

    // --- Event Listeners ---
    verificationForm.addEventListener('submit', handleVerification);
    verifyButton.addEventListener('click', handleVerification);

    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});