/**
 * Handles the login process, including UI updates, form validation, and API communication.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    const loginSuccessModal = new bootstrap.Modal(document.getElementById('loginSuccessModal'));

    const loginForm = document.getElementById('loginForm');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');

    const loginButton = document.getElementById('loginButton');
    const loginSpinner = document.getElementById('loginSpinner');
    const loginButtonText = loginButton.childNodes[2]; // The "Login" text node

    const loginErrorAlert = document.getElementById('loginErrorAlert');
    const loginEmailHelp = document.getElementById('loginEmailHelp');
    const loginPasswordHelp = document.getElementById('loginPasswordHelp');
    const loginSuccessAlert = document.getElementById('loginSuccessAlert');
    const loginErrorResendVerificationAlert = document.getElementById('loginErrorResendVerificationAlert');

    // API and Language Configuration
    const API_BASE_URL = 'https://api.fjnel.co.za';
    let lang = {}; // To store language strings

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
            // // Fallback strings in case the file fails to load
            // lang = {
            //     "LOGIN_INVALID_CREDENTIALS": "Invalid email or password.",
            //     "LOGIN_INVALID_CREDENTIALS_DETAIL": "The provided email or password is incorrect.",
            //     "LOGIN_SUCCESS": "Login successful.",
            //     "TOO_MANY_REQUESTS": "Too many requests. Please try again later.",
            //     "UNEXPECTED_ERROR": "An unexpected error occurred. Please try again."
            // };
        }
    }

    /**
     * Gets a translated string for a given key.
     * @param {string} key The key to look up in the language file.
     * @returns {string} The translated string or the key itself if not found.
     */
    const getLangString = (key) => lang[key] || key;

    // --- UI Initialization and State Management ---
    /**
     * Sets the initial state of the login form UI elements.
     */
    function initializeUI() {
        console.log('[UI] Initializing login form UI state.');
        loginErrorAlert.style.display = 'none';
        loginSpinner.style.display = 'none';
        loginButtonText.textContent = 'Login';
        loginSuccessAlert.style.display = 'none'; // Explicitly hide loginSuccessAlert
        loginErrorResendVerificationAlert.style.display = 'none'; // Explicitly hide loginErrorResendVerificationAlert
    }

    /**
     * Shows or hides the loading spinner on the login button.
     * @param {boolean} show - True to show spinner, false to hide.
     */
    function toggleSpinner(show) {
        if (show) {
            console.log('[UI] Showing login spinner.');
            loginSpinner.style.display = 'inline-block';
            loginButtonText.textContent = '';
            loginButton.disabled = true;
        } else {
            console.log('[UI] Hiding login spinner.');
            loginSpinner.style.display = 'none';
            loginButtonText.textContent = 'Login';
            loginButton.disabled = false;
        }
    }

    /**
     * Displays an error message in the login error alert.
     * @param {string} htmlContent The HTML content to display in the alert.
     */
    function showLoginError(htmlContent) {
        console.log('[UI] Displaying login error alert.');
        loginErrorAlert.innerHTML = htmlContent;
        loginErrorAlert.style.display = 'block';
    }

    /**
     * Clears all validation help texts and hides the main error alert.
     */
    function clearLoginErrors() {
        console.log('[UI] Clearing login error messages.');
        loginErrorAlert.style.display = 'none';
        loginEmailHelp.textContent = '';
        loginPasswordHelp.textContent = '';
        loginErrorResendVerificationAlert.style.display = 'none';
    }

    // --- Form Validation ---
    /**
     * Validates the login form fields.
     * @returns {boolean} True if the form is valid, false otherwise.
     */
    function validateForm() {
        clearLoginErrors();
        let isValid = true;
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        // Email validation
        if (!email) {
            loginEmailHelp.textContent = 'Please enter your email address.';
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            loginEmailHelp.textContent = 'Please enter a valid email format.';
            isValid = false;
        }

        // Password validation
        if (!password) {
            loginPasswordHelp.textContent = 'Please enter your password.';
            isValid = false;
        }

        console.log(`[Validation] Form validation result: ${isValid ? 'Valid' : 'Invalid'}`);
        return isValid;
    }

    // --- Main Login Handler ---
    /**
     * Handles the login button click event.
     * @param {Event} event - The form submission event.
     */
    async function handleLogin(event) {
        event.preventDefault();
        console.log('[Login] Login process initiated.');

        if (!validateForm()) {
            return;
        }

        toggleSpinner(true);
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    captchaToken: 'test-bypass-token' // Temporary bypass for development
                }),
            });

            const data = await response.json();
            console.log('[API] Received response:', { status: response.status, data });

            if (response.ok && data.message === 'LOGIN_SUCCESS') {
                handleLoginSuccess(data);
            } else {
                handleLoginError(response.status, data);
            }
        } catch (error) {
            console.error('[API] Network or fetch error:', error);
            showLoginError('<strong>Connection Error:</strong> Could not connect to the server. Please check your internet connection and try again.');
        } finally {
            toggleSpinner(false);
        }
    }

    /**
     * Handles a successful login response from the API.
     * @param {object} data The success response data.
     */
    function handleLoginSuccess(data) {
        console.log('[Login] Login successful for user:', data.user.preferredName);

        // Store tokens in Local Storage
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        console.log('[Storage] Auth tokens saved to localStorage.');

        // Update and show the success modal
        const successModalText = document.getElementById('loginSuccessModalText');
        successModalText.innerHTML = `<strong>Welcome back, ${data.user.preferredName}!</strong>`;
        
        loginModal.hide();
        loginSuccessModal.show();

        // Redirect after 3 seconds
        setTimeout(() => {
            console.log('[Redirect] Redirecting to books.html...');
            window.location.href = 'books.html';
        }, 3000);
    }

    /**
     * Handles an error response from the API.
     * @param {number} status The HTTP status code.
     * @param {object} data The error response data.
     */
    function handleLoginError(status, data) {
        console.warn('[Login] Login failed with status:', status);
        if (status === 429) {
            showLoginError('<strong>Too many requests:</strong> Please try again later.');
        } else if (status === 401 && data.message === 'LOGIN_INVALID_CREDENTIALS') {
            const message = `<strong>${getLangString(data.message)}</strong>`;
            const details = data.errors.map(getLangString).join(' ');
            showLoginError(`${message} ${details}`);
            loginErrorResendVerificationAlert.style.display = 'block';
        } else {
            showLoginError('<strong>An unexpected error occurred:</strong> Please try again.');
        }
    }


    // --- Event Listeners ---
    loginForm.addEventListener('submit', handleLogin);
    loginButton.addEventListener('click', handleLogin); // For buttons not in form context

    // Clear errors when the user starts typing again
    loginEmailInput.addEventListener('input', clearLoginErrors);
    loginPasswordInput.addEventListener('input', clearLoginErrors);


    // --- App Initialization ---
    loadLanguageFile();
    initializeUI();
});