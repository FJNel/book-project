// Publishers page logic: fetch, filter, render list view, and sync URL state.
(function () {
  const log = (...args) => console.log('[Publishers]', ...args);
  const warn = (...args) => console.warn('[Publishers]', ...args);
  const errorLog = (...args) => console.error('[Publishers]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const debugLog = (...args) => {
    console.log('[Publishers][debug]', ...args);
  };

  const defaultFilters = () => ({
    name: '',
    website: '',
    notes: '',
    foundedAfter: '',
    foundedBefore: '',
    createdAfter: '',
    createdBefore: '',
    updatedAfter: '',
    updatedBefore: '',
    includeDeleted: false
  });

  const state = {
    sort: { field: 'name', order: 'asc' },
    limit: 20,
    page: 1,
    search: '',
    searchDriven: false,
    filters: defaultFilters()
  };

  const dom = {
    addPublisherBtn: document.getElementById('addPublisherBtn'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    sortSelect: document.getElementById('sortSelect'),
    perPageInput: document.getElementById('perPageInput'),
    filterName: document.getElementById('filterName'),
    filterWebsite: document.getElementById('filterWebsite'),
    filterNotes: document.getElementById('filterNotes'),
    filterFoundedAfter: document.getElementById('filterFoundedAfter'),
    filterFoundedBefore: document.getElementById('filterFoundedBefore'),
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

  const normalizeUrl = (value) => {
    if (!value) return null;
    const raw = value.trim();
    if (!raw || /\s/.test(raw)) return null;
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withScheme);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.href;
    } catch (error) {
      return null;
    }
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
    if (params.get('filterName')) f.name = params.get('filterName');
    if (params.get('filterWebsite')) f.website = params.get('filterWebsite');
    if (params.get('filterNotes')) f.notes = params.get('filterNotes');
    if (params.get('filterFoundedAfter')) f.foundedAfter = params.get('filterFoundedAfter');
    if (params.get('filterFoundedBefore')) f.foundedBefore = params.get('filterFoundedBefore');
    if (params.get('filterCreatedAfter')) f.createdAfter = params.get('filterCreatedAfter');
    if (params.get('filterCreatedBefore')) f.createdBefore = params.get('filterCreatedBefore');
    if (params.get('filterUpdatedAfter')) f.updatedAfter = params.get('filterUpdatedAfter');
    if (params.get('filterUpdatedBefore')) f.updatedBefore = params.get('filterUpdatedBefore');
    if (params.get('includeDeleted') === 'true') f.includeDeleted = true;

    if (f.name) {
      state.search = f.name;
      state.searchDriven = false;
    } else if (state.search) {
      f.name = state.search;
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
    if (f.name) params.set('filterName', f.name);
    if (f.website) params.set('filterWebsite', f.website);
    if (f.notes) params.set('filterNotes', f.notes);
    if (f.foundedAfter) params.set('filterFoundedAfter', f.foundedAfter);
    if (f.foundedBefore) params.set('filterFoundedBefore', f.foundedBefore);
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
      state.filters.name = state.search;
    }

    if (dom.searchInput) dom.searchInput.value = state.search || '';
    if (dom.sortSelect) dom.sortSelect.value = `${state.sort.field}:${state.sort.order}`;
    if (dom.perPageInput) dom.perPageInput.value = state.limit;
    if (dom.filterName) dom.filterName.value = state.filters.name;
    if (dom.filterWebsite) dom.filterWebsite.value = state.filters.website;
    if (dom.filterNotes) dom.filterNotes.value = state.filters.notes;
    if (dom.filterFoundedAfter) dom.filterFoundedAfter.value = state.filters.foundedAfter;
    if (dom.filterFoundedBefore) dom.filterFoundedBefore.value = state.filters.foundedBefore;
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
        renderActiveFilters();
      });
      chips.push(chip);
    };

    const f = state.filters;
    if (f.name && !state.searchDriven) pushChip('name', f.name, () => { f.name = ''; syncControlsFromState(); triggerFetch(); });
    if (f.website) pushChip('website', f.website, () => { f.website = ''; syncControlsFromState(); triggerFetch(); });
    if (f.notes) pushChip('notes', f.notes, () => { f.notes = ''; syncControlsFromState(); triggerFetch(); });
    if (f.foundedAfter) pushChip('founded after', f.foundedAfter, () => { f.foundedAfter = ''; syncControlsFromState(); triggerFetch(); });
    if (f.foundedBefore) pushChip('founded before', f.foundedBefore, () => { f.foundedBefore = ''; syncControlsFromState(); triggerFetch(); });
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
    name: dom.filterName?.value.trim() || '',
    website: dom.filterWebsite?.value.trim() || '',
    notes: dom.filterNotes?.value.trim() || '',
    foundedAfter: dom.filterFoundedAfter?.value || '',
    foundedBefore: dom.filterFoundedBefore?.value || '',
    createdAfter: dom.filterCreatedAfter?.value || '',
    createdBefore: dom.filterCreatedBefore?.value || '',
    updatedAfter: dom.filterUpdatedAfter?.value || '',
    updatedBefore: dom.filterUpdatedBefore?.value || '',
    includeDeleted: Boolean(dom.includeDeletedCheck?.checked)
  });

  const applyFiltersFromControls = () => {
    const nextFilters = readFiltersFromControls();
    const nextName = nextFilters.name.trim();
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

  let lastPublisherSignature = null;
  let currentRequestId = 0;

  const buildPublishersBody = () => {
    const body = {
      limit: state.limit,
      offset: (state.page - 1) * state.limit,
      sortBy: state.sort.field,
      order: state.sort.order
    };

    const f = state.filters;
    if (state.search) body.filterName = state.search;
    if (f.name) body.filterName = f.name;
    if (f.website) body.filterWebsite = f.website;
    if (f.notes) body.filterNotes = f.notes;
    if (f.foundedAfter) body.filterFoundedAfter = f.foundedAfter;
    if (f.foundedBefore) body.filterFoundedBefore = f.foundedBefore;
    if (f.createdAfter) body.filterCreatedAfter = f.createdAfter;
    if (f.createdBefore) body.filterCreatedBefore = f.createdBefore;
    if (f.updatedAfter) body.filterUpdatedAfter = f.updatedAfter;
    if (f.updatedBefore) body.filterUpdatedBefore = f.updatedBefore;
    if (f.includeDeleted) body.includeDeleted = true;

    return body;
  };

  const getPublishersSignature = () => JSON.stringify(buildPublishersBody());

  const updateSummary = (count) => {
    const sortLabel = dom.sortSelect ? dom.sortSelect.selectedOptions[0]?.textContent : '';
    if (dom.resultsSummary) {
      dom.resultsSummary.textContent = `${count} publisher${count === 1 ? '' : 's'} • ${sortLabel || 'Sorted'} • Page ${state.page}`;
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

  const renderPublishers = (publishers) => {
    if (!dom.listTableBody) return;
    dom.listTableBody.innerHTML = '';

    if (!publishers.length) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="4" class="text-center text-muted py-4">No publishers match your filters.</td>';
      dom.listTableBody.appendChild(emptyRow);
      hideLoading();
      return;
    }

    publishers.forEach((publisher) => {
      const foundedLabel = formatPartialDate(publisher.foundedDate) || '—';
      const websiteUrl = normalizeUrl(publisher.website);
      const websiteLabel = websiteUrl ? `<a href="${websiteUrl}" target="_blank" rel="noopener">${escapeHtml(publisher.website)}</a>` : '';
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.innerHTML = `
        <td class="list-col-name">
          <div class="fw-semibold">${escapeHtml(publisher.name || 'Untitled publisher')}</div>
          <div class="text-muted small list-meta-mobile">${escapeHtml(foundedLabel)}</div>
        </td>
        <td class="list-col-website">${websiteLabel}</td>
        <td class="list-col-founded">
          <span class="text-muted">${escapeHtml(foundedLabel)}</span>
        </td>
        <td class="list-col-updated">
          <span class="text-muted">${escapeHtml(formatTimestamp(publisher.updatedAt) || '—')}</span>
        </td>
      `;
      row.addEventListener('click', () => {
        window.location.href = `publisher-details?id=${publisher.id}`;
      });
      dom.listTableBody.appendChild(row);
    });

    hideLoading();
  };

  const triggerFetch = debounce(() => {
    state.page = Math.max(1, state.page);
    updateUrl();
    loadPublishers();
  }, 150);

  const loadPublishers = async () => {
    const signature = getPublishersSignature();
    if (signature === lastPublisherSignature) {
      debugLog('Skipping publisher fetch; state unchanged.');
      return;
    }
    lastPublisherSignature = signature;

    const requestId = ++currentRequestId;
    clearAlerts();
    showLoading();

    const body = buildPublishersBody();
    debugLog('Requesting /publisher/list with JSON body', body);
    try {
      const response = await apiFetch('/publisher/list', {
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
        showAlert({ message: payload.message || 'Failed to load publishers.', details });
        hideLoading();
        return;
      }

      const publishers = (payload.data && payload.data.publishers) || [];
      const hasNextPage = publishers.length === state.limit;
      debugLog('Response status', response.status, 'publishers returned', publishers.length);

      if (requestId !== currentRequestId) return;

      updateSummary(publishers.length);
      renderPublishers(publishers);
      renderPagination(hasNextPage);
    } catch (error) {
      errorLog('Publisher fetch failed', error);
      showAlert({ message: 'Unable to load publishers right now.', details: [error.message] });
      hideLoading();
    }
  };

  const resetFilters = () => {
    state.filters = defaultFilters();
    if (state.search) {
      state.filters.name = state.search;
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
        state.filters.name = nextValue;
        state.searchDriven = true;
        if (dom.filterName) dom.filterName.value = nextValue;
        state.page = 1;
        triggerFetch();
      }, 500));
      dom.searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const nextValue = dom.searchInput.value.trim();
          state.search = nextValue;
          state.filters.name = nextValue;
          state.searchDriven = true;
          if (dom.filterName) dom.filterName.value = nextValue;
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
          state.filters.name = '';
        }
        state.searchDriven = false;
        if (dom.searchInput) dom.searchInput.value = '';
        if (dom.filterName && wasSearchDriven) dom.filterName.value = '';
        state.page = 1;
        triggerFetch();
      });
    }

    if (dom.sortSelect) {
      dom.sortSelect.addEventListener('change', (event) => {
        const [field, order] = (event.target.value || 'name:asc').split(':');
        state.sort = { field: field || 'name', order: order || 'asc' };
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

    if (dom.addPublisherBtn) {
      dom.addPublisherBtn.addEventListener('click', () => {
        window.sharedAddModals?.open('publisher');
      });
    }

    window.addEventListener('resize', () => {
      updateOffcanvasPlacement();
    });
  };

  const init = async () => {
    log('Initializing...');
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

    const flash = sessionStorage.getItem('publishersFlash');
    if (flash) {
      showAlert({ message: flash, type: 'success' });
      sessionStorage.removeItem('publishersFlash');
    }

    await loadPublishers();

    const sharedEvents = window.sharedAddModals?.events;
    if (sharedEvents) {
      sharedEvents.addEventListener('publisher:created', async (event) => {
        showAlert({ message: 'Publisher created successfully.', type: 'success' });
        if (event?.detail?.id) {
          state.page = 1;
          await loadPublishers();
        } else {
          triggerFetch();
        }
      });
    }

    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve({ success: true });
    }
    log('Ready.');
  };

  document.addEventListener('DOMContentLoaded', init);
})();
