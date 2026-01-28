// Book Types page logic: fetch, filter, render list view, add/edit/delete.
(function () {
  const log = (...args) => console.log('[BookTypes]', ...args);
  const warn = (...args) => console.warn('[BookTypes]', ...args);
  const errorLog = (...args) => console.error('[BookTypes]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const defaultFilters = () => ({
    name: '',
    description: '',
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
    filters: defaultFilters(),
    data: []
  };

  const dom = {
    addBookTypeBtn: document.getElementById('addBookTypeBtn'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    sortSelect: document.getElementById('sortSelect'),
    perPageInput: document.getElementById('perPageInput'),
    filterName: document.getElementById('filterName'),
    filterDescription: document.getElementById('filterDescription'),
    filterCreatedAfter: document.getElementById('filterCreatedAfter'),
    filterCreatedBefore: document.getElementById('filterCreatedBefore'),
    filterUpdatedAfter: document.getElementById('filterUpdatedAfter'),
    filterUpdatedBefore: document.getElementById('filterUpdatedBefore'),
    includeDeletedCheck: document.getElementById('includeDeletedCheck'),
    applyFiltersBtn: document.getElementById('applyFiltersBtn'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    clearAllFiltersBtn: document.getElementById('clearAllFiltersBtn'),
    feedbackContainer: document.getElementById('feedbackContainer'),
    activeFilters: document.getElementById('activeFilters'),
    activeFiltersBar: document.getElementById('activeFiltersBar'),
    resultsSummary: document.getElementById('resultsSummary'),
    resultsMeta: document.getElementById('resultsMeta'),
    listTableBody: document.getElementById('listTableBody'),
    listCount: document.getElementById('listCount'),
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

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const formatTimestamp = (value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
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
    if (params.get('filterDescription')) f.description = params.get('filterDescription');
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
    if (f.description) params.set('filterDescription', f.description);
    if (f.createdAfter) params.set('filterCreatedAfter', f.createdAfter);
    if (f.createdBefore) params.set('filterCreatedBefore', f.createdBefore);
    if (f.updatedAfter) params.set('filterUpdatedAfter', f.updatedAfter);
    if (f.updatedBefore) params.set('filterUpdatedBefore', f.updatedBefore);
    if (f.includeDeleted) params.set('includeDeleted', 'true');
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  const syncFormWithState = () => {
    dom.searchInput.value = state.search || '';
    dom.sortSelect.value = `${state.sort.field}:${state.sort.order}`;
    dom.perPageInput.value = String(state.limit);

    const f = state.filters;
    dom.filterName.value = f.name;
    dom.filterDescription.value = f.description;
    dom.filterCreatedAfter.value = f.createdAfter;
    dom.filterCreatedBefore.value = f.createdBefore;
    dom.filterUpdatedAfter.value = f.updatedAfter;
    dom.filterUpdatedBefore.value = f.updatedBefore;
    if (dom.includeDeletedCheck) dom.includeDeletedCheck.checked = f.includeDeleted;
  };

  const buildFilterChips = () => {
    const chips = [];
    const f = state.filters;
    if (state.search) chips.push({ key: 'Search', value: state.search });
    if (f.description) chips.push({ key: 'Description', value: f.description });
    if (f.createdAfter) chips.push({ key: 'Created after', value: f.createdAfter });
    if (f.createdBefore) chips.push({ key: 'Created before', value: f.createdBefore });
    if (f.updatedAfter) chips.push({ key: 'Updated after', value: f.updatedAfter });
    if (f.updatedBefore) chips.push({ key: 'Updated before', value: f.updatedBefore });
    if (f.includeDeleted) chips.push({ key: 'include deleted', value: 'on' });

    dom.activeFilters.innerHTML = '';
    if (!chips.length) {
      const empty = document.createElement('span');
      empty.className = 'text-muted small';
      empty.textContent = 'None';
      dom.activeFilters.appendChild(empty);
    } else {
      chips.forEach((chip) => {
        const span = document.createElement('span');
        span.className = 'filter-chip';
        span.innerHTML = `<strong>${escapeHtml(chip.key)}:</strong> <span>${escapeHtml(chip.value)}</span>`;
        dom.activeFilters.appendChild(span);
      });
    }

    if (dom.clearAllFiltersBtn) {
      dom.clearAllFiltersBtn.classList.toggle('d-none', chips.length === 0);
    }
    if (dom.activeFiltersBar) {
      dom.activeFiltersBar.classList.toggle('d-none', chips.length === 0);
    }
  };

  const buildRequestPayload = () => {
    const f = state.filters;
    const payload = {
      limit: state.limit,
      page: state.page,
      sort: state.sort.field,
      order: state.sort.order,
      name: state.search || f.name || null,
      description: f.description || null,
      createdAfter: f.createdAfter || null,
      createdBefore: f.createdBefore || null,
      updatedAfter: f.updatedAfter || null,
      updatedBefore: f.updatedBefore || null
    };
    if (f.includeDeleted) payload.includeDeleted = true;
    return payload;
  };

  const updateSummary = (items = []) => {
    const sortLabel = dom.sortSelect ? dom.sortSelect.selectedOptions[0]?.textContent : '';
    dom.resultsSummary.textContent = `${items.length} book type${items.length === 1 ? '' : 's'} • ${sortLabel || 'Sorted'} • Page ${state.page}`;
    if (dom.resultsMeta) dom.resultsMeta.textContent = '';
    if (dom.listCount) dom.listCount.textContent = `${items.length} shown`;
  };

  const renderPagination = (hasNextPage) => {
    if (!dom.paginationNav || !dom.paginationInfo) return;
    dom.paginationNav.innerHTML = '';
    dom.paginationInfo.textContent = `Page ${state.page}`;

    const createPageItem = (label, disabled, onClick, ariaLabel) => {
      const li = document.createElement('li');
      li.className = `page-item${disabled ? ' disabled' : ''}`;
      const link = document.createElement('a');
      link.className = 'page-link';
      link.href = '#';
      link.innerHTML = label;
      if (ariaLabel) link.setAttribute('aria-label', ariaLabel);
      link.addEventListener('click', (event) => {
        event.preventDefault();
        if (disabled) return;
        onClick();
      });
      li.appendChild(link);
      return li;
    };

    dom.paginationNav.appendChild(createPageItem(
      '<i class="bi bi-arrow-left"></i>',
      state.page <= 1,
      () => {
      state.page = Math.max(1, state.page - 1);
      updateUrl();
      loadBookTypes();
      },
      'Previous page'
    ));

    if (state.page > 1) {
      dom.paginationNav.appendChild(createPageItem(String(state.page - 1), false, () => {
        state.page -= 1;
        updateUrl();
        loadBookTypes();
      }));
    }

    const current = document.createElement('li');
    current.className = 'page-item active';
    const currentSpan = document.createElement('span');
    currentSpan.className = 'page-link';
    currentSpan.textContent = String(state.page);
    current.appendChild(currentSpan);
    dom.paginationNav.appendChild(current);

    if (hasNextPage) {
      dom.paginationNav.appendChild(createPageItem(String(state.page + 1), false, () => {
        state.page += 1;
        updateUrl();
        loadBookTypes();
      }));
    }

    dom.paginationNav.appendChild(createPageItem(
      '<i class="bi bi-arrow-right"></i>',
      !hasNextPage,
      () => {
        state.page += 1;
        updateUrl();
        loadBookTypes();
      },
      'Next page'
    ));
  };

  const renderList = (items = [], hasNextPage = false) => {
    dom.listTableBody.innerHTML = '';
    if (!items.length) {
      dom.listTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No book types found.</td></tr>';
      updateSummary(items);
      renderPagination(false);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.dataset.id = item.id;
      const rowHref = `book-type-details?id=${encodeURIComponent(item.id)}`;
      row.dataset.rowHref = rowHref;
      row.setAttribute('role', 'link');
      row.setAttribute('tabindex', '0');
      const deletedBadge = item.deletedAt ? '<span class="badge text-bg-secondary ms-2">Removed</span>' : '';
      row.innerHTML = `
        <td>
          <div class="fw-semibold">${escapeHtml(item.name || '')}${deletedBadge}</div>
          ${item.description ? `<div class="text-muted small">${escapeHtml(item.description)}</div>` : ''}
          <div class="text-muted small list-meta-mobile">Created ${formatTimestamp(item.createdAt)} · Updated ${formatTimestamp(item.updatedAt)}</div>
        </td>
        <td class="list-col-created">${formatTimestamp(item.createdAt)}</td>
        <td class="list-col-updated">${formatTimestamp(item.updatedAt)}</td>
      `;
      row.addEventListener('click', (event) => {
        if (event.target.closest('button, a, input, select, textarea, [data-row-action], [data-stop-row]')) return;
        window.location.href = rowHref;
      });
      row.addEventListener('keydown', (event) => {
        if (event.target.closest && event.target.closest('button, a, input, select, textarea, [data-row-action], [data-stop-row]')) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.href = rowHref;
        }
      });
      dom.listTableBody.appendChild(row);
    });

    updateSummary(items);
    renderPagination(hasNextPage);
  };

  const loadBookTypes = async () => {
    let resolvedOk = false;
    let resolvedError = null;
    clearAlerts();
    dom.listTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">Loading…</td></tr>';
    dom.resultsSummary.textContent = 'Loading book types…';
    dom.resultsMeta.textContent = '';

    try {
      const payload = buildRequestPayload();
      log('Fetching list', payload);
      const response = await apiFetch('/booktype/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Array.isArray(data.errors) ? data.errors : [];
        showAlert({ message: data.message || 'Unable to load book types.', details });
        renderList([], false);
        resolvedError = data.message || 'Unable to load book types.';
        return;
      }
      const list = data?.data?.bookTypes || [];
      state.data = list;
      const hasNextPage = list.length === state.limit;
      renderList(list, hasNextPage);
      resolvedOk = true;
    } catch (err) {
      errorLog('Failed to load list', err);
      renderList([], false);
      showAlert({ message: 'Unable to load book types right now. Please try again.' });
      resolvedError = err.message || 'Unable to load book types.';
    } finally {
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: resolvedOk, error: resolvedError });
      }
    }
  };

  const resetFilters = () => {
    state.filters = defaultFilters();
    state.search = '';
    state.searchDriven = false;
    state.page = 1;
    syncFormWithState();
    updateUrl();
    buildFilterChips();
    loadBookTypes();
  };

  const syncFromFilters = () => {
    state.filters.name = dom.filterName.value.trim();
    state.filters.description = dom.filterDescription.value.trim();
    state.filters.createdAfter = dom.filterCreatedAfter.value;
    state.filters.createdBefore = dom.filterCreatedBefore.value;
    state.filters.updatedAfter = dom.filterUpdatedAfter.value;
    state.filters.updatedBefore = dom.filterUpdatedBefore.value;
    state.filters.includeDeleted = Boolean(dom.includeDeletedCheck?.checked);
  };

  const searchChanged = () => {
    state.search = dom.searchInput.value.trim();
    state.page = 1;
    state.searchDriven = Boolean(state.search);
    if (state.searchDriven) {
      state.filters.name = state.search;
    }
    if (dom.filterName) dom.filterName.value = state.search;
    updateUrl();
    buildFilterChips();
    loadBookTypes();
  };

  const bindEvents = () => {
    dom.addBookTypeBtn.addEventListener('click', () => {
      window.sharedAddModals?.open('booktype');
    });
    dom.clearSearchBtn.addEventListener('click', () => {
      dom.searchInput.value = '';
      if (dom.filterName) dom.filterName.value = '';
      searchChanged();
    });
    dom.searchInput.addEventListener('input', debounce(searchChanged, 300));
    dom.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchChanged();
      }
    });
    dom.sortSelect.addEventListener('change', () => {
      const [field, order] = dom.sortSelect.value.split(':');
      state.sort.field = field || 'name';
      state.sort.order = order || 'asc';
      state.page = 1;
      updateUrl();
      loadBookTypes();
    });
    dom.perPageInput.addEventListener('change', (event) => {
      const raw = parseNumber(event.target.value);
      const clamped = Math.min(200, Math.max(2, raw || state.limit));
      dom.perPageInput.value = clamped;
      const help = document.getElementById('perPageHelp');
      if (raw < 2 || raw > 200 || Number.isNaN(raw)) {
        dom.perPageInput.classList.add('is-invalid');
        if (help) help.classList.remove('d-none');
      } else {
        dom.perPageInput.classList.remove('is-invalid');
        if (help) help.classList.add('d-none');
      }
      state.limit = clamped;
      state.page = 1;
      updateUrl();
      loadBookTypes();
    });
    dom.applyFiltersBtn.addEventListener('click', () => {
      syncFromFilters();
      if (!state.searchDriven) state.search = state.filters.name;
      state.page = 1;
      updateUrl();
      buildFilterChips();
      loadBookTypes();
    });
    dom.resetFiltersBtn.addEventListener('click', () => {
      resetFilters();
    });
    dom.clearAllFiltersBtn.addEventListener('click', resetFilters);
  };

  const init = () => {
    hydrateStateFromUrl();
    syncFormWithState();
    buildFilterChips();
    bindEvents();
    loadBookTypes();
    const sharedEvents = window.sharedAddModals?.events;
    if (sharedEvents) {
      sharedEvents.addEventListener('booktype:created', async () => {
        showAlert({ message: 'Book type created successfully.', type: 'success' });
        state.page = 1;
        await loadBookTypes();
      });
      sharedEvents.addEventListener('booktype:updated', async () => {
        await loadBookTypes();
      });
    }
    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve({ success: true });
    }
  };

  init();
})();
