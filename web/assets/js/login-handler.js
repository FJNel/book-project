document.addEventListener('DOMContentLoaded', () => {
    console.log('[Login Handler] Initializing login handler...');

    // Hide alerts and spinner on page load
    console.log('[Login Handler] Hiding alerts and spinner on page load...');
    document.getElementById('loginSuccessAlert').style.display = 'none';
    document.getElementById('loginErrorAlert').style.display = 'none';
    document.getElementById('loginErrorResendVerificationAlert').style.display = 'none';
    document.getElementById('loginSpinner').style.display = 'none';

    // Clear alerts when user changes input
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginEmailHelp = document.getElementById('loginEmailHelp');
    const loginPasswordHelp = document.getElementById('loginPasswordHelp');

    const clearAlerts = () => {
        console.log('[Login Handler] Clearing alerts...');
        document.getElementById('loginErrorAlert').style.display = 'none';
        document.getElementById('loginErrorResendVerificationAlert').style.display = 'none';
        loginEmailHelp.textContent = '';
        loginPasswordHelp.textContent = '';
    };

    loginEmail.addEventListener('input', clearAlerts);
    loginPassword.addEventListener('input', clearAlerts);

    // Show resendVerificationEmailModal when resendVerificationLink is clicked
    const resendVerificationLink = document.getElementById('resendVerificationLink');
    if (resendVerificationLink) {
        console.log('[Login Handler] Adding click event listener to resendVerificationLink...');
        resendVerificationLink.addEventListener('click', () => {
            console.log('[Login Handler] Resend verification link clicked. Showing resendVerificationEmailModal...');
            const resendVerificationEmailModal = new bootstrap.Modal(document.getElementById('resendVerificationEmailModal'));
            resendVerificationEmailModal.show();
        });
    }

    // Handle login button click
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        console.log('[Login Handler] Adding click event listener to loginButton...');
        loginButton.addEventListener('click', async (event) => {
            event.preventDefault();
            console.log('[Login Handler] Login button clicked. Starting login process...');

            // Hide button text and show spinner
            console.log('[Login Handler] Hiding login button text and showing spinner...');
            loginButton.querySelector('span').style.display = 'inline-block';
            loginButton.disabled = true;

            // Validate input fields
            console.log('[Login Handler] Validating input fields...');
            let isValid = true;

            // Email validation
            if (!loginEmail.checkValidity()) {
                console.warn('[Login Handler] Invalid email address.');
                loginEmailHelp.textContent = 'Please enter a valid email address.';
                loginEmailHelp.style.color = 'red';
                isValid = false;
            } else {
                loginEmailHelp.textContent = '';
            }

            // Password validation
            if (!loginPassword.checkValidity()) {
                console.warn('[Login Handler] Invalid password.');
                loginPasswordHelp.textContent = 'Please enter a valid password.';
                loginPasswordHelp.style.color = 'red';
                isValid = false;
            } else {
                loginPasswordHelp.textContent = '';
            }

            if (!isValid) {
                console.warn('[Login Handler] Validation failed. Showing login button text and hiding spinner...');
                loginButton.querySelector('span').style.display = 'none';
                loginButton.disabled = false;
                return;
            }

            // Send login request to the API
            console.log('[Login Handler] Sending login request to the API...');
            const apiUrl = 'https://api.fjnel.co.za/auth/login';
            const captchaToken = '<captcha-token>'; // Replace with actual CAPTCHA token logic
            const payload = {
                captchaToken,
                email: loginEmail.value,
                password: loginPassword.value,
            };

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (response.status === 429) {
                    console.warn('[Login Handler] Too many requests (429). Showing loginErrorModal...');
                    const loginErrorModal = new bootstrap.Modal(document.getElementById('loginErrorModal'));
                    const loginErrorModalText = document.getElementById('loginErrorModalText');
                    loginErrorModalText.textContent = 'Too many login attempts. Please try again later.';
                    loginErrorModal.show();
                    return;
                }

                const data = await response.json();
                console.log('[Login Handler] API response received:', data);

                if (response.ok && data.message === 'LOGIN_SUCCESS') {
                    console.log('[Login Handler] Login successful. Showing loginSuccessModal...');
                    const loginSuccessModal = new bootstrap.Modal(document.getElementById('loginSuccessModal'));
                    const loginSuccessModalText = document.getElementById('loginSuccessModalText');
                    loginSuccessModalText.textContent = `Welcome back, ${data.user.preferredName}!`;
                    loginSuccessModal.show();

                    // Store JWT token in localStorage
                    console.log('[Login Handler] Storing JWT token in localStorage...');
                    localStorage.setItem('authToken', data.token);

                    // Redirect to dashboard after a short delay
                    console.log('[Login Handler] Redirecting to dashboard...');
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 3000);
                } else {
                    console.warn('[Login Handler] Login failed. Showing error alerts...');
                    const loginErrorAlert = document.getElementById('loginErrorAlert');
                    loginErrorAlert.innerHTML = `<strong>${data.message}</strong><br>${data.errors.join('<br>')}`;
                    loginErrorAlert.style.display = 'block';

                    if (data.message === 'LOGIN_INVALID_CREDENTIALS') {
                        console.warn('[Login Handler] Invalid credentials. Showing resend verification alert...');
                        const loginErrorResendVerificationAlert = document.getElementById('loginErrorResendVerificationAlert');
                        loginErrorResendVerificationAlert.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('[Login Handler] Login request failed:', error);
                const loginErrorAlert = document.getElementById('loginErrorAlert');
                loginErrorAlert.innerHTML = '<strong>Unexpected Error:</strong> Please try again later.';
                loginErrorAlert.style.display = 'block';
            } finally {
                console.log('[Login Handler] Resetting login button state...');
                loginButton.querySelector('span').style.display = 'none';
                loginButton.disabled = false;
            }
        });
    }
});