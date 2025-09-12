// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // --- THEME SWITCHER ---
    const themeSwitcher = document.getElementById('theme-switcher');
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    // Function to get the preferred theme from system or local storage
    const getPreferredTheme = () => {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
            return storedTheme;
        }
        // If no theme is stored, use the system preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    // Function to apply the theme to the document
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-bs-theme', theme);
        // Show the correct icon based on the theme
        if (theme === 'dark') {
            sunIcon.classList.remove('d-none');
            moonIcon.classList.add('d-none');
        } else {
            sunIcon.classList.add('d-none');
            moonIcon.classList.remove('d-none');
        }
    };

    // Initialize the theme when the page loads
    const currentTheme = getPreferredTheme();
    applyTheme(currentTheme);

    // Add click event listener to the theme switcher button
    themeSwitcher.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });


    // --- LANGUAGE SWITCHER ---
    const languageSelector = document.getElementById('language-selector');

    // Function to fetch and apply language data
    const loadLanguage = async (lang) => {
        try {
            const response = await fetch(`lang/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Could not load language file: ${lang}.json`);
            }
            const translations = await response.json();
            
            // Find all elements with a data-lang attribute and update their text
            document.querySelectorAll('[data-lang]').forEach(element => {
                const key = element.getAttribute('data-lang');
                if (translations[key]) {
                    element.textContent = translations[key];
                }
            });
            // Set the lang attribute on the html tag for accessibility
            document.documentElement.lang = lang;
        } catch (error) {
            console.error('Error loading language:', error);
        }
    };

    // Function to handle language change from the dropdown
    const handleLanguageChange = () => {
        const selectedLanguage = languageSelector.value;
        localStorage.setItem('language', selectedLanguage);
        loadLanguage(selectedLanguage);
    };

    // Add change event listener to the language selector dropdown
    languageSelector.addEventListener('change', handleLanguageChange);

    // Initialize the language when the page loads
    const savedLanguage = localStorage.getItem('language') || 'en'; // Default to English
    languageSelector.value = savedLanguage; // Set dropdown to the saved language
    loadLanguage(savedLanguage);
});
