// Books page logic: fetch, filter, render card/list views, and sync URL state.
(function () {
  const log = (...args) => console.log('[Books]', ...args);
  const warn = (...args) => console.warn('[Books]', ...args);
  const errorLog = (...args) => console.error('[Books]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const DEBUG = window.location.search.includes('booksDebug=true') || localStorage.getItem('booksDebug') === 'true';
  const debugLog = (...args) => {
    if (DEBUG) console.log('[Books][debug]', ...args);
  };

  const state = {
    view: 'card',
    sort: { field: 'title', order: 'asc' },
    limit: 12,
    page: 1,
    search: '',
    filters: {
      title: '',
      subtitle: '',
      isbn: '',
      tag: '',
      bookTypeId: '',
      publisherId: '',
      authorId: '',
      seriesId: '',
      pageMin: '',
      pageMax: '',
      publishedAfter: '',
      publishedBefore: '',
      languageIds: [],
      includeDeleted: false,
      onlyWithCover: false
    }
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
    filterBookType: document.getElementById('filterBookType'),
    filterPublisher: document.getElementById('filterPublisher'),
    filterAuthor: document.getElementById('filterAuthor'),
    filterSeries: document.getElementById('filterSeries'),
    filterTag: document.getElementById('filterTag'),
    tagOptions: document.getElementById('tagOptions'),
    filterLanguages: document.getElementById('filterLanguages'),
    selectedLanguagesPills: document.getElementById('selectedLanguagesPills'),
    clearLanguagesBtn: document.getElementById('clearLanguagesBtn'),
    filterPageMin: document.getElementById('filterPageMin'),
    filterPageMax: document.getElementById('filterPageMax'),
    filterPublishedAfter: document.getElementById('filterPublishedAfter'),
    filterPublishedBefore: document.getElementById('filterPublishedBefore'),
    includeDeletedCheck: document.getElementById('includeDeletedCheck'),
    onlyWithCoverCheck: document.getElementById('onlyWithCoverCheck'),
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
    state.filters.tag = params.get('filterTag') || '';
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
    if (f.tag) params.set('filterTag', f.tag);
    if (f.bookTypeId) params.set('filterBookTypeId', f.bookTypeId);
    if (f.publisherId) params.set('filterPublisherId', f.publisherId);
    if (f.authorId) params.set('filterAuthorId', f.authorId);
    if (f.seriesId) params.set('filterSeriesId', f.seriesId);
    if (f.pageMin) params.set('filterPageMin', f.pageMin);
    if (f.pageMax) params.set('filterPageMax', f.pageMax);
    if (isIsoDate(f.publishedAfter)) params.set('filterPublishedAfter', f.publishedAfter);
    if (isIsoDate(f.publishedBefore)) params.set('filterPublishedBefore', f.publishedBefore);
    if (f.includeDeleted) params.set('includeDeleted', 'true');
    if (f.onlyWithCover) params.set('onlyWithCover', 'true');
    if (f.languageIds.length > 0) params.set('languages', f.languageIds.join(','));

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
    if (dom.filterTag) dom.filterTag.value = f.tag;
    if (dom.filterBookType) dom.filterBookType.value = f.bookTypeId || '';
    if (dom.filterPublisher) dom.filterPublisher.value = f.publisherId || '';
    if (dom.filterAuthor) dom.filterAuthor.value = f.authorId || '';
    if (dom.filterSeries) dom.filterSeries.value = f.seriesId || '';
    if (dom.filterPageMin) dom.filterPageMin.value = f.pageMin;
    if (dom.filterPageMax) dom.filterPageMax.value = f.pageMax;
    if (dom.filterPublishedAfter) dom.filterPublishedAfter.value = f.publishedAfter;
    if (dom.filterPublishedBefore) dom.filterPublishedBefore.value = f.publishedBefore;
    if (dom.includeDeletedCheck) dom.includeDeletedCheck.checked = f.includeDeleted;
    if (dom.onlyWithCoverCheck) dom.onlyWithCoverCheck.checked = f.onlyWithCover;

    if (dom.filterLanguages && dom.filterLanguages.options) {
      Array.from(dom.filterLanguages.options).forEach((opt) => {
        const id = parseNumber(opt.value);
        opt.selected = id !== null && f.languageIds.includes(id);
      });
    }

    setViewButtons();
    renderLanguagePills();
  };

  const renderActiveFilters = () => {
    if (!dom.activeFilters) return;
    dom.activeFilters.innerHTML = '';
    const chips = [];
    const pushChip = (label, value, onRemove) => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      chip.innerHTML = `<span class="badge text-bg-secondary">${label}</span> ${value} <button type="button" class="btn-close btn-close-sm ms-1" aria-label="Remove filter"></button>`;
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
    if (f.tag) pushChip('tag', f.tag, () => { f.tag = ''; syncControlsFromState(); triggerFetch(); });
    if (f.bookTypeId && dom.filterBookType) {
      const text = dom.filterBookType.selectedOptions[0]?.textContent || f.bookTypeId;
      pushChip('type', text, () => { f.bookTypeId = ''; syncControlsFromState(); triggerFetch(); });
    }
    if (f.publisherId && dom.filterPublisher) {
      const text = dom.filterPublisher.selectedOptions[0]?.textContent || f.publisherId;
      pushChip('publisher', text, () => { f.publisherId = ''; syncControlsFromState(); triggerFetch(); });
    }
    if (f.authorId && dom.filterAuthor) {
      const text = dom.filterAuthor.selectedOptions[0]?.textContent || f.authorId;
      pushChip('author', text, () => { f.authorId = ''; syncControlsFromState(); triggerFetch(); });
    }
    if (f.seriesId && dom.filterSeries) {
      const text = dom.filterSeries.selectedOptions[0]?.textContent || f.seriesId;
      pushChip('series', text, () => { f.seriesId = ''; syncControlsFromState(); triggerFetch(); });
    }
    if (f.pageMin) pushChip('pages ≥', f.pageMin, () => { f.pageMin = ''; syncControlsFromState(); triggerFetch(); });
    if (f.pageMax) pushChip('pages ≤', f.pageMax, () => { f.pageMax = ''; syncControlsFromState(); triggerFetch(); });
    if (isIsoDate(f.publishedAfter)) pushChip('published after', f.publishedAfter, () => { f.publishedAfter = ''; syncControlsFromState(); triggerFetch(); });
    if (isIsoDate(f.publishedBefore)) pushChip('published before', f.publishedBefore, () => { f.publishedBefore = ''; syncControlsFromState(); triggerFetch(); });
    if (f.includeDeleted) pushChip('include deleted', 'on', () => { f.includeDeleted = false; syncControlsFromState(); triggerFetch(); });
    if (f.onlyWithCover) pushChip('with cover', 'required', () => { f.onlyWithCover = false; syncControlsFromState(); triggerFetch(); });
    if (f.languageIds.length && dom.filterLanguages) {
      const names = Array.from(dom.filterLanguages.selectedOptions).map((opt) => opt.textContent.trim()).join(', ');
      pushChip('languages', names || f.languageIds.join(','), () => { f.languageIds = []; syncControlsFromState(); triggerFetch(); });
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
      more.className = 'filter-chip';
      more.textContent = `+${moreCount} more`;
      dom.activeFilters.appendChild(more);
    } else {
      chips.forEach((chip) => dom.activeFilters.appendChild(chip));
    }

    if (dom.clearAllFiltersBtn) {
      dom.clearAllFiltersBtn.classList.toggle('d-none', chips.length === 0);
    }
  };

  const renderLanguagePills = () => {
    if (!dom.selectedLanguagesPills) return;
    dom.selectedLanguagesPills.innerHTML = '';
    if (!state.filters.languageIds.length) {
      const muted = document.createElement('span');
      muted.className = 'text-muted small';
      muted.textContent = 'No languages selected';
      dom.selectedLanguagesPills.appendChild(muted);
      return;
    }
    const languageOptions = Array.from(dom.filterLanguages?.options || []);
      state.filters.languageIds.forEach((id) => {
        const match = languageOptions.find((opt) => parseNumber(opt.value) === id);
        const pill = document.createElement('span');
        pill.className = 'filter-chip';
        pill.innerHTML = `<span class="badge text-bg-secondary">language</span> ${match ? match.textContent.trim() : id} <button type="button" class="btn-close btn-close-sm" aria-label="Remove language"></button>`;
      const btn = pill.querySelector('button');
      if (btn) {
        btn.addEventListener('click', () => {
          state.filters.languageIds = state.filters.languageIds.filter((langId) => langId !== id);
          syncControlsFromState();
          triggerFetch();
        });
      }
      dom.selectedLanguagesPills.appendChild(pill);
    });
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
      body.filterSubtitle = state.search;
      const isbn = normalizeIsbn(state.search);
      if (isbn) body.filterIsbn = isbn;
      body.filterTag = state.search;
    }
    if (f.title) body.filterTitle = f.title;
    if (f.subtitle) body.filterSubtitle = f.subtitle;
    if (f.isbn) {
      const cleanIsbn = normalizeIsbn(f.isbn);
      if (cleanIsbn) body.filterIsbn = cleanIsbn;
    }
    if (f.tag) body.filterTag = f.tag;
    if (f.bookTypeId) body.filterBookTypeId = f.bookTypeId;
    if (f.publisherId) body.filterPublisherId = f.publisherId;
    if (f.authorId) body.filterAuthorId = f.authorId;
    if (f.seriesId) body.filterSeriesId = f.seriesId;
    if (f.pageMin) body.filterPageMin = f.pageMin;
    if (f.pageMax) body.filterPageMax = f.pageMax;
    if (isIsoDate(f.publishedAfter)) body.filterPublishedAfter = f.publishedAfter;
    if (isIsoDate(f.publishedBefore)) body.filterPublishedBefore = f.publishedBefore;
    if (f.languageIds.length > 0) {
      body.filterLanguageId = f.languageIds[0];
      const languageOptions = Array.from(dom.filterLanguages?.options || []);
      const name = languageOptions.find((opt) => parseNumber(opt.value) === f.languageIds[0])?.textContent?.trim();
      if (name) body.filterLanguage = name.toLowerCase();
    }
    if (f.includeDeleted) body.includeDeleted = true;

    return body;
  };

  let currentRequestId = 0;

  const applyClientSideFilters = (books) => {
    let filtered = books;
    if (state.filters.languageIds.length > 0) {
      const languageSet = new Set(state.filters.languageIds);
      filtered = filtered.filter((book) => Array.isArray(book.languages) && book.languages.some((lang) => languageSet.has(lang.id)));
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

    const current = document.createElement('li');
    current.className = 'page-item active';
    const span = document.createElement('span');
    span.className = 'page-link';
    span.textContent = String(state.page);
    current.appendChild(span);
    dom.paginationNav.appendChild(current);

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
      empty.innerHTML = '<div class="alert alert-secondary mb-0">No books match your filters.</div>';
      dom.cardsContainer.appendChild(empty);
      return;
    }

    books.forEach((book) => {
      const col = document.createElement('div');
      col.className = 'col-12 col-sm-6 col-lg-4 col-xl-3';
      const coverSrc = book.coverImageUrl || placeholderCover(book.title, '140x180', 'No cover');
      const publication = formatPartialDate(book.publicationDate) || 'Unknown';
      const pageCount = Number.isFinite(book.pageCount) ? book.pageCount : '—';
      const bookType = book.bookTypeName || 'Unspecified';
      const language = Array.isArray(book.languages) && book.languages.length > 0
        ? book.languages.map((l) => l.name).join(', ')
        : '—';
      const tags = Array.isArray(book.tags) ? book.tags : [];
      const primaryTag = tags[0];
      const extraTags = tags.slice(1, 3);
      const remaining = Math.max(tags.length - 3, 0);

      col.innerHTML = `
        <div class="card shadow h-100">
          <div class="position-relative">
            <img class="cover-card rounded-top" alt="Book cover" src="${coverSrc}" onerror="this.onerror=null;this.src='${placeholderCover(book.title)}';" />
          </div>
          <div class="card-body d-flex flex-column">
            <div class="fw-bold meta-line">${book.title || 'Untitled'}</div>
            <div class="text-muted small meta-line">${book.subtitle || ''}</div>
            <div class="mt-2 small text-muted">
              <div class="d-flex justify-content-between"><span class="meta-label">Published</span><span class="meta-value">${publication}</span></div>
              <div class="d-flex justify-content-between"><span class="meta-label">Pages</span><span class="meta-value">${pageCount}</span></div>
              <div class="d-flex justify-content-between"><span class="meta-label">Type</span><span class="meta-value">${bookType}</span></div>
              <div class="d-flex justify-content-between"><span class="meta-label">Language</span><span class="meta-value">${language}</span></div>
            </div>
            <div class="mt-3 d-flex flex-wrap gap-1">
              ${primaryTag ? `<span class="badge rounded-pill text-bg-primary">${primaryTag.name}</span>` : ''}
              ${extraTags.map((tag) => `<span class="badge rounded-pill text-bg-light text-dark border">${tag.name}</span>`).join('')}
              ${remaining > 0 ? `<span class="badge rounded-pill text-bg-light text-dark border">+${remaining} more</span>` : ''}
            </div>
            <div class="mt-auto pt-3 d-flex gap-2">
              <a class="btn btn-primary btn-sm w-100" href="book-details.html?id=${book.id}">Open</a>
              <button class="btn btn-outline-secondary btn-sm w-100" type="button" disabled aria-disabled="true">Edit</button>
            </div>
          </div>
        </div>
      `;
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
      cell.colSpan = 6;
      cell.className = 'text-center text-muted py-4';
      cell.textContent = 'No books match your filters.';
      row.appendChild(cell);
      dom.listTableBody.appendChild(row);
      return;
    }

    books.forEach((book) => {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.addEventListener('click', () => {
        window.location.href = `book-details.html?id=${book.id}`;
      });

      const coverSrc = book.coverImageUrl || placeholderCover(book.title, '600x900', 'No cover');
      const publication = formatPartialDate(book.publicationDate) || 'Unknown';
      const pageCount = Number.isFinite(book.pageCount) ? book.pageCount : '—';
      const bookType = book.bookTypeName || book.bookType?.name || '—';
      const language = Array.isArray(book.languages) && book.languages.length > 0
        ? book.languages.map((l) => l.name).join(', ')
        : '—';
      const tags = Array.isArray(book.tags) ? book.tags : [];
      const visibleTags = tags.slice(0, 3);
      const remaining = Math.max(tags.length - visibleTags.length, 0);
      const infoLineParts = [];
      if (book.subtitle) infoLineParts.push(book.subtitle);
      if (book.isbn) infoLineParts.push(`ISBN: ${book.isbn}`);

      row.innerHTML = `
        <td>
          <div class="d-flex align-items-center gap-3">
            <img class="cover-thumb rounded border" alt="Cover" src="${coverSrc}" onerror="this.onerror=null;this.src='${placeholderCover(book.title)}';" />
            <div style="min-width: 220px;">
              <div class="fw-semibold meta-line">${book.title || 'Untitled'}</div>
              <div class="text-muted small meta-line">${infoLineParts.join(' • ') || '—'}</div>
            </div>
          </div>
        </td>
        <td>${bookType}</td>
        <td>${language}</td>
        <td>${pageCount}</td>
        <td>${publication}</td>
        <td>${visibleTags.map((tag, index) => `<span class="badge rounded-pill ${index === 0 ? 'text-bg-primary' : 'text-bg-light text-dark border'}">${tag.name}</span>`).join(' ')}${remaining > 0 ? ` <span class="badge rounded-pill text-bg-light text-dark border">+${remaining}</span>` : ''}</td>
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
    if (dom.resultsSummary) dom.resultsSummary.textContent = `${count} book${count === 1 ? '' : 's'} found`;
    if (dom.resultsMeta) dom.resultsMeta.textContent = `${sortLabel ? `Sorted by ${sortLabel}` : 'Sorted'} • Page ${state.page}`;
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

  const loadSelectOptions = async ({ url, target, labelKey = 'name', valueKey = 'id' }) => {
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
      target.innerHTML = target.multiple ? '' : '<option value="">Any</option>';
      list.forEach((item) => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item[labelKey];
        target.appendChild(option);
      });
      // Re-apply any state selections
      syncControlsFromState();
    } catch (error) {
      warn('Failed to load select options', url, error);
      showAlert({ message: 'Unable to load filter options.', details: [url] });
    }
  };

  const loadTags = async () => {
    if (!dom.tagOptions) return;
    try {
      const response = await apiFetch('/tags', { method: 'GET' });
      if (await handleRateLimit(response)) return;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const tags = (payload.data && payload.data.tags) || [];
      dom.tagOptions.innerHTML = '';
      tags.forEach((tag) => {
        const option = document.createElement('option');
        option.value = tag.name;
        dom.tagOptions.appendChild(option);
      });
    } catch (error) {
      warn('Failed to load tags', error);
    }
  };

  const loadReferenceData = async () => {
    const tasks = [
      loadSelectOptions({ url: '/booktype?nameOnly=true&sortBy=name&order=asc&limit=200', target: dom.filterBookType }),
      loadSelectOptions({ url: '/publisher?nameOnly=true&sortBy=name&order=asc&limit=200', target: dom.filterPublisher }),
      loadSelectOptions({ url: '/author?nameOnly=true&sortBy=displayName&order=asc&limit=200', target: dom.filterAuthor, labelKey: 'displayName' }),
      loadSelectOptions({ url: '/bookseries?nameOnly=true&sortBy=name&order=asc&limit=200', target: dom.filterSeries }),
      loadSelectOptions({ url: '/languages', target: dom.filterLanguages }),
      loadTags()
    ];
    await Promise.allSettled(tasks);
    renderLanguagePills();
  };

  const triggerFetch = debounce(() => {
    state.page = Math.max(1, state.page);
    updateUrl();
    loadBooks();
  }, 150);

  const loadBooks = async () => {
    const requestId = ++currentRequestId;
    clearAlerts();
    showLoading();

    const body = buildBookBody();
    debugLog('Requesting /book with body', body);
    try {
      const response = await apiFetch('/book', {
        method: 'GET',
        body: JSON.stringify(body)
      });
      if (await handleRateLimit(response)) {
        hideLoading();
        return;
      }
      const payload = await response.json().catch(() => ({}));
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
    state.search = '';
    state.page = 1;
    Object.assign(state.filters, {
      title: '',
      subtitle: '',
      isbn: '',
      tag: '',
      bookTypeId: '',
      publisherId: '',
      authorId: '',
      seriesId: '',
      pageMin: '',
      pageMax: '',
      publishedAfter: '',
      publishedBefore: '',
      languageIds: [],
      includeDeleted: false,
      onlyWithCover: false
    });
    syncControlsFromState();
    triggerFetch();
  };

  const attachListeners = () => {
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', debounce((event) => {
        state.search = event.target.value.trim();
        state.page = 1;
        triggerFetch();
      }, 250));
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

    const filterInputs = [
      dom.filterTitle,
      dom.filterSubtitle,
      dom.filterIsbn,
      dom.filterTag,
      dom.filterPageMin,
      dom.filterPageMax,
      dom.filterPublishedAfter,
      dom.filterPublishedBefore
    ];
    filterInputs.forEach((input) => {
      if (!input) return;
      input.addEventListener('input', debounce(() => {
        state.filters.title = dom.filterTitle?.value.trim() || '';
        state.filters.subtitle = dom.filterSubtitle?.value.trim() || '';
        state.filters.isbn = dom.filterIsbn?.value.trim() || '';
        state.filters.tag = dom.filterTag?.value.trim() || '';
        state.filters.pageMin = dom.filterPageMin?.value.trim() || '';
        state.filters.pageMax = dom.filterPageMax?.value.trim() || '';
        state.filters.publishedAfter = dom.filterPublishedAfter?.value || '';
        state.filters.publishedBefore = dom.filterPublishedBefore?.value || '';
        state.page = 1;
        triggerFetch();
      }, 300));
    });

    const selectFilters = [
      { element: dom.filterBookType, key: 'bookTypeId' },
      { element: dom.filterPublisher, key: 'publisherId' },
      { element: dom.filterAuthor, key: 'authorId' },
      { element: dom.filterSeries, key: 'seriesId' }
    ];
    selectFilters.forEach(({ element, key }) => {
      if (!element) return;
      element.addEventListener('change', (event) => {
        state.filters[key] = event.target.value;
        state.page = 1;
        triggerFetch();
      });
    });

    if (dom.filterLanguages) {
      dom.filterLanguages.addEventListener('change', () => {
        const selected = Array.from(dom.filterLanguages.selectedOptions)
          .map((opt) => parseNumber(opt.value))
          .filter((id) => Number.isInteger(id));
        state.filters.languageIds = selected;
        state.page = 1;
        triggerFetch();
        renderLanguagePills();
      });
    }

    if (dom.clearLanguagesBtn) {
      dom.clearLanguagesBtn.addEventListener('click', () => {
        state.filters.languageIds = [];
        syncControlsFromState();
        triggerFetch();
      });
    }

    if (dom.includeDeletedCheck) {
      dom.includeDeletedCheck.addEventListener('change', (event) => {
        state.filters.includeDeleted = event.target.checked;
        state.page = 1;
        triggerFetch();
      });
    }

    if (dom.onlyWithCoverCheck) {
      dom.onlyWithCoverCheck.addEventListener('change', (event) => {
        state.filters.onlyWithCover = event.target.checked;
        state.page = 1;
        triggerFetch();
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
        window.open('temp/books.html', '_blank', 'noopener');
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
