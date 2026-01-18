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
    booksPage: 1,
    lastBreadcrumbParts: []
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
    detailsLoadingState: document.getElementById('detailsLoadingState'),
    locationNameHeading: document.getElementById('locationNameHeading'),
    locationNotesHeading: document.getElementById('locationNotesHeading'),
    locationBreadcrumb: document.getElementById('locationBreadcrumb'),
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
    booksSummaryLine: document.getElementById('booksSummaryLine'),
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
  let selectionRequestId = 0;
  let booksRequestId = 0;

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
      nodeWrap.className = `tree-node ${level === 0 ? 'tree-node-root' : ''}`;
      nodeWrap.style.setProperty('--level', level);

      const row = document.createElement('div');
      row.className = `node-row d-flex align-items-center justify-content-between gap-2 ${state.selectedId === loc.id ? 'selected' : ''}`;
      row.setAttribute('data-id', String(loc.id));

      const left = document.createElement('div');
      left.className = 'd-flex align-items-center gap-2 flex-grow-1';

      const caret = document.createElement('button');
      caret.type = 'button';
      caret.className = `btn btn-sm btn-link text-muted p-0 tree-caret ${hasChildren ? '' : 'invisible'}`;
      caret.setAttribute('data-action', 'toggle');
      caret.setAttribute('data-id', String(loc.id));
      caret.innerHTML = isExpanded
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M6.646 2.646a.5.5 0 0 1 .708 0l4.5 4.5a.5.5 0 0 1 0 .708l-4.5 4.5a.5.5 0 0 1-.708-.708L10.293 8 6.646 4.354a.5.5 0 0 1 0-.708"/>
          </svg>`;

      const name = document.createElement('div');
      name.className = 'fw-semibold';
      name.textContent = loc.name || 'Untitled location';

      const badge = document.createElement('span');
      badge.className = 'badge rounded-pill text-bg-light text-dark border tree-count';
      const countValue = Number.isFinite(loc.booksTotalCount) ? loc.booksTotalCount : (Number.isFinite(loc.booksDirectCount) ? loc.booksDirectCount : 0);
      badge.textContent = String(countValue);

      left.appendChild(caret);
      left.appendChild(name);
      left.appendChild(badge);

      const actions = document.createElement('div');
      actions.className = 'node-actions d-flex align-items-center gap-1';
      actions.innerHTML = `
        <button class="btn btn-outline-secondary btn-sm" type="button" data-action="add-child" data-id="${loc.id}" title="Add child">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
            <path d="M8 4a.5.5 0 0 1 .5.5V7.5H12a.5.5 0 0 1 0 1H8.5V12a.5.5 0 0 1-1 0V8.5H4a.5.5 0 0 1 0-1h3.5V4.5A.5.5 0 0 1 8 4"/>
          </svg>
        </button>
        <button class="btn btn-outline-secondary btn-sm" type="button" data-action="rename" data-id="${loc.id}" title="Rename">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16">
            <path d="M12.146.146a.5.5 0 0 1 .708 0l2.999 2.999a.5.5 0 0 1 0 .708l-9.5 9.5a.5.5 0 0 1-.168.11l-4 1.333a.5.5 0 0 1-.633-.633l1.333-4a.5.5 0 0 1 .11-.168z"/>
            <path d="M11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207z"/>
          </svg>
        </button>
        <button class="btn btn-outline-secondary btn-sm" type="button" data-action="move" data-id="${loc.id}" title="Move">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-arrows-move" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M7.646.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 1.707V6.5h4.793l-1.147-1.146a.5.5 0 0 1 .708-.708l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L13.293 8.5H8.5v4.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7.5 13.293V8.5H2.707l1.147 1.146a.5.5 0 0 1-.708.708l-2-2a.5.5 0 0 1 0-.708l2-2a.5.5 0 0 1 .708.708L2.707 7.5H7.5V2.707L6.354 3.854a.5.5 0 1 1-.708-.708z"/>
          </svg>
        </button>
        <button class="btn btn-outline-danger btn-sm" type="button" data-action="delete" data-id="${loc.id}" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v7a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v7a.5.5 0 0 0 1 0z"/>
            <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1z"/>
          </svg>
        </button>
      `;

      row.appendChild(left);
      row.appendChild(actions);
      row.addEventListener('click', (event) => {
        if (event.target.closest('[data-action=\"toggle\"]')) return;
        if (event.target.closest('.node-actions')) return;
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

  const buildBreadcrumbParts = (location) => {
    const parts = [];
    let current = location;
    while (current) {
      parts.unshift({ id: current.id, name: current.name || 'Untitled location' });
      current = state.locations.find((loc) => loc.id === current.parentId);
    }
    return parts;
  };

  const renderBreadcrumb = (location) => {
    if (!dom.locationBreadcrumb) return;
    dom.locationBreadcrumb.innerHTML = '';
    if (!location) {
      dom.locationBreadcrumb.innerHTML = '<li class="breadcrumb-item text-muted">No path available.</li>';
      return;
    }
    const parts = buildBreadcrumbParts(location);
    state.lastBreadcrumbParts = parts.map((part) => part.name);
    parts.forEach((part, index) => {
      const li = document.createElement('li');
      li.className = `breadcrumb-item${index === parts.length - 1 ? ' active' : ''}`;
      if (index === parts.length - 1) {
        li.textContent = part.name;
      } else {
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'btn btn-link btn-sm p-0 text-decoration-none';
        link.textContent = part.name;
        link.addEventListener('click', () => selectLocation(part.id, { openPanel: true }));
        li.appendChild(link);
      }
      dom.locationBreadcrumb.appendChild(li);
    });
  };

  const renderDetails = (location, stats) => {
    if (!dom.detailsContent || !dom.detailsEmptyState) return;
    if (!location) {
      dom.detailsContent.classList.add('d-none');
      dom.detailsEmptyState.classList.remove('d-none');
      if (dom.detailsLoadingState) dom.detailsLoadingState.classList.add('d-none');
      return;
    }
    dom.detailsEmptyState.classList.add('d-none');
    dom.detailsContent.classList.remove('d-none');
    if (dom.detailsLoadingState) dom.detailsLoadingState.classList.add('d-none');

    const notesLine = location.notes ? location.notes.trim() : '';

    if (dom.locationNameHeading) dom.locationNameHeading.textContent = location.name || 'Untitled location';
    if (dom.locationNotesHeading) {
      if (notesLine) {
        dom.locationNotesHeading.textContent = notesLine;
        dom.locationNotesHeading.classList.remove('d-none');
      } else {
        dom.locationNotesHeading.textContent = '';
        dom.locationNotesHeading.classList.add('d-none');
      }
    }

    renderBreadcrumb(location);

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

  const showDetailsLoading = () => {
    if (dom.detailsEmptyState) dom.detailsEmptyState.classList.add('d-none');
    if (dom.detailsContent) dom.detailsContent.classList.add('d-none');
    if (dom.detailsLoadingState) dom.detailsLoadingState.classList.remove('d-none');
    if (dom.booksSummaryLine) dom.booksSummaryLine.textContent = '';
    if (dom.booksTableBody) dom.booksTableBody.innerHTML = '';
    if (dom.booksEmptyState) dom.booksEmptyState.classList.add('d-none');
    if (dom.booksPaginationNav) dom.booksPaginationNav.innerHTML = '';
    if (dom.booksPaginationInfo) dom.booksPaginationInfo.textContent = '';
  };

  const renderBooks = (books) => {
    if (!dom.booksTableBody) return;
    dom.booksTableBody.innerHTML = '';

    if (dom.booksSummaryLine) {
      dom.booksSummaryLine.textContent = `${books.length} book${books.length === 1 ? '' : 's'} shown`;
    }

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
      const authorNames = Array.isArray(book.authors)
        ? book.authors.map((author) => author.authorName || author.displayName || author.name).filter(Boolean)
        : [];
      const visibleAuthors = authorNames.slice(0, 2);
      const authorsExtra = Math.max(authorNames.length - visibleAuthors.length, 0);
      const authorsLabel = visibleAuthors.join(', ') + (authorsExtra ? `, +${authorsExtra} more` : '');
      const authorsTitle = authorsExtra ? ` title="${escapeHtml(authorNames.join(', '))}"` : '';
      const languageNames = Array.isArray(book.languages) ? book.languages.map((lang) => lang.name).filter(Boolean) : [];
      const visibleLanguages = languageNames.slice(0, 2);
      const languageExtra = Math.max(languageNames.length - visibleLanguages.length, 0);
      const languageLabel = visibleLanguages.join(', ') + (languageExtra ? `, +${languageExtra} more` : '');
      const languageTitle = languageExtra ? ` title="${escapeHtml(languageNames.join(', '))}"` : '';
      const tags = Array.isArray(book.tags) ? book.tags : [];
      const visibleTags = tags.slice(0, 3);
      const remainingTags = Math.max(tags.length - visibleTags.length, 0);
      const published = formatPartialDate(book.publicationDate) || '—';
      const bookType = book.bookType?.name || book.bookTypeName || '—';

      row.innerHTML = `
        <td class="list-col-book">
          <div class="d-flex align-items-center gap-3">
            <img src="${cover}" alt="${escapeHtml(book.title || 'Book cover')}" class="cover-thumb" />
            <div>
              <div class="fw-semibold">${escapeHtml(book.title || 'Untitled')}</div>
              ${subtitle}
              <div class="text-muted small list-meta-mobile">${escapeHtml(authorsLabel)} • ${escapeHtml(published)}</div>
            </div>
          </div>
        </td>
        <td class="list-col-authors"><span class="text-muted"${authorsTitle}>${escapeHtml(authorsLabel || '—')}</span></td>
        <td class="list-col-type"><span class="text-muted">${escapeHtml(bookType)}</span></td>
        <td class="list-col-language"><span class="text-muted"${languageTitle}>${escapeHtml(languageLabel || '—')}</span></td>
        <td class="list-col-published"><span class="text-muted">${escapeHtml(published)}</span></td>
        <td class="list-col-tags">${visibleTags.map((tag) => `<span class="badge rounded-pill text-bg-light text-dark border">${escapeHtml(tag.name)}</span>`).join(' ')}${remainingTags > 0 ? ` <span class="badge rounded-pill text-bg-light text-dark border">+${remainingTags}</span>` : ''}</td>
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

    dom.booksPaginationNav.appendChild(createItem(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-left" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M15 8a.5.5 0 0 1-.5.5H2.707l3.147 3.146a.5.5 0 0 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 7.5H14.5A.5.5 0 0 1 15 8"/>
      </svg>`,
      state.booksPage <= 1,
      () => {
        state.booksPage = Math.max(1, state.booksPage - 1);
        loadBooks({ showLoadingRow: true });
      },
      'Previous page'
    ));

    if (state.booksPage > 2) {
      dom.booksPaginationNav.appendChild(createItem('1', false, () => {
        state.booksPage = 1;
        loadBooks({ showLoadingRow: true });
      }));
      if (state.booksPage > 3) {
        const ellipsis = document.createElement('li');
        ellipsis.className = 'page-item disabled';
        const span = document.createElement('span');
        span.className = 'page-link';
        span.textContent = '…';
        ellipsis.appendChild(span);
        dom.booksPaginationNav.appendChild(ellipsis);
      }
    }

    if (state.booksPage > 1) {
      dom.booksPaginationNav.appendChild(createItem(String(state.booksPage - 1), false, () => {
        state.booksPage -= 1;
        loadBooks({ showLoadingRow: true });
      }));
    }

    const current = document.createElement('li');
    current.className = 'page-item active';
    const span = document.createElement('span');
    span.className = 'page-link';
    span.textContent = String(state.booksPage);
    current.appendChild(span);
    dom.booksPaginationNav.appendChild(current);

    if (hasNextPage) {
      dom.booksPaginationNav.appendChild(createItem(String(state.booksPage + 1), false, () => {
        state.booksPage += 1;
        loadBooks({ showLoadingRow: true });
      }));
    }

    dom.booksPaginationNav.appendChild(createItem(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8"/>
      </svg>`,
      !hasNextPage,
      () => {
        state.booksPage += 1;
        loadBooks({ showLoadingRow: true });
      },
      'Next page'
    ));
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

  const loadBooks = async ({ showLoadingRow = false, render = true } = {}) => {
    if (!state.selectedId) return null;
    updateUrl();
    updateBooksToggle();

    if (showLoadingRow && dom.booksTableBody) {
      dom.booksTableBody.innerHTML = '<tr><td colspan="6" class="text-muted py-3">Loading books…</td></tr>';
    }

    const body = buildBooksBody();
    debugLog('Requesting /book/list with JSON body', body);

    const requestId = ++booksRequestId;

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
        return null;
      }

      const books = payload.data?.books || [];
      const hasNextPage = books.length === state.booksLimit;
      if (requestId === booksRequestId && render) {
        renderBooks(books);
        renderBooksPagination(hasNextPage);
      }
      return { books, hasNextPage };
    } catch (error) {
      errorLog('Book list fetch failed', error);
      showAlert({ message: 'Unable to load books for this location.', details: [error.message] });
      return null;
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

    const requestId = ++selectionRequestId;
    showDetailsLoading();

    const [detailPayload, booksPayload] = await Promise.all([
      loadLocationDetails(locationId),
      loadBooks({ showLoadingRow: false, render: false })
    ]);

    if (requestId !== selectionRequestId) return;

    renderDetails(location, detailPayload?.stats || null);
    if (booksPayload && booksPayload.books) {
      renderBooks(booksPayload.books);
      renderBooksPagination(booksPayload.hasNextPage);
    } else {
      renderBooks([]);
      renderBooksPagination(false);
    }

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

  const openLocationModal = ({ mode, locationId = null }) => {
    if (mode !== 'rename') return;
    locationModalMode = mode;
    modalLocationId = locationId;
    const selected = state.locations.find((loc) => loc.id === locationId);
    const selectedParent = selected?.parentId ? state.locations.find((loc) => loc.id === selected.parentId) : null;

    if (dom.locationModalTitle) dom.locationModalTitle.textContent = 'Rename Location';
    if (dom.locationNameInput) dom.locationNameInput.value = selected?.name || '';
    if (dom.locationNotesInput) dom.locationNotesInput.value = selected?.notes || '';
    if (dom.locationParentLabel) {
      dom.locationParentLabel.value = selected?.parentId ? (selectedParent?.name || 'Parent') : 'Root location';
    }
    if (dom.locationModalError) {
      dom.locationModalError.classList.add('d-none');
      dom.locationModalError.textContent = '';
    }

    if (dom.locationModal) {
      bootstrap.Modal.getOrCreateInstance(dom.locationModal).show();
    }
  };

  const openSharedLocationModal = (parentId = null) => {
    window.sharedAddModalsConfig = window.sharedAddModalsConfig || {};
    window.sharedAddModalsConfig.defaultLocationParentId = parentId || null;
    window.sharedAddModals?.open('location');
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
      if (locationModalMode !== 'rename' || !modalLocationId) return;
      const current = state.locations.find((loc) => loc.id === modalLocationId);
      if (current && (current.parentId === null || current.parentId === undefined)) {
        const duplicate = state.locations.some((loc) => loc.id !== modalLocationId
          && (loc.parentId === null || loc.parentId === undefined)
          && loc.name
          && loc.name.trim().toLowerCase() === name.toLowerCase());
        if (duplicate) {
          if (dom.locationModalError) {
            dom.locationModalError.textContent = 'A base storage location with this name already exists.';
            dom.locationModalError.classList.remove('d-none');
          }
          return;
        }
      }
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
        openSharedLocationModal(null);
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
          openSharedLocationModal(id);
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
        const pathText = state.lastBreadcrumbParts.length ? state.lastBreadcrumbParts.join(' > ') : '';
        if (!pathText) return;
        try {
          await navigator.clipboard.writeText(pathText);
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
          loadBooks({ showLoadingRow: true });
        }
      });
    }

    if (dom.includeSubtreeBtn) {
      dom.includeSubtreeBtn.addEventListener('click', () => {
        if (!state.includeSubtreeBooks) {
          state.includeSubtreeBooks = true;
          state.booksPage = 1;
          loadBooks({ showLoadingRow: true });
        }
      });
    }

    if (dom.booksSortSelect) {
      dom.booksSortSelect.addEventListener('change', (event) => {
        const [field, order] = (event.target.value || 'title:asc').split(':');
        state.booksSort = { field: field || 'title', order: order || 'asc' };
        state.booksPage = 1;
        loadBooks({ showLoadingRow: true });
      });
    }

    if (dom.booksPerPageInput) {
      dom.booksPerPageInput.addEventListener('change', (event) => {
        const raw = parseNumber(event.target.value);
        const clamped = Math.min(50, Math.max(2, raw || state.booksLimit));
        dom.booksPerPageInput.value = clamped;
        state.booksLimit = clamped;
        state.booksPage = 1;
        loadBooks({ showLoadingRow: true });
      });
    }

    if (dom.addChildBtn) {
      dom.addChildBtn.addEventListener('click', () => {
        if (!state.selectedId) return;
        openSharedLocationModal(state.selectedId);
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

    window.sharedAddModalsConfig = window.sharedAddModalsConfig || {};
    window.sharedAddModalsConfig.getLocations = async () => {
      if (!state.locations.length) {
        await loadLocations();
      }
      return state.locations;
    };
    const sharedEvents = window.sharedAddModals?.events;
    if (sharedEvents) {
      sharedEvents.addEventListener('location:created', async (event) => {
        await loadLocations();
        if (event?.detail?.id) {
          await selectLocation(event.detail.id, { openPanel: true });
        }
      });
    }

    const ok = await loadLocations();

    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve({ success: ok });
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
