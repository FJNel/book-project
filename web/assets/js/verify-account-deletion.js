'use strict';

/**
 * Confirm account deletion: mirrors reset-password / verify-email UX.
 */
document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmCheckbox = document.getElementById('confirm');
  const emailHelp = document.getElementById('emailHelp');
  const passwordHelp = document.getElementById('passwordHelp');
  const successAlert = document.getElementById('successAlert');
  const errorAlert = document.getElementById('errorAlert');
  const form = document.getElementById('verifyDeletionForm');
  const submitBtn = document.getElementById('submitBtn');
  const submitSpinner = document.getElementById('submitSpinner');
  const submitButtonText = document.createTextNode('Confirm Deletion');
  submitBtn.appendChild(submitButtonText);

  const params = new URLSearchParams(window.location.search);
  const token = (params.get('token') || '').trim();

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
        DELETION_SUCCESS: 'Your deletion request has been confirmed.',
        DELETION_ERROR: 'Deletion Error',
        INVALID_TOKEN: 'The deletion token is missing or invalid. Please use the link from your email.'
      };
    }
  }

  const getLangString = (key) => lang[key] || key;
  const SECURITY_CHECK_ERROR = 'Security check failed. Please refresh the page and try again.';
  const isCaptchaFailureMessage = (message) => typeof message === 'string' && message.toLowerCase().includes('captcha verification failed');

  const getQueryParam = (param) => params.get(param);

  async function showInvalidLinkModal(modalEl) {
    if (!modalEl) return false;
    if (window.modalManager && typeof window.modalManager.showModal === 'function') {
      await window.modalManager.showModal(modalEl);
      return true;
    }
    if (window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
      return true;
    }
    // Fallback: force display if Bootstrap isn't available
    modalEl.classList.add('show');
    modalEl.style.display = 'block';
    modalEl.removeAttribute('aria-hidden');
    return true;
  }

  function setFormDisabledState(disabled) {
    [emailInput, passwordInput, confirmCheckbox, submitBtn].forEach((el) => { if (el) el.disabled = disabled; });
  }

  function setHelpText(el, message, isError) {
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('text-danger', Boolean(isError));
    el.classList.toggle('text-muted', !isError);
  }

  function toggleSpinner(show) {
    if (show) {
      submitSpinner.style.display = 'inline-block';
      submitButtonText.textContent = '';
      submitBtn.disabled = true;
    } else {
      submitSpinner.style.display = 'none';
      submitButtonText.textContent = 'Confirm Deletion';
      refreshSubmitState();
    }
  }

  async function initializeUI() {
    redirectScheduled = false;
    setFormDisabledState(false);
    successAlert.style.display = 'none';
    errorAlert.style.display = 'none';
    toggleSpinner(false);
    refreshSubmitState();

    const invalidLinkModalEl = document.getElementById('invalidLinkModal');
    if (!invalidLinkModalEl) return;
    if (!token) {
      await showInvalidLinkModal(invalidLinkModalEl);
      invalidLinkModalEl.addEventListener('hidden.bs.modal', () => {
        window.location.href = 'https://bookproject.fjnel.co.za?action=login';
      }, { once: true });
      return;
    }

    // Intentionally do not prefill email; user must re-enter for security.
  }

  function clearErrors() {
    errorAlert.style.display = 'none';
    setHelpText(emailHelp, '', false);
    setHelpText(passwordHelp, '', false);
  }

  function validateForm() {
    clearErrors();
    let isValid = true;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailInput.value.trim())) {
      isValid = false;
      if (!emailInput.value.trim()) {
        setHelpText(emailHelp, 'Please enter your email address.', true);
      } else {
        setHelpText(emailHelp, 'Please enter a valid email address.', true);
      }
    }
    if (!passwordInput.value) {
      isValid = false;
      setHelpText(passwordHelp, 'Password is required to confirm deletion.', true);
    }
    if (!confirmCheckbox.checked) {
      isValid = false;
      showErrorAlert('Please confirm that you understand this action.');
    }
    return isValid;
  }

  function showErrorAlert(message, errors = []) {
    successAlert.style.display = 'none';
    if (typeof window.renderApiErrorAlert === 'function') {
      window.renderApiErrorAlert(errorAlert, { message, errors }, message);
    } else {
      errorAlert.textContent = `${message}${errors.length ? `: ${errors.join(' ')}` : ''}`;
    }
    errorAlert.style.display = 'block';
  }

  function showSuccessAlert(messageText, detailText = '') {
    errorAlert.style.display = 'none';
    successAlert.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = messageText;
    successAlert.appendChild(strong);
    if (detailText) {
      successAlert.appendChild(document.createTextNode(` ${detailText}`));
    }
    successAlert.style.display = 'block';
  }

  function refreshSubmitState() {
    const emailValid = emailInput.value.trim().length > 0 && emailInput.checkValidity();
    const hasPassword = Boolean(passwordInput.value);
    const confirmed = confirmCheckbox.checked;
    const canSubmit = !redirectScheduled && token && emailValid && hasPassword && confirmed;
    submitBtn.disabled = !canSubmit;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;
    if (!token) {
      showErrorAlert(getLangString('INVALID_TOKEN'));
      return;
    }

    setFormDisabledState(true);
    toggleSpinner(true);

    let captchaToken;
    try {
      captchaToken = await window.recaptchaV3.getToken('verify_account_deletion');
    } catch (e) {
      console.error('[reCAPTCHA] Failed to obtain token for verify-account-deletion:', e);
      showErrorAlert(SECURITY_CHECK_ERROR);
      setFormDisabledState(false);
      toggleSpinner(false);
      return;
    }

    try {
      const response = await apiFetch('/users/me/verify-account-deletion', {
        method: 'POST',
        body: JSON.stringify({
          token,
          email: emailInput.value.trim(),
          password: passwordInput.value,
          confirm: true,
          captchaToken
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const message = getLangString(data.message) || getLangString('DELETION_SUCCESS');
        showSuccessAlert(message, 'Support will complete the process.');
        redirectScheduled = true;
        setFormDisabledState(true);
        setTimeout(() => { window.location.href = 'https://bookproject.fjnel.co.za?action=login'; }, 5000);
      } else {
        const rawMessage = getLangString(data.message || getLangString('DELETION_ERROR'));
        if (isCaptchaFailureMessage(rawMessage)) {
          showErrorAlert(SECURITY_CHECK_ERROR);
        } else {
          const details = data.errors ? data.errors.map(getLangString).join(' ') : '';
          showErrorAlert(rawMessage, details ? [details] : []);
        }
      }
    } catch (error) {
      console.error('[API] Network or fetch error during deletion verification:', error);
      showErrorAlert('Connection Error', ['Could not connect to the server.']);
    } finally {
      if (!redirectScheduled) setFormDisabledState(false);
      toggleSpinner(false);
    }
  }

  form.addEventListener('submit', handleSubmit);
  [emailInput, passwordInput, confirmCheckbox].forEach((input) => input.addEventListener('input', () => {
    clearErrors();
    validateForm();
    refreshSubmitState();
  }));

  loadLanguageFile();
  initializeUI();
});
