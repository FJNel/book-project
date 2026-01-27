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
    updatedBefore: ''
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
    paginationNav: document.getElementById('paginationNav'),
    bookTypeModal: document.getElementById('bookTypeModal'),
    bookTypeModalLabel: document.getElementById('bookTypeModalLabel'),
    bookTypeName: document.getElementById('bookTypeName'),
    bookTypeNameHelp: document.getElementById('bookTypeNameHelp'),
    bookTypeDescription: document.getElementById('bookTypeDescription'),
    bookTypeDescriptionHelp: document.getElementById('bookTypeDescriptionHelp'),
    bookTypeChanges: document.getElementById('bookTypeChanges'),
    bookTypeError: document.getElementById('bookTypeError'),
    bookTypeResetBtn: document.getElementById('bookTypeResetBtn'),
    bookTypeSaveBtn: document.getElementById('bookTypeSaveBtn'),
    bookTypeDeleteModal: document.getElementById('bookTypeDeleteModal'),
    bookTypeDeleteName: document.getElementById('bookTypeDeleteName'),
    bookTypeDeleteConfirm: document.getElementById('bookTypeDeleteConfirm'),
    bookTypeDeleteHelp: document.getElementById('bookTypeDeleteHelp'),
    bookTypeDeleteError: document.getElementById('bookTypeDeleteError'),
    bookTypeDeleteBtn: document.getElementById('bookTypeDeleteBtn')
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
    return {
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
  };

  const updateSummary = (items = []) => {
    dom.resultsSummary.textContent = `${items.length} book type${items.length === 1 ? '' : 's'} on this page`;
    dom.resultsMeta.textContent = `Page ${state.page}`;
    dom.listCount.textContent = `${items.length} loaded`;
  };

  const renderPagination = (hasNextPage) => {
    dom.paginationNav.innerHTML = '';

    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Book types pagination');
    const ul = document.createElement('ul');
    ul.className = 'pagination mb-0';

    const createPageItem = (label, disabled, onClick) => {
      const li = document.createElement('li');
      li.className = `page-item ${disabled ? 'disabled' : ''}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'page-link';
      btn.textContent = label;
      btn.disabled = disabled;
      if (!disabled) {
        btn.addEventListener('click', onClick);
      }
      li.appendChild(btn);
      return li;
    };

    ul.appendChild(createPageItem('Previous', state.page <= 1, () => {
      state.page = Math.max(1, state.page - 1);
      updateUrl();
      loadBookTypes();
    }));

    const current = document.createElement('li');
    current.className = 'page-item active';
    current.innerHTML = `<span class="page-link">${state.page}</span>`;
    ul.appendChild(current);

    ul.appendChild(createPageItem('Next', !hasNextPage, () => {
      state.page += 1;
      updateUrl();
      loadBookTypes();
    }));

    nav.appendChild(ul);
    dom.paginationNav.appendChild(nav);
  };

  const renderList = (items = [], hasNextPage = false) => {
    dom.listTableBody.innerHTML = '';
    if (!items.length) {
      dom.listTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No book types found.</td></tr>';
      updateSummary(items);
      renderPagination(false);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.dataset.id = item.id;
      row.innerHTML = `
        <td>
          <div class="fw-semibold">${escapeHtml(item.name || '')}</div>
          ${item.description ? `<div class="text-muted small">${escapeHtml(item.description)}</div>` : ''}
          <div class="text-muted small list-meta-mobile">Created ${formatTimestamp(item.createdAt)} · Updated ${formatTimestamp(item.updatedAt)}</div>
        </td>
        <td class="list-col-created">${formatTimestamp(item.createdAt)}</td>
        <td class="list-col-updated">${formatTimestamp(item.updatedAt)}</td>
        <td class="list-col-actions text-end">
          <div class="btn-group btn-group-sm row-actions" role="group" aria-label="Row actions">
            <button type="button" class="btn btn-outline-secondary" data-action="view" aria-label="View book type" title="View">
              <i class="bi bi-eye"></i>
            </button>
            <button type="button" class="btn btn-outline-secondary" data-action="edit" aria-label="Edit book type" title="Edit">
              <i class="bi bi-pencil-fill"></i>
            </button>
            <button type="button" class="btn btn-outline-danger" data-action="delete" aria-label="Delete book type" title="Delete">
              <i class="bi bi-trash-fill"></i>
            </button>
          </div>
        </td>
      `;
      dom.listTableBody.appendChild(row);
    });

    updateSummary(items);
    renderPagination(hasNextPage);
  };

  const loadBookTypes = async () => {
    let resolvedOk = false;
    let resolvedError = null;
    clearAlerts();
    dom.listTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Loading…</td></tr>';
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

  let modalInstance = null;
  let modalMode = 'create';
  let modalOriginal = null;
  let modalSaving = false;

  const resetModalValidation = () => {
    dom.bookTypeError.classList.add('d-none');
    dom.bookTypeError.textContent = '';
    dom.bookTypeName.classList.remove('is-valid', 'is-invalid');
    dom.bookTypeDescription.classList.remove('is-valid', 'is-invalid');
    dom.bookTypeNameHelp.classList.remove('text-danger');
    dom.bookTypeDescriptionHelp.classList.remove('text-danger');
    dom.bookTypeNameHelp.classList.add('text-muted');
    dom.bookTypeDescriptionHelp.classList.add('text-muted');
  };

  const setModalLocked = (locked) => {
    modalSaving = locked;
    dom.bookTypeName.disabled = locked;
    dom.bookTypeDescription.disabled = locked;
    dom.bookTypeSaveBtn.disabled = locked || !isModalReady();
    dom.bookTypeResetBtn.disabled = locked;
  };

  const getModalValues = () => ({
    name: dom.bookTypeName.value.trim(),
    description: dom.bookTypeDescription.value.trim()
  });

  const getModalChanges = () => {
    const values = getModalValues();
    const changes = [];
    if (modalMode === 'create') {
      if (values.name) changes.push('Name set');
      if (values.description) changes.push('Description added');
      return changes;
    }
    if (!modalOriginal) return changes;
    if (values.name !== modalOriginal.name) changes.push(`Name updated`);
    if ((values.description || '') !== (modalOriginal.description || '')) changes.push(`Description updated`);
    return changes;
  };

  const validateModal = () => {
    resetModalValidation();
    const values = getModalValues();
    let valid = true;
    if (!values.name) {
      valid = false;
      dom.bookTypeName.classList.add('is-invalid');
      dom.bookTypeNameHelp.textContent = 'A book type name is required.';
      dom.bookTypeNameHelp.classList.remove('text-muted');
      dom.bookTypeNameHelp.classList.add('text-danger');
    } else {
      dom.bookTypeName.classList.add('is-valid');
      dom.bookTypeNameHelp.textContent = 'Looks good.';
    }

    if (values.description.length > 1000) {
      valid = false;
      dom.bookTypeDescription.classList.add('is-invalid');
      dom.bookTypeDescriptionHelp.textContent = 'Description is too long.';
      dom.bookTypeDescriptionHelp.classList.remove('text-muted');
      dom.bookTypeDescriptionHelp.classList.add('text-danger');
    } else if (values.description) {
      dom.bookTypeDescription.classList.add('is-valid');
      dom.bookTypeDescriptionHelp.textContent = 'Looks good.';
    }

    return valid;
  };

  const isModalReady = () => {
    const valid = validateModal();
    if (!valid) return false;
    const changes = getModalChanges();
    return modalMode === 'create' ? Boolean(dom.bookTypeName.value.trim()) : changes.length > 0;
  };

  const updateModalChanges = () => {
    const changes = getModalChanges();
    dom.bookTypeChanges.textContent = changes.length ? `Changes: ${changes.join(', ')}.` : 'No changes yet.';
    dom.bookTypeSaveBtn.disabled = modalSaving || !isModalReady();
  };

  const openModal = ({ mode, data }) => {
    modalMode = mode;
    modalOriginal = data || null;
    dom.bookTypeModalLabel.textContent = mode === 'create' ? 'Add book type' : 'Edit book type';
    dom.bookTypeSaveBtn.textContent = mode === 'create' ? 'Save book type' : 'Save changes';
    dom.bookTypeName.value = data?.name || '';
    dom.bookTypeDescription.value = data?.description || '';
    resetModalValidation();
    updateModalChanges();
    if (!modalInstance) modalInstance = new bootstrap.Modal(dom.bookTypeModal);
    modalInstance.show();
    log(`${mode} modal opened`, data?.id);
  };

  const closeModal = () => {
    if (modalInstance) modalInstance.hide();
  };

  const submitModal = async () => {
    if (modalSaving || !isModalReady()) return;
    setModalLocked(true);
    dom.bookTypeError.classList.add('d-none');
    const values = getModalValues();

    try {
      const payload = { name: values.name, description: values.description || null };
      let response;
      if (modalMode === 'create') {
        log('Creating book type', payload);
        response = await apiFetch('/booktype', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        payload.id = modalOriginal?.id;
        log('Updating book type', payload);
        response = await apiFetch('/booktype', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.message || 'Unable to save book type.';
        const details = Array.isArray(data?.errors) ? data.errors : [];
        throw new Error([message, ...details].filter(Boolean).join(' '));
      }
      closeModal();
      showAlert({ message: modalMode === 'create' ? 'Book type created.' : 'Book type updated.', type: 'success' });
      state.page = 1;
      await loadBookTypes();
    } catch (err) {
      errorLog('Save failed', err);
      dom.bookTypeError.textContent = err?.message || 'Unable to save book type.';
      dom.bookTypeError.classList.remove('d-none');
    } finally {
      setModalLocked(false);
    }
  };

  let deleteModalInstance = null;
  let deleteTarget = null;
  let deleteSaving = false;

  const openDeleteModal = (data) => {
    deleteTarget = data;
    dom.bookTypeDeleteName.textContent = data?.name || 'this book type';
    dom.bookTypeDeleteConfirm.value = '';
    dom.bookTypeDeleteHelp.textContent = 'Enter DELETE to enable deletion.';
    dom.bookTypeDeleteHelp.classList.remove('text-danger');
    dom.bookTypeDeleteHelp.classList.add('text-muted');
    dom.bookTypeDeleteError.classList.add('d-none');
    dom.bookTypeDeleteBtn.disabled = true;
    if (!deleteModalInstance) deleteModalInstance = new bootstrap.Modal(dom.bookTypeDeleteModal);
    deleteModalInstance.show();
    log('Delete modal opened', data?.id);
  };

  const updateDeleteState = () => {
    const value = dom.bookTypeDeleteConfirm.value.trim();
    const ready = value === 'DELETE';
    dom.bookTypeDeleteBtn.disabled = deleteSaving || !ready;
    if (!value) {
      dom.bookTypeDeleteHelp.textContent = 'Enter DELETE to enable deletion.';
      dom.bookTypeDeleteHelp.classList.remove('text-danger');
      dom.bookTypeDeleteHelp.classList.add('text-muted');
    } else if (ready) {
      dom.bookTypeDeleteHelp.textContent = 'Ready to delete.';
      dom.bookTypeDeleteHelp.classList.remove('text-danger');
      dom.bookTypeDeleteHelp.classList.add('text-muted');
    } else {
      dom.bookTypeDeleteHelp.textContent = 'The confirmation text does not match.';
      dom.bookTypeDeleteHelp.classList.remove('text-muted');
      dom.bookTypeDeleteHelp.classList.add('text-danger');
    }
  };

  const submitDelete = async () => {
    if (deleteSaving || dom.bookTypeDeleteConfirm.value.trim() !== 'DELETE') return;
    deleteSaving = true;
    dom.bookTypeDeleteBtn.disabled = true;
    dom.bookTypeDeleteError.classList.add('d-none');

    try {
      const payload = { id: deleteTarget?.id };
      log('Deleting book type', payload);
      const response = await apiFetch('/booktype', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.message || 'Unable to delete book type.';
        const details = Array.isArray(data?.errors) ? data.errors : [];
        throw new Error([message, ...details].filter(Boolean).join(' '));
      }
      deleteModalInstance.hide();
      showAlert({ message: 'Book type deleted.', type: 'success' });
      state.page = 1;
      await loadBookTypes();
    } catch (err) {
      errorLog('Delete failed', err);
      dom.bookTypeDeleteError.textContent = err?.message || 'Unable to delete book type.';
      dom.bookTypeDeleteError.classList.remove('d-none');
    } finally {
      deleteSaving = false;
      updateDeleteState();
    }
  };

  const handleRowAction = (event) => {
    const button = event.target.closest('button[data-action]');
    const row = event.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;
    const item = state.data.find((entry) => String(entry.id) === String(id));
    if (!item) return;

    if (button) {
      const action = button.dataset.action;
      if (action === 'view') {
        window.location.href = `book-type-details?id=${encodeURIComponent(id)}`;
        return;
      }
      if (action === 'edit') {
        openModal({ mode: 'edit', data: item });
        return;
      }
      if (action === 'delete') {
        openDeleteModal(item);
        return;
      }
      return;
    }

    window.location.href = `book-type-details?id=${encodeURIComponent(id)}`;
  };

  const syncFromFilters = () => {
    state.filters.name = dom.filterName.value.trim();
    state.filters.description = dom.filterDescription.value.trim();
    state.filters.createdAfter = dom.filterCreatedAfter.value;
    state.filters.createdBefore = dom.filterCreatedBefore.value;
    state.filters.updatedAfter = dom.filterUpdatedAfter.value;
    state.filters.updatedBefore = dom.filterUpdatedBefore.value;
  };

  const searchChanged = () => {
    state.search = dom.searchInput.value.trim();
    state.page = 1;
    state.searchDriven = Boolean(state.search);
    if (state.searchDriven) {
      state.filters.name = state.search;
    }
    updateUrl();
    buildFilterChips();
    loadBookTypes();
  };

  const bindEvents = () => {
    dom.addBookTypeBtn.addEventListener('click', () => openModal({ mode: 'create' }));
    dom.clearSearchBtn.addEventListener('click', () => {
      dom.searchInput.value = '';
      searchChanged();
    });
    dom.searchInput.addEventListener('input', debounce(searchChanged, 300));
    dom.sortSelect.addEventListener('change', () => {
      const [field, order] = dom.sortSelect.value.split(':');
      state.sort.field = field || 'name';
      state.sort.order = order || 'asc';
      state.page = 1;
      updateUrl();
      loadBookTypes();
    });
    dom.perPageInput.addEventListener('change', () => {
      state.limit = parseNumber(dom.perPageInput.value) || 20;
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
      state.filters = defaultFilters();
      syncFormWithState();
      buildFilterChips();
    });
    dom.clearAllFiltersBtn.addEventListener('click', resetFilters);
    dom.listTableBody.addEventListener('click', handleRowAction);

    dom.bookTypeName.addEventListener('input', () => {
      updateModalChanges();
    });
    dom.bookTypeDescription.addEventListener('input', () => {
      updateModalChanges();
    });
    dom.bookTypeResetBtn.addEventListener('click', () => {
      dom.bookTypeName.value = modalOriginal?.name || '';
      dom.bookTypeDescription.value = modalOriginal?.description || '';
      resetModalValidation();
      updateModalChanges();
    });
    dom.bookTypeSaveBtn.addEventListener('click', submitModal);

    dom.bookTypeDeleteConfirm.addEventListener('input', updateDeleteState);
    dom.bookTypeDeleteBtn.addEventListener('click', submitDelete);
  };

  const init = () => {
    hydrateStateFromUrl();
    syncFormWithState();
    buildFilterChips();
    bindEvents();
    loadBookTypes();
    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve({ success: true });
    }
  };

  init();
})();
