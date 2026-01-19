(function () {
  const log = (...args) => console.log('[Admin]', ...args);
  const warn = (...args) => console.warn('[Admin]', ...args);
  const errorLog = (...args) => console.error('[Admin]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const dom = {
    adminRolePill: document.getElementById('adminRolePill'),
    adminStatusPill: document.getElementById('adminStatusPill'),
    adminAccessAlert: document.getElementById('adminAccessAlert'),
    statusBadge: document.getElementById('statusBadge'),
    statusAlert: document.getElementById('statusAlert'),
    apiStatusText: document.getElementById('apiStatusText'),
    dbLatencyText: document.getElementById('dbLatencyText'),
    queueText: document.getElementById('queueText'),
    statusUpdatedAt: document.getElementById('statusUpdatedAt'),
    refreshStatusBtn: document.getElementById('refreshStatusBtn'),
    adminSectionNav: document.getElementById('adminSectionNav'),
    sections: document.querySelectorAll('.admin-section'),
    userSearchInput: document.getElementById('userSearchInput'),
    userRoleFilter: document.getElementById('userRoleFilter'),
    userVerifiedFilter: document.getElementById('userVerifiedFilter'),
    userDisabledFilter: document.getElementById('userDisabledFilter'),
    usersPerPage: document.getElementById('usersPerPage'),
    refreshUsersBtn: document.getElementById('refreshUsersBtn'),
    usersTbody: document.getElementById('usersTbody'),
    usersAlert: document.getElementById('usersAlert'),
    usersPrevBtn: document.getElementById('usersPrevBtn'),
    usersNextBtn: document.getElementById('usersNextBtn'),
    usersSummary: document.getElementById('usersSummary'),
    openCreateUserBtn: document.getElementById('openCreateUserBtn'),
    openCreateLanguageBtn: document.getElementById('openCreateLanguageBtn'),
    openCreateLanguageBtnSecondary: document.getElementById('openCreateLanguageBtnSecondary'),
    languagesTbody: document.getElementById('languagesTbody'),
    languagesAlert: document.getElementById('languagesAlert'),
    createUserModal: document.getElementById('createUserModal'),
    createUserAlert: document.getElementById('createUserAlert'),
    createUserSubmit: document.getElementById('createUserSubmit'),
    createFullName: document.getElementById('createFullName'),
    createPreferredName: document.getElementById('createPreferredName'),
    createEmail: document.getElementById('createEmail'),
    createRole: document.getElementById('createRole'),
    createPassword: document.getElementById('createPassword'),
    createNoPassword: document.getElementById('createNoPassword'),
    createFullNameHelp: document.getElementById('createFullNameHelp'),
    createPreferredNameHelp: document.getElementById('createPreferredNameHelp'),
    createEmailHelp: document.getElementById('createEmailHelp'),
    createPasswordHelp: document.getElementById('createPasswordHelp'),
    editUserModal: document.getElementById('editUserModal'),
    editUserAlert: document.getElementById('editUserAlert'),
    editUserId: document.getElementById('editUserId'),
    editFullName: document.getElementById('editFullName'),
    editPreferredName: document.getElementById('editPreferredName'),
    editEmail: document.getElementById('editEmail'),
    editRole: document.getElementById('editRole'),
    editFullNameHelp: document.getElementById('editFullNameHelp'),
    editPreferredNameHelp: document.getElementById('editPreferredNameHelp'),
    editEmailHelp: document.getElementById('editEmailHelp'),
    editUserSubmit: document.getElementById('editUserSubmit'),
    confirmActionModal: document.getElementById('confirmActionModal'),
    confirmActionTitle: document.getElementById('confirmActionTitle'),
    confirmActionMessage: document.getElementById('confirmActionMessage'),
    confirmActionReasonWrap: document.getElementById('confirmActionReasonWrap'),
    confirmActionReason: document.getElementById('confirmActionReason'),
    confirmActionReasonHelp: document.getElementById('confirmActionReasonHelp'),
    confirmActionEmailWrap: document.getElementById('confirmActionEmailWrap'),
    confirmActionEmail: document.getElementById('confirmActionEmail'),
    confirmActionEmailHelp: document.getElementById('confirmActionEmailHelp'),
    confirmActionInputWrap: document.getElementById('confirmActionInputWrap'),
    confirmActionInput: document.getElementById('confirmActionInput'),
    confirmActionInputHelp: document.getElementById('confirmActionInputHelp'),
    confirmActionAlert: document.getElementById('confirmActionAlert'),
    confirmActionSubmit: document.getElementById('confirmActionSubmit'),
    sessionsModal: document.getElementById('sessionsModal'),
    sessionsModalTitle: document.getElementById('sessionsModalTitle'),
    sessionsTbody: document.getElementById('sessionsTbody'),
    sessionsAlert: document.getElementById('sessionsAlert'),
    sessionsForceLogoutBtn: document.getElementById('sessionsForceLogoutBtn'),
    languageModal: document.getElementById('languageModal'),
    languageModalTitle: document.getElementById('languageModalTitle'),
    languageModalAlert: document.getElementById('languageModalAlert'),
    languageModalId: document.getElementById('languageModalId'),
    languageModalName: document.getElementById('languageModalName'),
    languageModalNameHelp: document.getElementById('languageModalNameHelp'),
    languageModalSubmit: document.getElementById('languageModalSubmit'),
    languageDeleteModal: document.getElementById('languageDeleteModal'),
    languageDeleteAlert: document.getElementById('languageDeleteAlert'),
    languageDeleteInput: document.getElementById('languageDeleteInput'),
    languageDeleteHelp: document.getElementById('languageDeleteHelp'),
    languageDeleteSubmit: document.getElementById('languageDeleteSubmit')
  };

  const state = {
    users: [],
    usersPage: 1,
    usersLimit: 25,
    usersHasNext: false,
    currentSection: 'overview',
    currentEditingUser: null,
    confirmActionConfig: null,
    sessionsUser: null,
    languages: [],
    actionCooldowns: new Map()
  };

  const johannesburgFormatter = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const debounce = (fn, delay = 400) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function formatDateTime(value) {
    if (!value) return '—';
    try {
      return johannesburgFormatter.format(new Date(value));
    } catch (err) {
      warn('Failed to format date', err);
      return String(value);
    }
  }

  function setAdminNavVisibility(isAdmin) {
    document.querySelectorAll('.js-admin-nav').forEach((el) => {
      el.classList.toggle('d-none', !isAdmin);
    });
  }

  function parseUserProfile() {
    try {
      const raw = localStorage.getItem('userProfile');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      warn('Unable to parse user profile', err);
      return null;
    }
  }

  function setBadge(status) {
    if (!dom.statusBadge) return;
    const map = {
      ok: { text: 'Healthy', className: 'text-bg-success' },
      degraded: { text: 'Degraded', className: 'text-bg-warning' },
      error: { text: 'Error', className: 'text-bg-danger' },
      checking: { text: 'Checking…', className: 'text-bg-secondary' }
    };
    const next = map[status] || map.checking;
    dom.statusBadge.textContent = next.text;
    dom.statusBadge.className = `badge ${next.className}`;
  }

  function showAlert(el, message) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('d-none');
  }

  function hideAlert(el) {
    if (!el) return;
    el.classList.add('d-none');
    el.textContent = '';
  }

  async function parseResponse(response) {
    let body = {};
    try {
      body = await response.json();
    } catch (err) {
      warn('Failed to parse response JSON', err);
    }

    if (response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      await window.rateLimitGuard.showModal();
      throw new Error('Rate limited');
    }

    if (response.status === 401) {
      if (typeof window.showSessionExpiredModal === 'function') {
        window.showSessionExpiredModal();
      }
      throw new Error('Not authorized');
    }

    if (!response.ok) {
      const errors = Array.isArray(body?.errors) ? body.errors.filter(Boolean).join(' ') : '';
      const message = body?.message || 'Request failed.';
      throw new Error(errors ? `${message} ${errors}` : message);
    }

    return body?.data ?? body;
  }

  function updateRolePill(profile) {
    if (!dom.adminRolePill) return;
    dom.adminRolePill.textContent = `Role: ${profile?.role || 'unknown'}`;
  }

  function updateStatusPill(text) {
    if (!dom.adminStatusPill) return;
    dom.adminStatusPill.textContent = `Status: ${text}`;
  }

  function renderStatus(payload) {
    const dbLatency = payload?.db?.latencyMs;
    const queueStats = payload?.emailQueue;

    setBadge('ok');
    if (dom.apiStatusText) dom.apiStatusText.textContent = 'Online';
    if (dom.dbLatencyText) dom.dbLatencyText.textContent = Number.isFinite(dbLatency) ? `${dbLatency} ms` : '—';
    if (dom.queueText) dom.queueText.textContent = queueStats?.queueLength != null ? `${queueStats.queueLength} queued` : '—';
    if (dom.statusUpdatedAt) dom.statusUpdatedAt.textContent = `Last checked ${formatDateTime(Date.now())}`;
    updateStatusPill('Ready');
  }

  function renderStatusError(message) {
    setBadge('error');
    if (dom.apiStatusText) dom.apiStatusText.textContent = 'Unavailable';
    if (dom.dbLatencyText) dom.dbLatencyText.textContent = '—';
    if (dom.queueText) dom.queueText.textContent = '—';
    updateStatusPill('Error');
    showAlert(dom.statusAlert, message);
  }

  async function fetchStatus() {
    hideAlert(dom.statusAlert);
    setBadge('checking');
    updateStatusPill('Checking…');
    try {
      const response = await apiFetch('/status', { method: 'GET' });
      const data = await parseResponse(response);
      renderStatus(data);
    } catch (err) {
      errorLog('Failed to fetch status', err);
      renderStatusError(err.message || 'Unable to fetch status.');
      throw err;
    }
  }

  function getUserFilters() {
    const search = dom.userSearchInput?.value?.trim() || '';
    const role = dom.userRoleFilter?.value || '';
    return { search, role };
  }

  function renderUsers(users) {
    state.users = Array.isArray(users) ? users : [];
    if (!dom.usersTbody) return;
    if (!state.users.length) {
      dom.usersTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No users found.</td></tr>';
      return;
    }

    const rows = state.users.map((user) => {
      const name = user.preferredName || user.fullName || '—';
      const verified = user.isVerified ? '<span class="badge text-bg-success">Yes</span>' : '<span class="badge text-bg-secondary">No</span>';
      const disabled = user.isDisabled ? '<span class="badge text-bg-danger">Yes</span>' : '<span class="badge text-bg-success">No</span>';
      const disableLabel = user.isDisabled ? 'Enable' : 'Disable';
      const verifyLabel = user.isVerified ? 'Unverify' : 'Verify';
      const verificationActionClass = user.isVerified ? 'js-unverify-user' : 'js-verify-user';
      return `
        <tr data-user-id="${user.id}">
          <td>${user.id ?? '—'}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(user.email || '—')}</td>
          <td><span class="badge ${user.role === 'admin' ? 'text-bg-primary' : 'text-bg-secondary'}">${escapeHtml(user.role || 'user')}</span></td>
          <td>${verified}</td>
          <td>${disabled}</td>
          <td>${formatDateTime(user.lastLogin)}</td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary js-edit-user" type="button" data-user-id="${user.id}">Edit</button>
              <button class="btn btn-outline-secondary js-view-sessions" type="button" data-user-id="${user.id}">Sessions</button>
              <button class="btn btn-outline-${user.isDisabled ? 'success' : 'warning'} js-toggle-disable" type="button" data-user-id="${user.id}" data-disabled="${user.isDisabled}">${disableLabel}</button>
              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">More</button>
                <div class="dropdown-menu dropdown-menu-end">
                  <button class="dropdown-item ${verificationActionClass}" type="button" data-user-id="${user.id}">${verifyLabel}</button>
                  <button class="dropdown-item js-send-verification" type="button" data-user-id="${user.id}">Send verification email</button>
                  <button class="dropdown-item js-reset-password" type="button" data-user-id="${user.id}">Reset password</button>
                  <button class="dropdown-item js-force-logout" type="button" data-user-id="${user.id}">Force logout</button>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item text-danger js-delete-user" type="button" data-user-id="${user.id}">Delete</button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    dom.usersTbody.innerHTML = rows;
  }

  async function fetchUsers({ search = '', role = '' } = {}) {
    hideAlert(dom.usersAlert);
    if (dom.usersTbody) {
      dom.usersTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">Loading users…</td></tr>';
    }

    const params = new URLSearchParams();
    params.set('limit', String(state.usersLimit));
    params.set('offset', String((state.usersPage - 1) * state.usersLimit));
    params.set('order', 'asc');
    params.set('sortBy', 'email');
    if (search) params.set('filterEmail', search);
    if (role) params.set('filterRole', role);
    const verified = dom.userVerifiedFilter?.value;
    const disabled = dom.userDisabledFilter?.value;
    if (verified) params.set('filterIsVerified', verified);
    if (disabled) params.set('filterIsDisabled', disabled);

    try {
      const response = await apiFetch(`/admin/users?${params.toString()}`, { method: 'GET' });
      const data = await parseResponse(response);
      const received = Array.isArray(data?.users) ? data.users.length : 0;
      state.usersHasNext = received === state.usersLimit;
      updateUsersSummary(received);
      renderUsersPagination();
      renderUsers(data?.users || []);
    } catch (err) {
      errorLog('Failed to fetch users', err);
      showAlert(dom.usersAlert, err.message || 'Unable to load users.');
      throw err;
    }
  }

  function renderUsersPagination() {
    if (dom.usersPrevBtn) dom.usersPrevBtn.disabled = state.usersPage <= 1;
    if (dom.usersNextBtn) dom.usersNextBtn.disabled = !state.usersHasNext;
  }

  function updateUsersSummary(receivedCount) {
    if (!dom.usersSummary) return;
    const start = ((state.usersPage - 1) * state.usersLimit) + (receivedCount ? 1 : 0);
    const end = ((state.usersPage - 1) * state.usersLimit) + receivedCount;
    dom.usersSummary.textContent = receivedCount ? `Showing ${start}–${end} (page ${state.usersPage})` : 'No users to show';
  }

  function renderLanguages(languages) {
    state.languages = Array.isArray(languages) ? languages : state.languages;
    if (!dom.languagesTbody) return;
    if (!state.languages.length) {
      dom.languagesTbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No languages found.</td></tr>';
      return;
    }

    const rows = state.languages.map((lang) => `
      <tr data-language-id="${lang.id}">
        <td>${lang.id ?? '—'}</td>
        <td>${escapeHtml(lang.name || '—')}</td>
        <td>${formatDateTime(lang.createdAt)}</td>
        <td>${formatDateTime(lang.updatedAt)}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary js-edit-language" type="button" data-language-id="${lang.id}">Edit</button>
            <button class="btn btn-outline-danger js-delete-language" type="button" data-language-id="${lang.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    dom.languagesTbody.innerHTML = rows;
  }

  async function fetchLanguages() {
    hideAlert(dom.languagesAlert);
    if (dom.languagesTbody) dom.languagesTbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Loading languages…</td></tr>';
    try {
      const response = await apiFetch('/languages', { method: 'GET' });
      const data = await parseResponse(response);
      renderLanguages(data?.languages || []);
    } catch (err) {
      errorLog('Failed to fetch languages', err);
      showAlert(dom.languagesAlert, err.message || 'Unable to load languages.');
      throw err;
    }
  }

  function setSection(section) {
    state.currentSection = section;
    dom.sections.forEach((node) => {
      const isActive = node.dataset.sectionContent === section;
      node.classList.toggle('d-none', !isActive);
    });
    dom.adminSectionNav?.querySelectorAll('button[data-section]')?.forEach((btn) => {
      const isActive = btn.dataset.section === section;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    window.localStorage.setItem('adminSection', section);
  }

  function resolveSectionFromHash() {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('users')) return 'users';
    if (hash.includes('language')) return 'languages';
    return null;
  }

  function restoreSection() {
    const hashSection = resolveSectionFromHash();
    if (hashSection) {
      setSection(hashSection);
      return;
    }
    const stored = window.localStorage.getItem('adminSection');
    const target = ['overview', 'users', 'languages'].includes(stored) ? stored : 'overview';
    setSection(target);
  }

  function validateEmail(value) {
    if (!value) return 'Email is required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'Enter a valid email.';
    return '';
  }

  function validateName(value) {
    if (!value) return 'Full name is required.';
    if (value.trim().length < 2) return 'Name must be at least 2 characters.';
    return '';
  }

  function validatePassword(value, allowEmpty) {
    if (allowEmpty && !value) return '';
    if (value && value.length < 8) return 'Password must be at least 8 characters.';
    return '';
  }

  function toggleSubmit(button, enabled) {
    if (button) button.disabled = !enabled;
  }

  function resetCreateUserForm() {
    hideAlert(dom.createUserAlert);
    dom.createFullName.value = '';
    dom.createPreferredName.value = '';
    dom.createEmail.value = '';
    dom.createRole.value = 'user';
    dom.createPassword.value = '';
    dom.createNoPassword.checked = false;
    dom.createFullNameHelp.textContent = '';
    dom.createPreferredNameHelp.textContent = '';
    dom.createEmailHelp.textContent = '';
    dom.createPasswordHelp.textContent = '';
    toggleSubmit(dom.createUserSubmit, false);
  }

  function openCreateUserModal() {
    resetCreateUserForm();
    const instance = bootstrap.Modal.getOrCreateInstance(dom.createUserModal);
    instance.show();
  }

  function validateCreateUserForm() {
    const fullName = dom.createFullName.value.trim();
    const preferredName = dom.createPreferredName.value.trim();
    const email = dom.createEmail.value.trim();
    const password = dom.createPassword.value;
    const noPassword = dom.createNoPassword.checked;

    const errors = {
      fullName: validateName(fullName),
      preferredName: '',
      email: validateEmail(email),
      password: validatePassword(password, noPassword)
    };

    dom.createFullNameHelp.textContent = errors.fullName;
    dom.createPreferredNameHelp.textContent = errors.preferredName;
    dom.createEmailHelp.textContent = errors.email;
    dom.createPasswordHelp.textContent = errors.password;

    const valid = !errors.fullName && !errors.email && !errors.password && (password || noPassword);
    toggleSubmit(dom.createUserSubmit, valid);
    return valid;
  }

  async function submitCreateUser() {
    if (!validateCreateUserForm()) return;
    hideAlert(dom.createUserAlert);
    toggleSubmit(dom.createUserSubmit, false);
    const body = {
      fullName: dom.createFullName.value.trim(),
      preferredName: dom.createPreferredName.value.trim() || undefined,
      email: dom.createEmail.value.trim(),
      role: dom.createRole.value || 'user'
    };
    if (dom.createNoPassword.checked) {
      body.noPassword = true;
    } else {
      body.password = dom.createPassword.value;
    }

    try {
      const response = await apiFetch('/admin/users', { method: 'POST', body });
      await parseResponse(response);
      bootstrap.Modal.getInstance(dom.createUserModal)?.hide();
      await fetchUsers(getUserFilters());
    } catch (err) {
      showAlert(dom.createUserAlert, err.message || 'Unable to create user.');
    } finally {
      toggleSubmit(dom.createUserSubmit, true);
    }
  }

  function openEditUserModal(userId) {
    const user = state.users.find((u) => u.id === userId);
    if (!user) return;
    state.currentEditingUser = user;
    hideAlert(dom.editUserAlert);
    dom.editUserId.value = user.id;
    dom.editFullName.value = user.fullName || '';
    dom.editPreferredName.value = user.preferredName || '';
    dom.editEmail.value = user.email || '';
    dom.editRole.value = user.role || 'user';
    dom.editFullNameHelp.textContent = '';
    dom.editPreferredNameHelp.textContent = '';
    dom.editEmailHelp.textContent = '';
    toggleSubmit(dom.editUserSubmit, false);
    const instance = bootstrap.Modal.getOrCreateInstance(dom.editUserModal);
    instance.show();
  }

  function validateEditUserForm() {
    const fullName = dom.editFullName.value.trim();
    const preferredName = dom.editPreferredName.value.trim();
    const email = dom.editEmail.value.trim();
    const role = dom.editRole.value;
    const errors = {
      fullName: fullName ? '' : 'Full name cannot be empty.',
      preferredName: '',
      email: validateEmail(email)
    };
    dom.editFullNameHelp.textContent = errors.fullName;
    dom.editPreferredNameHelp.textContent = errors.preferredName;
    dom.editEmailHelp.textContent = errors.email;

    const changed = fullName !== (state.currentEditingUser?.fullName || '')
      || preferredName !== (state.currentEditingUser?.preferredName || '')
      || email !== (state.currentEditingUser?.email || '')
      || role !== (state.currentEditingUser?.role || 'user');

    const valid = !errors.fullName && !errors.email && changed;
    toggleSubmit(dom.editUserSubmit, valid);
    return { valid, fullName, preferredName, email, role };
  }

  async function submitEditUser() {
    const { valid, fullName, preferredName, email, role } = validateEditUserForm();
    if (!valid || !state.currentEditingUser) return;
    hideAlert(dom.editUserAlert);
    toggleSubmit(dom.editUserSubmit, false);
    const body = { id: state.currentEditingUser.id };
    if (fullName !== state.currentEditingUser.fullName) body.fullName = fullName;
    if (preferredName !== (state.currentEditingUser.preferredName || '')) body.preferredName = preferredName || undefined;
    if (email !== state.currentEditingUser.email) body.email = email;
    if (role !== state.currentEditingUser.role) body.role = role;

    try {
      const response = await apiFetch(`/admin/users/${state.currentEditingUser.id}`, { method: 'PUT', body });
      await parseResponse(response);
      bootstrap.Modal.getInstance(dom.editUserModal)?.hide();
      await fetchUsers(getUserFilters());
    } catch (err) {
      showAlert(dom.editUserAlert, err.message || 'Unable to save user.');
    } finally {
      toggleSubmit(dom.editUserSubmit, true);
    }
  }

  function openConfirmAction(config) {
    state.confirmActionConfig = config;
    hideAlert(dom.confirmActionAlert);
    dom.confirmActionTitle.textContent = config.title || 'Confirm action';
    dom.confirmActionMessage.textContent = config.message || 'Are you sure?';
    dom.confirmActionReasonWrap.classList.toggle('d-none', !config.reasonRequired);
    dom.confirmActionEmailWrap.classList.toggle('d-none', !config.emailRequired);
    dom.confirmActionInputWrap.classList.toggle('d-none', !config.confirmText);
    dom.confirmActionReason.value = '';
    dom.confirmActionEmail.value = config.prefillEmail || '';
    dom.confirmActionInput.value = '';
    dom.confirmActionInput.placeholder = config.confirmText || '';
    dom.confirmActionReasonHelp.textContent = '';
    dom.confirmActionEmailHelp.textContent = '';
    dom.confirmActionInputHelp.textContent = '';
    toggleSubmit(dom.confirmActionSubmit, !config.confirmText && !config.reasonRequired && !config.emailRequired);
    const instance = bootstrap.Modal.getOrCreateInstance(dom.confirmActionModal);
    instance.show();
  }

  function validateConfirmAction() {
    const cfg = state.confirmActionConfig;
    if (!cfg) return false;
    let valid = true;
    if (cfg.reasonRequired) {
      const reason = dom.confirmActionReason.value.trim();
      dom.confirmActionReasonHelp.textContent = reason ? '' : 'Reason is required.';
      valid = valid && Boolean(reason);
    }
    if (cfg.emailRequired) {
      const email = dom.confirmActionEmail.value.trim();
      const emailError = validateEmail(email);
      dom.confirmActionEmailHelp.textContent = emailError;
      valid = valid && !emailError;
    }
    if (cfg.confirmText) {
      const value = dom.confirmActionInput.value.trim();
      const match = value.toUpperCase() === cfg.confirmText.toUpperCase();
      dom.confirmActionInputHelp.textContent = match ? '' : `Type ${cfg.confirmText} to continue.`;
      valid = valid && match;
    }
    toggleSubmit(dom.confirmActionSubmit, valid);
    return valid;
  }

  async function handleConfirmActionSubmit() {
    if (!validateConfirmAction()) return;
    const cfg = state.confirmActionConfig;
    if (!cfg) return;
    toggleSubmit(dom.confirmActionSubmit, false);
    hideAlert(dom.confirmActionAlert);

    const body = { id: cfg.userId };
    if (cfg.reasonRequired) body.reason = dom.confirmActionReason.value.trim();
    if (cfg.emailRequired) body.userToBeDeletedEmail = dom.confirmActionEmail.value.trim();
    if (cfg.confirmFlag) body.confirm = true;

    try {
      log('Submitting admin action', { title: cfg.title, userId: cfg.userId, url: cfg.url });
      const response = await apiFetch(cfg.url, { method: cfg.method, body });
      await parseResponse(response);
      if (cfg.cooldownKey) startActionCooldown(cfg.cooldownKey);
      bootstrap.Modal.getInstance(dom.confirmActionModal)?.hide();
      if (cfg.onSuccess === 'users') await fetchUsers(getUserFilters());
      if (cfg.onSuccess === 'sessions') await loadSessions(cfg.userId);
    } catch (err) {
      showAlert(dom.confirmActionAlert, err.message || 'Request failed.');
    } finally {
      toggleSubmit(dom.confirmActionSubmit, true);
    }
  }

  async function openSessionsModal(userId) {
    const user = state.users.find((u) => u.id === userId);
    if (!user) return;
    state.sessionsUser = user;
    dom.sessionsModalTitle.textContent = `Sessions · ${user.email || user.fullName || user.id}`;
    dom.sessionsTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Loading sessions…</td></tr>';
    hideAlert(dom.sessionsAlert);
    bootstrap.Modal.getOrCreateInstance(dom.sessionsModal).show();
    await loadSessions(userId);
  }

  async function loadSessions(userId) {
    try {
      const response = await apiFetch(`/admin/users/${userId}/sessions`, { method: 'POST', body: { id: userId } });
      const data = await parseResponse(response);
      const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
      if (!sessions.length) {
        dom.sessionsTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No active sessions.</td></tr>';
        return;
      }
      dom.sessionsTbody.innerHTML = sessions.map((session) => `
        <tr>
          <td>${escapeHtml(session.tokenFingerprint || '—')}</td>
          <td>${formatDateTime(session.tokenIssued)}</td>
          <td>${formatDateTime(session.tokenExpire)}</td>
        </tr>
      `).join('');
    } catch (err) {
      showAlert(dom.sessionsAlert, err.message || 'Unable to load sessions.');
    }
  }

  function startActionCooldown(key, ms = 60000) {
    const now = Date.now();
    state.actionCooldowns.set(key, now + ms);
  }

  function isCoolingDown(key) {
    const until = state.actionCooldowns.get(key);
    return until && until > Date.now();
  }

  function handleUserActionClick(event) {
    const btn = event.target.closest('button[data-user-id]');
    if (!btn) return;
    const userId = Number(btn.dataset.userId);
    if (!Number.isInteger(userId)) return;

    if (btn.classList.contains('js-edit-user')) {
      openEditUserModal(userId);
      return;
    }

    if (btn.classList.contains('js-view-sessions')) {
      openSessionsModal(userId);
      return;
    }

    if (btn.classList.contains('js-toggle-disable')) {
      const isDisabled = btn.dataset.disabled === 'true';
      openConfirmAction({
        title: `${isDisabled ? 'Enable' : 'Disable'} user`,
        message: isDisabled ? 'Re-enable this account and allow logins?' : 'Disable this account and revoke active sessions?',
        userId,
        url: isDisabled ? `/admin/users/${userId}/enable` : `/admin/users/${userId}`,
        method: isDisabled ? 'POST' : 'DELETE',
        confirmText: isDisabled ? '' : 'DISABLE',
        reasonRequired: false,
        emailRequired: false,
        onSuccess: 'users'
      });
      return;
    }

    if (btn.classList.contains('js-verify-user')) {
      openConfirmAction({
        title: 'Verify user',
        message: 'Mark this user as verified? Provide a short reason.',
        userId,
        url: `/admin/users/${userId}/verify`,
        method: 'POST',
        reasonRequired: true,
        onSuccess: 'users'
      });
      return;
    }

    if (btn.classList.contains('js-unverify-user')) {
      openConfirmAction({
        title: 'Unverify user',
        message: 'Unverify this user? Provide a reason for audit.',
        userId,
        url: `/admin/users/${userId}/unverify`,
        method: 'POST',
        reasonRequired: true,
        onSuccess: 'users'
      });
      return;
    }

    if (btn.classList.contains('js-send-verification')) {
      const cooldownKey = `send-verification-${userId}`;
      if (isCoolingDown(cooldownKey)) {
        showAlert(dom.usersAlert, 'Please wait before sending another verification email.');
        return;
      }
      openConfirmAction({
        title: 'Send verification email',
        message: 'Send a new verification email to this user?',
        userId,
        url: `/admin/users/${userId}/send-verification-email`,
        method: 'POST',
        onSuccess: 'users'
      });
      state.confirmActionConfig.cooldownKey = cooldownKey;
      return;
    }

    if (btn.classList.contains('js-reset-password')) {
      const cooldownKey = `reset-password-${userId}`;
      if (isCoolingDown(cooldownKey)) {
        showAlert(dom.usersAlert, 'Password reset email already sent recently.');
        return;
      }
      openConfirmAction({
        title: 'Send password reset',
        message: 'Send a password reset email to this user?',
        userId,
        url: `/admin/users/${userId}/reset-password`,
        method: 'POST',
        onSuccess: 'users'
      });
      state.confirmActionConfig.cooldownKey = cooldownKey;
      return;
    }

    if (btn.classList.contains('js-force-logout')) {
      openConfirmAction({
        title: 'Force logout',
        message: 'Revoke all sessions for this user?',
        userId,
        url: `/admin/users/${userId}/force-logout`,
        method: 'POST',
        onSuccess: 'users'
      });
      return;
    }

    if (btn.classList.contains('js-delete-user')) {
      const user = state.users.find((u) => u.id === userId);
      openConfirmAction({
        title: 'Delete user',
        message: 'This action is permanent. Provide a reason and confirmation to continue.',
        userId,
        url: `/admin/users/${userId}/handle-account-deletion`,
        method: 'POST',
        reasonRequired: true,
        emailRequired: true,
        confirmText: 'DELETE',
        confirmFlag: true,
        prefillEmail: user?.email || '',
        onSuccess: 'users'
      });
    }
  }

  function handleConfirmActionModalInput() {
    validateConfirmAction();
  }

  function handleCreateUserInput() {
    validateCreateUserForm();
  }

  function handleEditUserInput() {
    validateEditUserForm();
  }

  async function handleSessionsForceLogout() {
    if (!state.sessionsUser) return;
    openConfirmAction({
      title: 'Force logout all sessions',
      message: 'Revoke all active sessions for this user?',
      userId: state.sessionsUser.id,
      url: `/admin/users/${state.sessionsUser.id}/force-logout`,
      method: 'POST',
      onSuccess: 'sessions'
    });
  }

  function openLanguageModal(mode, language) {
    hideAlert(dom.languageModalAlert);
    dom.languageModalTitle.textContent = mode === 'edit' ? 'Edit language' : 'Create language';
    dom.languageModalId.value = language?.id || '';
    dom.languageModalName.value = language?.name || '';
    dom.languageModalNameHelp.textContent = '';
    dom.languageModalSubmit.textContent = mode === 'edit' ? 'Save changes' : 'Create language';
    dom.languageModalSubmit.dataset.mode = mode;
    toggleSubmit(dom.languageModalSubmit, Boolean(language?.name));
    bootstrap.Modal.getOrCreateInstance(dom.languageModal).show();
  }

  function validateLanguageModal() {
    const name = dom.languageModalName.value.trim();
    const valid = name.length >= 2;
    dom.languageModalNameHelp.textContent = valid ? '' : 'Language name must be at least 2 characters.';
    toggleSubmit(dom.languageModalSubmit, valid);
    return valid;
  }

  async function submitLanguageModal() {
    if (!validateLanguageModal()) return;
    const mode = dom.languageModalSubmit.dataset.mode;
    const name = dom.languageModalName.value.trim();
    const id = dom.languageModalId.value;
    hideAlert(dom.languageModalAlert);
    toggleSubmit(dom.languageModalSubmit, false);
    try {
      if (mode === 'edit' && id) {
        const response = await apiFetch(`/admin/languages/${id}`, { method: 'PUT', body: { name } });
        await parseResponse(response);
      } else {
        const response = await apiFetch('/admin/languages', { method: 'POST', body: { name } });
        await parseResponse(response);
      }
      bootstrap.Modal.getInstance(dom.languageModal)?.hide();
      await fetchLanguages();
    } catch (err) {
      showAlert(dom.languageModalAlert, err.message || 'Unable to save language.');
    } finally {
      toggleSubmit(dom.languageModalSubmit, true);
    }
  }

  function openLanguageDeleteModal(language) {
    hideAlert(dom.languageDeleteAlert);
    dom.languageDeleteInput.value = '';
    dom.languageDeleteHelp.textContent = '';
    dom.languageDeleteSubmit.dataset.languageId = language.id;
    dom.languageDeleteSubmit.dataset.languageName = language.name || '';
    toggleSubmit(dom.languageDeleteSubmit, false);
    bootstrap.Modal.getOrCreateInstance(dom.languageDeleteModal).show();
  }

  function validateLanguageDelete() {
    const value = dom.languageDeleteInput.value.trim();
    const valid = value.toUpperCase() === 'DELETE';
    dom.languageDeleteHelp.textContent = valid ? '' : 'Type DELETE to confirm.';
    toggleSubmit(dom.languageDeleteSubmit, valid);
    return valid;
  }

  async function submitLanguageDelete() {
    if (!validateLanguageDelete()) return;
    const id = dom.languageDeleteSubmit.dataset.languageId;
    hideAlert(dom.languageDeleteAlert);
    toggleSubmit(dom.languageDeleteSubmit, false);
    try {
      const response = await apiFetch(`/admin/languages/${id}`, { method: 'DELETE' });
      await parseResponse(response);
      bootstrap.Modal.getInstance(dom.languageDeleteModal)?.hide();
      await fetchLanguages();
    } catch (err) {
      showAlert(dom.languageDeleteAlert, err.message || 'Unable to delete language.');
    } finally {
      toggleSubmit(dom.languageDeleteSubmit, true);
    }
  }

  function bindEvents() {
    dom.refreshStatusBtn?.addEventListener('click', () => fetchStatus().catch(() => {}));

    dom.adminSectionNav?.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-section]');
      if (!btn) return;
      setSection(btn.dataset.section);
    });

    window.addEventListener('hashchange', () => {
      const hashSection = resolveSectionFromHash();
      if (hashSection) setSection(hashSection);
    });

    dom.refreshUsersBtn?.addEventListener('click', () => fetchUsers(getUserFilters()).catch(() => {}));
    dom.userVerifiedFilter?.addEventListener('change', () => { state.usersPage = 1; fetchUsers(getUserFilters()).catch(() => {}); });
    dom.userDisabledFilter?.addEventListener('change', () => { state.usersPage = 1; fetchUsers(getUserFilters()).catch(() => {}); });
    dom.userRoleFilter?.addEventListener('change', () => { state.usersPage = 1; fetchUsers(getUserFilters()).catch(() => {}); });
    dom.userSearchInput?.addEventListener('input', debounce(() => { state.usersPage = 1; fetchUsers(getUserFilters()).catch(() => {}); }));
    dom.usersPerPage?.addEventListener('change', () => {
      const value = Number.parseInt(dom.usersPerPage.value, 10);
      if (Number.isInteger(value) && value >= 5 && value <= 100) {
        state.usersLimit = value;
      } else {
        dom.usersPerPage.value = state.usersLimit;
      }
      state.usersPage = 1;
      fetchUsers(getUserFilters()).catch(() => {});
    });

    dom.usersPrevBtn?.addEventListener('click', () => {
      if (state.usersPage <= 1) return;
      state.usersPage -= 1;
      fetchUsers(getUserFilters()).catch(() => {});
    });
    dom.usersNextBtn?.addEventListener('click', () => {
      if (!state.usersHasNext) return;
      state.usersPage += 1;
      fetchUsers(getUserFilters()).catch(() => {});
    });

    dom.usersTbody?.addEventListener('click', handleUserActionClick);

    dom.confirmActionReason?.addEventListener('input', handleConfirmActionModalInput);
    dom.confirmActionEmail?.addEventListener('input', handleConfirmActionModalInput);
    dom.confirmActionInput?.addEventListener('input', handleConfirmActionModalInput);
    dom.confirmActionSubmit?.addEventListener('click', handleConfirmActionSubmit);

    dom.sessionsForceLogoutBtn?.addEventListener('click', handleSessionsForceLogout);

    dom.createFullName?.addEventListener('input', handleCreateUserInput);
    dom.createPreferredName?.addEventListener('input', handleCreateUserInput);
    dom.createEmail?.addEventListener('input', handleCreateUserInput);
    dom.createRole?.addEventListener('change', handleCreateUserInput);
    dom.createPassword?.addEventListener('input', handleCreateUserInput);
    dom.createNoPassword?.addEventListener('change', handleCreateUserInput);
    dom.createUserSubmit?.addEventListener('click', submitCreateUser);
    dom.openCreateUserBtn?.addEventListener('click', openCreateUserModal);

    dom.editFullName?.addEventListener('input', handleEditUserInput);
    dom.editPreferredName?.addEventListener('input', handleEditUserInput);
    dom.editEmail?.addEventListener('input', handleEditUserInput);
    dom.editRole?.addEventListener('change', handleEditUserInput);
    dom.editUserSubmit?.addEventListener('click', submitEditUser);

    dom.openCreateLanguageBtn?.addEventListener('click', () => openLanguageModal('create'));
    dom.openCreateLanguageBtnSecondary?.addEventListener('click', () => openLanguageModal('create'));
    dom.languageModalName?.addEventListener('input', validateLanguageModal);
    dom.languageModalSubmit?.addEventListener('click', submitLanguageModal);

    dom.languagesTbody?.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-language-id]');
      if (!btn) return;
      const id = Number(btn.dataset.languageId);
      if (!Number.isInteger(id)) return;
      const language = state.languages.find((l) => l.id === id);
      if (btn.classList.contains('js-edit-language')) {
        openLanguageModal('edit', language);
      } else if (btn.classList.contains('js-delete-language')) {
        openLanguageDeleteModal(language);
      }
    });

    dom.languageDeleteInput?.addEventListener('input', validateLanguageDelete);
    dom.languageDeleteSubmit?.addEventListener('click', submitLanguageDelete);
  }

  function denyAccess() {
    setBadge('error');
    updateStatusPill('Access denied');
    dom.adminAccessAlert?.classList.remove('d-none');
    if (window.pageContentReady?.resolve) {
      window.pageContentReady.resolve({ success: false, unauthorized: true });
    }
    setTimeout(() => {
      window.location.href = 'dashboard';
    }, 2500);
  }

  async function ensureAuthorized() {
    const tokensOk = await window.authGuard.checkSessionAndPrompt({ waitForMaintenance: true });
    if (!tokensOk) return false;
    const profile = parseUserProfile();
    updateRolePill(profile);
    const isAdmin = profile?.role === 'admin';
    setAdminNavVisibility(isAdmin);
    if (!isAdmin) {
      denyAccess();
      return false;
    }
    return true;
  }

  async function initialize() {
    bindEvents();
    restoreSection();
    if (dom.usersPerPage) {
      const initialPerPage = Number.parseInt(dom.usersPerPage.value, 10);
      if (Number.isInteger(initialPerPage)) {
        state.usersLimit = Math.min(Math.max(initialPerPage, 5), 100);
      }
    }
    const authorized = await ensureAuthorized();
    if (!authorized) return;

    try {
      await Promise.all([
        fetchStatus(),
        fetchUsers(getUserFilters()),
        fetchLanguages()
      ]);
      if (window.pageContentReady?.resolve) {
        window.pageContentReady.resolve({ success: true });
      }
    } catch (err) {
      if (window.pageContentReady?.resolve) {
        window.pageContentReady.resolve({ success: false, error: err?.message });
      }
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
