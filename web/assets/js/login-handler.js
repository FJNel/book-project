/**
 * Handles the login process, including UI updates, form validation, and API communication.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const loginModalEl = document.getElementById('loginModal');
    const loginSuccessModalEl = document.getElementById('loginSuccessModal');
    const modalManager = window.modalManager;

    const loginForm = document.getElementById('loginForm');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');

    const loginButton = document.getElementById('loginButton');
    const loginSpinner = document.getElementById('loginSpinner');
    const loginButtonText = document.createTextNode('Login'); // Create a text node for "Login"
    loginButton.appendChild(loginButtonText); // Append it to the button

    const loginErrorAlert = document.getElementById('loginErrorAlert');
    const loginEmailHelp = document.getElementById('loginEmailHelp');
    const loginPasswordHelp = document.getElementById('loginPasswordHelp');
    const loginSuccessAlert = document.getElementById('loginSuccessAlert');
    const loginErrorResendVerificationAlert = document.getElementById('loginErrorResendVerificationAlert');

    // Prevent duplicate submits (click + submit/Enter)
    let isSubmitting = false;

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

    /**
     * Gets a translated string for a given key.
     * @param {string} key The key to look up in the language file.
     * @returns {string} The translated string or the key itself if not found.
     */
    const getLangString = (key) => lang[key] || key;
    const isCaptchaFailureMessage = (message) => typeof message === 'string' && message.toLowerCase().includes('captcha verification failed');

    // --- UI Initialization and State Management ---
    /**
     * Sets the initial state of the login form UI elements.
     */
    function initializeUI() {
        console.log('[UI] Initializing login form UI state.');
        clearLoginAlerts();
        loginSpinner.style.display = 'none';
        loginButtonText.textContent = 'Login';
        loginSuccessAlert.style.display = 'none'; // Explicitly hide loginSuccessAlert
        loginErrorResendVerificationAlert.style.display = 'none'; // Explicitly hide loginErrorResendVerificationAlert
        setModalLocked(false);
        refreshLoginState();
    }

    /**
     * Shows or hides the loading spinner on the login button.
     * @param {boolean} show - True to show spinner, false to hide.
     */
    function setLoginInputsDisabled(disabled) {
        [loginEmailInput, loginPasswordInput].forEach((input) => {
            if (input) {
                input.disabled = disabled;
            }
        });
    }

    function toggleSpinner(show) {
        if (show) {
            console.log('[UI] Showing login spinner.');
            loginSpinner.style.display = 'inline-block';
            loginButtonText.textContent = '';
            loginButton.disabled = true;
            setLoginInputsDisabled(true);
            setModalLocked(true);
        } else {
            console.log('[UI] Hiding login spinner.');
            loginSpinner.style.display = 'none';
            loginButtonText.textContent = 'Login';
            loginButton.disabled = false;
            setLoginInputsDisabled(false);
            setModalLocked(false);
        }
    }

    function setModalLocked(locked) {
        if (!loginModalEl) return;
        loginModalEl.dataset.locked = locked ? 'true' : 'false';
        const closeButtons = loginModalEl.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
        closeButtons.forEach((btn) => {
            btn.disabled = locked;
        });
    }

    function focusInvalidField(field) {
        if (!field) return;
        if (typeof field.scrollIntoView === 'function') {
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        field.focus({ preventScroll: true });
    }

    if (loginModalEl) {
        loginModalEl.addEventListener('hide.bs.modal', (event) => {
            if (isSubmitting && event.isTrusted) {
                event.preventDefault();
            }
        });
    }

    async function handleLogin(event) {
        event.preventDefault();
        if (isSubmitting) return;
        isSubmitting = true;

        console.log('[Login] Login process initiated.');
        const { isValid, firstInvalidField } = validateForm();
        if (!isValid) {
            focusInvalidField(firstInvalidField);
            isSubmitting = false;
            return;
        }

        toggleSpinner(true);
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        try {
            let captchaToken;
            try {
                captchaToken = await window.recaptchaV3.getToken('login');
            } catch (e) {
                console.error('[reCAPTCHA] Failed to obtain token for login:', e);
                showLoginError('Security Check Failed', ['Please refresh the page and try again.']);
                return;
            }

            const response = await apiFetch(`/auth/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password, captchaToken }),
            });

            const data = await response.json();
            console.log('[API] Received response:', { status: response.status, data });

            if (response.ok && data?.data?.accessToken && data?.data?.refreshToken) {
                await handleLoginSuccess(data);
            } else {
                handleLoginError(response.status, data);
            }
        } catch (error) {
            console.error('[API] Network or fetch error:', error);
            showLoginError('Connection Error', ['Could not connect to the server. Please try again.']);
        } finally {
            toggleSpinner(false);
            isSubmitting = false;
        }
    }

    /**
     * Displays an error message in the login error alert.
     * @param {string} htmlContent The HTML content to display in the alert.
     */
    function showLoginError(message, errors = []) {
        console.log('[UI] Displaying login error alert.');
        if (typeof window.renderApiErrorAlert === 'function') {
            window.renderApiErrorAlert(loginErrorAlert, { message, errors }, message);
        } else {
            loginErrorAlert.textContent = `${message}${errors.length ? `: ${errors.join(' ')}` : ''}`;
        }
        loginErrorAlert.style.display = 'block';
    }

    /**
     * Clears all validation help texts and hides the main error alert.
     */
    function clearLoginAlerts() {
        loginErrorAlert.style.display = 'none';
        loginErrorResendVerificationAlert.style.display = 'none';
    }

    function setHelpText(el, message, isError) {
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('text-danger', Boolean(isError));
        el.classList.toggle('text-muted', !isError);
    }

    function clearLoginErrors() {
        console.log('[UI] Clearing login error messages.');
        clearLoginAlerts();
        loginEmailHelp.textContent = '';
        loginPasswordHelp.textContent = '';
    }

    // --- Form Validation ---
    /**
     * Validates the login form fields.
     * @returns {boolean} True if the form is valid, false otherwise.
     */
    function validateForm() {
        clearLoginErrors();
        let isValid = true;
        let firstInvalidField = null;
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        // Email validation
        if (!email) {
            setHelpText(loginEmailHelp, 'Please enter your email address.', true);
            isValid = false;
            if (!firstInvalidField) firstInvalidField = loginEmailInput;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setHelpText(loginEmailHelp, 'Please enter a valid email format.', true);
            isValid = false;
            if (!firstInvalidField) firstInvalidField = loginEmailInput;
        } else {
            setHelpText(loginEmailHelp, '', false);
        }

        // Password validation
        if (!password) {
            setHelpText(loginPasswordHelp, 'Please enter your password.', true);
            isValid = false;
            if (!firstInvalidField) firstInvalidField = loginPasswordInput;
        } else {
            setHelpText(loginPasswordHelp, '', false);
        }

        console.log(`[Validation] Form validation result: ${isValid ? 'Valid' : 'Invalid'}`);
        return { isValid, firstInvalidField };
    }

    function validateEmailRealtime() {
        clearLoginAlerts();
        const email = loginEmailInput.value.trim();
        if (!email) {
            setHelpText(loginEmailHelp, 'Please enter your email address.', true);
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setHelpText(loginEmailHelp, 'Please enter a valid email format.', true);
            return false;
        }
        setHelpText(loginEmailHelp, '', false);
        return true;
    }

    function validatePasswordRealtime() {
        clearLoginAlerts();
        const password = loginPasswordInput.value;
        if (!password) {
            setHelpText(loginPasswordHelp, 'Please enter your password.', true);
            return false;
        }
        setHelpText(loginPasswordHelp, '', false);
        return true;
    }

    function refreshLoginState() {
        const emailOk = validateEmailRealtime();
        const passwordOk = validatePasswordRealtime();
        loginButton.disabled = !(emailOk && passwordOk);
    }

    /**
     * Handles a successful login response from the API.
     * @param {object} data The success response data.
     */
    async function handleLoginSuccess(data) {
        console.log('[Login] Login successful for user:', data.data.user.preferredName);

        // Save tokens + user profile
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        localStorage.setItem('userProfile', JSON.stringify({
            id: data.data.user.id,
            email: data.data.user.email,
            fullName: data.data.user.fullName,
            preferredName: data.data.user.preferredName,
            role: data.data.user.role,
            themePreference: data.data.user.themePreference || 'device'
        }));

        if (window.themeManager) {
            window.themeManager.setPreference(data.data.user.themePreference || 'device', { persist: true });
        }

        // Remove action/returnTo from URL so nothing re-opens the login modal later
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('action')) url.searchParams.delete('action');
            if (url.searchParams.has('returnTo')) url.searchParams.delete('returnTo');
            const query = url.searchParams.toString();
            window.history.replaceState({}, document.title, url.pathname + (query ? `?${query}` : '') + url.hash);
        } catch (error) {
            console.warn('[Login] Unable to update URL query params:', error);
        }

        // Update success modal text
        const successModalText = document.getElementById('loginSuccessModalText');
        if (successModalText) {
            successModalText.innerHTML = `<strong>Welcome back, ${data.data.user.preferredName}!</strong>`;
        }

        // Hide the login modal before showing the success state
        if (loginModalEl) {
            if (modalManager && typeof modalManager.hideModal === 'function') {
                await modalManager.hideModal(loginModalEl);
            } else {
                const instance = bootstrap.Modal.getInstance(loginModalEl);
                if (instance && loginModalEl.classList.contains('show')) {
                    await new Promise((resolve) => {
                        loginModalEl.addEventListener('hidden.bs.modal', resolve, { once: true });
                        instance.hide();
                    });
                }
            }
        }

        if (loginSuccessModalEl) {
            if (modalManager && typeof modalManager.showModal === 'function') {
                await modalManager.showModal(loginSuccessModalEl);
            } else {
                const successInstance = bootstrap.Modal.getOrCreateInstance(loginSuccessModalEl);
                await new Promise((resolve) => {
                    loginSuccessModalEl.addEventListener('shown.bs.modal', resolve, { once: true });
                    successInstance.show();
                });
            }
        }

        const storedReturnTo = window.authRedirect && typeof window.authRedirect.consume === 'function'
            ? window.authRedirect.consume()
            : null;
        let returnTo = storedReturnTo;
        if (!returnTo) {
            try {
                const url = new URL(window.location.href);
                returnTo = url.searchParams.get('returnTo');
            } catch (error) {
                returnTo = null;
            }
        }

        setTimeout(() => {
            if (returnTo) {
                console.log('[Redirect] Redirecting to original destination.', { returnTo });
                window.location.href = returnTo;
                return;
            }
            console.log('[Redirect] Redirecting to dashboard...');
            window.location.href = 'dashboard';
        }, 3000);
    }

    /**
     * Handles an error response from the API.
     * @param {number} status The HTTP status code.
     * @param {object} data The error response data.
     */
    function handleLoginError(status, data) {
        console.warn('[Login] Login failed with status:', status);
        loginErrorResendVerificationAlert.style.display = 'none';
        const rawMessage = getLangString(data?.message || 'An unexpected error occurred.');
        if (isCaptchaFailureMessage(rawMessage)) {
            showLoginError('Security Check Failed', ['Please refresh the page and try again.']);
            return;
        }
        const messageText = rawMessage;
        const detailErrors = Array.isArray(data?.errors) && data.errors.length
            ? data.errors.map(getLangString)
            : [];

        if (status === 401) {
            showLoginError(messageText, detailErrors);
            loginErrorResendVerificationAlert.style.display = 'block';
            return;
        }

        if (status === 429 || status === 400) {
            showLoginError(messageText, detailErrors);
            return;
        }

        showLoginError('Unexpected error', ['Please try again.']);
    }

    loginForm.addEventListener('submit', handleLogin);

    loginEmailInput.addEventListener('input', refreshLoginState);
    loginPasswordInput.addEventListener('input', refreshLoginState);
    loginButton.addEventListener('click', handleLogin);

    loadLanguageFile();
    initializeUI();
});
