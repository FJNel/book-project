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
    clearUsersSearchBtn: document.getElementById('clearUsersSearchBtn'),
    usersSortSelect: document.getElementById('usersSortSelect'),
    userRoleFilter: document.getElementById('userRoleFilter'),
    userVerifiedFilter: document.getElementById('userVerifiedFilter'),
    userDisabledFilter: document.getElementById('userDisabledFilter'),
    usersApplyFiltersBtn: document.getElementById('usersApplyFiltersBtn'),
    usersResetFiltersBtn: document.getElementById('usersResetFiltersBtn'),
    usersActiveFilters: document.getElementById('usersActiveFilters'),
    usersActiveFiltersBar: document.getElementById('usersActiveFiltersBar'),
    usersPerPage: document.getElementById('usersPerPage'),
    clearUsersFiltersBtn: document.getElementById('clearUsersFiltersBtn'),
    usersTbody: document.getElementById('usersTbody'),
    usersAlert: document.getElementById('usersAlert'),
    usersSuccess: document.getElementById('usersSuccess'),
    usersPagination: document.getElementById('usersPagination'),
    usersPageInfo: document.getElementById('usersPageInfo'),
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
    logsSortBy: document.getElementById('logsSortBy'),
    logsSortOrder: document.getElementById('logsSortOrder'),
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
    logsPagination: document.getElementById('logsPagination'),
    logsPageInfo: document.getElementById('logsPageInfo'),
    logsPageSize: document.getElementById('logsPageSize'),
    logsSummary: document.getElementById('logsSummary'),
    logsRefreshBtn: document.getElementById('logsRefreshBtn'),
    logsClearSearchBtn: document.getElementById('logsClearSearchBtn'),
    logsApplyFiltersBtn: document.getElementById('logsApplyFiltersBtn'),
    logsResetFiltersBtn: document.getElementById('logsResetFiltersBtn'),
    logsExportBtn: document.getElementById('logsExportBtn'),
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
    emailTypeDescription: document.getElementById('emailTypeDescription'),
    emailTypeFields: document.getElementById('emailTypeFields'),
    emailRecipientInput: document.getElementById('emailRecipientInput'),
    emailRecipientHelp: document.getElementById('emailRecipientHelp'),
    emailTypesRefreshBtn: document.getElementById('emailTypesRefreshBtn'),
    emailResetBtn: document.getElementById('emailResetBtn'),
    emailSendTestBtn: document.getElementById('emailSendTestBtn'),
    emailHistoryAlert: document.getElementById('emailHistoryAlert'),
    emailHistoryTypeFilter: document.getElementById('emailHistoryTypeFilter'),
    emailHistoryStatusFilter: document.getElementById('emailHistoryStatusFilter'),
    emailHistoryRecipient: document.getElementById('emailHistoryRecipient'),
    emailHistoryClearSearchBtn: document.getElementById('emailHistoryClearSearchBtn'),
    emailHistoryDateFrom: document.getElementById('emailHistoryDateFrom'),
    emailHistoryDateTo: document.getElementById('emailHistoryDateTo'),
    emailHistoryPageSize: document.getElementById('emailHistoryPageSize'),
    emailHistoryRefreshBtn: document.getElementById('emailHistoryRefreshBtn'),
    emailHistoryApplyFiltersBtn: document.getElementById('emailHistoryApplyFiltersBtn'),
    emailHistoryResetFiltersBtn: document.getElementById('emailHistoryResetFiltersBtn'),
    emailHistoryTbody: document.getElementById('emailHistoryTbody'),
    emailHistorySummary: document.getElementById('emailHistorySummary'),
    emailHistoryPagination: document.getElementById('emailHistoryPagination'),
    emailHistoryPageInfo: document.getElementById('emailHistoryPageInfo'),
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
    siteInsightsAdoption: document.getElementById('siteInsightsAdoption'),
    siteInsightsQuality: document.getElementById('siteInsightsQuality'),
    siteInsightsEngagement: document.getElementById('siteInsightsEngagement'),
    endpointUsageSummary: document.getElementById('endpointUsageSummary'),
    endpointUsageAlert: document.getElementById('endpointUsageAlert'),
    endpointUsageTbody: document.getElementById('endpointUsageTbody'),
    dataViewerAlert: document.getElementById('dataViewerAlert'),
    dataViewerTable: document.getElementById('dataViewerTable'),
    dataViewerSearch: document.getElementById('dataViewerSearch'),
    dataViewerUserId: document.getElementById('dataViewerUserId'),
    dataViewerEmail: document.getElementById('dataViewerEmail'),
    dataViewerSort: document.getElementById('dataViewerSort'),
    dataViewerOrder: document.getElementById('dataViewerOrder'),
    dataViewerLimit: document.getElementById('dataViewerLimit'),
    dataViewerPage: document.getElementById('dataViewerPage'),
    dataViewerUserIdHelp: document.getElementById('dataViewerUserIdHelp'),
    dataViewerLimitHelp: document.getElementById('dataViewerLimitHelp'),
    dataViewerPageHelp: document.getElementById('dataViewerPageHelp'),
    dataViewerClearSearchBtn: document.getElementById('dataViewerClearSearchBtn'),
    dataViewerApplyFiltersBtn: document.getElementById('dataViewerApplyFiltersBtn'),
    dataViewerResetFiltersBtn: document.getElementById('dataViewerResetFiltersBtn'),
    dataViewerSummary: document.getElementById('dataViewerSummary'),
    dataViewerPaginationInfo: document.getElementById('dataViewerPaginationInfo'),
    dataViewerPagination: document.getElementById('dataViewerPagination'),
    dataViewerTableHelp: document.getElementById('dataViewerTableHelp'),
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
    editUserChangesSummary: document.getElementById('editUserChangesSummary'),
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
    confirmActionWarningTypeWrap: document.getElementById('confirmActionWarningTypeWrap'),
    confirmActionWarningType: document.getElementById('confirmActionWarningType'),
    confirmActionWarningTypeHelp: document.getElementById('confirmActionWarningTypeHelp'),
    confirmActionApiKeyWrap: document.getElementById('confirmActionApiKeyWrap'),
    confirmActionApiKeySelect: document.getElementById('confirmActionApiKeySelect'),
    confirmActionApiKeyHelp: document.getElementById('confirmActionApiKeyHelp'),
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
    userDetailsModal: document.getElementById('userDetailsModal'),
    userDetailsTitle: document.getElementById('userDetailsTitle'),
    userDetailsAlert: document.getElementById('userDetailsAlert'),
    userDetailsProfile: document.getElementById('userDetailsProfile'),
    userDetailsUsage: document.getElementById('userDetailsUsage'),
    userDetailsActions: document.getElementById('userDetailsActions'),
    userDetailsEmailsAlert: document.getElementById('userDetailsEmailsAlert'),
    userDetailsEmailsTbody: document.getElementById('userDetailsEmailsTbody'),
    userDetailsEmailsSummary: document.getElementById('userDetailsEmailsSummary'),
    userEndpointUsageModal: document.getElementById('userEndpointUsageModal'),
    userEndpointUsageTitle: document.getElementById('userEndpointUsageTitle'),
    userEndpointUsageAlert: document.getElementById('userEndpointUsageAlert'),
    userEndpointUsageSummary: document.getElementById('userEndpointUsageSummary'),
    userEndpointUsageTbody: document.getElementById('userEndpointUsageTbody'),
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
    confirmActionApiKeys: [],
    userDetailsUser: null,
    userDetailsUsage: null,
    userDetailsEmailHistory: [],
    userDetailsEmailHistoryTotal: 0,
    userDetailsApiKeys: [],
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
    emailTypeMeta: {},
    adminEmail: null,
    emailHistory: [],
    emailHistoryPage: 1,
    emailHistoryLimit: 25,
    emailHistoryHasNext: false,
    emailHistoryTotal: 0,
    emailHistoryLoaded: false,
    devFeaturesTestSignature: null,
    devFeaturesTestAllowed: false,
    devFeaturesTestCheckSignature: null,
    siteStatsLoaded: false,
    dataViewerTables: [],
    dataViewerLoaded: false,
    dataViewerPage: 1,
    dataViewerHasNext: false,
    dataViewerTotal: 0,
    successTimers: new Map()
  };

  function getEmailTypeFallback() {
    return { description: 'Email preview for the selected template.', fields: [] };
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

  function renderPaginationNav(navEl, page, hasNext, onPageChange) {
    if (!navEl) return;
    navEl.innerHTML = '';

    const createItem = (label, disabled, onClick, ariaLabel) => {
      const li = document.createElement('li');
      li.className = `page-item${disabled ? ' disabled' : ''}`;
      const a = document.createElement('a');
      a.className = 'page-link';
      a.href = '#';
      a.innerHTML = label;
      if (ariaLabel) a.setAttribute('aria-label', ariaLabel);
      a.addEventListener('click', (event) => {
        event.preventDefault();
        if (!disabled && typeof onClick === 'function') onClick();
      });
      li.appendChild(a);
      return li;
    };

    navEl.appendChild(createItem(
      `<i class="bi bi-arrow-left"></i>`,
      page <= 1,
      () => onPageChange(page - 1),
      'Previous page'
    ));

    if (page > 1) {
      navEl.appendChild(createItem(String(page - 1), false, () => onPageChange(page - 1)));
    }

    const current = document.createElement('li');
    current.className = 'page-item active';
    const span = document.createElement('span');
    span.className = 'page-link';
    span.textContent = String(page);
    current.appendChild(span);
    navEl.appendChild(current);

    if (hasNext) {
      navEl.appendChild(createItem(String(page + 1), false, () => onPageChange(page + 1)));
    }

    navEl.appendChild(createItem(
      `<i class="bi bi-arrow-right"></i>`,
      !hasNext,
      () => onPageChange(page + 1),
      'Next page'
    ));
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
    if (dom.schemaStatusText) dom.schemaStatusText.textContent = 'Unavailable';
    if (dom.dbSslModeText) dom.dbSslModeText.textContent = 'Unavailable';
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
      if (db?.sslMode) {
        dom.dbSslModeText.textContent = db.sslMode;
      } else {
        warn('Health payload missing db.sslMode');
        dom.dbSslModeText.textContent = 'Unavailable';
      }
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
    const adminEmail = payload?.user?.email || '';

    setBadge('ok');
    if (dom.apiStatusText) dom.apiStatusText.textContent = 'Online';
    if (dom.dbLatencyText) dom.dbLatencyText.textContent = Number.isFinite(dbLatency) ? `${dbLatency} ms` : 'Unavailable';
    if (dom.queueText) dom.queueText.textContent = queueStats?.queueLength != null ? `${queueStats.queueLength} queued` : 'Unavailable';
    if (dom.statusUpdatedAt) dom.statusUpdatedAt.textContent = `Last checked ${formatDateTime(Date.now())}`;
    updateStatusPill('Ready');
    if (adminEmail) {
      state.adminEmail = adminEmail;
      if (dom.emailRecipientInput && !dom.emailRecipientInput.value) dom.emailRecipientInput.value = adminEmail;
      if (dom.devEmailTestRecipient && !dom.devEmailTestRecipient.value) dom.devEmailTestRecipient.value = adminEmail;
    }
  }

  function renderStatusError(message) {
    setBadge('error');
    if (dom.apiStatusText) dom.apiStatusText.textContent = 'Unavailable';
    if (dom.dbLatencyText) dom.dbLatencyText.textContent = 'Unavailable';
    if (dom.queueText) dom.queueText.textContent = 'Unavailable';
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

  function formatAdminStatValue(value) {
    return value === null || value === undefined ? 'Unavailable' : value;
  }

  function formatInsightValue(metric) {
    if (!metric || metric.value === null || metric.value === undefined) {
      return 'Not enough data yet';
    }
    if (metric.unit === 'percent') {
      return `${Number(metric.value).toFixed(1)}%`;
    }
    if (metric.unit === 'number') {
      return Number(metric.value).toLocaleString();
    }
    if (metric.unit) {
      return `${Number(metric.value).toLocaleString()} ${metric.unit}`;
    }
    return Number.isFinite(metric.value) ? Number(metric.value).toLocaleString() : String(metric.value);
  }

  function renderInsightsList(container, metrics = []) {
    if (!container) return;
    if (!Array.isArray(metrics) || metrics.length === 0) {
      container.innerHTML = '<div class="text-muted small">No insight data yet.</div>';
      return;
    }
    container.innerHTML = metrics.map((metric) => {
      const value = formatInsightValue(metric);
      const metaParts = [];
      if (Number.isFinite(metric.sampleSize)) metaParts.push(`N=${metric.sampleSize}`);
      if (metric.note) metaParts.push(metric.note);
      const meta = metaParts.length ? `<div class="insight-meta">${escapeHtml(metaParts.join(' · '))}</div>` : '';
      return `
        <div class="insight-item">
          <div>
            <div class="insight-label">${escapeHtml(metric.label || 'Insight')}</div>
            ${meta}
          </div>
          <div class="insight-value">${escapeHtml(value)}</div>
        </div>
      `;
    }).join('');
  }

  function renderSiteStats(stats, insights) {
    if (!stats) return;
    if (dom.siteUsersTotal) dom.siteUsersTotal.textContent = formatAdminStatValue(stats.users?.total);
    if (dom.siteUsersVerified) dom.siteUsersVerified.textContent = formatAdminStatValue(stats.users?.verified);
    if (dom.siteUsersDisabled) dom.siteUsersDisabled.textContent = formatAdminStatValue(stats.users?.disabled);
    if (dom.siteBooksTotal) dom.siteBooksTotal.textContent = formatAdminStatValue(stats.books?.total);
    if (dom.siteBooksActive) dom.siteBooksActive.textContent = formatAdminStatValue(stats.books?.active);
    if (dom.siteBooksDeleted) dom.siteBooksDeleted.textContent = formatAdminStatValue(stats.books?.deleted);
    if (dom.siteAuthorsTotal) dom.siteAuthorsTotal.textContent = formatAdminStatValue(stats.library?.authors);
    if (dom.sitePublishersTotal) dom.sitePublishersTotal.textContent = formatAdminStatValue(stats.library?.publishers);
    if (dom.siteSeriesTotal) dom.siteSeriesTotal.textContent = formatAdminStatValue(stats.library?.series);
    if (dom.siteBookTypesTotal) dom.siteBookTypesTotal.textContent = formatAdminStatValue(stats.library?.bookTypes);
    if (dom.siteTagsTotal) dom.siteTagsTotal.textContent = formatAdminStatValue(stats.library?.tags);
    if (dom.siteStorageTotal) dom.siteStorageTotal.textContent = formatAdminStatValue(stats.library?.storageLocations);
    renderInsightsList(dom.siteInsightsAdoption, insights?.adoption || []);
    renderInsightsList(dom.siteInsightsQuality, insights?.quality || []);
    renderInsightsList(dom.siteInsightsEngagement, insights?.engagement || []);
  }

  function renderEndpointUsage(entries = []) {
    if (!dom.endpointUsageTbody) return;
    const rows = Array.isArray(entries) ? entries : [];
    if (!rows.length) {
      dom.endpointUsageTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No endpoint usage recorded yet.</td></tr>';
      if (dom.endpointUsageSummary) dom.endpointUsageSummary.textContent = 'No endpoint usage recorded yet.';
      return;
    }
    dom.endpointUsageTbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.endpoint || '—')}</td>
        <td>${escapeHtml(row.method || '—')}</td>
        <td>${Number.isFinite(row.callCount) ? row.callCount.toLocaleString() : '—'}</td>
      </tr>
    `).join('');
    if (dom.endpointUsageSummary) dom.endpointUsageSummary.textContent = `Showing ${rows.length} endpoints`;
  }

  async function fetchEndpointUsage() {
    hideAlert(dom.endpointUsageAlert);
    if (dom.endpointUsageTbody) {
      dom.endpointUsageTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Loading endpoint usage…</td></tr>';
    }
    try {
      const response = await apiFetch('/admin/usage/endpoints', { method: 'POST', body: { limit: 15 } });
      const data = await parseResponse(response);
      if (data?.configured === false) {
        showAlert(dom.endpointUsageAlert, data?.message || 'Endpoint usage is not configured.');
        renderEndpointUsage([]);
        return;
      }
      renderEndpointUsage(Array.isArray(data?.endpoints) ? data.endpoints : []);
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        showAlert(dom.endpointUsageAlert, data.warnings.join(' '));
      }
    } catch (err) {
      errorLog('[Admin][Stats] Failed to load endpoint usage', err);
      showAlert(dom.endpointUsageAlert, err.message || 'Unable to load endpoint usage.');
      renderEndpointUsage([]);
    }
  }

  async function fetchSiteStats() {
    hideAlert(dom.siteStatsAlert);
    try {
      const response = await apiFetch('/admin/stats/summary', { method: 'POST', body: {} });
      const data = await parseResponse(response);
      renderSiteStats(data?.stats, data?.insights);
      fetchEndpointUsage().catch(() => {});
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        showAlert(dom.siteStatsAlert, `Some statistics are unavailable: ${data.warnings.join(' ')}`);
      }
      state.siteStatsLoaded = true;
    } catch (err) {
      errorLog('Failed to load site stats', err);
      showAlert(dom.siteStatsAlert, err.message || 'Unable to load site stats.');
      renderSiteStats({
        users: { total: null, verified: null, disabled: null },
        books: { total: null, active: null, deleted: null },
        library: { authors: null, publishers: null, series: null, bookTypes: null, tags: null, storageLocations: null }
      }, null);
      renderEndpointUsage([]);
    }
  }

  function getUserFilters() {
    const search = dom.userSearchInput?.value?.trim() || '';
    const role = dom.userRoleFilter?.value || '';
    const verified = dom.userVerifiedFilter?.value || '';
    const disabled = dom.userDisabledFilter?.value || '';
    const sortValue = dom.usersSortSelect?.value || 'email:asc';
    const [sortBy, order] = sortValue.split(':');
    return { search, role, verified, disabled, sortBy: sortBy || 'email', order: order || 'asc' };
  }

  function clearUserFilters() {
    if (dom.userRoleFilter) dom.userRoleFilter.value = '';
    if (dom.userVerifiedFilter) dom.userVerifiedFilter.value = '';
    if (dom.userDisabledFilter) dom.userDisabledFilter.value = '';
  }

  function renderUsersActiveFilters(filters) {
    if (!dom.usersActiveFilters || !dom.usersActiveFiltersBar) return;
    const chips = [];
    if (filters.role) chips.push(`Role: ${filters.role}`);
    if (filters.verified) chips.push(`Verified: ${filters.verified === 'true' ? 'Yes' : 'No'}`);
    if (filters.disabled) chips.push(`Disabled: ${filters.disabled === 'true' ? 'Yes' : 'No'}`);
    dom.usersActiveFilters.innerHTML = chips.map((chip) => `<span class="chip chip-muted">${escapeHtml(chip)}</span>`).join('');
    if (dom.clearUsersFiltersBtn) dom.clearUsersFiltersBtn.classList.toggle('d-none', chips.length === 0);
  }

  function renderUsers(users) {
    state.users = Array.isArray(users) ? users : [];
    if (!dom.usersTbody) return;
    if (!state.users.length) {
      dom.usersTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No users found.</td></tr>';
      return;
    }

    const rows = state.users.map((user) => {
      const isSelf = state.currentUserId && user.id === state.currentUserId;
      const name = user.preferredName || user.fullName || '—';
      const librarySize = Number(user.librarySize) || 0;
      const websiteUsage = user.websiteUsage || {};
      const apiUsage = user.apiUsage || {};
      const formatUsageLine = (label, usage) => {
        if (!Number.isFinite(usage.usageScore)) {
          return `<div class="text-muted small">${escapeHtml(label)}: Not enough data yet</div>`;
        }
        const requests = Number.isFinite(usage.requestCount) ? ` · ${usage.requestCount.toLocaleString()} req` : '';
        return `<div class="text-muted small">${escapeHtml(label)}: Score ${usage.usageScore.toLocaleString()} (${escapeHtml(usage.usageLevel || '—')})${requests}</div>`;
      };
      const verified = user.isVerified ? '<span class="badge text-bg-success">Verified</span>' : '<span class="badge text-bg-secondary">Unverified</span>';
      const disabled = user.isDisabled ? '<span class="badge text-bg-danger">Disabled</span>' : '<span class="badge text-bg-success">Active</span>';
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
      const disableTextClass = user.isDisabled ? 'text-success' : 'text-warning';
      const disableAttrs = isSelf ? 'disabled aria-disabled="true" title="You cannot disable your own account."' : '';
      const disableClasses = `${disableTextClass} js-toggle-disable${isSelf ? ' disabled' : ''}`;
      return `
        <tr data-user-id="${user.id}" class="clickable-row" tabindex="0" role="button">
          <td>
            <div class="fw-semibold">${escapeHtml(name)}</div>
            <div class="text-muted small">${escapeHtml(user.email || '—')}</div>
            <div class="text-muted small">ID ${escapeHtml(String(user.id ?? '—'))}</div>
          </td>
          <td>
            <div class="fw-semibold">Usage</div>
            ${formatUsageLine('Website', websiteUsage)}
            ${formatUsageLine('API', apiUsage)}
          </td>
          <td>
            <div class="fw-semibold">${escapeHtml(librarySize.toLocaleString())} books</div>
            <div class="text-muted small">Library size</div>
          </td>
          <td>
            <div class="fw-semibold">API keys: ${apiKeyStatusBadge}</div>
            <div class="text-muted small">${escapeHtml(apiKeySummary)}</div>
            <div class="mt-1 d-flex flex-wrap gap-1">${banBadges.join(' ')}</div>
          </td>
          <td>
            <div class="d-flex flex-wrap gap-1">
              ${roleBadge}
              ${verified}
              ${disabled}
            </div>
          </td>
          <td class="admin-col-actions text-end">
            <div class="d-inline-flex align-items-center gap-1 row-actions row-actions-desktop" data-row-action>
              <button class="btn btn-outline-secondary btn-sm icon-btn js-edit-user" type="button" data-user-id="${user.id}" aria-label="Edit user" title="Edit user">
                <i class="bi bi-pencil-fill" aria-hidden="true"></i>
              </button>
              <button class="btn btn-outline-secondary btn-sm icon-btn js-view-sessions" type="button" data-user-id="${user.id}" aria-label="View sessions" title="View sessions">
                <i class="bi bi-pc-display-horizontal" aria-hidden="true"></i>
              </button>
              <div class="btn-group btn-group-sm" role="group">
                <button class="btn btn-outline-secondary btn-sm icon-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More actions" title="More actions">
                  <i class="bi bi-chevron-right" aria-hidden="true"></i>
                </button>
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

  async function fetchUsers(filters = {}) {
    const {
      search = '',
      role = '',
      verified = '',
      disabled = '',
      sortBy = 'email',
      order = 'asc'
    } = filters;
    hideAlert(dom.usersAlert);
    if (dom.usersTbody) {
      dom.usersTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Loading users…</td></tr>';
    }

    const body = {
      limit: state.usersLimit,
      offset: (state.usersPage - 1) * state.usersLimit,
      order,
      sortBy
    };
    if (search) body.filterEmail = search;
    if (role) body.filterRole = role;
    if (verified !== '') body.filterIsVerified = verified === 'true';
    if (disabled !== '') body.filterIsDisabled = disabled === 'true';

    try {
      const response = await apiFetch('/admin/users/list', { method: 'POST', body });
      const data = await parseResponse(response);
      const received = Array.isArray(data?.users) ? data.users.length : 0;
      const total = Number.isFinite(data?.total) ? data.total : null;
      state.usersHasNext = total !== null
        ? ((state.usersPage - 1) * state.usersLimit + received < total)
        : received === state.usersLimit;
      updateUsersSummary(received, total);
      renderUsersPagination();
      renderUsers(data?.users || []);
    } catch (err) {
      errorLog('Failed to fetch users', err);
      if (err?.isNetworkError) {
        showAlert(dom.usersAlert, 'Network or CORS error. Unable to load users.');
      } else {
        showAlert(dom.usersAlert, err.message || 'Unable to load users.');
      }
      if (dom.usersTbody) {
        dom.usersTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Unable to load users.</td></tr>';
      }
      throw err;
    }
  }

  function renderUsersPagination() {
    renderPaginationNav(dom.usersPagination, state.usersPage, state.usersHasNext, (nextPage) => {
      if (nextPage < 1 || (!state.usersHasNext && nextPage > state.usersPage)) return;
      state.usersPage = nextPage;
      fetchUsers(getUserFilters()).catch(() => {});
    });
    if (dom.usersPageInfo) dom.usersPageInfo.textContent = `Page ${state.usersPage}`;
  }

  function updateUsersSummary(receivedCount, total = null) {
    if (!dom.usersSummary) return;
    const start = ((state.usersPage - 1) * state.usersLimit) + (receivedCount ? 1 : 0);
    const end = ((state.usersPage - 1) * state.usersLimit) + receivedCount;
    const totalLabel = Number.isFinite(total) ? ` of ${total}` : '';
    dom.usersSummary.textContent = receivedCount ? `Showing ${start}–${end}${totalLabel}` : 'No users to show';
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
        <td class="admin-col-actions text-end">
          <div class="d-inline-flex align-items-center gap-1 row-actions row-actions-desktop">
            <button class="btn btn-outline-secondary btn-sm icon-btn js-edit-language" type="button" data-language-id="${lang.id}" aria-label="Edit language" title="Edit language">
              <i class="bi bi-pencil-fill" aria-hidden="true"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm icon-btn js-delete-language" type="button" data-language-id="${lang.id}" aria-label="Delete language" title="Delete language">
              <i class="bi bi-trash-fill" aria-hidden="true"></i>
            </button>
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
      if (!state.emailHistoryLoaded) {
        fetchEmailHistory({ resetPage: true }).catch(() => {});
      }
    } else if (section === 'data-tools' && state.authorized) {
      fetchDataViewerTables().catch(() => {});
    } else if (section === 'statistics' && state.authorized) {
      fetchSiteStats();
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

  function openEditUserModal(userId, { fromUserDetails = false } = {}) {
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
    validateEditUserForm();
    if (fromUserDetails && window.modalStack && dom.userDetailsModal?.classList.contains('show')) {
      window.modalStack.push('userDetailsModal', 'editUserModal');
      return;
    }
    const instance = bootstrap.Modal.getOrCreateInstance(dom.editUserModal);
    instance.show();
  }

  function describeEditChange(fieldLabel, fromValue, toValue) {
    const fromText = fromValue ? String(fromValue).trim() : '';
    const toText = toValue ? String(toValue).trim() : '';
    if (fromText === toText) return null;
    if (!fromText && toText) return `Adding ${fieldLabel}: '${toText}'.`;
    if (fromText && !toText) return `Clearing ${fieldLabel} (was '${fromText}').`;
    return `Changing ${fieldLabel} from '${fromText}' to '${toText}'.`;
  }

  function validateEditUserForm() {
    const fullName = dom.editFullName.value.trim();
    const preferredName = dom.editPreferredName.value.trim();
    const email = dom.editEmail.value.trim();
    const role = dom.editRole.value;
    const errors = {
      fullName: validateName(fullName),
      preferredName: '',
      email: validateEmail(email)
    };
    dom.editFullNameHelp.textContent = errors.fullName;
    dom.editPreferredNameHelp.textContent = errors.preferredName;
    dom.editEmailHelp.textContent = errors.email;
    if (dom.editFullName) {
      dom.editFullName.classList.toggle('is-invalid', Boolean(errors.fullName));
      dom.editFullName.classList.toggle('is-valid', !errors.fullName && Boolean(fullName));
    }
    if (dom.editPreferredName) {
      const markValid = Boolean(preferredName);
      dom.editPreferredName.classList.remove('is-invalid');
      dom.editPreferredName.classList.toggle('is-valid', markValid);
    }
    if (dom.editEmail) {
      dom.editEmail.classList.toggle('is-invalid', Boolean(errors.email));
      dom.editEmail.classList.toggle('is-valid', !errors.email && Boolean(email));
    }

    const changed = fullName !== (state.currentEditingUser?.fullName || '')
      || preferredName !== (state.currentEditingUser?.preferredName || '')
      || email !== (state.currentEditingUser?.email || '')
      || role !== (state.currentEditingUser?.role || 'user');

    if (dom.editUserChangesSummary) {
      const changes = [];
      const fullNameChange = describeEditChange('full name', state.currentEditingUser?.fullName || '', fullName);
      if (fullNameChange) changes.push(fullNameChange);
      const preferredChange = describeEditChange('preferred name', state.currentEditingUser?.preferredName || '', preferredName);
      if (preferredChange) changes.push(preferredChange);
      const emailChange = describeEditChange('email', state.currentEditingUser?.email || '', email);
      if (emailChange) changes.push(emailChange);
      const roleChange = describeEditChange('role', state.currentEditingUser?.role || 'user', role || 'user');
      if (roleChange) changes.push(roleChange);
      dom.editUserChangesSummary.textContent = changes.length ? changes.join(' ') : 'No changes yet.';
    }

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

    const impactBase = 'Profile fields will be updated. A notification email will be sent.';
    const impact = noticeItems.length ? `${impactBase} ${noticeItems.join(' ')}` : impactBase;
    const message = noticeItems.length ? `Update this user? ${noticeItems.join(' ')}` : 'Update this user? A notification email will be sent after you confirm.';

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
    [dom.confirmActionReason, dom.confirmActionEmail, dom.confirmActionInput, dom.confirmActionWarningType, dom.confirmActionApiKeySelect].forEach((input) => {
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

  function resetConfirmWarningFields() {
    if (dom.confirmActionWarningTypeWrap) dom.confirmActionWarningTypeWrap.classList.add('d-none');
    if (dom.confirmActionApiKeyWrap) dom.confirmActionApiKeyWrap.classList.add('d-none');
    if (dom.confirmActionWarningTypeHelp) dom.confirmActionWarningTypeHelp.textContent = '';
    if (dom.confirmActionApiKeyHelp) dom.confirmActionApiKeyHelp.textContent = '';
    if (dom.confirmActionWarningType) dom.confirmActionWarningType.value = 'website';
    if (dom.confirmActionApiKeySelect) dom.confirmActionApiKeySelect.innerHTML = '';
    state.confirmActionApiKeys = [];
  }

  async function loadConfirmActionApiKeys(userId) {
    if (!Number.isInteger(userId) || !dom.confirmActionApiKeySelect) {
      state.confirmActionApiKeys = [];
      return [];
    }
    try {
      const response = await apiFetch(`/admin/users/${userId}/api-keys`, { method: 'POST', body: {} });
      const data = await parseResponse(response);
      const keys = Array.isArray(data?.keys) ? data.keys : [];
      state.confirmActionApiKeys = keys;
      return keys;
    } catch (err) {
      errorLog('[Admin] Failed to load API keys', err);
      state.confirmActionApiKeys = [];
      return [];
    }
  }

  function renderConfirmActionApiKeys(keys = []) {
    if (!dom.confirmActionApiKeySelect) return;
    if (!keys.length) {
      dom.confirmActionApiKeySelect.innerHTML = '<option value="">No active API keys</option>';
      return;
    }
    const options = ['<option value="">Select API key</option>'].concat(keys.map((key) => {
      const label = `${key.name || 'API key'}${key.keyPrefix ? ` (${key.keyPrefix})` : ''}`;
      return `<option value="${escapeHtml(String(key.id))}">${escapeHtml(label)}</option>`;
    }));
    dom.confirmActionApiKeySelect.innerHTML = options.join('');
    if (keys.length === 1) {
      dom.confirmActionApiKeySelect.value = String(keys[0].id);
    }
  }

  function updateConfirmWarningTypeHelp({ hasApiKeys }) {
    if (!dom.confirmActionWarningTypeHelp) return;
    if (!hasApiKeys) {
      dom.confirmActionWarningTypeHelp.textContent = 'API usage warning is unavailable because this user has no active API keys.';
    } else {
      dom.confirmActionWarningTypeHelp.textContent = 'Choose which usage stream this notice should cover.';
    }
  }

  function getSelectedWarningType() {
    if (!dom.confirmActionWarningType || dom.confirmActionWarningTypeWrap?.classList.contains('d-none')) return null;
    return dom.confirmActionWarningType.value || 'website';
  }

  function getSelectedApiKeyId() {
    if (!dom.confirmActionApiKeySelect || dom.confirmActionApiKeyWrap?.classList.contains('d-none')) return null;
    const value = Number(dom.confirmActionApiKeySelect.value);
    return Number.isInteger(value) ? value : null;
  }

  function updateConfirmWarningFields(config) {
    if (!config?.warningTypeEnabled || !dom.confirmActionWarningTypeWrap) {
      resetConfirmWarningFields();
      return;
    }
    dom.confirmActionWarningTypeWrap.classList.remove('d-none');
    const warningType = config.warningTypeDefault || 'website';
    if (dom.confirmActionWarningType) dom.confirmActionWarningType.value = warningType;
    const hasApiKeys = Array.isArray(state.confirmActionApiKeys) && state.confirmActionApiKeys.length > 0;
    const apiOption = dom.confirmActionWarningType?.querySelector('option[value="api"]');
    if (apiOption) apiOption.disabled = !hasApiKeys;
    updateConfirmWarningTypeHelp({ hasApiKeys });
    if (dom.confirmActionApiKeyWrap) {
      const selectedType = dom.confirmActionWarningType?.value;
      if (selectedType === 'api' && !hasApiKeys) {
        if (dom.confirmActionWarningType) dom.confirmActionWarningType.value = 'website';
      }
      const showApiKey = config.apiKeyEnabled && dom.confirmActionWarningType?.value === 'api';
      dom.confirmActionApiKeyWrap.classList.toggle('d-none', !showApiKey);
    }
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
    const displayName = resolvedUser?.fullName || resolvedUser?.preferredName || resolvedUser?.email || 'User';
    const displayEmail = resolvedUser?.email || '';
    const displayId = Number.isInteger(resolvedUser?.id) ? resolvedUser.id : (Number.isInteger(config.userId) ? config.userId : null);
    const userLabelParts = [
      escapeHtml(displayName),
      displayEmail ? `(${escapeHtml(displayEmail)})` : null,
      displayId ? `ID ${escapeHtml(String(displayId))}` : null
    ].filter(Boolean);
    const userLabel = userLabelParts.length ? userLabelParts.join(' · ') : 'User: Unknown';

    state.confirmActionConfig = {
      title: config.title || 'Confirm action',
      message: config.message || 'Review and confirm this action.',
      actionLabel: config.actionLabel || config.title || 'Action',
      impact: config.impact || 'No additional impact specified.',
      willNotify: Boolean(config.willNotify),
      destructive: Boolean(config.destructive || config.confirmText),
      confirmLabel: config.confirmLabel || 'Confirm',
      reasonEnabled: Boolean(config.reasonEnabled || config.reasonRequired),
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

    const showReason = state.confirmActionConfig.reasonRequired || state.confirmActionConfig.reasonEnabled;
    dom.confirmActionReasonWrap.classList.toggle('d-none', !showReason);
    dom.confirmActionEmailWrap.classList.toggle('d-none', !state.confirmActionConfig.emailRequired);
    configureConfirmExpiry(state.confirmActionConfig);
    dom.confirmActionInputWrap.classList.toggle('d-none', !state.confirmActionConfig.confirmText);
    resetConfirmWarningFields();
    if (state.confirmActionConfig.warningTypeEnabled) {
      dom.confirmActionWarningTypeWrap?.classList.remove('d-none');
      if (dom.confirmActionWarningType) {
        dom.confirmActionWarningType.value = state.confirmActionConfig.warningTypeDefault || 'website';
      }
      loadConfirmActionApiKeys(state.confirmActionConfig.userId).then((keys) => {
        renderConfirmActionApiKeys(keys);
        updateConfirmWarningFields(state.confirmActionConfig);
        validateConfirmAction();
      });
      updateConfirmWarningFields(state.confirmActionConfig);
    }
    dom.confirmActionReason.value = '';
    dom.confirmActionEmail.value = state.confirmActionConfig.prefillEmail || '';
    if (dom.confirmActionReason) {
      dom.confirmActionReason.placeholder = state.confirmActionConfig.reasonPlaceholder || '';
    }
    if (dom.confirmActionEmail) {
      dom.confirmActionEmail.readOnly = Boolean(state.confirmActionConfig.emailReadOnly);
      dom.confirmActionEmail.setAttribute('aria-readonly', dom.confirmActionEmail.readOnly ? 'true' : 'false');
    }
    dom.confirmActionInput.value = '';
    dom.confirmActionInput.placeholder = state.confirmActionConfig.confirmText || '';
    dom.confirmActionReasonHelp.textContent = '';
    dom.confirmActionEmailHelp.textContent = '';
    dom.confirmActionInputHelp.textContent = '';
    toggleSubmit(dom.confirmActionSubmit, !state.confirmActionConfig.confirmText && !state.confirmActionConfig.reasonRequired && !state.confirmActionConfig.emailRequired);
    if (state.confirmActionConfig.fromUserDetails && window.modalStack && dom.userDetailsModal?.classList.contains('show')) {
      window.modalStack.push('userDetailsModal', 'confirmActionModal');
    } else {
      const instance = bootstrap.Modal.getOrCreateInstance(dom.confirmActionModal);
      instance.show();
    }
    validateConfirmAction();
    checkConfirmEmailPreferences();
  }

  function renderConfirmActionSummaryMeta(items = []) {
    if (!dom.confirmActionSummaryMeta) return;
    dom.confirmActionSummaryMeta.innerHTML = '';
    dom.confirmActionSummaryMeta.classList.add('d-none');
    if (items.length) {
      const metaRows = items.map((item) => `
        <div class="d-flex justify-content-between small">
          <span class="text-muted">${escapeHtml(item.label)}</span>
          <span class="fw-semibold">${escapeHtml(item.value)}</span>
        </div>
      `).join('');
      dom.confirmActionSummaryMeta.innerHTML = `
        <div class="text-muted small mb-1">Details</div>
        <div class="d-grid gap-1">${metaRows}</div>
      `;
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
    if (cfg.warningTypeEnabled) {
      const warningType = getSelectedWarningType();
      const isValidType = warningType === 'website' || warningType === 'api';
      if (cfg.warningTypeRequired && !isValidType) {
        if (dom.confirmActionWarningTypeHelp) {
          dom.confirmActionWarningTypeHelp.textContent = 'Select a warning type.';
        }
        valid = false;
      }
      const hasApiKeys = Array.isArray(state.confirmActionApiKeys) && state.confirmActionApiKeys.length > 0;
      if (isValidType && hasApiKeys && dom.confirmActionWarningTypeHelp) {
        dom.confirmActionWarningTypeHelp.textContent = 'Choose which usage stream this notice should cover.';
      }
      if (warningType === 'api') {
        if (!hasApiKeys) {
          if (dom.confirmActionApiKeyHelp) dom.confirmActionApiKeyHelp.textContent = 'No active API keys available for this user.';
          valid = false;
        } else if (cfg.apiKeyRequired) {
          const apiKeyId = getSelectedApiKeyId();
          if (!apiKeyId) {
            if (dom.confirmActionApiKeyHelp) dom.confirmActionApiKeyHelp.textContent = 'Select an API key.';
            valid = false;
          } else if (dom.confirmActionApiKeyHelp) {
            dom.confirmActionApiKeyHelp.textContent = '';
          }
        }
      } else if (dom.confirmActionApiKeyHelp) {
        dom.confirmActionApiKeyHelp.textContent = '';
      }
      cfg.warningTypeValue = warningType;
      cfg.apiKeyIdValue = getSelectedApiKeyId();
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
    if (cfg.reasonEnabled) {
      const reasonValue = dom.confirmActionReason.value.trim();
      if (reasonValue || cfg.reasonRequired) body.reason = reasonValue;
    }
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
    if (cfg.warningTypeEnabled) {
      const warningType = cfg.warningTypeValue || getSelectedWarningType() || 'website';
      body.warningType = warningType;
      if (warningType === 'api') {
        const apiKeyId = cfg.apiKeyIdValue || getSelectedApiKeyId();
        if (Number.isInteger(apiKeyId)) body.apiKeyId = apiKeyId;
      }
      if (cfg.warningUsageLevels && cfg.warningUsageLevels[warningType]) {
        body.usageLevel = cfg.warningUsageLevels[warningType];
      }
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

  async function openSessionsModal(userId, { fromUserDetails = false } = {}) {
    const user = state.users.find((u) => u.id === userId);
    if (!user) return;
    state.sessionsUser = user;
    dom.sessionsModalTitle.textContent = `Sessions · ${user.email || user.fullName || user.id}`;
    dom.sessionsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Loading sessions…</td></tr>';
    hideAlert(dom.sessionsAlert);
    if (fromUserDetails && window.modalStack && dom.userDetailsModal?.classList.contains('show')) {
      window.modalStack.push('userDetailsModal', 'sessionsModal');
    } else {
      bootstrap.Modal.getOrCreateInstance(dom.sessionsModal).show();
    }
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
    event.stopPropagation();
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
        impact: 'This user will remain unverified until they verify via the link in the email.',
        willNotify: true,
        emailType: 'verification',
        user,
        userId,
        url: '/admin/users/send-verification',
        method: 'POST',
        onSuccess: 'users',
        cooldownKey,
        emailRequired: true,
        emailReadOnly: true,
        emailFieldName: 'email',
        prefillEmail: user?.email || '',
        expiryEnabled: true,
        expiryDefaultMinutes: 30,
        summaryItems: [
          { label: 'Recipient', value: user?.email || '—' },
          { label: 'Verification status', value: 'Set to unverified until confirmed' }
        ],
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
        emailReadOnly: true,
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

  function handleConfirmWarningTypeChange() {
    updateConfirmWarningFields(state.confirmActionConfig);
    validateConfirmAction();
  }

  function handleConfirmApiKeyChange() {
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

  function renderLogsNotConfigured() {
    if (!dom.logsTbody) return;
    dom.logsTbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">Logs are not configured. Enable file logging to view entries.</td></tr>';
    if (dom.logsSummary) dom.logsSummary.textContent = 'Logs are not configured.';
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
      sortBy: dom.logsSortBy?.value || 'logged_at',
      order: dom.logsSortOrder?.value || 'desc',
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

  function hasActiveLogFilters(filters) {
    if (!filters) return false;
    const hasStatusRange = Number.isFinite(filters.statusMin) || Number.isFinite(filters.statusMax);
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
      || hasStatusRange
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
    dom.logsSummary.textContent = count ? `Showing ${start}–${end} of ${totalDisplay}` : 'No logs recorded yet.';
    if (dom.logsPageInfo) dom.logsPageInfo.textContent = `Page ${state.logsPage}`;
    renderPaginationNav(dom.logsPagination, state.logsPage, state.logsHasNext, (nextPage) => {
      if (nextPage < 1 || (!state.logsHasNext && nextPage > state.logsPage)) return;
      state.logsPage = nextPage;
      fetchLogs().catch(() => {});
    });
  }

  function renderLogs(logs) {
    state.logs = Array.isArray(logs) ? logs : [];
    if (!dom.logsTbody) return;
    if (!state.logs.length) {
      dom.logsTbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">No logs recorded yet.</td></tr>';
      return;
    }

    const rows = state.logs.map((log, index) => {
      const rawMessage = log.error_summary || log.message || '—';
      const message = String(rawMessage);
      const status = log.status_code || log.status || '—';
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
          <td class="admin-col-actions text-end">
            <div class="d-inline-flex align-items-center row-actions">
              <button class="btn btn-outline-secondary btn-sm icon-btn js-view-log" type="button" data-log-index="${index}" aria-label="View log details" title="View log details">
                <i class="bi bi-eye" aria-hidden="true"></i>
              </button>
            </div>
          </td>
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
    const offset = (state.logsPage - 1) * state.logsLimit;
    const limit = state.logsLimit;

    try {
      const useSearch = hasActiveLogFilters(filters);
      log('[Admin][Logs] Fetch logs', { page: state.logsPage, limit, filters, mode: useSearch ? 'search' : 'list' });
      const body = {
        search: filters.search || undefined,
        category: filters.type || undefined,
        level: filters.level || undefined,
        sortBy: filters.sortBy || undefined,
        order: filters.order || undefined,
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
      const endpoint = useSearch
        ? '/logs/search'
        : `/logs?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}&sortBy=${encodeURIComponent(filters.sortBy || 'logged_at')}&order=${encodeURIComponent(filters.order || 'desc')}`;
      const response = await apiFetch(endpoint, useSearch ? { method: 'POST', body } : { method: 'GET' });
      const payload = await parseResponse(response);

      const logs = Array.isArray(payload?.logs) ? payload.logs : [];
      if (payload?.configured === false) {
        showAlert(dom.logsAlert, payload?.message || 'Logs are not configured for this environment.');
        renderLogsNotConfigured();
        return;
      }
      const count = Number.isFinite(payload?.count) ? payload.count : logs.length;
      const total = Number.isFinite(payload?.total) ? payload.total : (offset + count);
      if (Array.isArray(payload?.warnings) && payload.warnings.length) {
        showAlert(dom.logsAlert, payload.warnings.join(' '));
      }
      state.logsTotal = total;
      state.logsHasNext = offset + count < total;
      renderLogs(logs);
      updateLogsSummary(count, total);
    } catch (err) {
      errorLog('[Admin][Logs] Failed to fetch logs', err);
      if (err?.isNetworkError) {
        showAlert(dom.logsAlert, 'Network or CORS error. Unable to load logs.');
      } else if (err?.status === 403 && dom.logsAlert) {
        dom.logsAlert.innerHTML = '<strong>Admin access required.</strong> You do not have permission to view logs.';
        dom.logsAlert.classList.remove('d-none');
      } else {
        showApiError(dom.logsAlert, err);
      }
      dom.logsTbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">Unable to load logs.</td></tr>';
      throw err;
    }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function exportLogs() {
    hideAlert(dom.logsAlert);
    const filters = getLogFilters();
    const body = {
      search: filters.search || undefined,
      category: filters.type || undefined,
      level: filters.level || undefined,
      sortBy: filters.sortBy || undefined,
      order: filters.order || undefined,
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
      format: 'csv'
    };
    try {
      const response = await apiFetch('/logs/export', { method: 'POST', body });
      if (!response.ok) {
        await parseResponse(response);
        return;
      }
      const contentType = response.headers.get('content-type') || '';
      const timestamp = new Date().toISOString().slice(0, 10);
      if (contentType.includes('text/csv')) {
        const csvBlob = await response.blob();
        triggerDownload(csvBlob, `logs-export-${timestamp}.csv`);
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (data?.configured === false) {
        showAlert(dom.logsAlert, data?.message || 'Logs are not configured for this environment.');
        return;
      }
      const jsonBlob = new Blob([JSON.stringify(data?.logs || [], null, 2)], { type: 'application/json' });
      triggerDownload(jsonBlob, `logs-export-${timestamp}.json`);
    } catch (err) {
      errorLog('[Admin][Logs] Export failed', err);
      if (err?.isNetworkError) {
        showAlert(dom.logsAlert, 'Network or CORS error. Unable to export logs.');
      } else {
        showApiError(dom.logsAlert, err);
      }
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
      const warnings = [
        ...(Array.isArray(typesData?.warnings) ? typesData.warnings : []),
        ...(Array.isArray(levelsData?.warnings) ? levelsData.warnings : []),
        ...(Array.isArray(statusesData?.warnings) ? statusesData.warnings : [])
      ];
      if (typesData?.configured === false || levelsData?.configured === false || statusesData?.configured === false) {
        showAlert(dom.logsAlert, typesData?.message || levelsData?.message || statusesData?.message || 'Logs are not configured for this environment.');
        renderLogsNotConfigured();
        state.logsMetaLoaded = true;
        return;
      }
      if (warnings.length) {
        showAlert(dom.logsAlert, warnings.join(' '));
      }
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
      if (err?.isNetworkError) {
        showAlert(dom.logsAlert, 'Network or CORS error. Unable to load log filters.');
      } else {
        showApiError(dom.logsAlert, err);
      }
      throw err;
    }
  }

  async function ensureLogsInitialized() {
    if (state.logsInitialized) return;
    await loadLogsMeta();
    await fetchLogs({ resetPage: true });
    state.logsInitialized = true;
  }

  function clearLogsFilters({ preserveSearch = false } = {}) {
    if (!preserveSearch && dom.logsSearchInput) dom.logsSearchInput.value = '';
    if (dom.logsTypeFilter) dom.logsTypeFilter.value = '';
    if (dom.logsLevelFilter) dom.logsLevelFilter.value = '';
    if (dom.logsStatusFilter) dom.logsStatusFilter.value = '';
    if (dom.logsSortBy) dom.logsSortBy.value = 'logged_at';
    if (dom.logsSortOrder) dom.logsSortOrder.value = 'desc';
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

  function renderLogDetailContent(logEntry) {
    if (!dom.logsDetailContent) return;
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

  async function openLogDetail(index) {
    const logEntry = state.logs[index];
    if (!logEntry || !dom.logsDetailContent) return;
    state.currentLogDetail = logEntry;
    if (logEntry.id) {
      try {
        const response = await apiFetch(`/logs/${logEntry.id}`, { method: 'GET' });
        const data = await parseResponse(response);
        if (data?.log) {
          state.currentLogDetail = data.log;
          renderLogDetailContent(data.log);
          return;
        }
      } catch (err) {
        showApiError(dom.logsDetailAlert, err);
      }
    }
    renderLogDetailContent(logEntry);
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
      el.textContent = 'No usage recorded yet.';
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
      dom.usageUsersTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No usage recorded yet.</td></tr>';
      updateUsageSummary(dom.usageUsersSummary, 0, window);
      return;
    }

    const rows = state.usageUsers.map((user, index) => {
      const userId = Number.isInteger(user.userId) ? user.userId : null;
      const resolved = resolveUsageUser(userId, user.email);
      const displayName = resolved.preferredName || resolved.fullName || resolved.email || 'User';
      const emailText = resolved.email || user.email || '—';
      const roleText = user.role ? ` · ${user.role}` : '';
      const score = Number.isFinite(user.usageScore) ? user.usageScore : null;
      const requests = Number.isFinite(user.requestCount) ? user.requestCount : 0;
      const levelBadge = renderUsageLevelBadge(user.usageLevel || 'Low');
      const lastSeen = formatDateTime(user.lastSeen);
      const topEndpoints = renderUsageEndpoints(user.topEndpoints);
      const dropdown = userId ? `
        <div class="d-inline-flex align-items-center row-actions">
          <div class="dropdown">
            <button class="btn btn-outline-secondary btn-sm icon-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Usage actions" title="Usage actions">
              <i class="bi bi-chevron-right" aria-hidden="true"></i>
            </button>
            <div class="dropdown-menu dropdown-menu-end">
              <button class="dropdown-item" type="button" data-usage-action="ban" data-user-id="${userId}" data-user-email="${escapeHtml(emailText)}">Block API key creation</button>
              <button class="dropdown-item" type="button" data-usage-action="unban" data-user-id="${userId}" data-user-email="${escapeHtml(emailText)}">Allow API key creation</button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item" type="button" data-usage-action="lockout" data-user-id="${userId}" data-user-email="${escapeHtml(emailText)}">Apply usage lockout</button>
              <button class="dropdown-item" type="button" data-usage-action="lockout-clear" data-user-id="${userId}" data-user-email="${escapeHtml(emailText)}">Clear usage lockout</button>
            </div>
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
            <div class="fw-semibold">${score === null ? 'Not enough data yet' : score}</div>
            <div class="mt-1">${score === null ? '<span class="text-muted">—</span>' : levelBadge}</div>
          </td>
          <td>${requests}</td>
          <td>${topEndpoints}</td>
          <td>${lastSeen}</td>
          <td class="admin-col-actions text-end">${dropdown}</td>
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
      dom.usageApiKeysTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No usage recorded yet.</td></tr>';
      updateUsageSummary(dom.usageApiKeysSummary, 0, window);
      return;
    }

    const rows = state.usageApiKeys.map((key, index) => {
      const apiKeyId = Number.isInteger(key.apiKeyId) ? key.apiKeyId : null;
      const userId = Number.isInteger(key.userId) ? key.userId : null;
      const keyLabel = key.apiKeyLabel || 'API key';
      const keyPrefix = key.apiKeyPrefix ? `(${key.apiKeyPrefix})` : '';
      const userEmail = key.email || '—';
      const score = Number.isFinite(key.usageScore) ? key.usageScore : null;
      const requests = Number.isFinite(key.requestCount) ? key.requestCount : 0;
      const levelBadge = renderUsageLevelBadge(key.usageLevel || 'Low');
      const lastSeen = formatDateTime(key.lastSeen);
      const topEndpoints = renderUsageEndpoints(key.topEndpoints);
      const dropdown = apiKeyId ? `
        <div class="d-inline-flex align-items-center row-actions">
          <div class="dropdown">
            <button class="btn btn-outline-secondary btn-sm icon-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Usage actions" title="Usage actions">
              <i class="bi bi-chevron-right" aria-hidden="true"></i>
            </button>
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
            <div class="fw-semibold">${score === null ? 'Not enough data yet' : score}</div>
            <div class="mt-1">${score === null ? '<span class="text-muted">—</span>' : levelBadge}</div>
          </td>
          <td>${requests}</td>
          <td>${topEndpoints}</td>
          <td>${lastSeen}</td>
          <td class="admin-col-actions text-end">${dropdown}</td>
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
      if (data?.configured === false) {
        showAlert(dom.usageAlert, data?.message || 'Usage data is not configured for this environment.');
        renderUsageNotConfigured();
        return;
      }
      renderUsageUsers(data?.users || [], data?.window);
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        showAlert(dom.usageAlert, data.warnings.join(' '));
      }
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
      if (data?.configured === false) {
        showAlert(dom.usageAlert, data?.message || 'Usage data is not configured for this environment.');
        renderUsageNotConfigured();
        return;
      }
      renderUsageApiKeys(data?.apiKeys || [], data?.window);
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        showAlert(dom.usageAlert, data.warnings.join(' '));
      }
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
    const items = Array.isArray(types) ? types : [];
    const normalized = [];
    const meta = {};
    items.forEach((item) => {
      if (typeof item === 'string') {
        normalized.push(item);
        meta[item] = getEmailTypeFallback();
        return;
      }
      if (item && typeof item === 'object') {
        const key = item.type || item.name;
        if (!key) return;
        normalized.push(key);
        meta[key] = {
          description: item.description || getEmailTypeFallback().description,
          fields: Array.isArray(item.fields) ? item.fields : getEmailTypeFallback().fields
        };
      }
    });
    state.emailTypes = normalized;
    state.emailTypeMeta = meta;
    if (!dom.emailTypeSelect) return;
    const options = ['<option value="">Select an email type</option>', ...state.emailTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)];
    dom.emailTypeSelect.innerHTML = options.join('');
    updateEmailHistoryTypeOptions();
  }

  function updateEmailHistoryTypeOptions() {
    if (!dom.emailHistoryTypeFilter) return;
    const current = dom.emailHistoryTypeFilter.value;
    const options = ['<option value="">Type: any</option>', ...state.emailTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)];
    dom.emailHistoryTypeFilter.innerHTML = options.join('');
    if (current) dom.emailHistoryTypeFilter.value = current;
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
      renderEmailTypeFields(dom.emailTypeSelect?.value || '');
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

  function getEmailTypeMeta(type) {
    return state.emailTypeMeta?.[type] || getEmailTypeFallback();
  }

  function renderEmailTypeFields(type) {
    const meta = getEmailTypeMeta(type);
    if (dom.emailTypeDescription) dom.emailTypeDescription.textContent = meta.description || '';
    if (!dom.emailTypeFields) return;
    if (!meta.fields.length) {
      dom.emailTypeFields.innerHTML = '<div class="text-muted small">No additional details required.</div>';
      return;
    }
    dom.emailTypeFields.innerHTML = meta.fields.map((field) => {
      const fieldId = `emailField_${field.name}`;
      const helpId = `emailHelp_${field.name}`;
      const hintId = `emailHint_${field.name}`;
      const label = escapeHtml(field.label || field.name);
      const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : '';
      const requiredAttr = field.required ? ' required' : '';
      const maxLengthAttr = Number.isInteger(field.maxLength) ? ` maxlength="${field.maxLength}"` : '';
      const patternAttr = field.pattern ? ` pattern="${escapeHtml(field.pattern)}"` : '';
      const hintMarkup = field.helpText ? `<div class="form-text text-muted" id="${hintId}">${escapeHtml(field.helpText)}</div>` : '';
      if (field.type === 'textarea') {
        return `
          <div class="mb-3">
            <label class="form-label" for="${fieldId}">${label}</label>
            <textarea class="form-control" id="${fieldId}" data-email-field="${escapeHtml(field.name)}" rows="3"${placeholder}${requiredAttr}${maxLengthAttr}${patternAttr}></textarea>
            ${hintMarkup}
            <div class="form-text text-danger" id="${helpId}" data-email-field-help="${escapeHtml(field.name)}"></div>
          </div>
        `;
      }
      const inputType = field.type === 'datetime-local' ? 'datetime-local' : (field.type || 'text');
      const stepAttr = field.type === 'number' ? ' step="1"' : '';
      return `
        <div class="mb-3">
          <label class="form-label" for="${fieldId}">${label}</label>
          <input class="form-control" type="${inputType}" id="${fieldId}" data-email-field="${escapeHtml(field.name)}"${stepAttr}${placeholder}${requiredAttr}${maxLengthAttr}${patternAttr} />
          ${hintMarkup}
          <div class="form-text text-danger" id="${helpId}" data-email-field-help="${escapeHtml(field.name)}"></div>
        </div>
      `;
    }).join('');
  }

  function renderUsageNotConfigured() {
    const message = 'Usage data is not configured. Request logs storage is required to generate usage.';
    if (dom.usageUsersTbody) {
      dom.usageUsersTbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">${message}</td></tr>`;
    }
    if (dom.usageApiKeysTbody) {
      dom.usageApiKeysTbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">${message}</td></tr>`;
    }
    if (dom.usageUsersSummary) dom.usageUsersSummary.textContent = 'Usage is not configured.';
    if (dom.usageApiKeysSummary) dom.usageApiKeysSummary.textContent = 'Usage is not configured.';
  }

  function resetEmailForm() {
    clearSuccess(dom.emailsSuccess);
    hideAlert(dom.emailsAlert);
    if (dom.emailTypeSelect) dom.emailTypeSelect.value = '';
    if (dom.emailRecipientInput) dom.emailRecipientInput.value = state.adminEmail || '';
    if (dom.emailRecipientHelp) dom.emailRecipientHelp.textContent = '';
    renderEmailTypeFields('');
    toggleSubmit(dom.emailSendTestBtn, false);
  }

  function resolveEmailFieldValue(field) {
    const input = dom.emailTypeFields?.querySelector(`[data-email-field="${field.name}"]`);
    const help = dom.emailTypeFields?.querySelector(`[data-email-field-help="${field.name}"]`);
    if (help) help.textContent = '';
    if (!input) return { value: null };
    const raw = (input.value || '').trim();
    if (!raw) {
      if (field.required) {
        if (help) help.textContent = 'This field is required.';
        return { error: true };
      }
      return { value: null };
    }
    if (Number.isInteger(field.maxLength) && raw.length > field.maxLength) {
      if (help) help.textContent = `Use ${field.maxLength} characters or fewer.`;
      return { error: true };
    }
    if (field.pattern) {
      try {
        const pattern = new RegExp(field.pattern);
        if (!pattern.test(raw)) {
          if (help) help.textContent = 'Value does not match the required format.';
          return { error: true };
        }
      } catch (err) {
        if (help) help.textContent = 'Invalid format pattern.';
        return { error: true };
      }
    }
    if (field.type === 'number') {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed)) {
        if (help) help.textContent = 'Enter a valid number.';
        return { error: true };
      }
      return { value: parsed };
    }
    if (field.type === 'email') {
      const error = validateEmail(raw);
      if (error) {
        if (help) help.textContent = error;
        return { error: true };
      }
      return { value: raw };
    }
    if (field.type === 'datetime-local') {
      const parsed = Date.parse(raw);
      if (Number.isNaN(parsed)) {
        if (help) help.textContent = 'Use a valid date and time.';
        return { error: true };
      }
      return { value: new Date(parsed).toISOString() };
    }
    return { value: raw };
  }

  function collectEmailContext(type) {
    const meta = getEmailTypeMeta(type);
    const context = {};
    let valid = true;
    meta.fields.forEach((field) => {
      const resolved = resolveEmailFieldValue(field);
      if (resolved?.error) {
        valid = false;
        return;
      }
      if (resolved?.value === null || resolved?.value === undefined) return;
      if (field.name === 'changeSummary') {
        context.changes = [{ label: 'Update', oldValue: '', newValue: resolved.value }];
        return;
      }
      context[field.name] = resolved.value;
    });
    return { valid, context };
  }

  function validateEmailTestForm() {
    const emailType = dom.emailTypeSelect?.value || '';
    const recipient = dom.emailRecipientInput?.value.trim() || '';
    const emailError = validateEmail(recipient);
    if (dom.emailRecipientHelp) dom.emailRecipientHelp.textContent = recipient ? emailError : '';
    const { valid: fieldsValid, context } = collectEmailContext(emailType);
    const valid = !!emailType && !emailError && fieldsValid;
    toggleSubmit(dom.emailSendTestBtn, valid);
    return { valid, emailType, recipient, context };
  }

  function handleEmailFormChange() {
    validateEmailTestForm();
  }

  function handleEmailTypeChange() {
    const selectedType = dom.emailTypeSelect?.value || '';
    renderEmailTypeFields(selectedType);
    validateEmailTestForm();
  }

  function handleEmailReset() {
    resetEmailForm();
  }

  function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';
    const blockedTags = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'base'];
    blockedTags.forEach((tag) => {
      template.content.querySelectorAll(tag).forEach((node) => node.remove());
    });
    template.content.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || '');
        if (name.startsWith('on')) {
          node.removeAttribute(attr.name);
        }
        if ((name === 'href' || name === 'src') && value.trim().toLowerCase().startsWith('javascript:')) {
          node.removeAttribute(attr.name);
        }
      });
    });
    return template.innerHTML;
  }

  async function updateDevEmailPreview(body) {
    if (!dom.devEmailPreview) return;
    if (!body) {
      dom.devEmailPreview.innerHTML = '<div class="text-muted small">Preview will appear here.</div>';
      return;
    }
    try {
      const response = await apiFetch('/admin/markdown/render', {
        method: 'POST',
        body: { text: body }
      });
      const data = await parseResponse(response);
      const html = sanitizeHtml(data?.html || '');
      dom.devEmailPreview.innerHTML = html || '<div class="text-muted small">Preview unavailable.</div>';
    } catch (err) {
      dom.devEmailPreview.innerHTML = `<div class="text-danger small">Preview unavailable. ${escapeHtml(err?.message || '')}</div>`;
    }
  }

  function shouldIgnoreUserRowClick(target) {
    if (!target) return false;
    return Boolean(target.closest('[data-row-action], button, a, input, select, textarea, label'));
  }

  function handleUserRowClick(event) {
    if (shouldIgnoreUserRowClick(event.target)) return;
    const row = event.target.closest('tr[data-user-id]');
    if (!row) return;
    const userId = Number(row.dataset.userId);
    if (!Number.isInteger(userId)) return;
    openUserDetailsModal(userId);
  }

  function handleUserRowKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (shouldIgnoreUserRowClick(event.target)) return;
    const row = event.target.closest('tr[data-user-id]');
    if (!row) return;
    event.preventDefault();
    const userId = Number(row.dataset.userId);
    if (!Number.isInteger(userId)) return;
    openUserDetailsModal(userId);
  }

  function renderUserDetailsProfile(user) {
    if (!dom.userDetailsProfile) return;
    const rows = [
      { label: 'Name', value: user.fullName || user.preferredName || '—' },
      { label: 'Email', value: user.email || '—' },
      { label: 'User ID', value: Number.isInteger(user.id) ? String(user.id) : '—' },
      { label: 'Role', value: user.role || 'user' },
      { label: 'Status', value: user.isDisabled ? 'Disabled' : 'Active' },
      { label: 'Verified', value: user.isVerified ? 'Yes' : 'No' },
      { label: 'Created', value: formatDateTime(user.createdAt || user.created_at) },
      { label: 'Last active', value: formatDateTime(user.lastActive || user.lastLogin || user.last_login) }
    ];
    dom.userDetailsProfile.innerHTML = rows.map((row) => `
      <div>
        <div class="text-muted small">${escapeHtml(row.label)}</div>
        <div class="fw-semibold">${escapeHtml(String(row.value || '—'))}</div>
      </div>
    `).join('');
  }

  function renderUserDetailsUsage({ configured, usage, window, message }) {
    if (!dom.userDetailsUsage) return;
    if (configured === false) {
      const note = message || 'Usage data is not configured.';
      dom.userDetailsUsage.innerHTML = `<div class="text-muted small">${escapeHtml(note)}</div>`;
      return;
    }
    if (!usage) {
      dom.userDetailsUsage.innerHTML = '<div class="text-muted small">No usage recorded yet.</div>';
      return;
    }
    const windowLabel = window?.startDate && window?.endDate
      ? `${formatDateTime(window.startDate)} → ${formatDateTime(window.endDate)}`
      : '—';
    const renderUsageBlock = (title, data) => {
      if (!data || !Number.isFinite(data.usageScore)) {
        return `
          <div>
            <div class="text-muted small">${escapeHtml(title)}</div>
            <div class="text-muted small">Not enough data yet.</div>
          </div>
        `;
      }
      return `
        <div>
          <div class="text-muted small">${escapeHtml(title)}</div>
          <div class="fw-semibold">Score ${data.usageScore.toLocaleString()} · ${escapeHtml(data.usageLevel || '—')}</div>
          <div class="text-muted small">Requests: ${Number.isFinite(data.requestCount) ? data.requestCount.toLocaleString() : '—'}</div>
          <div class="text-muted small">Last seen: ${escapeHtml(formatDateTime(data.lastSeen))}</div>
        </div>
      `;
    };
    const endpoints = Array.isArray(usage.topEndpoints) && usage.topEndpoints.length
      ? usage.topEndpoints.map((entry) => {
        const label = [entry.method, entry.path].filter(Boolean).join(' ');
        return `<div class="small"><span class="fw-semibold">${escapeHtml(label || '—')}</span> <span class="text-muted">× ${Number(entry.count) || 0}</span></div>`;
      }).join('')
      : '<div class="text-muted small">No endpoint breakdown yet.</div>';
    dom.userDetailsUsage.innerHTML = `
      ${renderUsageBlock('Website usage', usage.websiteUsage)}
      ${renderUsageBlock('API usage', usage.apiUsage)}
      <div>
        <div class="text-muted small">Window</div>
        <div class="fw-semibold">${escapeHtml(windowLabel)}</div>
      </div>
      <div>
        <div class="text-muted small">Top endpoints</div>
        ${endpoints}
      </div>
    `;
  }

  function updateUserDetailsEmailsSummary(count, total) {
    if (!dom.userDetailsEmailsSummary) return;
    const totalDisplay = Number.isFinite(total) ? total : count;
    dom.userDetailsEmailsSummary.textContent = count
      ? `Showing ${count} of ${totalDisplay}`
      : 'No recent emails to show';
  }

  function renderUserDetailsEmails(records) {
    if (!dom.userDetailsEmailsTbody) return;
    const rows = Array.isArray(records) ? records : [];
    if (!rows.length) {
      dom.userDetailsEmailsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No recent emails sent.</td></tr>';
      updateUserDetailsEmailsSummary(0, 0);
      return;
    }
    const badgeClass = {
      queued: 'text-bg-secondary',
      sent: 'text-bg-success',
      failed: 'text-bg-danger',
      skipped: 'text-bg-warning'
    };
    dom.userDetailsEmailsTbody.innerHTML = rows.map((row) => {
      const status = String(row.status || 'queued').toLowerCase();
      const badge = badgeClass[status] || 'text-bg-secondary';
      return `
        <tr>
          <td>${escapeHtml(row.email_type || row.emailType || '—')}</td>
          <td>${formatDateTime(row.queued_at || row.queuedAt)}</td>
          <td>${formatDateTime(row.sent_at || row.sentAt)}</td>
          <td><span class="badge ${badge}">${escapeHtml(status || 'queued')}</span></td>
        </tr>
      `;
    }).join('');
    updateUserDetailsEmailsSummary(rows.length, Number.isFinite(state.userDetailsEmailHistoryTotal) ? state.userDetailsEmailHistoryTotal : rows.length);
  }

  function renderUserEndpointUsage(entries, window) {
    if (!dom.userEndpointUsageTbody) return;
    const rows = Array.isArray(entries) ? entries : [];
    if (!rows.length) {
      dom.userEndpointUsageTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No endpoint usage recorded yet.</td></tr>';
      if (dom.userEndpointUsageSummary) dom.userEndpointUsageSummary.textContent = 'No endpoint usage recorded yet.';
      return;
    }
    dom.userEndpointUsageTbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.endpoint || '—')}</td>
        <td>${escapeHtml(row.method || '—')}</td>
        <td>${Number.isFinite(row.callCount) ? row.callCount.toLocaleString() : '—'}</td>
      </tr>
    `).join('');
    if (dom.userEndpointUsageSummary) {
      const start = window?.startDate ? formatDateTime(window.startDate) : '—';
      const end = window?.endDate ? formatDateTime(window.endDate) : '—';
      dom.userEndpointUsageSummary.textContent = `Showing ${rows.length} endpoints · ${start} → ${end}`;
    }
  }

  async function fetchUserEndpointUsage(userId) {
    if (!Number.isInteger(userId)) return null;
    hideAlert(dom.userEndpointUsageAlert);
    if (dom.userEndpointUsageTbody) {
      dom.userEndpointUsageTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Loading endpoint usage…</td></tr>';
    }
    try {
      const response = await apiFetch(`/admin/usage/users/${userId}/endpoints`, { method: 'POST', body: { limit: 20 } });
      const data = await parseResponse(response);
      if (data?.configured === false) {
        showAlert(dom.userEndpointUsageAlert, data?.message || 'Endpoint usage is not configured.');
        renderUserEndpointUsage([]);
        return null;
      }
      const entries = Array.isArray(data?.endpoints) ? data.endpoints : [];
      renderUserEndpointUsage(entries, data?.window);
      return { entries, window: data?.window };
    } catch (err) {
      errorLog('[Admin][Users] Failed to load user endpoint usage', err);
      showApiError(dom.userEndpointUsageAlert, err);
      renderUserEndpointUsage([]);
      return null;
    }
  }

  async function fetchUserDetailsEmails(user) {
    if (!dom.userDetailsEmailsTbody || !user) return;
    hideAlert(dom.userDetailsEmailsAlert);
    dom.userDetailsEmailsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Loading recent emails…</td></tr>';
    if (!user.email) {
      dom.userDetailsEmailsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No email address on file.</td></tr>';
      updateUserDetailsEmailsSummary(0, 0);
      return;
    }
    const body = {
      recipient: user.email || undefined,
      userId: Number.isInteger(user.id) ? user.id : undefined,
      page: 1,
      limit: 5
    };
    try {
      const response = await apiFetch('/admin/emails/history', { method: 'POST', body });
      const data = await parseResponse(response);
      const records = Array.isArray(data?.history) ? data.history : [];
      state.userDetailsEmailHistory = records;
      state.userDetailsEmailHistoryTotal = Number.isFinite(data?.total) ? data.total : records.length;
      renderUserDetailsEmails(records);
    } catch (err) {
      errorLog('[Admin][Users] Failed to load recent emails', err);
      showApiError(dom.userDetailsEmailsAlert, err);
      dom.userDetailsEmailsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Unable to load recent emails.</td></tr>';
      updateUserDetailsEmailsSummary(0, 0);
    }
  }

  function renderUserDetailsActions(user) {
    if (!dom.userDetailsActions) return;
    const verificationAction = user.isVerified
      ? { action: 'unverify-user', label: 'Unverify user', icon: 'bi bi-dash-circle' }
      : { action: 'verify-user', label: 'Verify user', icon: 'bi bi-check-circle' };
    const disableAction = user.isDisabled
      ? { action: 'enable-user', label: 'Enable account', icon: 'bi bi-person-check-fill' }
      : { action: 'disable-user', label: 'Disable account', icon: 'bi bi-person-x-fill' };
    dom.userDetailsActions.innerHTML = `
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="edit-user" data-user-id="${user.id}" aria-label="Edit user" title="Edit user">
        <i class="bi bi-pencil-fill" aria-hidden="true"></i>
        Edit user
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="view-sessions" data-user-id="${user.id}" aria-label="View sessions" title="View sessions">
        <i class="bi bi-pc-display-horizontal" aria-hidden="true"></i>
        View sessions
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="view-library" data-user-id="${user.id}" aria-label="View library" title="View library">
        <i class="bi bi-book-half" aria-hidden="true"></i>
        View library
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="${verificationAction.action}" data-user-id="${user.id}" aria-label="${verificationAction.label}" title="${verificationAction.label}">
        <i class="${verificationAction.icon}" aria-hidden="true"></i>
        ${verificationAction.label}
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="send-verification" data-user-id="${user.id}" aria-label="Send verification email" title="Send verification email">
        <i class="bi bi-envelope" aria-hidden="true"></i>
        Send verification email
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="reset-password" data-user-id="${user.id}" aria-label="Send password reset" title="Send password reset">
        <i class="bi bi-envelope" aria-hidden="true"></i>
        Send password reset
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="${disableAction.action}" data-user-id="${user.id}" aria-label="${disableAction.label}" title="${disableAction.label}">
        <i class="${disableAction.icon}" aria-hidden="true"></i>
        ${disableAction.label}
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="force-logout" data-user-id="${user.id}" aria-label="Force logout" title="Force logout">
        <i class="bi bi-slash-circle" aria-hidden="true"></i>
        Force logout
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="revoke-api-keys" data-user-id="${user.id}" aria-label="Revoke API keys" title="Revoke API keys">
        <i class="bi bi-slash-circle" aria-hidden="true"></i>
        Revoke API keys
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="reinstate-api-keys" data-user-id="${user.id}" aria-label="Reinstate API keys" title="Reinstate API keys">
        <i class="bi bi-person-check-fill" aria-hidden="true"></i>
        Reinstate API keys
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="send-usage-warning" data-user-id="${user.id}" aria-label="Send usage warning email" title="Send usage warning email">
        <i class="bi bi-envelope" aria-hidden="true"></i>
        Send usage warning email
      </button>
      <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" type="button" data-user-detail-action="endpoint-details" data-user-id="${user.id}" aria-label="More endpoint details" title="More endpoint details">
        <i class="bi bi-bar-chart-line-fill" aria-hidden="true"></i>
        More endpoint details
      </button>
    `;
  }

  async function fetchUserUsageDetails(userId) {
    const base = getUsageBaseFilters();
    const body = {
      userId,
      limit: 1,
      offset: 0,
      startDate: base.startDate || undefined,
      endDate: base.endDate || undefined,
      sortBy: 'usageScore',
      order: 'desc',
      topLimit: base.topLimit || 5
    };
    const response = await apiFetch('/admin/usage/users', { method: 'POST', body });
    const data = await parseResponse(response);
    if (data?.configured === false) {
      return { configured: false, message: data?.message || 'Usage data is not configured.', window: data?.window };
    }
    const usage = Array.isArray(data?.users)
      ? data.users.find((entry) => Number(entry.userId) === Number(userId)) || null
      : null;
    return { configured: true, usage, window: data?.window };
  }

  async function openUserDetailsModal(userId) {
    const user = state.users.find((u) => u.id === userId);
    if (!user) return;
    state.userDetailsUser = user;
    state.userDetailsUsage = null;
    hideAlert(dom.userDetailsAlert);
    if (dom.userDetailsTitle) dom.userDetailsTitle.textContent = `User details · ${user.email || user.fullName || user.id}`;
    renderUserDetailsProfile(user);
    renderUserDetailsUsage({ configured: true, usage: null, window: null });
    renderUserDetailsActions(user);
    if (dom.userDetailsEmailsSummary) dom.userDetailsEmailsSummary.textContent = 'Loading recent emails…';
    bootstrap.Modal.getOrCreateInstance(dom.userDetailsModal).show();
    fetchUserDetailsEmails(user).catch(() => {});
    try {
      const usageData = await fetchUserUsageDetails(userId);
      renderUserDetailsUsage({
        configured: usageData.configured,
        usage: usageData.usage,
        window: usageData.window,
        message: usageData.message
      });
      state.userDetailsUsage = usageData;
    } catch (err) {
      errorLog('[Admin][Users] Failed to load user usage', err);
      showApiError(dom.userDetailsAlert, err);
    }
  }

  async function openUserEndpointUsageModal(userId) {
    if (!Number.isInteger(userId)) return;
    const user = state.users.find((u) => u.id === userId) || state.userDetailsUser;
    if (dom.userEndpointUsageTitle) {
      dom.userEndpointUsageTitle.textContent = `Endpoint usage · ${user?.email || user?.fullName || userId}`;
    }
    renderUserEndpointUsage([], null);
    if (dom.userEndpointUsageSummary) dom.userEndpointUsageSummary.textContent = 'Loading endpoint usage…';
    await fetchUserEndpointUsage(userId);
    if (window.modalStack && dom.userDetailsModal?.classList.contains('show')) {
      window.modalStack.push('userDetailsModal', 'userEndpointUsageModal');
    } else {
      bootstrap.Modal.getOrCreateInstance(dom.userEndpointUsageModal).show();
    }
  }

  function handleUserDetailsActionClick(event) {
    const btn = event.target.closest('button[data-user-detail-action]');
    if (!btn) return;
    const action = btn.dataset.userDetailAction;
    const userId = Number(btn.dataset.userId);
    if (!Number.isInteger(userId)) return;
    const user = state.users.find((u) => u.id === userId) || state.userDetailsUser;
    if (!user) return;

    if (action === 'edit-user') {
      openEditUserModal(userId, { fromUserDetails: true });
      return;
    }

    if (action === 'view-sessions') {
      openSessionsModal(userId, { fromUserDetails: true });
      return;
    }

    if (action === 'view-library') {
      const userName = user?.preferredName || user?.fullName || '';
      const url = `admin-library?userId=${encodeURIComponent(userId)}${userName ? `&userName=${encodeURIComponent(userName)}` : ''}`;
      window.location.href = url;
      return;
    }

    if (action === 'verify-user') {
      openConfirmAction({
        title: 'Verify user',
        actionLabel: 'Verify user',
        message: 'Mark this user as verified? Provide a short reason.',
        impact: 'User will be marked as verified and notified by email.',
        willNotify: true,
        emailType: 'admin_email_verified',
        fromUserDetails: true,
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

    if (action === 'unverify-user') {
      openConfirmAction({
        title: 'Unverify user',
        actionLabel: 'Unverify user',
        message: 'Unverify this user? Provide a reason for audit.',
        impact: 'User will be marked as unverified and notified by email.',
        willNotify: true,
        emailType: 'admin_email_unverified',
        fromUserDetails: true,
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

    if (action === 'send-verification') {
      const cooldownKey = `send-verification-${userId}`;
      if (isCoolingDown(cooldownKey)) {
        showAlert(dom.userDetailsAlert, 'Please wait before sending another verification email.');
        return;
      }
      openConfirmAction({
        title: 'Send verification email',
        actionLabel: 'Send verification email',
        message: 'Send a new verification email to this user?',
        impact: 'This user will remain unverified until they verify via the link in the email.',
        willNotify: true,
        emailType: 'verification',
        fromUserDetails: true,
        user,
        userId,
        url: '/admin/users/send-verification',
        method: 'POST',
        onSuccess: 'users',
        cooldownKey,
        emailRequired: true,
        emailReadOnly: true,
        emailFieldName: 'email',
        prefillEmail: user?.email || '',
        expiryEnabled: true,
        expiryDefaultMinutes: 30,
        summaryItems: [
          { label: 'Recipient', value: user?.email || '—' },
          { label: 'Verification status', value: 'Set to unverified until confirmed' }
        ],
        successMessage: 'Verification email sent successfully.'
      });
      return;
    }

    if (action === 'reset-password') {
      const cooldownKey = `reset-password-${userId}`;
      if (isCoolingDown(cooldownKey)) {
        showAlert(dom.userDetailsAlert, 'Password reset email already sent recently.');
        return;
      }
      openConfirmAction({
        title: 'Send password reset',
        actionLabel: 'Send password reset',
        message: 'Send a password reset email to this user?',
        impact: 'User will receive a password reset link via email (default 30 minutes expiry).',
        willNotify: true,
        emailType: 'password_reset',
        fromUserDetails: true,
        user,
        userId,
        url: '/admin/users/reset-password',
        method: 'POST',
        onSuccess: 'users',
        cooldownKey,
        emailRequired: true,
        emailReadOnly: true,
        emailFieldName: 'email',
        prefillEmail: user?.email || '',
        expiryEnabled: true,
        expiryDefaultMinutes: 30,
        successMessage: 'Password reset email sent successfully.'
      });
      return;
    }

    if (action === 'disable-user' || action === 'enable-user') {
      if (state.currentUserId && userId === state.currentUserId) {
        showAlert(dom.userDetailsAlert, 'You cannot disable your own account.');
        return;
      }
      const isDisabled = action === 'enable-user';
      openConfirmAction({
        title: `${isDisabled ? 'Enable' : 'Disable'} user`,
        actionLabel: isDisabled ? 'Enable user' : 'Disable user',
        message: isDisabled ? 'Re-enable this account and allow logins?' : 'Disable this account and revoke active sessions?',
        impact: isDisabled ? 'Account will be restored and login allowed. A notification email will be sent.' : 'Account will be disabled and active sessions revoked. A notification email will be sent.',
        willNotify: true,
        emailType: isDisabled ? 'admin_account_enabled' : 'admin_account_disabled',
        fromUserDetails: true,
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

    if (action === 'force-logout') {
      openConfirmAction({
        title: 'Force logout',
        actionLabel: 'Force logout',
        message: 'Revoke all sessions for this user?',
        impact: 'All refresh tokens will be revoked. The user must sign in again on every device.',
        destructive: true,
        confirmText: 'LOGOUT',
        fromUserDetails: true,
        user,
        userId,
        url: '/admin/users/force-logout',
        method: 'POST',
        onSuccess: 'users',
        successMessage: 'All sessions revoked successfully.'
      });
      return;
    }

    if (action === 'revoke-api-keys') {
      openConfirmAction({
        title: 'Revoke API keys',
        actionLabel: 'Revoke API keys',
        message: 'Revoke all API keys for this user?',
        impact: 'All API keys for this user will be revoked. A notification email will be sent.',
        willNotify: true,
        emailType: 'api_key_revoked',
        fromUserDetails: true,
        user,
        userId,
        url: '/admin/api-keys/revoke',
        method: 'POST',
        baseBody: { userId },
        confirmText: 'REVOKE',
        destructive: true,
        summaryItems: [{ label: 'User', value: user.email || String(userId) }],
        onSuccess: 'users',
        successMessage: 'API keys revoked.'
      });
      return;
    }

    if (action === 'reinstate-api-keys') {
      openConfirmAction({
        title: 'Reinstate API key creation',
        actionLabel: 'Reinstate API keys',
        message: 'Allow API key creation for this user?',
        impact: 'API key creation will be allowed again. A notification email will be sent.',
        willNotify: true,
        emailType: 'api_key_ban_removed',
        fromUserDetails: true,
        user,
        userId,
        url: '/admin/users/api-key-unban',
        method: 'POST',
        baseBody: { id: userId },
        summaryItems: [{ label: 'User', value: user.email || String(userId) }],
        onSuccess: 'users',
        successMessage: 'API key creation reinstated.'
      });
      return;
    }

    if (action === 'send-usage-warning') {
      const usageLevelWebsite = state.userDetailsUsage?.usage?.websiteUsage?.usageLevel || 'High';
      const usageLevelApi = state.userDetailsUsage?.usage?.apiUsage?.usageLevel || 'High';
      openConfirmAction({
        title: 'Send usage warning',
        actionLabel: 'Send usage warning',
        message: 'Send a usage warning email to this user?',
        impact: 'An email will be sent to the recipient. No profile fields will change.',
        willNotify: true,
        emailType: 'usage_warning_user',
        fromUserDetails: true,
        user,
        userId,
        url: `/admin/users/${userId}/usage-warning`,
        method: 'POST',
        baseBody: { usageLevel: usageLevelWebsite },
        warningTypeEnabled: true,
        warningTypeRequired: true,
        warningTypeDefault: 'website',
        apiKeyEnabled: true,
        apiKeyRequired: true,
        reasonEnabled: true,
        reasonPlaceholder: 'Briefly explain what triggered this warning (optional)',
        warningUsageLevels: {
          website: usageLevelWebsite,
          api: usageLevelApi
        },
        summaryItems: [
          { label: 'Usage level', value: usageLevelWebsite }
        ],
        onSuccess: 'users',
        successMessage: 'Usage warning email queued.'
      });
      return;
    }

    if (action === 'endpoint-details') {
      openUserEndpointUsageModal(userId);
      return;
    }
  }

  const scheduleDevEmailPreview = debounce((body) => {
    updateDevEmailPreview(body).catch(() => {});
  }, 400);

  const scheduleDevFeaturesTestStatus = debounce((subject, body, signature) => {
    if (!subject || !body || !signature) return;
    if (state.devFeaturesTestCheckSignature === signature && state.devFeaturesTestAllowed) return;
    fetchDevFeaturesTestStatus(subject, body, signature).catch(() => {});
  }, 600);

  async function fetchDevFeaturesRecipientCount() {
    const response = await apiFetch('/admin/emails/dev-features/recipients', { method: 'POST', body: {} });
    const data = await parseResponse(response);
    return Number.isFinite(data?.count) ? data.count : 0;
  }

  async function fetchDevFeaturesTestStatus(subject, body, signature) {
    try {
      const response = await apiFetch('/admin/emails/dev-features/test-status', {
        method: 'POST',
        body: { subject, markdownBody: body }
      });
      const data = await parseResponse(response);
      const allowed = Boolean(data?.allowed);
      state.devFeaturesTestAllowed = allowed;
      state.devFeaturesTestCheckSignature = signature;
      if (dom.devEmailStatus && subject && body) {
        dom.devEmailStatus.textContent = allowed
          ? 'Test sent within the last 24 hours. Bulk send is enabled.'
          : 'Send a test email and wait for delivery to enable bulk send.';
      }
      if (dom.devEmailSendBtn) {
        dom.devEmailSendBtn.disabled = !allowed;
      }
      return allowed;
    } catch (err) {
      errorLog('[Admin][Emails] Failed to load dev features test status', err);
      showAlert(dom.emailsAlert, 'Unable to verify test email status right now.');
      state.devFeaturesTestAllowed = false;
      return false;
    }
  }

  function handleEmailSendTest() {
    const validation = validateEmailTestForm();
    if (!validation.valid) return;
    const { emailType, recipient, context } = validation;
    const baseBody = {
      emailType,
      toEmail: recipient,
      context
    };

    openConfirmAction({
      title: 'Send test email',
      actionLabel: 'Send test email',
      message: 'Send a test email using this template?',
      impact: 'Testing only; no user state changes. An email will be sent to the recipient.',
      willNotify: true,
      user: { id: '—', fullName: 'Email tools', email: recipient },
      baseBody,
      url: '/admin/emails/send-test',
      method: 'POST',
      summaryItems: [
        { label: 'Email type', value: emailType },
        { label: 'Recipient', value: recipient }
      ],
      successTarget: 'emails',
      successMessage: `Test email sent successfully to ${recipient}.`,
      afterSuccess: () => resetEmailForm()
    });
  }

  function buildDevFeaturesSignature(subject, body) {
    return `${String(subject || '').trim()}::${String(body || '').trim()}`;
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
    const signature = buildDevFeaturesSignature(subject, body);
    const hasAllowedTest = Boolean(state.devFeaturesTestAllowed) && state.devFeaturesTestCheckSignature === signature;
    if (dom.devEmailSendBtn) dom.devEmailSendBtn.disabled = !validBase || !hasAllowedTest;
    if (dom.devEmailStatus && validBase) {
      if (hasAllowedTest) {
        dom.devEmailStatus.textContent = 'Test sent within the last 24 hours. Bulk send is enabled.';
      } else if (state.devFeaturesTestSignature === signature) {
        dom.devEmailStatus.textContent = 'Test queued. Bulk send will unlock after the test is delivered.';
      } else {
        dom.devEmailStatus.textContent = 'Send a test email to enable bulk send.';
      }
    }
    if (validBase) {
      scheduleDevFeaturesTestStatus(subject, body, signature);
    }
    scheduleDevEmailPreview(body);
    return { valid: validBase && (!requireRecipient || recipientOk), subject, body, recipient };
  }

  async function handleDevEmailTest() {
    const { valid, subject, body, recipient } = validateDevEmailForm({ requireRecipient: true });
    if (!valid) return;
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
        state.devFeaturesTestSignature = buildDevFeaturesSignature(subject, body);
        state.devFeaturesTestAllowed = false;
        state.devFeaturesTestCheckSignature = null;
        if (dom.devEmailSummary) dom.devEmailSummary.textContent = `Last test queued for ${recipient}.`;
        if (dom.devEmailStatus) dom.devEmailStatus.textContent = 'Test queued';
        validateDevEmailForm();
      }
    });
  }

  async function handleDevEmailSend() {
    const { valid, subject, body } = validateDevEmailForm();
    if (!valid) return;

    let recipientCount = 0;
    try {
      recipientCount = await fetchDevFeaturesRecipientCount();
    } catch (err) {
      errorLog('[Admin][Emails] Failed to load recipient count', err);
      showAlert(dom.emailsAlert, 'Unable to load recipient count. Try again.');
      return;
    }

    openConfirmAction({
      title: 'Send development update',
      actionLabel: 'Send update',
      message: 'Send this update to all users who opted in? This cannot be undone.',
      impact: 'Only users who opted in will receive the update. An email will be sent to each recipient.',
      willNotify: true,
      destructive: true,
      confirmText: 'CONFIRM',
      confirmFlag: true,
      user: { id: '—', fullName: 'Development updates', email: 'Opted-in users' },
      baseBody: {
        subject,
        markdownBody: body
      },
      reasonEnabled: true,
      reasonPlaceholder: 'Reason / release note context (optional)',
      url: '/admin/emails/dev-features/send',
      method: 'POST',
      summaryItems: [
        { label: 'Recipients', value: recipientCount.toLocaleString() },
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

  function normalizeDateOnlyToIso(value, { endOfDay = false } = {}) {
    if (!value) return '';
    const time = endOfDay ? '23:59:59' : '00:00:00';
    const date = new Date(`${value}T${time}`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  }

  function getEmailHistoryFilters() {
    return {
      type: dom.emailHistoryTypeFilter?.value || '',
      status: dom.emailHistoryStatusFilter?.value || '',
      recipient: dom.emailHistoryRecipient?.value.trim() || '',
      startDate: normalizeDateOnlyToIso(dom.emailHistoryDateFrom?.value),
      endDate: normalizeDateOnlyToIso(dom.emailHistoryDateTo?.value, { endOfDay: true })
    };
  }

  function renderEmailHistory(rows) {
    state.emailHistory = Array.isArray(rows) ? rows : [];
    if (!dom.emailHistoryTbody) return;
    if (!state.emailHistory.length) {
      dom.emailHistoryTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No email sends recorded yet.</td></tr>';
      return;
    }
    const badgeClass = {
      queued: 'text-bg-secondary',
      sent: 'text-bg-success',
      failed: 'text-bg-danger',
      skipped: 'text-bg-warning'
    };
    dom.emailHistoryTbody.innerHTML = state.emailHistory.map((row) => {
      const status = String(row.status || 'queued').toLowerCase();
      const badge = badgeClass[status] || 'text-bg-secondary';
      const failure = row.failure_reason || row.failureReason || '';
      return `
        <tr>
          <td>${escapeHtml(row.email_type || row.emailType || '—')}</td>
          <td>${escapeHtml(row.recipient_email || row.recipientEmail || '—')}</td>
          <td>${formatDateTime(row.queued_at || row.queuedAt)}</td>
          <td>${formatDateTime(row.sent_at || row.sentAt)}</td>
          <td><span class="badge ${badge}">${escapeHtml(status || 'queued')}</span></td>
          <td>${Number.isFinite(row.retry_count) ? row.retry_count : (row.retryCount ?? 0)}</td>
          <td title="${escapeHtml(failure)}">${escapeHtml(failure || '—')}</td>
        </tr>
      `;
    }).join('');
  }

  function updateEmailHistorySummary(count, total) {
    if (!dom.emailHistorySummary) return;
    const offset = (state.emailHistoryPage - 1) * state.emailHistoryLimit;
    const start = count > 0 ? offset + 1 : 0;
    const end = offset + count;
    const totalDisplay = Number.isFinite(total) ? total : end;
    dom.emailHistorySummary.textContent = count ? `Showing ${start}–${end} of ${totalDisplay}` : 'No email history to show';
    if (dom.emailHistoryPageInfo) dom.emailHistoryPageInfo.textContent = `Page ${state.emailHistoryPage}`;
    renderPaginationNav(dom.emailHistoryPagination, state.emailHistoryPage, state.emailHistoryHasNext, (nextPage) => {
      if (nextPage < 1 || (!state.emailHistoryHasNext && nextPage > state.emailHistoryPage)) return;
      state.emailHistoryPage = nextPage;
      fetchEmailHistory().catch(() => {});
    });
  }

  async function fetchEmailHistory({ resetPage = false } = {}) {
    if (resetPage) state.emailHistoryPage = 1;
    hideAlert(dom.emailHistoryAlert);
    if (dom.emailHistoryTbody) {
      dom.emailHistoryTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Loading history…</td></tr>';
    }
    const filters = getEmailHistoryFilters();
    const limit = state.emailHistoryLimit;
    const body = {
      type: filters.type || undefined,
      status: filters.status || undefined,
      recipient: filters.recipient || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      page: state.emailHistoryPage,
      limit
    };
    try {
      const response = await apiFetch('/admin/emails/history', { method: 'POST', body });
      const data = await parseResponse(response);
      const records = Array.isArray(data?.history) ? data.history : (Array.isArray(data?.records) ? data.records : []);
      const count = Number.isFinite(data?.count) ? data.count : records.length;
      const total = Number.isFinite(data?.total) ? data.total : (state.emailHistoryPage - 1) * limit + count;
      state.emailHistoryTotal = total;
      state.emailHistoryHasNext = data?.hasNext === true || ((state.emailHistoryPage - 1) * limit + count < total);
      renderEmailHistory(records);
      updateEmailHistorySummary(count, total);
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        showAlert(dom.emailHistoryAlert, data.warnings.join(' '));
      }
      state.emailHistoryLoaded = true;
    } catch (err) {
      errorLog('Failed to fetch email history', err);
      if (err?.isNetworkError) {
        showAlert(dom.emailHistoryAlert, 'Network or CORS error. Unable to load email history.');
      } else {
        showApiError(dom.emailHistoryAlert, err);
      }
      if (dom.emailHistoryTbody) {
        dom.emailHistoryTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Unable to load email history.</td></tr>';
      }
      throw err;
    }
  }

  function clearEmailHistoryFilters({ preserveSearch = false } = {}) {
    if (dom.emailHistoryTypeFilter) dom.emailHistoryTypeFilter.value = '';
    if (dom.emailHistoryStatusFilter) dom.emailHistoryStatusFilter.value = '';
    if (!preserveSearch && dom.emailHistoryRecipient) dom.emailHistoryRecipient.value = '';
    if (dom.emailHistoryDateFrom) dom.emailHistoryDateFrom.value = '';
    if (dom.emailHistoryDateTo) dom.emailHistoryDateTo.value = '';
  }

  function setDataViewerSummary(message) {
    if (dom.dataViewerSummary) dom.dataViewerSummary.textContent = message;
  }

  function resetDataViewerPagination(page = 1) {
    if (dom.dataViewerPagination) dom.dataViewerPagination.innerHTML = '';
    if (dom.dataViewerPaginationInfo) dom.dataViewerPaginationInfo.textContent = page ? `Page ${page}` : '';
  }

  function resetDataViewerTable(message = 'No data loaded.') {
    if (dom.dataViewerThead) dom.dataViewerThead.innerHTML = '';
    if (dom.dataViewerTbody) {
      dom.dataViewerTbody.innerHTML = `<tr><td class="text-center text-muted py-3">${message}</td></tr>`;
    }
    resetDataViewerPagination(1);
  }

  function setDataViewerLoading(isLoading) {
    if (dom.dataViewerApplyFiltersBtn) dom.dataViewerApplyFiltersBtn.disabled = isLoading;
    if (dom.dataViewerResetFiltersBtn) dom.dataViewerResetFiltersBtn.disabled = isLoading;
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

  function renderDataViewerTableHelp(tableConfig) {
    if (!dom.dataViewerTableHelp) return;
    if (!tableConfig) {
      dom.dataViewerTableHelp.textContent = 'Select a table to view sanitized records.';
      return;
    }
    dom.dataViewerTableHelp.textContent = tableConfig.description || 'Sanitized, read-only records.';
  }

  function populateDataViewerTables(tables) {
    if (!dom.dataViewerTable) return;
    if (!tables.length) {
      dom.dataViewerTable.innerHTML = '<option value="">No tables available</option>';
      updateDataViewerSortOptions(null);
      resetDataViewerTable('No data available.');
      setDataViewerSummary('No data tables are configured.');
      renderDataViewerTableHelp(null);
      return;
    }

    dom.dataViewerTable.innerHTML = tables
      .map((table) => `<option value="${escapeHtml(table.name)}">${escapeHtml(table.label || table.name)}</option>`)
      .join('');

    const current = getSelectedDataViewerTable();
    const hasCurrent = current && tables.some((table) => table.name === current);
    if (current && !hasCurrent) {
      showAlert(dom.dataViewerAlert, 'Selected table is not available. Choose a supported table.');
    }
    const selected = hasCurrent ? current : tables[0].name;
    dom.dataViewerTable.value = selected;
    const selectedConfig = getDataViewerTableConfig(selected);
    updateDataViewerSortOptions(selectedConfig);
    renderDataViewerTableHelp(selectedConfig);
    if (selected) {
      fetchDataViewerRows().catch(() => {});
    }
  }

  function formatDataViewerValue(value, column) {
    if (value === null || value === undefined || value === '') return '—';
    if (column?.type === 'datetime') {
      if (typeof value === 'object') {
        const display = typeof value.display === 'string' ? value.display : '';
        const iso = typeof value.iso === 'string' ? value.iso : '';
        const resolved = display || formatDateTime(iso || '');
        if (!resolved || resolved === '—') return '—';
        const title = iso || display;
        return title ? `<span title="${escapeHtml(title)}">${escapeHtml(resolved)}</span>` : escapeHtml(resolved);
      }
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
    const offset = Number.isFinite(currentPage) && Number.isFinite(currentLimit)
      ? (currentPage - 1) * currentLimit
      : 0;
    const start = count > 0 ? offset + 1 : 0;
    const end = offset + count;
    const totalLabel = Number.isFinite(total) ? ` of ${total}` : '';
    setDataViewerSummary(count ? `Showing ${start}–${end}${totalLabel}` : 'No results to show');
    state.dataViewerPage = Number.isFinite(currentPage) ? currentPage : 1;
    state.dataViewerHasNext = payload?.hasNext === true || (offset + count < total);
    state.dataViewerTotal = total;
    if (dom.dataViewerPaginationInfo) dom.dataViewerPaginationInfo.textContent = `Page ${state.dataViewerPage}`;
    renderPaginationNav(dom.dataViewerPagination, state.dataViewerPage, state.dataViewerHasNext, (nextPage) => {
      state.dataViewerPage = nextPage;
      if (dom.dataViewerPage) dom.dataViewerPage.value = String(nextPage);
      fetchDataViewerRows().catch(() => {});
    });
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
        renderDataViewerTableHelp(config);
      } else {
        setDataViewerSummary('Select a table to load data.');
        renderDataViewerTableHelp(null);
      }
      return state.dataViewerTables;
    } catch (err) {
      errorLog('Failed to load data viewer tables', err);
      showAlert(dom.dataViewerAlert, err.message || 'Unable to load data tables.');
      setDataViewerSummary('Unable to load data tables.');
      resetDataViewerTable('No data loaded.');
      renderDataViewerTableHelp(null);
      throw err;
    }
  }

  function getDataViewerQuery() {
    if (dom.dataViewerUserIdHelp) dom.dataViewerUserIdHelp.textContent = '';
    if (dom.dataViewerLimitHelp) dom.dataViewerLimitHelp.textContent = '';
    if (dom.dataViewerPageHelp) dom.dataViewerPageHelp.textContent = '';
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
    const errors = [];
    if (userIdRaw && !Number.isInteger(userId)) {
      errors.push('User ID must be a number.');
      if (dom.dataViewerUserIdHelp) dom.dataViewerUserIdHelp.textContent = 'Enter a valid user id.';
    }
    if (!Number.isInteger(limitRaw) || limitRaw < 5 || limitRaw > 200) {
      errors.push('Page size must be between 5 and 200.');
      if (dom.dataViewerLimitHelp) dom.dataViewerLimitHelp.textContent = 'Use a value between 5 and 200.';
    }
    if (!Number.isInteger(pageRaw) || pageRaw < 1) {
      errors.push('Page must be 1 or greater.');
      if (dom.dataViewerPageHelp) dom.dataViewerPageHelp.textContent = 'Use a page number of 1 or higher.';
    }
    return {
      table,
      search: search || undefined,
      email: email || undefined,
      userId: Number.isInteger(userId) ? userId : undefined,
      sortBy: sortBy || undefined,
      order,
      limit,
      page,
      invalid: errors.length > 0,
      errors
    };
  }

  async function fetchDataViewerRows() {
    hideAlert(dom.dataViewerAlert);
    const query = getDataViewerQuery();
    if (query.invalid) {
      showAlert(dom.dataViewerAlert, query.errors.join(' '));
      setDataViewerSummary('Fix the highlighted fields to load data.');
      resetDataViewerTable('No data loaded.');
      return;
    }
    if (!query.table) {
      showAlert(dom.dataViewerAlert, 'Select a table to load data.');
      return;
    }
    const tableConfig = getDataViewerTableConfig(query.table);
    if (!tableConfig) {
      showAlert(dom.dataViewerAlert, 'That table is not supported yet. Choose one of the available tables.');
      resetDataViewerTable('No data loaded.');
      setDataViewerSummary('Select a supported table to load data.');
      renderDataViewerTableHelp(null);
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
      if (err?.isNetworkError) {
        showAlert(dom.dataViewerAlert, 'Network or CORS error. Unable to load data.');
      } else {
        showAlert(dom.dataViewerAlert, err.message || 'Unable to load data.');
      }
      setDataViewerSummary('Unable to load data.');
      resetDataViewerTable('No data loaded.');
      throw err;
    } finally {
      setDataViewerLoading(false);
    }
  }

  function clearDataViewerFilters({ preserveSearch = false } = {}) {
    if (!preserveSearch && dom.dataViewerSearch) dom.dataViewerSearch.value = '';
    if (dom.dataViewerUserId) dom.dataViewerUserId.value = '';
    if (dom.dataViewerEmail) dom.dataViewerEmail.value = '';
    if (dom.dataViewerPage) dom.dataViewerPage.value = '1';
    state.dataViewerPage = 1;
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

    dom.usersApplyFiltersBtn?.addEventListener('click', () => {
      state.usersPage = 1;
      const filters = getUserFilters();
      renderUsersActiveFilters(filters);
      fetchUsers(filters).catch(() => {});
    });
    dom.usersResetFiltersBtn?.addEventListener('click', () => {
      clearUserFilters();
      state.usersPage = 1;
      const filters = getUserFilters();
      renderUsersActiveFilters(filters);
      fetchUsers(filters).catch(() => {});
    });
    dom.clearUsersFiltersBtn?.addEventListener('click', () => {
      clearUserFilters();
      state.usersPage = 1;
      const filters = getUserFilters();
      renderUsersActiveFilters(filters);
      fetchUsers(filters).catch(() => {});
    });
    dom.userSearchInput?.addEventListener('input', debounce(() => {
      state.usersPage = 1;
      fetchUsers(getUserFilters()).catch(() => {});
    }));
    dom.userSearchInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      state.usersPage = 1;
      fetchUsers(getUserFilters()).catch(() => {});
    });
    dom.clearUsersSearchBtn?.addEventListener('click', () => {
      if (dom.userSearchInput) dom.userSearchInput.value = '';
      state.usersPage = 1;
      fetchUsers(getUserFilters()).catch(() => {});
    });
    dom.usersSortSelect?.addEventListener('change', () => {
      state.usersPage = 1;
      fetchUsers(getUserFilters()).catch(() => {});
    });
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

    dom.usersTbody?.addEventListener('click', handleUserActionClick);
    dom.usersTbody?.addEventListener('click', handleUserRowClick);
    dom.usersTbody?.addEventListener('keydown', handleUserRowKeydown);
    dom.userDetailsActions?.addEventListener('click', handleUserDetailsActionClick);

    dom.confirmActionReason?.addEventListener('input', handleConfirmActionModalInput);
    dom.confirmActionEmail?.addEventListener('input', handleConfirmActionModalInput);
    dom.confirmActionInput?.addEventListener('input', handleConfirmActionModalInput);
    dom.confirmActionWarningType?.addEventListener('change', handleConfirmWarningTypeChange);
    dom.confirmActionApiKeySelect?.addEventListener('change', handleConfirmApiKeyChange);
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
    dom.editUserModal?.addEventListener('hidden.bs.modal', () => {
      window.modalStack?.pop('editUserModal');
    });
    dom.sessionsModal?.addEventListener('hidden.bs.modal', () => {
      window.modalStack?.pop('sessionsModal');
    });
    dom.confirmActionModal?.addEventListener('hidden.bs.modal', () => {
      window.modalStack?.pop('confirmActionModal');
    });

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

    const runLogsFetch = () => {
      if (!state.logsInitialized) {
        ensureLogsInitialized().catch(() => {});
        return;
      }
      fetchLogs().catch(() => {});
    };

    dom.logsSearchInput?.addEventListener('input', debounce(() => {
      state.logsPage = 1;
      runLogsFetch();
    }));
    dom.logsSearchInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      state.logsPage = 1;
      runLogsFetch();
    });
    dom.logsClearSearchBtn?.addEventListener('click', () => {
      if (dom.logsSearchInput) dom.logsSearchInput.value = '';
      state.logsPage = 1;
      runLogsFetch();
    });
    dom.logsApplyFiltersBtn?.addEventListener('click', () => {
      state.logsPage = 1;
      runLogsFetch();
    });
    dom.logsResetFiltersBtn?.addEventListener('click', () => {
      clearLogsFilters({ preserveSearch: true });
      state.logsPage = 1;
      runLogsFetch();
    });
    dom.logsRefreshBtn?.addEventListener('click', () => {
      runLogsFetch();
    });
    dom.logsExportBtn?.addEventListener('click', () => {
      exportLogs().catch(() => {});
    });
    dom.logsPageSize?.addEventListener('change', () => {
      const next = Number.parseInt(dom.logsPageSize.value, 10);
      if (Number.isInteger(next) && next >= 5 && next <= 200) {
        state.logsLimit = next;
      } else {
        dom.logsPageSize.value = state.logsLimit;
      }
      state.logsPage = 1;
      runLogsFetch();
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
      renderDataViewerTableHelp(config);
      clearDataViewerFilters();
      resetDataViewerTable('Loading data…');
      if (!table) {
        setDataViewerSummary('Select a table to load data.');
        return;
      }
      fetchDataViewerRows().catch(() => {});
    });

    dom.dataViewerSearch?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (getSelectedDataViewerTable()) {
        fetchDataViewerRows().catch(() => {});
      }
    });
    dom.dataViewerClearSearchBtn?.addEventListener('click', () => {
      if (dom.dataViewerSearch) dom.dataViewerSearch.value = '';
      if (getSelectedDataViewerTable()) {
        fetchDataViewerRows().catch(() => {});
      }
    });
    dom.dataViewerApplyFiltersBtn?.addEventListener('click', () => {
      if (getSelectedDataViewerTable()) {
        fetchDataViewerRows().catch(() => {});
      }
    });
    dom.dataViewerResetFiltersBtn?.addEventListener('click', () => {
      clearDataViewerFilters({ preserveSearch: true });
      if (getSelectedDataViewerTable()) {
        fetchDataViewerRows().catch(() => {});
      } else {
        resetDataViewerTable('No data loaded.');
        setDataViewerSummary('Select a table to load data.');
      }
    });

    dom.emailTypesRefreshBtn?.addEventListener('click', () => fetchEmailTypes(true).catch(() => {}));
    dom.emailTypeSelect?.addEventListener('change', handleEmailTypeChange);
    dom.emailRecipientInput?.addEventListener('input', handleEmailFormChange);
    dom.emailTypeFields?.addEventListener('input', handleEmailFormChange);
    dom.emailResetBtn?.addEventListener('click', handleEmailReset);
    dom.emailSendTestBtn?.addEventListener('click', handleEmailSendTest);

    const runEmailHistoryFetch = () => {
      fetchEmailHistory().catch(() => {});
    };
    dom.emailHistoryRefreshBtn?.addEventListener('click', () => fetchEmailHistory({ resetPage: true }).catch(() => {}));
    dom.emailHistoryRecipient?.addEventListener('input', debounce(() => {
      state.emailHistoryPage = 1;
      runEmailHistoryFetch();
    }));
    dom.emailHistoryRecipient?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      state.emailHistoryPage = 1;
      runEmailHistoryFetch();
    });
    dom.emailHistoryClearSearchBtn?.addEventListener('click', () => {
      if (dom.emailHistoryRecipient) dom.emailHistoryRecipient.value = '';
      state.emailHistoryPage = 1;
      runEmailHistoryFetch();
    });
    dom.emailHistoryApplyFiltersBtn?.addEventListener('click', () => {
      state.emailHistoryPage = 1;
      runEmailHistoryFetch();
    });
    dom.emailHistoryResetFiltersBtn?.addEventListener('click', () => {
      clearEmailHistoryFilters({ preserveSearch: true });
      state.emailHistoryPage = 1;
      runEmailHistoryFetch();
    });
    dom.emailHistoryPageSize?.addEventListener('change', () => {
      const value = Number.parseInt(dom.emailHistoryPageSize.value, 10);
      if (Number.isInteger(value) && value >= 5 && value <= 100) {
        state.emailHistoryLimit = value;
      } else {
        dom.emailHistoryPageSize.value = state.emailHistoryLimit;
      }
      state.emailHistoryPage = 1;
      runEmailHistoryFetch();
    });

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
      fetchEmailHistory({ resetPage: true }).catch(() => {});
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
    resetEmailForm();
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
    if (dom.emailHistoryPageSize) {
      const initialHistoryPage = Number.parseInt(dom.emailHistoryPageSize.value, 10);
      if (Number.isInteger(initialHistoryPage)) {
        state.emailHistoryLimit = Math.min(Math.max(initialHistoryPage, 5), 100);
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
        fetchEmailHistory({ resetPage: true }).catch(() => {});
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
