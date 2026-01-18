// Authors page logic: fetch, filter, render list view, and sync URL state.
(function () {
  const log = (...args) => console.log('[Authors]', ...args);
  const warn = (...args) => console.warn('[Authors]', ...args);
  const errorLog = (...args) => console.error('[Authors]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const debugLog = (...args) => {
    console.log('[Authors][debug]', ...args);
  };

  const defaultFilters = () => ({
    displayName: '',
    firstNames: '',
    lastName: '',
    bio: '',
    deceased: '',
    bornAfter: '',
    bornBefore: '',
    diedAfter: '',
    diedBefore: '',
    createdAfter: '',
    createdBefore: '',
    updatedAfter: '',
    updatedBefore: '',
    includeDeleted: false
  });

  const state = {
    sort: { field: 'displayName', order: 'asc' },
    limit: 20,
    page: 1,
    search: '',
    searchDriven: false,
    filters: defaultFilters()
  };

  const dom = {
    addAuthorBtn: document.getElementById('addAuthorBtn'),
    addAuthorModal: document.getElementById('addAuthorModal'),
    authorAddForm: document.getElementById('authorAddForm'),
    authorAddErrorAlert: document.getElementById('authorAddErrorAlert'),
    authorAddDisplayName: document.getElementById('authorAddDisplayName'),
    authorAddFirstNames: document.getElementById('authorAddFirstNames'),
    authorAddLastName: document.getElementById('authorAddLastName'),
    authorAddBirthDate: document.getElementById('authorAddBirthDate'),
    authorAddBirthDateHelp: document.getElementById('authorAddBirthDateHelp'),
    authorAddDeceased: document.getElementById('authorAddDeceased'),
    authorAddDeathDate: document.getElementById('authorAddDeathDate'),
    authorAddDeathDateHelp: document.getElementById('authorAddDeathDateHelp'),
    authorAddBio: document.getElementById('authorAddBio'),
    authorAddDisplayNameHelp: document.getElementById('authorAddDisplayNameHelp'),
    authorAddFirstNamesHelp: document.getElementById('authorAddFirstNamesHelp'),
    authorAddLastNameHelp: document.getElementById('authorAddLastNameHelp'),
    authorAddBioHelp: document.getElementById('authorAddBioHelp'),
    authorAddResetBtn: document.getElementById('authorAddResetBtn'),
    authorAddSaveBtn: document.getElementById('authorAddSaveBtn'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    sortSelect: document.getElementById('sortSelect'),
    perPageInput: document.getElementById('perPageInput'),
    filterDisplayName: document.getElementById('filterDisplayName'),
    filterFirstNames: document.getElementById('filterFirstNames'),
    filterLastName: document.getElementById('filterLastName'),
    filterBio: document.getElementById('filterBio'),
    filterDeceased: document.getElementById('filterDeceased'),
    filterBornAfter: document.getElementById('filterBornAfter'),
    filterBornBefore: document.getElementById('filterBornBefore'),
    filterDiedAfter: document.getElementById('filterDiedAfter'),
    filterDiedBefore: document.getElementById('filterDiedBefore'),
    filterCreatedAfter: document.getElementById('filterCreatedAfter'),
    filterCreatedBefore: document.getElementById('filterCreatedBefore'),
    filterUpdatedAfter: document.getElementById('filterUpdatedAfter'),
    filterUpdatedBefore: document.getElementById('filterUpdatedBefore'),
    includeDeletedCheck: document.getElementById('includeDeletedCheck'),
    applyFiltersBtn: document.getElementById('applyFiltersBtn'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    refreshButton: document.getElementById('refreshButton'),
    clearAllFiltersBtn: document.getElementById('clearAllFiltersBtn'),
    feedbackContainer: document.getElementById('feedbackContainer'),
    activeFilters: document.getElementById('activeFilters'),
    resultsSummary: document.getElementById('resultsSummary'),
    resultsMeta: document.getElementById('resultsMeta'),
    listTableBody: document.getElementById('listTableBody'),
    listCount: document.getElementById('listCount'),
    resultsPlaceholder: document.getElementById('resultsPlaceholder'),
    paginationInfo: document.getElementById('paginationInfo'),
    paginationNav: document.getElementById('paginationNav')
  };

  const debounce = (fn, delay = 350) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

  const formatPartialDate = (date) => {
    if (!date) return null;
    if (date.text) return date.text;
    const parts = [];
    if (date.day) parts.push(String(date.day));
    if (date.month) {
      parts.push(new Date(2000, date.month - 1, 1).toLocaleString(undefined, { month: 'long' }));
    }
    if (date.year) parts.push(String(date.year));
    return parts.length ? parts.join(' ') : null;
  };

  const formatTimestamp = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const parsePartialDateInput = (value) => {
    if (!value || !value.trim()) return { value: null };
    if (!window.partialDateParser || typeof window.partialDateParser.parsePartialDate !== 'function') {
      return { error: 'Date parser is unavailable.' };
    }
    const parsed = window.partialDateParser.parsePartialDate(value.trim());
    if (!parsed || !parsed.text) return { error: 'Please enter a valid date.' };
    return { value: parsed };
  };

  const setHelpText = (el, message, isError = false) => {
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('text-danger', Boolean(message) && isError);
  };

  const clearHelpText = (el) => setHelpText(el, '', false);

  const showModal = async (target, options) => {
    if (window.modalManager && typeof window.modalManager.showModal === 'function') {
      await window.modalManager.showModal(target, options);
      return;
    }
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    bootstrap.Modal.getOrCreateInstance(element, options || {}).show();
  };

  const hideModal = async (target) => {
    if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
      await window.modalManager.hideModal(target);
      return;
    }
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    const instance = bootstrap.Modal.getInstance(element);
    if (instance) instance.hide();
  };

  const updateOffcanvasPlacement = () => {
    const offcanvasEl = document.getElementById('filtersOffcanvas');
    if (!offcanvasEl) return;
    offcanvasEl.classList.remove('offcanvas-end', 'offcanvas-bottom');
    if (isMobile()) {
      offcanvasEl.classList.add('offcanvas-bottom');
      offcanvasEl.setAttribute('data-bs-scroll', 'false');
    } else {
      offcanvasEl.classList.add('offcanvas-end');
      offcanvasEl.setAttribute('data-bs-scroll', 'true');
    }
  };

  const clearAlerts = () => {
    if (dom.feedbackContainer) dom.feedbackContainer.innerHTML = '';
  };

  const showAlert = ({ message, type = 'danger', details = [] }) => {
    if (!dom.feedbackContainer) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
      <div class="fw-semibold mb-1">${message || 'Something went wrong.'}</div>
      ${Array.isArray(details) && details.length ? `<ul class="mb-1 small text-muted">${details.map((err) => `<li>${escapeHtml(err)}</li>`).join('')}</ul>` : ''}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    dom.feedbackContainer.innerHTML = '';
    dom.feedbackContainer.appendChild(alert);
  };

  const showModalAlert = (message, details = []) => {
    if (!dom.authorAddErrorAlert) return;
    const content = details.length
      ? `<strong>${escapeHtml(message || 'Please check the following')}</strong><div>${escapeHtml(details.join(' '))}</div>`
      : `<strong>${escapeHtml(message || 'Please check the following')}</strong>`;
    dom.authorAddErrorAlert.innerHTML = content;
    dom.authorAddErrorAlert.classList.remove('d-none');
  };

  const hideModalAlert = () => {
    if (!dom.authorAddErrorAlert) return;
    dom.authorAddErrorAlert.classList.add('d-none');
    dom.authorAddErrorAlert.innerHTML = '';
  };

  const resetAddAuthorForm = () => {
    if (dom.authorAddForm) dom.authorAddForm.reset();
    [dom.authorAddDisplayNameHelp, dom.authorAddFirstNamesHelp, dom.authorAddLastNameHelp, dom.authorAddBirthDateHelp, dom.authorAddDeathDateHelp, dom.authorAddBioHelp]
      .forEach((el) => clearHelpText(el));
    hideModalAlert();
  };

  const validateAuthorForm = () => {
    hideModalAlert();
    let valid = true;
    const errors = [];
    const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;

    const displayName = dom.authorAddDisplayName?.value.trim() || '';
    if (!displayName) {
      setHelpText(dom.authorAddDisplayNameHelp, 'Display Name is required.', true);
      valid = false;
      errors.push('Display Name is required.');
    } else if (displayName.length < 2 || displayName.length > 150) {
      setHelpText(dom.authorAddDisplayNameHelp, 'Display Name must be between 2 and 150 characters.', true);
      valid = false;
      errors.push('Display Name must be between 2 and 150 characters.');
    } else if (!namePattern.test(displayName)) {
      setHelpText(dom.authorAddDisplayNameHelp, 'Display Name contains unsupported characters.', true);
      valid = false;
      errors.push('Display Name contains unsupported characters.');
    } else {
      clearHelpText(dom.authorAddDisplayNameHelp);
    }

    const firstNames = dom.authorAddFirstNames?.value.trim() || '';
    if (firstNames && (firstNames.length < 2 || firstNames.length > 150 || !namePattern.test(firstNames))) {
      setHelpText(dom.authorAddFirstNamesHelp, 'First Name(s) must be 2-150 characters and valid.', true);
      valid = false;
      errors.push('First Name(s) must be 2-150 characters and valid.');
    } else {
      clearHelpText(dom.authorAddFirstNamesHelp);
    }

    const lastName = dom.authorAddLastName?.value.trim() || '';
    if (lastName && (lastName.length < 2 || lastName.length > 100 || !namePattern.test(lastName))) {
      setHelpText(dom.authorAddLastNameHelp, 'Last Name must be 2-100 characters and valid.', true);
      valid = false;
      errors.push('Last Name must be 2-100 characters and valid.');
    } else {
      clearHelpText(dom.authorAddLastNameHelp);
    }

    const birthRaw = dom.authorAddBirthDate?.value.trim() || '';
    if (birthRaw) {
      const parsed = parsePartialDateInput(birthRaw);
      if (parsed.error) {
        setHelpText(dom.authorAddBirthDateHelp, parsed.error, true);
        valid = false;
        errors.push(parsed.error);
      } else {
        clearHelpText(dom.authorAddBirthDateHelp);
      }
    } else {
      clearHelpText(dom.authorAddBirthDateHelp);
    }

    const deathRaw = dom.authorAddDeathDate?.value.trim() || '';
    const deceased = Boolean(dom.authorAddDeceased?.checked);
    if (deathRaw && !deceased) {
      setHelpText(dom.authorAddDeathDateHelp, 'Mark the author as deceased to set a death date.', true);
      valid = false;
      errors.push('Mark the author as deceased to set a death date.');
    } else if (deathRaw) {
      const parsed = parsePartialDateInput(deathRaw);
      if (parsed.error) {
        setHelpText(dom.authorAddDeathDateHelp, parsed.error, true);
        valid = false;
        errors.push(parsed.error);
      } else {
        clearHelpText(dom.authorAddDeathDateHelp);
      }
    } else {
      clearHelpText(dom.authorAddDeathDateHelp);
    }

    const bio = dom.authorAddBio?.value.trim() || '';
    if (bio && bio.length > 1000) {
      setHelpText(dom.authorAddBioHelp, 'Bio must be 1000 characters or fewer.', true);
      valid = false;
      errors.push('Bio must be 1000 characters or fewer.');
    } else {
      clearHelpText(dom.authorAddBioHelp);
    }

    if (!valid) {
      showModalAlert('Please fix the following:', errors);
    }
    return valid;
  };

  const submitAuthor = async () => {
    if (!validateAuthorForm()) return;
    const displayName = dom.authorAddDisplayName.value.trim();
    const payload = {
      displayName,
      firstNames: dom.authorAddFirstNames.value.trim() || undefined,
      lastName: dom.authorAddLastName.value.trim() || undefined,
      deceased: Boolean(dom.authorAddDeceased.checked),
      bio: dom.authorAddBio.value.trim() || undefined
    };
    const birthRaw = dom.authorAddBirthDate.value.trim();
    if (birthRaw) {
      payload.birthDate = parsePartialDateInput(birthRaw).value;
    }
    const deathRaw = dom.authorAddDeathDate.value.trim();
    if (deathRaw) {
      payload.deathDate = parsePartialDateInput(deathRaw).value;
    }

    log('Creating author.', { displayName });
    dom.authorAddSaveBtn.disabled = true;
    try {
      const response = await apiFetch('/author', { method: 'POST', body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = data.errors || [];
        showModalAlert(data.message || 'Unable to add author.', details);
        warn('Author create failed.', { status: response.status, data });
        return;
      }
      log('Author created.', data);
      await hideModal(dom.addAuthorModal);
      resetAddAuthorForm();
      showAlert({ message: 'Author added successfully.', type: 'success' });
      state.page = 1;
      await loadAuthors();
    } catch (error) {
      errorLog('Author create failed.', error);
      showModalAlert('Unable to add author right now.');
    } finally {
      dom.authorAddSaveBtn.disabled = false;
    }
  };

  const parseNumber = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const hydrateStateFromUrl = () => {
    state.filters = defaultFilters();
    state.searchDriven = false;
    const params = new URLSearchParams(window.location.search);
    const sortParam = params.get('sort');
    if (sortParam) {
      const [field, order] = sortParam.split(':');
      if (field) state.sort.field = field;
      if (order) state.sort.order = order;
    }

    const limitParam = parseNumber(params.get('limit'));
    if (limitParam) state.limit = Math.min(200, Math.max(2, limitParam));
    const pageParam = parseNumber(params.get('page'));
    if (pageParam) state.page = Math.max(1, pageParam);

    const qParam = params.get('q');
    if (qParam) state.search = qParam.trim();

    const f = state.filters;
    if (params.get('filterDisplayName')) f.displayName = params.get('filterDisplayName');
    if (params.get('filterFirstNames')) f.firstNames = params.get('filterFirstNames');
    if (params.get('filterLastName')) f.lastName = params.get('filterLastName');
    if (params.get('filterBio')) f.bio = params.get('filterBio');
    if (params.get('filterDeceased')) f.deceased = params.get('filterDeceased');
    if (params.get('filterBornAfter')) f.bornAfter = params.get('filterBornAfter');
    if (params.get('filterBornBefore')) f.bornBefore = params.get('filterBornBefore');
    if (params.get('filterDiedAfter')) f.diedAfter = params.get('filterDiedAfter');
    if (params.get('filterDiedBefore')) f.diedBefore = params.get('filterDiedBefore');
    if (params.get('filterCreatedAfter')) f.createdAfter = params.get('filterCreatedAfter');
    if (params.get('filterCreatedBefore')) f.createdBefore = params.get('filterCreatedBefore');
    if (params.get('filterUpdatedAfter')) f.updatedAfter = params.get('filterUpdatedAfter');
    if (params.get('filterUpdatedBefore')) f.updatedBefore = params.get('filterUpdatedBefore');
    if (params.get('includeDeleted') === 'true') f.includeDeleted = true;

    if (f.displayName) {
      state.search = f.displayName;
      state.searchDriven = false;
    } else if (state.search) {
      f.displayName = state.search;
      state.searchDriven = true;
    }
  };

  const updateUrl = () => {
    const params = new URLSearchParams();
    params.set('sort', `${state.sort.field}:${state.sort.order}`);
    params.set('limit', String(state.limit));
    params.set('page', String(state.page));
    if (state.search) params.set('q', state.search);

    const f = state.filters;
    if (f.displayName) params.set('filterDisplayName', f.displayName);
    if (f.firstNames) params.set('filterFirstNames', f.firstNames);
    if (f.lastName) params.set('filterLastName', f.lastName);
    if (f.bio) params.set('filterBio', f.bio);
    if (f.deceased) params.set('filterDeceased', f.deceased);
    if (f.bornAfter) params.set('filterBornAfter', f.bornAfter);
    if (f.bornBefore) params.set('filterBornBefore', f.bornBefore);
    if (f.diedAfter) params.set('filterDiedAfter', f.diedAfter);
    if (f.diedBefore) params.set('filterDiedBefore', f.diedBefore);
    if (f.createdAfter) params.set('filterCreatedAfter', f.createdAfter);
    if (f.createdBefore) params.set('filterCreatedBefore', f.createdBefore);
    if (f.updatedAfter) params.set('filterUpdatedAfter', f.updatedAfter);
    if (f.updatedBefore) params.set('filterUpdatedBefore', f.updatedBefore);
    if (f.includeDeleted) params.set('includeDeleted', 'true');

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  const syncControlsFromState = () => {
    if (state.searchDriven) {
      state.filters.displayName = state.search;
    }

    if (dom.searchInput) dom.searchInput.value = state.search || '';
    if (dom.sortSelect) dom.sortSelect.value = `${state.sort.field}:${state.sort.order}`;
    if (dom.perPageInput) dom.perPageInput.value = state.limit;
    if (dom.filterDisplayName) dom.filterDisplayName.value = state.filters.displayName;
    if (dom.filterFirstNames) dom.filterFirstNames.value = state.filters.firstNames;
    if (dom.filterLastName) dom.filterLastName.value = state.filters.lastName;
    if (dom.filterBio) dom.filterBio.value = state.filters.bio;
    if (dom.filterDeceased) dom.filterDeceased.value = state.filters.deceased;
    if (dom.filterBornAfter) dom.filterBornAfter.value = state.filters.bornAfter;
    if (dom.filterBornBefore) dom.filterBornBefore.value = state.filters.bornBefore;
    if (dom.filterDiedAfter) dom.filterDiedAfter.value = state.filters.diedAfter;
    if (dom.filterDiedBefore) dom.filterDiedBefore.value = state.filters.diedBefore;
    if (dom.filterCreatedAfter) dom.filterCreatedAfter.value = state.filters.createdAfter;
    if (dom.filterCreatedBefore) dom.filterCreatedBefore.value = state.filters.createdBefore;
    if (dom.filterUpdatedAfter) dom.filterUpdatedAfter.value = state.filters.updatedAfter;
    if (dom.filterUpdatedBefore) dom.filterUpdatedBefore.value = state.filters.updatedBefore;
    if (dom.includeDeletedCheck) dom.includeDeletedCheck.checked = state.filters.includeDeleted;
  };

  const renderActiveFilters = () => {
    if (!dom.activeFilters) return;
    dom.activeFilters.innerHTML = '';
    const chips = [];

    const pushChip = (label, value, onRemove) => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip d-inline-flex align-items-center gap-2 border rounded-pill px-3 py-1 bg-body-secondary text-body';
      chip.innerHTML = `<span class="text-muted text-uppercase fw-semibold small">${escapeHtml(label)}</span><span class="fw-semibold">${escapeHtml(value)}</span><button type="button" class="btn-close btn-close-sm ms-1" aria-label="Remove filter"></button>`;
      chip.querySelector('button').addEventListener('click', (event) => {
        event.stopPropagation();
        onRemove();
      });
      chips.push(chip);
    };

    const f = state.filters;
    if (f.displayName && !state.searchDriven) {
      pushChip('name', f.displayName, () => { f.displayName = ''; syncControlsFromState(); triggerFetch(); });
    }
    if (f.firstNames) pushChip('first names', f.firstNames, () => { f.firstNames = ''; syncControlsFromState(); triggerFetch(); });
    if (f.lastName) pushChip('last name', f.lastName, () => { f.lastName = ''; syncControlsFromState(); triggerFetch(); });
    if (f.bio) pushChip('bio', f.bio, () => { f.bio = ''; syncControlsFromState(); triggerFetch(); });
    if (f.deceased) pushChip('status', f.deceased === 'true' ? 'deceased' : 'living', () => { f.deceased = ''; syncControlsFromState(); triggerFetch(); });
    if (f.bornAfter) pushChip('born after', f.bornAfter, () => { f.bornAfter = ''; syncControlsFromState(); triggerFetch(); });
    if (f.bornBefore) pushChip('born before', f.bornBefore, () => { f.bornBefore = ''; syncControlsFromState(); triggerFetch(); });
    if (f.diedAfter) pushChip('died after', f.diedAfter, () => { f.diedAfter = ''; syncControlsFromState(); triggerFetch(); });
    if (f.diedBefore) pushChip('died before', f.diedBefore, () => { f.diedBefore = ''; syncControlsFromState(); triggerFetch(); });
    if (f.createdAfter) pushChip('created after', f.createdAfter, () => { f.createdAfter = ''; syncControlsFromState(); triggerFetch(); });
    if (f.createdBefore) pushChip('created before', f.createdBefore, () => { f.createdBefore = ''; syncControlsFromState(); triggerFetch(); });
    if (f.updatedAfter) pushChip('updated after', f.updatedAfter, () => { f.updatedAfter = ''; syncControlsFromState(); triggerFetch(); });
    if (f.updatedBefore) pushChip('updated before', f.updatedBefore, () => { f.updatedBefore = ''; syncControlsFromState(); triggerFetch(); });
    if (f.includeDeleted) pushChip('include deleted', 'on', () => { f.includeDeleted = false; syncControlsFromState(); triggerFetch(); });

    if (chips.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'text-muted small';
      empty.textContent = 'No filters applied.';
      dom.activeFilters.appendChild(empty);
      if (dom.clearAllFiltersBtn) dom.clearAllFiltersBtn.classList.add('d-none');
      return;
    }

    chips.forEach((chip) => dom.activeFilters.appendChild(chip));
    if (dom.clearAllFiltersBtn) dom.clearAllFiltersBtn.classList.remove('d-none');
  };

  const readFiltersFromControls = () => ({
    displayName: dom.filterDisplayName?.value.trim() || '',
    firstNames: dom.filterFirstNames?.value.trim() || '',
    lastName: dom.filterLastName?.value.trim() || '',
    bio: dom.filterBio?.value.trim() || '',
    deceased: dom.filterDeceased?.value || '',
    bornAfter: dom.filterBornAfter?.value || '',
    bornBefore: dom.filterBornBefore?.value || '',
    diedAfter: dom.filterDiedAfter?.value || '',
    diedBefore: dom.filterDiedBefore?.value || '',
    createdAfter: dom.filterCreatedAfter?.value || '',
    createdBefore: dom.filterCreatedBefore?.value || '',
    updatedAfter: dom.filterUpdatedAfter?.value || '',
    updatedBefore: dom.filterUpdatedBefore?.value || '',
    includeDeleted: Boolean(dom.includeDeletedCheck?.checked)
  });

  const applyFiltersFromControls = () => {
    const nextFilters = readFiltersFromControls();
    const nextName = nextFilters.displayName.trim();
    const matchesSearch = nextName && nextName === state.search && state.searchDriven;

    state.filters = nextFilters;

    if (nextName) {
      if (matchesSearch) {
        state.searchDriven = true;
      } else {
        state.search = nextName;
        state.searchDriven = false;
      }
    } else if (state.search) {
      state.searchDriven = true;
    } else {
      state.searchDriven = false;
    }

    if (dom.searchInput) dom.searchInput.value = state.search || '';
    state.page = 1;
    renderActiveFilters();
    triggerFetch();
  };

  const showLoading = () => {
    if (dom.resultsPlaceholder) dom.resultsPlaceholder.classList.remove('d-none');
    if (dom.listTableBody) dom.listTableBody.innerHTML = '';
  };

  const hideLoading = () => {
    if (dom.resultsPlaceholder) dom.resultsPlaceholder.classList.add('d-none');
  };

  const handleRateLimit = async (response) => {
    if (response && response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      await window.rateLimitGuard.showModal();
      return true;
    }
    return false;
  };

  let lastAuthorsSignature = null;
  let currentRequestId = 0;

  const buildAuthorsBody = () => {
    const body = {
      limit: state.limit,
      offset: (state.page - 1) * state.limit,
      sortBy: state.sort.field,
      order: state.sort.order
    };

    const f = state.filters;
    if (state.search) body.filterDisplayName = state.search;
    if (f.displayName) body.filterDisplayName = f.displayName;
    if (f.firstNames) body.filterFirstNames = f.firstNames;
    if (f.lastName) body.filterLastName = f.lastName;
    if (f.bio) body.filterBio = f.bio;
    if (f.deceased) body.filterDeceased = f.deceased;
    if (f.bornAfter) body.filterBornAfter = f.bornAfter;
    if (f.bornBefore) body.filterBornBefore = f.bornBefore;
    if (f.diedAfter) body.filterDiedAfter = f.diedAfter;
    if (f.diedBefore) body.filterDiedBefore = f.diedBefore;
    if (f.createdAfter) body.filterCreatedAfter = f.createdAfter;
    if (f.createdBefore) body.filterCreatedBefore = f.createdBefore;
    if (f.updatedAfter) body.filterUpdatedAfter = f.updatedAfter;
    if (f.updatedBefore) body.filterUpdatedBefore = f.updatedBefore;
    if (f.includeDeleted) body.includeDeleted = true;

    return body;
  };

  const getAuthorsSignature = () => JSON.stringify(buildAuthorsBody());

  const updateSummary = (count) => {
    const sortLabel = dom.sortSelect ? dom.sortSelect.selectedOptions[0]?.textContent : '';
    if (dom.resultsSummary) {
      dom.resultsSummary.textContent = `${count} author${count === 1 ? '' : 's'} • ${sortLabel || 'Sorted'} • Page ${state.page}`;
    }
    if (dom.resultsMeta) dom.resultsMeta.textContent = '';
    if (dom.listCount) {
      dom.listCount.textContent = `${count} shown`;
    }
  };

  const renderPagination = (hasNextPage) => {
    if (!dom.paginationNav || !dom.paginationInfo) return;
    dom.paginationNav.innerHTML = '';
    dom.paginationInfo.textContent = `Page ${state.page}`;

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
        if (disabled) return;
        onClick();
      });
      li.appendChild(a);
      return li;
    };

    dom.paginationNav.appendChild(createItem(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-left" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M15 8a.5.5 0 0 1-.5.5H2.707l3.147 3.146a.5.5 0 0 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 7.5H14.5A.5.5 0 0 1 15 8"/>
      </svg>`,
      state.page <= 1,
      () => {
        state.page = Math.max(1, state.page - 1);
        updateUrl();
        triggerFetch();
      },
      'Previous page'
    ));

    if (state.page > 1) {
      dom.paginationNav.appendChild(createItem(String(state.page - 1), false, () => {
        state.page -= 1;
        updateUrl();
        triggerFetch();
      }));
    }

    const current = document.createElement('li');
    current.className = 'page-item active';
    const span = document.createElement('span');
    span.className = 'page-link';
    span.textContent = String(state.page);
    current.appendChild(span);
    dom.paginationNav.appendChild(current);

    if (hasNextPage) {
      dom.paginationNav.appendChild(createItem(String(state.page + 1), false, () => {
        state.page += 1;
        updateUrl();
        triggerFetch();
      }));
    }

    dom.paginationNav.appendChild(createItem(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8"/>
      </svg>`,
      !hasNextPage,
      () => {
        state.page += 1;
        updateUrl();
        triggerFetch();
      },
      'Next page'
    ));
  };

  const renderAuthors = (authors) => {
    if (!dom.listTableBody) return;
    dom.listTableBody.innerHTML = '';

    if (!authors.length) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="4" class="text-center text-muted py-4">No authors match your filters.</td>';
      dom.listTableBody.appendChild(emptyRow);
      hideLoading();
      return;
    }

    authors.forEach((author) => {
      const fullName = [author.firstNames, author.lastName].filter(Boolean).join(' ').trim();
      const displayName = author.displayName || fullName || 'Unknown author';
      const showAltName = Boolean(fullName) && fullName !== displayName;
      const bornText = formatPartialDate(author.birthDate);
      const isDeceased = Boolean(author.deceased) || Boolean(author.deathDate);
      const diedText = formatPartialDate(author.deathDate);
      const bornLabel = bornText ? `Born ${bornText}` : '';
      const deathLabel = isDeceased ? (diedText ? `† ${diedText}` : '†') : '';
      const mobileMetaParts = [bornLabel, deathLabel].filter(Boolean);
      const mobileMeta = mobileMetaParts.join(' • ');

      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.innerHTML = `
        <td class="list-col-name">
          <div class="fw-semibold">${escapeHtml(displayName)}</div>
          ${showAltName ? `<div class="text-muted small">${escapeHtml(fullName)}</div>` : ''}
          <div class="text-muted small list-meta-mobile ${mobileMeta ? '' : 'd-none'}">${escapeHtml(mobileMeta)}</div>
        </td>
        <td class="list-col-born">
          <span class="text-muted">${escapeHtml(bornText || '')}</span>
        </td>
        <td class="list-col-died">
          <span class="text-muted">${escapeHtml(isDeceased ? (deathLabel || '†') : '')}</span>
        </td>
        <td class="list-col-updated">
          <span class="text-muted">${escapeHtml(formatTimestamp(author.updatedAt) || '—')}</span>
        </td>
      `;
      row.addEventListener('click', () => {
        window.location.href = `author-details?id=${author.id}`;
      });
      dom.listTableBody.appendChild(row);
    });

    hideLoading();
  };

  const triggerFetch = debounce(() => {
    state.page = Math.max(1, state.page);
    updateUrl();
    loadAuthors();
  }, 150);

  const loadAuthors = async () => {
    const signature = getAuthorsSignature();
    if (signature === lastAuthorsSignature) {
      debugLog('Skipping author fetch; state unchanged.');
      return;
    }
    lastAuthorsSignature = signature;

    const requestId = ++currentRequestId;
    clearAlerts();
    showLoading();

    const body = buildAuthorsBody();
    debugLog('Requesting /author/list with JSON body', body);
    try {
      const response = await apiFetch('/author/list', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));

      if (await handleRateLimit(response)) {
        hideLoading();
        return;
      }

      if (!response.ok) {
        const details = Array.isArray(payload.errors) ? payload.errors : [];
        showAlert({ message: payload.message || 'Failed to load authors.', details });
        hideLoading();
        return;
      }

      const authors = (payload.data && payload.data.authors) || [];
      const hasNextPage = authors.length === state.limit;
      debugLog('Response status', response.status, 'authors returned', authors.length);

      if (requestId !== currentRequestId) return;

      updateSummary(authors.length);
      renderAuthors(authors);
      renderPagination(hasNextPage);
    } catch (error) {
      errorLog('Author fetch failed', error);
      showAlert({ message: 'Unable to load authors right now.', details: [error.message] });
      hideLoading();
    }
  };

  const resetFilters = () => {
    state.filters = defaultFilters();
    if (state.search) {
      state.filters.displayName = state.search;
      state.searchDriven = true;
    } else {
      state.searchDriven = false;
    }
    state.page = 1;
    syncControlsFromState();
    renderActiveFilters();
    triggerFetch();
  };

  const attachListeners = () => {
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', debounce((event) => {
        const nextValue = event.target.value.trim();
        state.search = nextValue;
        state.filters.displayName = nextValue;
        state.searchDriven = true;
        if (dom.filterDisplayName) dom.filterDisplayName.value = nextValue;
        state.page = 1;
        triggerFetch();
      }, 500));
      dom.searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const nextValue = dom.searchInput.value.trim();
          state.search = nextValue;
          state.filters.displayName = nextValue;
          state.searchDriven = true;
          if (dom.filterDisplayName) dom.filterDisplayName.value = nextValue;
          state.page = 1;
          triggerFetch();
        }
      });
    }

    if (dom.clearSearchBtn) {
      dom.clearSearchBtn.addEventListener('click', () => {
        const wasSearchDriven = state.searchDriven;
        state.search = '';
        if (wasSearchDriven) {
          state.filters.displayName = '';
        }
        state.searchDriven = false;
        if (dom.searchInput) dom.searchInput.value = '';
        if (dom.filterDisplayName && wasSearchDriven) dom.filterDisplayName.value = '';
        state.page = 1;
        triggerFetch();
      });
    }

    if (dom.sortSelect) {
      dom.sortSelect.addEventListener('change', (event) => {
        const [field, order] = (event.target.value || 'displayName:asc').split(':');
        state.sort = { field: field || 'displayName', order: order || 'asc' };
        state.page = 1;
        triggerFetch();
      });
    }

    if (dom.perPageInput) {
      dom.perPageInput.addEventListener('change', (event) => {
        const raw = parseNumber(event.target.value);
        const clamped = Math.min(200, Math.max(2, raw || state.limit));
        dom.perPageInput.value = clamped;
        if (raw < 2 || raw > 200 || Number.isNaN(raw)) {
          dom.perPageInput.classList.add('is-invalid');
          const help = document.getElementById('perPageHelp');
          if (help) help.classList.remove('d-none');
        } else {
          dom.perPageInput.classList.remove('is-invalid');
          const help = document.getElementById('perPageHelp');
          if (help) help.classList.add('d-none');
        }
        state.limit = clamped;
        state.page = 1;
        triggerFetch();
      });
    }

    if (dom.applyFiltersBtn) {
      dom.applyFiltersBtn.addEventListener('click', () => {
        applyFiltersFromControls();
      });
    }

    if (dom.resetFiltersBtn) {
      dom.resetFiltersBtn.addEventListener('click', resetFilters);
    }

    if (dom.clearAllFiltersBtn) {
      dom.clearAllFiltersBtn.addEventListener('click', resetFilters);
    }

    if (dom.refreshButton) {
      dom.refreshButton.addEventListener('click', () => {
        triggerFetch();
      });
    }

    if (dom.authorAddResetBtn) {
      dom.authorAddResetBtn.addEventListener('click', resetAddAuthorForm);
    }

    if (dom.authorAddSaveBtn) {
      dom.authorAddSaveBtn.addEventListener('click', submitAuthor);
    }

    if (dom.addAuthorModal) {
      dom.addAuthorModal.addEventListener('hidden.bs.modal', resetAddAuthorForm);
    }

    window.addEventListener('resize', () => {
      updateOffcanvasPlacement();
    });
  };

  const init = async () => {
    log('Initializing authors page');
    hydrateStateFromUrl();
    updateOffcanvasPlacement();

    if (window.rateLimitGuard?.hasReset()) {
      await window.rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: false, rateLimited: true });
      }
      return;
    }

    syncControlsFromState();
    renderActiveFilters();
    attachListeners();

    const flash = sessionStorage.getItem('authorsFlash');
    if (flash) {
      showAlert({ message: flash, type: 'success' });
      sessionStorage.removeItem('authorsFlash');
    }

    await loadAuthors();

    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve({ success: true });
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
