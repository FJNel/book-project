// Lightweight loader and token helper for reCAPTCHA v3
// Uses a hidden div in HTML: <div id="recaptcha-root" data-sitekey="YOUR_SITE_KEY"></div>
(function () {
  const SCRIPT_ID = 'recaptcha-v3-script';
  let siteKey = null;
  let loadPromise = null;

  function readSiteKeyFromDom() {
    if (siteKey) return siteKey;
    try {
      const el = document.querySelector('#recaptcha-root[data-sitekey]');
      if (el) {
        const key = (el.getAttribute('data-sitekey') || '').trim();
        if (key) siteKey = key;
      }
    } catch (_) {}
    return siteKey;
  }

  function injectScript(key) {
    if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha.execute) {
      return Promise.resolve();
    }
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) {
        // If the script tag exists, wait for grecaptcha.ready if available
        if (window.grecaptcha && window.grecaptcha.ready) {
          window.grecaptcha.ready(resolve);
        } else {
          // As a fallback, poll briefly
          const i = setInterval(() => {
            if (window.grecaptcha && window.grecaptcha.execute) {
              clearInterval(i);
              resolve();
            }
          }, 50);
          setTimeout(() => { clearInterval(i); resolve(); }, 3000);
        }
        return;
      }

      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.async = true;
      s.defer = true;
      s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(key);
      s.onload = () => {
        if (window.grecaptcha && window.grecaptcha.ready) {
          window.grecaptcha.ready(resolve);
        } else {
          resolve();
        }
      };
      s.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
      document.head.appendChild(s);
    });

    return loadPromise;
  }

  async function ensureLoaded() {
    if (!siteKey) readSiteKeyFromDom();
    if (!siteKey) throw new Error('reCAPTCHA site key not found. Expected #recaptcha-root[data-sitekey].');
    await injectScript(siteKey);
  }

  async function getToken(action) {
    if (!action || typeof action !== 'string') action = 'generic';
    await ensureLoaded();
    return window.grecaptcha.execute(siteKey, { action });
  }

  function init(key) {
    if (key && typeof key === 'string') siteKey = key.trim();
    return ensureLoaded();
  }

  // Expose a minimal API
  window.recaptchaV3 = { init, getToken, ensureLoaded };
})();

// Preload reCAPTCHA as soon as the DOM is ready so first use is fast
document.addEventListener('DOMContentLoaded', () => {
  if (window.recaptchaV3 && typeof window.recaptchaV3.ensureLoaded === 'function') {
    window.recaptchaV3.ensureLoaded().catch(() => {/* ignore preload errors; will retry on demand */});
  }
});
