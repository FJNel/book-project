// Storage Locations page logic: tree browsing, CRUD, and book list by location.
(function () {
  const log = (...args) => console.log('[Storage Locations]', ...args);
  const warn = (...args) => console.warn('[Storage Locations]', ...args);
  const errorLog = (...args) => console.error('[Storage Locations]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const debugLog = (...args) => {
    console.log('[Storage Locations][debug]', ...args);
  };

  const STORAGE_EXPANDED_KEY = 'storageLocationsExpanded';

  const state = {
    locations: [],
    selectedId: null,
    expandedIds: new Set(),
    searchQuery: '',
    includeSubtreeBooks: true,
    booksSort: { field: 'title', order: 'asc' },
    booksLimit: 10,
    booksPage: 1
  };

  const dom = {
    treeContainer: document.getElementById('treeContainer'),
    treeEmptyState: document.getElementById('treeEmptyState'),
    treeSearchInput: document.getElementById('treeSearchInput'),
    clearTreeSearchBtn: document.getElementById('clearTreeSearchBtn'),
    expandAllBtn: document.getElementById('expandAllBtn'),
    collapseAllBtn: document.getElementById('collapseAllBtn'),
    addRootBtn: document.getElementById('addRootBtn'),
    refreshLocationsBtn: document.getElementById('refreshLocationsBtn'),
    detailsOffcanvas: document.getElementById('detailsOffcanvas'),
    detailsContent: document.getElementById('detailsContent'),
    detailsEmptyState: document.getElementById('detailsEmptyState'),
    locationNameHeading: document.getElementById('locationNameHeading'),
    locationNotesHeading: document.getElementById('locationNotesHeading'),
    locationBreadcrumb: document.getElementById('locationBreadcrumb'),
    locationParentLine: document.getElementById('locationParentLine'),
    copyPathBtn: document.getElementById('copyPathBtn'),
    booksDirectStat: document.getElementById('booksDirectStat'),
    booksTotalStat: document.getElementById('booksTotalStat'),
    childrenCountStat: document.getElementById('childrenCountStat'),
    booksTableBody: document.getElementById('booksTableBody'),
    booksEmptyState: document.getElementById('booksEmptyState'),
    booksPaginationInfo: document.getElementById('booksPaginationInfo'),
    booksPaginationNav: document.getElementById('booksPaginationNav'),
    booksSortSelect: document.getElementById('booksSortSelect'),
    booksPerPageInput: document.getElementById('booksPerPageInput'),
    directOnlyBtn: document.getElementById('directOnlyBtn'),
    includeSubtreeBtn: document.getElementById('includeSubtreeBtn'),
    locationTimestampLine: document.getElementById('locationTimestampLine'),
    addChildBtn: document.getElementById('addChildBtn'),
    renameBtn: document.getElementById('renameBtn'),
    moveBtn: document.getElementById('moveBtn'),
    deleteBtn: document.getElementById('deleteBtn'),
    locationModal: document.getElementById('locationModal'),
    locationModalTitle: document.getElementById('locationModalTitle'),
    locationNameInput: document.getElementById('locationNameInput'),
    locationNotesInput: document.getElementById('locationNotesInput'),
    locationParentLabel: document.getElementById('locationParentLabel'),
    locationModalError: document.getElementById('locationModalError'),
    locationModalSaveBtn: document.getElementById('locationModalSaveBtn'),
    moveLocationModal: document.getElementById('moveLocationModal'),
    moveLocationSelect: document.getElementById('moveLocationSelect'),
    moveLocationError: document.getElementById('moveLocationError'),
    moveLocationConfirmBtn: document.getElementById('moveLocationConfirmBtn'),
    deleteLocationModal: document.getElementById('deleteLocationModal'),
    deleteLocationMessage: document.getElementById('deleteLocationMessage'),
    deleteLocationError: document.getElementById('deleteLocationError'),
    deleteLocationConfirmBtn: document.getElementById('deleteLocationConfirmBtn'),
    feedbackContainer: document.getElementById('feedbackContainer')
  };

  let locationModalMode = 'create';
  let modalLocationId = null;

  const debounce = (fn, delay = 350) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const parseNumber = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const placeholderCover = (title) => {
    const text = encodeURIComponent(title || 'Book Cover');
    return `https://placehold.co/120x180?text=${text}&font=Lora`;
  };

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
    return parsed.toLocaleString(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const showAlert = ({ message, type = 'danger', details = [] }) => {
    if (!dom.feedbackContainer) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
      <div class="fw-semibold mb-1">${escapeHtml(message || 'Something went wrong.')}</div>
      ${Array.isArray(details) && details.length ? `<ul class="mb-1 small text-muted">${details.map((err) => `<li>${escapeHtml(err)}</li>`).join('')}</ul>` : ''}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    dom.feedbackContainer.innerHTML = '';
    dom.feedbackContainer.appendChild(alert);
  };

  const clearAlerts = () => {
    if (dom.feedbackContainer) dom.feedbackContainer.innerHTML = '';
  };

  const saveExpanded = () => {
    try {
      localStorage.setItem(STORAGE_EXPANDED_KEY, JSON.stringify(Array.from(state.expandedIds)));
    } catch (error) {
      warn('Failed to save expanded state.', error);
    }
  };

  const loadExpanded = () => {
    try {
      const raw = localStorage.getItem(STORAGE_EXPANDED_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.expandedIds = new Set(parsed.map((id) => Number.parseInt(id, 10)).filter(Number.isInteger));
      }
    } catch (error) {
      warn('Failed to load expanded state.', error);
    }
  };

  const hydrateStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const idParam = parseNumber(params.get('id'));
    if (idParam) state.selectedId = idParam;
    const queryParam = params.get('q');
    if (queryParam) state.searchQuery = queryParam;
    const includeSubtree = params.get('includeSubtree');
    if (includeSubtree === 'false') state.includeSubtreeBooks = false;
    const sortParam = params.get('booksSort');
    if (sortParam) {
      const [field, order] = sortParam.split(':');
      state.booksSort = { field: field || 'title', order: order || 'asc' };
    }
    const pageParam = parseNumber(params.get('booksPage'));
    if (pageParam) state.booksPage = Math.max(1, pageParam);
    const limitParam = parseNumber(params.get('booksLimit'));
    if (limitParam) state.booksLimit = Math.min(50, Math.max(2, limitParam));
  };

  const updateUrl = () => {
    const params = new URLSearchParams();
    if (state.selectedId) params.set('id', String(state.selectedId));
    if (state.searchQuery) params.set('q', state.searchQuery);
    params.set('includeSubtree', state.includeSubtreeBooks ? 'true' : 'false');
    params.set('booksSort', `${state.booksSort.field}:${state.booksSort.order}`);
    params.set('booksPage', String(state.booksPage));
    params.set('booksLimit', String(state.booksLimit));
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  const handleRateLimit = async (response) => {
    if (response && response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      await window.rateLimitGuard.showModal();
      return true;
    }
    return false;
  };

  const buildLocationMaps = () => {
    const byId = new Map();
    const childrenMap = new Map();
    state.locations.forEach((loc) => {
      byId.set(loc.id, loc);
      const parentKey = loc.parentId ?? 'root';
      if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
      childrenMap.get(parentKey).push(loc);
    });
    childrenMap.forEach((list) => list.sort((a, b) => (a.path || '').localeCompare(b.path || '')));
    return { byId, childrenMap };
  };

  const computeSearchVisibility = (byId) => {
    const query = state.searchQuery.trim().toLowerCase();
    if (!query) return { visibleIds: null, autoExpand: new Set() };

    const visibleIds = new Set();
    const autoExpand = new Set();

    state.locations.forEach((loc) => {
      const nameMatch = loc.name?.toLowerCase().includes(query);
      const pathMatch = loc.path?.toLowerCase().includes(query);
      if (nameMatch || pathMatch) {
        visibleIds.add(loc.id);
        let parentId = loc.parentId;
        while (parentId) {
          visibleIds.add(parentId);
          autoExpand.add(parentId);
          parentId = byId.get(parentId)?.parentId;
        }
      }
    });

    return { visibleIds, autoExpand };
  };

  const renderTree = () => {
    if (!dom.treeContainer) return;
    dom.treeContainer.innerHTML = '';

    if (!state.locations.length) {
      if (dom.treeEmptyState) dom.treeEmptyState.classList.remove('d-none');
      return;
    }
    if (dom.treeEmptyState) dom.treeEmptyState.classList.add('d-none');

    const { byId, childrenMap } = buildLocationMaps();
    const { visibleIds, autoExpand } = computeSearchVisibility(byId);

    const renderNode = (loc, level) => {
      if (visibleIds && !visibleIds.has(loc.id)) return;
      const hasChildren = (childrenMap.get(loc.id) || []).length > 0;
      const isExpanded = state.expandedIds.has(loc.id) || autoExpand.has(loc.id);
      const nodeWrap = document.createElement('div');
      nodeWrap.className = 'tree-node';
      nodeWrap.style.setProperty('--level', level);

      const row = document.createElement('div');
      row.className = `node-row d-flex align-items-center justify-content-between gap-2 ${state.selectedId === loc.id ? 'selected' : ''}`;
      row.setAttribute('data-id', String(loc.id));

      const left = document.createElement('div');
      left.className = 'd-flex align-items-center gap-2 flex-grow-1';

      const caret = document.createElement('button');
      caret.type = 'button';
      caret.className = `btn btn-sm btn-link text-muted p-0 ${hasChildren ? '' : 'invisible'}`;
      caret.setAttribute('data-action', 'toggle');
      caret.setAttribute('data-id', String(loc.id));
      caret.innerHTML = isExpanded
        ? '<span aria-hidden="true">▾</span>'
        : '<span aria-hidden="true">▸</span>';

      const name = document.createElement('div');
      name.className = 'fw-semibold';
      name.textContent = loc.name || 'Untitled location';

      const badge = document.createElement('span');
      badge.className = 'badge text-bg-light border';
      const countValue = Number.isFinite(loc.booksTotalCount) ? loc.booksTotalCount : (Number.isFinite(loc.booksDirectCount) ? loc.booksDirectCount : 0);
      badge.textContent = String(countValue);

      left.appendChild(caret);
      left.appendChild(name);
      left.appendChild(badge);

      const actions = document.createElement('div');
      actions.className = 'node-actions dropdown';
      actions.innerHTML = `
        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          <span aria-hidden="true">⋮</span>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><button class="dropdown-item" type="button" data-action="add-child" data-id="${loc.id}">Add child</button></li>
          <li><button class="dropdown-item" type="button" data-action="rename" data-id="${loc.id}">Rename</button></li>
          <li><button class="dropdown-item" type="button" data-action="move" data-id="${loc.id}">Move</button></li>
          <li><button class="dropdown-item text-danger" type="button" data-action="delete" data-id="${loc.id}">Delete</button></li>
        </ul>
      `;

      row.appendChild(left);
      row.appendChild(actions);
      row.addEventListener('click', (event) => {
        if (event.target.closest('[data-action=\"toggle\"]')) return;
        if (event.target.closest('.dropdown')) return;
        selectLocation(loc.id, { openPanel: true });
      });

      nodeWrap.appendChild(row);
      dom.treeContainer.appendChild(nodeWrap);

      if (hasChildren && isExpanded) {
        childrenMap.get(loc.id).forEach((child) => renderNode(child, level + 1));
      }
    };

    (childrenMap.get('root') || []).forEach((root) => renderNode(root, 0));
  };

  const renderBreadcrumb = (path) => {
    if (!dom.locationBreadcrumb) return;
    dom.locationBreadcrumb.innerHTML = '';
    if (!path) {
      dom.locationBreadcrumb.innerHTML = '<span class="text-muted">No path available.</span>';
      return;
    }
    const parts = path.split(' -> ').map((part) => part.trim()).filter(Boolean);
    parts.forEach((part, index) => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      chip.textContent = part;
      dom.locationBreadcrumb.appendChild(chip);
      if (index < parts.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'text-muted';
        arrow.textContent = '›';
        dom.locationBreadcrumb.appendChild(arrow);
      }
    });
  };

  const renderDetails = (location, stats) => {
    if (!dom.detailsContent || !dom.detailsEmptyState) return;
    if (!location) {
      dom.detailsContent.classList.add('d-none');
      dom.detailsEmptyState.classList.remove('d-none');
      return;
    }
    dom.detailsEmptyState.classList.add('d-none');
    dom.detailsContent.classList.remove('d-none');

    const notesLine = location.notes || 'No notes provided.';
    const pathValue = stats?.path || location.path || '';
    const parent = state.locations.find((loc) => loc.id === location.parentId);

    if (dom.locationNameHeading) dom.locationNameHeading.textContent = location.name || 'Untitled location';
    if (dom.locationNotesHeading) dom.locationNotesHeading.textContent = notesLine;
    if (dom.locationParentLine) {
      dom.locationParentLine.textContent = parent ? `Parent: ${parent.name}` : 'Parent: Root location';
    }

    renderBreadcrumb(pathValue);

    if (dom.booksDirectStat) dom.booksDirectStat.textContent = stats?.directCopyCount ?? location.booksDirectCount ?? 0;
    if (dom.booksTotalStat) dom.booksTotalStat.textContent = stats?.nestedCopyCount ?? location.booksTotalCount ?? 0;
    if (dom.childrenCountStat) dom.childrenCountStat.textContent = stats?.childLocations ?? location.childrenCount ?? 0;

    if (dom.locationTimestampLine) {
      const created = formatTimestamp(location.createdAt) || '—';
      const updated = formatTimestamp(location.updatedAt) || '—';
      dom.locationTimestampLine.textContent = `Created ${created} • Updated ${updated}`;
    }
  };

  const updateBooksToggle = () => {
    if (!dom.directOnlyBtn || !dom.includeSubtreeBtn) return;
    dom.directOnlyBtn.classList.toggle('btn-primary', !state.includeSubtreeBooks);
    dom.directOnlyBtn.classList.toggle('btn-outline-secondary', state.includeSubtreeBooks);
    dom.includeSubtreeBtn.classList.toggle('btn-primary', state.includeSubtreeBooks);
    dom.includeSubtreeBtn.classList.toggle('btn-outline-secondary', !state.includeSubtreeBooks);
  };

  const renderBooks = (books) => {
    if (!dom.booksTableBody) return;
    dom.booksTableBody.innerHTML = '';

    if (!books.length) {
      if (dom.booksEmptyState) dom.booksEmptyState.classList.remove('d-none');
      return;
    }
    if (dom.booksEmptyState) dom.booksEmptyState.classList.add('d-none');

    books.forEach((book) => {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      const cover = book.coverImageUrl || placeholderCover(book.title);
      const subtitle = book.subtitle ? `<div class="text-muted small">${escapeHtml(book.subtitle)}</div>` : '';
      const authors = Array.isArray(book.authors) && book.authors.length
        ? book.authors.map((author) => author.authorName || author.displayName || author.name).filter(Boolean).join(', ')
        : '—';
      const languages = Array.isArray(book.languages) && book.languages.length
        ? book.languages.map((lang) => lang.name).join(', ')
        : '—';
      const tags = Array.isArray(book.tags) && book.tags.length
        ? book.tags.map((tag) => tag.name).join(', ')
        : '—';
      const published = formatPartialDate(book.publicationDate) || '—';
      const bookType = book.bookType?.name || book.bookTypeName || '—';

      row.innerHTML = `
        <td class="list-col-book">
          <div class="d-flex align-items-center gap-3">
            <img src="${cover}" alt="${escapeHtml(book.title || 'Book cover')}" class="cover-thumb" />
            <div>
              <div class="fw-semibold">${escapeHtml(book.title || 'Untitled')}</div>
              ${subtitle}
              <div class="text-muted small list-meta-mobile">${escapeHtml(authors)} • ${escapeHtml(published)}</div>
            </div>
          </div>
        </td>
        <td class="list-col-authors"><span class="text-muted">${escapeHtml(authors)}</span></td>
        <td class="list-col-type"><span class="text-muted">${escapeHtml(bookType)}</span></td>
        <td class="list-col-language"><span class="text-muted">${escapeHtml(languages)}</span></td>
        <td class="list-col-published"><span class="text-muted">${escapeHtml(published)}</span></td>
        <td class="list-col-tags"><span class="text-muted">${escapeHtml(tags)}</span></td>
      `;
      row.addEventListener('click', () => {
        window.location.href = `book-details?id=${book.id}`;
      });
      dom.booksTableBody.appendChild(row);
    });
  };

  const renderBooksPagination = (hasNextPage) => {
    if (!dom.booksPaginationNav || !dom.booksPaginationInfo) return;
    dom.booksPaginationNav.innerHTML = '';
    dom.booksPaginationInfo.textContent = `Page ${state.booksPage}`;

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

    dom.booksPaginationNav.appendChild(createItem('&laquo;', state.booksPage === 1, () => {
      state.booksPage = Math.max(1, state.booksPage - 1);
      loadBooks();
    }, 'Previous'));

    dom.booksPaginationNav.appendChild(createItem('&raquo;', !hasNextPage, () => {
      state.booksPage = state.booksPage + 1;
      loadBooks();
    }, 'Next'));
  };

  const buildBooksBody = () => ({
    limit: state.booksLimit,
    offset: (state.booksPage - 1) * state.booksLimit,
    view: 'all',
    sortBy: state.booksSort.field,
    order: state.booksSort.order,
    filterStorageLocationId: state.selectedId ? [state.selectedId] : [],
    includeSubtree: state.includeSubtreeBooks
  });

  const loadBooks = async () => {
    if (!state.selectedId) return;
    updateUrl();
    updateBooksToggle();

    if (dom.booksTableBody) {
      dom.booksTableBody.innerHTML = '<tr><td colspan="6" class="text-muted py-3">Loading books…</td></tr>';
    }

    const body = buildBooksBody();
    debugLog('Requesting /book/list with JSON body', body);

    try {
      const response = await apiFetch('/book/list', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));

      if (await handleRateLimit(response)) return;

      if (!response.ok) {
        const details = Array.isArray(payload.errors) ? payload.errors : [];
        showAlert({ message: payload.message || 'Failed to load books.', details });
        return;
      }

      const books = payload.data?.books || [];
      const hasNextPage = books.length === state.booksLimit;
      renderBooks(books);
      renderBooksPagination(hasNextPage);
    } catch (error) {
      errorLog('Book list fetch failed', error);
      showAlert({ message: 'Unable to load books for this location.', details: [error.message] });
    }
  };

  const openDetailsPanel = () => {
    if (!dom.detailsOffcanvas) return;
    if (window.matchMedia('(max-width: 767px)').matches) {
      const instance = bootstrap.Offcanvas.getOrCreateInstance(dom.detailsOffcanvas);
      instance.show();
    }
  };

  const loadLocationDetails = async (locationId) => {
    log('Loading location details.', { locationId });
    const response = await apiFetch(`/storagelocation?id=${locationId}&returnStats=true`, { method: 'GET' });
    if (await handleRateLimit(response)) return null;
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const details = Array.isArray(payload.errors) ? payload.errors : [];
      showAlert({ message: payload.message || 'Failed to load location details.', details });
      return null;
    }
    const payload = await response.json();
    return payload.data || null;
  };

  const selectLocation = async (locationId, { openPanel = false } = {}) => {
    if (!locationId) return;
    state.selectedId = locationId;
    updateUrl();
    renderTree();

    const location = state.locations.find((loc) => loc.id === locationId) || null;
    if (!location) {
      renderDetails(null, null);
      return;
    }

    const detailPayload = await loadLocationDetails(locationId);
    renderDetails(location, detailPayload?.stats || null);
    await loadBooks();

    if (openPanel) openDetailsPanel();
  };

  const loadLocations = async () => {
    log('Loading storage locations.');
    const body = {
      includeCounts: true,
      sortBy: 'path',
      order: 'asc',
      limit: 200
    };
    debugLog('Requesting /storagelocation/list with JSON body', body);
    const response = await apiFetch('/storagelocation/list', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));

    if (await handleRateLimit(response)) return false;

    if (!response.ok) {
      const details = Array.isArray(payload.errors) ? payload.errors : [];
      showAlert({ message: payload.message || 'Failed to load locations.', details });
      return false;
    }

    state.locations = payload.data?.storageLocations || [];
    debugLog('Loaded storage locations.', { count: state.locations.length });
    renderTree();

    if (!state.locations.length) {
      renderDetails(null, null);
      return true;
    }

    if (!state.selectedId) {
      const firstRoot = state.locations.find((loc) => loc.parentId === null);
      state.selectedId = firstRoot?.id || state.locations[0]?.id;
    }

    await selectLocation(state.selectedId, { openPanel: false });
    return true;
  };

  const openLocationModal = ({ mode, locationId = null, parentId = null }) => {
    locationModalMode = mode;
    modalLocationId = locationId;
    const selected = state.locations.find((loc) => loc.id === locationId);
    const parent = state.locations.find((loc) => loc.id === parentId);
    const selectedParent = selected?.parentId ? state.locations.find((loc) => loc.id === selected.parentId) : null;

    if (dom.locationModalTitle) dom.locationModalTitle.textContent = mode === 'rename' ? 'Rename Location' : 'Add Location';
    if (dom.locationNameInput) dom.locationNameInput.value = mode === 'rename' ? (selected?.name || '') : '';
    if (dom.locationNotesInput) dom.locationNotesInput.value = mode === 'rename' ? (selected?.notes || '') : '';
    if (dom.locationParentLabel) {
      if (mode === 'rename') {
        dom.locationParentLabel.value = selected?.parentId ? (selectedParent?.name || 'Parent') : 'Root location';
      } else {
        dom.locationParentLabel.value = parent ? parent.name : 'Root location';
      }
    }
    if (dom.locationModalError) {
      dom.locationModalError.classList.add('d-none');
      dom.locationModalError.textContent = '';
    }

    if (dom.locationModal) {
      bootstrap.Modal.getOrCreateInstance(dom.locationModal).show();
    }
  };

  const saveLocationModal = async () => {
    const name = dom.locationNameInput?.value.trim() || '';
    const notes = dom.locationNotesInput?.value.trim() || '';

    if (!name) {
      if (dom.locationModalError) {
        dom.locationModalError.textContent = 'Location name is required.';
        dom.locationModalError.classList.remove('d-none');
      }
      return;
    }

    try {
      if (locationModalMode === 'rename' && modalLocationId) {
        log('Renaming location.', { id: modalLocationId, name });
        const response = await apiFetch(`/storagelocation/${modalLocationId}`, {
          method: 'PUT',
          body: JSON.stringify({ name, notes })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const details = Array.isArray(payload.errors) ? payload.errors : [];
          throw new Error(details.join(' ') || payload.message || 'Rename failed.');
        }
      } else {
        const parentId = modalLocationId;
        log('Creating location.', { name, parentId });
        const response = await apiFetch('/storagelocation', {
          method: 'POST',
          body: JSON.stringify({ name, parentId, notes })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const details = Array.isArray(payload.errors) ? payload.errors : [];
          throw new Error(details.join(' ') || payload.message || 'Create failed.');
        }
      }

      bootstrap.Modal.getInstance(dom.locationModal)?.hide();
      await loadLocations();
    } catch (error) {
      errorLog('Location save failed.', error);
      if (dom.locationModalError) {
        dom.locationModalError.textContent = error.message || 'Unable to save location.';
        dom.locationModalError.classList.remove('d-none');
      }
    }
  };

  const openMoveModal = (locationId) => {
    modalLocationId = locationId;
    const selected = state.locations.find((loc) => loc.id === locationId);
    if (!selected || !dom.moveLocationSelect) return;

    dom.moveLocationSelect.innerHTML = '';
    const optionRoot = document.createElement('option');
    optionRoot.value = '';
    optionRoot.textContent = 'Move to root';
    dom.moveLocationSelect.appendChild(optionRoot);

    const descendants = new Set();
    const map = buildLocationMaps();
    const collectDescendants = (id) => {
      (map.childrenMap.get(id) || []).forEach((child) => {
        descendants.add(child.id);
        collectDescendants(child.id);
      });
    };
    collectDescendants(locationId);

    state.locations.forEach((loc) => {
      if (loc.id === locationId || descendants.has(loc.id)) return;
      const option = document.createElement('option');
      option.value = String(loc.id);
      option.textContent = loc.path || loc.name;
      dom.moveLocationSelect.appendChild(option);
    });

    dom.moveLocationSelect.value = selected.parentId ? String(selected.parentId) : '';
    if (dom.moveLocationError) {
      dom.moveLocationError.classList.add('d-none');
      dom.moveLocationError.textContent = '';
    }

    bootstrap.Modal.getOrCreateInstance(dom.moveLocationModal).show();
  };

  const confirmMove = async () => {
    if (!modalLocationId) return;
    const parentIdRaw = dom.moveLocationSelect?.value;
    const parentId = parentIdRaw ? Number.parseInt(parentIdRaw, 10) : null;

    log('Moving location.', { id: modalLocationId, parentId });
    try {
      const response = await apiFetch(`/storagelocation/${modalLocationId}`, {
        method: 'PUT',
        body: JSON.stringify({ parentId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Array.isArray(payload.errors) ? payload.errors : [];
        throw new Error(details.join(' ') || payload.message || 'Move failed.');
      }
      bootstrap.Modal.getInstance(dom.moveLocationModal)?.hide();
      await loadLocations();
    } catch (error) {
      errorLog('Move failed.', error);
      if (dom.moveLocationError) {
        dom.moveLocationError.textContent = error.message || 'Unable to move location.';
        dom.moveLocationError.classList.remove('d-none');
      }
    }
  };

  const openDeleteModal = (locationId) => {
    modalLocationId = locationId;
    const selected = state.locations.find((loc) => loc.id === locationId);
    if (!selected || !dom.deleteLocationMessage) return;

    const childCount = selected.childrenCount || 0;
    const bookCount = selected.booksTotalCount || 0;
    const blocked = childCount > 0 || bookCount > 0;

    dom.deleteLocationMessage.textContent = blocked
      ? `"${selected.name}" cannot be deleted because it has ${childCount} child location(s) and ${bookCount} book(s) in its subtree.`
      : `Are you sure you want to delete "${selected.name}"? This action cannot be undone.`;

    if (dom.deleteLocationConfirmBtn) {
      dom.deleteLocationConfirmBtn.disabled = blocked;
    }
    if (dom.deleteLocationError) {
      dom.deleteLocationError.classList.add('d-none');
      dom.deleteLocationError.textContent = '';
    }

    bootstrap.Modal.getOrCreateInstance(dom.deleteLocationModal).show();
  };

  const confirmDelete = async () => {
    if (!modalLocationId) return;
    log('Deleting location.', { id: modalLocationId });
    try {
      const response = await apiFetch(`/storagelocation/${modalLocationId}`, {
        method: 'DELETE'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Array.isArray(payload.errors) ? payload.errors : [];
        throw new Error(details.join(' ') || payload.message || 'Delete failed.');
      }
      bootstrap.Modal.getInstance(dom.deleteLocationModal)?.hide();
      if (state.selectedId === modalLocationId) state.selectedId = null;
      await loadLocations();
    } catch (error) {
      errorLog('Delete failed.', error);
      if (dom.deleteLocationError) {
        dom.deleteLocationError.textContent = error.message || 'Unable to delete location.';
        dom.deleteLocationError.classList.remove('d-none');
      }
    }
  };

  const attachListeners = () => {
    if (dom.treeSearchInput) {
      dom.treeSearchInput.addEventListener('input', debounce((event) => {
        state.searchQuery = event.target.value.trim();
        updateUrl();
        renderTree();
      }, 300));
    }

    if (dom.clearTreeSearchBtn) {
      dom.clearTreeSearchBtn.addEventListener('click', () => {
        state.searchQuery = '';
        if (dom.treeSearchInput) dom.treeSearchInput.value = '';
        updateUrl();
        renderTree();
      });
    }

    if (dom.expandAllBtn) {
      dom.expandAllBtn.addEventListener('click', () => {
        state.expandedIds = new Set(state.locations.map((loc) => loc.id));
        saveExpanded();
        renderTree();
      });
    }

    if (dom.collapseAllBtn) {
      dom.collapseAllBtn.addEventListener('click', () => {
        state.expandedIds = new Set();
        saveExpanded();
        renderTree();
      });
    }

    if (dom.addRootBtn) {
      dom.addRootBtn.addEventListener('click', () => {
        openLocationModal({ mode: 'create', locationId: null, parentId: null });
      });
    }

    if (dom.treeContainer) {
      dom.treeContainer.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.dataset.action;
        const id = parseNumber(actionEl.dataset.id);
        if (!id) return;
        if (action === 'toggle') {
          event.stopPropagation();
          if (state.expandedIds.has(id)) {
            state.expandedIds.delete(id);
          } else {
            state.expandedIds.add(id);
          }
          saveExpanded();
          renderTree();
        } else if (action === 'add-child') {
          event.stopPropagation();
          openLocationModal({ mode: 'create', locationId: id, parentId: id });
        } else if (action === 'rename') {
          event.stopPropagation();
          openLocationModal({ mode: 'rename', locationId: id });
        } else if (action === 'move') {
          event.stopPropagation();
          openMoveModal(id);
        } else if (action === 'delete') {
          event.stopPropagation();
          openDeleteModal(id);
        }
      });
    }

    if (dom.locationModalSaveBtn) {
      dom.locationModalSaveBtn.addEventListener('click', saveLocationModal);
    }

    if (dom.moveLocationConfirmBtn) {
      dom.moveLocationConfirmBtn.addEventListener('click', confirmMove);
    }

    if (dom.deleteLocationConfirmBtn) {
      dom.deleteLocationConfirmBtn.addEventListener('click', confirmDelete);
    }

    if (dom.copyPathBtn) {
      dom.copyPathBtn.addEventListener('click', async () => {
        const pathText = dom.locationBreadcrumb?.textContent || '';
        if (!pathText) return;
        try {
          await navigator.clipboard.writeText(pathText.replace(/›/g, '->').replace(/\s+/g, ' ').trim());
        } catch (error) {
          warn('Failed to copy path.', error);
        }
      });
    }

    if (dom.directOnlyBtn) {
      dom.directOnlyBtn.addEventListener('click', () => {
        if (state.includeSubtreeBooks) {
          state.includeSubtreeBooks = false;
          state.booksPage = 1;
          loadBooks();
        }
      });
    }

    if (dom.includeSubtreeBtn) {
      dom.includeSubtreeBtn.addEventListener('click', () => {
        if (!state.includeSubtreeBooks) {
          state.includeSubtreeBooks = true;
          state.booksPage = 1;
          loadBooks();
        }
      });
    }

    if (dom.booksSortSelect) {
      dom.booksSortSelect.addEventListener('change', (event) => {
        const [field, order] = (event.target.value || 'title:asc').split(':');
        state.booksSort = { field: field || 'title', order: order || 'asc' };
        state.booksPage = 1;
        loadBooks();
      });
    }

    if (dom.booksPerPageInput) {
      dom.booksPerPageInput.addEventListener('change', (event) => {
        const raw = parseNumber(event.target.value);
        const clamped = Math.min(50, Math.max(2, raw || state.booksLimit));
        dom.booksPerPageInput.value = clamped;
        state.booksLimit = clamped;
        state.booksPage = 1;
        loadBooks();
      });
    }

    if (dom.addChildBtn) {
      dom.addChildBtn.addEventListener('click', () => {
        if (!state.selectedId) return;
        openLocationModal({ mode: 'create', locationId: state.selectedId, parentId: state.selectedId });
      });
    }

    if (dom.renameBtn) {
      dom.renameBtn.addEventListener('click', () => {
        if (!state.selectedId) return;
        openLocationModal({ mode: 'rename', locationId: state.selectedId });
      });
    }

    if (dom.moveBtn) {
      dom.moveBtn.addEventListener('click', () => {
        if (!state.selectedId) return;
        openMoveModal(state.selectedId);
      });
    }

    if (dom.deleteBtn) {
      dom.deleteBtn.addEventListener('click', () => {
        if (!state.selectedId) return;
        openDeleteModal(state.selectedId);
      });
    }

    if (dom.refreshLocationsBtn) {
      dom.refreshLocationsBtn.addEventListener('click', async () => {
        await loadLocations();
      });
    }
  };

  const init = async () => {
    log('Initializing storage locations page');
    hydrateStateFromUrl();
    loadExpanded();

    if (dom.treeSearchInput) dom.treeSearchInput.value = state.searchQuery;
    if (dom.booksSortSelect) dom.booksSortSelect.value = `${state.booksSort.field}:${state.booksSort.order}`;
    if (dom.booksPerPageInput) dom.booksPerPageInput.value = state.booksLimit;
    updateBooksToggle();

    if (window.rateLimitGuard?.hasReset()) {
      await window.rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: false, rateLimited: true });
      }
      return;
    }

    clearAlerts();
    attachListeners();

    const ok = await loadLocations();

    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve({ success: ok });
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
