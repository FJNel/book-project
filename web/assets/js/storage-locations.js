// Storage Locations page logic: tree browsing, CRUD, and book list by location.
(function () {
  const log = (...args) => console.log('[StorageLocations]', ...args);
  const warn = (...args) => console.warn('[StorageLocations]', ...args);
  const errorLog = (...args) => console.error('[StorageLocations]', ...args);
  const debugLog = (...args) => console.log('[StorageLocations][debug]', ...args);

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
    lastBreadcrumbParts: [],
    forms: {
      add: { parentId: null, locked: false },
      edit: { locationId: null, initialName: '', initialNotes: '', locked: false },
      move: { locationId: null, initialParentId: null, initialParentLabel: '', locked: false },
      delete: { locationId: null, locked: false }
    }
  };

  const dom = {
    treeContainer: document.getElementById('treeContainer'),
    treeEmptyState: document.getElementById('treeEmptyState'),
    treeSearchInput: document.getElementById('treeSearchInput'),
    clearTreeSearchBtn: document.getElementById('clearTreeSearchBtn'),
    expandAllBtn: document.getElementById('expandAllBtn'),
    collapseAllBtn: document.getElementById('collapseAllBtn'),
    addRootBtn: document.getElementById('addRootBtn'),
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
    editBtn: document.getElementById('editBtn'),
    moveBtn: document.getElementById('moveBtn'),
    deleteBtn: document.getElementById('deleteBtn'),
    feedbackContainer: document.getElementById('feedbackContainer'),
    headerActions: document.getElementById('headerActions'),
    // Add modal
    addLocationModal: document.getElementById('addLocationModal'),
    addNameInput: document.getElementById('addNameInput'),
    addNameHelp: document.getElementById('addNameHelp'),
    addNotesInput: document.getElementById('addNotesInput'),
    addNotesHelp: document.getElementById('addNotesHelp'),
    addParentLine: document.getElementById('addParentLine'),
    addLocationError: document.getElementById('addLocationError'),
    addLocationSaveBtn: document.getElementById('addLocationSaveBtn'),
    // Edit modal
    editLocationModal: document.getElementById('editLocationModal'),
    editNameInput: document.getElementById('editNameInput'),
    editNameHelp: document.getElementById('editNameHelp'),
    editNotesInput: document.getElementById('editNotesInput'),
    editNotesHelp: document.getElementById('editNotesHelp'),
    editChangesSummary: document.getElementById('editChangesSummary'),
    editLocationError: document.getElementById('editLocationError'),
    editLocationSaveBtn: document.getElementById('editLocationSaveBtn'),
    // Move modal
    moveLocationModal: document.getElementById('moveLocationModal'),
    moveLocationSelect: document.getElementById('moveLocationSelect'),
    moveLocationHelp: document.getElementById('moveLocationHelp'),
    moveLocationError: document.getElementById('moveLocationError'),
    moveSummaryText: document.getElementById('moveSummaryText'),
    moveChangesSummary: document.getElementById('moveChangesSummary'),
    moveLocationConfirmBtn: document.getElementById('moveLocationConfirmBtn'),
    // Delete modal
    deleteLocationModal: document.getElementById('deleteLocationModal'),
    deleteLocationMessage: document.getElementById('deleteLocationMessage'),
    deleteImpactNote: document.getElementById('deleteImpactNote'),
    deleteConfirmInput: document.getElementById('deleteConfirmInput'),
    deleteLocationError: document.getElementById('deleteLocationError'),
    deleteLocationConfirmBtn: document.getElementById('deleteLocationConfirmBtn')
  };

  const attachButtonSpinner = (button) => {
    if (!button) return null;
    const spinner = button.querySelector('.spinner-border');
    const label = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)?.textContent?.trim() || '';
    return { spinner, label: label || button.textContent.trim() };
  };

  const setButtonLoading = (button, spinnerObj, isLoading) => {
    if (!button || !spinnerObj) return;
    if (spinnerObj.spinner) spinnerObj.spinner.classList.toggle('d-none', !isLoading);
    button.disabled = isLoading;
  };

  const toggleDisabled = (elements, disabled) => {
    if (!elements) return;
    elements.forEach((el) => { if (el) el.disabled = disabled; });
  };

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

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const describeChange = (fieldLabel, fromValue, toValue) => {
    const from = (fromValue || '').trim();
    const to = (toValue || '').trim();
    if (from === to) return null;
    if (!from && to) return `Adding ${fieldLabel}: '${to}'.`;
    if (from && !to) return `Clearing ${fieldLabel} (was '${from}').`;
    return `Changing ${fieldLabel} from '${from}' to '${to}'.`;
  };

  const renderInlineError = (alertEl, message, errors) => {
    if (!alertEl) return;
    const safeErrors = Array.isArray(errors) ? errors.filter(Boolean) : [];
    if (typeof window.renderApiErrorAlert === 'function') {
      window.renderApiErrorAlert(alertEl, { message, errors: safeErrors }, message);
    } else {
      alertEl.textContent = `${message}${safeErrors.length ? `: ${safeErrors.join(' ')}` : ''}`;
      alertEl.classList.remove('d-none');
    }
    alertEl.classList.remove('d-none');
  };

  const extractAuthorNames = (book) => {
    if (!book) return [];
    if (Array.isArray(book.authors)) {
      return book.authors
        .map((author) => author?.authorName || author?.displayName || author?.name || author?.fullName || author)
        .filter(Boolean);
    }
    if (Array.isArray(book.authorNames)) return book.authorNames.filter(Boolean);
    if (typeof book.authorName === 'string') return [book.authorName];
    if (typeof book.author === 'string') return [book.author];
    return [];
  };

  const isSmallScreen = () => window.matchMedia('(max-width: 767.98px)').matches;

  const cleanupBackdrops = () => {
    const backdrops = Array.from(document.querySelectorAll('.offcanvas-backdrop, .modal-backdrop'));
    const hasOffcanvas = Boolean(document.querySelector('.offcanvas.show'));
    const hasModal = Boolean(document.querySelector('.modal.show'));
    let removed = 0;
    backdrops.forEach((backdrop) => {
      if (!hasOffcanvas && !hasModal) {
        backdrop.remove();
        removed += 1;
      }
    });
    log(`Backdrop cleanup complete (count=${removed})`);
  };

  const syncDetailsPanel = (openPanel) => {
    if (!dom.detailsOffcanvas) {
      cleanupBackdrops();
      return;
    }
    const instance = bootstrap.Offcanvas.getInstance(dom.detailsOffcanvas);
    if (openPanel && isSmallScreen()) {
      if (!dom.detailsOffcanvas.classList.contains('show')) {
        bootstrap.Offcanvas.getOrCreateInstance(dom.detailsOffcanvas).show();
      }
      return;
    }
    if (instance) instance.hide();
    cleanupBackdrops();
  };

  const placeholderCover = (title) => {
    const text = encodeURIComponent(title || 'Book Cover');
    return `https://placehold.co/120x180?text=${text}&font=Lora`;
  };

  const formatPartialDate = (date) => {
    if (!date) return null;
    if (date.text) return date.text;
    const parts = [];
    if (date.day) parts.push(String(date.day));
    if (date.month) parts.push(new Date(2000, date.month - 1, 1).toLocaleString(undefined, { month: 'long' }));
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
    const detailList = Array.isArray(details) && details.length
      ? `<ul class="mb-1 small text-muted">${details.map((err) => `<li>${escapeHtml(err)}</li>`).join('')}</ul>`
      : '';
    alert.innerHTML = `
      <div class="fw-semibold mb-1">${escapeHtml(message || 'Something went wrong.')}</div>
      ${detailList}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    dom.feedbackContainer.innerHTML = '';
    dom.feedbackContainer.appendChild(alert);
  };

  const clearAlerts = () => {
    if (dom.feedbackContainer) dom.feedbackContainer.innerHTML = '';
  };

  const setModalLocked = (modalEl, locked) => {
    if (!modalEl) return;
    const closeButtons = modalEl.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
    closeButtons.forEach((btn) => { btn.disabled = locked; });
  };

  const showModal = async (target, options) => {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    bootstrap.Modal.getOrCreateInstance(element, options || {}).show();
  };

  const hideModal = async (target) => {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    const instance = bootstrap.Modal.getInstance(element);
    if (instance) instance.hide();
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
      caret.innerHTML = isExpanded ? '<i class="bi bi-chevron-down"></i>' : '<i class="bi bi-chevron-right"></i>';

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

      row.appendChild(left);
      row.addEventListener('click', (event) => {
        if (event.target.closest('[data-action="toggle"]')) return;
        selectLocation(loc.id, { openPanel: true });
      });

      caret.addEventListener('click', (event) => {
        event.stopPropagation();
        if (state.expandedIds.has(loc.id)) {
          state.expandedIds.delete(loc.id);
        } else {
          state.expandedIds.add(loc.id);
        }
        saveExpanded();
        renderTree();
      });

      nodeWrap.appendChild(row);
      dom.treeContainer.appendChild(nodeWrap);

      if (hasChildren && isExpanded) {
        childrenMap.get(loc.id).forEach((child) => renderNode(child, level + 1));
      }
    };

    (childrenMap.get('root') || []).forEach((root) => renderNode(root, 0));
  };

  const getBookSortOptions = () => {
    if (!state.includeSubtreeBooks) return [
      { value: 'title:asc', label: 'Title A to Z' },
      { value: 'title:desc', label: 'Title Z to A' },
      { value: 'published_date:desc', label: 'Newest published' },
      { value: 'published_date:asc', label: 'Oldest published' },
      { value: 'added_at:desc', label: 'Newest added' },
      { value: 'added_at:asc', label: 'Oldest added' }
    ];
    return [
      { value: 'title:asc', label: 'Title A to Z' },
      { value: 'title:desc', label: 'Title Z to A' },
      { value: 'books_count:desc', label: 'Most books' },
      { value: 'books_count:asc', label: 'Fewest books' },
      { value: 'published_date:desc', label: 'Newest published' },
      { value: 'published_date:asc', label: 'Oldest published' },
      { value: 'added_at:desc', label: 'Newest added' },
      { value: 'added_at:asc', label: 'Oldest added' }
    ];
  };

  const populateSortSelect = () => {
    if (!dom.booksSortSelect) return;
    const options = getBookSortOptions();
    dom.booksSortSelect.innerHTML = options
      .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
      .join('');
    const currentValue = `${state.booksSort.field}:${state.booksSort.order}`;
    const hasValue = options.some((opt) => opt.value === currentValue);
    dom.booksSortSelect.value = hasValue ? currentValue : options[0].value;
  };

  const renderBooksTable = (result) => {
    if (!dom.booksTableBody || !dom.booksEmptyState || !dom.booksPaginationNav || !dom.booksPaginationInfo) return;
    const books = result?.data?.books || [];
    dom.booksTableBody.innerHTML = '';
    if (!books.length) {
      dom.booksEmptyState.classList.remove('d-none');
      dom.booksPaginationNav.classList.add('d-none');
      dom.booksPaginationInfo.textContent = '0 books';
      return;
    }
    dom.booksEmptyState.classList.add('d-none');
    const total = result.data.total || books.length;
    const page = result.data.page || 1;
    const limit = result.data.limit || books.length;
    const start = (page - 1) * limit + 1;
    const end = Math.min(start + books.length - 1, total);
    dom.booksPaginationInfo.textContent = `${start} to ${end} of ${total}`;

    books.forEach((book) => {
      const coverUrl = book.coverImageUrl || book.cover_url || placeholderCover(book.title);
      const publication = formatPartialDate(book.publicationDate || book.published_date) || '';
      const bookType = book.bookTypeName || book.bookType?.name || '';
      const languageNames = Array.isArray(book.languages) && book.languages.length > 0
        ? book.languages.map((lang) => lang?.name || lang).filter(Boolean)
        : [];
      const languageLabel = languageNames.slice(0, 2).join(', ') + (languageNames.length > 2 ? `, +${languageNames.length - 2} more` : '');
      const authorNames = extractAuthorNames(book);
      const authorsText = authorNames.length
        ? authorNames.slice(0, 2).join(', ') + (authorNames.length > 2 ? `, +${authorNames.length - 2} more` : '')
        : '';
      const authorsTitle = authorNames.length > 2 ? ` title="${escapeHtml(authorNames.join(', '))}"` : '';
      const tags = Array.isArray(book.tags) ? book.tags : [];
      const visibleTags = tags.slice(0, 3);
      const remainingTags = Math.max(tags.length - visibleTags.length, 0);

      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.addEventListener('click', (event) => {
        if (event.target.closest('a, button, [data-no-row-nav]')) return;
        window.location.href = `book-details?id=${book.id}`;
      });

      row.innerHTML = `
        <td class="list-col-book">
          <div class="d-flex align-items-center gap-3">
            <img class="cover-thumb rounded border" alt="Cover" src="${escapeHtml(coverUrl)}" onerror="this.onerror=null;this.src='${placeholderCover(book.title)}';" />
            <div style="min-width: 220px;">
              <div class="fw-semibold meta-line">${escapeHtml(book.title || 'Untitled')}</div>
              <div class="text-muted small meta-line ${authorsText ? '' : 'd-none'}">by ${escapeHtml(authorsText)}</div>
            </div>
          </div>
        </td>
        <td class="list-col-authors"${authorsTitle}>${escapeHtml(authorsText)}</td>
        <td class="list-col-type">${escapeHtml(bookType)}</td>
        <td class="list-col-language">${escapeHtml(languageLabel)}</td>
        <td class="list-col-published">${escapeHtml(publication)}</td>
        <td class="list-col-tags">${visibleTags.map((tag) => `<span class=\"badge rounded-pill text-bg-light text-dark border\">${escapeHtml(tag?.name || tag)}</span>`).join(' ')}${remainingTags > 0 ? ` <span class=\"badge rounded-pill text-bg-light text-dark border\">+${remainingTags}</span>` : ''}</td>
      `;

      dom.booksTableBody.appendChild(row);
    });

    const totalPages = Math.max(1, Math.ceil(total / (result.data.limit || 10)));
    dom.booksPaginationNav.classList.toggle('d-none', totalPages <= 1);
    dom.booksPaginationNav.innerHTML = '';

    const createPageItem = (pageNumber, label = null, disabled = false, active = false) => {
      const li = document.createElement('li');
      li.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
      const a = document.createElement('a');
      a.className = 'page-link';
      a.href = '#';
      a.textContent = label || pageNumber;
      a.addEventListener('click', (event) => {
        event.preventDefault();
        if (disabled || active) return;
        state.booksPage = pageNumber;
        updateUrl();
        fetchBooksForLocation(state.selectedId);
      });
      li.appendChild(a);
      return li;
    };

    const prevDisabled = page <= 1;
    dom.booksPaginationNav.appendChild(createPageItem(page - 1, 'Previous', prevDisabled));

    const maxPagesToShow = 7;
    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    for (let p = startPage; p <= endPage; p += 1) {
      dom.booksPaginationNav.appendChild(createPageItem(p, null, false, p === page));
    }

    const nextDisabled = page >= totalPages;
    dom.booksPaginationNav.appendChild(createPageItem(page + 1, 'Next', nextDisabled));
  };

  const renderBreadcrumb = (loc) => {
    if (!dom.locationBreadcrumb || !loc) return;
    const parts = (loc.path || '').split('->').map((part) => part.trim()).filter(Boolean);
    dom.locationBreadcrumb.innerHTML = parts.map((part) => `<span class="badge text-bg-light border text-dark me-1">${escapeHtml(part)}</span>`).join('');
    dom.copyPathBtn?.classList.remove('d-none');
    state.lastBreadcrumbParts = parts;
  };

  const renderDetails = (loc) => {
    if (!dom.detailsContent || !dom.detailsEmptyState || !dom.detailsLoadingState) return;
    if (!loc) {
      dom.detailsContent.classList.add('d-none');
      dom.detailsEmptyState.classList.remove('d-none');
      dom.detailsLoadingState.classList.add('d-none');
      return;
    }
    dom.detailsContent.classList.remove('d-none');
    dom.detailsEmptyState.classList.add('d-none');
    dom.detailsLoadingState.classList.add('d-none');

    dom.locationNameHeading.textContent = loc.name || 'Untitled location';
    dom.locationNotesHeading.textContent = loc.notes || 'No notes yet';
    renderBreadcrumb(loc);

    dom.booksDirectStat.textContent = Number.isFinite(loc.booksDirectCount) ? loc.booksDirectCount : '0';
    dom.booksTotalStat.textContent = Number.isFinite(loc.booksTotalCount) ? loc.booksTotalCount : '0';
    dom.childrenCountStat.textContent = Number.isFinite(loc.childrenCount) ? loc.childrenCount : '0';

    const createdText = formatTimestamp(loc.createdAt || loc.created_at);
    const updatedText = formatTimestamp(loc.updatedAt || loc.updated_at);
    if (dom.locationTimestampLine) {
      dom.locationTimestampLine.textContent = createdText || updatedText
        ? `Created ${createdText || '-'} | Updated ${updatedText || '-'}`
        : '';
    }

    const summaryText = state.includeSubtreeBooks
      ? 'Showing books in this location and all children.'
      : 'Showing books directly in this location.';
    dom.booksSummaryLine.textContent = summaryText;

    toggleDisabled([dom.addChildBtn, dom.editBtn, dom.moveBtn, dom.deleteBtn], !loc.id);
  };

  const syncToggleButtons = () => {
    if (!dom.directOnlyBtn || !dom.includeSubtreeBtn) return;
    dom.directOnlyBtn.classList.toggle('active', !state.includeSubtreeBooks);
    dom.includeSubtreeBtn.classList.toggle('active', state.includeSubtreeBooks);
  };

  const refreshBooksControls = () => {
    if (dom.booksPerPageInput) dom.booksPerPageInput.value = String(state.booksLimit);
    populateSortSelect();
    dom.booksSortSelect.value = `${state.booksSort.field}:${state.booksSort.order}`;
    syncToggleButtons();
  };

  const updateHeaderActions = (loc) => {
    const disabled = !loc;
    toggleDisabled([dom.addChildBtn, dom.editBtn, dom.moveBtn, dom.deleteBtn], disabled);
  };

  const apiFetch = window.apiFetch || window.fetch;

  const fetchLocations = async () => {
    try {
      dom.treeContainer?.classList.add('opacity-50');
      const response = await apiFetch('/storagelocation/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeCounts: true, limit: 200 })
      });
      if (await handleRateLimit(response)) return;
      if (!response.ok) throw response;
      const result = await response.json();
      state.locations = result.data?.storageLocations || [];
      log('Loaded locations:', state.locations.length);
      renderTree();
      if (state.selectedId) {
        const selected = state.locations.find((loc) => loc.id === state.selectedId);
        if (selected) {
          setSelectedLocation(selected.id);
          syncDetailsPanel(true);
        } else {
          state.selectedId = null;
          updateUrl();
          if (dom.detailsEmptyState) dom.detailsEmptyState.textContent = 'Selected location not found.';
          renderDetails(null);
          updateHeaderActions(null);
        }
      }
      dom.treeContainer?.classList.remove('opacity-50');
    } catch (err) {
      errorLog('Failed to load locations', err);
      showAlert({ message: 'Failed to load storage locations', type: 'danger' });
      dom.treeContainer?.classList.remove('opacity-50');
    }
  };

  const fetchLocationDetails = async (locationId, { keepSpinner } = {}) => {
    if (!locationId) return null;
    try {
      dom.detailsLoadingState?.classList.remove('d-none');
      dom.detailsContent?.classList.add('d-none');
      dom.detailsEmptyState?.classList.add('d-none');

      const response = await apiFetch(`/storagelocation?id=${locationId}&returnStats=true`);
      if (await handleRateLimit(response)) return null;
      if (!response.ok) throw response;
      const result = await response.json();
      return result?.data || null;
    } catch (err) {
      errorLog('Failed to load location details', err);
      showAlert({ message: 'Failed to load location', type: 'danger' });
      return null;
    } finally {
      if (!keepSpinner) dom.detailsLoadingState?.classList.add('d-none');
    }
  };

  const fetchBooksForLocation = async (locationId) => {
    if (!locationId) return;
    try {
      clearAlerts();
      dom.booksTableBody?.classList.add('opacity-50');
      dom.booksEmptyState?.classList.add('d-none');

      const params = new URLSearchParams();
      params.set('includeSubtree', state.includeSubtreeBooks ? 'true' : 'false');
      params.set('sort', `${state.booksSort.field}:${state.booksSort.order}`);
      params.set('page', String(state.booksPage));
      params.set('limit', String(state.booksLimit));

      const sortMap = {
        title: 'title',
        books_count: 'title',
        published_date: 'publicationDate',
        added_at: 'createdAt'
      };
      const mappedSort = sortMap[state.booksSort.field] || 'title';
      const apiParams = new URLSearchParams();
      apiParams.set('filterStorageLocationId', String(locationId));
      apiParams.set('includeSubtree', state.includeSubtreeBooks ? 'true' : 'false');
      apiParams.set('sortBy', mappedSort);
      apiParams.set('order', state.booksSort.order || 'asc');
      apiParams.set('limit', String(state.booksLimit));
      apiParams.set('offset', String((state.booksPage - 1) * state.booksLimit));

      const response = await apiFetch(`/book?${apiParams.toString()}`);
      if (await handleRateLimit(response)) return;
      if (!response.ok) throw response;
      const result = await response.json();
      renderBooksTable(result);
    } catch (err) {
      errorLog('Failed to load books for location', err);
      showAlert({ message: 'Failed to load books for this location', type: 'danger' });
    } finally {
      dom.booksTableBody?.classList.remove('opacity-50');
    }
  };

  const setSelectedLocation = (locationId) => {
    log('Selected location', locationId);
    state.selectedId = locationId;
    updateUrl();
    const selected = state.locations.find((loc) => loc.id === locationId);
    renderDetails(selected || null);
    updateHeaderActions(selected || null);
    renderTree();
    if (selected) fetchBooksForLocation(locationId);
  };

  const selectLocation = async (locationId, { openPanel } = {}) => {
    if (!locationId) return;
    log(`Selecting location ${locationId}`);
    if (state.selectedId !== locationId) {
      setSelectedLocation(locationId);
    }
    if (openPanel) {
      syncDetailsPanel(true);
    } else {
      cleanupBackdrops();
    }
  };

  const populateMoveOptions = (excludeId = null) => {
    if (!dom.moveLocationSelect) return;
    const { byId, childrenMap } = buildLocationMaps();
    const options = [];

    const traverse = (loc, depth) => {
      if (excludeId && loc.id === excludeId) return;
      options.push({ id: loc.id, label: `${'- '.repeat(depth)}${loc.name}` });
      (childrenMap.get(loc.id) || []).forEach((child) => traverse(child, depth + 1));
    };

    (childrenMap.get('root') || []).forEach((root) => traverse(root, 0));

    dom.moveLocationSelect.innerHTML = '<option value="">Select new parent</option>' + options.map((opt) => `<option value="${opt.id}">${escapeHtml(opt.label)}</option>`).join('');
  };

  const resetFormErrors = () => {
    [dom.addLocationError, dom.editLocationError, dom.moveLocationError, dom.deleteLocationError].forEach((el) => {
      if (el) {
        el.classList.add('d-none');
        el.textContent = '';
      }
    });
  };

  const validateName = (input, helpEl) => {
    if (!input) return false;
    const value = input.value.trim();
    const errors = [];
    if (!window.validators?.isValidName(value)) {
      errors.push('Name must be at least 2 characters.');
    }
    if (errors.length) {
      helpEl?.classList.remove('text-muted');
      helpEl?.classList.add('text-danger');
      helpEl.textContent = errors[0];
      return false;
    }
    helpEl?.classList.remove('text-danger');
    helpEl?.classList.add('text-muted');
    helpEl.textContent = 'Name to show in the tree';
    return true;
  };

  const validateNotes = (input, helpEl) => {
    if (!input) return true;
    const value = input.value.trim();
    if (value.length > 500) {
      helpEl?.classList.remove('text-muted');
      helpEl?.classList.add('text-danger');
      helpEl.textContent = 'Notes must be 500 characters or less.';
      return false;
    }
    helpEl?.classList.remove('text-danger');
    helpEl?.classList.add('text-muted');
    helpEl.textContent = 'Optional notes shown on details panel';
    return true;
  };

  const updateAddSaveState = () => {
    const nameValid = validateName(dom.addNameInput, dom.addNameHelp);
    const notesValid = validateNotes(dom.addNotesInput, dom.addNotesHelp);
    if (dom.addLocationSaveBtn) dom.addLocationSaveBtn.disabled = !(nameValid && notesValid);
  };

  const updateEditState = () => {
    const nameValid = validateName(dom.editNameInput, dom.editNameHelp);
    const notesValid = validateNotes(dom.editNotesInput, dom.editNotesHelp);
    const changes = [];
    const nameChange = describeChange('name', state.forms.edit.initialName, dom.editNameInput.value);
    const notesChange = describeChange('notes', state.forms.edit.initialNotes, dom.editNotesInput.value);
    if (nameChange) changes.push(nameChange);
    if (notesChange) changes.push(notesChange);
    if (dom.editChangesSummary) {
      dom.editChangesSummary.textContent = changes.length ? changes.join(' ') : 'No changes yet.';
    }
    if (dom.editLocationSaveBtn) dom.editLocationSaveBtn.disabled = !(nameValid && notesValid) || changes.length === 0;
  };

  const updateMoveState = () => {
    const selectedValue = dom.moveLocationSelect?.value || '';
    const selectedId = parseNumber(selectedValue);
    const selectedLabel = selectedValue
      ? (dom.moveLocationSelect?.selectedOptions?.[0]?.textContent || '').trim()
      : '';
    const hasChange = selectedId && selectedId !== state.forms.move.initialParentId;
    const changeSentence = hasChange
      ? describeChange('parent', state.forms.move.initialParentLabel, selectedLabel)
      : null;
    if (dom.moveChangesSummary) {
      dom.moveChangesSummary.textContent = changeSentence || 'No changes yet.';
    }
    if (dom.moveLocationConfirmBtn) {
      dom.moveLocationConfirmBtn.disabled = !selectedId || !changeSentence;
    }
  };

  const getParentLabel = (locationId) => {
    const loc = state.locations.find((l) => l.id === locationId);
    return loc?.name || 'Root';
  };

  const openAddModal = (parentId = null) => {
    resetFormErrors();
    state.forms.add.parentId = parentId;
    dom.addNameInput.value = '';
    dom.addNotesInput.value = '';
    dom.addParentLine.textContent = parentId ? `Parent: ${getParentLabel(parentId)}` : 'Parent: Root';
    setModalLocked(dom.addLocationModal, false);
    dom.addLocationSaveBtn.disabled = true;
    dom.addLocationSaveBtn.querySelector('.spinner-border')?.classList.add('d-none');
    showModal(dom.addLocationModal);
    dom.addNameInput.focus();
    updateAddSaveState();
  };

  const openEditModal = (loc) => {
    if (!loc) return;
    resetFormErrors();
    state.forms.edit.locationId = loc.id;
    state.forms.edit.initialName = loc.name || '';
    state.forms.edit.initialNotes = loc.notes || '';
    dom.editNameInput.value = loc.name || '';
    dom.editNotesInput.value = loc.notes || '';
    dom.editChangesSummary.textContent = 'No changes yet.';
    setModalLocked(dom.editLocationModal, false);
    dom.editLocationSaveBtn.disabled = true;
    dom.editLocationSaveBtn.querySelector('.spinner-border')?.classList.add('d-none');
    showModal(dom.editLocationModal);
    dom.editNameInput.focus();
    updateEditState();
  };

  const openMoveModal = (loc) => {
    if (!loc) return;
    resetFormErrors();
    state.forms.move.locationId = loc.id;
    state.forms.move.initialParentId = loc.parentId ?? null;
    state.forms.move.initialParentLabel = getParentLabel(loc.parentId ?? null);
    populateMoveOptions(loc.id);
    dom.moveLocationSelect.value = '';
    dom.moveSummaryText.textContent = `Move "${loc.name}" to another parent.`;
    setModalLocked(dom.moveLocationModal, false);
    dom.moveLocationConfirmBtn.disabled = true;
    dom.moveLocationConfirmBtn.querySelector('.spinner-border')?.classList.add('d-none');
    showModal(dom.moveLocationModal);
    updateMoveState();
  };

  const openDeleteModal = (loc) => {
    if (!loc) return;
    resetFormErrors();
    state.forms.delete.locationId = loc.id;
    dom.deleteLocationMessage.textContent = `Delete "${loc.name}" and its subtree?`;
    dom.deleteImpactNote.textContent = 'Books will be unlinked from this location; data is retained.';
    dom.deleteConfirmInput.value = '';
    setModalLocked(dom.deleteLocationModal, false);
    dom.deleteLocationConfirmBtn.disabled = true;
    dom.deleteLocationConfirmBtn.querySelector('.spinner-border')?.classList.add('d-none');
    showModal(dom.deleteLocationModal);
    dom.deleteConfirmInput.focus();
  };

  const handleAddSubmit = async () => {
    if (!validateName(dom.addNameInput, dom.addNameHelp) || !validateNotes(dom.addNotesInput, dom.addNotesHelp)) return;
    const spinnerObj = attachButtonSpinner(dom.addLocationSaveBtn);
    setButtonLoading(dom.addLocationSaveBtn, spinnerObj, true);
    setModalLocked(dom.addLocationModal, true);

    try {
      const body = {
        name: dom.addNameInput.value.trim(),
        notes: dom.addNotesInput.value.trim(),
        parentId: state.forms.add.parentId
      };
      const response = await apiFetch('/storagelocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (await handleRateLimit(response)) return;
      if (!response.ok) throw await response.json();
      await fetchLocations();
      hideModal(dom.addLocationModal);
    } catch (err) {
      renderInlineError(dom.addLocationError, err?.message || 'Could not create location.', err?.errors || []);
    } finally {
      setButtonLoading(dom.addLocationSaveBtn, spinnerObj, false);
      setModalLocked(dom.addLocationModal, false);
    }
  };

  const handleEditSubmit = async () => {
    const nameOk = validateName(dom.editNameInput, dom.editNameHelp);
    const notesOk = validateNotes(dom.editNotesInput, dom.editNotesHelp);
    if (!nameOk || !notesOk) return;

    const spinnerObj = attachButtonSpinner(dom.editLocationSaveBtn);
    setButtonLoading(dom.editLocationSaveBtn, spinnerObj, true);
    setModalLocked(dom.editLocationModal, true);

    try {
      const body = {
        name: dom.editNameInput.value.trim(),
        notes: dom.editNotesInput.value.trim()
      };
      const response = await apiFetch(`/storagelocation/${state.forms.edit.locationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (await handleRateLimit(response)) return;
      if (!response.ok) throw await response.json();
      await fetchLocations();
      hideModal(dom.editLocationModal);
    } catch (err) {
      renderInlineError(dom.editLocationError, err?.message || 'Could not update location.', err?.errors || []);
    } finally {
      setButtonLoading(dom.editLocationSaveBtn, spinnerObj, false);
      setModalLocked(dom.editLocationModal, false);
    }
  };

  const handleMoveSubmit = async () => {
    const newParentId = parseNumber(dom.moveLocationSelect.value);
    if (!newParentId) {
      renderInlineError(dom.moveLocationError, 'Choose a parent to move to.', []);
      return;
    }
    const spinnerObj = attachButtonSpinner(dom.moveLocationConfirmBtn);
    setButtonLoading(dom.moveLocationConfirmBtn, spinnerObj, true);
    setModalLocked(dom.moveLocationModal, true);
    try {
      const response = await apiFetch(`/storagelocation/${state.forms.move.locationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: newParentId })
      });
      if (await handleRateLimit(response)) return;
      if (!response.ok) throw await response.json();
      await fetchLocations();
      hideModal(dom.moveLocationModal);
    } catch (err) {
      renderInlineError(dom.moveLocationError, err?.message || 'Could not move location.', err?.errors || []);
    } finally {
      setButtonLoading(dom.moveLocationConfirmBtn, spinnerObj, false);
      setModalLocked(dom.moveLocationModal, false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (dom.deleteConfirmInput.value.trim().toUpperCase() !== 'DELETE') {
      renderInlineError(dom.deleteLocationError, 'Type DELETE to confirm.', []);
      return;
    }
    const spinnerObj = attachButtonSpinner(dom.deleteLocationConfirmBtn);
    setButtonLoading(dom.deleteLocationConfirmBtn, spinnerObj, true);
    setModalLocked(dom.deleteLocationModal, true);
    try {
      const response = await apiFetch(`/storagelocation/${state.forms.delete.locationId}`, { method: 'DELETE' });
      if (await handleRateLimit(response)) return;
      if (!response.ok) throw await response.json();
      await fetchLocations();
      state.selectedId = null;
      renderDetails(null);
      hideModal(dom.deleteLocationModal);
    } catch (err) {
      renderInlineError(dom.deleteLocationError, err?.message || 'Could not delete location.', err?.errors || []);
    } finally {
      setButtonLoading(dom.deleteLocationConfirmBtn, spinnerObj, false);
      setModalLocked(dom.deleteLocationModal, false);
    }
  };

  const wireEvents = () => {
    dom.treeSearchInput?.addEventListener('input', debounce((event) => {
      state.searchQuery = event.target.value;
      renderTree();
      updateUrl();
    }, 200));

    dom.clearTreeSearchBtn?.addEventListener('click', () => {
      state.searchQuery = '';
      if (dom.treeSearchInput) dom.treeSearchInput.value = '';
      renderTree();
      updateUrl();
    });

    dom.expandAllBtn?.addEventListener('click', () => {
      state.locations.forEach((loc) => state.expandedIds.add(loc.id));
      saveExpanded();
      renderTree();
    });

    dom.collapseAllBtn?.addEventListener('click', () => {
      state.expandedIds.clear();
      saveExpanded();
      renderTree();
    });

    dom.addRootBtn?.addEventListener('click', () => openAddModal(null));
    dom.addChildBtn?.addEventListener('click', () => {
      if (!state.selectedId) return;
      openAddModal(state.selectedId);
    });

    dom.editBtn?.addEventListener('click', () => {
      const loc = state.locations.find((l) => l.id === state.selectedId);
      if (!loc) return;
      openEditModal(loc);
    });

    dom.moveBtn?.addEventListener('click', () => {
      const loc = state.locations.find((l) => l.id === state.selectedId);
      if (!loc) return;
      openMoveModal(loc);
    });

    dom.deleteBtn?.addEventListener('click', () => {
      const loc = state.locations.find((l) => l.id === state.selectedId);
      if (!loc) return;
      openDeleteModal(loc);
    });

    dom.addLocationSaveBtn?.addEventListener('click', handleAddSubmit);
    dom.editLocationSaveBtn?.addEventListener('click', handleEditSubmit);
    dom.moveLocationConfirmBtn?.addEventListener('click', handleMoveSubmit);
    dom.deleteLocationConfirmBtn?.addEventListener('click', handleDeleteSubmit);

    dom.addNameInput?.addEventListener('input', updateAddSaveState);
    dom.addNotesInput?.addEventListener('input', updateAddSaveState);
    dom.editNameInput?.addEventListener('input', updateEditState);
    dom.editNotesInput?.addEventListener('input', updateEditState);

    dom.moveLocationSelect?.addEventListener('change', () => {
      updateMoveState();
      dom.moveLocationError.classList.add('d-none');
    });

    dom.deleteConfirmInput?.addEventListener('input', () => {
      dom.deleteLocationConfirmBtn.disabled = dom.deleteConfirmInput.value.trim().toUpperCase() !== 'DELETE';
    });

    dom.booksSortSelect?.addEventListener('change', () => {
      const [field, order] = dom.booksSortSelect.value.split(':');
      state.booksSort = { field, order };
      state.booksPage = 1;
      updateUrl();
      fetchBooksForLocation(state.selectedId);
    });

    dom.booksPerPageInput?.addEventListener('change', () => {
      const value = parseNumber(dom.booksPerPageInput.value) || 10;
      state.booksLimit = Math.min(50, Math.max(2, value));
      dom.booksPerPageInput.value = String(state.booksLimit);
      state.booksPage = 1;
      updateUrl();
      fetchBooksForLocation(state.selectedId);
    });

    dom.directOnlyBtn?.addEventListener('click', () => {
      state.includeSubtreeBooks = false;
      state.booksPage = 1;
      refreshBooksControls();
      updateUrl();
      fetchBooksForLocation(state.selectedId);
    });

    dom.includeSubtreeBtn?.addEventListener('click', () => {
      state.includeSubtreeBooks = true;
      state.booksPage = 1;
      refreshBooksControls();
      updateUrl();
      fetchBooksForLocation(state.selectedId);
    });

    dom.copyPathBtn?.addEventListener('click', async () => {
      try {
        const path = state.lastBreadcrumbParts.join(' / ');
        await navigator.clipboard.writeText(path);
        dom.copyPathBtn.innerHTML = '<i class="bi bi-clipboard-check"></i>';
        setTimeout(() => { dom.copyPathBtn.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1500);
      } catch (err) {
        warn('Failed to copy path', err);
      }
    });
  };

  const init = () => {
    log('Initializing storage locations page');
    loadExpanded();
    hydrateStateFromUrl();
    refreshBooksControls();
    wireEvents();
    if (dom.detailsOffcanvas) {
      dom.detailsOffcanvas.addEventListener('hidden.bs.offcanvas', () => {
        cleanupBackdrops();
      });
    }
    fetchLocations();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
