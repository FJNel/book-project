// --- Language Setup ---
const fetchAndApplyLanguage = async (lang) => {
    try {
        console.log("[Lang] Fetching language file:", lang);
        const res = await fetch(`../lang/${lang}.json`);
        if (!res.ok) throw new Error(`Could not fetch language file: ${lang}.json`);
        const translations = await res.json();
        console.log("[Lang] Applying translations:", translations);
        document.querySelectorAll("[data-lang]").forEach(el => {
            const key = el.getAttribute("data-lang");
            if (translations[key]) {
                if (el.tagName === "TITLE") {
                    document.title = translations[key];
                } else if (
                    el.closest("#googleSignInErrorModal") &&
                    ["google_error_p1","google_error_li1", "google_error_li2", "google_error_li3"].includes(key)
                ) {
                    // Render HTML for Google error modal list items
                    el.innerHTML = translations[key];
                } else {
                    el.textContent = translations[key];
                }
            }
        });
        document.title = translations.page_title || "The Book Project";
    } catch (error) {
        console.error("[Lang] Failed to load language file:", error);
    }
};

/**
 * Checks the status of the backend API before loading the page.
 * If the API is down, it displays a non-closable modal.
 */
(async () => {
    try {
        console.log('[API Check] Checking API status...');
        const response = await fetch('https://api.fjnel.co.za');
        if (!response.ok) {
            console.error('[API Check] Failed: Network response was not ok.');
            throw new Error(`Network response was not ok. Status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status !== 'success') {
            console.error('[API Check] Failed: API status is not success.', data);
            throw new Error(`API status returned: ${data.status}`);
        }
        console.log('[API Check] Success: API is operational.');
    } catch (error) {
        console.error('[API Check] Failed:', error);
        const lang = localStorage.getItem('language') || 'en';
        await fetchAndApplyLanguage(lang);
        const apiErrorModal = new bootstrap.Modal(document.getElementById('apiErrorModal'));
        apiErrorModal.show();
    }
})();


/**
 * Callback function that handles the credential response from Google Sign-In.
 */
async function handleCredentialResponse(response) {
    console.log("[GoogleSignIn] Received credential response:", response);
    const googleIdToken = response.credential;
    const backendUrl = 'https://api.fjnel.co.za/auth/google';

    try {
        console.log("[GoogleSignIn] Sending token to backend...");
        const res = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: googleIdToken }),
        });

        if (!res.ok) {
            console.error("[GoogleSignIn] Backend verification failed:", res);
            alert('Authentication failed. Please try again.');
            return;
        }

        const json = await res.json();
        const accessToken = json.data?.accessToken;
        const user = json.data?.user;

        if (accessToken && user) {
            console.log("[GoogleSignIn] Authentication successful. Storing token and user data.");
            localStorage.setItem('authToken', accessToken);
        
            const lang = localStorage.getItem('language') || 'en';
            const resLang = await fetch(`../lang/${lang}.json`);
            const translations = await resLang.json();
        
            console.log("[GoogleSignIn] Displaying success modal...");
            const modalBody = document.getElementById('loginSuccessModalBody');
            const welcomeMsg = translations.login_success_message.replace('{name}', user.preferredName || user.fullName || user.email);
            modalBody.textContent = welcomeMsg;
        
            const loginModal = new bootstrap.Modal(document.getElementById('loginSuccessModal'));
            loginModal.show();
        
            setTimeout(() => {
                window.location.href = 'books.html';
            }, 3000);
        } else {
            console.error("[GoogleSignIn] Access token or user data not received.");
            alert('Could not log you in. Please try again.');
        }
    } catch (error) {
        console.error("[GoogleSignIn] Error sending token to backend:", error);
        alert('An error occurred during sign-in. Please check the console.');
    }
}


/**
 * Initializes the Google Sign-In client.
 */
function initializeGoogleSignIn() {
    console.log("[GoogleInit] Initializing Google Sign-In...");
    if (typeof google === 'undefined' || !google.accounts) {
        console.warn("[GoogleInit] Google library not ready, retrying in 100ms...");
        setTimeout(initializeGoogleSignIn, 100);
        return;
    }

    console.log("[GoogleInit] Google library ready.");
    google.accounts.id.initialize({
        client_id: '1046748066305-2hasc6e95hhc7penpipegf0be1n1cosa.apps.googleusercontent.com',
        callback: handleCredentialResponse,
        use_fedcm_for_prompt: true
    });
    console.log("[GoogleInit] Initialization complete.");
}

/**
 * Shows a fallback UI when Google One Tap fails to display.
 * This hides the Google button and promotes standard login/registration.
 */
function showGoogleErrorFallback() {
    console.log("[GoogleError] Displaying fallback UI for Google Sign-In failure.");
    const googleErrorModal = new bootstrap.Modal(document.getElementById('googleSignInErrorModal'));
    googleErrorModal.show();

    // Hide the Google button and the "OR" divider
    console.log("[GoogleError] Hiding Google Sign-In button and OR divider.");
    document.getElementById('google-custom-signin')?.classList.add('d-none');
    document.getElementById('or-divider')?.classList.add('d-none');

    // Promote the other buttons to primary actions
    console.log("[GoogleError] Promoting other buttons to primary actions.");
    const registerBtn = document.getElementById('register-button');
    const loginBtn = document.getElementById('login-button');
    if (registerBtn && loginBtn) {
        registerBtn.classList.replace('btn-outline-secondary', 'btn-primary');
        loginBtn.classList.replace('btn-outline-secondary', 'btn-primary');
    }
}


// Main execution block
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Main] Document loaded.");

    const themeSwitcher = document.getElementById('theme-switcher');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    const languageSelectorMenu = document.getElementById('language-selector-menu');
    const selectedLanguageText = document.getElementById('selected-language-text');
    const customGoogleButton = document.getElementById('google-custom-signin');

    // --- Theme Setup ---
    const getStoredTheme = () => localStorage.getItem('theme');
    const setStoredTheme = theme => localStorage.setItem('theme', theme);
    console.log("[Theme] Stored theme:", getStoredTheme());

    const getPreferredTheme = () => {
        const storedTheme = getStoredTheme();
        return storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    };

    const setTheme = theme => {
        document.documentElement.setAttribute('data-bs-theme', theme);
        sunIcon.classList.toggle('d-none', theme === 'light');
        moonIcon.classList.toggle('d-none', theme === 'dark');
        console.log("[Theme] Applied theme:", theme);
    };

    setTheme(getPreferredTheme());

    themeSwitcher.addEventListener('click', () => {
        const newTheme = getStoredTheme() === 'light' ? 'dark' : 'light';
        setStoredTheme(newTheme);
        setTheme(newTheme);
    });
    
    const updateLanguageUI = (lang) => {
      console.log("[Lang] Updating language UI to:", lang);
      const langOption = languageSelectorMenu.querySelector(`[data-lang-value="${lang}"]`);
      if (langOption) {
        selectedLanguageText.textContent = langOption.textContent;
      }
      fetchAndApplyLanguage(lang);
    };

    const storedLanguage = localStorage.getItem('language') || 'en';
    updateLanguageUI(storedLanguage);
    
    languageSelectorMenu.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target.closest('.dropdown-item');
        if (target && target.dataset.langValue) {
            const selectedLang = target.dataset.langValue;
            localStorage.setItem('language', selectedLang);
            updateLanguageUI(selectedLang);
        }
    });

    // --- Google Sign-In Initialization and Fallback ---
    initializeGoogleSignIn();

    if (customGoogleButton) {
        console.log("[GoogleSignIn] Custom Google Sign-In button found.");
        customGoogleButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof google !== 'undefined' && google.accounts?.id) {
                console.log("[GoogleSignIn] Prompting Google One Tap sign-in.");
                google.accounts.id.prompt((notification) => {
                    // This callback handles various states of the One Tap prompt.
                    if (notification.isNotDisplayed()) {
                        console.error("Google One Tap prompt failed to display. Reason:", notification.getNotDisplayedReason());
                        showGoogleErrorFallback();
                    } else if (notification.isSkippedMoment()) {
                        console.log("User skipped the One Tap prompt.", notification.getSkippedReason());
                        showGoogleErrorFallback();
                    } else if (notification.isDismissedMoment()){
                        console.log("User dismissed the One Tap prompt.", notification.getDismissedReason());
                        showGoogleErrorFallback();
                    }
                });
            } else {
                console.error("Google Sign-In library not ready or initialized.");
                showGoogleErrorFallback();
            }
        });
    }
});
