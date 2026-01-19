'use strict';

(async function initAccountPage() {
  const modal = window.bootstrap?.Modal;
  const pageLoadingModal = document.getElementById('pageLoadingModal');
  const apiErrorModal = document.getElementById('apiErrorModal');
  const modalManager = window.modalManager;
  const modalLock = window.modalLock;
  const recaptcha = window.recaptchaV3;

  const state = {
    profile: null,
    stats: null,
    sessions: [],
    apiKeys: [],
    revokeSessionTarget: null,
    revokeApiKeyTarget: null
  };

  const elements = {
    welcomeName: document.getElementById('welcomeName'),
    statusChips: document.getElementById('statusChips'),
    profileScoreLabel: document.getElementById('profileScoreLabel'),
    profileScoreBar: document.getElementById('profileScoreBar'),
    statsTiles: document.getElementById('statsTiles'),
    refreshStatsBtn: document.getElementById('refreshStatsBtn'),
    profileEmail: document.getElementById('profileEmail'),
    profilePreferred: document.getElementById('profilePreferred'),
    profileFull: document.getElementById('profileFull'),
    profileRole: document.getElementById('profileRole'),
    profileVerified: document.getElementById('profileVerified'),
    profileLastLogin: document.getElementById('profileLastLogin'),
    profileCreated: document.getElementById('profileCreated'),
    profileUpdated: document.getElementById('profileUpdated'),
    editProfileBtn: document.getElementById('editProfileBtn'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),
    passwordInfo: document.getElementById('passwordInfo'),
    changeEmailBtn: document.getElementById('changeEmailBtn'),
    logoutAllBtn: document.getElementById('logoutAllBtn'),
    refreshSessionsBtn: document.getElementById('refreshSessionsBtn'),
    sessionsTable: document.getElementById('sessionsTable'),
    createApiKeyBtn: document.getElementById('createApiKeyBtn'),
    refreshApiKeysBtn: document.getElementById('refreshApiKeysBtn'),
    apiKeysTable: document.getElementById('apiKeysTable'),
    disableAccountBtn: document.getElementById('disableAccountBtn'),
    deleteAccountBtn: document.getElementById('deleteAccountBtn')
  };

  const modals = {
    editProfile: document.getElementById('editProfileModal'),
    changePassword: document.getElementById('changePasswordModal'),
    changeEmail: document.getElementById('changeEmailModal'),
    revokeSession: document.getElementById('revokeSessionModal'),
    createApiKey: document.getElementById('createApiKeyModal'),
    revokeApiKey: document.getElementById('revokeApiKeyModal'),
    disableAccount: document.getElementById('disableAccountModal'),
    deleteAccount: document.getElementById('deleteAccountModal')
  };

  const controls = {
    editFullName: document.getElementById('editFullName'),
    editPreferredName: document.getElementById('editPreferredName'),
    editProfileError: document.getElementById('editProfileError'),
    editProfileResetBtn: document.getElementById('editProfileResetBtn'),
    editProfileSaveBtn: document.getElementById('editProfileSaveBtn'),
    changePasswordError: document.getElementById('changePasswordError'),
    currentPassword: document.getElementById('currentPassword'),
    newPassword: document.getElementById('newPassword'),
    confirmNewPassword: document.getElementById('confirmNewPassword'),
    changePasswordSaveBtn: document.getElementById('changePasswordSaveBtn'),
    changePasswordHelp: document.getElementById('changePasswordHelp'),
    changeEmailError: document.getElementById('changeEmailError'),
    changeEmailSuccess: document.getElementById('changeEmailSuccess'),
    newEmail: document.getElementById('newEmail'),
    changeEmailSaveBtn: document.getElementById('changeEmailSaveBtn'),
    revokeSessionDetail: document.getElementById('revokeSessionDetail'),
    revokeSessionError: document.getElementById('revokeSessionError'),
    confirmRevokeSessionBtn: document.getElementById('confirmRevokeSessionBtn'),
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
    confirmDeleteAccountBtn: document.getElementById('confirmDeleteAccountBtn')
  };

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  function clearText(el) {
    if (el) el.textContent = '—';
  }

  function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    const spinner = btn.querySelector('.spinner-border');
    if (spinner) spinner.classList.toggle('d-none', !isLoading);
    btn.disabled = !!isLoading;
  }

  async function showPageLoading() {
    if (modalManager) await modalManager.showModal(pageLoadingModal, { backdrop: 'static', keyboard: false });
  }

  async function hidePageLoading() {
    if (modalManager) await modalManager.hideModal(pageLoadingModal);
  }

  function renderStatusChips(profile) {
    const chips = [];
    if (profile.isVerified) chips.push({ text: 'Email verified', color: 'success' });
    chips.push({ text: profile.role || 'User', color: 'secondary' });
    elements.statusChips.innerHTML = chips
      .map((chip) => `<span class="stat-chip border-${chip.color} text-${chip.color}">${chip.text}</span>`)
      .join('');
  }

  function computeProfileScore(profile) {
    const fields = ['fullName', 'preferredName', 'isVerified'];
    const filled = fields.reduce((acc, key) => acc + (profile[key] ? 1 : 0), 0);
    return Math.round((filled / fields.length) * 100);
  }

  function renderProfile(profile) {
    elements.welcomeName.textContent = profile.preferredName || profile.fullName || 'Your account';
    renderStatusChips(profile);
    const score = computeProfileScore(profile);
    elements.profileScoreLabel.textContent = `${score}%`;
    elements.profileScoreBar.style.width = `${score}%`;

    elements.profileEmail.textContent = profile.email || '—';
    elements.profilePreferred.textContent = profile.preferredName || '—';
    elements.profileFull.textContent = profile.fullName || '—';
    elements.profileRole.textContent = profile.role || '—';
    elements.profileVerified.textContent = profile.isVerified ? 'Yes' : 'No';
    elements.profileLastLogin.textContent = formatDate(profile.lastLogin);
    elements.profileCreated.textContent = formatDate(profile.createdAt);
    elements.profileUpdated.textContent = formatDate(profile.updatedAt);

    controls.editFullName.value = profile.fullName || '';
    controls.editPreferredName.value = profile.preferredName || '';
  }

  function renderStats(stats) {
    if (!stats) return;
    const tiles = [
      { label: 'Books', value: stats.bookCount },
      { label: 'Series', value: stats.seriesCount },
      { label: 'Authors', value: stats.authorCount },
      { label: 'Publishers', value: stats.publisherCount },
      { label: 'Tags', value: stats.tagCount },
      { label: 'Languages', value: stats.languageCount }
    ];
    elements.statsTiles.innerHTML = tiles
      .map((tile) => `<div class="col-6"><div class="border rounded p-3 text-center"><div class="h5 mb-0">${tile.value ?? 0}</div><div class="text-muted small">${tile.label}</div></div></div>`) 
      .join('');
  }

  function renderSessions(sessions) {
    const tbody = elements.sessionsTable.querySelector('tbody');
    if (!sessions || sessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">No active sessions found.</td></tr>';
      return;
    }
    tbody.innerHTML = sessions.map((s) => {
      const currentBadge = s.current ? '<span class="badge bg-primary ms-1">Current</span>' : '';
      return `<tr data-fp="${s.fingerprint}">
        <td>${(s.device || 'Unknown')}${currentBadge}</td>
        <td>${s.ipAddress || '—'}</td>
        <td>${formatDate(s.issuedAt)}</td>
        <td>${formatDate(s.expiresAt)}</td>
        <td class="text-end">
          <button class="btn btn-outline-danger btn-sm js-revoke-session" data-fp="${s.fingerprint}">Revoke</button>
        </td>
      </tr>`;
    }).join('');
  }

  function renderApiKeys(keys) {
    const tbody = elements.apiKeysTable.querySelector('tbody');
    if (!keys || keys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">No API keys yet.</td></tr>';
      return;
    }
    tbody.innerHTML = keys.map((k) => {
      const status = k.revokedAt ? 'Revoked' : 'Active';
      return `<tr data-id="${k.id}">
        <td>${k.name || '—'}</td>
        <td>${k.prefix || '—'}</td>
        <td>${formatDate(k.createdAt)}</td>
        <td>${formatDate(k.expiresAt)}</td>
        <td>${formatDate(k.lastUsedAt)}</td>
        <td>${status}</td>
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
    const data = await fetchJson('/users/me', { method: 'GET' });
    state.profile = data;
    renderProfile(data);
    if (!data.passwordUpdated) {
      elements.passwordInfo.textContent = 'No password set yet. Add one to secure your account.';
    } else {
      elements.passwordInfo.textContent = 'Use a strong password. Changing it will sign you out on other devices.';
    }
  }

  async function loadStats() {
    const data = await fetchJson('/users/me/stats', { method: 'GET' });
    state.stats = data;
    renderStats(data);
  }

  async function loadSessions() {
    const data = await fetchJson('/users/me/sessions', { method: 'GET' });
    state.sessions = data.sessions || [];
    renderSessions(state.sessions);
  }

  async function loadApiKeys() {
    const data = await fetchJson('/users/me/api-keys', { method: 'GET' });
    state.apiKeys = data.keys || [];
    renderApiKeys(state.apiKeys);
  }

  async function handleEditProfileSave() {
    controls.editProfileError.classList.add('d-none');
    const fullName = controls.editFullName.value.trim();
    const preferredName = controls.editPreferredName.value.trim();
    await modalLock.withLock({ modal: modals.editProfile, action: 'edit-profile' }, async () => {
      setButtonLoading(controls.editProfileSaveBtn, true);
      const payload = { fullName, preferredName };
      await fetchJson('/users/me', { method: 'PUT', body: JSON.stringify(payload) });
      await loadProfile();
      if (modalManager) await modalManager.hideModal(modals.editProfile);
    }).catch((err) => {
      controls.editProfileError.textContent = err.message;
      controls.editProfileError.classList.remove('d-none');
    }).finally(() => setButtonLoading(controls.editProfileSaveBtn, false));
  }

  function resetEditProfile() {
    if (!state.profile) return;
    controls.editFullName.value = state.profile.fullName || '';
    controls.editPreferredName.value = state.profile.preferredName || '';
    controls.editProfileError.classList.add('d-none');
  }

  async function handleChangePassword() {
    controls.changePasswordError.classList.add('d-none');
    const currentPassword = controls.currentPassword.value;
    const newPassword = controls.newPassword.value;
    const confirmPassword = controls.confirmNewPassword.value;
    if (newPassword !== confirmPassword) {
      controls.changePasswordError.textContent = 'New passwords do not match.';
      controls.changePasswordError.classList.remove('d-none');
      return;
    }
    try {
      const captchaToken = await recaptcha.getToken('change_password');
      await modalLock.withLock({ modal: modals.changePassword, action: 'change-password' }, async () => {
        setButtonLoading(controls.changePasswordSaveBtn, true);
        await fetchJson('/users/me/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword, captchaToken })
        });
        controls.currentPassword.value = '';
        controls.newPassword.value = '';
        controls.confirmNewPassword.value = '';
        if (modalManager) await modalManager.hideModal(modals.changePassword);
      });
    } catch (err) {
      controls.changePasswordError.textContent = err.message;
      controls.changePasswordError.classList.remove('d-none');
    } finally {
      setButtonLoading(controls.changePasswordSaveBtn, false);
    }
  }

  async function handleChangeEmail() {
    controls.changeEmailError.classList.add('d-none');
    controls.changeEmailSuccess.classList.add('d-none');
    const newEmail = controls.newEmail.value.trim();
    if (!newEmail) {
      controls.changeEmailError.textContent = 'Please enter a new email address.';
      controls.changeEmailError.classList.remove('d-none');
      return;
    }
    await modalLock.withLock({ modal: modals.changeEmail, action: 'change-email' }, async () => {
      setButtonLoading(controls.changeEmailSaveBtn, true);
      await fetchJson('/users/me/request-email-change', {
        method: 'POST',
        body: JSON.stringify({ newEmail })
      });
      controls.changeEmailSuccess.classList.remove('d-none');
    }).catch((err) => {
      controls.changeEmailError.textContent = err.message;
      controls.changeEmailError.classList.remove('d-none');
    }).finally(() => setButtonLoading(controls.changeEmailSaveBtn, false));
  }

  function openRevokeSession(fingerprint) {
    const session = state.sessions.find((s) => s.fingerprint === fingerprint);
    if (!session) return;
    state.revokeSessionTarget = session;
    controls.revokeSessionDetail.textContent = `${session.device || 'Unknown device'} • ${formatDate(session.createdAt)}`;
    controls.revokeSessionError.classList.add('d-none');
    modalManager?.showModal(modals.revokeSession);
  }

  async function handleRevokeSession() {
    const target = state.revokeSessionTarget;
    if (!target) return;
    await modalLock.withLock({ modal: modals.revokeSession, action: 'revoke-session' }, async () => {
      setButtonLoading(controls.confirmRevokeSessionBtn, true);
      await fetchJson(`/users/me/sessions/${encodeURIComponent(target.fingerprint)}`, { method: 'DELETE' });
      await loadSessions();
      state.revokeSessionTarget = null;
      if (modalManager) await modalManager.hideModal(modals.revokeSession);
    }).catch((err) => {
      controls.revokeSessionError.textContent = err.message;
      controls.revokeSessionError.classList.remove('d-none');
    }).finally(() => setButtonLoading(controls.confirmRevokeSessionBtn, false));
  }

  async function handleLogoutAll() {
    setButtonLoading(elements.logoutAllBtn, true);
    try {
      await fetchJson('/auth/logout', { method: 'POST', body: JSON.stringify({ allDevices: true }) });
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = 'https://bookproject.fjnel.co.za?action=login';
    } catch (err) {
      alert(err.message);
    } finally {
      setButtonLoading(elements.logoutAllBtn, false);
    }
  }

  async function handleCreateApiKey() {
    controls.createApiKeyError.classList.add('d-none');
    controls.apiKeySecretWrap.classList.add('d-none');
    const name = controls.apiKeyName.value.trim();
    const expiresAt = controls.apiKeyExpiresAt.value ? new Date(controls.apiKeyExpiresAt.value).toISOString() : null;
    await modalLock.withLock({ modal: modals.createApiKey, action: 'create-api-key' }, async () => {
      setButtonLoading(controls.createApiKeySaveBtn, true);
      const data = await fetchJson('/users/me/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name, expiresAt })
      });
      const secret = data.secret || data.apiKey || data.key;
      if (secret) {
        controls.apiKeySecret.textContent = secret;
        controls.apiKeySecretWrap.classList.remove('d-none');
      }
      await loadApiKeys();
    }).catch((err) => {
      controls.createApiKeyError.textContent = err.message;
      controls.createApiKeyError.classList.remove('d-none');
    }).finally(() => setButtonLoading(controls.createApiKeySaveBtn, false));
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
      controls.revokeApiKeyError.textContent = err.message;
      controls.revokeApiKeyError.classList.remove('d-none');
    }).finally(() => setButtonLoading(controls.confirmRevokeApiKeyBtn, false));
  }

  async function handleDisableAccount() {
    controls.disableAccountError.classList.add('d-none');
    await modalLock.withLock({ modal: modals.disableAccount, action: 'disable-account' }, async () => {
      setButtonLoading(controls.confirmDisableAccountBtn, true);
      await fetchJson('/users/me', { method: 'DELETE' });
      alert('Disable request sent. Check your email for confirmation.');
      if (modalManager) await modalManager.hideModal(modals.disableAccount);
    }).catch((err) => {
      controls.disableAccountError.textContent = err.message;
      controls.disableAccountError.classList.remove('d-none');
    }).finally(() => setButtonLoading(controls.confirmDisableAccountBtn, false));
  }

  async function handleDeleteAccount() {
    controls.deleteAccountError.classList.add('d-none');
    await modalLock.withLock({ modal: modals.deleteAccount, action: 'delete-account' }, async () => {
      setButtonLoading(controls.confirmDeleteAccountBtn, true);
      await fetchJson('/users/me/request-account-deletion', { method: 'POST' });
      alert('Deletion request sent. Check your email to confirm.');
      if (modalManager) await modalManager.hideModal(modals.deleteAccount);
    }).catch((err) => {
      controls.deleteAccountError.textContent = err.message;
      controls.deleteAccountError.classList.remove('d-none');
    }).finally(() => setButtonLoading(controls.confirmDeleteAccountBtn, false));
  }

  function bindEvents() {
    elements.refreshStatsBtn?.addEventListener('click', loadStats);
    elements.editProfileBtn?.addEventListener('click', () => modalManager?.showModal(modals.editProfile));
    controls.editProfileSaveBtn?.addEventListener('click', handleEditProfileSave);
    controls.editProfileResetBtn?.addEventListener('click', resetEditProfile);

    elements.changePasswordBtn?.addEventListener('click', () => modalManager?.showModal(modals.changePassword));
    controls.changePasswordSaveBtn?.addEventListener('click', handleChangePassword);

    elements.changeEmailBtn?.addEventListener('click', () => modalManager?.showModal(modals.changeEmail));
    controls.changeEmailSaveBtn?.addEventListener('click', handleChangeEmail);

    elements.refreshSessionsBtn?.addEventListener('click', loadSessions);
    elements.sessionsTable?.addEventListener('click', (event) => {
      const btn = event.target.closest('.js-revoke-session');
      if (btn) {
        openRevokeSession(btn.dataset.fp);
      }
    });
    controls.confirmRevokeSessionBtn?.addEventListener('click', handleRevokeSession);
    elements.logoutAllBtn?.addEventListener('click', handleLogoutAll);

    elements.refreshApiKeysBtn?.addEventListener('click', loadApiKeys);
    elements.createApiKeyBtn?.addEventListener('click', () => {
      controls.createApiKeyError.classList.add('d-none');
      controls.apiKeySecretWrap.classList.add('d-none');
      controls.apiKeyName.value = '';
      controls.apiKeyExpiresAt.value = '';
      modalManager?.showModal(modals.createApiKey);
    });
    controls.createApiKeySaveBtn?.addEventListener('click', handleCreateApiKey);
    elements.apiKeysTable?.addEventListener('click', (event) => {
      const btn = event.target.closest('.js-revoke-api-key');
      if (btn) openRevokeApiKey(btn.dataset.id);
    });
    controls.confirmRevokeApiKeyBtn?.addEventListener('click', handleRevokeApiKey);
    controls.copyApiKeySecretBtn?.addEventListener('click', async () => {
      const secret = controls.apiKeySecret.textContent || '';
      if (!secret) return;
      try { await navigator.clipboard.writeText(secret); } catch (e) { console.warn('Clipboard copy failed', e); }
    });

    elements.disableAccountBtn?.addEventListener('click', () => modalManager?.showModal(modals.disableAccount));
    controls.confirmDisableAccountBtn?.addEventListener('click', handleDisableAccount);

    elements.deleteAccountBtn?.addEventListener('click', () => modalManager?.showModal(modals.deleteAccount));
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

  bindEvents();
  bootstrap();
})();
