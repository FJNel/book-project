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
    logsTbody: document.getElementById('logsTbody'),
    logsAlert: document.getElementById('logsAlert'),
    logsSearchInput: document.getElementById('logsSearchInput'),
    logsTypeFilter: document.getElementById('logsTypeFilter'),
    logsLevelFilter: document.getElementById('logsLevelFilter'),
    logsStatusFilter: document.getElementById('logsStatusFilter'),
    logsMethodFilter: document.getElementById('logsMethodFilter'),
    logsPathFilter: document.getElementById('logsPathFilter'),
    logsUserIdFilter: document.getElementById('logsUserIdFilter'),
    logsDateFrom: document.getElementById('logsDateFrom'),
    logsDateTo: document.getElementById('logsDateTo'),
    logsPrevBtn: document.getElementById('logsPrevBtn'),
    logsNextBtn: document.getElementById('logsNextBtn'),
    logsPageSize: document.getElementById('logsPageSize'),
    logsSummary: document.getElementById('logsSummary'),
    logsRefreshBtn: document.getElementById('logsRefreshBtn'),
    logsClearFiltersBtn: document.getElementById('logsClearFiltersBtn'),
    logsLiveToggle: document.getElementById('logsLiveToggle'),
    logsDetailModal: document.getElementById('logsDetailModal'),
    logsDetailContent: document.getElementById('logsDetailContent'),
    logsDetailAlert: document.getElementById('logsDetailAlert'),
    logsCopyJsonBtn: document.getElementById('logsCopyJsonBtn'),
    logsDetailTitle: document.getElementById('logsDetailTitle'),
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
    confirmActionSummaryUser: document.getElementById('confirmActionSummaryUser'),
    confirmActionSummaryAction: document.getElementById('confirmActionSummaryAction'),
    confirmActionSummaryImpact: document.getElementById('confirmActionSummaryImpact'),
    confirmActionNotifyBadge: document.getElementById('confirmActionNotifyBadge'),
    confirmActionSummaryWarning: document.getElementById('confirmActionSummaryWarning'),
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
    confirmActionCloseBtn: document.getElementById('confirmActionCloseBtn'),
    confirmActionCancelBtn: document.getElementById('confirmActionCancelBtn'),
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
    logs: [],
    logsPage: 1,
    logsLimit: 25,
    logsTotal: 0,
    logsHasNext: false,
    logsMeta: { types: [], levels: [], statuses: [] },
    logsMetaLoaded: false,
    logsInitialized: false,
    logsLiveTimer: null,
    logsLiveEnabled: false,
    currentLogDetail: null,
    authorized: false,
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
      const formatted = johannesburgFormatter.format(new Date(value));
      return formatted.replace(', ', ' ');
    } catch (err) {
      warn('Failed to format date', err);
      return String(value);
    }
  }

  function formatApiError(err) {
    const message = escapeHtml(err?.apiMessage || err?.message || 'Request failed.');
    const details = Array.isArray(err?.apiErrors) ? err.apiErrors.filter(Boolean).map((e) => escapeHtml(e)) : [];
    if (details.length) {
      return `<strong>${message}</strong>: ${details.join(' ')}`;
    }
    return `<strong>${message}</strong>`;
  }

  function showApiError(el, err) {
    if (!el) return;
    el.innerHTML = formatApiError(err);
    el.classList.remove('d-none');
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
      const rateErr = new Error('Rate limited');
      rateErr.apiMessage = 'Rate limited';
      rateErr.apiErrors = ['Please wait before trying again.'];
      rateErr.status = 429;
      throw rateErr;
    }

    if (response.status === 401) {
      if (typeof window.showSessionExpiredModal === 'function') {
        window.showSessionExpiredModal();
      }
      const authErr = new Error('Not authorized');
      authErr.apiMessage = 'Not authorized';
      authErr.apiErrors = [];
      authErr.status = 401;
      throw authErr;
    }

    if (!response.ok) {
      const errors = Array.isArray(body?.errors) ? body.errors.filter(Boolean) : [];
      const message = body?.message || 'Request failed.';
      const err = new Error(message);
      err.apiMessage = message;
      err.apiErrors = errors;
      err.status = response.status;
      throw err;
    }

    return body?.data ?? body;
  }

  function updateRolePill(profile) {
    if (!dom.adminRolePill) return;
    const role = profile?.role || 'unknown';
    dom.adminRolePill.textContent = `Role: ${role}`;
    dom.adminRolePill.className = `chip ${role === 'admin' ? 'chip-alert' : 'chip-muted'}`;
  }

  function updateStatusPill(text) {
    if (!dom.adminStatusPill) return;
    const normalized = (text || '').toLowerCase();
    const className = normalized === 'error' ? 'chip chip-alert' : 'chip chip-muted';
    dom.adminStatusPill.textContent = `Status: ${text}`;
    dom.adminStatusPill.className = className;
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
      const disableLabel = user.isDisabled ? 'Enable account' : 'Disable account';
      const verifyLabel = user.isVerified ? 'Unverify' : 'Verify';
      const verificationActionClass = user.isVerified ? 'js-unverify-user' : 'js-verify-user';
      const roleBadge = user.role === 'admin'
        ? '<span class="badge text-bg-danger">Admin</span>'
        : '<span class="badge text-bg-secondary">User</span>';
      const disableTextClass = user.isDisabled ? 'text-success' : 'text-warning';
      return `
        <tr data-user-id="${user.id}">
          <td>${user.id ?? '—'}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(user.email || '—')}</td>
          <td>${roleBadge}</td>
          <td>${verified}</td>
          <td>${disabled}</td>
          <td>${formatDateTime(user.lastLogin)}</td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary js-edit-user" type="button" data-user-id="${user.id}">Edit</button>
              <button class="btn btn-outline-secondary js-view-sessions" type="button" data-user-id="${user.id}">Sessions</button>
              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">Actions</button>
                <div class="dropdown-menu dropdown-menu-end">
                  <button class="dropdown-item ${verificationActionClass}" type="button" data-user-id="${user.id}">${verifyLabel}</button>
                  <button class="dropdown-item js-send-verification" type="button" data-user-id="${user.id}">Send verification email</button>
                  <button class="dropdown-item js-reset-password" type="button" data-user-id="${user.id}">Send password reset</button>
                  <button class="dropdown-item ${disableTextClass} js-toggle-disable" type="button" data-user-id="${user.id}" data-disabled="${user.isDisabled}">${disableLabel}</button>
                  <button class="dropdown-item js-force-logout" type="button" data-user-id="${user.id}">Force logout</button>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item text-danger js-delete-user" type="button" data-user-id="${user.id}">Handle deletion</button>
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
      dom.languagesTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No languages found.</td></tr>';
      return;
    }

    const rows = state.languages.map((lang) => `
      <tr data-language-id="${lang.id}">
        <td>${lang.id ?? '—'}</td>
        <td>${escapeHtml(lang.name || '—')}</td>
        <td>${escapeHtml(lang.nameNormalized || lang.name_normalized || '—')}</td>
        <td>${formatDateTime(lang.createdAt || lang.created_at)}</td>
        <td>${formatDateTime(lang.updatedAt || lang.updated_at)}</td>
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
    if (dom.languagesTbody) dom.languagesTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Loading languages…</td></tr>';
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

  function updateUrlSection(section) {
    const url = new URL(window.location.href);
    url.searchParams.set('section', section);
    url.hash = `#${section}`;
    window.history.replaceState({}, '', url);
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
    updateUrlSection(section);

    if (section === 'logs' && state.authorized) {
      ensureLogsInitialized().catch(() => {});
    } else if (state.logsLiveEnabled) {
      stopLogsLive();
      if (dom.logsLiveToggle) dom.logsLiveToggle.checked = false;
    }
  }

  function resolveSectionFromHash() {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('users')) return 'users';
    if (hash.includes('language')) return 'languages';
    if (hash.includes('log')) return 'logs';
    return null;
  }

  function resolveSectionFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const section = (params.get('section') || '').toLowerCase();
    if (['overview', 'users', 'languages', 'logs'].includes(section)) return section;
    return null;
  }

  function restoreSection() {
    const hashSection = resolveSectionFromHash();
    if (hashSection) {
      setSection(hashSection);
      return;
    }
    const querySection = resolveSectionFromQuery();
    if (querySection) {
      setSection(querySection);
      return;
    }
    const stored = window.localStorage.getItem('adminSection');
    const target = ['overview', 'users', 'languages', 'logs'].includes(stored) ? stored : 'overview';
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

  function setModalInteractivity(modalEl, isDisabled) {
    if (!modalEl) return;
    modalEl.querySelectorAll('input, select, textarea, button').forEach((node) => {
      node.disabled = isDisabled;
    });
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
    setModalInteractivity(dom.createUserModal, true);
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
      showApiError(dom.createUserAlert, err);
    } finally {
      setModalInteractivity(dom.createUserModal, false);
      validateCreateUserForm();
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
    setModalInteractivity(dom.editUserModal, true);
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
      showApiError(dom.editUserAlert, err);
    } finally {
      setModalInteractivity(dom.editUserModal, false);
      validateEditUserForm();
    }
  }

  function setConfirmModalBusy(isBusy) {
    [dom.confirmActionReason, dom.confirmActionEmail, dom.confirmActionInput].forEach((input) => {
      if (input) input.disabled = isBusy;
    });
    if (dom.confirmActionCloseBtn) dom.confirmActionCloseBtn.disabled = isBusy;
    if (dom.confirmActionCancelBtn) dom.confirmActionCancelBtn.disabled = isBusy;
    if (dom.confirmActionSubmit) dom.confirmActionSubmit.disabled = true;
    if (!isBusy) {
      validateConfirmAction();
    }
  }

  function openConfirmAction(config) {
    const resolvedUser = config.user || state.users.find((u) => u.id === config.userId);
    const userLabel = resolvedUser
      ? `${escapeHtml(resolvedUser.fullName || resolvedUser.preferredName || 'User')} (${escapeHtml(resolvedUser.email || '—')}) [ID: ${resolvedUser.id}]`
      : `User ID: ${config.userId}`;

    state.confirmActionConfig = {
      title: config.title || 'Confirm action',
      message: config.message || 'Review and confirm this action.',
      actionLabel: config.actionLabel || config.title || 'Action',
      impact: config.impact || 'No additional impact specified.',
      willNotify: Boolean(config.willNotify),
      destructive: Boolean(config.destructive || config.confirmText),
      confirmLabel: config.confirmLabel || 'Confirm',
      ...config,
      user: resolvedUser
    };

    hideAlert(dom.confirmActionAlert);
    dom.confirmActionTitle.textContent = state.confirmActionConfig.title;
    dom.confirmActionMessage.textContent = state.confirmActionConfig.message;
    if (dom.confirmActionSummaryUser) dom.confirmActionSummaryUser.innerHTML = userLabel;
    if (dom.confirmActionSummaryAction) dom.confirmActionSummaryAction.textContent = state.confirmActionConfig.actionLabel;
    if (dom.confirmActionSummaryImpact) dom.confirmActionSummaryImpact.textContent = state.confirmActionConfig.impact;
    dom.confirmActionNotifyBadge?.classList.toggle('d-none', !state.confirmActionConfig.willNotify);
    dom.confirmActionSummaryWarning?.classList.toggle('d-none', !state.confirmActionConfig.destructive);
    if (dom.confirmActionSubmit) {
      dom.confirmActionSubmit.textContent = state.confirmActionConfig.confirmLabel;
      dom.confirmActionSubmit.classList.toggle('btn-danger', state.confirmActionConfig.destructive);
      dom.confirmActionSubmit.classList.toggle('btn-primary', !state.confirmActionConfig.destructive);
    }

    dom.confirmActionReasonWrap.classList.toggle('d-none', !state.confirmActionConfig.reasonRequired);
    dom.confirmActionEmailWrap.classList.toggle('d-none', !state.confirmActionConfig.emailRequired);
    dom.confirmActionInputWrap.classList.toggle('d-none', !state.confirmActionConfig.confirmText);
    dom.confirmActionReason.value = '';
    dom.confirmActionEmail.value = state.confirmActionConfig.prefillEmail || '';
    dom.confirmActionInput.value = '';
    dom.confirmActionInput.placeholder = state.confirmActionConfig.confirmText || '';
    dom.confirmActionReasonHelp.textContent = '';
    dom.confirmActionEmailHelp.textContent = '';
    dom.confirmActionInputHelp.textContent = '';
    toggleSubmit(dom.confirmActionSubmit, !state.confirmActionConfig.confirmText && !state.confirmActionConfig.reasonRequired && !state.confirmActionConfig.emailRequired);
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
    setConfirmModalBusy(true);
    hideAlert(dom.confirmActionAlert);

    const body = { id: cfg.userId };
    if (cfg.reasonRequired) body.reason = dom.confirmActionReason.value.trim();
    if (cfg.emailRequired) body.userToBeDeletedEmail = dom.confirmActionEmail.value.trim();
    if (cfg.confirmFlag) body.confirm = true;

    log(`Admin action started`, { action: cfg.actionLabel || cfg.title, userId: cfg.userId });

    try {
      log('Submitting admin action', { title: cfg.title, userId: cfg.userId, url: cfg.url });
      const response = await apiFetch(cfg.url, { method: cfg.method, body });
      await parseResponse(response);
      if (cfg.cooldownKey) startActionCooldown(cfg.cooldownKey);
      log('Admin action success', { action: cfg.actionLabel || cfg.title, userId: cfg.userId });
      bootstrap.Modal.getInstance(dom.confirmActionModal)?.hide();
      if (cfg.onSuccess === 'users') await fetchUsers(getUserFilters());
      if (cfg.onSuccess === 'sessions') await loadSessions(cfg.userId);
    } catch (err) {
      errorLog('Admin action failed', { action: cfg.actionLabel || cfg.title, userId: cfg.userId, error: err });
      showApiError(dom.confirmActionAlert, err);
    } finally {
      setConfirmModalBusy(false);
    }
  }

  async function openSessionsModal(userId) {
    const user = state.users.find((u) => u.id === userId);
    if (!user) return;
    state.sessionsUser = user;
    dom.sessionsModalTitle.textContent = `Sessions · ${user.email || user.fullName || user.id}`;
    dom.sessionsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Loading sessions…</td></tr>';
    hideAlert(dom.sessionsAlert);
    bootstrap.Modal.getOrCreateInstance(dom.sessionsModal).show();
    await loadSessions(userId);
  }

  async function loadSessions(userId) {
    try {
      log('Loading sessions', { userId });
      const response = await apiFetch(`/admin/users/${userId}/sessions`, { method: 'POST', body: { id: userId } });
      const data = await parseResponse(response);
      const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
      if (!sessions.length) {
        dom.sessionsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No active sessions.</td></tr>';
        return;
      }
      dom.sessionsTbody.innerHTML = sessions.map((session) => {
        const device = [session.browser, session.device, session.operatingSystem].filter(Boolean).join(' · ');
        const location = session.ipAddress || session.locationHint || '';
        const deviceCell = [device, location].filter(Boolean).map((part) => escapeHtml(part)).join('<br>');
        return `
        <tr>
          <td>${escapeHtml(session.fingerprint || session.tokenFingerprint || '—')}</td>
          <td>${formatDateTime(session.issuedAt || session.tokenIssued)}</td>
          <td>${formatDateTime(session.expiresAt || session.tokenExpire)}</td>
          <td>${deviceCell || '—'}</td>
        </tr>`;
      }).join('');
      log('Sessions loaded', { userId, count: sessions.length });
    } catch (err) {
      errorLog('Failed to load sessions', { userId, error: err });
      showApiError(dom.sessionsAlert, err);
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
    const user = state.users.find((u) => u.id === userId);

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
        actionLabel: isDisabled ? 'Enable user' : 'Disable user',
        message: isDisabled ? 'Re-enable this account and allow logins?' : 'Disable this account and revoke active sessions?',
        impact: isDisabled ? 'Account will be restored and login allowed. A notification email will be sent.' : 'Account will be disabled and active sessions revoked. A notification email will be sent.',
        willNotify: true,
        destructive: !isDisabled,
        confirmText: isDisabled ? '' : 'DISABLE',
        user,
        userId,
        url: isDisabled ? `/admin/users/${userId}/enable` : `/admin/users/${userId}`,
        method: isDisabled ? 'POST' : 'DELETE',
        reasonRequired: false,
        emailRequired: false,
        onSuccess: 'users'
      });
      return;
    }

    if (btn.classList.contains('js-verify-user')) {
      openConfirmAction({
        title: 'Verify user',
        actionLabel: 'Verify user',
        message: 'Mark this user as verified? Provide a short reason.',
        impact: 'User will be marked as verified and notified by email.',
        willNotify: true,
        user,
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
        actionLabel: 'Unverify user',
        message: 'Unverify this user? Provide a reason for audit.',
        impact: 'User will be marked as unverified and notified by email.',
        willNotify: true,
        user,
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
        actionLabel: 'Send verification email',
        message: 'Send a new verification email to this user?',
        impact: 'User will receive a verification link via email (default 30 minutes expiry).',
        willNotify: true,
        user,
        userId,
        url: `/admin/users/${userId}/send-verification`,
        method: 'POST',
        onSuccess: 'users',
        cooldownKey
      });
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
        actionLabel: 'Send password reset',
        message: 'Send a password reset email to this user?',
        impact: 'User will receive a password reset link via email (default 30 minutes expiry).',
        willNotify: true,
        user,
        userId,
        url: `/admin/users/${userId}/reset-password`,
        method: 'POST',
        onSuccess: 'users',
        cooldownKey
      });
      return;
    }

    if (btn.classList.contains('js-force-logout')) {
      openConfirmAction({
        title: 'Force logout',
        actionLabel: 'Force logout',
        message: 'Revoke all sessions for this user?',
        impact: 'All refresh tokens will be revoked. The user must sign in again on every device.',
        destructive: true,
        confirmText: 'LOGOUT',
        user,
        userId,
        url: `/admin/users/${userId}/force-logout`,
        method: 'POST',
        onSuccess: 'users'
      });
      return;
    }

    if (btn.classList.contains('js-delete-user')) {
      openConfirmAction({
        title: 'Delete user',
        actionLabel: 'Handle account deletion',
        message: 'This action is permanent. Provide a reason and confirmation to continue.',
        impact: 'Permanently deletes the user after they confirmed deletion. All related data will be removed.',
        destructive: true,
        user,
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
      actionLabel: 'Force logout',
      message: 'Revoke all active sessions for this user?',
      impact: 'All refresh tokens will be revoked. The user must sign in again on every device.',
      destructive: true,
      confirmText: 'LOGOUT',
      user: state.sessionsUser,
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
    dom.languageModalSubmit.dataset.originalName = language?.name || '';
    toggleSubmit(dom.languageModalSubmit, false);
    validateLanguageModal();
    bootstrap.Modal.getOrCreateInstance(dom.languageModal).show();
  }

  function validateLanguageModal() {
    const name = dom.languageModalName.value.trim();
    const mode = dom.languageModalSubmit.dataset.mode || 'create';
    const originalName = dom.languageModalSubmit.dataset.originalName || '';
    const changed = mode === 'create' ? Boolean(name) : name !== originalName;
    const valid = name.length >= 2 && changed;
    dom.languageModalNameHelp.textContent = name.length >= 2 ? '' : 'Language name must be at least 2 characters.';
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
    setModalInteractivity(dom.languageModal, true);
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
      showApiError(dom.languageModalAlert, err);
    } finally {
      setModalInteractivity(dom.languageModal, false);
      validateLanguageModal();
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
    setModalInteractivity(dom.languageDeleteModal, true);
    try {
      const response = await apiFetch(`/admin/languages/${id}`, { method: 'DELETE' });
      await parseResponse(response);
      bootstrap.Modal.getInstance(dom.languageDeleteModal)?.hide();
      await fetchLanguages();
    } catch (err) {
      showApiError(dom.languageDeleteAlert, err);
    } finally {
      setModalInteractivity(dom.languageDeleteModal, false);
      validateLanguageDelete();
    }
  }

  function resetLogsTablePlaceholder() {
    if (dom.logsTbody) dom.logsTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">Loading logs…</td></tr>';
  }

  function setLogFilterOptions(selectEl, values) {
    if (!selectEl || !Array.isArray(values)) return;
    const current = selectEl.value;
    const options = ['<option value="">Any</option>', ...values.map((val) => `<option value="${escapeHtml(val)}">${escapeHtml(val)}</option>`)];
    selectEl.innerHTML = options.join('');
    selectEl.value = current;
  }

  function normalizeDateTimeLocalToIso(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  }

  function getLogFilters() {
    return {
      search: dom.logsSearchInput?.value.trim() || '',
      type: dom.logsTypeFilter?.value || '',
      level: dom.logsLevelFilter?.value || '',
      status: dom.logsStatusFilter?.value || '',
      method: dom.logsMethodFilter?.value || '',
      path: dom.logsPathFilter?.value.trim() || '',
      userId: dom.logsUserIdFilter?.value ? Number(dom.logsUserIdFilter.value) : null,
      startDate: normalizeDateTimeLocalToIso(dom.logsDateFrom?.value),
      endDate: normalizeDateTimeLocalToIso(dom.logsDateTo?.value)
    };
  }

  function hasLogFilters(filters) {
    if (!filters) return false;
    return Boolean(
      filters.search
      || filters.type
      || filters.level
      || filters.status
      || filters.method
      || filters.path
      || Number.isFinite(filters.userId)
      || filters.startDate
      || filters.endDate
    );
  }

  function renderLogBadge(value, type) {
    if (!value) return '—';
    const normalized = String(value).toUpperCase();
    const classMap = {
      level: {
        INFO: 'text-bg-secondary',
        WARN: 'text-bg-warning',
        WARNING: 'text-bg-warning',
        ERROR: 'text-bg-danger',
        DEBUG: 'text-bg-info'
      },
      status: {
        SUCCESS: 'text-bg-success',
        FAILURE: 'text-bg-danger',
        INFO: 'text-bg-secondary',
        SKIPPED: 'text-bg-warning'
      },
      type: {
        HTTP_REQUEST: 'text-bg-primary',
        HTTP_ERROR: 'text-bg-danger'
      }
    };
    const className = classMap[type]?.[normalized] || 'text-bg-secondary';
    return `<span class="badge ${className}">${escapeHtml(normalized)}</span>`;
  }

  function updateLogsSummary(count, total) {
    if (!dom.logsSummary) return;
    const offset = (state.logsPage - 1) * state.logsLimit;
    const start = count > 0 ? offset + 1 : 0;
    const end = offset + count;
    const totalDisplay = Number.isFinite(total) ? total : end;
    dom.logsSummary.textContent = count ? `Showing ${start}–${end} of ${totalDisplay} (page ${state.logsPage})` : 'No logs to show';
    if (dom.logsPrevBtn) dom.logsPrevBtn.disabled = state.logsPage <= 1;
    if (dom.logsNextBtn) dom.logsNextBtn.disabled = !state.logsHasNext;
  }

  function renderLogs(logs) {
    state.logs = Array.isArray(logs) ? logs : [];
    if (!dom.logsTbody) return;
    if (!state.logs.length) {
      dom.logsTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No logs found.</td></tr>';
      return;
    }

    const rows = state.logs.map((log, index) => {
      const rawMessage = log.message || log.error_message || log.error_reason || log.details?.message || '—';
      const message = String(rawMessage);
      const user = log.user_id ?? log.admin_id ?? log.details?.userId ?? '—';
      const status = log.status || log.http_status || log.statusCode || '';
      const typeBadge = renderLogBadge(log.event || log.action || '', 'type');
      const levelBadge = renderLogBadge(log.level || '', 'level');
      const statusBadge = renderLogBadge(status, 'status');
      const pathText = [log.method, log.path].filter(Boolean).join(' ');
      return `
        <tr>
          <td>${formatDateTime(log.timestamp)}</td>
          <td>${levelBadge}</td>
          <td>${typeBadge}</td>
          <td>${statusBadge}</td>
          <td title="${escapeHtml(message)}">${escapeHtml(message.length > 80 ? `${message.slice(0, 77)}…` : message)}</td>
          <td>${escapeHtml(String(user))}</td>
          <td title="${escapeHtml(pathText)}">${escapeHtml(pathText || '—')}</td>
          <td><button class="btn btn-outline-primary btn-sm js-view-log" type="button" data-log-index="${index}">View</button></td>
        </tr>
      `;
    }).join('');

    dom.logsTbody.innerHTML = rows;
  }

  async function fetchLogs({ resetPage = false } = {}) {
    if (resetPage) state.logsPage = 1;
    hideAlert(dom.logsAlert);
    resetLogsTablePlaceholder();

    const filters = getLogFilters();
    const useSearch = hasLogFilters(filters);
    const offset = (state.logsPage - 1) * state.logsLimit;
    const limit = state.logsLimit;

    try {
      log('[Admin][Logs] Fetch logs', { page: state.logsPage, limit, filters, mode: useSearch ? 'search' : 'list' });
      let payload;
      if (useSearch) {
        const body = {
          search: filters.search || undefined,
          events: filters.type ? [filters.type.toLowerCase()] : [],
          levels: filters.level ? [filters.level.toLowerCase()] : [],
          statuses: filters.status ? [filters.status.toLowerCase()] : [],
          methods: filters.method ? [filters.method.toLowerCase()] : [],
          paths: filters.path ? [filters.path] : [],
          userId: Number.isFinite(filters.userId) ? filters.userId : undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          limit,
          offset
        };
        const response = await apiFetch('/logs/search', { method: 'POST', body });
        payload = await parseResponse(response);
      } else {
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        const response = await apiFetch(`/logs?${params.toString()}`, { method: 'GET' });
        payload = await parseResponse(response);
      }

      const logs = Array.isArray(payload?.logs) ? payload.logs : [];
      const count = Number.isFinite(payload?.count) ? payload.count : logs.length;
      const total = Number.isFinite(payload?.total) ? payload.total : (offset + count);
      state.logsTotal = total;
      state.logsHasNext = offset + count < total;
      renderLogs(logs);
      updateLogsSummary(count, total);
    } catch (err) {
      errorLog('[Admin][Logs] Failed to fetch logs', err);
      if (err?.status === 403 && dom.logsAlert) {
        dom.logsAlert.innerHTML = '<strong>Admin access required.</strong> You do not have permission to view logs.';
        dom.logsAlert.classList.remove('d-none');
      } else {
        showApiError(dom.logsAlert, err);
      }
      dom.logsTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">Unable to load logs.</td></tr>';
      throw err;
    }
  }

  async function loadLogsMeta() {
    if (state.logsMetaLoaded) return;
    try {
      log('[Admin][Logs] Loading types/levels/statuses...');
      const [typesResp, levelsResp, statusesResp] = await Promise.all([
        apiFetch('/logs/log_types', { method: 'GET' }),
        apiFetch('/logs/levels', { method: 'GET' }),
        apiFetch('/logs/statuses', { method: 'GET' })
      ]);
      const [typesData, levelsData, statusesData] = await Promise.all([
        parseResponse(typesResp),
        parseResponse(levelsResp),
        parseResponse(statusesResp)
      ]);
      state.logsMeta = {
        types: Array.isArray(typesData?.logTypes) ? typesData.logTypes : [],
        levels: Array.isArray(levelsData?.levels) ? levelsData.levels : [],
        statuses: Array.isArray(statusesData?.statuses) ? statusesData.statuses : []
      };
      state.logsMetaLoaded = true;
      setLogFilterOptions(dom.logsTypeFilter, state.logsMeta.types);
      setLogFilterOptions(dom.logsLevelFilter, state.logsMeta.levels);
      setLogFilterOptions(dom.logsStatusFilter, state.logsMeta.statuses);
    } catch (err) {
      errorLog('[Admin][Logs] Failed to load metadata', err);
      showApiError(dom.logsAlert, err);
      throw err;
    }
  }

  async function ensureLogsInitialized() {
    if (state.logsInitialized) return;
    await loadLogsMeta();
    await fetchLogs({ resetPage: true });
    state.logsInitialized = true;
  }

  function clearLogsFilters() {
    if (dom.logsSearchInput) dom.logsSearchInput.value = '';
    if (dom.logsTypeFilter) dom.logsTypeFilter.value = '';
    if (dom.logsLevelFilter) dom.logsLevelFilter.value = '';
    if (dom.logsStatusFilter) dom.logsStatusFilter.value = '';
    if (dom.logsMethodFilter) dom.logsMethodFilter.value = '';
    if (dom.logsPathFilter) dom.logsPathFilter.value = '';
    if (dom.logsUserIdFilter) dom.logsUserIdFilter.value = '';
    if (dom.logsDateFrom) dom.logsDateFrom.value = '';
    if (dom.logsDateTo) dom.logsDateTo.value = '';
  }

  function startLogsLive() {
    if (state.logsLiveEnabled) return;
    state.logsLiveEnabled = true;
    fetchLogs().catch(() => {});
    state.logsLiveTimer = window.setInterval(() => {
      if (state.currentSection === 'logs') {
        fetchLogs().catch(() => {});
      }
    }, 15000);
  }

  function stopLogsLive() {
    if (state.logsLiveTimer) {
      clearInterval(state.logsLiveTimer);
      state.logsLiveTimer = null;
    }
    state.logsLiveEnabled = false;
  }

  function openLogDetail(index) {
    const logEntry = state.logs[index];
    if (!logEntry || !dom.logsDetailContent) return;
    state.currentLogDetail = logEntry;
    dom.logsDetailAlert?.classList.add('d-none');
    dom.logsDetailContent.innerHTML = '';
    dom.logsDetailTitle.textContent = `Log · ${formatDateTime(logEntry.timestamp)}`;

    const fields = [
      { label: 'Timestamp', value: formatDateTime(logEntry.timestamp) },
      { label: 'Type', value: logEntry.event || logEntry.action || '—' },
      { label: 'Level', value: logEntry.level || '—' },
      { label: 'Status', value: logEntry.status || logEntry.http_status || '—' },
      { label: 'Message', value: logEntry.message || logEntry.error_message || '—' },
      { label: 'User', value: logEntry.user_id ?? logEntry.admin_id ?? logEntry.details?.userId ?? '—' },
      { label: 'HTTP', value: [logEntry.method, logEntry.path].filter(Boolean).join(' ') || '—' },
      { label: 'IP', value: logEntry.ip || logEntry.details?.ip || '—' },
      { label: 'User Agent', value: logEntry.user_agent || logEntry.details?.userAgent || '—' },
      { label: 'Duration (ms)', value: logEntry.duration_ms ?? '—' },
      { label: 'Details', value: logEntry.details ? JSON.stringify(logEntry.details, null, 2) : '—', isPre: true }
    ];

    const fragments = fields.map((field) => {
      const valueContent = field.isPre ? `<pre class="mb-0 small">${escapeHtml(field.value)}</pre>` : `<div class="fw-semibold">${escapeHtml(String(field.value))}</div>`;
      return `
        <div class="col-12 col-md-6">
          <div class="text-muted small mb-1">${escapeHtml(field.label)}</div>
          ${valueContent}
        </div>
      `;
    }).join('');

    dom.logsDetailContent.innerHTML = fragments;
    bootstrap.Modal.getOrCreateInstance(dom.logsDetailModal).show();
  }

  async function copyLogJson() {
    if (!state.currentLogDetail) return;
    try {
      const payload = JSON.stringify(state.currentLogDetail, null, 2);
      await navigator.clipboard.writeText(payload);
    } catch (err) {
      errorLog('[Admin][Logs] Copy JSON failed', err);
      showApiError(dom.logsDetailAlert, err);
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

    dom.logsSearchInput?.addEventListener('input', debounce(() => {
      state.logsPage = 1;
      ensureLogsInitialized().then(() => fetchLogs()).catch(() => {});
    }));
    const logFilterChange = () => {
      state.logsPage = 1;
      ensureLogsInitialized().then(() => fetchLogs()).catch(() => {});
    };
    dom.logsTypeFilter?.addEventListener('change', logFilterChange);
    dom.logsLevelFilter?.addEventListener('change', logFilterChange);
    dom.logsStatusFilter?.addEventListener('change', logFilterChange);
    dom.logsMethodFilter?.addEventListener('change', logFilterChange);
    dom.logsPathFilter?.addEventListener('input', debounce(logFilterChange));
    dom.logsUserIdFilter?.addEventListener('input', debounce(logFilterChange));
    dom.logsDateFrom?.addEventListener('change', logFilterChange);
    dom.logsDateTo?.addEventListener('change', logFilterChange);

    dom.logsPrevBtn?.addEventListener('click', () => {
      if (state.logsPage <= 1) return;
      state.logsPage -= 1;
      ensureLogsInitialized().then(() => fetchLogs()).catch(() => {});
    });
    dom.logsNextBtn?.addEventListener('click', () => {
      if (!state.logsHasNext) return;
      state.logsPage += 1;
      ensureLogsInitialized().then(() => fetchLogs()).catch(() => {});
    });

    dom.logsRefreshBtn?.addEventListener('click', () => {
      ensureLogsInitialized().then(() => fetchLogs()).catch(() => {});
    });

    dom.logsClearFiltersBtn?.addEventListener('click', () => {
      clearLogsFilters();
      state.logsPage = 1;
      ensureLogsInitialized().then(() => fetchLogs()).catch(() => {});
    });

    dom.logsPageSize?.addEventListener('change', () => {
      const next = Number.parseInt(dom.logsPageSize.value, 10);
      if (Number.isInteger(next) && next >= 5 && next <= 200) {
        state.logsLimit = next;
      } else {
        dom.logsPageSize.value = state.logsLimit;
      }
      state.logsPage = 1;
      ensureLogsInitialized().then(() => fetchLogs()).catch(() => {});
    });

    dom.logsLiveToggle?.addEventListener('change', (event) => {
      const enabled = event.target.checked;
      if (enabled) {
        ensureLogsInitialized().then(() => startLogsLive()).catch(() => {
          dom.logsLiveToggle.checked = false;
        });
      } else {
        stopLogsLive();
      }
    });

    dom.logsTbody?.addEventListener('click', (event) => {
      const btn = event.target.closest('button.js-view-log');
      if (!btn) return;
      const index = Number.parseInt(btn.dataset.logIndex, 10);
      if (!Number.isInteger(index)) return;
      openLogDetail(index);
    });

    dom.logsCopyJsonBtn?.addEventListener('click', copyLogJson);
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
    if (!tokensOk) {
      state.authorized = false;
      return false;
    }
    const profile = parseUserProfile();
    updateRolePill(profile);
    const isAdmin = profile?.role === 'admin';
    setAdminNavVisibility(isAdmin);
    if (!isAdmin) {
      denyAccess();
      state.authorized = false;
      return false;
    }
    state.authorized = true;
    if (state.currentSection === 'logs') {
      ensureLogsInitialized().catch(() => {});
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
    if (dom.logsPageSize) {
      const initialLogsPage = Number.parseInt(dom.logsPageSize.value, 10);
      if (Number.isInteger(initialLogsPage)) {
        state.logsLimit = Math.min(Math.max(initialLogsPage, 5), 200);
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
