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

    // --- UI Initialization and State Management ---
    function initializeUI() {
        console.log('[UI] Initializing register form UI state.');
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
        registerSpinner.style.display = 'none';
        registerButtonText.textContent = 'Register';
    }

    function toggleSpinner(show) {
        if (show) {
            console.log('[UI] Showing register spinner.');
            registerSpinner.style.display = 'inline-block';
            registerButtonText.textContent = '';
            registerButton.disabled = true;
        } else {
            console.log('[UI] Hiding register spinner.');
            registerSpinner.style.display = 'none';
            registerButtonText.textContent = 'Register';
            registerButton.disabled = false;
        }
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

    // --- Main Registration Handler ---
    async function handleRegister(event) {
        event.preventDefault();
        console.log('[Register] Registration process initiated.');

        if (!validateRegisterForm()) {
            return;
        }

        toggleSpinner(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: fullNameInput.value,
                    preferredName: preferredNameInput.value || null,
                    email: emailInput.value,
                    password: passwordInput.value,
                    captchaToken: 'test-bypass-token'
                }),
            });

            const data = await response.json();
            console.log('[API] Received registration response:', { status: response.status, data });

            if (response.status === 201 || response.status === 200) { // 201 for new, 200 for existing unverified
                handleRegisterSuccess(data);
            } else {
                handleRegisterError(response.status, data);
            }
        } catch (error) {
            console.error('[API] Network or fetch error during registration:', error);
            showRegisterError('<strong>Connection Error:</strong> Could not connect to the server. Please try again.');
        } finally {
            toggleSpinner(false);
        }
    }
    
    function handleRegisterSuccess(data) {
        console.log('[Register] Registration successful or verification re-sent.');
        registerForm.reset(); // Clear the form fields
        showRegisterSuccess('<strong>Registration successful:</strong> Please verify your email using the link we sent you before logging in.');
    }

    function handleRegisterError(status, data) {
        console.warn('[Register] Registration failed with status:', status);
        const message = `<strong>${getLangString(data.message)}:</strong>`;
        const details = Array.isArray(data.errors) ? data.errors.map(getLangString).join(' ') : getLangString(data.errors);
        showRegisterError(`${message} ${details}`);
    }

    // --- Event Listeners ---
    registerForm.addEventListener('submit', handleRegister);
    registerButton.addEventListener('click', handleRegister);
    
    [fullNameInput, preferredNameInput, emailInput, passwordInput].forEach(input => {
        input.addEventListener('input', clearRegisterErrors);
    });

    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});