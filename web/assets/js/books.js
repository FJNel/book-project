// Books page logic: fetch, filter, render card/list views, and sync URL state.
(function () {
  const log = (...args) => console.log('[Books]', ...args);
  const warn = (...args) => console.warn('[Books]', ...args);
  const errorLog = (...args) => console.error('[Books]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const debugLog = (...args) => {
    console.log('[Books][debug]', ...args);
  };

  const defaultFilters = () => ({
    title: '',
    subtitle: '',
    isbn: '',
    tagIds: [],
    tagMode: 'and',
    bookTypeId: '',
    publisherId: '',
    authorIds: [],
    authorMode: 'and',
    seriesIds: [],
    seriesMode: 'and',
    pageMin: '',
    pageMax: '',
    publishedAfter: '',
    publishedBefore: '',
    languageIds: [],
    languageMode: 'and',
    includeDeleted: false,
    onlyWithCover: false
  });

  const state = {
    view: 'card',
    sort: { field: 'title', order: 'asc' },
    limit: 20,
    page: 1,
    search: '',
    filters: defaultFilters()
  };

  const dom = {
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    sortSelect: document.getElementById('sortSelect'),
    perPageInput: document.getElementById('perPageInput'),
    viewCardBtn: document.getElementById('viewCardBtn'),
    viewListBtn: document.getElementById('viewListBtn'),
    filterTitle: document.getElementById('filterTitle'),
    filterSubtitle: document.getElementById('filterSubtitle'),
    filterIsbn: document.getElementById('filterIsbn'),
    bookTypeCheckboxes: document.getElementById('bookTypeCheckboxes'),
    publisherCheckboxes: document.getElementById('publisherCheckboxes'),
    authorCheckboxes: document.getElementById('authorCheckboxes'),
    authorModeSelect: document.getElementById('authorModeSelect'),
    seriesCheckboxes: document.getElementById('seriesCheckboxes'),
    seriesModeSelect: document.getElementById('seriesModeSelect'),
    tagCheckboxes: document.getElementById('tagCheckboxes'),
    languageCheckboxes: document.getElementById('languageCheckboxes'),
    tagModeSelect: document.getElementById('tagModeSelect'),
    languageModeSelect: document.getElementById('languageModeSelect'),
    filterPageMin: document.getElementById('filterPageMin'),
    filterPageMax: document.getElementById('filterPageMax'),
    filterPublishedAfter: document.getElementById('filterPublishedAfter'),
    filterPublishedBefore: document.getElementById('filterPublishedBefore'),
    includeDeletedCheck: document.getElementById('includeDeletedCheck'),
    onlyWithCoverCheck: document.getElementById('onlyWithCoverCheck'),
    applyFiltersBtn: document.getElementById('applyFiltersBtn'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    refreshButton: document.getElementById('refreshButton'),
    clearAllFiltersBtn: document.getElementById('clearAllFiltersBtn'),
    openRawData: document.getElementById('openRawData'),
    feedbackContainer: document.getElementById('feedbackContainer'),
    activeFilters: document.getElementById('activeFilters'),
    resultsSummary: document.getElementById('resultsSummary'),
    resultsMeta: document.getElementById('resultsMeta'),
    cardsContainer: document.getElementById('cardsContainer'),
    listContainer: document.getElementById('listContainer'),
    listTableBody: document.getElementById('listTableBody'),
    listCount: document.getElementById('listCount'),
    resultsPlaceholder: document.getElementById('resultsPlaceholder'),
    paginationInfo: document.getElementById('paginationInfo'),
    paginationNav: document.getElementById('paginationNav'),
    statTotal: document.getElementById('statTotal'),
    statCovers: document.getElementById('statCovers'),
    statIsbn: document.getElementById('statIsbn'),
    statDescription: document.getElementById('statDescription'),
    statsContainer: document.getElementById('statsContainer'),
    statTotalWrap: document.getElementById('statTotalWrap'),
    statCoversWrap: document.getElementById('statCoversWrap'),
    statIsbnWrap: document.getElementById('statIsbnWrap'),
    statDescriptionWrap: document.getElementById('statDescriptionWrap')
  };
  let lastHasNextPage = false;
  let tagMap = new Map();
  let languageMap = new Map();
  let bookTypeMap = new Map();
  let publisherMap = new Map();
  let authorMap = new Map();
  let seriesMap = new Map();

  const debounce = (fn, delay = 350) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

  const isIsoDate = (value) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

  const normalizeIsbn = (value) => {
    if (!value) return '';
    const cleaned = String(value).replace(/[^0-9xX]/g, '').toUpperCase();
    if (cleaned.length === 10 && /^[0-9]{9}[0-9X]$/.test(cleaned)) return cleaned;
    if (cleaned.length === 13 && /^[0-9]{13}$/.test(cleaned)) return cleaned;
    return '';
  };

  const getCheckedIds = (container) => {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
      .map((cb) => parseNumber(cb.value))
      .filter((id) => Number.isInteger(id));
  };

  const renderCheckboxGroup = ({ container, items, selectedIds = [], namePrefix = 'opt' }) => {
    if (!container) return;
    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = '<div class="text-muted small">No options available.</div>';
      return;
    }
    items.forEach((item, index) => {
      const id = item.id ?? index;
      const inputId = `${namePrefix}-${id}`;
      const wrapper = document.createElement('div');
      wrapper.className = 'form-check';
      wrapper.innerHTML = `
        <input class="form-check-input" type="checkbox" id="${inputId}" value="${id}">
        <label class="form-check-label" for="${inputId}">${item.name || item.label || id}</label>
      `;
      const cb = wrapper.querySelector('input');
      cb.checked = selectedIds.includes(id);
      container.appendChild(wrapper);
    });
  };

  const placeholderCover = (title, size = '600x900', text = null) => {
    const safeText = encodeURIComponent(text || title || 'Book Cover');
    return `https://placehold.co/${size}?text=${safeText}&bg=dee2e6&fc=495057&font=Lora`;
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

  const updateOffcanvasPlacement = () => {
    const offcanvasEl = document.getElementById('filtersOffcanvas');
    if (!offcanvasEl) return;
    offcanvasEl.classList.remove('offcanvas-end', 'offcanvas-bottom');
    if (isMobile()) {
      offcanvasEl.classList.add('offcanvas-bottom');
    } else {
      offcanvasEl.classList.add('offcanvas-end');
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
      ${Array.isArray(details) && details.length ? `<ul class="mb-1 small text-muted">${details.map((err) => `<li>${err}</li>`).join('')}</ul>` : ''}
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
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'list') {
      state.view = 'list';
    } else if (viewParam === 'card') {
      state.view = 'card';
    }

    const sortParam = params.get('sort');
    if (sortParam && sortParam.includes(':')) {
      const [field, order] = sortParam.split(':');
      if (field) state.sort.field = field;
      if (order) state.sort.order = order;
    }

    const limitParam = parseNumber(params.get('limit'));
    if (limitParam) state.limit = Math.min(200, Math.max(2, limitParam));

    const pageParam = parseNumber(params.get('page'));
    if (pageParam && pageParam > 0) state.page = pageParam;

    state.search = params.get('q') || '';

    state.filters.title = params.get('filterTitle') || '';
    state.filters.subtitle = params.get('filterSubtitle') || '';
    state.filters.isbn = params.get('filterIsbn') || '';
    const tagsParam = params.get('tags');
    state.filters.tagIds = tagsParam
      ? tagsParam
          .split(',')
          .map((id) => parseNumber(id))
          .filter((id) => Number.isInteger(id))
      : [];
    state.filters.tagMode = params.get('filterTagMode') === 'or' ? 'or' : 'and';
    const bookTypeParam = params.get('filterBookTypeId');
    state.filters.bookTypeId = bookTypeParam || '';
    const publisherParam = params.get('filterPublisherId');
    state.filters.publisherId = publisherParam || '';
    const authorParam = params.get('filterAuthorId');
    state.filters.authorIds = authorParam ? authorParam.split(',').map(parseNumber).filter(Number.isInteger) : [];
    state.filters.authorMode = params.get('filterAuthorMode') === 'or' ? 'or' : 'and';
    const seriesParam = params.get('filterSeriesId');
    state.filters.seriesIds = seriesParam ? seriesParam.split(',').map(parseNumber).filter(Number.isInteger) : [];
    state.filters.seriesMode = params.get('filterSeriesMode') === 'or' ? 'or' : 'and';
    state.filters.bookTypeId = params.get('filterBookTypeId') || '';
    state.filters.publisherId = params.get('filterPublisherId') || '';
    state.filters.authorId = params.get('filterAuthorId') || '';
    state.filters.seriesId = params.get('filterSeriesId') || '';
    state.filters.pageMin = params.get('filterPageMin') || '';
    state.filters.pageMax = params.get('filterPageMax') || '';
    state.filters.publishedAfter = params.get('filterPublishedAfter') || '';
    state.filters.publishedBefore = params.get('filterPublishedBefore') || '';
    state.filters.includeDeleted = params.get('includeDeleted') === 'true';
    state.filters.onlyWithCover = params.get('onlyWithCover') === 'true';

    const languagesParam = params.get('languages');
    if (languagesParam) {
      state.filters.languageIds = languagesParam
        .split(',')
        .map((id) => parseNumber(id))
        .filter((id) => Number.isInteger(id));
    }
    const langMode = params.get('filterLanguageMode');
    state.filters.languageMode = langMode === 'or' ? 'or' : 'and';

    if (isMobile() && state.view === 'list') {
      state.view = 'card';
    }
  };

  const updateUrl = () => {
    const params = new URLSearchParams();
    params.set('view', state.view);
    params.set('sort', `${state.sort.field}:${state.sort.order}`);
    params.set('limit', String(state.limit));
    params.set('page', String(state.page));
    if (state.search) params.set('q', state.search);

    const f = state.filters;
    if (f.title) params.set('filterTitle', f.title);
    if (f.subtitle) params.set('filterSubtitle', f.subtitle);
    if (f.isbn) params.set('filterIsbn', f.isbn);
    if (f.tagIds.length) params.set('tags', f.tagIds.join(','));
    if (f.tagMode) params.set('filterTagMode', f.tagMode);
    if (f.bookTypeId) params.set('filterBookTypeId', f.bookTypeId);
    if (f.publisherId) params.set('filterPublisherId', f.publisherId);
    if (f.pageMin) params.set('filterPageMin', f.pageMin);
    if (f.pageMax) params.set('filterPageMax', f.pageMax);
    if (isIsoDate(f.publishedAfter)) params.set('filterPublishedAfter', f.publishedAfter);
    if (isIsoDate(f.publishedBefore)) params.set('filterPublishedBefore', f.publishedBefore);
    if (f.includeDeleted) params.set('includeDeleted', 'true');
    if (f.onlyWithCover) params.set('onlyWithCover', 'true');
    if (f.languageIds.length > 0) params.set('languages', f.languageIds.join(','));
    if (f.languageMode) params.set('filterLanguageMode', f.languageMode);
    if (f.authorIds.length) params.set('filterAuthorId', f.authorIds.join(','));
    if (f.authorMode) params.set('filterAuthorMode', f.authorMode);
    if (f.seriesIds.length) params.set('filterSeriesId', f.seriesIds.join(','));
    if (f.seriesMode) params.set('filterSeriesMode', f.seriesMode);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  const setViewButtons = () => {
    const cardActive = state.view === 'card';
    if (dom.viewCardBtn) {
      dom.viewCardBtn.classList.toggle('btn-primary', cardActive);
      dom.viewCardBtn.classList.toggle('btn-outline-primary', !cardActive);
      dom.viewCardBtn.setAttribute('aria-pressed', cardActive ? 'true' : 'false');
    }
    if (dom.viewListBtn) {
      dom.viewListBtn.classList.toggle('btn-primary', !cardActive);
      dom.viewListBtn.classList.toggle('btn-outline-primary', cardActive);
      dom.viewListBtn.setAttribute('aria-pressed', cardActive ? 'false' : 'true');
    }
    if (dom.cardsContainer) dom.cardsContainer.classList.toggle('d-none', !cardActive);
    if (dom.listContainer) dom.listContainer.classList.toggle('d-none', cardActive);
  };

  const syncControlsFromState = () => {
    if (dom.searchInput) dom.searchInput.value = state.search;
    if (dom.sortSelect) dom.sortSelect.value = `${state.sort.field}:${state.sort.order}`;
    if (dom.perPageInput) dom.perPageInput.value = String(state.limit);

    const f = state.filters;
    if (dom.filterTitle) dom.filterTitle.value = f.title;
    if (dom.filterSubtitle) dom.filterSubtitle.value = f.subtitle;
    if (dom.filterIsbn) dom.filterIsbn.value = f.isbn;
    if (dom.authorModeSelect) dom.authorModeSelect.value = f.authorMode;
    const authorModeRadio = document.querySelector(`input[name="authorMode"][value="${f.authorMode}"]`);
    if (authorModeRadio) authorModeRadio.checked = true;
    if (dom.seriesModeSelect) dom.seriesModeSelect.value = f.seriesMode;
    const seriesModeRadio = document.querySelector(`input[name="seriesMode"][value="${f.seriesMode}"]`);
    if (seriesModeRadio) seriesModeRadio.checked = true;
    if (dom.filterPageMin) dom.filterPageMin.value = f.pageMin;
    if (dom.filterPageMax) dom.filterPageMax.value = f.pageMax;
    if (dom.filterPublishedAfter) dom.filterPublishedAfter.value = f.publishedAfter;
    if (dom.filterPublishedBefore) dom.filterPublishedBefore.value = f.publishedBefore;
    if (dom.includeDeletedCheck) dom.includeDeletedCheck.checked = f.includeDeleted;
    if (dom.onlyWithCoverCheck) dom.onlyWithCoverCheck.checked = f.onlyWithCover;
    const tagRadio = document.querySelector(`input[name="tagMode"][value="${f.tagMode}"]`);
    if (tagRadio) tagRadio.checked = true;
    const langRadio = document.querySelector(`input[name="languageMode"][value="${f.languageMode}"]`);
    if (langRadio) langRadio.checked = true;

    if (dom.bookTypeCheckboxes) {
      Array.from(dom.bookTypeCheckboxes.querySelectorAll('input[type="checkbox"]')).forEach((cb) => {
        const id = parseNumber(cb.value);
        cb.checked = id !== null && f.bookTypeId === id;
      });
    }
    if (dom.publisherCheckboxes) {
      Array.from(dom.publisherCheckboxes.querySelectorAll('input[type="checkbox"]')).forEach((cb) => {
        const id = parseNumber(cb.value);
        cb.checked = id !== null && f.publisherId === id;
      });
    }
    if (dom.authorCheckboxes) {
      Array.from(dom.authorCheckboxes.querySelectorAll('input[type="checkbox"]')).forEach((cb) => {
        const id = parseNumber(cb.value);
        cb.checked = id !== null && f.authorIds.includes(id);
      });
    }
    if (dom.seriesCheckboxes) {
      Array.from(dom.seriesCheckboxes.querySelectorAll('input[type="checkbox"]')).forEach((cb) => {
        const id = parseNumber(cb.value);
        cb.checked = id !== null && f.seriesIds.includes(id);
      });
    }
    if (dom.languageCheckboxes) {
      Array.from(dom.languageCheckboxes.querySelectorAll('input[type="checkbox"]')).forEach((cb) => {
        const id = parseNumber(cb.value);
        cb.checked = id !== null && f.languageIds.includes(id);
      });
    }
    if (dom.tagCheckboxes) {
      Array.from(dom.tagCheckboxes.querySelectorAll('input[type="checkbox"]')).forEach((cb) => {
        const id = parseNumber(cb.value);
        cb.checked = id !== null && f.tagIds.includes(id);
      });
    }

    setViewButtons();
  };

  const renderActiveFilters = () => {
    if (!dom.activeFilters) return;
    dom.activeFilters.innerHTML = '';
    const chips = [];
    const pushChip = (label, value, onRemove) => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip d-inline-flex align-items-center gap-2 border rounded-pill px-3 py-1 bg-body-secondary text-body';
      chip.innerHTML = `<span class="text-muted text-uppercase fw-semibold small">${label}</span><span class="fw-semibold">${value}</span><button type="button" class="btn-close btn-close-sm ms-1" aria-label="Remove filter"></button>`;
      const closeBtn = chip.querySelector('button');
      closeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        onRemove();
      });
      chips.push(chip);
    };

    if (state.search) pushChip('search', state.search, () => { state.search = ''; syncControlsFromState(); triggerFetch(); });
    const f = state.filters;
    if (f.title) pushChip('title', f.title, () => { f.title = ''; syncControlsFromState(); triggerFetch(); });
    if (f.subtitle) pushChip('subtitle', f.subtitle, () => { f.subtitle = ''; syncControlsFromState(); triggerFetch(); });
    if (f.isbn) pushChip('isbn', f.isbn, () => { f.isbn = ''; syncControlsFromState(); triggerFetch(); });
    if (f.tagIds.length) {
      const names = f.tagIds
        .map((id) => tagMap.get(id))
        .filter(Boolean)
        .join(', ');
      const label = `${names || f.tagIds.join(',')} (${f.tagMode === 'or' ? 'OR' : 'AND'})`;
      pushChip('tags', label, () => { f.tagIds = []; syncControlsFromState(); triggerFetch(); });
    }
    if (f.bookTypeId) {
      const name = bookTypeMap.get(parseNumber(f.bookTypeId));
      pushChip('type', name || f.bookTypeId, () => { f.bookTypeId = ''; syncControlsFromState(); triggerFetch(); });
    }
    if (f.publisherId) {
      const name = publisherMap.get(parseNumber(f.publisherId));
      pushChip('publisher', name || f.publisherId, () => { f.publisherId = ''; syncControlsFromState(); triggerFetch(); });
    }
    if (f.authorIds.length) {
      const names = f.authorIds.map((id) => authorMap.get(id)).filter(Boolean).join(', ');
      pushChip('author', `${names || f.authorIds.join(',')} (${f.authorMode === 'or' ? 'OR' : 'AND'})`, () => { f.authorIds = []; syncControlsFromState(); triggerFetch(); });
    }
    if (f.seriesIds.length) {
      const names = f.seriesIds.map((id) => seriesMap.get(id)).filter(Boolean).join(', ');
      pushChip('series', `${names || f.seriesIds.join(',')} (${f.seriesMode === 'or' ? 'OR' : 'AND'})`, () => { f.seriesIds = []; syncControlsFromState(); triggerFetch(); });
    }
    if (f.pageMin) pushChip('pages ≥', f.pageMin, () => { f.pageMin = ''; syncControlsFromState(); triggerFetch(); });
    if (f.pageMax) pushChip('pages ≤', f.pageMax, () => { f.pageMax = ''; syncControlsFromState(); triggerFetch(); });
    if (isIsoDate(f.publishedAfter)) pushChip('published after', f.publishedAfter, () => { f.publishedAfter = ''; syncControlsFromState(); triggerFetch(); });
    if (isIsoDate(f.publishedBefore)) pushChip('published before', f.publishedBefore, () => { f.publishedBefore = ''; syncControlsFromState(); triggerFetch(); });
    if (f.includeDeleted) pushChip('include deleted', 'on', () => { f.includeDeleted = false; syncControlsFromState(); triggerFetch(); });
    if (f.onlyWithCover) pushChip('with cover', 'required', () => { f.onlyWithCover = false; syncControlsFromState(); triggerFetch(); });
    if (f.languageIds.length) {
      const names = f.languageIds.map((id) => languageMap.get(id)).filter(Boolean).join(', ');
      const label = `${names || f.languageIds.join(',')} (${f.languageMode === 'or' ? 'OR' : 'AND'})`;
      pushChip('languages', label, () => { f.languageIds = []; syncControlsFromState(); triggerFetch(); });
    }

    if (chips.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'text-muted small';
      empty.textContent = 'None';
      dom.activeFilters.appendChild(empty);
      return;
    }

    if (chips.length > 6) {
      const visible = chips.slice(0, 5);
      const moreCount = chips.length - visible.length;
      visible.forEach((chip) => dom.activeFilters.appendChild(chip));
      const more = document.createElement('span');
      more.className = 'filter-chip d-inline-flex align-items-center gap-2 border rounded-pill px-3 py-1 bg-body-secondary text-body';
      more.textContent = `+${moreCount} more`;
      dom.activeFilters.appendChild(more);
    } else {
      chips.forEach((chip) => dom.activeFilters.appendChild(chip));
    }

    if (dom.clearAllFiltersBtn) {
      dom.clearAllFiltersBtn.classList.toggle('d-none', chips.length === 0);
    }
  };

  const readFiltersFromControls = () => {
    const next = defaultFilters();
    next.title = dom.filterTitle?.value.trim() || '';
    next.subtitle = dom.filterSubtitle?.value.trim() || '';
    next.isbn = dom.filterIsbn?.value.trim() || '';
    const btIds = getCheckedIds(dom.bookTypeCheckboxes);
    next.bookTypeId = btIds[0] || '';
    const pubIds = getCheckedIds(dom.publisherCheckboxes);
    next.publisherId = pubIds[0] || '';
    next.authorIds = getCheckedIds(dom.authorCheckboxes);
    const authorModeRadio = document.querySelector('input[name="authorMode"]:checked');
    next.authorMode = authorModeRadio?.value === 'or' ? 'or' : 'and';
    next.seriesIds = getCheckedIds(dom.seriesCheckboxes);
    const seriesModeRadio = document.querySelector('input[name="seriesMode"]:checked');
    next.seriesMode = seriesModeRadio?.value === 'or' ? 'or' : 'and';
    next.pageMin = dom.filterPageMin?.value || '';
    next.pageMax = dom.filterPageMax?.value || '';
    next.publishedAfter = dom.filterPublishedAfter?.value || '';
    next.publishedBefore = dom.filterPublishedBefore?.value || '';
    next.includeDeleted = Boolean(dom.includeDeletedCheck?.checked);
    next.onlyWithCover = Boolean(dom.onlyWithCoverCheck?.checked);
    next.languageIds = getCheckedIds(dom.languageCheckboxes);
    next.tagIds = getCheckedIds(dom.tagCheckboxes);
    const tagModeRadio = document.querySelector('input[name="tagMode"]:checked');
    next.tagMode = tagModeRadio?.value === 'or' ? 'or' : 'and';
    const langModeRadio = document.querySelector('input[name="languageMode"]:checked');
    next.languageMode = langModeRadio?.value === 'or' ? 'or' : 'and';
    return next;
  };

  const applyFiltersFromControls = () => {
    state.filters = readFiltersFromControls();
    state.page = 1;
    renderActiveFilters();
    triggerFetch();
  };

  const showLoading = () => {
    if (dom.resultsPlaceholder) dom.resultsPlaceholder.classList.remove('d-none');
    if (dom.cardsContainer) dom.cardsContainer.innerHTML = '';
    if (dom.listTableBody) dom.listTableBody.innerHTML = '';
  };

  const hideLoading = () => {
    if (dom.resultsPlaceholder) dom.resultsPlaceholder.classList.add('d-none');
  };

  const enforceMobileView = () => {
    const mobile = isMobile();
    if (mobile) {
      state.view = 'card';
      if (dom.viewListBtn) {
        dom.viewListBtn.classList.add('disabled');
        dom.viewListBtn.setAttribute('aria-disabled', 'true');
        dom.viewListBtn.title = 'List view available on desktop';
      }
      if (dom.listContainer) dom.listContainer.classList.add('d-none');
    } else if (dom.viewListBtn) {
      dom.viewListBtn.classList.remove('disabled');
      dom.viewListBtn.setAttribute('aria-disabled', 'false');
      dom.viewListBtn.title = '';
    }
  };

  const handleRateLimit = async (response) => {
    if (response && response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      await window.rateLimitGuard.showModal();
      return true;
    }
    return false;
  };

  let lastBooksSignature = null;

  const buildBookBody = () => {
    const body = {
      limit: state.limit,
      offset: (state.page - 1) * state.limit,
      view: state.view === 'card' ? 'card' : 'all',
      sortBy: state.sort.field,
      order: state.sort.order
    };

    const f = state.filters;
    if (state.search) {
      body.filterTitle = state.search;
    }
    if (f.title) body.filterTitle = f.title;
    if (f.subtitle) body.filterSubtitle = f.subtitle;
    if (f.isbn) {
      const cleanIsbn = normalizeIsbn(f.isbn);
      if (cleanIsbn) body.filterIsbn = cleanIsbn;
    }
    if (f.tagIds.length) {
      const names = f.tagIds.map((id) => tagMap.get(id)).filter(Boolean);
      body.filterTag = names.length ? names : f.tagIds.map(String);
      body.filterTagMode = f.tagMode || 'and';
    }
    if (f.bookTypeId) body.filterBookTypeId = f.bookTypeId;
    if (f.publisherId) body.filterPublisherId = f.publisherId;
    if (f.authorIds.length) {
      body.filterAuthorId = f.authorIds;
      body.filterAuthorMode = f.authorMode || 'and';
    }
    if (f.seriesIds.length) {
      body.filterSeriesId = f.seriesIds;
      body.filterSeriesMode = f.seriesMode || 'and';
    }
    if (f.pageMin) body.filterPageMin = f.pageMin;
    if (f.pageMax) body.filterPageMax = f.pageMax;
    if (isIsoDate(f.publishedAfter)) body.filterPublishedAfter = f.publishedAfter;
    if (isIsoDate(f.publishedBefore)) body.filterPublishedBefore = f.publishedBefore;
    if (f.languageIds.length > 0) {
      body.filterLanguageId = f.languageIds;
      body.filterLanguageIdMode = f.languageMode || 'and';
      const langNames = f.languageIds.map((id) => languageMap.get(id)).filter(Boolean);
      if (langNames.length) {
        body.filterLanguage = langNames.map((n) => n.toLowerCase());
        body.filterLanguageMode = f.languageMode || 'and';
      }
    }
    if (f.includeDeleted) body.includeDeleted = true;

    return body;
  };

  const getBooksSignature = () => JSON.stringify(buildBookBody());

  let currentRequestId = 0;

  const applyClientSideFilters = (books) => {
    let filtered = books;
    if (state.filters.languageIds.length > 0) {
      const languageSet = new Set(state.filters.languageIds);
      filtered = filtered.filter((book) => {
        if (!Array.isArray(book.languages)) return false;
        const matches = book.languages.filter((lang) => languageSet.has(lang.id)).length;
        return state.filters.languageMode === 'or' ? matches > 0 : matches === languageSet.size;
      });
    }
    if (state.filters.tagIds.length > 0) {
      const tagSet = new Set(state.filters.tagIds);
      filtered = filtered.filter((book) => {
        if (!Array.isArray(book.tags)) return false;
        const matches = book.tags.filter((tag) => tagSet.has(tag.id)).length;
        return state.filters.tagMode === 'or' ? matches > 0 : matches === tagSet.size;
      });
    }
    if (state.filters.onlyWithCover) {
      filtered = filtered.filter((book) => Boolean(book.coverImageUrl));
    }
    return filtered;
  };

  const renderPagination = (hasNextPage) => {
    if (!dom.paginationNav || !dom.paginationInfo) return;
    dom.paginationNav.innerHTML = '';
    dom.paginationInfo.textContent = `Page ${state.page}`;

    const createItem = (label, disabled, onClick) => {
      const li = document.createElement('li');
      li.className = `page-item${disabled ? ' disabled' : ''}`;
      const a = document.createElement('a');
      a.className = 'page-link';
      a.href = '#';
      a.textContent = label;
      a.addEventListener('click', (event) => {
        event.preventDefault();
        if (!disabled && typeof onClick === 'function') onClick();
      });
      li.appendChild(a);
      return li;
    };

    dom.paginationNav.appendChild(createItem('Previous', state.page <= 1, () => {
      state.page = Math.max(1, state.page - 1);
      updateUrl();
      triggerFetch();
    }));

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

    dom.paginationNav.appendChild(createItem('Next', !hasNextPage, () => {
      state.page += 1;
      updateUrl();
      triggerFetch();
    }));
  };

  const renderCards = (books) => {
    if (!dom.cardsContainer) return;
    dom.cardsContainer.innerHTML = '';
    if (books.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'col-12';
      empty.innerHTML = '<div class="alert alert-secondary mb-0">No books match your search or filters. Try clearing some filters.</div>';
      dom.cardsContainer.appendChild(empty);
      return;
    }

    books.forEach((book) => {
      const col = document.createElement('div');
      col.className = 'col-12 col-sm-6 col-lg-4 col-xl-3';
      const coverSrc = book.coverImageUrl || placeholderCover(book.title, '140x180', 'No cover');
      const publication = formatPartialDate(book.publicationDate);
      const pageCount = Number.isFinite(book.pageCount) ? book.pageCount : null;
      const bookType = book.bookTypeName || null;
      const authorNames = Array.isArray(book.authors) ? book.authors.map((a) => a.authorName || a.name).filter(Boolean) : [];
      const limitedAuthors = authorNames.slice(0, 2);
      const authorExtra = Math.max(authorNames.length - limitedAuthors.length, 0);
      const authorsText = limitedAuthors.length ? `${limitedAuthors.join(', ')}${authorExtra ? `, +${authorExtra} more` : ''}` : null;
      const languagesList = Array.isArray(book.languages) ? book.languages.map((l) => l.name) : [];
      const limitedLangs = languagesList.slice(0, 2);
      const langExtra = Math.max(languagesList.length - limitedLangs.length, 0);
      const language = limitedLangs.length ? `${limitedLangs.join(', ')}${langExtra ? `, +${langExtra} more` : ''}` : null;
      const tags = Array.isArray(book.tags) ? book.tags : [];
      const visibleTags = tags.slice(0, 3);
      const remaining = Math.max(tags.length - 3, 0);
      const metaRows = [
        publication ? { label: 'Published', value: publication } : null,
        pageCount !== null ? { label: 'Pages', value: pageCount } : null,
        bookType ? { label: 'Type', value: bookType } : null,
        authorsText ? { label: 'Authors', value: authorsText } : null,
        language ? { label: 'Language', value: language } : null
      ].filter(Boolean);

      const subtitle = book.subtitle ? book.subtitle : '';
      col.innerHTML = `
        <div class="card shadow h-100 book-card-link" role="button" tabindex="0">
          <div class="position-relative">
            <img class="cover-card rounded-top" alt="Book cover" src="${coverSrc}" onerror="this.onerror=null;this.src='${placeholderCover(book.title)}';" />
          </div>
          <div class="card-body d-flex flex-column">
            <div class="fw-bold meta-line">${book.title || 'Untitled'}</div>
            <div class="text-muted small meta-line ${subtitle ? '' : 'd-none'}">${subtitle}</div>
            <div class="mt-2 small text-muted">
              ${metaRows.map((row) => `<div class="d-flex justify-content-between"><span class="meta-label">${row.label}</span><span class="meta-value">${row.value}</span></div>`).join('')}
            </div>
            <div class="mt-3 d-flex flex-wrap gap-1">
              ${visibleTags.map((tag) => `<span class="badge rounded-pill text-bg-light text-dark border">${tag.name}</span>`).join('')}
              ${remaining > 0 ? `<span class="badge rounded-pill text-bg-light text-dark border">+${remaining} more</span>` : ''}
            </div>
          </div>
        </div>
      `;
      col.querySelector('.book-card-link').addEventListener('click', () => {
        window.location.href = `book-details?id=${book.id}`;
      });
      col.querySelector('.book-card-link').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.location.href = `book-details?id=${book.id}`;
        }
      });
      dom.cardsContainer.appendChild(col);
    });
  };

  const renderList = (books) => {
    if (!dom.listTableBody || !dom.listCount) return;
    dom.listTableBody.innerHTML = '';
    dom.listCount.textContent = books.length ? `${books.length} item${books.length === 1 ? '' : 's'}` : 'No results';

    if (books.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.className = 'text-center text-muted py-4';
      cell.textContent = 'No books match your search or filters. Try clearing some filters.';
      row.appendChild(cell);
      dom.listTableBody.appendChild(row);
      return;
    }

    books.forEach((book) => {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.addEventListener('click', () => {
        window.location.href = `book-details?id=${book.id}`;
      });

      const coverSrc = book.coverImageUrl || placeholderCover(book.title, '600x900', 'No cover');
      const publication = formatPartialDate(book.publicationDate) || '';
      const pageCount = Number.isFinite(book.pageCount) ? book.pageCount : '';
      const bookType = book.bookTypeName || book.bookType?.name || '';
      const languageNames = Array.isArray(book.languages) && book.languages.length > 0
        ? book.languages.map((l) => l.name)
        : [];
      const language = languageNames.slice(0, 2).join(', ') + (languageNames.length > 2 ? `, +${languageNames.length - 2} more` : '');
      const authorNames = Array.isArray(book.authors) ? book.authors.map((a) => a.authorName || a.name).filter(Boolean) : [];
      const authorsText = authorNames.slice(0, 2).join(', ') + (authorNames.length > 2 ? `, +${authorNames.length - 2} more` : '');
      const tags = Array.isArray(book.tags) ? book.tags : [];
      const visibleTags = tags.slice(0, 3);
      const remaining = Math.max(tags.length - visibleTags.length, 0);
      const infoLineParts = [];
      if (book.subtitle) infoLineParts.push(book.subtitle);
      if (book.isbn) infoLineParts.push(`ISBN: ${book.isbn}`);
      const infoLine = infoLineParts.join(' • ');

      row.innerHTML = `
        <td>
          <div class="d-flex align-items-center gap-3">
            <img class="cover-thumb rounded border" alt="Cover" src="${coverSrc}" onerror="this.onerror=null;this.src='${placeholderCover(book.title)}';" />
            <div style="min-width: 220px;">
              <div class="fw-semibold meta-line">${book.title || 'Untitled'}</div>
              <div class="text-muted small meta-line ${infoLine ? '' : 'd-none'}">${infoLine}</div>
            </div>
          </div>
        </td>
        <td>${bookType || ''}</td>
        <td>${language}</td>
        <td>${pageCount}</td>
        <td>${publication}</td>
        <td>${visibleTags.map((tag) => `<span class="badge rounded-pill text-bg-light text-dark border">${tag.name}</span>`).join(' ')}${remaining > 0 ? ` <span class="badge rounded-pill text-bg-light text-dark border">+${remaining}</span>` : ''}</td>
        <td>${authorsText}</td>
      `;
      dom.listTableBody.appendChild(row);
    });
  };

  const renderBooks = (books) => {
    if (isMobile() && state.view === 'list') {
      state.view = 'card';
    }
    setViewButtons();
    hideLoading();
    if (state.view === 'card') {
      renderCards(books);
    } else {
      renderList(books);
    }
    renderActiveFilters();
  };

  const updateSummary = (count) => {
    const sortLabel = dom.sortSelect ? dom.sortSelect.selectedOptions[0]?.textContent : '';
    if (dom.resultsSummary) dom.resultsSummary.textContent = `${count} book${count === 1 ? '' : 's'} • ${sortLabel || 'Sorted'} • Page ${state.page}`;
    if (dom.resultsMeta) dom.resultsMeta.textContent = '';
  };

  const loadStats = async () => {
    try {
      const response = await apiFetch('/book/stats?fields=total,withCoverImage,withIsbn,withDescription', { method: 'GET' });
      if (await handleRateLimit(response)) return;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        warn('Stats response not ok', payload);
        return;
      }
      const data = payload.data || {};
      const applyStat = (wrap, target, value) => {
        if (!wrap || !target) return;
        if (value === undefined || value === null || value === 0) {
          wrap.classList.add('d-none');
          return;
        }
        target.textContent = value;
        wrap.classList.remove('d-none');
      };
      applyStat(dom.statTotalWrap, dom.statTotal, data.total);
      applyStat(dom.statCoversWrap, dom.statCovers, data.withCoverImage);
      applyStat(dom.statIsbnWrap, dom.statIsbn, data.withIsbn);
      applyStat(dom.statDescriptionWrap, dom.statDescription, data.withDescription);
      if (dom.statTotalWrap && dom.statCoversWrap && dom.statIsbnWrap && dom.statDescriptionWrap) {
        const anyVisible = [dom.statTotalWrap, dom.statCoversWrap, dom.statIsbnWrap, dom.statDescriptionWrap]
          .some((el) => !el.classList.contains('d-none'));
        if (dom.statsContainer) {
          dom.statsContainer.classList.toggle('d-none', !anyVisible);
        }
      }
    } catch (error) {
      warn('Failed to load stats', error);
    }
  };

  const loadCheckboxOptions = async ({ url, target, mapSetter }) => {
    if (!target) return;
    try {
      const response = await apiFetch(url, { method: 'GET' });
      if (await handleRateLimit(response)) return;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        showAlert({ message: payload.message || 'Failed to load filter options.' });
        return;
      }
      const key = Object.keys(payload.data || {}).find((k) => Array.isArray(payload.data[k]));
      const list = key ? payload.data[key] : [];
      mapSetter(new Map(list.map((item) => [item.id, item.name || item.displayName || item.title || item.id])));
      renderCheckboxGroup({
        container: target,
        items: list.map((item) => ({ id: item.id, name: item.name || item.displayName })),
        selectedIds: (() => {
          switch (target) {
            case dom.bookTypeCheckboxes: return state.filters.bookTypeId ? [parseNumber(state.filters.bookTypeId)] : [];
            case dom.publisherCheckboxes: return state.filters.publisherId ? [parseNumber(state.filters.publisherId)] : [];
            case dom.authorCheckboxes: return state.filters.authorIds;
            case dom.seriesCheckboxes: return state.filters.seriesIds;
            default: return getCheckedIds(target);
          }
        })(),
        namePrefix: target.id || 'opt'
      });
      syncControlsFromState();
    } catch (error) {
      warn('Failed to load select options', url, error);
      showAlert({ message: 'Unable to load filter options.', details: [url] });
    }
  };

  const loadTags = async () => {
    if (!dom.tagCheckboxes) return;
    try {
      const response = await apiFetch('/tags', { method: 'GET' });
      if (await handleRateLimit(response)) return;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const tags = (payload.data && payload.data.tags) || [];
      tagMap = new Map(tags.map((tag) => [tag.id, tag.name]));
      renderCheckboxGroup({
        container: dom.tagCheckboxes,
        items: tags.map((tag) => ({ id: tag.id, name: tag.name })),
        selectedIds: state.filters.tagIds,
        namePrefix: 'tag'
      });
    } catch (error) {
      warn('Failed to load tags', error);
    }
  };

  const loadLanguages = async () => {
    if (!dom.languageCheckboxes) return;
    try {
      const response = await apiFetch('/languages', { method: 'GET' });
      if (await handleRateLimit(response)) return;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const languages = (payload.data && payload.data.languages) || [];
      languageMap = new Map(languages.map((lang) => [lang.id, lang.name]));
      renderCheckboxGroup({
        container: dom.languageCheckboxes,
        items: languages.map((lang) => ({ id: lang.id, name: lang.name })),
        selectedIds: state.filters.languageIds,
        namePrefix: 'lang'
      });
    } catch (error) {
      warn('Failed to load languages', error);
    }
  };

  const loadReferenceData = async () => {
    const tasks = [
      loadCheckboxOptions({ url: '/booktype?nameOnly=true&sortBy=name&order=asc&limit=200', target: dom.bookTypeCheckboxes, mapSetter: (map) => { bookTypeMap = map; } }),
      loadCheckboxOptions({ url: '/publisher?nameOnly=true&sortBy=name&order=asc&limit=200', target: dom.publisherCheckboxes, mapSetter: (map) => { publisherMap = map; } }),
      loadCheckboxOptions({ url: '/author?nameOnly=true&sortBy=displayName&order=asc&limit=200', target: dom.authorCheckboxes, mapSetter: (map) => { authorMap = map; } }),
      loadCheckboxOptions({ url: '/bookseries?nameOnly=true&sortBy=name&order=asc&limit=200', target: dom.seriesCheckboxes, mapSetter: (map) => { seriesMap = map; } }),
      loadLanguages(),
      loadTags()
    ];
    await Promise.allSettled(tasks);
  };

  const triggerFetch = debounce(() => {
    state.page = Math.max(1, state.page);
    updateUrl();
    loadBooks();
  }, 150);

  const loadBooks = async () => {
    const signature = getBooksSignature();
    if (signature === lastBooksSignature) {
      debugLog('Skipping book fetch; state unchanged.');
      return;
    }
    lastBooksSignature = signature;

    const requestId = ++currentRequestId;
    clearAlerts();
    showLoading();

    const body = buildBookBody();
    debugLog('Requesting /book with JSON body', body);
    try {
      let response;
      let payload;

      response = await apiFetch('/book/list', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      payload = await response.json().catch(() => ({}));

      if (await handleRateLimit(response)) {
        hideLoading();
        return;
      }
      if (!response.ok) {
        const details = Array.isArray(payload.errors) ? payload.errors : [];
        showAlert({ message: payload.message || 'Failed to load books.', details });
        hideLoading();
        return;
      }

      const books = (payload.data && payload.data.books) || [];
      const filtered = applyClientSideFilters(books);
      const hasNextPage = books.length === state.limit;
      lastHasNextPage = hasNextPage;
      debugLog('Response status', response.status, 'books returned', books.length, 'filtered', filtered.length);

      if (requestId !== currentRequestId) return;

      updateSummary(filtered.length);
      renderBooks(filtered);
      renderPagination(hasNextPage);
    } catch (error) {
      errorLog('Book fetch failed', error);
      showAlert({ message: 'Unable to load books right now.', details: [error.message] });
      hideLoading();
    }
  };

  const resetFilters = () => {
    state.filters = defaultFilters();
    state.page = 1;
    syncControlsFromState();
    renderActiveFilters();
    triggerFetch();
  };

  const attachListeners = () => {
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', debounce((event) => {
        state.search = event.target.value.trim();
        state.page = 1;
        triggerFetch();
      }, 500));
      dom.searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          state.search = dom.searchInput.value.trim();
          state.page = 1;
          triggerFetch();
        }
      });
    }

    if (dom.clearSearchBtn) {
      dom.clearSearchBtn.addEventListener('click', () => {
        state.search = '';
        if (dom.searchInput) dom.searchInput.value = '';
        state.page = 1;
        triggerFetch();
      });
    }

    if (dom.sortSelect) {
      dom.sortSelect.addEventListener('change', (event) => {
        const [field, order] = (event.target.value || 'title:asc').split(':');
        state.sort = { field: field || 'title', order: order || 'asc' };
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

    if (dom.viewCardBtn) {
      dom.viewCardBtn.addEventListener('click', () => {
        if (state.view !== 'card') {
          state.view = 'card';
          setViewButtons();
          updateUrl();
          loadBooks();
        }
      });
    }

    if (dom.viewListBtn) {
      dom.viewListBtn.addEventListener('click', () => {
        if (state.view !== 'list') {
          state.view = 'list';
          setViewButtons();
          updateUrl();
          loadBooks();
        }
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
        loadStats();
      });
    }

    if (dom.openRawData) {
      dom.openRawData.addEventListener('click', () => {
        window.open('temp/books', '_blank', 'noopener');
      });
    }

    window.addEventListener('resize', () => {
      enforceMobileView();
      updateOffcanvasPlacement();
    });
  };

  const init = async () => {
    log('Initializing books page');
    hydrateStateFromUrl();
    enforceMobileView();
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

    const readyTasks = [loadReferenceData(), loadStats(), loadBooks()];
    await Promise.allSettled(readyTasks);

    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve({ success: true });
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
