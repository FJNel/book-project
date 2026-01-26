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
    const isCaptchaFailureMessage = (message) => typeof message === 'string' && message.toLowerCase().includes('captcha verification failed');

    // --- UI Initialization and State Management ---
    let registerControlsLocked = false;
    let isSubmitting = false;

    function initializeUI() {
        registerControlsLocked = false;
        console.log('[UI] Initializing register form UI state.');
        clearRegisterAlerts();
        registerSpinner.style.display = 'none';
        registerButtonText.textContent = 'Register';
        setRegisterInputsDisabled(false);
        setModalLocked(false);
        refreshRegisterState();
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

    function focusInvalidField(field) {
        if (!field) return;
        if (typeof field.scrollIntoView === 'function') {
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        field.focus({ preventScroll: true });
    }

    function showRegisterError(message, errors = []) {
        console.log('[UI] Displaying register error alert.');
        successAlert.style.display = 'none';
        if (typeof window.renderApiErrorAlert === 'function') {
            window.renderApiErrorAlert(errorAlert, { message, errors }, message);
        } else {
            errorAlert.textContent = `${message}${errors.length ? `: ${errors.join(' ')}` : ''}`;
        }
        errorAlert.style.display = 'block';
    }
    
    function showRegisterSuccess(message) {
        console.log('[UI] Displaying register success alert.');
        errorAlert.style.display = 'none';
        successAlert.textContent = message || '';
        successAlert.style.display = 'block';
    }

    function clearRegisterErrors() {
        console.log('[UI] Clearing register error messages.');
        clearRegisterAlerts();
        setHelpText(fullNameHelp, '', false);
        setHelpText(preferredNameHelp, '', false);
        setHelpText(emailHelp, '', false);
        setHelpText(passwordHelp, '', false);
    }

    function clearRegisterAlerts() {
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
    }

    function setHelpText(el, message, isError) {
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('text-danger', Boolean(isError));
        el.classList.toggle('text-muted', !isError);
    }

    // --- Form Validation ---
    function validateRegisterForm() {
        clearRegisterErrors();
        let isValid = true;
        let firstInvalidField = null;

        const fullName = fullNameInput.value;
        const preferredName = preferredNameInput.value;
        const email = emailInput.value;
        const password = passwordInput.value;

        // Full Name
        if (!fullNameInput.checkValidity()) {
            isValid = false;
            if (fullName.length === 0) setHelpText(fullNameHelp, 'Please enter your full name.', true);
            else if (fullName.length < 2) setHelpText(fullNameHelp, 'Full name is too short.', true);
            else setHelpText(fullNameHelp, 'Full name contains invalid characters (allowed: letters, spaces, -, ., \' ).', true);
            if (!firstInvalidField) firstInvalidField = fullNameInput;
        } else {
            setHelpText(fullNameHelp, '', false);
        }

        // Preferred Name (optional, but validate if present)
        if (preferredName && !preferredNameInput.checkValidity()) {
            isValid = false;
            setHelpText(preferredNameHelp, 'Preferred name can only contain letters and must be at least 2 characters long.', true);
            if (!firstInvalidField) firstInvalidField = preferredNameInput;
        } else if (preferredName) {
            setHelpText(preferredNameHelp, '', false);
        }

        // Email
        if (!emailInput.checkValidity()) {
            isValid = false;
            if (email.length === 0) setHelpText(emailHelp, 'Please enter your email address.', true);
            else setHelpText(emailHelp, 'Please enter a valid email address format.', true);
            if (!firstInvalidField) firstInvalidField = emailInput;
        } else {
            setHelpText(emailHelp, '', false);
        }

        // Password
        if (!passwordInput.checkValidity()) {
            isValid = false;
            if (password.length === 0) setHelpText(passwordHelp, 'Please enter a password.', true);
            else setHelpText(passwordHelp, 'Password must be 10-100 characters and include uppercase, lowercase, a number, and a special character.', true);
            if (!firstInvalidField) firstInvalidField = passwordInput;
        } else {
            setHelpText(passwordHelp, '', false);
        }
        
        console.log(`[Validation] Register form validation result: ${isValid ? 'Valid' : 'Invalid'}`);
        return { isValid, firstInvalidField };
    }

    function validateFullNameRealtime() {
        clearRegisterAlerts();
        const fullName = fullNameInput.value;
        if (!fullName) {
            setHelpText(fullNameHelp, 'Please enter your full name.', true);
            return false;
        }
        if (fullName.length < 2) {
            setHelpText(fullNameHelp, 'Full name is too short.', true);
            return false;
        }
        if (!fullNameInput.checkValidity()) {
            setHelpText(fullNameHelp, 'Full name contains invalid characters (allowed: letters, spaces, -, ., \' ).', true);
            return false;
        }
        setHelpText(fullNameHelp, '', false);
        return true;
    }

    function validatePreferredNameRealtime() {
        clearRegisterAlerts();
        const preferredName = preferredNameInput.value;
        if (!preferredName) {
            setHelpText(preferredNameHelp, '', false);
            return true;
        }
        if (!preferredNameInput.checkValidity()) {
            setHelpText(preferredNameHelp, 'Preferred name can only contain letters and must be at least 2 characters long.', true);
            return false;
        }
        setHelpText(preferredNameHelp, '', false);
        return true;
    }

    function validateEmailRealtime() {
        clearRegisterAlerts();
        const email = emailInput.value;
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

    function validatePasswordRealtime() {
        clearRegisterAlerts();
        const password = passwordInput.value;
        if (!password) {
            setHelpText(passwordHelp, 'Please enter a password.', true);
            return false;
        }
        if (!passwordInput.checkValidity()) {
            setHelpText(passwordHelp, 'Password must be 10-100 characters and include uppercase, lowercase, a number, and a special character.', true);
            return false;
        }
        setHelpText(passwordHelp, '', false);
        return true;
    }

    function refreshRegisterState() {
        const fullOk = validateFullNameRealtime();
        const preferredOk = validatePreferredNameRealtime();
        const emailOk = validateEmailRealtime();
        const passwordOk = validatePasswordRealtime();
        registerButton.disabled = registerControlsLocked || !(fullOk && preferredOk && emailOk && passwordOk);
    }

    // --- Main Registration Handler ---
    async function handleRegister(event) {
        event.preventDefault();
        console.log('[Register] Registration process initiated.');

        const { isValid, firstInvalidField } = validateRegisterForm();
        if (!isValid) {
            focusInvalidField(firstInvalidField);
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
                showRegisterError('Security Check Failed', ['Please refresh the page and try again.']);
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
            showRegisterError('Connection Error', ['Could not connect to the server. Please try again.']);
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
        const text = disclaimerText ? `${messageText} ${disclaimerText}` : messageText;
        showRegisterSuccess(text);
        setRegisterInputsDisabled(true);
        registerControlsLocked = true;
        registerButton.disabled = true;
    }

    function handleRegisterError(status, data) {
        console.warn('[Register] Registration failed with status:', status);
        const rawMessage = getLangString(data?.message || 'An unexpected error occurred.');
        if (isCaptchaFailureMessage(rawMessage)) {
            showRegisterError('Security Check Failed', ['Please refresh the page and try again.']);
            return;
        }
        const details = Array.isArray(data?.errors)
            ? data.errors.map(getLangString)
            : (data?.errors ? [getLangString(data.errors)] : []);
        showRegisterError(rawMessage, details);
    }

    // --- Event Listeners ---
    registerForm.addEventListener('submit', handleRegister);
    registerButton.addEventListener('click', handleRegister);

    fullNameInput.addEventListener('input', refreshRegisterState);
    preferredNameInput.addEventListener('input', refreshRegisterState);
    emailInput.addEventListener('input', refreshRegisterState);
    passwordInput.addEventListener('input', refreshRegisterState);
    
    [fullNameInput, preferredNameInput, emailInput, passwordInput].forEach(input => {
        input.addEventListener('input', clearRegisterAlerts);
    });

    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});
