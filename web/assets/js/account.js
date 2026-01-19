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
    profileCompleteness: null
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
    deleteAccountBtn: document.getElementById('deleteAccountBtn')
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
    deleteAccount: document.getElementById('deleteAccountModal')
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
    changeEmailSaveBtn: document.getElementById('changeEmailSaveBtn'),
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
    confirmDeleteAccountBtn: document.getElementById('confirmDeleteAccountBtn')
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

  function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    const spinner = btn.querySelector('.spinner-border');
    if (spinner) spinner.classList.toggle('d-none', !isLoading);
    btn.disabled = !!isLoading;
  }

  const validSections = new Set(['overview', 'profile', 'security', 'danger']);

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

  function validationMessage(prefix, errors) {
    if (!errors || errors.length === 0) return '';
    return `**${prefix}**: ${errors.join(', ')}`;
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
    elements.profileChecklist.classList.remove('d-none');

    const listItems = completeness.items.map((item) => {
      const icon = item.complete
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle text-success" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M10.97 5.97a.75.75 0 0 0-1.07-1.05L7.477 7.94 6.384 6.846a.75.75 0 1 0-1.06 1.06L6.97 9.553a.75.75 0 0 0 1.079-.02z"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash-circle text-warning" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8"/></svg>';
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

  function updateProfileValidationState() {
    if (!controls.editFullName || !controls.editPreferredName) {
      warn('Profile inputs missing');
      return { fullName: '', preferredName: '', hasErrors: true };
    }
    const fullName = controls.editFullName.value;
    const preferredName = controls.editPreferredName.value;
    if (!state.profile) {
      if (controls.editProfileSaveBtn) controls.editProfileSaveBtn.disabled = true;
      safeText(controls.editFullNameHelp, 'Enter your full name (2-255 characters).', 'editFullNameHelp');
      safeText(controls.editPreferredNameHelp, 'Optional; 2-100 letters, no spaces.', 'editPreferredNameHelp');
      return { fullName, preferredName, hasErrors: true };
    }
    const fullNameErrors = validateFullNameInput(fullName);
    const preferredErrors = validatePreferredNameInput(preferredName);
    safeText(controls.editFullNameHelp, fullNameErrors[0] || 'Enter your full name (2-255 characters).', 'editFullNameHelp');
    safeText(controls.editPreferredNameHelp, preferredErrors[0] || 'Optional; 2-100 letters, no spaces.', 'editPreferredNameHelp');

    const changed = (fullName || '').trim() !== (state.profile?.fullName || '') || (preferredName || '').trim() !== (state.profile?.preferredName || '');
    safeText(controls.editProfileChanges, changed
      ? `Changing display name from ${state.profile?.preferredName || state.profile?.fullName || 'current'} to ${(preferredName || fullName || '').trim()}.`
      : 'No changes yet.', 'editProfileChanges');

    const hasErrors = fullNameErrors.length > 0 || preferredErrors.length > 0;
    if (controls.editProfileSaveBtn) controls.editProfileSaveBtn.disabled = hasErrors || !changed;
    return { fullName, preferredName, hasErrors };
  }

  function renderProfile(profile) {
    elements.welcomeName.textContent = profile.preferredName || profile.fullName || 'Your account';
    renderStatusChips(profile);

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
      android: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-android device-icon" viewBox="0 0 16 16"><path d="M3.586 1.846a.5.5 0 0 1 .707.03l.815.89A4.487 4.487 0 0 1 8 2c1.12 0 2.146.398 2.892 1.07l.815-.893a.5.5 0 1 1 .738.676l-.8.877A4.49 4.49 0 0 1 13 6h1.5a.5.5 0 0 1 0 1H13v3.5a1.5 1.5 0 0 1-3 0V7H6v3.5a1.5 1.5 0 0 1-3 0V7H1.5a.5.5 0 0 1 0-1H3a4.49 4.49 0 0 1 .355-2.27l-.8-.877a.5.5 0 0 1 .03-.707M5 4.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0m6 0a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0"/></svg>',
      apple: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-apple device-icon" viewBox="0 0 16 16"><path d="M11.182.008c.053.5-.146 1.002-.44 1.414-.29.408-.855.774-1.377.728-.062-.494.172-1.01.46-1.35C10.141.356 10.701.038 11.182.008M8.48 3.041c-.777 0-1.67.45-2.177.45-.548 0-1.387-.43-2.285-.416-1.177.017-2.266.684-2.868 1.74-1.226 2.13-.315 5.29.88 7.026.582.84 1.273 1.785 2.184 1.754.867-.035 1.19-.566 2.233-.566 1.026 0 1.33.566 2.273.549.942-.017 1.54-.858 2.116-1.7.664-.974.94-1.92.956-1.968-.021-.01-1.836-.705-1.857-2.797-.016-1.748 1.426-2.58 1.49-2.62-.815-1.19-2.068-1.324-2.48-1.347-.597-.06-1.088.453-1.786.453"/></svg>',
    
      windows: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-windows device-icon" viewBox="0 0 16 16"><path d="M6.555 3.108v5.392H0V4.047l6.555-.939zm1.074-.153 7.99-1.144v6.689H7.629V2.955zM0 9.5h6.555v5.392L0 13.953V9.5zm7.629 0h7.99v6.689l-7.99-1.144V9.5z"/></svg>',
      mac: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-command device-icon" viewBox="0 0 16 16"><path d="M3.5 9a1.5 1.5 0 1 0 1.5 1.5V9zm0-1V6.5A1.5 1.5 0 1 0 2 8zm9 1v1.5a1.5 1.5 0 1 0 1.5-1.5zM9 3.5h1.5a1.5 1.5 0 1 0-1.5-1.5zM8 6h1V5H8zm0 1h1v2H8zm0 3h1v1H8zm2-4h1V5h-1zm1 1h1v2h-1zm0 3h1v1h-1zM6 5h1V4H6zm1 1h1v2H7zm0 3h1v1H7zm-2-3h1V4H5zm0 4h1v1H5zm4-5h1V4H9z"/></svg>',
      linux: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-linux device-icon" viewBox="0 0 16 16"><path d="M11.479 1.5c-.54-.116-1.14.498-1.03 1.099.03.317.138.55.47.703.327.149.72-.014.94-.246.294-.312.275-.962-.012-1.276-.105-.11-.207-.218-.368-.248zM9.406 2.8c-.606-.018-1.07.438-1.106 1.01-.02.307.09.536.34.706.348.219.743.05.98-.238.31-.338.293-1.026-.093-1.302-.055-.04-.107-.084-.12-.176z"/><path d="M8.004 0c-.614 0-1.353.21-1.713.77-.178.271-.23.58-.25.884-.02.3-.044.707-.23.974-.457.634-.456 1.44-.4 2.185.05.692.137 1.39.043 2.084-.074.558-.28 1.106-.52 1.615-.247.523-.546 1.033-.813 1.556-.262.511-.523 1.036-.67 1.594-.156.6-.215 1.35.19 1.87.355.46.957.603 1.52.67.978.12 1.967.086 2.95.062.984.024 1.973.058 2.951-.062.563-.067 1.165-.21 1.52-.67.405-.52.346-1.27.19-1.87-.147-.558-.408-1.083-.67-1.594-.267-.523-.566-1.033-.813-1.556-.24-.509-.446-1.057-.52-1.615-.094-.694-.007-1.392.043-2.084.056-.745.057-1.551-.4-2.185-.186-.267-.21-.674-.23-.974-.02-.304-.072-.613-.25-.884C9.357.21 8.618 0 8.004 0m.657 13.248c-.18.25-.502.35-.81.36-.366.016-.857-.056-1.02-.445-.112-.27.005-.568.23-.73.206-.142.47-.184.707-.238.224-.067.448-.123.68-.13.234-.007.5.034.683.196.246.22.305.6.14.987m-3.72-1.59c-.398.326-.714.638-1.21.79-.61.152-.82-.42-.677-.887.118-.404.34-.77.564-1.13.244-.386.485-.78.712-1.18.21-.358.4-.72.535-1.108.152-.43.21-.88.262-1.33.032-.486.063-.98-.046-1.457-.07-.308-.253-.565-.3-.88-.07-.61.01-1.48.665-1.763.437-.184.953.005 1.195.4.29.46.25 1.052.498 1.53.214.478.554.885.73 1.378.225.614.255 1.29.185 1.94-.067.46-.175.918-.314 1.364-.134.44-.296.874-.48 1.298-.29.59-.63 1.162-1.114 1.613M9.94 4.944c-.48-.01-.857-.46-.833-.93.013-.505.467-.9.944-.852.503.02.907.506.855 1.002-.04.454-.447.796-.966.78m-3.59-.93c-.26-.06-.45-.28-.518-.53-.065-.29.05-.61.28-.8.255-.21.676-.24.933.006.262.26.318.74.09 1.035-.155.215-.43.322-.685.29m4.294 2.507c-.03-.12.05-.242.17-.274.237-.075.48.122.502.36.048.364-.063.734-.27 1.03-.17.254-.515.63-.84.36-.17-.134-.11-.39-.044-.57.167-.282.267-.598.48-.867zm-4.53-.004c.213.27.313.585.48.867.068.18.126.436-.044.57-.325.27-.67-.106-.84-.36-.208-.296-.318-.666-.27-1.03.022-.238.264-.435.5-.36.12.032.2.154.17.274z"/></svg>',
      phone: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-phone device-icon" viewBox="0 0 16 16"><path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/><path d="M8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/></svg>',
      desktop: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-pc-display-horizontal device-icon" viewBox="0 0 16 16"><path d="M13.5 1h-11A1.5 1.5 0 0 0 1 2.5V9a1 1 0 0 0 1 1H2v1H1.5a.5.5 0 0 0 0 1H7v1.5H4.5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1H9V11h5.5a.5.5 0 0 0 0-1H14v-1h.5a1 1 0 0 0 1-1V2.5A1.5 1.5 0 0 0 13.5 1M13 9H3V2.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 .5.5z"/></svg>',
      unknown: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-question-circle device-icon" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M5.255 5.786a1.78 1.78 0 0 1 1.533-.311c.513.128.838.45.99.674.154.227.196.355.196.55 0 .24-.08.412-.44.757-.35.335-.677.62-.677 1.23v.07a.5.5 0 0 0 1 0c0-.24.08-.412.44-.757.35-.335.677-.62.677-1.23 0-.336-.083-.681-.287-.97-.204-.292-.52-.56-.987-.684a2.78 2.78 0 0 0-2.401.484.5.5 0 1 0 .586.8"/><path d="M7.002 11a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/></svg>'
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
              <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
            </svg>
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
      if (res.status >= 500 && modalManager) await modalManager.showModal(apiErrorModal);
      const data = await res.json().catch(() => ({}));
      const message = data.message || 'Request failed';
      const errors = data.errors || [];
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
      controls.editProfileError.innerHTML = validationMessage('Unable to save', [err.message]);
      controls.editProfileError.classList.remove('d-none');
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
    safeText(controls.currentPasswordHelp, fieldErrors.current[0] || 'Enter your current password.', 'currentPasswordHelp');
    safeText(controls.newPasswordHelp, fieldErrors.next[0] || 'Minimum 10 characters with upper, lower, number, and special character.', 'newPasswordHelp');
    safeText(controls.confirmNewPasswordHelp, fieldErrors.confirm[0] || 'Re-enter the new password.', 'confirmNewPasswordHelp');

    const anyInput = currentPassword || newPassword || confirmPassword;
    if (controls.changePasswordSaveBtn) controls.changePasswordSaveBtn.disabled = allErrors.length > 0 || !anyInput;
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
    safeText(controls.changeEmailHelp, errors[0] || 'We will send a confirmation email to the new address. This may sign you out once confirmed.', 'changeEmailHelp');
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
      controls.changePasswordError.innerHTML = validationMessage('Unable to change password', [err.message]);
      controls.changePasswordError.classList.remove('d-none');
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
      controls.changeEmailError.innerHTML = validationMessage('Unable to request change', errors);
      controls.changeEmailError.classList.remove('d-none');
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
      controls.changeEmailError.innerHTML = validationMessage('Unable to request change', [err.message]);
      controls.changeEmailError.classList.remove('d-none');
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
      controls.revokeSessionError.innerHTML = validationMessage('Unable to log out', [err.message]);
      controls.revokeSessionError.classList.remove('d-none');
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
      controls.createApiKeyError.innerHTML = validationMessage('Unable to create key', errors);
      controls.createApiKeyError.classList.remove('d-none');
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
      controls.createApiKeyError.innerHTML = `<strong>Unable to create key</strong>: ${err.message}`;
      controls.createApiKeyError.classList.remove('d-none');
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
      controls.revokeApiKeyError.innerHTML = `<strong>Unable to revoke</strong>: ${err.message}`;
      controls.revokeApiKeyError.classList.remove('d-none');
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
      controls.disableAccountError.innerHTML = validationMessage('Unable to request disable', [err.message]);
      controls.disableAccountError.classList.remove('d-none');
    }).finally(() => {
      setButtonLoading(controls.confirmDisableAccountBtn, false);
      setModalDisabled(modals.disableAccount, false);
    });
  }

  function updateDeleteConfirmState() {
    const value = (controls.deleteAccountConfirmInput?.value || '').trim();
    const ok = value.toUpperCase() === 'DELETE';
    if (controls.confirmDeleteAccountBtn) controls.confirmDeleteAccountBtn.disabled = !ok;
    safeText(controls.deleteAccountHelp, ok ? 'Ready to send the deletion request.' : 'Type DELETE to enable the request.', 'deleteAccountHelp');
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
      controls.deleteAccountError.innerHTML = validationMessage('Unable to request deletion', [err.message]);
      controls.deleteAccountError.classList.remove('d-none');
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
  }

  async function bootstrap() {
    const ok = await window.authGuard.checkSessionAndPrompt();
    if (!ok) return;
    await showPageLoading();
    try {
      await Promise.all([loadProfile(), loadStats(), loadSessions(), loadApiKeys()]);
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
