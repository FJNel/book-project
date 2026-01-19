'use strict';

/**
 * Confirm email change: mirrors reset-password / verify-email UX and behavior.
 */
document.addEventListener('DOMContentLoaded', () => {
  const oldEmailInput = document.getElementById('oldEmail');
  const newEmailInput = document.getElementById('newEmail');
  const passwordInput = document.getElementById('password');
  const oldEmailHelp = document.getElementById('oldEmailHelp');
  const newEmailHelp = document.getElementById('newEmailHelp');
  const passwordHelp = document.getElementById('passwordHelp');
  const successAlert = document.getElementById('successAlert');
  const errorAlert = document.getElementById('errorAlert');
  const form = document.getElementById('verifyEmailChangeForm');
  const submitBtn = document.getElementById('submitBtn');
  const submitSpinner = document.getElementById('submitSpinner');
  const submitButtonText = document.createTextNode('Confirm Email Change');
  submitBtn.appendChild(submitButtonText);

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const API_BASE_URL = 'https://api.fjnel.co.za';
  let lang = {};
  let redirectScheduled = false;

  async function loadLanguageFile() {
    try {
      const response = await fetch('../../lang/en.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      lang = await response.json();
    } catch (error) {
      console.error('[Language] Failed to load language file:', error);
      lang = {
        EMAIL_CHANGE_SUCCESS: 'Your email has been updated successfully.',
        EMAIL_CHANGE_ERROR: 'Email Change Error',
        EMAIL_CHANGE_INVALID: 'The email change link is invalid or has expired.',
        INVALID_TOKEN: 'The email change token is missing or invalid. Please use the link from your email.'
      };
    }
  }

  const getLangString = (key) => lang[key] || key;
  const SECURITY_CHECK_ERROR_HTML = '<strong>CAPTCHA verification failed:</strong> Please refresh the page and try again.';
  const isCaptchaFailureMessage = (message) => typeof message === 'string' && message.toLowerCase().includes('captcha verification failed');

  const getQueryParam = (param) => params.get(param);

  function setFormDisabledState(disabled) {
    [oldEmailInput, newEmailInput, passwordInput, submitBtn].forEach((el) => { if (el) el.disabled = disabled; });
  }

  function toggleSpinner(show) {
    if (show) {
      submitSpinner.style.display = 'inline-block';
      submitButtonText.textContent = '';
      submitBtn.disabled = true;
    } else {
      submitSpinner.style.display = 'none';
      submitButtonText.textContent = 'Confirm Email Change';
      submitBtn.disabled = redirectScheduled;
    }
  }

  async function initializeUI() {
    redirectScheduled = false;
    setFormDisabledState(false);
    successAlert.style.display = 'none';
    errorAlert.style.display = 'none';
    toggleSpinner(false);

    const invalidLinkModalEl = document.getElementById('invalidLinkModal');
    if (!invalidLinkModalEl) return;
    if (!token) {
      if (window.modalManager && typeof window.modalManager.showModal === 'function') {
        await window.modalManager.showModal(invalidLinkModalEl);
      } else if (window.bootstrap?.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(invalidLinkModalEl).show();
      }
      invalidLinkModalEl.addEventListener('hidden.bs.modal', () => {
        window.location.href = 'https://bookproject.fjnel.co.za?action=login';
      }, { once: true });
      return;
    }

    // Intentionally do not prefill emails; user must re-enter for security.
  }

  function clearErrors() {
    errorAlert.style.display = 'none';
    oldEmailHelp.textContent = '';
    newEmailHelp.textContent = '';
    passwordHelp.textContent = '';
  }

  function validateForm() {
    clearErrors();
    let isValid = true;

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(oldEmailInput.value.trim())) {
      isValid = false;
      oldEmailHelp.textContent = 'Please enter a valid current email.';
    }
    if (!emailPattern.test(newEmailInput.value.trim())) {
      isValid = false;
      newEmailHelp.textContent = 'Please enter a valid new email.';
    }
    if (!passwordInput.value) {
      isValid = false;
      passwordHelp.textContent = 'Password is required to confirm this change.';
    }
    return isValid;
  }

  function showAlert(type, htmlContent) {
    successAlert.style.display = 'none';
    errorAlert.style.display = 'none';
    const target = type === 'success' ? successAlert : errorAlert;
    target.innerHTML = htmlContent;
    target.style.display = 'block';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;
    if (!token) {
      showAlert('error', getLangString('INVALID_TOKEN'));
      return;
    }

    setFormDisabledState(true);
    toggleSpinner(true);

    let captchaToken;
    try {
      captchaToken = await window.recaptchaV3.getToken('verify_email_change');
    } catch (e) {
      console.error('[reCAPTCHA] Failed to obtain token for verify-email-change:', e);
      showAlert('error', SECURITY_CHECK_ERROR_HTML);
      setFormDisabledState(false);
      toggleSpinner(false);
      return;
    }

    try {
      const response = await apiFetch('/users/me/verify-email-change', {
        method: 'POST',
        body: JSON.stringify({
          token,
          oldEmail: oldEmailInput.value.trim(),
          newEmail: newEmailInput.value.trim(),
          password: passwordInput.value,
          captchaToken
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const message = getLangString(data.message) || getLangString('EMAIL_CHANGE_SUCCESS');
        showAlert('success', `<strong>${message}</strong> You can now sign in with the new email.`);
        redirectScheduled = true;
        setFormDisabledState(true);
        setTimeout(() => { window.location.href = 'https://bookproject.fjnel.co.za?action=login'; }, 5000);
      } else {
        const rawMessage = getLangString(data.message || getLangString('EMAIL_CHANGE_ERROR'));
        if (isCaptchaFailureMessage(rawMessage)) {
          showAlert('error', SECURITY_CHECK_ERROR_HTML);
        } else {
          const details = data.errors ? data.errors.map(getLangString).join(' ') : '';
          showAlert('error', `<strong>${rawMessage}:</strong> ${details}`);
        }
      }
    } catch (error) {
      console.error('[API] Network or fetch error during email change verification:', error);
      showAlert('error', '<strong>Connection Error:</strong> Could not connect to the server.');
    } finally {
      if (!redirectScheduled) setFormDisabledState(false);
      toggleSpinner(false);
    }
  }

  form.addEventListener('submit', handleSubmit);
  [oldEmailInput, newEmailInput, passwordInput].forEach((input) => input.addEventListener('input', clearErrors));

  loadLanguageFile();
  initializeUI();
});
