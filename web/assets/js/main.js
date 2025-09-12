/**
 * Callback function that handles the response from Google Sign-In.
 */
async function handleCredentialResponse(response) {
    console.log("[GoogleSignIn] Received credential response:", response);

    const googleIdToken = response.credential;
    const backendUrl = 'https://api.fjnel.co.za/auth/google';

    try {
        const res = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: googleIdToken }),
        });
        console.log("[GoogleSignIn] Sent token to backend:", { googleIdToken, backendUrl });
        console.log("[GoogleSignIn] Backend response:", res);

        if (!res.ok) {
            console.error("[GoogleSignIn] Backend verification failed:", res);
            alert('Authentication failed. Please try again.');
            return;
        }

        const json = await res.json();
        const accessToken = json.data && json.data.accessToken;
        const user = json.data && json.data.user;
        console.log("[GoogleSignIn] Parsed backend response:", { accessToken, user });

        if (accessToken && user) {
            localStorage.setItem('authToken', accessToken);
        
            // Get current language
            const lang = localStorage.getItem('language') || 'en';
            const resLang = await fetch(`../lang/${lang}.json`);
            const translations = await resLang.json();
        
            // Show success modal with user's name
            const modalBody = document.getElementById('loginSuccessModalBody');
            const welcomeMsg = translations.login_success_message.replace('{name}', user.preferredName || user.fullName || user.email);
            modalBody.textContent = welcomeMsg;
        
            const loginModal = new bootstrap.Modal(document.getElementById('loginSuccessModal'));
            loginModal.show();
        
            setTimeout(() => {
                window.location.href = 'books.html';
            }, 3000);
        } else {
            console.error("[GoogleSignIn] Access token not received.");
            alert('Could not log you in. Please try again.');
        }
    } catch (error) {
        console.error("[GoogleSignIn] Error sending token to backend:", error);
        alert('An error occurred during sign-in. Please check the console.');
    }
}


/**
 * Initializes Google Sign-In.
 */
function initializeGoogleSignIn() {
    if (typeof google === 'undefined' || typeof google.accounts === 'undefined') {
        console.warn("[GoogleInit] Google library not ready yet, retrying...");
        setTimeout(initializeGoogleSignIn, 100);
        return;
    }

    console.log("[GoogleInit] Initializing with client_id...");
    google.accounts.id.initialize({
        client_id: '1046748066305-2hasc6e95hhc7penpipegf0be1n1cosa.apps.googleusercontent.com',
        callback: handleCredentialResponse
    });

    // DELETE the line below, as we are no longer rendering Google's button
    // renderGoogleButton(); 
    console.log("[GoogleInit] Initialization complete.");
}


// Main execution block
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Main] DOMContentLoaded fired. Setting up theme, language, and Google Sign-In...");

    const themeSwitcher = document.getElementById('theme-switcher');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const languageSelector = document.getElementById('language-selector');
    const storedLanguage = localStorage.getItem('language') || 'en';
    languageSelector.value = storedLanguage;

    // --- Theme Setup ---
    const getStoredTheme = () => localStorage.getItem('theme');
    const setStoredTheme = theme => localStorage.setItem('theme', theme);

    const getPreferredTheme = () => {
        const storedTheme = getStoredTheme();
        if (storedTheme) return storedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const setTheme = theme => {
        document.documentElement.setAttribute('data-bs-theme', theme);
        if (theme === 'dark') {
            sunIcon.classList.remove('d-none');
            moonIcon.classList.add('d-none');
        } else {
            sunIcon.classList.add('d-none');
            moonIcon.classList.remove('d-none');
        }
        console.log("[Theme] Applied theme:", theme);
    };

    const currentTheme = getPreferredTheme();
    setTheme(currentTheme);

    initializeGoogleSignIn();

    const customGoogleButton = document.getElementById('google-custom-signin');
    if (customGoogleButton) {
        customGoogleButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        // Fallback: open Google OAuth2 in a new window
                        const clientId = '1046748066305-2hasc6e95hhc7penpipegf0be1n1cosa.apps.googleusercontent.com';
                        const redirectUri = window.location.origin + '/oauth-callback.html'; // or your backend endpoint
                        const scope = 'openid email profile';
                        const oauthUrl =
                            `https://accounts.google.com/o/oauth2/v2/auth?` +
                            `client_id=${encodeURIComponent(clientId)}` +
                            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                            `&response_type=token` +
                            `&scope=${encodeURIComponent(scope)}`;
                        window.open(oauthUrl, '_blank', 'width=500,height=600');
                        console.warn("[GoogleSignIn] Google prompt not displayed, opened OAuth2 URL as fallback.");
                    }
                });
            } else {
                console.error("Google library not ready.");
            }
        });
    }

    themeSwitcher.addEventListener('click', () => {
        const theme = getStoredTheme() === 'light' ? 'dark' : 'light';
        setStoredTheme(theme);
        setTheme(theme);
        // renderGoogleButton();
    });

    // --- Language Setup ---
    const fetchAndApplyLanguage = async (lang) => {
        try {
            const res = await fetch(`../lang/${lang}.json`);
            const translations = await res.json();
    
            document.querySelectorAll("[data-lang]").forEach(el => {
                const key = el.getAttribute("data-lang");
                if (translations[key]) {
                    if (el.tagName === "TITLE") {
                        document.title = translations[key];
                    } else if (el.id === "google-custom-signin") {
                        const span = el.querySelector("#google-signin-text");
                        if (span) {
                            span.textContent = translations[key];
                        }
                    } else {
                        el.textContent = translations[key];
                    }
                }
            });
        } catch (error) {
            console.error("[Lang] Failed to load language file:", error);
        }
    };

    fetchAndApplyLanguage(storedLanguage);

    languageSelector.addEventListener('change', () => {
        const selectedLang = languageSelector.value;
        localStorage.setItem('language', selectedLang);
        fetchAndApplyLanguage(selectedLang);
        // renderGoogleButton();
    });

    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data && event.data.type === 'google-login-success') {
            const { accessToken, user } = event.data.data;
            localStorage.setItem('authToken', accessToken);
    
            // Show success modal with user's name
            const lang = localStorage.getItem('language') || 'en';
            fetch(`../lang/${lang}.json`)
                .then(res => res.json())
                .then(translations => {
                    const modalBody = document.getElementById('loginSuccessModalBody');
                    const welcomeMsg = translations.login_success_message.replace('{name}', user.preferredName || user.fullName || user.email);
                    modalBody.textContent = welcomeMsg;
    
                    const loginModal = new bootstrap.Modal(document.getElementById('loginSuccessModal'));
                    loginModal.show();
    
                    setTimeout(() => {
                        window.location.href = 'books.html';
                    }, 3000);
                });
        }
    });
});
