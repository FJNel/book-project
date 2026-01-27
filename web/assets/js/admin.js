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
    schemaStatusText: document.getElementById('schemaStatusText'),
    schemaDetails: document.getElementById('schemaDetails'),
    dbSslModeText: document.getElementById('dbSslModeText'),
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
    usersSuccess: document.getElementById('usersSuccess'),
    usersPrevBtn: document.getElementById('usersPrevBtn'),
    usersNextBtn: document.getElementById('usersNextBtn'),
    usersSummary: document.getElementById('usersSummary'),
    openCreateUserBtn: document.getElementById('openCreateUserBtn'),
    openCreateLanguageBtn: document.getElementById('openCreateLanguageBtn'),
    openCreateLanguageBtnSecondary: document.getElementById('openCreateLanguageBtnSecondary'),
    languagesTbody: document.getElementById('languagesTbody'),
    languagesAlert: document.getElementById('languagesAlert'),
    languagesSuccess: document.getElementById('languagesSuccess'),
    logsTbody: document.getElementById('logsTbody'),
    logsAlert: document.getElementById('logsAlert'),
    logsSearchInput: document.getElementById('logsSearchInput'),
    logsTypeFilter: document.getElementById('logsTypeFilter'),
    logsLevelFilter: document.getElementById('logsLevelFilter'),
    logsStatusFilter: document.getElementById('logsStatusFilter'),
    logsMethodFilter: document.getElementById('logsMethodFilter'),
    logsActorFilter: document.getElementById('logsActorFilter'),
    logsPathFilter: document.getElementById('logsPathFilter'),
    logsUserIdFilter: document.getElementById('logsUserIdFilter'),
    logsUserEmailFilter: document.getElementById('logsUserEmailFilter'),
    logsApiKeyIdFilter: document.getElementById('logsApiKeyIdFilter'),
    logsApiKeyLabelFilter: document.getElementById('logsApiKeyLabelFilter'),
    logsApiKeyPrefixFilter: document.getElementById('logsApiKeyPrefixFilter'),
    logsStatusMin: document.getElementById('logsStatusMin'),
    logsStatusMax: document.getElementById('logsStatusMax'),
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
    logsCopyRequestBtn: document.getElementById('logsCopyRequestBtn'),
    logsCopyResponseBtn: document.getElementById('logsCopyResponseBtn'),
    logsCopyCorrelationBtn: document.getElementById('logsCopyCorrelationBtn'),
    logsDetailTitle: document.getElementById('logsDetailTitle'),
    usageRefreshBtn: document.getElementById('usageRefreshBtn'),
    usageAlert: document.getElementById('usageAlert'),
    usageDateFrom: document.getElementById('usageDateFrom'),
    usageDateTo: document.getElementById('usageDateTo'),
    usageSortBy: document.getElementById('usageSortBy'),
    usageSortOrder: document.getElementById('usageSortOrder'),
    usageTopLimit: document.getElementById('usageTopLimit'),
    usageUserId: document.getElementById('usageUserId'),
    usageUserEmail: document.getElementById('usageUserEmail'),
    usageUserPath: document.getElementById('usageUserPath'),
    usageUsersSummary: document.getElementById('usageUsersSummary'),
    usageUsersTbody: document.getElementById('usageUsersTbody'),
    usageApiKeyId: document.getElementById('usageApiKeyId'),
    usageApiKeyLabel: document.getElementById('usageApiKeyLabel'),
    usageApiKeyEmail: document.getElementById('usageApiKeyEmail'),
    usageApiKeysSummary: document.getElementById('usageApiKeysSummary'),
    usageApiKeysTbody: document.getElementById('usageApiKeysTbody'),
    usageLogsNav: document.getElementById('usageLogsNav'),
    emailsAlert: document.getElementById('emailsAlert'),
    emailsSuccess: document.getElementById('emailsSuccess'),
    emailTypeSelect: document.getElementById('emailTypeSelect'),
    emailRecipientInput: document.getElementById('emailRecipientInput'),
    emailRecipientHelp: document.getElementById('emailRecipientHelp'),
    emailTokenExpirySelect: document.getElementById('emailTokenExpirySelect'),
    emailTokenExpiryCustom: document.getElementById('emailTokenExpiryCustom'),
    emailTokenExpiryHelp: document.getElementById('emailTokenExpiryHelp'),
    emailContextInput: document.getElementById('emailContextInput'),
    emailContextHelp: document.getElementById('emailContextHelp'),
    emailTypesRefreshBtn: document.getElementById('emailTypesRefreshBtn'),
    emailResetBtn: document.getElementById('emailResetBtn'),
    emailSendTestBtn: document.getElementById('emailSendTestBtn'),
    devEmailStatus: document.getElementById('devEmailStatus'),
    devEmailSubject: document.getElementById('devEmailSubject'),
    devEmailSubjectHelp: document.getElementById('devEmailSubjectHelp'),
    devEmailBody: document.getElementById('devEmailBody'),
    devEmailBodyHelp: document.getElementById('devEmailBodyHelp'),
    devEmailPreview: document.getElementById('devEmailPreview'),
    devEmailTestRecipient: document.getElementById('devEmailTestRecipient'),
    devEmailTestHelp: document.getElementById('devEmailTestHelp'),
    devEmailTestBtn: document.getElementById('devEmailTestBtn'),
    devEmailSendBtn: document.getElementById('devEmailSendBtn'),
    devEmailSummary: document.getElementById('devEmailSummary'),
    refreshSiteStatsBtn: document.getElementById('refreshSiteStatsBtn'),
    siteStatsAlert: document.getElementById('siteStatsAlert'),
    siteUsersTotal: document.getElementById('siteUsersTotal'),
    siteUsersVerified: document.getElementById('siteUsersVerified'),
    siteUsersDisabled: document.getElementById('siteUsersDisabled'),
    siteBooksTotal: document.getElementById('siteBooksTotal'),
    siteBooksActive: document.getElementById('siteBooksActive'),
    siteBooksDeleted: document.getElementById('siteBooksDeleted'),
    siteAuthorsTotal: document.getElementById('siteAuthorsTotal'),
    sitePublishersTotal: document.getElementById('sitePublishersTotal'),
    siteSeriesTotal: document.getElementById('siteSeriesTotal'),
    siteBookTypesTotal: document.getElementById('siteBookTypesTotal'),
    siteTagsTotal: document.getElementById('siteTagsTotal'),
    siteStorageTotal: document.getElementById('siteStorageTotal'),
    dataViewerAlert: document.getElementById('dataViewerAlert'),
    dataViewerTable: document.getElementById('dataViewerTable'),
    dataViewerSearch: document.getElementById('dataViewerSearch'),
    dataViewerUserId: document.getElementById('dataViewerUserId'),
    dataViewerEmail: document.getElementById('dataViewerEmail'),
    dataViewerSort: document.getElementById('dataViewerSort'),
    dataViewerOrder: document.getElementById('dataViewerOrder'),
    dataViewerLimit: document.getElementById('dataViewerLimit'),
    dataViewerPage: document.getElementById('dataViewerPage'),
    dataViewerLoadBtn: document.getElementById('dataViewerLoadBtn'),
    dataViewerClearBtn: document.getElementById('dataViewerClearBtn'),
    dataViewerSummary: document.getElementById('dataViewerSummary'),
    dataViewerThead: document.getElementById('dataViewerThead'),
    dataViewerTbody: document.getElementById('dataViewerTbody'),
    createUserModal: document.getElementById('createUserModal'),
    createUserAlert: document.getElementById('createUserAlert'),
    createUserSubmit: document.getElementById('createUserSubmit'),
    createFullName: document.getElementById('createFullName'),
    createPreferredName: document.getElementById('createPreferredName'),
    createEmail: document.getElementById('createEmail'),
    createRole: document.getElementById('createRole'),
    createPassword: document.getElementById('createPassword'),
    createTokenExpiry: document.getElementById('createTokenExpiry'),
    createTokenExpiryHelp: document.getElementById('createTokenExpiryHelp'),
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
    confirmActionSummaryExpiryRow: document.getElementById('confirmActionSummaryExpiryRow'),
    confirmActionSummaryExpiry: document.getElementById('confirmActionSummaryExpiry'),
    confirmActionSummaryMeta: document.getElementById('confirmActionSummaryMeta'),
    confirmActionNotifyBadge: document.getElementById('confirmActionNotifyBadge'),
    confirmActionSummaryWarning: document.getElementById('confirmActionSummaryWarning'),
    confirmActionReasonWrap: document.getElementById('confirmActionReasonWrap'),
    confirmActionReason: document.getElementById('confirmActionReason'),
    confirmActionReasonHelp: document.getElementById('confirmActionReasonHelp'),
    confirmActionEmailWrap: document.getElementById('confirmActionEmailWrap'),
    confirmActionEmail: document.getElementById('confirmActionEmail'),
    confirmActionEmailHelp: document.getElementById('confirmActionEmailHelp'),
    confirmActionExpiryWrap: document.getElementById('confirmActionExpiryWrap'),
    confirmActionExpirySelect: document.getElementById('confirmActionExpirySelect'),
    confirmActionExpiryCustom: document.getElementById('confirmActionExpiryCustom'),
    confirmActionExpiryHelp: document.getElementById('confirmActionExpiryHelp'),
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
    usagePanel: 'logs',
    usageUsers: [],
    usageApiKeys: [],
    usageInitialized: false,
    authorized: false,
    currentUserId: null,
    actionCooldowns: new Map(),
    emailTypes: [],
    emailTypesLoaded: false,
    emailTypesLoading: false,
    emailDefaultExpiryMinutes: null,
    emailDefaultExpiryLabel: 'Default',
    siteStatsLoaded: false,
    dataViewerTables: [],
    dataViewerLoaded: false,
    successTimers: new Map()
  };

  const emailTokenDefaults = {
    verification: 30,
    password_reset: 30,
    account_disable_verification: 60,
    account_delete_verification: 60,
    email_change_verification: 60,
    admin_account_setup: 60
  };

  function getEmailDefaultExpiryMinutes(emailType) {
    if (!emailType) return null;
    return emailTokenDefaults[emailType] ?? null;
  }

  function updateEmailDefaultExpiryOption(emailType) {
    const defaultMinutes = getEmailDefaultExpiryMinutes(emailType);
    state.emailDefaultExpiryMinutes = defaultMinutes;
    state.emailDefaultExpiryLabel = defaultMinutes ? `${defaultMinutes} minutes` : 'Default';
    const option = dom.emailTokenExpirySelect?.querySelector('option[value=""]');
    if (option) {
      if (emailType) {
        option.textContent = defaultMinutes ? `Use default (${defaultMinutes} minutes)` : 'Use default';
      } else {
        option.textContent = 'Use default (select an email type)';
      }
    }
  }

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

  function showSuccess(el, message) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('d-none');
  }

  function clearSuccess(el) {
    if (!el) return;
    el.classList.add('d-none');
    el.textContent = '';
  }

  function announceSuccess(target, message, timeoutMs = 6000) {
    const map = {
      users: dom.usersSuccess,
      languages: dom.languagesSuccess,
      emails: dom.emailsSuccess,
      logs: dom.logsAlert
    };
    const el = map[target];
    if (!el) return;
    showSuccess(el, message);
    const key = `${target}-success`;
    if (state.successTimers.has(key)) {
      clearTimeout(state.successTimers.get(key));
    }
    const timer = setTimeout(() => {
      clearSuccess(el);
      state.successTimers.delete(key);
    }, timeoutMs);
    state.successTimers.set(key, timer);
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

  function resetHealthStatus() {
    if (dom.schemaStatusText) dom.schemaStatusText.textContent = '—';
    if (dom.dbSslModeText) dom.dbSslModeText.textContent = '—';
    if (dom.schemaDetails) {
      dom.schemaDetails.textContent = '';
      dom.schemaDetails.classList.add('d-none');
    }
  }

  function formatMissingColumns(missingColumns) {
    if (!Array.isArray(missingColumns)) return '';
    const list = missingColumns
      .filter((entry) => entry && entry.table && entry.column)
      .map((entry) => `${entry.table}.${entry.column}`);
    return list.length ? list.join(', ') : '';
  }

  function renderHealthStatus(payload = {}, { message, errors, ok } = {}) {
    const db = payload?.db || {};
    const schemaOk = db?.schemaOk;
    const missingColumns = Array.isArray(db?.missingColumns) ? db.missingColumns : [];
    const missingList = formatMissingColumns(missingColumns);

    if (dom.schemaStatusText) {
      if (schemaOk === true) {
        dom.schemaStatusText.textContent = 'Ready';
      } else if (schemaOk === false) {
        dom.schemaStatusText.textContent = 'Needs update';
      } else {
        dom.schemaStatusText.textContent = ok === false ? 'Unavailable' : 'Unknown';
      }
    }

    if (dom.schemaDetails) {
      if (schemaOk === false && missingList) {
        dom.schemaDetails.textContent = `Missing: ${missingList}`;
        dom.schemaDetails.classList.remove('d-none');
      } else {
        dom.schemaDetails.textContent = '';
        dom.schemaDetails.classList.add('d-none');
      }
    }

    if (dom.dbSslModeText) {
      dom.dbSslModeText.textContent = db?.sslMode || '—';
    }

    if (schemaOk === false) {
      setBadge('degraded');
      updateStatusPill('Needs attention');
      if (missingList) {
        showAlert(dom.statusAlert, `Database schema needs updates. Missing: ${missingList}`);
      } else if (message || (errors && errors.length)) {
        const detail = message || errors.join(' ');
        showAlert(dom.statusAlert, detail);
      }
      return;
    }

    if (ok === false && (message || (errors && errors.length))) {
      setBadge('degraded');
      updateStatusPill('Degraded');
      const detail = message || errors.join(' ');
      showAlert(dom.statusAlert, detail);
    }
  }

  async function fetchHealthStatus() {
    try {
      const response = await apiFetch('/health', { method: 'GET' });
      let body = {};
      try {
        body = await response.json();
      } catch (err) {
        warn('Failed to parse health response JSON', err);
      }
      const data = body?.data ?? body;
      if (!response.ok) {
        renderHealthStatus(data, {
          message: body?.message || 'Health check failed.',
          errors: Array.isArray(body?.errors) ? body.errors.filter(Boolean) : [],
          ok: false
        });
        return;
      }
      renderHealthStatus(data, { ok: true });
    } catch (err) {
      warn('Failed to fetch health status', err);
      renderHealthStatus({}, { message: err?.message || 'Health check unavailable.', ok: false });
    }
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
    resetHealthStatus();
    updateStatusPill('Error');
    showAlert(dom.statusAlert, message);
  }

  async function fetchStatus() {
    hideAlert(dom.statusAlert);
    setBadge('checking');
    updateStatusPill('Checking…');
    resetHealthStatus();
    let lastError = null;
    try {
      const response = await apiFetch('/status', { method: 'GET' });
      const data = await parseResponse(response);
      renderStatus(data);
      await fetchHealthStatus();
    } catch (err) {
      lastError = err;
      errorLog('Failed to fetch status', err);
      renderStatusError(err.message || 'Unable to fetch status.');
      await fetchHealthStatus();
    }
    if (lastError) {
      throw lastError;
    }
  }

  function renderSiteStats(stats) {
    if (!stats) return;
    if (dom.siteUsersTotal) dom.siteUsersTotal.textContent = stats.users?.total ?? '—';
    if (dom.siteUsersVerified) dom.siteUsersVerified.textContent = stats.users?.verified ?? '—';
    if (dom.siteUsersDisabled) dom.siteUsersDisabled.textContent = stats.users?.disabled ?? '—';
    if (dom.siteBooksTotal) dom.siteBooksTotal.textContent = stats.books?.total ?? '—';
    if (dom.siteBooksActive) dom.siteBooksActive.textContent = stats.books?.active ?? '—';
    if (dom.siteBooksDeleted) dom.siteBooksDeleted.textContent = stats.books?.deleted ?? '—';
    if (dom.siteAuthorsTotal) dom.siteAuthorsTotal.textContent = stats.library?.authors ?? '—';
    if (dom.sitePublishersTotal) dom.sitePublishersTotal.textContent = stats.library?.publishers ?? '—';
    if (dom.siteSeriesTotal) dom.siteSeriesTotal.textContent = stats.library?.series ?? '—';
    if (dom.siteBookTypesTotal) dom.siteBookTypesTotal.textContent = stats.library?.bookTypes ?? '—';
    if (dom.siteTagsTotal) dom.siteTagsTotal.textContent = stats.library?.tags ?? '—';
    if (dom.siteStorageTotal) dom.siteStorageTotal.textContent = stats.library?.storageLocations ?? '—';
  }

  async function fetchSiteStats() {
    try {
      const response = await apiFetch('/admin/stats/summary', { method: 'GET' });
      const data = await parseResponse(response);
      renderSiteStats(data?.stats);
      state.siteStatsLoaded = true;
    } catch (err) {
      errorLog('Failed to load site stats', err);
      showAlert(dom.siteStatsAlert, err.message || 'Unable to load site stats.');
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
      dom.usersTbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-3">No users found.</td></tr>';
      return;
    }

    const rows = state.users.map((user) => {
      const isSelf = state.currentUserId && user.id === state.currentUserId;
      const name = user.preferredName || user.fullName || '—';
      const languageCount = Number(user.languageCount) || 0;
      const librarySize = Number(user.librarySize) || 0;
      const usageScore = Number(user.usageScore) || 0;
      const usageRank = user.usageRank || '—';
      const lastActive = user.lastActive || user.lastLogin;
      const verified = user.isVerified ? '<span class="badge text-bg-success">Yes</span>' : '<span class="badge text-bg-secondary">No</span>';
      const disabled = user.isDisabled ? '<span class="badge text-bg-danger">Yes</span>' : '<span class="badge text-bg-success">No</span>';
      const disableLabel = user.isDisabled ? 'Enable account' : 'Disable account';
      const verifyLabel = user.isVerified ? 'Unverify' : 'Verify';
      const verificationActionClass = user.isVerified ? 'js-unverify-user' : 'js-verify-user';
      const roleBadge = user.role === 'admin'
        ? '<span class="badge text-bg-danger">Admin</span>'
        : '<span class="badge text-bg-secondary">User</span>';
      const apiKeyStatus = user.apiKeyStatus || 'None';
      const apiKeyStatusBadge = apiKeyStatus === 'Active'
        ? '<span class="badge text-bg-success">Active</span>'
        : apiKeyStatus === 'Revoked'
          ? '<span class="badge text-bg-warning">Revoked</span>'
          : '<span class="badge text-bg-secondary">None</span>';
      const apiKeySummary = `${apiKeyStatus} (${Number(user.apiKeyActiveCount) || 0} active)`;
      const banBadges = [
        user.apiKeyBanEnabled ? '<span class="badge text-bg-danger">API key blocked</span>' : '<span class="badge text-bg-secondary">API key clear</span>'
      ];
      if (user.usageLockoutUntil) {
        banBadges.push(`<span class="badge text-bg-warning">Usage lockout until ${escapeHtml(formatDateTime(user.usageLockoutUntil))}</span>`);
      } else {
        banBadges.push('<span class="badge text-bg-secondary">Usage clear</span>');
      }
      const emailPrefs = user.emailPreferences || {};
      const emailPrefsSummary = `${emailPrefs.accountUpdates ? 'Updates on' : 'Updates off'} · ${emailPrefs.devFeatures ? 'Dev on' : 'Dev off'}`;
      const disableTextClass = user.isDisabled ? 'text-success' : 'text-warning';
      const disableAttrs = isSelf ? 'disabled aria-disabled="true" title="You cannot disable your own account."' : '';
      const disableClasses = `${disableTextClass} js-toggle-disable${isSelf ? ' disabled' : ''}`;
      return `
        <tr data-user-id="${user.id}">
          <td>${user.id ?? '—'}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(user.email || '—')}</td>
          <td>
            <div class="fw-semibold">Languages: ${escapeHtml(languageCount.toLocaleString())}</div>
            <div class="text-muted small">Library size: ${escapeHtml(librarySize.toLocaleString())} books</div>
          </td>
          <td>
            <div class="fw-semibold">Last active: ${escapeHtml(formatDateTime(lastActive))}</div>
            <div class="text-muted small">Usage rank: ${escapeHtml(usageRank)} · Score ${escapeHtml(usageScore.toLocaleString())}</div>
          </td>
          <td>
            <div class="fw-semibold">API keys: ${apiKeyStatusBadge}</div>
            <div class="text-muted small">${escapeHtml(apiKeySummary)}</div>
            <div class="mt-1 d-flex flex-wrap gap-1">${banBadges.join(' ')}</div>
            <div class="text-muted small mt-1">Email prefs: ${escapeHtml(emailPrefsSummary)}</div>
          </td>
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
                  <button class="dropdown-item js-view-library" type="button" data-user-id="${user.id}">View library</button>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item ${verificationActionClass}" type="button" data-user-id="${user.id}">${verifyLabel}</button>
                  <button class="dropdown-item js-send-verification" type="button" data-user-id="${user.id}">Send verification email</button>
                  <button class="dropdown-item js-reset-password" type="button" data-user-id="${user.id}">Send password reset</button>
                  <button class="dropdown-item ${disableClasses}" type="button" data-user-id="${user.id}" data-disabled="${user.isDisabled}" ${disableAttrs}>${disableLabel}</button>
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
      dom.usersTbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-3">Loading users…</td></tr>';
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

  function setUsagePanel(panel) {
    const target = panel === 'usage' ? 'usage' : 'logs';
    state.usagePanel = target;
    document.querySelectorAll('[data-usage-panel]').forEach((node) => {
      const isActive = node.dataset.usagePanel === target;
      node.classList.toggle('d-none', !isActive);
    });
    dom.usageLogsNav?.querySelectorAll('button[data-usage-panel]')?.forEach((btn) => {
      const isActive = btn.dataset.usagePanel === target;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    if (target === 'logs') {
      ensureLogsInitialized().catch(() => {});
    } else {
      if (state.logsLiveEnabled) {
        stopLogsLive();
        if (dom.logsLiveToggle) dom.logsLiveToggle.checked = false;
      }
      ensureUsageInitialized();
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
    updateUrlSection(section);

    if (section === 'usage-logs' && state.authorized) {
      setUsagePanel(state.usagePanel || 'logs');
    } else if (section === 'emails' && state.authorized) {
      ensureEmailTypesLoaded().catch(() => {});
    } else if (section === 'data-tools' && state.authorized) {
      fetchDataViewerTables().catch(() => {});
    } else if (section === 'statistics' && state.authorized) {
      fetchSiteStats();
    } else if (state.logsLiveEnabled) {
      stopLogsLive();
      if (dom.logsLiveToggle) dom.logsLiveToggle.checked = false;
    }
  }

  function resolveSectionFromHash() {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('users')) return 'users';
    if (hash.includes('library') || hash.includes('language')) return 'libraries';
    if (hash.includes('email')) return 'emails';
    if (hash.includes('log') || hash.includes('usage')) return 'usage-logs';
    if (hash.includes('stats')) return 'statistics';
    if (hash.includes('data')) return 'data-tools';
    return null;
  }

  function resolveSectionFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const section = (params.get('section') || '').toLowerCase();
    if (['overview', 'statistics', 'users', 'libraries', 'emails', 'usage-logs', 'data-tools'].includes(section)) return section;
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
    const target = ['overview', 'statistics', 'users', 'libraries', 'emails', 'usage-logs', 'data-tools'].includes(stored) ? stored : 'overview';
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
    if (dom.createTokenExpiry) dom.createTokenExpiry.value = '';
    dom.createNoPassword.checked = false;
    dom.createFullNameHelp.textContent = '';
    dom.createPreferredNameHelp.textContent = '';
    dom.createEmailHelp.textContent = '';
    dom.createPasswordHelp.textContent = '';
    if (dom.createTokenExpiryHelp) dom.createTokenExpiryHelp.textContent = '';
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
      password: validatePassword(password, noPassword),
      duration: ''
    };

    const durationValue = dom.createTokenExpiry?.value.trim();
    if (durationValue) {
      const parsedDuration = Number.parseInt(durationValue, 10);
      if (!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 1440) {
        errors.duration = 'Token expiry must be between 1 and 1440 minutes.';
      }
    }

    dom.createFullNameHelp.textContent = errors.fullName;
    dom.createPreferredNameHelp.textContent = errors.preferredName;
    dom.createEmailHelp.textContent = errors.email;
    dom.createPasswordHelp.textContent = errors.password;
    if (dom.createTokenExpiryHelp) dom.createTokenExpiryHelp.textContent = errors.duration;

    const valid = !errors.fullName && !errors.email && !errors.password && !errors.duration && (password || noPassword);
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
    const durationRaw = dom.createTokenExpiry?.value.trim();
    if (durationRaw) body.duration = Number.parseInt(durationRaw, 10);
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
      announceSuccess('users', 'User created successfully.');
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
    const isSelf = state.currentUserId && user.id === state.currentUserId;
    if (dom.editRole) {
      dom.editRole.disabled = Boolean(isSelf);
      dom.editRole.title = isSelf ? 'You cannot change your own role.' : '';
    }
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

    const body = { id: state.currentEditingUser.id };
    const summaryItems = [];
    const before = state.currentEditingUser;
    const formatChange = (label, previousValue, nextValue) => {
      const prev = previousValue || '—';
      const next = nextValue || '—';
      if (prev === next) return null;
      return { label, value: `${prev} → ${next}` };
    };

    const fullNameChange = formatChange('Full name', before.fullName, fullName);
    if (fullNameChange) {
      body.fullName = fullName;
      summaryItems.push(fullNameChange);
    }
    const preferredChange = formatChange('Preferred name', before.preferredName || '', preferredName || '');
    if (preferredChange) {
      body.preferredName = preferredName || undefined;
      summaryItems.push(preferredChange);
    }
    const emailChange = formatChange('Email', before.email, email);
    if (emailChange) {
      body.email = email;
      summaryItems.push(emailChange);
    }
    const roleChange = formatChange('Role', before.role, role);
    if (roleChange) {
      body.role = role;
      summaryItems.push(roleChange);
    }

    const emailChanged = Boolean(emailChange);
    const noticeItems = [];
    if (emailChanged) {
      noticeItems.push('The new email address will be marked as unverified. You can verify it manually after saving.');
      noticeItems.push('This action will notify the user by email.');
    }
    const mergedSummaryItems = summaryItems.length ? [...summaryItems] : [{ label: 'Changes', value: 'No field changes detected.' }];
    noticeItems.forEach((note) => mergedSummaryItems.push({ label: 'Notice', value: note }));

    const impactBase = 'Profile fields will be updated and a notification email will be sent.';
    const impact = noticeItems.length ? `${impactBase} ${noticeItems.join(' ')}` : impactBase;
    const message = noticeItems.length ? `Update this user? ${noticeItems.join(' ')}` : 'Update this user? They will be notified by email after you confirm.';

    openConfirmAction({
      title: 'Confirm user update',
      actionLabel: 'Save changes',
      message,
      impact,
      willNotify: true,
      user: before,
      userId: before.id,
      url: '/admin/users',
      method: 'PUT',
      baseBody: body,
      summaryItems: mergedSummaryItems,
      onSuccess: 'users',
      successMessage: 'User updated successfully.',
      afterSuccess: () => {
        bootstrap.Modal.getInstance(dom.editUserModal)?.hide();
      }
    });
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

  function resetConfirmExpiry() {
    if (!dom.confirmActionExpiryWrap) return;
    dom.confirmActionExpiryWrap.classList.add('d-none');
    if (dom.confirmActionExpirySelect) dom.confirmActionExpirySelect.value = '';
    if (dom.confirmActionExpiryCustom) {
      dom.confirmActionExpiryCustom.value = '';
      dom.confirmActionExpiryCustom.classList.add('d-none');
    }
    if (dom.confirmActionExpiryHelp) dom.confirmActionExpiryHelp.textContent = '';
    if (dom.confirmActionSummaryExpiryRow) dom.confirmActionSummaryExpiryRow.classList.add('d-none');
    if (dom.confirmActionSummaryExpiry) dom.confirmActionSummaryExpiry.textContent = 'Default';
  }

  function configureConfirmExpiry(config) {
    resetConfirmExpiry();
    if (!config?.expiryEnabled || !dom.confirmActionExpiryWrap) return;
    dom.confirmActionExpiryWrap.classList.remove('d-none');
    if (dom.confirmActionSummaryExpiryRow) dom.confirmActionSummaryExpiryRow.classList.remove('d-none');
    const defaultMinutes = Number.isFinite(config.expiryDefaultMinutes) ? config.expiryDefaultMinutes : null;
    const defaultLabel = defaultMinutes ? `Use default (${defaultMinutes} minutes)` : 'Use default';
    const defaultOption = dom.confirmActionExpirySelect?.querySelector('option[value=""]');
    if (defaultOption) defaultOption.textContent = defaultLabel;
    if (dom.confirmActionSummaryExpiry) dom.confirmActionSummaryExpiry.textContent = 'Default';
  }

  function resolveConfirmExpirySelection() {
    if (dom.confirmActionExpiryWrap?.classList.contains('d-none')) {
      return { valid: true, minutes: null, label: 'Default', isDefault: true };
    }
    const choice = dom.confirmActionExpirySelect?.value || '';
    let minutes = null;
    let label = 'Default';
    if (choice === 'custom') {
      const customValue = Number.parseInt(dom.confirmActionExpiryCustom?.value, 10);
      if (!Number.isInteger(customValue) || customValue < 1 || customValue > 1440) {
        dom.confirmActionExpiryHelp.textContent = 'Enter a value between 1 and 1440 minutes.';
        return { valid: false };
      }
      minutes = customValue;
      label = `${customValue} minutes`;
    } else if (choice) {
      const parsed = Number.parseInt(choice, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1440) {
        dom.confirmActionExpiryHelp.textContent = 'Enter a value between 1 and 1440 minutes.';
        return { valid: false };
      }
      minutes = parsed;
      label = `${parsed} minutes`;
    }

    if (dom.confirmActionExpiryHelp) dom.confirmActionExpiryHelp.textContent = '';
    if (dom.confirmActionSummaryExpiry) dom.confirmActionSummaryExpiry.textContent = label || 'Default';
    return { valid: true, minutes, label: label || 'Default', isDefault: minutes === null };
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
      expiryEnabled: Boolean(config.expiryEnabled),
      expiryDefaultMinutes: config.expiryDefaultMinutes,
      summaryItems: Array.isArray(config.summaryItems) ? config.summaryItems : [],
      baseBody: config.baseBody,
      ...config,
      user: resolvedUser
    };

    hideAlert(dom.confirmActionAlert);
    dom.confirmActionTitle.textContent = state.confirmActionConfig.title;
    dom.confirmActionMessage.textContent = state.confirmActionConfig.message;
    if (dom.confirmActionSummaryUser) dom.confirmActionSummaryUser.innerHTML = userLabel;
    if (dom.confirmActionSummaryAction) dom.confirmActionSummaryAction.textContent = state.confirmActionConfig.actionLabel;
    if (dom.confirmActionSummaryImpact) dom.confirmActionSummaryImpact.textContent = state.confirmActionConfig.impact;
    if (dom.confirmActionNotifyBadge) {
      dom.confirmActionNotifyBadge.textContent = 'This action will notify the user by email.';
      dom.confirmActionNotifyBadge.classList.remove('text-bg-secondary');
      dom.confirmActionNotifyBadge.classList.add('text-bg-warning-subtle');
      dom.confirmActionNotifyBadge.classList.toggle('d-none', !state.confirmActionConfig.willNotify);
    }
    dom.confirmActionSummaryWarning?.classList.toggle('d-none', !state.confirmActionConfig.destructive);
    renderConfirmActionSummaryMeta(state.confirmActionConfig.summaryItems);
    if (dom.confirmActionSubmit) {
      dom.confirmActionSubmit.textContent = state.confirmActionConfig.confirmLabel;
      dom.confirmActionSubmit.classList.toggle('btn-danger', state.confirmActionConfig.destructive);
      dom.confirmActionSubmit.classList.toggle('btn-primary', !state.confirmActionConfig.destructive);
    }

    dom.confirmActionReasonWrap.classList.toggle('d-none', !state.confirmActionConfig.reasonRequired);
    dom.confirmActionEmailWrap.classList.toggle('d-none', !state.confirmActionConfig.emailRequired);
    configureConfirmExpiry(state.confirmActionConfig);
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
    validateConfirmAction();
    checkConfirmEmailPreferences();
  }

  function renderConfirmActionSummaryMeta(items = []) {
    if (!dom.confirmActionSummaryMeta) return;
    dom.confirmActionSummaryMeta.innerHTML = '';
    dom.confirmActionSummaryMeta.classList.add('d-none');
    if (items.length) {
      const metaRows = items.map((item) => `<div class="d-flex justify-content-between small"><span class="text-muted">${escapeHtml(item.label)}:</span><span class="fw-semibold">${escapeHtml(item.value)}</span></div>`).join('');
      dom.confirmActionSummaryMeta.innerHTML = metaRows;
      dom.confirmActionSummaryMeta.classList.remove('d-none');
    }
  }

  async function checkConfirmEmailPreferences() {
    const cfg = state.confirmActionConfig;
    if (!cfg?.emailType || !cfg?.userId) return;

    try {
      const response = await apiFetch('/admin/users/email-preferences/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: cfg.userId, emailType: cfg.emailType })
      });
      const data = await parseResponse(response);
      const willSend = data?.canSend;
      const statusLabel = willSend ? 'Will send' : 'Blocked by preferences';
      const reason = data?.reason ? ` • ${data.reason}` : '';
      const summaryItems = [...(cfg.summaryItems || [])];
      summaryItems.push({ label: 'Email delivery', value: `${statusLabel}${reason}` });
      renderConfirmActionSummaryMeta(summaryItems);
      if (dom.confirmActionNotifyBadge) {
        dom.confirmActionNotifyBadge.textContent = willSend
          ? 'This action will notify the user by email.'
          : 'Email will not be sent due to user preferences.';
        dom.confirmActionNotifyBadge.classList.toggle('text-bg-warning-subtle', willSend);
        dom.confirmActionNotifyBadge.classList.toggle('text-bg-secondary', !willSend);
      }
    } catch (err) {
      const summaryItems = [...(cfg.summaryItems || [])];
      summaryItems.push({ label: 'Email delivery', value: 'Unable to validate preferences' });
      renderConfirmActionSummaryMeta(summaryItems);
    }
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
    const expirySelection = resolveConfirmExpirySelection();
    if (expirySelection?.valid === false) {
      valid = false;
    } else if (cfg) {
      cfg.expirySelection = expirySelection;
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

    const body = cfg.baseBody ? { ...cfg.baseBody } : { id: cfg.userId };
    if (cfg.userId && body.id == null) {
      body.id = cfg.userId;
    }
    if (cfg.reasonRequired) body.reason = dom.confirmActionReason.value.trim();
    if (cfg.emailRequired) {
      const emailValue = dom.confirmActionEmail.value.trim();
      if (cfg.emailFieldName) {
        body[cfg.emailFieldName] = emailValue;
      } else {
        body.userToBeDeletedEmail = emailValue;
      }
    }
    if (cfg.confirmFlag) body.confirm = true;
    const expirySelection = cfg.expirySelection;
    if (cfg.expiryEnabled && expirySelection && expirySelection.minutes !== null) {
      const expiryField = cfg.expiryFieldName || 'duration';
      body[expiryField] = expirySelection.minutes;
    }

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
      if (cfg.successMessage) announceSuccess(cfg.successTarget || cfg.onSuccess || 'users', cfg.successMessage);
      if (typeof cfg.afterSuccess === 'function') cfg.afterSuccess();
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
      const response = await apiFetch('/admin/users/sessions', { method: 'POST', body: { id: userId } });
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

    if (btn.classList.contains('js-view-library')) {
      const userName = user?.preferredName || user?.fullName || '';
      const url = `admin-library?userId=${encodeURIComponent(userId)}${userName ? `&userName=${encodeURIComponent(userName)}` : ''}`;
      window.location.href = url;
      return;
    }

    if (btn.classList.contains('js-toggle-disable')) {
      const isDisabled = btn.dataset.disabled === 'true';
      if (state.currentUserId && userId === state.currentUserId) {
        showAlert(dom.usersAlert, 'You cannot disable your own account.');
        return;
      }
      openConfirmAction({
        title: `${isDisabled ? 'Enable' : 'Disable'} user`,
        actionLabel: isDisabled ? 'Enable user' : 'Disable user',
        message: isDisabled ? 'Re-enable this account and allow logins?' : 'Disable this account and revoke active sessions?',
        impact: isDisabled ? 'Account will be restored and login allowed. A notification email will be sent.' : 'Account will be disabled and active sessions revoked. A notification email will be sent.',
        willNotify: true,
        emailType: isDisabled ? 'admin_account_enabled' : 'admin_account_disabled',
        destructive: !isDisabled,
        confirmText: isDisabled ? '' : 'DISABLE',
        user,
        userId,
        url: isDisabled ? '/admin/users/enable' : '/admin/users',
        method: isDisabled ? 'POST' : 'DELETE',
        reasonRequired: false,
        emailRequired: false,
        onSuccess: 'users',
        successMessage: isDisabled ? 'User enabled successfully.' : 'User disabled and sessions revoked.'
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
        emailType: 'admin_email_verified',
        user,
        userId,
        url: '/admin/users/verify',
        method: 'POST',
        reasonRequired: true,
        emailRequired: true,
        emailFieldName: 'email',
        prefillEmail: user?.email || '',
        onSuccess: 'users',
        successMessage: 'User verified successfully.'
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
        emailType: 'admin_email_unverified',
        user,
        userId,
        url: '/admin/users/unverify',
        method: 'POST',
        reasonRequired: true,
        emailRequired: true,
        emailFieldName: 'email',
        prefillEmail: user?.email || '',
        onSuccess: 'users',
        successMessage: 'User unverified successfully.'
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
        emailType: 'verification',
        user,
        userId,
        url: '/admin/users/send-verification',
        method: 'POST',
        onSuccess: 'users',
        cooldownKey,
        emailRequired: true,
        emailFieldName: 'email',
        prefillEmail: user?.email || '',
        expiryEnabled: true,
        expiryDefaultMinutes: 30,
        successMessage: 'Verification email sent successfully.'
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
        emailType: 'password_reset',
        user,
        userId,
        url: '/admin/users/reset-password',
        method: 'POST',
        onSuccess: 'users',
        cooldownKey,
        emailRequired: true,
        emailFieldName: 'email',
        prefillEmail: user?.email || '',
        expiryEnabled: true,
        expiryDefaultMinutes: 30,
        successMessage: 'Password reset email sent successfully.'
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
        url: '/admin/users/force-logout',
        method: 'POST',
        onSuccess: 'users',
        successMessage: 'All sessions revoked successfully.'
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
        url: '/admin/users/handle-account-deletion',
        method: 'POST',
        reasonRequired: true,
        emailRequired: true,
        confirmText: 'DELETE',
        confirmFlag: true,
        prefillEmail: user?.email || '',
        onSuccess: 'users',
        successMessage: 'Account deletion flow submitted.'
      });
    }
  }

  function handleConfirmActionModalInput() {
    validateConfirmAction();
  }

  function handleConfirmExpirySelectChange() {
    if (!dom.confirmActionExpirySelect) return;
    const isCustom = dom.confirmActionExpirySelect.value === 'custom';
    if (dom.confirmActionExpiryCustom) dom.confirmActionExpiryCustom.classList.toggle('d-none', !isCustom);
    validateConfirmAction();
  }

  function handleConfirmExpiryCustomInput() {
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
      url: '/admin/users/force-logout',
      method: 'POST',
      onSuccess: 'sessions',
      successMessage: 'All sessions revoked successfully.'
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
        announceSuccess('languages', 'Language updated successfully.');
      } else {
        const response = await apiFetch('/admin/languages', { method: 'POST', body: { name } });
        await parseResponse(response);
        announceSuccess('languages', 'Language created successfully.');
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
      announceSuccess('languages', 'Language deleted successfully.');
      await fetchLanguages();
    } catch (err) {
      showApiError(dom.languageDeleteAlert, err);
    } finally {
      setModalInteractivity(dom.languageDeleteModal, false);
      validateLanguageDelete();
    }
  }

  function resetLogsTablePlaceholder() {
    if (dom.logsTbody) dom.logsTbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">Loading logs…</td></tr>';
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
      actorType: dom.logsActorFilter?.value || '',
      path: dom.logsPathFilter?.value.trim() || '',
      userId: dom.logsUserIdFilter?.value ? Number(dom.logsUserIdFilter.value) : null,
      userEmail: dom.logsUserEmailFilter?.value.trim() || '',
      apiKeyId: dom.logsApiKeyIdFilter?.value ? Number(dom.logsApiKeyIdFilter.value) : null,
      apiKeyLabel: dom.logsApiKeyLabelFilter?.value.trim() || '',
      apiKeyPrefix: dom.logsApiKeyPrefixFilter?.value.trim() || '',
      statusMin: dom.logsStatusMin?.value ? Number(dom.logsStatusMin.value) : null,
      statusMax: dom.logsStatusMax?.value ? Number(dom.logsStatusMax.value) : null,
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
      || filters.actorType
      || filters.path
      || Number.isFinite(filters.userId)
      || filters.userEmail
      || Number.isFinite(filters.apiKeyId)
      || filters.apiKeyLabel
      || filters.apiKeyPrefix
      || Number.isFinite(filters.statusMin)
      || Number.isFinite(filters.statusMax)
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
      dom.logsTbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">No logs found.</td></tr>';
      return;
    }

    const rows = state.logs.map((log, index) => {
      const rawMessage = log.error_summary || log.message || '—';
      const message = String(rawMessage);
      const status = log.status_code || '—';
      const actor = log.actor_type || '—';
      const actorLabel = log.actor_type === 'api_key'
        ? `${log.user_email || 'API key'} · ${log.api_key_label || log.api_key_prefix || 'unknown'}`
        : (log.user_email || log.user_id || 'anonymous');
      const typeBadge = renderLogBadge(log.category || '', 'type');
      const levelBadge = renderLogBadge(log.level || '', 'level');
      const statusBadge = renderLogBadge(status, 'status');
      const pathText = [log.method, log.path].filter(Boolean).join(' ');
      const detailText = log.api_key_id
        ? `Key ${log.api_key_id}`
        : (log.user_id ? `User ${log.user_id}` : 'Anonymous');
      return `
        <tr>
          <td>${formatDateTime(log.logged_at)}</td>
          <td>${levelBadge}</td>
          <td>${typeBadge}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(actorLabel)}</div>
            <div class="text-muted small">${escapeHtml(detailText)}</div>
          </td>
          <td title="${escapeHtml(message)}">${escapeHtml(message.length > 80 ? `${message.slice(0, 77)}…` : message)}</td>
          <td title="${escapeHtml(pathText)}">${escapeHtml(pathText || '—')}</td>
          <td>${Number.isFinite(log.duration_ms) ? `${log.duration_ms} ms` : '—'}</td>
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
          category: filters.type || undefined,
          level: filters.level || undefined,
          method: filters.method || undefined,
          actorType: filters.actorType || undefined,
          path: filters.path || undefined,
          userId: Number.isFinite(filters.userId) ? filters.userId : undefined,
          userEmail: filters.userEmail || undefined,
          apiKeyId: Number.isFinite(filters.apiKeyId) ? filters.apiKeyId : undefined,
          apiKeyLabel: filters.apiKeyLabel || undefined,
          apiKeyPrefix: filters.apiKeyPrefix || undefined,
          statusCodeMin: Number.isFinite(filters.statusMin) ? filters.statusMin : (filters.status || undefined),
          statusCodeMax: Number.isFinite(filters.statusMax) ? filters.statusMax : (filters.status || undefined),
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
      dom.logsTbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">Unable to load logs.</td></tr>';
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
    if (dom.logsActorFilter) dom.logsActorFilter.value = '';
    if (dom.logsPathFilter) dom.logsPathFilter.value = '';
    if (dom.logsUserIdFilter) dom.logsUserIdFilter.value = '';
    if (dom.logsUserEmailFilter) dom.logsUserEmailFilter.value = '';
    if (dom.logsApiKeyIdFilter) dom.logsApiKeyIdFilter.value = '';
    if (dom.logsApiKeyLabelFilter) dom.logsApiKeyLabelFilter.value = '';
    if (dom.logsApiKeyPrefixFilter) dom.logsApiKeyPrefixFilter.value = '';
    if (dom.logsStatusMin) dom.logsStatusMin.value = '';
    if (dom.logsStatusMax) dom.logsStatusMax.value = '';
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
    dom.logsDetailTitle.textContent = `Log · ${formatDateTime(logEntry.logged_at)}`;

    const requestPreview = logEntry.body_truncated
      ? `${typeof logEntry.body === 'string' ? logEntry.body : JSON.stringify(logEntry.body)}\n(truncated)`
      : (logEntry.body ? JSON.stringify(logEntry.body, null, 2) : '—');
    const responsePreview = logEntry.response_truncated
      ? `${typeof logEntry.response_body === 'string' ? logEntry.response_body : JSON.stringify(logEntry.response_body)}\n(truncated)`
      : (logEntry.response_body ? JSON.stringify(logEntry.response_body, null, 2) : '—');

    const actorLabel = logEntry.actor_type === 'api_key'
      ? `${logEntry.user_email || 'API key'} · ${logEntry.api_key_label || logEntry.api_key_prefix || 'unknown'}`
      : (logEntry.user_email || logEntry.user_id || 'anonymous');

    const fields = [
      { label: 'Timestamp', value: formatDateTime(logEntry.logged_at) },
      { label: 'Category', value: logEntry.category || '—' },
      { label: 'Level', value: logEntry.level || '—' },
      { label: 'Status code', value: logEntry.status_code || '—' },
      { label: 'Correlation id', value: logEntry.correlation_id || '—' },
      { label: 'Actor', value: actorLabel },
      { label: 'Actor type', value: logEntry.actor_type || '—' },
      { label: 'API key id', value: logEntry.api_key_id || '—' },
      { label: 'HTTP', value: [logEntry.method, logEntry.path].filter(Boolean).join(' ') || '—' },
      { label: 'Route pattern', value: logEntry.route_pattern || '—' },
      { label: 'IP', value: logEntry.ip || '—' },
      { label: 'User Agent', value: logEntry.user_agent || '—' },
      { label: 'Duration (ms)', value: logEntry.duration_ms ?? '—' },
      { label: 'Request bytes', value: logEntry.request_bytes ?? '—' },
      { label: 'Response bytes', value: logEntry.response_bytes ?? '—' },
      { label: 'Request body', value: requestPreview, isPre: true },
      { label: 'Response body', value: responsePreview, isPre: true }
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

  async function copyLogRequest() {
    if (!state.currentLogDetail) return;
    try {
      const payload = JSON.stringify(state.currentLogDetail.body ?? {}, null, 2);
      await navigator.clipboard.writeText(payload);
    } catch (err) {
      errorLog('[Admin][Logs] Copy request failed', err);
      showApiError(dom.logsDetailAlert, err);
    }
  }

  async function copyLogResponse() {
    if (!state.currentLogDetail) return;
    try {
      const payload = JSON.stringify(state.currentLogDetail.response_body ?? {}, null, 2);
      await navigator.clipboard.writeText(payload);
    } catch (err) {
      errorLog('[Admin][Logs] Copy response failed', err);
      showApiError(dom.logsDetailAlert, err);
    }
  }

  async function copyCorrelationId() {
    if (!state.currentLogDetail) return;
    try {
      const payload = state.currentLogDetail.correlation_id || '';
      await navigator.clipboard.writeText(payload);
    } catch (err) {
      errorLog('[Admin][Logs] Copy correlation id failed', err);
      showApiError(dom.logsDetailAlert, err);
    }
  }

  function getUsageBaseFilters() {
    const startDate = normalizeDateTimeLocalToIso(dom.usageDateFrom?.value);
    const endDate = normalizeDateTimeLocalToIso(dom.usageDateTo?.value);
    const sortBy = dom.usageSortBy?.value || 'usageScore';
    const order = dom.usageSortOrder?.value || 'desc';
    const rawTop = Number.parseInt(dom.usageTopLimit?.value, 10);
    const topLimit = Number.isInteger(rawTop) ? Math.min(Math.max(rawTop, 1), 15) : 5;
    if (dom.usageTopLimit) dom.usageTopLimit.value = String(topLimit);
    return { startDate, endDate, sortBy, order, topLimit };
  }

  function getUsageUserFilters() {
    return {
      userId: dom.usageUserId?.value ? Number(dom.usageUserId.value) : null,
      email: dom.usageUserEmail?.value.trim() || '',
      path: dom.usageUserPath?.value.trim() || ''
    };
  }

  function getUsageApiKeyFilters() {
    return {
      apiKeyId: dom.usageApiKeyId?.value ? Number(dom.usageApiKeyId.value) : null,
      apiKeyLabel: dom.usageApiKeyLabel?.value.trim() || '',
      email: dom.usageApiKeyEmail?.value.trim() || ''
    };
  }

  function renderUsageLevelBadge(level) {
    if (!level) return '<span class="badge text-bg-secondary">Low</span>';
    const normalized = String(level).toLowerCase();
    const classMap = {
      low: 'text-bg-success',
      medium: 'text-bg-warning',
      high: 'text-bg-danger',
      'very high': 'text-bg-dark'
    };
    const className = classMap[normalized] || 'text-bg-secondary';
    return `<span class="badge ${className}">${escapeHtml(level)}</span>`;
  }

  function renderUsageEndpoints(endpoints) {
    if (!Array.isArray(endpoints) || !endpoints.length) {
      return '<span class="text-muted">—</span>';
    }
    return endpoints.map((endpoint) => {
      const label = [endpoint.method, endpoint.path].filter(Boolean).join(' ');
      const count = Number.isFinite(endpoint.count) ? endpoint.count : 0;
      return `<div class="small"><span class="fw-semibold">${escapeHtml(label || '—')}</span> <span class="text-muted">× ${count}</span></div>`;
    }).join('');
  }

  function updateUsageSummary(el, count, window) {
    if (!el) return;
    if (!count) {
      el.textContent = 'No usage found for this window.';
      return;
    }
    const start = window?.startDate ? formatDateTime(window.startDate) : '—';
    const end = window?.endDate ? formatDateTime(window.endDate) : '—';
    el.textContent = `Showing ${count} entries · ${start} → ${end}`;
  }

  function resolveUsageUser(userId, email) {
    const match = Number.isInteger(userId) ? state.users.find((user) => user.id === userId) : null;
    if (match) return match;
    return { id: userId ?? '—', fullName: email || 'User', email: email || '—' };
  }

  function renderUsageUsers(users, window) {
    state.usageUsers = Array.isArray(users) ? users : [];
    if (!dom.usageUsersTbody) return;
    if (!state.usageUsers.length) {
      dom.usageUsersTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No usage found.</td></tr>';
      updateUsageSummary(dom.usageUsersSummary, 0, window);
      return;
    }

    const rows = state.usageUsers.map((user, index) => {
      const userId = Number.isInteger(user.userId) ? user.userId : null;
      const resolved = resolveUsageUser(userId, user.email);
      const displayName = resolved.preferredName || resolved.fullName || resolved.email || 'User';
      const emailText = resolved.email || user.email || '—';
      const roleText = user.role ? ` · ${user.role}` : '';
      const score = Number.isFinite(user.usageScore) ? user.usageScore : 0;
      const requests = Number.isFinite(user.requestCount) ? user.requestCount : 0;
      const levelBadge = renderUsageLevelBadge(user.usageLevel || 'Low');
      const lastSeen = formatDateTime(user.lastSeen);
      const topEndpoints = renderUsageEndpoints(user.topEndpoints);
      const dropdown = userId ? `
        <div class="dropdown">
          <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">Actions</button>
          <div class="dropdown-menu dropdown-menu-end">
            <button class="dropdown-item" type="button" data-usage-action="ban" data-user-id="${userId}" data-user-email="${escapeHtml(emailText)}">Block API key creation</button>
            <button class="dropdown-item" type="button" data-usage-action="unban" data-user-id="${userId}" data-user-email="${escapeHtml(emailText)}">Allow API key creation</button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item" type="button" data-usage-action="lockout" data-user-id="${userId}" data-user-email="${escapeHtml(emailText)}">Apply usage lockout</button>
            <button class="dropdown-item" type="button" data-usage-action="lockout-clear" data-user-id="${userId}" data-user-email="${escapeHtml(emailText)}">Clear usage lockout</button>
          </div>
        </div>
      ` : '<span class="text-muted">—</span>';

      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(displayName)}</div>
            <div class="text-muted small">${escapeHtml(emailText)}${escapeHtml(roleText)}</div>
          </td>
          <td>
            <div class="fw-semibold">${score}</div>
            <div class="mt-1">${levelBadge}</div>
          </td>
          <td>${requests}</td>
          <td>${topEndpoints}</td>
          <td>${lastSeen}</td>
          <td>${dropdown}</td>
        </tr>
      `;
    }).join('');

    dom.usageUsersTbody.innerHTML = rows;
    updateUsageSummary(dom.usageUsersSummary, state.usageUsers.length, window);
  }

  function renderUsageApiKeys(keys, window) {
    state.usageApiKeys = Array.isArray(keys) ? keys : [];
    if (!dom.usageApiKeysTbody) return;
    if (!state.usageApiKeys.length) {
      dom.usageApiKeysTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No usage found.</td></tr>';
      updateUsageSummary(dom.usageApiKeysSummary, 0, window);
      return;
    }

    const rows = state.usageApiKeys.map((key, index) => {
      const apiKeyId = Number.isInteger(key.apiKeyId) ? key.apiKeyId : null;
      const userId = Number.isInteger(key.userId) ? key.userId : null;
      const keyLabel = key.apiKeyLabel || 'API key';
      const keyPrefix = key.apiKeyPrefix ? `(${key.apiKeyPrefix})` : '';
      const userEmail = key.email || '—';
      const score = Number.isFinite(key.usageScore) ? key.usageScore : 0;
      const requests = Number.isFinite(key.requestCount) ? key.requestCount : 0;
      const levelBadge = renderUsageLevelBadge(key.usageLevel || 'Low');
      const lastSeen = formatDateTime(key.lastSeen);
      const topEndpoints = renderUsageEndpoints(key.topEndpoints);
      const dropdown = apiKeyId ? `
        <div class="dropdown">
          <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">Actions</button>
          <div class="dropdown-menu dropdown-menu-end">
            <button class="dropdown-item text-danger" type="button" data-usage-action="revoke-key" data-api-key-id="${apiKeyId}" data-api-key-label="${escapeHtml(keyLabel)}" data-api-key-prefix="${escapeHtml(key.apiKeyPrefix || '')}" data-user-id="${userId || ''}" data-user-email="${escapeHtml(userEmail)}">Revoke API key</button>
            ${userId ? '<div class="dropdown-divider"></div>' : ''}
            ${userId ? `<button class="dropdown-item" type="button" data-usage-action="ban" data-user-id="${userId}" data-user-email="${escapeHtml(userEmail)}">Block API key creation</button>` : ''}
            ${userId ? `<button class="dropdown-item" type="button" data-usage-action="unban" data-user-id="${userId}" data-user-email="${escapeHtml(userEmail)}">Allow API key creation</button>` : ''}
            ${userId ? '<div class="dropdown-divider"></div>' : ''}
            ${userId ? `<button class="dropdown-item" type="button" data-usage-action="lockout" data-user-id="${userId}" data-user-email="${escapeHtml(userEmail)}">Apply usage lockout</button>` : ''}
            ${userId ? `<button class="dropdown-item" type="button" data-usage-action="lockout-clear" data-user-id="${userId}" data-user-email="${escapeHtml(userEmail)}">Clear usage lockout</button>` : ''}
          </div>
        </div>
      ` : '<span class="text-muted">—</span>';

      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(keyLabel)} ${escapeHtml(keyPrefix)}</div>
            <div class="text-muted small">ID ${apiKeyId ?? '—'}</div>
          </td>
          <td>
            <div class="fw-semibold">${escapeHtml(userEmail)}</div>
            <div class="text-muted small">User ${userId ?? '—'}</div>
          </td>
          <td>
            <div class="fw-semibold">${score}</div>
            <div class="mt-1">${levelBadge}</div>
          </td>
          <td>${requests}</td>
          <td>${topEndpoints}</td>
          <td>${lastSeen}</td>
          <td>${dropdown}</td>
        </tr>
      `;
    }).join('');

    dom.usageApiKeysTbody.innerHTML = rows;
    updateUsageSummary(dom.usageApiKeysSummary, state.usageApiKeys.length, window);
  }

  async function fetchUsageUsers() {
    if (!state.authorized) return;
    hideAlert(dom.usageAlert);
    if (dom.usageUsersTbody) dom.usageUsersTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Loading usage…</td></tr>';
    const base = getUsageBaseFilters();
    const filters = getUsageUserFilters();
    const body = {
      startDate: base.startDate || undefined,
      endDate: base.endDate || undefined,
      sortBy: base.sortBy,
      order: base.order,
      topLimit: base.topLimit,
      limit: 25,
      offset: 0,
      userId: Number.isInteger(filters.userId) ? filters.userId : undefined,
      email: filters.email || undefined,
      path: filters.path || undefined
    };

    try {
      const response = await apiFetch('/admin/usage/users', { method: 'POST', body });
      const data = await parseResponse(response);
      renderUsageUsers(data?.users || [], data?.window);
    } catch (err) {
      errorLog('[Admin][Usage] Failed to fetch user usage', err);
      showApiError(dom.usageAlert, err);
      if (dom.usageUsersTbody) dom.usageUsersTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Unable to load usage.</td></tr>';
    }
  }

  async function fetchUsageApiKeys() {
    if (!state.authorized) return;
    hideAlert(dom.usageAlert);
    if (dom.usageApiKeysTbody) dom.usageApiKeysTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">Loading usage…</td></tr>';
    const base = getUsageBaseFilters();
    const filters = getUsageApiKeyFilters();
    const body = {
      startDate: base.startDate || undefined,
      endDate: base.endDate || undefined,
      sortBy: base.sortBy,
      order: base.order,
      topLimit: base.topLimit,
      limit: 25,
      offset: 0,
      apiKeyId: Number.isInteger(filters.apiKeyId) ? filters.apiKeyId : undefined,
      apiKeyLabel: filters.apiKeyLabel || undefined,
      email: filters.email || undefined
    };

    try {
      const response = await apiFetch('/admin/usage/api-keys', { method: 'POST', body });
      const data = await parseResponse(response);
      renderUsageApiKeys(data?.apiKeys || [], data?.window);
    } catch (err) {
      errorLog('[Admin][Usage] Failed to fetch API key usage', err);
      showApiError(dom.usageAlert, err);
      if (dom.usageApiKeysTbody) dom.usageApiKeysTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">Unable to load usage.</td></tr>';
    }
  }

  async function refreshUsage({ usersOnly = false, apiKeysOnly = false } = {}) {
    hideAlert(dom.usageAlert);
    const tasks = [];
    if (!apiKeysOnly) tasks.push(fetchUsageUsers());
    if (!usersOnly) tasks.push(fetchUsageApiKeys());
    await Promise.all(tasks);
    state.usageInitialized = true;
  }

  function ensureUsageInitialized() {
    if (state.usageInitialized) return;
    refreshUsage().catch(() => {});
  }

  function handleUsageActionClick(event) {
    const btn = event.target.closest('button[data-usage-action]');
    if (!btn) return;
    const action = btn.dataset.usageAction;
    const userId = btn.dataset.userId ? Number(btn.dataset.userId) : null;
    const userEmail = btn.dataset.userEmail || '';
    const apiKeyId = btn.dataset.apiKeyId ? Number(btn.dataset.apiKeyId) : null;
    const apiKeyLabel = btn.dataset.apiKeyLabel || '';
    const apiKeyPrefix = btn.dataset.apiKeyPrefix || '';

    if (action === 'revoke-key' && Number.isInteger(apiKeyId)) {
      const resolvedUser = resolveUsageUser(userId, userEmail);
      const resolvedUserId = Number.isInteger(userId) ? userId : undefined;
      openConfirmAction({
        title: 'Revoke API key',
        actionLabel: 'Revoke API key',
        message: 'Revoke this API key? This action cannot be undone.',
        impact: 'The key will stop working immediately. A notification email will be sent.',
        willNotify: true,
        emailType: 'api_key_revoked',
        destructive: true,
        confirmText: 'REVOKE',
        user: resolvedUser,
        userId: resolvedUserId,
        baseBody: { id: apiKeyId },
        url: `/admin/api-keys/${apiKeyId}/revoke`,
        method: 'POST',
        summaryItems: [
          { label: 'API key', value: `${apiKeyLabel || 'API key'} ${apiKeyPrefix ? `(${apiKeyPrefix})` : ''}`.trim() },
          { label: 'API key id', value: String(apiKeyId) }
        ],
        afterSuccess: () => refreshUsage().catch(() => {})
      });
      return;
    }

    if (!Number.isInteger(userId)) return;
    const resolvedUser = resolveUsageUser(userId, userEmail);

    if (action === 'ban') {
      openConfirmAction({
        title: 'Block API key creation',
        actionLabel: 'Block API key creation',
        message: 'Block this user from creating new API keys?',
        impact: 'New API keys will be blocked. Existing API keys will keep working. A notification email will be sent.',
        willNotify: true,
        emailType: 'api_key_ban_applied',
        destructive: true,
        reasonRequired: true,
        user: resolvedUser,
        userId,
        url: '/admin/users/api-key-ban',
        method: 'POST',
        afterSuccess: () => refreshUsage().catch(() => {})
      });
      return;
    }

    if (action === 'unban') {
      openConfirmAction({
        title: 'Allow API key creation',
        actionLabel: 'Allow API key creation',
        message: 'Allow this user to create new API keys again?',
        impact: 'New API keys will be allowed. A notification email will be sent.',
        willNotify: true,
        emailType: 'api_key_ban_removed',
        user: resolvedUser,
        userId,
        url: '/admin/users/api-key-unban',
        method: 'POST',
        afterSuccess: () => refreshUsage().catch(() => {})
      });
      return;
    }

    if (action === 'lockout') {
      openConfirmAction({
        title: 'Apply usage lockout',
        actionLabel: 'Apply usage lockout',
        message: 'Apply a temporary usage lockout for this user?',
        impact: 'All requests will be blocked until the lockout expires. A notification email will be sent.',
        willNotify: true,
        emailType: 'usage_restriction_applied',
        destructive: true,
        reasonRequired: true,
        expiryEnabled: true,
        expiryDefaultMinutes: 60,
        expiryFieldName: 'durationMinutes',
        user: resolvedUser,
        userId,
        baseBody: { durationMinutes: 60 },
        url: '/admin/users/usage-lockout',
        method: 'POST',
        afterSuccess: () => refreshUsage().catch(() => {})
      });
      return;
    }

    if (action === 'lockout-clear') {
      openConfirmAction({
        title: 'Clear usage lockout',
        actionLabel: 'Clear usage lockout',
        message: 'Clear the usage lockout for this user?',
        impact: 'Requests will be allowed again immediately. A notification email will be sent.',
        willNotify: true,
        emailType: 'usage_restriction_removed',
        user: resolvedUser,
        userId,
        url: '/admin/users/usage-lockout/clear',
        method: 'POST',
        afterSuccess: () => refreshUsage().catch(() => {})
      });
    }
  }

  function renderEmailTypes(types) {
    state.emailTypes = Array.isArray(types) ? types : [];
    if (!dom.emailTypeSelect) return;
    const options = ['<option value="">Select an email type</option>', ...state.emailTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)];
    dom.emailTypeSelect.innerHTML = options.join('');
  }

  async function fetchEmailTypes(force = false) {
    if (state.emailTypesLoading) return;
    if (!force && state.emailTypesLoaded) return;
    state.emailTypesLoading = true;
    hideAlert(dom.emailsAlert);
    try {
      const response = await apiFetch('/admin/emails/types', { method: 'GET' });
      const data = await parseResponse(response);
      renderEmailTypes(data?.types || data?.emailTypes || []);
      state.emailTypesLoaded = true;
    } catch (err) {
      state.emailTypesLoaded = false;
      showApiError(dom.emailsAlert, err);
      throw err;
    } finally {
      state.emailTypesLoading = false;
    }
  }

  async function ensureEmailTypesLoaded() {
    if (state.emailTypesLoaded || state.emailTypesLoading) return;
    await fetchEmailTypes(true);
  }

  function resetEmailForm() {
    clearSuccess(dom.emailsSuccess);
    hideAlert(dom.emailsAlert);
    if (dom.emailTypeSelect) dom.emailTypeSelect.value = '';
    if (dom.emailRecipientInput) dom.emailRecipientInput.value = '';
    if (dom.emailRecipientHelp) dom.emailRecipientHelp.textContent = '';
    if (dom.emailContextInput) dom.emailContextInput.value = '';
    if (dom.emailContextHelp) dom.emailContextHelp.textContent = '';
    if (dom.emailTokenExpirySelect) dom.emailTokenExpirySelect.value = '';
    if (dom.emailTokenExpiryCustom) {
      dom.emailTokenExpiryCustom.value = '';
      dom.emailTokenExpiryCustom.classList.add('d-none');
    }
    if (dom.emailTokenExpiryHelp) dom.emailTokenExpiryHelp.textContent = '';
    updateEmailDefaultExpiryOption('');
    toggleSubmit(dom.emailSendTestBtn, false);
  }

  function resolveEmailExpirySelection() {
    const defaultLabel = state.emailDefaultExpiryLabel || 'Default';
    if (!dom.emailTokenExpirySelect) return { valid: true, minutes: null, label: defaultLabel, isDefault: true };
    const value = dom.emailTokenExpirySelect.value;
    if (value === 'custom') {
      const customVal = Number.parseInt(dom.emailTokenExpiryCustom?.value, 10);
      if (!Number.isInteger(customVal) || customVal < 1 || customVal > 1440) {
        dom.emailTokenExpiryHelp.textContent = 'Enter a value between 1 and 1440 minutes.';
        return { valid: false };
      }
      dom.emailTokenExpiryHelp.textContent = '';
      return { valid: true, minutes: customVal, label: `${customVal} minutes`, isDefault: false };
    }
    if (value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1440) {
        dom.emailTokenExpiryHelp.textContent = 'Enter a value between 1 and 1440 minutes.';
        return { valid: false };
      }
      dom.emailTokenExpiryHelp.textContent = '';
      return { valid: true, minutes: parsed, label: `${parsed} minutes`, isDefault: false };
    }
    dom.emailTokenExpiryHelp.textContent = '';
    return { valid: true, minutes: null, label: defaultLabel, isDefault: true };
  }

  function validateEmailTestForm() {
    const emailType = dom.emailTypeSelect?.value || '';
    const recipient = dom.emailRecipientInput?.value.trim() || '';
    const emailError = validateEmail(recipient);
    if (dom.emailRecipientHelp) dom.emailRecipientHelp.textContent = recipient ? emailError : '';
    const expirySelection = resolveEmailExpirySelection();
    let contextValid = true;
    if (dom.emailContextHelp) dom.emailContextHelp.textContent = '';
    const contextRaw = dom.emailContextInput?.value.trim();
    if (contextRaw) {
      try {
        JSON.parse(contextRaw);
      } catch (err) {
        if (dom.emailContextHelp) dom.emailContextHelp.textContent = 'Context must be valid JSON.';
        contextValid = false;
      }
    }
    const valid = !!emailType && !emailError && expirySelection?.valid !== false && contextValid;
    toggleSubmit(dom.emailSendTestBtn, valid);
    return { valid, emailType, recipient, expirySelection, contextRaw };
  }

  function handleEmailFormChange() {
    const selectedType = dom.emailTypeSelect?.value || '';
    updateEmailDefaultExpiryOption(selectedType);
    validateEmailTestForm();
  }

  function handleEmailExpirySelectChange() {
    if (!dom.emailTokenExpirySelect) return;
    const isCustom = dom.emailTokenExpirySelect.value === 'custom';
    if (dom.emailTokenExpiryCustom) dom.emailTokenExpiryCustom.classList.toggle('d-none', !isCustom);
    validateEmailTestForm();
  }

  function handleEmailExpiryCustomInput() {
    validateEmailTestForm();
  }

  function handleEmailReset() {
    resetEmailForm();
  }

  function parseContextValue(raw) {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return undefined;
    }
  }

  function renderMarkdownToHtml(markdown = '') {
    const escaped = escapeHtml(markdown || '');
    const bolded = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const italicized = bolded.replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, '$1<em>$2</em>');
    const paragraphs = italicized
      .split(/\n\n+/)
      .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
      .join('');
    return paragraphs || '<p>&nbsp;</p>';
  }

  function updateDevEmailPreview(body) {
    if (!dom.devEmailPreview) return;
    const html = renderMarkdownToHtml(body || '');
    dom.devEmailPreview.innerHTML = html;
  }

  function handleEmailSendTest() {
    const validation = validateEmailTestForm();
    if (!validation.valid) return;
    const { emailType, recipient, expirySelection, contextRaw } = validation;
    const contextObj = parseContextValue(contextRaw);
    const baseBody = {
      emailType,
      toEmail: recipient,
      token: 'test',
      context: contextObj
    };
    if (expirySelection?.minutes !== null) {
      baseBody.tokenExpiry = expirySelection.minutes;
    }

    openConfirmAction({
      title: 'Send test email',
      actionLabel: 'Send test email',
      message: 'Send a test email using this template?',
      impact: 'This email is for testing only and does not change any user state.',
      willNotify: true,
      user: { id: '—', fullName: 'Email tools', email: recipient },
      baseBody,
      url: '/admin/emails/send-test',
      method: 'POST',
      summaryItems: [
        { label: 'Email type', value: emailType },
        { label: 'Recipient', value: recipient },
        { label: 'Token', value: 'test' },
        { label: 'Token expiry', value: expirySelection?.label || 'Default' }
      ],
      successTarget: 'emails',
      successMessage: `Test email sent successfully to ${recipient}.`,
      afterSuccess: () => resetEmailForm()
    });
  }

  function validateDevEmailForm({ requireRecipient = false } = {}) {
    const subject = dom.devEmailSubject?.value.trim() || '';
    const body = dom.devEmailBody?.value.trim() || '';
    const recipient = dom.devEmailTestRecipient?.value.trim() || '';
    const subjectError = subject ? '' : 'Subject is required.';
    const bodyError = body ? '' : 'Markdown body is required.';
    const recipientError = requireRecipient ? validateEmail(recipient) : '';

    if (dom.devEmailSubjectHelp) dom.devEmailSubjectHelp.textContent = subjectError;
    if (dom.devEmailBodyHelp) dom.devEmailBodyHelp.textContent = bodyError;
    if (dom.devEmailTestHelp) dom.devEmailTestHelp.textContent = recipientError;

    const validBase = !subjectError && !bodyError;
    const recipientOk = !recipientError && !!recipient;
    if (dom.devEmailTestBtn) dom.devEmailTestBtn.disabled = !validBase || !recipientOk;
    if (dom.devEmailSendBtn) dom.devEmailSendBtn.disabled = !validBase;
    updateDevEmailPreview(body);
    return { valid: validBase && (!requireRecipient || recipientOk), subject, body, recipient };
  }

  async function handleDevEmailTest() {
    const { valid, subject, body, recipient } = validateDevEmailForm({ requireRecipient: true });
    if (!valid) return;
    const normalized = String(value).toUpperCase();
    if (type === 'status' && Number.isFinite(Number(value))) {
      const code = Number(value);
      const className = code >= 500 ? 'text-bg-danger' : code >= 400 ? 'text-bg-warning' : 'text-bg-success';
      return `<span class="badge ${className}">${escapeHtml(String(code))}</span>`;
    }
    openConfirmAction({
      title: 'Send development update test',
      actionLabel: 'Send test',
      message: 'Send a test email for this update? This will respect recipient preferences.',
      impact: 'Only the selected recipient will be contacted.',
      willNotify: true,
      user: { id: '—', fullName: 'Development updates', email: recipient },
      baseBody: {
        toEmail: recipient,
        subject,
        markdownBody: body
      },
      url: '/admin/emails/dev-features/test',
      method: 'POST',
      summaryItems: [
        { label: 'Recipient', value: recipient },
        { label: 'Subject', value: subject }
      ],
      successTarget: 'emails',
      successMessage: `Test email queued for ${recipient}.`,
      afterSuccess: () => {
        if (dom.devEmailSummary) dom.devEmailSummary.textContent = `Last test queued for ${recipient}.`;
        if (dom.devEmailStatus) dom.devEmailStatus.textContent = 'Test queued';
      }
    });
  }

  async function handleDevEmailSend() {
    const { valid, subject, body } = validateDevEmailForm();
    if (!valid) return;

    openConfirmAction({
      title: 'Send development update',
      actionLabel: 'Send update',
      message: 'Send this update to all users who opted in? This cannot be undone.',
      impact: 'Only users who opted in will receive the update.',
      willNotify: true,
      user: { id: '—', fullName: 'Development updates', email: 'Opted-in users' },
      baseBody: {
        subject,
        markdownBody: body
      },
      url: '/admin/emails/dev-features/send',
      method: 'POST',
      summaryItems: [
        { label: 'Subject', value: subject }
      ],
      successTarget: 'emails',
      successMessage: 'Development update queued for opted-in users.',
      afterSuccess: () => {
        if (dom.devEmailSummary) dom.devEmailSummary.textContent = 'Development update queued for opted-in users.';
        if (dom.devEmailStatus) dom.devEmailStatus.textContent = 'Sent';
      }
    });
  }

  function setDataViewerSummary(message) {
    if (dom.dataViewerSummary) dom.dataViewerSummary.textContent = message;
  }

  function resetDataViewerTable(message = 'No data loaded.') {
    if (dom.dataViewerThead) dom.dataViewerThead.innerHTML = '';
    if (dom.dataViewerTbody) {
      dom.dataViewerTbody.innerHTML = `<tr><td class="text-center text-muted py-3">${message}</td></tr>`;
    }
  }

  function setDataViewerLoading(isLoading) {
    if (dom.dataViewerLoadBtn) dom.dataViewerLoadBtn.disabled = isLoading;
    if (dom.dataViewerClearBtn) dom.dataViewerClearBtn.disabled = isLoading;
  }

  function getSelectedDataViewerTable() {
    return dom.dataViewerTable?.value || '';
  }

  function getDataViewerTableConfig(tableName) {
    return state.dataViewerTables.find((table) => table.name === tableName) || null;
  }

  function updateDataViewerSortOptions(tableConfig) {
    if (!dom.dataViewerSort) return;
    const sortFields = Array.isArray(tableConfig?.sortFields) ? tableConfig.sortFields : [];
    const options = sortFields.length
      ? sortFields
        .map((field) => `<option value="${escapeHtml(field.value)}">${escapeHtml(field.label || field.value)}</option>`)
        .join('')
      : '<option value="">No sort options</option>';
    dom.dataViewerSort.innerHTML = options;
    if (sortFields.length) {
      const defaultSort = tableConfig?.defaultSort;
      dom.dataViewerSort.value = defaultSort && sortFields.some((field) => field.value === defaultSort)
        ? defaultSort
        : sortFields[0].value;
    }
  }

  function populateDataViewerTables(tables) {
    if (!dom.dataViewerTable) return;
    if (!tables.length) {
      dom.dataViewerTable.innerHTML = '<option value="">No tables available</option>';
      updateDataViewerSortOptions(null);
      resetDataViewerTable('No data available.');
      setDataViewerSummary('No data tables are configured.');
      return;
    }

    dom.dataViewerTable.innerHTML = tables
      .map((table) => `<option value="${escapeHtml(table.name)}">${escapeHtml(table.label || table.name)}</option>`)
      .join('');

    const selected = getSelectedDataViewerTable() || tables[0].name;
    dom.dataViewerTable.value = selected;
    updateDataViewerSortOptions(getDataViewerTableConfig(selected));
  }

  function formatDataViewerValue(value, column) {
    if (value === null || value === undefined || value === '') return '—';
    if (column?.type === 'datetime') {
      const formatted = formatDateTime(value);
      return formatted || '—';
    }
    if (typeof value === 'object') {
      return escapeHtml(JSON.stringify(value));
    }
    return escapeHtml(String(value));
  }

  function renderDataViewerTable(payload = {}) {
    const columns = Array.isArray(payload.columns) ? payload.columns : [];
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    if (!dom.dataViewerThead || !dom.dataViewerTbody) return;

    if (!columns.length) {
      dom.dataViewerThead.innerHTML = '';
      resetDataViewerTable('No columns available.');
      return;
    }

    dom.dataViewerThead.innerHTML = `<tr>${columns.map((col) => `<th>${escapeHtml(col.label || col.name)}</th>`).join('')}</tr>`;

    if (!rows.length) {
      dom.dataViewerTbody.innerHTML = '<tr><td class="text-center text-muted py-3" colspan="100%">No results.</td></tr>';
      return;
    }

    dom.dataViewerTbody.innerHTML = rows.map((row) => {
      const cells = columns.map((col) => `<td>${formatDataViewerValue(row[col.name], col)}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
  }

  function setDataViewerSummaryFromPayload(payload, { page, limit } = {}) {
    const count = Number.isFinite(payload?.count) ? payload.count : 0;
    const total = Number.isFinite(payload?.total) ? payload.total : count;
    const currentPage = Number.isFinite(payload?.page) ? payload.page : page;
    const currentLimit = Number.isFinite(payload?.limit) ? payload.limit : limit;
    const hasNext = payload?.hasNext === true;
    const pageLabel = Number.isFinite(currentPage) ? `Page ${currentPage}` : 'Page 1';
    const limitLabel = Number.isFinite(currentLimit) ? `Limit ${currentLimit}` : 'Limit —';
    const totalLabel = Number.isFinite(total) ? `Total ${total}` : 'Total —';
    const nextLabel = hasNext ? 'More available' : 'End of results';
    setDataViewerSummary(`Rows: ${count}. ${pageLabel}. ${limitLabel}. ${totalLabel}. ${nextLabel}.`);
  }

  async function fetchDataViewerTables({ force = false } = {}) {
    if (state.dataViewerLoaded && !force) return state.dataViewerTables;
    hideAlert(dom.dataViewerAlert);
    setDataViewerSummary('Loading data tables…');
    try {
      const response = await apiFetch('/admin/data-viewer/tables', { method: 'GET' });
      const data = await parseResponse(response);
      state.dataViewerTables = Array.isArray(data?.tables) ? data.tables : [];
      state.dataViewerLoaded = true;
      populateDataViewerTables(state.dataViewerTables);
      const selected = getSelectedDataViewerTable();
      if (selected) {
        const config = getDataViewerTableConfig(selected);
        const hint = config?.description ? ` ${config.description}` : '';
        setDataViewerSummary(`Ready to load ${config?.label || selected}.${hint}`.trim());
      } else {
        setDataViewerSummary('Select a table to load data.');
      }
      return state.dataViewerTables;
    } catch (err) {
      errorLog('Failed to load data viewer tables', err);
      showAlert(dom.dataViewerAlert, err.message || 'Unable to load data tables.');
      setDataViewerSummary('Unable to load data tables.');
      resetDataViewerTable('No data loaded.');
      throw err;
    }
  }

  function getDataViewerQuery() {
    const table = getSelectedDataViewerTable();
    const search = dom.dataViewerSearch?.value.trim() || '';
    const email = dom.dataViewerEmail?.value.trim() || '';
    const userIdRaw = dom.dataViewerUserId?.value || '';
    const userId = Number.parseInt(userIdRaw, 10);
    const sortBy = dom.dataViewerSort?.value || '';
    const order = dom.dataViewerOrder?.value === 'asc' ? 'asc' : 'desc';
    const limitRaw = Number.parseInt(dom.dataViewerLimit?.value || '25', 10);
    const pageRaw = Number.parseInt(dom.dataViewerPage?.value || '1', 10);
    const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 5), 200) : 25;
    const page = Number.isInteger(pageRaw) ? Math.max(pageRaw, 1) : 1;
    return {
      table,
      search: search || undefined,
      email: email || undefined,
      userId: Number.isInteger(userId) ? userId : undefined,
      sortBy: sortBy || undefined,
      order,
      limit,
      page
    };
  }

  async function fetchDataViewerRows() {
    hideAlert(dom.dataViewerAlert);
    const query = getDataViewerQuery();
    if (!query.table) {
      showAlert(dom.dataViewerAlert, 'Select a table to load data.');
      return;
    }
    if (dom.dataViewerLimit) dom.dataViewerLimit.value = query.limit;
    if (dom.dataViewerPage) dom.dataViewerPage.value = query.page;
    setDataViewerLoading(true);
    setDataViewerSummary('Loading data…');
    resetDataViewerTable('Loading data…');
    try {
      const response = await apiFetch('/admin/data-viewer/query', {
        method: 'POST',
        body: query
      });
      const data = await parseResponse(response);
      renderDataViewerTable(data);
      setDataViewerSummaryFromPayload(data, query);
    } catch (err) {
      errorLog('Failed to load data viewer rows', err);
      showAlert(dom.dataViewerAlert, err.message || 'Unable to load data.');
      setDataViewerSummary('Unable to load data.');
      resetDataViewerTable('No data loaded.');
      throw err;
    } finally {
      setDataViewerLoading(false);
    }
  }

  function clearDataViewerFilters() {
    if (dom.dataViewerSearch) dom.dataViewerSearch.value = '';
    if (dom.dataViewerUserId) dom.dataViewerUserId.value = '';
    if (dom.dataViewerEmail) dom.dataViewerEmail.value = '';
    if (dom.dataViewerPage) dom.dataViewerPage.value = '1';
  }

  function bindEvents() {
    dom.refreshStatusBtn?.addEventListener('click', () => fetchStatus().catch(() => {}));
    dom.refreshSiteStatsBtn?.addEventListener('click', () => fetchSiteStats());

    dom.adminSectionNav?.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-section]');
      if (!btn) return;
      setSection(btn.dataset.section);
    });

    dom.usageLogsNav?.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-usage-panel]');
      if (!btn) return;
      setUsagePanel(btn.dataset.usagePanel);
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
    dom.confirmActionExpirySelect?.addEventListener('change', handleConfirmExpirySelectChange);
    dom.confirmActionExpiryCustom?.addEventListener('input', handleConfirmExpiryCustomInput);
    dom.confirmActionSubmit?.addEventListener('click', handleConfirmActionSubmit);

    dom.sessionsForceLogoutBtn?.addEventListener('click', handleSessionsForceLogout);

    dom.createFullName?.addEventListener('input', handleCreateUserInput);
    dom.createPreferredName?.addEventListener('input', handleCreateUserInput);
    dom.createEmail?.addEventListener('input', handleCreateUserInput);
    dom.createRole?.addEventListener('change', handleCreateUserInput);
    dom.createPassword?.addEventListener('input', handleCreateUserInput);
    dom.createTokenExpiry?.addEventListener('input', handleCreateUserInput);
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
    dom.logsActorFilter?.addEventListener('change', logFilterChange);
    dom.logsPathFilter?.addEventListener('input', debounce(logFilterChange));
    dom.logsUserIdFilter?.addEventListener('input', debounce(logFilterChange));
    dom.logsUserEmailFilter?.addEventListener('input', debounce(logFilterChange));
    dom.logsApiKeyIdFilter?.addEventListener('input', debounce(logFilterChange));
    dom.logsApiKeyLabelFilter?.addEventListener('input', debounce(logFilterChange));
    dom.logsApiKeyPrefixFilter?.addEventListener('input', debounce(logFilterChange));
    dom.logsStatusMin?.addEventListener('input', debounce(logFilterChange));
    dom.logsStatusMax?.addEventListener('input', debounce(logFilterChange));
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

    dom.logsCopyRequestBtn?.addEventListener('click', copyLogRequest);
    dom.logsCopyResponseBtn?.addEventListener('click', copyLogResponse);
    dom.logsCopyCorrelationBtn?.addEventListener('click', copyCorrelationId);

    const usageBaseRefresh = debounce(() => refreshUsage().catch(() => {}));
    dom.usageRefreshBtn?.addEventListener('click', () => refreshUsage().catch(() => {}));
    dom.usageDateFrom?.addEventListener('change', () => refreshUsage().catch(() => {}));
    dom.usageDateTo?.addEventListener('change', () => refreshUsage().catch(() => {}));
    dom.usageSortBy?.addEventListener('change', () => refreshUsage().catch(() => {}));
    dom.usageSortOrder?.addEventListener('change', () => refreshUsage().catch(() => {}));
    dom.usageTopLimit?.addEventListener('input', usageBaseRefresh);
    dom.usageUserId?.addEventListener('input', debounce(() => refreshUsage({ usersOnly: true }).catch(() => {})));
    dom.usageUserEmail?.addEventListener('input', debounce(() => refreshUsage({ usersOnly: true }).catch(() => {})));
    dom.usageUserPath?.addEventListener('input', debounce(() => refreshUsage({ usersOnly: true }).catch(() => {})));
    dom.usageApiKeyId?.addEventListener('input', debounce(() => refreshUsage({ apiKeysOnly: true }).catch(() => {})));
    dom.usageApiKeyLabel?.addEventListener('input', debounce(() => refreshUsage({ apiKeysOnly: true }).catch(() => {})));
    dom.usageApiKeyEmail?.addEventListener('input', debounce(() => refreshUsage({ apiKeysOnly: true }).catch(() => {})));
    dom.usageUsersTbody?.addEventListener('click', handleUsageActionClick);
    dom.usageApiKeysTbody?.addEventListener('click', handleUsageActionClick);

    dom.dataViewerTable?.addEventListener('change', () => {
      const table = getSelectedDataViewerTable();
      const config = getDataViewerTableConfig(table);
      updateDataViewerSortOptions(config);
      clearDataViewerFilters();
      resetDataViewerTable('No data loaded.');
      const hint = config?.description ? ` ${config.description}` : '';
      setDataViewerSummary(table ? `Ready to load ${config?.label || table}.${hint}`.trim() : 'Select a table to load data.');
    });

    dom.dataViewerLoadBtn?.addEventListener('click', () => {
      fetchDataViewerRows().catch(() => {});
    });

    dom.dataViewerClearBtn?.addEventListener('click', () => {
      clearDataViewerFilters();
      resetDataViewerTable('No data loaded.');
      setDataViewerSummary('Filters cleared. Select Load to refresh.');
    });

    dom.dataViewerLimit?.addEventListener('change', () => {
      const limit = Number.parseInt(dom.dataViewerLimit.value, 10);
      if (!Number.isInteger(limit) || limit < 5 || limit > 200) {
        dom.dataViewerLimit.value = '25';
      }
      if (getSelectedDataViewerTable()) {
        fetchDataViewerRows().catch(() => {});
      }
    });

    dom.dataViewerPage?.addEventListener('change', () => {
      const page = Number.parseInt(dom.dataViewerPage.value, 10);
      if (!Number.isInteger(page) || page < 1) {
        dom.dataViewerPage.value = '1';
      }
      if (getSelectedDataViewerTable()) {
        fetchDataViewerRows().catch(() => {});
      }
    });

    dom.emailTypesRefreshBtn?.addEventListener('click', () => fetchEmailTypes(true).catch(() => {}));
    dom.emailTypeSelect?.addEventListener('change', handleEmailFormChange);
    dom.emailRecipientInput?.addEventListener('input', handleEmailFormChange);
    dom.emailTokenExpirySelect?.addEventListener('change', handleEmailExpirySelectChange);
    dom.emailTokenExpiryCustom?.addEventListener('input', handleEmailExpiryCustomInput);
    dom.emailContextInput?.addEventListener('input', handleEmailFormChange);
    dom.emailResetBtn?.addEventListener('click', handleEmailReset);
    dom.emailSendTestBtn?.addEventListener('click', handleEmailSendTest);

    dom.devEmailSubject?.addEventListener('input', () => validateDevEmailForm());
    dom.devEmailBody?.addEventListener('input', () => validateDevEmailForm());
    dom.devEmailTestRecipient?.addEventListener('input', () => validateDevEmailForm({ requireRecipient: true }));
    dom.devEmailTestBtn?.addEventListener('click', handleDevEmailTest);
    dom.devEmailSendBtn?.addEventListener('click', handleDevEmailSend);
    validateDevEmailForm();
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
    state.currentUserId = profile?.id || null;
    updateRolePill(profile);
    const isAdmin = profile?.role === 'admin';
    setAdminNavVisibility(isAdmin);
    if (!isAdmin) {
      denyAccess();
      state.authorized = false;
      return false;
    }
    state.authorized = true;
    if (state.currentSection === 'usage-logs') {
      setUsagePanel(state.usagePanel || 'logs');
    }
    if (state.currentSection === 'emails') {
      ensureEmailTypesLoaded().catch(() => {});
    }
    if (state.currentSection === 'data-tools') {
      fetchDataViewerTables().catch(() => {});
    }
    if (state.currentSection === 'statistics') {
      fetchSiteStats();
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
      if (state.currentSection === 'emails') {
        ensureEmailTypesLoaded().catch(() => {});
      }
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
