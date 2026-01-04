/**
 * Handles the registration process, including UI updates, form validation, and API communication.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const registerModal = document.getElementById('registerModal');
    const registerForm = document.getElementById('registerForm');

    // Input Fields
    const fullNameInput = document.getElementById('registerFullName');
    const preferredNameInput = document.getElementById('registerPreferredName');
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');

    // Help Text Elements
    const fullNameHelp = document.getElementById('registerFullNameHelp');
    const preferredNameHelp = document.getElementById('registerPreferredNameHelp');
    const emailHelp = document.getElementById('registerEmailHelp');
    const passwordHelp = document.getElementById('registerPasswordHelp');

    // Button and Spinner
    const registerButton = registerModal.querySelector('.modal-footer .btn-primary');
    const registerSpinner = registerButton.querySelector('.spinner-border');
    const registerButtonText = document.createTextNode('Register');
    registerButton.appendChild(registerButtonText);

    // Alerts
    const successAlert = document.getElementById('registerSuccessAlert');
    const errorAlert = document.getElementById('registerErrorAlert');

    // API and Language Configuration
    const API_BASE_URL = 'https://api.fjnel.co.za';
    let lang = {};

    // --- Language File Handler ---
    /**
     * Fetches and loads the language file (e.g., en.json).
     */
    async function loadLanguageFile() {
        try {
            const response = await fetch('../../lang/en.json'); // Path to the language file
            if (!response.ok) {
                throw new Error(`Failed to load language file: ${response.status} ${response.statusText}`);
            }
            lang = await response.json();
            console.log('[Language] Language data loaded successfully:', lang);
        } catch (error) {
            console.error('[Language] Failed to load language file:', error);
            // Fallback strings in case the file fails to load
            lang = {
                "LOGIN_INVALID_CREDENTIALS": "Invalid email or password.",
                "LOGIN_INVALID_CREDENTIALS_DETAIL": "The provided email or password is incorrect.",
                "LOGIN_SUCCESS": "Login successful.",
                "TOO_MANY_REQUESTS": "Too many requests. Please try again later.",
                "UNEXPECTED_ERROR": "An unexpected error occurred. Please try again."
            };
        }
    }

    const getLangString = (key) => lang[key] || key;
    const SECURITY_CHECK_ERROR_HTML = '<strong>CAPTCHA verification failed:</strong> Please refresh the page and try again.';
    const isCaptchaFailureMessage = (message) => typeof message === 'string' && message.toLowerCase().includes('captcha verification failed');

    // --- UI Initialization and State Management ---
    let registerControlsLocked = false;
    let isSubmitting = false;

    function initializeUI() {
        registerControlsLocked = false;
        console.log('[UI] Initializing register form UI state.');
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        registerSpinner.style.display = 'none';
        registerButtonText.textContent = 'Register';
        setRegisterInputsDisabled(false);
        setModalLocked(false);
    }

    function setRegisterInputsDisabled(disabled) {
        [fullNameInput, preferredNameInput, emailInput, passwordInput].forEach((input) => {
            if (input) {
                input.disabled = disabled;
            }
        });
    }

    function toggleSpinner(show) {
        if (show) {
            console.log('[UI] Showing register spinner.');
            registerSpinner.style.display = 'inline-block';
            registerButtonText.textContent = '';
            registerButton.disabled = true;
            setModalLocked(true);
        } else {
            console.log('[UI] Hiding register spinner.');
            registerSpinner.style.display = 'none';
            registerButtonText.textContent = 'Register';
            registerButton.disabled = registerControlsLocked;
            setModalLocked(false);
        }
    }

    function setModalLocked(locked) {
        if (!registerModal) return;
        registerModal.dataset.locked = locked ? 'true' : 'false';
        const closeButtons = registerModal.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
        closeButtons.forEach((btn) => {
            btn.disabled = locked;
        });
    }

    if (registerModal) {
        registerModal.addEventListener('hide.bs.modal', (event) => {
            if (isSubmitting && event.isTrusted) {
                event.preventDefault();
            }
        });
    }

    function showRegisterError(htmlContent) {
        console.log('[UI] Displaying register error alert.');
        successAlert.style.display = 'none';
        errorAlert.innerHTML = htmlContent;
        errorAlert.style.display = 'block';
    }
    
    function showRegisterSuccess(htmlContent) {
        console.log('[UI] Displaying register success alert.');
        errorAlert.style.display = 'none';
        successAlert.innerHTML = htmlContent;
        successAlert.style.display = 'block';
    }

    function clearRegisterErrors() {
        console.log('[UI] Clearing register error messages.');
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        fullNameHelp.textContent = '';
        preferredNameHelp.textContent = '';
        emailHelp.textContent = '';
        passwordHelp.textContent = '';
    }

    // --- Form Validation ---
    function validateRegisterForm() {
        clearRegisterErrors();
        let isValid = true;

        const fullName = fullNameInput.value;
        const preferredName = preferredNameInput.value;
        const email = emailInput.value;
        const password = passwordInput.value;

        // Full Name
        if (!fullNameInput.checkValidity()) {
            isValid = false;
            if (fullName.length === 0) fullNameHelp.textContent = 'Please enter your full name.';
            else if (fullName.length < 2) fullNameHelp.textContent = 'Full name is too short.';
            else fullNameHelp.textContent = 'Full name contains invalid characters (allowed: letters, spaces, -, ., \').';
        }

        // Preferred Name (optional, but validate if present)
        if (preferredName && !preferredNameInput.checkValidity()) {
            isValid = false;
            preferredNameHelp.textContent = 'Preferred name can only contain letters and must be at least 2 characters long.';
        }

        // Email
        if (!emailInput.checkValidity()) {
            isValid = false;
            if (email.length === 0) emailHelp.textContent = 'Please enter your email address.';
            else emailHelp.textContent = 'Please enter a valid email address format.';
        }

        // Password
        if (!passwordInput.checkValidity()) {
            isValid = false;
            if (password.length === 0) passwordHelp.textContent = 'Please enter a password.';
            else passwordHelp.textContent = 'Password must be 10-100 characters and include uppercase, lowercase, a number, and a special character.';
        }
        
        console.log(`[Validation] Register form validation result: ${isValid ? 'Valid' : 'Invalid'}`);
        return isValid;
    }

    function validateFullNameRealtime() {
        const fullName = fullNameInput.value;
        if (!fullName) {
            fullNameHelp.textContent = 'Please enter your full name.';
            return false;
        }
        if (fullName.length < 2) {
            fullNameHelp.textContent = 'Full name is too short.';
            return false;
        }
        if (!fullNameInput.checkValidity()) {
            fullNameHelp.textContent = 'Full name contains invalid characters (allowed: letters, spaces, -, ., \').';
            return false;
        }
        fullNameHelp.textContent = '';
        return true;
    }

    function validatePreferredNameRealtime() {
        const preferredName = preferredNameInput.value;
        if (!preferredName) {
            preferredNameHelp.textContent = '';
            return true;
        }
        if (!preferredNameInput.checkValidity()) {
            preferredNameHelp.textContent = 'Preferred name can only contain letters and must be at least 2 characters long.';
            return false;
        }
        preferredNameHelp.textContent = '';
        return true;
    }

    function validateEmailRealtime() {
        const email = emailInput.value;
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

    function validatePasswordRealtime() {
        const password = passwordInput.value;
        if (!password) {
            passwordHelp.textContent = 'Please enter a password.';
            return false;
        }
        if (!passwordInput.checkValidity()) {
            passwordHelp.textContent = 'Password must be 10-100 characters and include uppercase, lowercase, a number, and a special character.';
            return false;
        }
        passwordHelp.textContent = '';
        return true;
    }

    // --- Main Registration Handler ---
    async function handleRegister(event) {
        event.preventDefault();
        console.log('[Register] Registration process initiated.');

        if (!validateRegisterForm()) {
            return;
        }

        if (isSubmitting) {
            return;
        }
        isSubmitting = true;

        let shouldKeepDisabled = false;
        setRegisterInputsDisabled(true);
        toggleSpinner(true);

        try {
            let captchaToken;
            try {
                captchaToken = await window.recaptchaV3.getToken('register');
            } catch (e) {
                console.error('[reCAPTCHA] Failed to obtain token for register:', e);
                showRegisterError('<strong>Security Check Failed:</strong> Please refresh the page and try again.');
                setRegisterInputsDisabled(false);
                toggleSpinner(false);
                return;
            }

            const response = await apiFetch(`/auth/register`, {
                method: 'POST',
                body: JSON.stringify({
                    fullName: fullNameInput.value,
                    preferredName: preferredNameInput.value || null,
                    email: emailInput.value,
                    password: passwordInput.value,
                    captchaToken
                }),
            });

            const data = await response.json();
            console.log('[API] Received registration response:', { status: response.status, data });

            if (response.status === 201 || response.status === 200) { // 201 for new, 200 for existing unverified
                shouldKeepDisabled = true;
                handleRegisterSuccess(data);
            } else {
                handleRegisterError(response.status, data);
            }
        } catch (error) {
            console.error('[API] Network or fetch error during registration:', error);
            showRegisterError('<strong>Connection Error:</strong> Could not connect to the server. Please try again.');
        } finally {
            registerControlsLocked = shouldKeepDisabled;
            toggleSpinner(false);
            if (!registerControlsLocked) {
                setRegisterInputsDisabled(false);
            }
            isSubmitting = false;
        }
    }

    function handleRegisterSuccess(data) {
        console.log('[Register] Registration successful or verification re-sent.');
        registerForm.reset(); // Clear the form fields
        const messageText = data?.message || 'If this email can be registered, you will receive an email with the next steps shortly.';
        const disclaimerText = typeof data?.data?.disclaimer === 'string' ? data.data.disclaimer : '';
        const html = disclaimerText
            ? `<strong>${messageText}</strong><br><em>${disclaimerText}</em>`
            : `<strong>${messageText}</strong>`;
        showRegisterSuccess(html);
        setRegisterInputsDisabled(true);
        registerControlsLocked = true;
        registerButton.disabled = true;
    }

    function handleRegisterError(status, data) {
        console.warn('[Register] Registration failed with status:', status);
        const rawMessage = getLangString(data?.message || 'An unexpected error occurred.');
        if (isCaptchaFailureMessage(rawMessage)) {
            showRegisterError(SECURITY_CHECK_ERROR_HTML);
            return;
        }
        const message = `<strong>${rawMessage}:</strong>`;
        const details = Array.isArray(data.errors) ? data.errors.map(getLangString).join(' ') : getLangString(data.errors);
        showRegisterError(`${message} ${details}`);
    }

    // --- Event Listeners ---
    registerForm.addEventListener('submit', handleRegister);
    registerButton.addEventListener('click', handleRegister);

    fullNameInput.addEventListener('input', validateFullNameRealtime);
    preferredNameInput.addEventListener('input', validatePreferredNameRealtime);
    emailInput.addEventListener('input', validateEmailRealtime);
    passwordInput.addEventListener('input', validatePasswordRealtime);
    
    [fullNameInput, preferredNameInput, emailInput, passwordInput].forEach(input => {
        input.addEventListener('input', clearRegisterErrors);
    });

    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});
