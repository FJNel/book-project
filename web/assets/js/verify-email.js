/**
 * Handles the email verification process by reading a token from the URL,
 * collecting the user's email, and sending them to the API.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const emailInput = document.getElementById('resendEmail');
    const verifyButton = document.getElementById('verifyButton');
    const successAlert = document.getElementById('emailVerificationAlertSuccess');
    const errorAlert = document.getElementById('emailVerificationAlertError');
    const verificationForm = document.getElementById('emailVerificationForm');
    const verifySpinner = document.getElementById('verifySpinner');
    const verifyButtonText = document.createTextNode('Verify Email');
    verifyButton.appendChild(verifyButtonText);

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
            verifyButton.disabled = false;
        }
    }

    // --- UI Initialization and State Management ---
    function initializeUI() {
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        toggleSpinner(false);
    
        const invalidLinkModalEl = document.getElementById('invalidLinkModal');
        const token = getQueryParam('token');
    
        if (!invalidLinkModalEl) {
            console.error('[UI] invalidLinkModal not found in DOM.');
            return;
        }
        const invalidLinkModal = new bootstrap.Modal(invalidLinkModalEl);
    
        if (!token) {
            // Show only the invalid link modal
            invalidLinkModal.show();
            invalidLinkModalEl.addEventListener('hidden.bs.modal', () => {
                window.location.href = 'https://bookproject.fjnel.co.za?action=request-verification-email';
            }, { once: true });
            // Do NOT show desktop modal
            return;
        }

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

        toggleSpinner(true);

        // Obtain reCAPTCHA token (optional for backend; included for consistency)
        let captchaToken;
        try {
            captchaToken = await window.recaptchaV3.getToken('verify_email');
        } catch (e) {
            console.error('[reCAPTCHA] Failed to obtain token for verify-email:', e);
            showAlert('error', '<strong>Security Check Failed:</strong> Please refresh the page and try again.');
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
                showAlert('success', `<strong>${message}</strong> You can now log in.`);
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
            console.error('[API] Network or fetch error during verification:', error);
            showAlert('error', '<strong>Connection Error:</strong> Could not connect to the server.');
        } finally {
            toggleSpinner(false);
        }
    }

    // --- Event Listeners ---
    verificationForm.addEventListener('submit', handleVerification);
    verifyButton.addEventListener('click', handleVerification);

    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});
