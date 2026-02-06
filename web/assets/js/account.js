'use strict';

(async function initAccountPage() {
  const pageLoadingModal = document.getElementById('pageLoadingModal');
  const apiErrorModal = document.getElementById('apiErrorModal');
  const modalManager = window.modalManager;
  const modalLock = window.modalLock;
  const recaptcha = window.recaptchaV3;

  const log = (...args) => console.log('[Account]', ...args);
  const warn = (...args) => console.warn('[Account]', ...args);
  const errorLog = (...args) => console.error('[Account]', ...args);

  const state = {
    profile: null,
    stats: null,
    sessions: [],
    apiKeys: [],
    revokeSessionTarget: null,
    revokeApiKeyTarget: null,
    activeSection: 'overview',
    profileCompleteness: null,
    recycleItems: [],
    recycleSelection: new Set(),
    recycleActionTargets: [],
    emailPreferences: null,
    themePreference: null
  };

  const elements = {
    pageAlert: document.getElementById('pageAlert'),
    navButtons: Array.from(document.querySelectorAll('[data-section]')),
    sections: Array.from(document.querySelectorAll('[data-section-content]')),
    welcomeName: document.getElementById('welcomeName'),
    statusChips: document.getElementById('statusChips'),
    profileScoreLabel: document.getElementById('profileScoreLabel'),
    profileScoreBar: document.getElementById('profileScoreBar'),
    profileScoreHint: document.getElementById('profileScoreHint'),
    profileChecklist: document.getElementById('profileChecklist'),
    profileChecklistItems: document.getElementById('profileChecklistItems'),
    profileChecklistText: document.getElementById('profileChecklistText'),
    statsTiles: document.getElementById('statsTiles'),
    profileEmail: document.getElementById('profileEmail'),
    profilePreferred: document.getElementById('profilePreferred'),
    profileFull: document.getElementById('profileFull'),
    profileLastLogin: document.getElementById('profileLastLogin'),
    profileCreated: document.getElementById('profileCreated'),
    profileUpdated: document.getElementById('profileUpdated'),
    profileRole: document.getElementById('profileRole'),
    overviewLastLogin: document.getElementById('overviewLastLogin'),
    overviewCreated: document.getElementById('overviewCreated'),
    passwordLastChanged: document.getElementById('passwordLastChanged'),
    editProfileBtn: document.getElementById('editProfileBtn'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),
    passwordInfo: document.getElementById('passwordInfo'),
    changeEmailBtn: document.getElementById('changeEmailBtn'),
    securityEmailCurrent: document.getElementById('securityEmailCurrent'),
    logoutAllBtn: document.getElementById('logoutAllBtn'),
    sessionsTable: document.getElementById('sessionsTable'),
    createApiKeyBtn: document.getElementById('createApiKeyBtn'),
    apiKeysEmpty: document.getElementById('apiKeysEmpty'),
    apiKeysTable: document.getElementById('apiKeysTable'),
    disableAccountBtn: document.getElementById('disableAccountBtn'),
    deleteAccountBtn: document.getElementById('deleteAccountBtn'),
    recycleTable: document.getElementById('recycleTable'),
    recycleSelectAll: document.getElementById('recycleSelectAll'),
    recycleEmptyState: document.getElementById('recycleEmptyState'),
    recycleError: document.getElementById('recycleError'),
    recycleRefreshBtn: document.getElementById('recycleRefreshBtn'),
    recycleRestoreBtn: document.getElementById('recycleRestoreBtn'),
    recycleDeleteBtn: document.getElementById('recycleDeleteBtn'),
    recycleFilterBooks: document.getElementById('recycleFilterBooks'),
    recycleFilterBookTypes: document.getElementById('recycleFilterBookTypes'),
    recycleFilterAuthors: document.getElementById('recycleFilterAuthors'),
    recycleFilterPublishers: document.getElementById('recycleFilterPublishers'),
    recycleFilterSeries: document.getElementById('recycleFilterSeries')
  };

  const modals = {
    editProfile: document.getElementById('editProfileModal'),
    changePassword: document.getElementById('changePasswordModal'),
    changeEmail: document.getElementById('changeEmailModal'),
    revokeSession: document.getElementById('revokeSessionModal'),
    logoutAll: document.getElementById('logoutAllModal'),
    createApiKey: document.getElementById('createApiKeyModal'),
    revokeApiKey: document.getElementById('revokeApiKeyModal'),
    disableAccount: document.getElementById('disableAccountModal'),
    deleteAccount: document.getElementById('deleteAccountModal'),
    recycleRestore: document.getElementById('recycleRestoreModal'),
    recycleDelete: document.getElementById('recycleDeleteModal')
  };

  const controls = {
    editFullName: document.getElementById('editFullName'),
    editPreferredName: document.getElementById('editPreferredName'),
    editFullNameHelp: document.getElementById('editFullNameHelp'),
    editPreferredNameHelp: document.getElementById('editPreferredNameHelp'),
    editProfileError: document.getElementById('editProfileError'),
    editProfileResetBtn: document.getElementById('editProfileResetBtn'),
    editProfileSaveBtn: document.getElementById('editProfileSaveBtn'),
    editProfileChanges: document.getElementById('editProfileChanges'),
    changePasswordChanges: document.getElementById('changePasswordChanges'),
    completeProfileBtn: document.getElementById('completeProfileBtn'),
    changePasswordError: document.getElementById('changePasswordError'),
    currentPassword: document.getElementById('currentPassword'),
    newPassword: document.getElementById('newPassword'),
    confirmNewPassword: document.getElementById('confirmNewPassword'),
    currentPasswordHelp: document.getElementById('currentPasswordHelp'),
    newPasswordHelp: document.getElementById('newPasswordHelp'),
    confirmNewPasswordHelp: document.getElementById('confirmNewPasswordHelp'),
    changePasswordSaveBtn: document.getElementById('changePasswordSaveBtn'),
    changeEmailError: document.getElementById('changeEmailError'),
    changeEmailSuccess: document.getElementById('changeEmailSuccess'),
    newEmail: document.getElementById('newEmail'),
    changeEmailHelp: document.getElementById('changeEmailHelp'),
    changeEmailChanges: document.getElementById('changeEmailChanges'),
    changeEmailSaveBtn: document.getElementById('changeEmailSaveBtn'),
    emailPrefAccountUpdates: document.getElementById('emailPrefAccountUpdates'),
    emailPrefDevFeatures: document.getElementById('emailPrefDevFeatures'),
    emailPrefAccountHelp: document.getElementById('emailPrefAccountHelp'),
    emailPrefDevHelp: document.getElementById('emailPrefDevHelp'),
    emailPrefChanges: document.getElementById('emailPrefChanges'),
    emailPrefResetBtn: document.getElementById('emailPrefResetBtn'),
    emailPrefSaveBtn: document.getElementById('emailPrefSaveBtn'),
    emailPrefError: document.getElementById('emailPrefError'),
    emailPrefSuccess: document.getElementById('emailPrefSuccess'),
    revokeSessionDetail: document.getElementById('revokeSessionDetail'),
    revokeSessionError: document.getElementById('revokeSessionError'),
    confirmRevokeSessionBtn: document.getElementById('confirmRevokeSessionBtn'),
    logoutAllError: document.getElementById('logoutAllError'),
    confirmLogoutAllBtn: document.getElementById('confirmLogoutAllBtn'),
    apiKeyName: document.getElementById('apiKeyName'),
    apiKeyExpiresAt: document.getElementById('apiKeyExpiresAt'),
    apiKeySecretWrap: document.getElementById('apiKeySecretWrap'),
    apiKeySecret: document.getElementById('apiKeySecret'),
    copyApiKeySecretBtn: document.getElementById('copyApiKeySecretBtn'),
    createApiKeyError: document.getElementById('createApiKeyError'),
    createApiKeySaveBtn: document.getElementById('createApiKeySaveBtn'),
    revokeApiKeyDetail: document.getElementById('revokeApiKeyDetail'),
    revokeApiKeyError: document.getElementById('revokeApiKeyError'),
    confirmRevokeApiKeyBtn: document.getElementById('confirmRevokeApiKeyBtn'),
    disableAccountError: document.getElementById('disableAccountError'),
    confirmDisableAccountBtn: document.getElementById('confirmDisableAccountBtn'),
    deleteAccountError: document.getElementById('deleteAccountError'),
    deleteAccountConfirmInput: document.getElementById('deleteAccountConfirmInput'),
    deleteAccountHelp: document.getElementById('deleteAccountHelp'),
    confirmDeleteAccountBtn: document.getElementById('confirmDeleteAccountBtn'),
    recycleRestoreSummary: document.getElementById('recycleRestoreSummary'),
    recycleRestoreMode: document.getElementById('recycleRestoreMode'),
    recycleRestoreModeHelp: document.getElementById('recycleRestoreModeHelp'),
    recycleRestoreError: document.getElementById('recycleRestoreError'),
    recycleRestoreChanges: document.getElementById('recycleRestoreChanges'),
    recycleRestoreConfirmBtn: document.getElementById('recycleRestoreConfirmBtn'),
    recycleDeleteSummary: document.getElementById('recycleDeleteSummary'),
    recycleDeleteConfirmInput: document.getElementById('recycleDeleteConfirmInput'),
    recycleDeleteHelp: document.getElementById('recycleDeleteHelp'),
    recycleDeleteError: document.getElementById('recycleDeleteError'),
    recycleDeleteConfirmBtn: document.getElementById('recycleDeleteConfirmBtn'),
    themePreferenceSelect: document.getElementById('themePreferenceSelect'),
    themePreferenceHelp: document.getElementById('themePreferenceHelp'),
    themePreferenceChanges: document.getElementById('themePreferenceChanges'),
    themePreferenceResetBtn: document.getElementById('themePreferenceResetBtn'),
    themePreferenceSaveBtn: document.getElementById('themePreferenceSaveBtn'),
    themePreferenceError: document.getElementById('themePreferenceError'),
    themePreferenceSuccess: document.getElementById('themePreferenceSuccess')
  };

  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      const parts = dateFormatter.formatToParts(new Date(iso));
      const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      return `${lookup.day} ${lookup.month} ${lookup.year} ${lookup.hour}:${lookup.minute}`;
    } catch (e) {
      return iso;
    }
  }

  function showPageAlert(message, type = 'success') {
    if (!elements.pageAlert) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
      <div class="fw-semibold mb-1">${message}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    elements.pageAlert.innerHTML = '';
    elements.pageAlert.appendChild(alert);
  }

  function safeText(el, text, name) {
    if (!el) {
      warn('Missing element for text update', name);
      return;
    }
    el.textContent = text;
  }

  function setHelpText(el, message, isError) {
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('text-danger', Boolean(isError));
    el.classList.toggle('text-muted', !isError);
  }

  function describeChange(fieldLabel, fromValue, toValue) {
    const from = (fromValue || '').trim();
    const to = (toValue || '').trim();
    if (from === to) return null;
    if (!from && to) return `Adding ${fieldLabel}: '${to}'.`;
    if (from && !to) return `Clearing ${fieldLabel} (was '${from}').`;
    return `Changing ${fieldLabel} from '${from}' to '${to}'.`;
  }

  function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    const spinner = btn.querySelector('.spinner-border');
    if (spinner) spinner.classList.toggle('d-none', !isLoading);
    btn.disabled = !!isLoading;
  }

  const validSections = new Set(['overview', 'profile', 'security', 'email-preferences', 'recycle', 'danger']);

  function updateHash(section, { push = false } = {}) {
    const newUrl = `${window.location.pathname}#${section}`;
    if (push) {
      window.history.pushState({}, '', newUrl);
    } else {
      window.history.replaceState({}, '', newUrl);
    }
  }

  function setActiveSection(section) {
    if (!validSections.has(section)) section = 'overview';
    state.activeSection = section;
    elements.navButtons.forEach((btn) => {
      const isActive = btn.dataset.section === section;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    elements.sections.forEach((sectionEl) => {
      const isActive = sectionEl.dataset.sectionContent === section;
      sectionEl.classList.toggle('active', isActive);
    });
    updateHash(section, { push: false });
  }

  function getSectionFromLocation() {
    const hashSection = window.location.hash?.replace('#', '').trim();
    if (hashSection && validSections.has(hashSection)) return hashSection;
    const params = new URLSearchParams(window.location.search);
    const querySection = params.get('section');
    if (querySection && validSections.has(querySection)) return querySection;
    return null;
  }

  function setModalDisabled(modalEl, disabled) {
    if (!modalEl) return;
    modalEl.querySelectorAll('input, button, textarea, select').forEach((node) => {
      if (node.dataset.lockable === 'false') return;
      if (node.classList.contains('btn-close')) return;
      node.disabled = disabled;
    });
  }

  function renderInlineError(alertEl, title, errors) {
    if (!alertEl) return;
    const safeErrors = Array.isArray(errors) ? errors.filter(Boolean) : [];
    if (typeof window.renderApiErrorAlert === 'function') {
      window.renderApiErrorAlert(alertEl, { message: title, errors: safeErrors }, title);
    } else {
      alertEl.textContent = `${title}${safeErrors.length ? `: ${safeErrors.join(' ')}` : ''}`;
    }
    alertEl.classList.remove('d-none');
  }

  async function showPageLoading() {
    if (modalManager) await modalManager.showModal(pageLoadingModal, { backdrop: 'static', keyboard: false });
  }

  async function hidePageLoading() {
    if (modalManager) await modalManager.hideModal(pageLoadingModal);
  }

  function formatRoleDisplay(role) {
    if (!role) return { label: 'User', className: 'bg-light text-secondary fw-semibold' };
    const normalized = String(role).toLowerCase();
    if (normalized === 'admin') return { label: 'Admin', className: 'bg-danger-subtle text-danger fw-semibold' };
    return { label: 'User', className: 'bg-light text-secondary fw-semibold' };
  }

  function maskEmail(email) {
    if (!email || typeof email !== 'string') return '—';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const head = user ? user.charAt(0) : '';
    const masked = `${head}${user && user.length > 1 ? '***' : ''}`;
    return `${masked}@${domain}`;
  }

  function renderStatusChips(profile) {
    const chips = [];
    if (profile.isVerified) chips.push({ label: 'Email verified', className: 'bg-success-subtle text-success fw-semibold' });
    else chips.push({ label: 'Email not verified', className: 'bg-warning-subtle text-warning fw-semibold' });
    const roleDisplay = formatRoleDisplay(profile.role);
    chips.push({ label: roleDisplay.label, className: roleDisplay.className, isAdmin: roleDisplay.label === 'Admin' });

    elements.statusChips.innerHTML = chips
      .map((chip) => {
        const actionClass = chip.isAdmin ? ' is-action' : '';
        return `<span class="stat-chip${actionClass} ${chip.className}"${chip.isAdmin ? ' role="button" tabindex="0" aria-label="Go to admin page"' : ''}>${chip.label}</span>`;
      })
      .join('');

    if (roleDisplay.label === 'Admin' && elements.statusChips) {
      const adminChip = Array.from(elements.statusChips.querySelectorAll('.stat-chip')).find((el) => el.textContent.includes('Admin'));
      if (adminChip && !adminChip.dataset.boundAdminNav) {
        const navigateToAdmin = () => {
          window.location.href = 'admin';
        };
        adminChip.dataset.boundAdminNav = 'true';
        adminChip.addEventListener('click', navigateToAdmin);
        adminChip.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigateToAdmin();
          }
        });
      }
    }
  }

  function buildProfileCompleteness(profile) {
    const items = [
      { key: 'email', label: 'Email added', complete: !!profile.email, optional: false, hint: 'Add a valid email address.' },
      { key: 'fullName', label: 'Full name', complete: !!profile.fullName, optional: false, hint: 'Add your full name.' },
      { key: 'preferredName', label: 'Preferred name', complete: !!profile.preferredName, optional: true, hint: 'Add a preferred name for greetings.' },
      { key: 'password', label: 'Password set', complete: !!profile.passwordUpdated, optional: false, hint: 'Set a password to secure your account.' },
      { key: 'verified', label: 'Email verified', complete: !!profile.isVerified, optional: false, hint: 'Verify your email address from your inbox.' }
    ];

    const required = items.filter((item) => !item.optional);
    const completedRequired = required.filter((item) => item.complete).length;
    const optionalCompleted = items.filter((item) => item.optional && item.complete).length;
    const baseScore = required.length ? Math.round((completedRequired / required.length) * 100) : 0;
    const bonus = optionalCompleted > 0 ? Math.min(10, optionalCompleted * 5) : 0;
    const score = Math.min(100, baseScore + bonus);

    return {
      items,
      score,
      completedRequired,
      requiredTotal: required.length,
      optionalCompleted,
      missing: items.filter((item) => !item.complete)
    };
  }

  function updateProfileScore(completeness) {
    const score = completeness?.score ?? 0;
    safeText(elements.profileScoreLabel, Number.isFinite(score) ? `${score}%` : '0%', 'profileScoreLabel');
    if (elements.profileScoreBar) elements.profileScoreBar.style.width = Number.isFinite(score) ? `${score}%` : '0%';
    if (elements.profileScoreHint) {
      if (score >= 100) {
        elements.profileScoreHint.textContent = 'Profile is complete.';
      } else {
        elements.profileScoreHint.textContent = `Completed ${completeness?.completedRequired || 0} of ${completeness?.requiredTotal || 0} required items.`;
      }
    }
  }

  function renderProfileChecklist(completeness) {
    if (!elements.profileChecklist || !completeness) return;
    if (completeness.missing.length === 0) {
      elements.profileChecklist.remove();
      elements.profileChecklist = null;
      elements.profileChecklistItems = null;
      elements.profileChecklistText = null;
      return;
    }
    elements.profileChecklist.classList.remove('d-none');

    const listItems = completeness.items.map((item) => {
      const icon = item.complete
        ? '<i class="bi bi-check-circle text-success"></i>'
        : '<i class="bi bi-dash-circle text-warning"></i>';
      const helper = item.complete ? 'Completed' : item.hint;
      const optionalLabel = item.optional ? ' (optional)' : '';
      return `<li class="d-flex align-items-start gap-2 mb-1"><span class="mt-1">${icon}</span><div><div class="fw-semibold">${item.label}${optionalLabel}</div><div class="text-muted small">${helper}</div></div></li>`;
    });

    elements.profileChecklistItems.innerHTML = listItems.join('');
    if (elements.profileChecklistText) {
      const missingRequired = completeness.requiredTotal - completeness.completedRequired;
      if (missingRequired > 0) {
        elements.profileChecklistText.textContent = `Complete ${missingRequired} required item${missingRequired > 1 ? 's' : ''} to reach 100%.`;
      } else if (completeness.missing.length > 0) {
        elements.profileChecklistText.textContent = 'Optional items can help personalise your experience.';
      } else {
        elements.profileChecklistText.textContent = 'All checklist items completed.';
      }
    }
  }

  function validateFullNameInput(value) {
    const errors = [];
    const name = (value || '').trim();
    if (!name) {
      errors.push('Full Name must be provided.');
    } else {
      if (name.length < 2 || name.length > 255) errors.push('Full Name must be between 2 and 255 characters.');
      if (!/^[A-Za-z\s\-.'’]+$/.test(name)) errors.push('Only letters, spaces, hyphens, full stops, and apostrophes are allowed.');
    }
    return errors;
  }

  function validatePreferredNameInput(value) {
    const errors = [];
    if (value === undefined || value === null || value === '') return errors;
    const name = (value || '').trim();
    if (name.length < 2 || name.length > 100) errors.push('Preferred Name must be between 2 and 100 characters.');
    if (!/^[A-Za-z]+$/.test(name)) errors.push('Preferred Name can only contain alphabetic characters.');
    return errors;
  }

  function applyProfileFieldValidation({ input, help, errors, neutralText, required }) {
    if (!input || !help) return;
    const value = (input.value || '').trim();
    if (errors.length > 0) {
      setHelpText(help, errors[0], true);
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      return;
    }

    input.classList.remove('is-invalid');
    input.classList.remove('is-valid');

    if (!value && !required) {
      setHelpText(help, neutralText, false);
      return;
    }

    if (value) {
      setHelpText(help, '', false);
      return;
    }

    setHelpText(help, neutralText, false);
  }

  function updateProfileValidationState() {
    if (!controls.editFullName || !controls.editPreferredName) {
      warn('Profile inputs missing');
      return { fullName: '', preferredName: '', hasErrors: true };
    }
    if (controls.editProfileError) controls.editProfileError.classList.add('d-none');
    const fullName = controls.editFullName.value;
    const preferredName = controls.editPreferredName.value;
    if (!state.profile) {
      if (controls.editProfileSaveBtn) controls.editProfileSaveBtn.disabled = true;
      applyProfileFieldValidation({
        input: controls.editFullName,
        help: controls.editFullNameHelp,
        errors: ['Full Name must be provided.'],
        neutralText: 'Enter your full name (2-255 characters).',
        required: true
      });
      applyProfileFieldValidation({
        input: controls.editPreferredName,
        help: controls.editPreferredNameHelp,
        errors: [],
        neutralText: 'Optional; 2-100 letters, no spaces.',
        required: false
      });
      return { fullName, preferredName, hasErrors: true };
    }
    const fullNameErrors = validateFullNameInput(fullName);
    const preferredErrors = validatePreferredNameInput(preferredName);
    applyProfileFieldValidation({
      input: controls.editFullName,
      help: controls.editFullNameHelp,
      errors: fullNameErrors,
      neutralText: 'Enter your full name (2-255 characters).',
      required: true
    });
    applyProfileFieldValidation({
      input: controls.editPreferredName,
      help: controls.editPreferredNameHelp,
      errors: preferredErrors,
      neutralText: 'Optional; 2-100 letters, no spaces.',
      required: false
    });

    const changes = [];
    const fullNameChange = describeChange('full name', state.profile?.fullName || '', fullName);
    const preferredNameChange = describeChange('preferred name', state.profile?.preferredName || '', preferredName);
    if (fullNameChange) changes.push(fullNameChange);
    if (preferredNameChange) changes.push(preferredNameChange);
    safeText(controls.editProfileChanges, changes.length ? changes.join(' ') : 'No changes yet.', 'editProfileChanges');

    const hasErrors = fullNameErrors.length > 0 || preferredErrors.length > 0;
    const hasChanges = changes.length > 0;
    if (controls.editProfileSaveBtn) controls.editProfileSaveBtn.disabled = hasErrors || !hasChanges;
    return { fullName, preferredName, hasErrors };
  }

  function renderProfile(profile) {
    elements.welcomeName.textContent = profile.preferredName || profile.fullName || 'Your account';
    renderStatusChips(profile);
    renderThemePreference(profile.themePreference || 'device');
    if (window.themeManager) {
      window.themeManager.setPreference(profile.themePreference || 'device', { persist: true });
    }
    state.profileCompleteness = buildProfileCompleteness(profile);
    updateProfileScore(state.profileCompleteness);

    elements.profileEmail.textContent = profile.email || '—';
    elements.profilePreferred.textContent = profile.preferredName || '—';
    elements.profileFull.textContent = profile.fullName || '—';
    elements.profileLastLogin.textContent = formatDate(profile.lastLogin);
    elements.profileCreated.textContent = formatDate(profile.createdAt);
    elements.profileUpdated.textContent = formatDate(profile.updatedAt);
    const roleDisplay = formatRoleDisplay(profile.role);
    if (elements.profileRole) {
      elements.profileRole.textContent = roleDisplay.label;
      elements.profileRole.className = 'detail-value';
      elements.profileRole.classList.add(roleDisplay.label === 'Admin' ? 'text-danger' : 'text-body');
    }

    elements.overviewLastLogin.textContent = formatDate(profile.lastLogin);
    elements.overviewCreated.textContent = formatDate(profile.createdAt);

    controls.editFullName.value = profile.fullName || '';
    controls.editPreferredName.value = profile.preferredName || '';

    renderProfileChecklist(state.profileCompleteness);
  }

  function renderStats(stats) {
    if (!stats) return;
    const tiles = [
      { label: 'Books', value: stats.books, href: 'books' },
      { label: 'Series', value: stats.series, href: 'series' },
      { label: 'Authors', value: stats.authors, href: 'authors' },
      { label: 'Publishers', value: stats.publishers, href: 'publishers' },
      { label: 'Storage', value: stats.storageLocations, href: 'storage-locations' },
      { label: 'Tags', value: stats.tags, href: 'tags' },
      { label: 'API keys', value: stats.apiKeys, href: '#danger' }
    ];
    elements.statsTiles.innerHTML = tiles
      .map((tile) => {
        const clickable = !!tile.href;
        const attrs = clickable ? `data-href="${tile.href}" role="button" tabindex="0"` : '';
        const zeroHint = !tile.value ? '<div class="text-muted small mb-0">No items yet</div>' : '';
        return `<div class="col"><div class="stat-card ${clickable ? 'is-link' : ''}" ${attrs}><div class="stat-value">${tile.value ?? 0}</div><div class="stat-label">${tile.label}</div>${zeroHint}</div></div>`;
      })
      .join('');
  }

  function describeUserAgent(session) {
    const raw = (session?.rawUserAgent || session?.userAgent || '').toLowerCase();
    const os = /windows nt/.test(raw)
      ? 'Windows'
      : /mac os x/.test(raw)
        ? 'macOS'
        : /android/.test(raw)
          ? 'Android'
          : /(iphone|ipad|ipod)/.test(raw)
            ? 'iOS'
            : /linux/.test(raw)
              ? 'Linux'
              : 'Unknown';

    const browser = /edg\//.test(raw)
      ? 'Edge'
      : /chrome/.test(raw) && !/edg|opr|crios/.test(raw)
        ? 'Chrome'
        : /safari/.test(raw) && !/chrome|crios|opr|edg/.test(raw)
          ? 'Safari'
          : /firefox/.test(raw)
            ? 'Firefox'
            : 'Unknown';

    const deviceType = /(mobile|iphone|android)/.test(raw)
      ? 'Mobile'
      : /ipad|tablet/.test(raw)
        ? 'Tablet'
        : 'Desktop';

    const labelParts = [];
    if (os !== 'Unknown') labelParts.push(os);
    if (browser !== 'Unknown') labelParts.push(browser);
    const label = labelParts.length ? `${labelParts[0]}${labelParts[1] ? ` (${labelParts[1]})` : ''}` : 'Unknown device';

    let iconKey = 'desktop';
    if (os === 'Android') iconKey = 'android';
    else if (os === 'iOS') iconKey = 'apple';
    else if (os === 'Windows') iconKey = 'windows';
    else if (os === 'macOS') iconKey = 'mac';
    else if (os === 'Linux') iconKey = 'linux';
    if (deviceType === 'Mobile' && iconKey === 'desktop') iconKey = 'phone';

    return { label, iconKey, deviceType, os, browser };
  }

  function renderSessions(sessions) {
    const tbody = elements.sessionsTable?.querySelector('tbody');
    if (!tbody) {
      warn('Sessions table missing');
      return;
    }
    if (!sessions || sessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">No active sessions found.</td></tr>';
      return;
    }
    const icons = {
      android: '<i class="bi bi-android device-icon"></i>',
      apple: '<i class="bi bi-apple device-icon"></i>',
    
      windows: '<i class="bi bi-windows device-icon"></i>',
      mac: '<i class="bi bi-command device-icon"></i>',
      linux: '<i class="bi bi-linux device-icon"></i>',
      phone: '<i class="bi bi-phone device-icon"></i>',
      desktop: '<i class="bi bi-pc-display-horizontal device-icon"></i>',
      unknown: '<i class="bi bi-question-circle device-icon"></i>'
    };

    tbody.innerHTML = sessions.map((s) => {
      const currentBadge = s.current ? '<span class="badge bg-primary ms-1">Current</span>' : '';
      const parsed = describeUserAgent(s);
      const deviceLabel = parsed.label || s.device || s.browser || 'Unknown device';
      const expiresSoon = typeof s.expiresInSeconds === 'number' && s.expiresInSeconds <= 0;
      const status = expiresSoon ? '<span class="badge bg-secondary ms-1">Expired</span>' : '';
      const location = s.locationHint || (s.ipAddress ? `IP ${s.ipAddress}` : 'Unknown');
      const icon = icons[parsed.iconKey] || icons.desktop;
      return `<tr data-fp="${s.fingerprint}">
        <td>${icon}<span class="fw-semibold">${deviceLabel}</span>${currentBadge}${status}</td>
        <td>${formatDate(s.issuedAt)}</td>
        <td>${location}</td>
        <td>${formatDate(s.expiresAt)}</td>
        <td class="text-end">
          <button class="btn btn-outline-danger btn-sm js-revoke-session d-inline-flex align-items-center gap-2" data-fp="${s.fingerprint}">
            <i class="bi bi-trash-fill"></i>
            Log out
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  function renderApiKeys(keys) {
    const tbody = elements.apiKeysTable.querySelector('tbody');
    if (!keys || keys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">No API keys yet.</td></tr>';
      elements.apiKeysTable.classList.add('d-none');
      if (elements.apiKeysEmpty) elements.apiKeysEmpty.classList.remove('d-none');
      return;
    }
    elements.apiKeysTable.classList.remove('d-none');
    if (elements.apiKeysEmpty) elements.apiKeysEmpty.classList.add('d-none');
    tbody.innerHTML = keys.map((k) => {
      const now = Date.now();
      const isRevoked = !!k.revokedAt;
      const isExpired = k.expiresAt ? new Date(k.expiresAt).getTime() < now : false;
      const statusLabel = isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active';
      const statusClass = isRevoked
        ? 'badge bg-danger-subtle text-danger'
        : isExpired
          ? 'badge bg-secondary'
          : 'badge bg-success-subtle text-success';
      return `<tr data-id="${k.id}">
        <td>${k.name || '—'}</td>
        <td>${k.prefix || '—'}</td>
        <td>${formatDate(k.createdAt)}</td>
        <td>${formatDate(k.expiresAt)}</td>
        <td>${formatDate(k.lastUsedAt)}</td>
        <td><span class="${statusClass}">${statusLabel}</span></td>
        <td class="text-end">
          <button class="btn btn-outline-danger btn-sm js-revoke-api-key" data-id="${k.id}" data-name="${k.name || ''}" data-prefix="${k.prefix || ''}">Revoke</button>
        </td>
      </tr>`;
    }).join('');
  }

  async function fetchJson(path, options) {
    const res = await apiFetch(path, options);
    if (res.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(res);
      await window.rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
      throw new Error('Rate limited');
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const payloadMessage = typeof data.message === 'string' ? data.message : '';
      const message = payloadMessage || 'Request failed';
      const errors = Array.isArray(data.errors) ? data.errors : [];
      const hasPayload = Boolean(payloadMessage) || errors.length > 0;
      if (res.status >= 500 && modalManager && !hasPayload) {
        await modalManager.showModal(apiErrorModal);
      }
      const combined = errors.length ? `${message}: ${errors.join(', ')}` : message;
      throw new Error(combined);
    }
    const data = await res.json();
    return data.data || data;
  }

  async function loadProfile() {
    log('Loading profile...');
    const data = await fetchJson('/users/me', { method: 'GET' });
    state.profile = data;
    renderProfile(data);
    try {
      const raw = localStorage.getItem('userProfile');
      if (raw) {
        const profile = JSON.parse(raw);
        profile.themePreference = data.themePreference || 'device';
        localStorage.setItem('userProfile', JSON.stringify(profile));
      }
    } catch (error) {
      warn('Unable to sync theme preference to profile storage.', error);
    }
    const passwordChanged = data.passwordUpdated ? formatDate(data.passwordUpdated) : null;
    safeText(elements.passwordInfo, data.passwordUpdated ? 'Use a strong password. Changing it will sign you out on other devices.' : 'No password set yet. Add one to secure your account.', 'passwordInfo');
    if (elements.passwordLastChanged) {
      elements.passwordLastChanged.textContent = `Last changed: ${passwordChanged || 'Unknown'}`;
    }
    if (elements.securityEmailCurrent) {
      elements.securityEmailCurrent.textContent = `Current email: ${maskEmail(data.email)}`;
    }
    log('Profile loaded.');
  }

  function clearEmailPrefAlerts() {
    if (controls.emailPrefError) controls.emailPrefError.classList.add('d-none');
    if (controls.emailPrefSuccess) controls.emailPrefSuccess.classList.add('d-none');
  }

  function setEmailPrefAlert(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('d-none');
    element.classList.toggle('alert-danger', type === 'danger');
    element.classList.toggle('alert-success', type === 'success');
  }

  function collectEmailPrefValues() {
    return {
      accountUpdates: Boolean(controls.emailPrefAccountUpdates?.checked),
      devFeatures: Boolean(controls.emailPrefDevFeatures?.checked)
    };
  }

  function updateEmailPrefChanges() {
    if (!controls.emailPrefChanges || !controls.emailPrefSaveBtn) return;
    const current = collectEmailPrefValues();
    const baseline = state.emailPreferences || current;
    const changes = [];

    if (current.accountUpdates !== baseline.accountUpdates) {
      changes.push(`Account updates ${current.accountUpdates ? 'enabled' : 'disabled'}`);
    }
    if (current.devFeatures !== baseline.devFeatures) {
      changes.push(`Development updates ${current.devFeatures ? 'enabled' : 'disabled'}`);
    }

    controls.emailPrefChanges.textContent = changes.length ? `Changes: ${changes.join(', ')}.` : 'No changes yet.';
    controls.emailPrefSaveBtn.disabled = changes.length === 0;
  }

  function renderEmailPreferences(preferences) {
    if (!preferences) return;
    state.emailPreferences = {
      accountUpdates: Boolean(preferences.accountUpdates),
      devFeatures: Boolean(preferences.devFeatures)
    };
    if (controls.emailPrefAccountUpdates) controls.emailPrefAccountUpdates.checked = state.emailPreferences.accountUpdates;
    if (controls.emailPrefDevFeatures) controls.emailPrefDevFeatures.checked = state.emailPreferences.devFeatures;
    updateEmailPrefChanges();
  }

  async function loadEmailPreferences() {
    try {
      const data = await fetchJson('/users/me/email-preferences', { method: 'GET' });
      renderEmailPreferences(data.preferences || data);
    } catch (error) {
      warn('Failed to load email preferences', error);
      setEmailPrefAlert(controls.emailPrefError, 'Unable to load email preferences.', 'danger');
    }
  }

  async function saveEmailPreferences() {
    clearEmailPrefAlerts();
    const current = collectEmailPrefValues();
    try {
      const payload = {
        accountUpdates: current.accountUpdates,
        devFeatures: current.devFeatures
      };
      const data = await fetchJson('/users/me/email-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      renderEmailPreferences(data.preferences || data);
      setEmailPrefAlert(controls.emailPrefSuccess, 'Email preferences updated.', 'success');
    } catch (error) {
      setEmailPrefAlert(controls.emailPrefError, error.message || 'Unable to update email preferences.', 'danger');
    }
  }

  function resetEmailPreferences() {
    if (!state.emailPreferences) return;
    if (controls.emailPrefAccountUpdates) controls.emailPrefAccountUpdates.checked = state.emailPreferences.accountUpdates;
    if (controls.emailPrefDevFeatures) controls.emailPrefDevFeatures.checked = state.emailPreferences.devFeatures;
    updateEmailPrefChanges();
  }

  const themeLabels = {
    device: 'Use device setting',
    light: 'Light',
    dark: 'Dark'
  };

  function clearThemePrefAlerts() {
    if (controls.themePreferenceError) controls.themePreferenceError.classList.add('d-none');
    if (controls.themePreferenceSuccess) controls.themePreferenceSuccess.classList.add('d-none');
  }

  function setThemePrefAlert(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('d-none');
    element.classList.toggle('alert-danger', type === 'danger');
    element.classList.toggle('alert-success', type === 'success');
  }

  function normalizeThemePreference(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || normalized === 'system') return 'device';
    if (normalized === 'light' || normalized === 'dark' || normalized === 'device') return normalized;
    return 'device';
  }

  function getThemeLabel(value) {
    return themeLabels[value] || themeLabels.device;
  }

  function collectThemePreference() {
    return normalizeThemePreference(controls.themePreferenceSelect?.value || 'device');
  }

  function updateThemePreferenceChanges() {
    if (!controls.themePreferenceChanges || !controls.themePreferenceSaveBtn) return;
    const current = collectThemePreference();
    const baseline = normalizeThemePreference(state.themePreference || current);
    const changes = [];
    if (current !== baseline) {
      changes.push(`Changing theme from '${getThemeLabel(baseline)}' to '${getThemeLabel(current)}'.`);
    }
    controls.themePreferenceChanges.textContent = changes.length ? changes.join(' ') : 'No changes yet.';
    controls.themePreferenceSaveBtn.disabled = changes.length === 0;
  }

  function renderThemePreference(value) {
    const normalized = normalizeThemePreference(value);
    state.themePreference = normalized;
    if (controls.themePreferenceSelect) controls.themePreferenceSelect.value = normalized;
    updateThemePreferenceChanges();
  }

  async function saveThemePreference() {
    clearThemePrefAlerts();
    const current = collectThemePreference();
    try {
      const data = await fetchJson('/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themePreference: current })
      });
      renderThemePreference(data.themePreference || current);
      if (window.themeManager) {
        window.themeManager.setPreference(current, { persist: true });
      }
      try {
        const raw = localStorage.getItem('userProfile');
        if (raw) {
          const profile = JSON.parse(raw);
          profile.themePreference = current;
          localStorage.setItem('userProfile', JSON.stringify(profile));
        }
      } catch (error) {
        warn('Unable to persist theme preference to profile storage.', error);
      }
      setThemePrefAlert(controls.themePreferenceSuccess, 'Theme updated.', 'success');
    } catch (error) {
      setThemePrefAlert(controls.themePreferenceError, error.message || 'Unable to update theme.', 'danger');
    }
  }

  function resetThemePreference() {
    if (!state.themePreference) return;
    if (controls.themePreferenceSelect) controls.themePreferenceSelect.value = normalizeThemePreference(state.themePreference);
    updateThemePreferenceChanges();
  }

  async function loadStats() {
    log('Loading stats...');
    const data = await fetchJson('/users/me/stats', { method: 'GET' });
    state.stats = data?.stats || data?.data || null;
    renderStats(state.stats);
    log('Stats loaded.');
  }

  async function loadSessions() {
    log('Loading sessions...');
    const data = await fetchJson('/users/me/sessions', { method: 'GET' });
    state.sessions = data.sessions || [];
    renderSessions(state.sessions);
    log('Sessions loaded:', state.sessions.length);
  }

  async function loadApiKeys() {
    log('Loading API keys...');
    const data = await fetchJson('/users/me/api-keys', { method: 'GET' });
    state.apiKeys = data.keys || [];
    renderApiKeys(state.apiKeys);
    log('API keys loaded:', state.apiKeys.length);
  }

  const recycleTypeConfig = {
    book: {
      label: 'Book',
      trashEndpoint: '/book/trash',
      restoreEndpoint: '/book/restore',
      deleteEndpoint: '/book/delete-permanent',
      detailUrl: 'book-details'
    },
    bookType: {
      label: 'Book type',
      trashEndpoint: '/booktype/trash',
      restoreEndpoint: '/booktype/restore',
      deleteEndpoint: '/booktype/delete-permanent',
      detailUrl: 'book-type-details'
    },
    author: {
      label: 'Author',
      trashEndpoint: '/author/trash',
      restoreEndpoint: '/author/restore',
      deleteEndpoint: '/author/delete-permanent',
      detailUrl: 'author-details'
    },
    publisher: {
      label: 'Publisher',
      trashEndpoint: '/publisher/trash',
      restoreEndpoint: '/publisher/restore',
      deleteEndpoint: '/publisher/delete-permanent',
      detailUrl: 'publisher-details'
    },
    series: {
      label: 'Series',
      trashEndpoint: '/bookseries/trash',
      restoreEndpoint: '/bookseries/restore',
      deleteEndpoint: '/bookseries/delete-permanent',
      detailUrl: 'series-details'
    }
  };

  function recycleKey(item) {
    return `${item.type}:${item.id}`;
  }

  function getRecycleFilters() {
    return new Set([
      elements.recycleFilterBooks?.checked ? 'book' : null,
      elements.recycleFilterBookTypes?.checked ? 'bookType' : null,
      elements.recycleFilterAuthors?.checked ? 'author' : null,
      elements.recycleFilterPublishers?.checked ? 'publisher' : null,
      elements.recycleFilterSeries?.checked ? 'series' : null
    ].filter(Boolean));
  }

  function pruneRecycleSelection(items) {
    const validKeys = new Set(items.map((item) => recycleKey(item)));
    Array.from(state.recycleSelection).forEach((key) => {
      if (!validKeys.has(key)) state.recycleSelection.delete(key);
    });
  }

  function updateRecycleBulkActions(filteredItems) {
    const hasSelection = state.recycleSelection.size > 0;
    if (elements.recycleRestoreBtn) elements.recycleRestoreBtn.disabled = !hasSelection;
    if (elements.recycleDeleteBtn) elements.recycleDeleteBtn.disabled = !hasSelection;

    if (elements.recycleSelectAll) {
      const visibleKeys = filteredItems.map((item) => recycleKey(item));
      const selectedVisible = visibleKeys.filter((key) => state.recycleSelection.has(key));
      elements.recycleSelectAll.checked = visibleKeys.length > 0 && selectedVisible.length === visibleKeys.length;
      elements.recycleSelectAll.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleKeys.length;
    }
  }

  function renderRecycleBin() {
    if (!elements.recycleTable) return;
    const tbody = elements.recycleTable.querySelector('tbody');
    if (!tbody) return;

    const filters = getRecycleFilters();
    const filteredItems = state.recycleItems.filter((item) => filters.has(item.type));
    pruneRecycleSelection(state.recycleItems);

    tbody.innerHTML = '';
    if (filteredItems.length === 0) {
      elements.recycleTable.classList.add('d-none');
      if (elements.recycleEmptyState) elements.recycleEmptyState.classList.remove('d-none');
      updateRecycleBulkActions(filteredItems);
      return;
    }

    elements.recycleTable.classList.remove('d-none');
    if (elements.recycleEmptyState) elements.recycleEmptyState.classList.add('d-none');

    filteredItems.forEach((item) => {
      const config = recycleTypeConfig[item.type];
      const row = document.createElement('tr');
      row.className = 'recycle-row';
      row.dataset.recycleType = item.type;
      row.dataset.recycleId = String(item.id);

      const selectCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'form-check-input';
      checkbox.checked = state.recycleSelection.has(recycleKey(item));
      checkbox.setAttribute('aria-label', `Select ${config.label}`);
      checkbox.addEventListener('click', (event) => event.stopPropagation());
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          state.recycleSelection.add(recycleKey(item));
        } else {
          state.recycleSelection.delete(recycleKey(item));
        }
        updateRecycleBulkActions(filteredItems);
      });
      selectCell.appendChild(checkbox);

      const typeCell = document.createElement('td');
      typeCell.textContent = config.label;

      const nameCell = document.createElement('td');
      nameCell.textContent = item.name || 'Untitled';

      const deletedCell = document.createElement('td');
      deletedCell.textContent = formatDate(item.deletedAt);

      const actionsCell = document.createElement('td');
      actionsCell.className = 'text-end';
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'btn-group btn-group-sm recycle-row-actions';

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'btn btn-outline-success';
      restoreBtn.setAttribute('aria-label', 'Restore');
      restoreBtn.setAttribute('title', 'Restore');
      restoreBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>';
      restoreBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        openRecycleRestoreModal([item]);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-outline-danger';
      deleteBtn.setAttribute('aria-label', 'Delete permanently');
      deleteBtn.setAttribute('title', 'Delete permanently');
      deleteBtn.innerHTML = '<i class="bi bi-trash-fill" aria-hidden="true"></i>';
      deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        openRecycleDeleteModal([item]);
      });

      actionsWrap.appendChild(restoreBtn);
      actionsWrap.appendChild(deleteBtn);
      actionsCell.appendChild(actionsWrap);

      row.appendChild(selectCell);
      row.appendChild(typeCell);
      row.appendChild(nameCell);
      row.appendChild(deletedCell);
      row.appendChild(actionsCell);

      row.addEventListener('click', () => {
        window.location.href = `${config.detailUrl}?id=${item.id}`;
      });

      tbody.appendChild(row);
    });

    updateRecycleBulkActions(filteredItems);
  }

  async function loadRecycleBin() {
    if (!elements.recycleTable) return;
    if (elements.recycleError) elements.recycleError.classList.add('d-none');
    try {
      const [books, bookTypes, authors, publishers, series] = await Promise.all([
        fetchJson(recycleTypeConfig.book.trashEndpoint, { method: 'GET' }),
        fetchJson(recycleTypeConfig.bookType.trashEndpoint, { method: 'GET' }),
        fetchJson(recycleTypeConfig.author.trashEndpoint, { method: 'GET' }),
        fetchJson(recycleTypeConfig.publisher.trashEndpoint, { method: 'GET' }),
        fetchJson(recycleTypeConfig.series.trashEndpoint, { method: 'GET' })
      ]);

      const bookItems = (books.books || []).map((book) => ({
        type: 'book',
        id: book.id,
        name: book.subtitle ? `${book.title}: ${book.subtitle}` : book.title,
        deletedAt: book.deletedAt
      }));
      const bookTypeItems = (bookTypes.bookTypes || []).map((bookType) => ({
        type: 'bookType',
        id: bookType.id,
        name: bookType.name,
        deletedAt: bookType.deletedAt
      }));
      const authorItems = (authors.authors || []).map((author) => ({
        type: 'author',
        id: author.id,
        name: author.displayName || `${author.firstNames || ''} ${author.lastName || ''}`.trim(),
        deletedAt: author.deletedAt
      }));
      const publisherItems = (publishers.publishers || []).map((publisher) => ({
        type: 'publisher',
        id: publisher.id,
        name: publisher.name,
        deletedAt: publisher.deletedAt
      }));
      const seriesItems = (series.series || []).map((entry) => ({
        type: 'series',
        id: entry.id,
        name: entry.name,
        deletedAt: entry.deletedAt
      }));

      state.recycleItems = [...bookItems, ...bookTypeItems, ...authorItems, ...publisherItems, ...seriesItems]
        .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
      renderRecycleBin();
    } catch (error) {
      if (elements.recycleError) {
        renderInlineError(elements.recycleError, 'Unable to load recycle bin', [error.message]);
      }
    }
  }

  function getSelectedRecycleItems() {
    return state.recycleItems.filter((item) => state.recycleSelection.has(recycleKey(item)));
  }

  function describeRecycleSelection(items) {
    const counts = items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
    const parts = Object.entries(counts).map(([type, count]) => `${count} ${recycleTypeConfig[type].label.toLowerCase()}${count === 1 ? '' : 's'}`);
    return parts.length ? parts.join(', ') : 'No items selected.';
  }

  function updateRecycleRestoreChanges() {
    if (!controls.recycleRestoreChanges || !controls.recycleRestoreMode) return;
    const mode = controls.recycleRestoreMode.value || 'decline';
    const label = mode === 'merge' ? 'Merge' : mode === 'override' ? 'Override' : 'Decline';
    controls.recycleRestoreChanges.textContent = `Restoring ${state.recycleActionTargets.length} item${state.recycleActionTargets.length === 1 ? '' : 's'} using ${label} mode.`;
    if (controls.recycleRestoreModeHelp) {
      const helpText = mode === 'merge'
        ? 'Merge combines details into existing items when possible.'
        : mode === 'override'
          ? 'Override replaces existing items by restoring these.'
          : 'Decline leaves items deleted if a conflict is found.';
      controls.recycleRestoreModeHelp.textContent = helpText;
      controls.recycleRestoreModeHelp.classList.remove('text-danger');
      controls.recycleRestoreModeHelp.classList.add('text-muted');
    }
  }

  function openRecycleRestoreModal(items) {
    state.recycleActionTargets = items;
    if (controls.recycleRestoreSummary) {
      controls.recycleRestoreSummary.textContent = `Restore ${describeRecycleSelection(items)}.`;
    }
    if (controls.recycleRestoreMode) controls.recycleRestoreMode.value = 'decline';
    if (controls.recycleRestoreError) controls.recycleRestoreError.classList.add('d-none');
    updateRecycleRestoreChanges();
    if (modalManager) modalManager.showModal(modals.recycleRestore, { backdrop: 'static', keyboard: false });
  }

  function updateRecycleDeleteState() {
    if (!controls.recycleDeleteConfirmInput || !controls.recycleDeleteConfirmBtn) return;
    const value = controls.recycleDeleteConfirmInput.value.trim().toLowerCase();
    const isMatch = value === 'delete';
    controls.recycleDeleteConfirmBtn.disabled = !isMatch;
    if (controls.recycleDeleteHelp) {
      setHelpText(controls.recycleDeleteHelp, isMatch ? 'Confirmed.' : 'Type DELETE to enable permanent deletion.', !isMatch);
    }
  }

  function openRecycleDeleteModal(items) {
    state.recycleActionTargets = items;
    if (controls.recycleDeleteSummary) {
      controls.recycleDeleteSummary.textContent = `Delete ${describeRecycleSelection(items)} permanently.`;
    }
    if (controls.recycleDeleteConfirmInput) controls.recycleDeleteConfirmInput.value = '';
    if (controls.recycleDeleteError) controls.recycleDeleteError.classList.add('d-none');
    updateRecycleDeleteState();
    if (modalManager) modalManager.showModal(modals.recycleDelete, { backdrop: 'static', keyboard: false });
  }

  async function submitRecycleRestore() {
    const targets = state.recycleActionTargets;
    if (!targets.length) return;
    const mode = controls.recycleRestoreMode?.value || 'decline';
    const grouped = targets.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item.id);
      return acc;
    }, {});

    const perform = async () => {
      setButtonLoading(controls.recycleRestoreConfirmBtn, true);
      setModalDisabled(modals.recycleRestore, true);
      const failures = [];
      for (const [type, ids] of Object.entries(grouped)) {
        const endpoint = recycleTypeConfig[type].restoreEndpoint;
        try {
          const res = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ ids, mode }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            failures.push(data.message || `Unable to restore ${type}.`);
          }
        } catch (error) {
          failures.push(error.message || `Unable to restore ${type}.`);
        }
      }
      if (failures.length) {
        renderInlineError(controls.recycleRestoreError, 'Unable to restore items', failures);
        setButtonLoading(controls.recycleRestoreConfirmBtn, false);
        setModalDisabled(modals.recycleRestore, false);
        return;
      }
      await loadRecycleBin();
      state.recycleSelection.clear();
      showPageAlert('Items restored successfully.', 'success');
      if (modalManager) await modalManager.hideModal(modals.recycleRestore);
      setButtonLoading(controls.recycleRestoreConfirmBtn, false);
      setModalDisabled(modals.recycleRestore, false);
    };

    if (modalLock?.withLock) {
      await modalLock.withLock({ modal: modals.recycleRestore, action: 'recycle-restore' }, perform).catch(() => {});
    } else {
      await perform();
    }
  }

  async function submitRecycleDelete() {
    const targets = state.recycleActionTargets;
    if (!targets.length) return;
    const confirmValue = controls.recycleDeleteConfirmInput?.value.trim().toLowerCase();
    if (confirmValue !== 'delete') {
      updateRecycleDeleteState();
      return;
    }

    const grouped = targets.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item.id);
      return acc;
    }, {});

    const perform = async () => {
      setButtonLoading(controls.recycleDeleteConfirmBtn, true);
      setModalDisabled(modals.recycleDelete, true);
      const failures = [];
      for (const [type, ids] of Object.entries(grouped)) {
        const endpoint = recycleTypeConfig[type].deleteEndpoint;
        try {
          const res = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ ids }) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            failures.push(data.message || `Unable to delete ${type}.`);
          }
        } catch (error) {
          failures.push(error.message || `Unable to delete ${type}.`);
        }
      }
      if (failures.length) {
        renderInlineError(controls.recycleDeleteError, 'Unable to delete items', failures);
        setButtonLoading(controls.recycleDeleteConfirmBtn, false);
        setModalDisabled(modals.recycleDelete, false);
        return;
      }
      await loadRecycleBin();
      state.recycleSelection.clear();
      showPageAlert('Items deleted permanently.', 'success');
      if (modalManager) await modalManager.hideModal(modals.recycleDelete);
      setButtonLoading(controls.recycleDeleteConfirmBtn, false);
      setModalDisabled(modals.recycleDelete, false);
    };

    if (modalLock?.withLock) {
      await modalLock.withLock({ modal: modals.recycleDelete, action: 'recycle-delete' }, perform).catch(() => {});
    } else {
      await perform();
    }
  }

  async function handleEditProfileSave() {
    controls.editProfileError.classList.add('d-none');
    const { fullName, preferredName, hasErrors } = updateProfileValidationState();
    if (hasErrors) return;
    await modalLock.withLock({ modal: modals.editProfile, action: 'edit-profile' }, async () => {
      setButtonLoading(controls.editProfileSaveBtn, true);
      setModalDisabled(modals.editProfile, true);
      const payload = { fullName, preferredName };
      await fetchJson('/users/me', { method: 'PUT', body: JSON.stringify(payload) });
      await loadProfile();
      if (modalManager) await modalManager.hideModal(modals.editProfile);
    }).catch((err) => {
      renderInlineError(controls.editProfileError, 'Unable to save', [err.message]);
    }).finally(() => {
      setButtonLoading(controls.editProfileSaveBtn, false);
      setModalDisabled(modals.editProfile, false);
      updateProfileValidationState();
    });
  }

  function resetEditProfile() {
    if (!state.profile) return;
    controls.editFullName.value = state.profile.fullName || '';
    controls.editPreferredName.value = state.profile.preferredName || '';
    controls.editProfileError.classList.add('d-none');
    updateProfileValidationState();
  }

  function validatePasswordInputs() {
    const errors = [];
    const fieldErrors = { current: [], next: [], confirm: [] };
    const currentPassword = controls.currentPassword?.value || '';
    const newPassword = controls.newPassword?.value || '';
    const confirmPassword = controls.confirmNewPassword?.value || '';

    if (!currentPassword.trim()) fieldErrors.current.push('Current password is required.');

    if (!newPassword.trim()) {
      fieldErrors.next.push('A new password is required.');
    } else {
      if (newPassword.length < 10 || newPassword.length > 100) fieldErrors.next.push('Password must be between 10 and 100 characters.');
      if (!/[A-Z]/.test(newPassword)) fieldErrors.next.push('Must include at least one uppercase letter.');
      if (!/[a-z]/.test(newPassword)) fieldErrors.next.push('Must include at least one lowercase letter.');
      if (!/[0-9]/.test(newPassword)) fieldErrors.next.push('Must include at least one number.');
      if (!/[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;/']/.test(newPassword)) fieldErrors.next.push('Must include at least one special character.');
      if (newPassword === currentPassword) fieldErrors.next.push('New password must be different from your current password.');
    }

    if (newPassword && confirmPassword !== newPassword) {
      fieldErrors.confirm.push('New passwords do not match.');
    }

    const allErrors = [...fieldErrors.current, ...fieldErrors.next, ...fieldErrors.confirm];
    setHelpText(controls.currentPasswordHelp, fieldErrors.current[0] || 'Enter your current password.', fieldErrors.current.length > 0);
    setHelpText(controls.newPasswordHelp, fieldErrors.next[0] || 'Minimum 10 characters with upper, lower, number, and special character.', fieldErrors.next.length > 0);
    setHelpText(controls.confirmNewPasswordHelp, fieldErrors.confirm[0] || 'Re-enter the new password.', fieldErrors.confirm.length > 0);

    const anyInput = currentPassword || newPassword || confirmPassword;
    if (controls.changePasswordSaveBtn) controls.changePasswordSaveBtn.disabled = allErrors.length > 0 || !anyInput;
    safeText(controls.changePasswordChanges, anyInput ? 'Changing password.' : 'No changes yet.', 'changePasswordChanges');
    return { currentPassword, newPassword, errors: allErrors };
  }

  function validateEmailInput() {
    const errors = [];
    const email = (controls.newEmail?.value || '').trim();
    const currentEmail = (state.profile?.email || '').trim().toLowerCase();
    if (!email) {
      errors.push('Please enter a new email address.');
    } else {
      const len = email.length;
      if (len < 5 || len > 255) errors.push('Email must be between 5 and 255 characters.');
      const regex = /^(?=.{3,255}$)[-a-z0-9~!$%^&*_=+}{'?’]+(\.[-a-z0-9~!$%^&*_=+}{'?’]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.[a-z]{2,}|([0-9]{1,3}\.){3}[0-9]{1,3})(:[0-9]{1,5})?$/i;
      if (!regex.test(email)) errors.push('Email format is incorrect.');
      if (email.toLowerCase() === currentEmail) errors.push('Enter a different email from your current one.');
    }
    setHelpText(controls.changeEmailHelp, errors[0] || 'We will send a confirmation email to the new address. This may sign you out once confirmed.', errors.length > 0);
    const changeSentence = describeChange('email', state.profile?.email || '', email);
    safeText(controls.changeEmailChanges, changeSentence || 'No changes yet.', 'changeEmailChanges');
    if (controls.changeEmailSaveBtn) controls.changeEmailSaveBtn.disabled = errors.length > 0;
    return { email, errors };
  }

  function validateApiKeyInput() {
    const errors = [];
    const name = (controls.apiKeyName.value || '').trim();
    if (!name) errors.push('API key name must be provided.');
    if (name && (name.length < 2 || name.length > 120)) errors.push('Name must be between 2 and 120 characters.');
    controls.createApiKeySaveBtn.disabled = errors.length > 0;
    return { name, errors };
  }

  async function handleChangePassword() {
    controls.changePasswordError.classList.add('d-none');
    const { currentPassword, newPassword, errors } = validatePasswordInputs();
    if (errors.length > 0) return;
    try {
      const captchaToken = await recaptcha.getToken('change_password');
      await modalLock.withLock({ modal: modals.changePassword, action: 'change-password' }, async () => {
        setButtonLoading(controls.changePasswordSaveBtn, true);
        setModalDisabled(modals.changePassword, true);
        await fetchJson('/users/me/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword, captchaToken })
        });
        controls.currentPassword.value = '';
        controls.newPassword.value = '';
        controls.confirmNewPassword.value = '';
        if (modalManager) await modalManager.hideModal(modals.changePassword);
        showPageAlert('Password updated. You will be signed out on other devices.', 'success');
      });
    } catch (err) {
      renderInlineError(controls.changePasswordError, 'Unable to change password', [err.message]);
    } finally {
      setButtonLoading(controls.changePasswordSaveBtn, false);
      setModalDisabled(modals.changePassword, false);
      validatePasswordInputs();
    }
  }

  async function handleChangeEmail() {
    controls.changeEmailError.classList.add('d-none');
    controls.changeEmailSuccess.classList.add('d-none');
    const { email, errors } = validateEmailInput();
    if (errors.length > 0) {
      renderInlineError(controls.changeEmailError, 'Unable to request change', errors);
      return;
    }
    await modalLock.withLock({ modal: modals.changeEmail, action: 'change-email' }, async () => {
      setButtonLoading(controls.changeEmailSaveBtn, true);
      setModalDisabled(modals.changeEmail, true);
      await fetchJson('/users/me/request-email-change', {
        method: 'POST',
        body: JSON.stringify({ newEmail: email })
      });
      controls.newEmail.value = '';
      if (modalManager) await modalManager.hideModal(modals.changeEmail);
      showPageAlert('Check your inbox to confirm the email change.', 'success');
    }).catch((err) => {
      renderInlineError(controls.changeEmailError, 'Unable to request change', [err.message]);
    }).finally(() => {
      setButtonLoading(controls.changeEmailSaveBtn, false);
      setModalDisabled(modals.changeEmail, false);
      validateEmailInput();
    });
  }

  function openRevokeSession(fingerprint) {
    const session = state.sessions.find((s) => s.fingerprint === fingerprint);
    if (!session) return;
    state.revokeSessionTarget = session;
    controls.revokeSessionDetail.textContent = `${session.device || session.browser || 'Unknown device'} • ${session.locationHint || session.ipAddress || 'Location unknown'} • ${formatDate(session.issuedAt)}`;
    controls.revokeSessionError.classList.add('d-none');
    modalManager?.showModal(modals.revokeSession);
  }

  async function handleRevokeSession() {
    const target = state.revokeSessionTarget;
    if (!target) return;
    await modalLock.withLock({ modal: modals.revokeSession, action: 'revoke-session' }, async () => {
      setButtonLoading(controls.confirmRevokeSessionBtn, true);
      setModalDisabled(modals.revokeSession, true);
      await fetchJson(`/users/me/sessions/${encodeURIComponent(target.fingerprint)}`, { method: 'DELETE' });
      await loadSessions();
      state.revokeSessionTarget = null;
      if (modalManager) await modalManager.hideModal(modals.revokeSession);
    }).catch((err) => {
      renderInlineError(controls.revokeSessionError, 'Unable to log out', [err.message]);
    }).finally(() => {
      setButtonLoading(controls.confirmRevokeSessionBtn, false);
      setModalDisabled(modals.revokeSession, false);
    });
  }

  async function handleLogoutAll() {
    if (controls.logoutAllError) controls.logoutAllError.classList.add('d-none');
    await modalLock.withLock({ modal: modals.logoutAll, action: 'logout-all' }, async () => {
      setButtonLoading(controls.confirmLogoutAllBtn, true);
      setModalDisabled(modals.logoutAll, true);
      await fetchJson('/auth/logout', { method: 'POST', body: JSON.stringify({ allDevices: true }) });
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      if (modalManager) await modalManager.hideModal(modals.logoutAll);
      window.location.href = 'https://bookproject.fjnel.co.za?action=login';
    }).catch((err) => {
      if (controls.logoutAllError) {
        controls.logoutAllError.textContent = err.message;
        controls.logoutAllError.classList.remove('d-none');
      }
    }).finally(() => {
      setButtonLoading(controls.confirmLogoutAllBtn, false);
      setModalDisabled(modals.logoutAll, false);
    });
  }

  function openCreateApiKeyModal() {
    controls.createApiKeyError.classList.add('d-none');
    controls.apiKeySecretWrap.classList.add('d-none');
    controls.apiKeyName.value = '';
    controls.apiKeyExpiresAt.value = '';
    validateApiKeyInput();
    modalManager?.showModal(modals.createApiKey);
  }

  async function handleCreateApiKey() {
    controls.createApiKeyError.classList.add('d-none');
    controls.apiKeySecretWrap.classList.add('d-none');
    const { name, errors } = validateApiKeyInput();
    if (errors.length > 0) {
      renderInlineError(controls.createApiKeyError, 'Unable to create key', errors);
      return;
    }
    const expiresAt = controls.apiKeyExpiresAt.value ? new Date(controls.apiKeyExpiresAt.value).toISOString() : null;
    await modalLock.withLock({ modal: modals.createApiKey, action: 'create-api-key' }, async () => {
      setButtonLoading(controls.createApiKeySaveBtn, true);
      setModalDisabled(modals.createApiKey, true);
      const data = await fetchJson('/users/me/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name, expiresAt })
      });
      const secret = data.token || data.secret || data.apiKey || data.key;
      if (secret) {
        controls.apiKeySecret.textContent = secret;
        controls.apiKeySecretWrap.classList.remove('d-none');
      }
      await loadApiKeys();
    }).catch((err) => {
      renderInlineError(controls.createApiKeyError, 'Unable to create key', [err.message]);
    }).finally(() => {
      setButtonLoading(controls.createApiKeySaveBtn, false);
      setModalDisabled(modals.createApiKey, false);
      validateApiKeyInput();
    });
  }

  function openRevokeApiKey(id) {
    const key = state.apiKeys.find((k) => String(k.id) === String(id));
    if (!key) return;
    state.revokeApiKeyTarget = key;
    controls.revokeApiKeyDetail.textContent = `${key.name || 'Unnamed'} (${key.prefix || 'no prefix'})`;
    controls.revokeApiKeyError.classList.add('d-none');
    modalManager?.showModal(modals.revokeApiKey);
  }

  async function handleRevokeApiKey() {
    const key = state.revokeApiKeyTarget;
    if (!key) return;
    await modalLock.withLock({ modal: modals.revokeApiKey, action: 'revoke-api-key' }, async () => {
      setButtonLoading(controls.confirmRevokeApiKeyBtn, true);
      await fetchJson('/users/me/api-keys', {
        method: 'DELETE',
        body: JSON.stringify({ id: key.id, name: key.name, prefix: key.prefix })
      });
      await loadApiKeys();
      state.revokeApiKeyTarget = null;
      if (modalManager) await modalManager.hideModal(modals.revokeApiKey);
    }).catch((err) => {
      renderInlineError(controls.revokeApiKeyError, 'Unable to revoke', [err.message]);
    }).finally(() => setButtonLoading(controls.confirmRevokeApiKeyBtn, false));
  }

  async function handleDisableAccount() {
    controls.disableAccountError.classList.add('d-none');
    await modalLock.withLock({ modal: modals.disableAccount, action: 'disable-account' }, async () => {
      setButtonLoading(controls.confirmDisableAccountBtn, true);
      setModalDisabled(modals.disableAccount, true);
      await fetchJson('/users/me', { method: 'DELETE' });
      if (modalManager) await modalManager.hideModal(modals.disableAccount);
      showPageAlert('Disable request sent. Check your email for confirmation.', 'success');
    }).catch((err) => {
      renderInlineError(controls.disableAccountError, 'Unable to request disable', [err.message]);
    }).finally(() => {
      setButtonLoading(controls.confirmDisableAccountBtn, false);
      setModalDisabled(modals.disableAccount, false);
    });
  }

  function updateDeleteConfirmState() {
    const value = (controls.deleteAccountConfirmInput?.value || '').trim();
    const ok = value.toUpperCase() === 'DELETE';
    if (controls.confirmDeleteAccountBtn) controls.confirmDeleteAccountBtn.disabled = !ok;
    setHelpText(controls.deleteAccountHelp, ok ? 'Ready to send the deletion request.' : 'Type DELETE to enable the request.', !ok);
    return ok;
  }

  async function handleDeleteAccount() {
    controls.deleteAccountError.classList.add('d-none');
    if (!updateDeleteConfirmState()) {
      controls.deleteAccountError.textContent = 'Please type DELETE to confirm.';
      controls.deleteAccountError.classList.remove('d-none');
      return;
    }
    await modalLock.withLock({ modal: modals.deleteAccount, action: 'delete-account' }, async () => {
      setButtonLoading(controls.confirmDeleteAccountBtn, true);
      setModalDisabled(modals.deleteAccount, true);
      await fetchJson('/users/me/request-account-deletion', { method: 'POST' });
      if (modalManager) await modalManager.hideModal(modals.deleteAccount);
      if (controls.deleteAccountConfirmInput) controls.deleteAccountConfirmInput.value = '';
      updateDeleteConfirmState();
      showPageAlert('Deletion request sent. Check your email to confirm.', 'success');
    }).catch((err) => {
      renderInlineError(controls.deleteAccountError, 'Unable to request deletion', [err.message]);
    }).finally(() => {
      setButtonLoading(controls.confirmDeleteAccountBtn, false);
      setModalDisabled(modals.deleteAccount, false);
    });
  }

  function bindEvents() {
    elements.navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        if (!section || section === state.activeSection) return;
        setActiveSection(section);
      });
    });

    window.addEventListener('hashchange', () => {
      const section = getSectionFromLocation();
      if (section && section !== state.activeSection) setActiveSection(section);
    });

    elements.statsTiles?.addEventListener('click', (event) => {
      const card = event.target.closest('[data-href]');
      if (card?.dataset?.href) {
        window.location.href = card.dataset.href;
      }
    });
    elements.statsTiles?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-href]');
      if (card?.dataset?.href) {
        event.preventDefault();
        window.location.href = card.dataset.href;
      }
    });

    elements.editProfileBtn?.addEventListener('click', () => {
      resetEditProfile();
      modalManager?.showModal(modals.editProfile);
    });
    controls.completeProfileBtn?.addEventListener('click', () => setActiveSection('profile'));
    controls.editProfileSaveBtn?.addEventListener('click', handleEditProfileSave);
    controls.editProfileResetBtn?.addEventListener('click', resetEditProfile);
    controls.editFullName?.addEventListener('input', updateProfileValidationState);
    controls.editPreferredName?.addEventListener('input', updateProfileValidationState);
    controls.editFullName?.addEventListener('blur', updateProfileValidationState);
    controls.editPreferredName?.addEventListener('blur', updateProfileValidationState);

    elements.changePasswordBtn?.addEventListener('click', () => {
      validatePasswordInputs();
      modalManager?.showModal(modals.changePassword);
    });
    controls.changePasswordSaveBtn?.addEventListener('click', handleChangePassword);
    [controls.currentPassword, controls.newPassword, controls.confirmNewPassword].forEach((input) => {
      input?.addEventListener('input', validatePasswordInputs);
    });

    elements.changeEmailBtn?.addEventListener('click', () => {
      validateEmailInput();
      modalManager?.showModal(modals.changeEmail);
    });
    controls.changeEmailSaveBtn?.addEventListener('click', handleChangeEmail);
    controls.newEmail?.addEventListener('input', validateEmailInput);

    controls.emailPrefAccountUpdates?.addEventListener('change', () => {
      clearEmailPrefAlerts();
      updateEmailPrefChanges();
    });
    controls.emailPrefDevFeatures?.addEventListener('change', () => {
      clearEmailPrefAlerts();
      updateEmailPrefChanges();
    });
    controls.emailPrefResetBtn?.addEventListener('click', () => {
      clearEmailPrefAlerts();
      resetEmailPreferences();
    });
    controls.emailPrefSaveBtn?.addEventListener('click', saveEmailPreferences);

    controls.themePreferenceSelect?.addEventListener('change', () => {
      clearThemePrefAlerts();
      updateThemePreferenceChanges();
    });
    controls.themePreferenceResetBtn?.addEventListener('click', () => {
      clearThemePrefAlerts();
      resetThemePreference();
    });
    controls.themePreferenceSaveBtn?.addEventListener('click', saveThemePreference);

    elements.sessionsTable?.addEventListener('click', (event) => {
      const btn = event.target.closest('.js-revoke-session');
      if (btn) openRevokeSession(btn.dataset.fp);
    });
    controls.confirmRevokeSessionBtn?.addEventListener('click', handleRevokeSession);
    elements.logoutAllBtn?.addEventListener('click', () => {
      if (controls.logoutAllError) controls.logoutAllError.classList.add('d-none');
      modalManager?.showModal(modals.logoutAll);
    });
    controls.confirmLogoutAllBtn?.addEventListener('click', handleLogoutAll);

    document.querySelectorAll('.js-create-api-key').forEach((btn) => {
      btn.addEventListener('click', openCreateApiKeyModal);
    });
    controls.apiKeyName?.addEventListener('input', validateApiKeyInput);
    controls.apiKeyExpiresAt?.addEventListener('input', validateApiKeyInput);
    controls.createApiKeySaveBtn?.addEventListener('click', handleCreateApiKey);
    elements.apiKeysTable?.addEventListener('click', (event) => {
      const btn = event.target.closest('.js-revoke-api-key');
      if (btn) openRevokeApiKey(btn.dataset.id);
    });
    controls.confirmRevokeApiKeyBtn?.addEventListener('click', handleRevokeApiKey);
    controls.copyApiKeySecretBtn?.addEventListener('click', async () => {
      const secret = controls.apiKeySecret.textContent || '';
      if (!secret) return;
      try { await navigator.clipboard.writeText(secret); } catch (e) { warn('Clipboard copy failed', e); }
    });

    elements.disableAccountBtn?.addEventListener('click', () => modalManager?.showModal(modals.disableAccount));
    controls.confirmDisableAccountBtn?.addEventListener('click', handleDisableAccount);

    elements.deleteAccountBtn?.addEventListener('click', () => {
      if (controls.deleteAccountConfirmInput) controls.deleteAccountConfirmInput.value = '';
      updateDeleteConfirmState();
      modalManager?.showModal(modals.deleteAccount);
    });
    controls.deleteAccountConfirmInput?.addEventListener('input', updateDeleteConfirmState);
    controls.confirmDeleteAccountBtn?.addEventListener('click', handleDeleteAccount);

    elements.recycleRefreshBtn?.addEventListener('click', loadRecycleBin);
    elements.recycleRestoreBtn?.addEventListener('click', () => {
      const items = getSelectedRecycleItems();
      if (items.length) openRecycleRestoreModal(items);
    });
    elements.recycleDeleteBtn?.addEventListener('click', () => {
      const items = getSelectedRecycleItems();
      if (items.length) openRecycleDeleteModal(items);
    });
    elements.recycleFilterBooks?.addEventListener('change', renderRecycleBin);
    elements.recycleFilterBookTypes?.addEventListener('change', renderRecycleBin);
    elements.recycleFilterAuthors?.addEventListener('change', renderRecycleBin);
    elements.recycleFilterPublishers?.addEventListener('change', renderRecycleBin);
    elements.recycleFilterSeries?.addEventListener('change', renderRecycleBin);
    elements.recycleSelectAll?.addEventListener('change', () => {
      const filters = getRecycleFilters();
      const visibleItems = state.recycleItems.filter((item) => filters.has(item.type));
      if (elements.recycleSelectAll.checked) {
        visibleItems.forEach((item) => state.recycleSelection.add(recycleKey(item)));
      } else {
        visibleItems.forEach((item) => state.recycleSelection.delete(recycleKey(item)));
      }
      renderRecycleBin();
    });
    controls.recycleRestoreMode?.addEventListener('change', updateRecycleRestoreChanges);
    controls.recycleRestoreConfirmBtn?.addEventListener('click', submitRecycleRestore);
    controls.recycleDeleteConfirmInput?.addEventListener('input', updateRecycleDeleteState);
    controls.recycleDeleteConfirmBtn?.addEventListener('click', submitRecycleDelete);
  }

  async function bootstrap() {
    const ok = await window.authGuard.checkSessionAndPrompt();
    if (!ok) return;
    await showPageLoading();
    try {
      await Promise.all([loadProfile(), loadStats(), loadSessions(), loadApiKeys(), loadRecycleBin(), loadEmailPreferences()]);
    } catch (error) {
      console.error('[Account] Initial load failed', error);
      if (modalManager) await modalManager.showModal(apiErrorModal);
    } finally {
      await hidePageLoading();
    }
  }

  const initialSection = getSectionFromLocation() || 'overview';
  setActiveSection(initialSection);
  bindEvents();
  bootstrap();
})();
