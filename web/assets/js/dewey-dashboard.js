(function () {
  const log = (...args) => console.log('[DeweyDashboard]', ...args);
  const warn = (...args) => console.warn('[DeweyDashboard]', ...args);
  const errorLog = (...args) => console.error('[DeweyDashboard]', ...args);

  const EXPANDED_STORAGE_KEY = 'deweyDashboardExpanded';

  const state = {
    tree: [],
    selectedCode: null,
    expandedCodes: new Set(),
    searchQuery: '',
    searchResults: [],
    mode: 'descendants',
    booksLimit: 10,
    booksPage: 1,
    selectedNodePayload: null
  };

  const dom = {
    app: document.getElementById('deweyDashboardApp'),
    blockedState: document.getElementById('deweyBlockedState'),
    blockedMessage: document.getElementById('deweyBlockedMessage'),
    feedbackContainer: document.getElementById('feedbackContainer'),
    treeContainer: document.getElementById('treeContainer'),
    treeEmptyState: document.getElementById('treeEmptyState'),
    treeSearchInput: document.getElementById('treeSearchInput'),
    clearTreeSearchBtn: document.getElementById('clearTreeSearchBtn'),
    expandAllBtn: document.getElementById('expandAllBtn'),
    collapseAllBtn: document.getElementById('collapseAllBtn'),
    searchResultsWrap: document.getElementById('searchResultsWrap'),
    searchResultsContainer: document.getElementById('searchResultsContainer'),
    searchResultsEmptyState: document.getElementById('searchResultsEmptyState'),
    detailsLoadingState: document.getElementById('detailsLoadingState'),
    detailsEmptyState: document.getElementById('detailsEmptyState'),
    detailsContent: document.getElementById('detailsContent'),
    deweyHeading: document.getElementById('deweyHeading'),
    deweySubtitle: document.getElementById('deweySubtitle'),
    deweyBreadcrumb: document.getElementById('deweyBreadcrumb'),
    deweyExactCount: document.getElementById('deweyExactCount'),
    deweyDescendantCount: document.getElementById('deweyDescendantCount'),
    deweyChildCount: document.getElementById('deweyChildCount'),
    childNodesSummary: document.getElementById('childNodesSummary'),
    childNodesGrid: document.getElementById('childNodesGrid'),
    childNodesEmptyState: document.getElementById('childNodesEmptyState'),
    exactModeBtn: document.getElementById('exactModeBtn'),
    descendantsModeBtn: document.getElementById('descendantsModeBtn'),
    booksSummaryLine: document.getElementById('booksSummaryLine'),
    booksPerPageInput: document.getElementById('booksPerPageInput'),
    booksTableBody: document.getElementById('booksTableBody'),
    booksEmptyState: document.getElementById('booksEmptyState'),
    booksPaginationInfo: document.getElementById('booksPaginationInfo'),
    booksPaginationNav: document.getElementById('booksPaginationNav')
  };

  const apiFetch = window.apiFetch || window.fetch.bind(window);

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function placeholderCover(title) {
    const text = encodeURIComponent(title || 'Book Cover');
    return `https://placehold.co/120x180?text=${text}&font=Lora`;
  }

  function formatPartialDate(date) {
    if (!date) return '';
    if (date.text) return date.text;
    const parts = [];
    if (date.day) parts.push(String(date.day));
    if (date.month) parts.push(new Date(2000, date.month - 1, 1).toLocaleString(undefined, { month: 'long' }));
    if (date.year) parts.push(String(date.year));
    return parts.join(' ');
  }

  function extractAuthorNames(book) {
    if (!book || !Array.isArray(book.authors)) return [];
    return book.authors
      .map((author) => author?.authorName || author?.displayName || author?.name)
      .filter(Boolean);
  }

  function showAlert(message, type = 'danger', details = []) {
    if (!dom.feedbackContainer) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    const detailList = Array.isArray(details) && details.length
      ? `<ul class="mb-1 small text-muted">${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>`
      : '';
    alert.innerHTML = `
      <div class="fw-semibold mb-1">${escapeHtml(message)}</div>
      ${detailList}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    dom.feedbackContainer.innerHTML = '';
    dom.feedbackContainer.appendChild(alert);
  }

  function clearAlerts() {
    if (dom.feedbackContainer) dom.feedbackContainer.innerHTML = '';
  }

  function debounce(fn, delay = 250) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  async function readJson(response) {
    return response.json().catch(() => ({}));
  }

  async function fetchJson(path) {
    const response = await apiFetch(path, { method: 'GET' });
    if (response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      await window.rateLimitGuard.showModal();
      throw new Error('Rate limited');
    }
    const payload = await readJson(response);
    if (!response.ok) {
      const errors = Array.isArray(payload.errors) ? payload.errors : [];
      const message = payload.message || 'Request failed.';
      throw new Error(errors.length ? `${message}: ${errors.join(', ')}` : message);
    }
    return payload.data || payload;
  }

  function normalizeMode(value) {
    return value === 'exact' ? 'exact' : 'descendants';
  }

  function loadExpanded() {
    try {
      const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.expandedCodes = new Set(parsed.map((code) => String(code)));
      }
    } catch (error) {
      warn('Failed to restore expanded Dewey state.', error);
    }
  }

  function saveExpanded() {
    try {
      localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(Array.from(state.expandedCodes)));
    } catch (error) {
      warn('Failed to persist expanded Dewey state.', error);
    }
  }

  function hydrateStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) state.selectedCode = code;
    const q = params.get('q');
    if (q) state.searchQuery = q;
    state.mode = normalizeMode(params.get('mode'));
    const page = Number.parseInt(params.get('page'), 10);
    if (Number.isInteger(page) && page > 0) state.booksPage = page;
    const limit = Number.parseInt(params.get('limit'), 10);
    if (Number.isInteger(limit) && limit > 0) state.booksLimit = Math.min(50, limit);
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (state.selectedCode) params.set('code', state.selectedCode);
    if (state.searchQuery) params.set('q', state.searchQuery);
    params.set('mode', state.mode);
    params.set('page', String(state.booksPage));
    params.set('limit', String(state.booksLimit));
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', nextUrl);
  }

  function flattenNodes(nodes = [], list = []) {
    nodes.forEach((node) => {
      list.push(node);
      flattenNodes(node.children || [], list);
    });
    return list;
  }

  function findNodeByCode(code, nodes = state.tree) {
    const target = String(code || '');
    if (!target) return null;
    for (const node of nodes) {
      if (node.code === target) return node;
      const childMatch = findNodeByCode(target, node.children || []);
      if (childMatch) return childMatch;
    }
    return null;
  }

  function expandBreadcrumb(breadcrumb = []) {
    breadcrumb.forEach((part) => {
      if (part?.code) state.expandedCodes.add(String(part.code));
    });
    saveExpanded();
  }

  function renderTree() {
    if (!dom.treeContainer) return;
    dom.treeContainer.innerHTML = '';

    if (!state.tree.length) {
      dom.treeEmptyState?.classList.remove('d-none');
      return;
    }
    dom.treeEmptyState?.classList.add('d-none');

    const renderNode = (node, level) => {
      const children = Array.isArray(node.children) ? node.children : [];
      const hasChildren = children.length > 0;
      const isExpanded = state.expandedCodes.has(node.code);

      const nodeWrap = document.createElement('div');
      nodeWrap.className = `tree-node ${level === 0 ? 'tree-node-root' : ''}`;
      nodeWrap.style.setProperty('--level', level);

      const row = document.createElement('div');
      row.className = `node-row d-flex align-items-center justify-content-between gap-2 ${state.selectedCode === node.code ? 'selected' : ''}`;

      const left = document.createElement('div');
      left.className = 'd-flex align-items-center gap-2 flex-grow-1';

      const caret = document.createElement('button');
      caret.type = 'button';
      caret.className = `btn btn-sm btn-link text-muted p-0 tree-caret ${hasChildren ? '' : 'invisible'}`;
      caret.innerHTML = isExpanded ? '<i class="bi bi-chevron-down"></i>' : '<i class="bi bi-chevron-right"></i>';
      caret.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!hasChildren) return;
        if (state.expandedCodes.has(node.code)) state.expandedCodes.delete(node.code);
        else state.expandedCodes.add(node.code);
        saveExpanded();
        renderTree();
      });

      const titleWrap = document.createElement('div');
      titleWrap.className = 'd-flex flex-column';
      titleWrap.innerHTML = `
        <div class="fw-semibold">${escapeHtml(node.code)}</div>
        <div class="small text-muted">${escapeHtml(node.caption || 'No caption')}</div>
      `;

      const badge = document.createElement('span');
      badge.className = 'badge rounded-pill text-bg-light text-dark border tree-count';
      badge.textContent = String(node.descendantBookCount ?? 0);

      left.appendChild(caret);
      left.appendChild(titleWrap);
      left.appendChild(badge);
      row.appendChild(left);
      row.addEventListener('click', () => selectNode(node.code));

      nodeWrap.appendChild(row);
      dom.treeContainer.appendChild(nodeWrap);

      if (hasChildren && isExpanded) {
        children.forEach((child) => renderNode(child, level + 1));
      }
    };

    state.tree.forEach((root) => renderNode(root, 0));
  }

  function renderSearchResults() {
    if (!dom.searchResultsWrap || !dom.searchResultsContainer || !dom.searchResultsEmptyState) return;

    const query = state.searchQuery.trim();
    const results = Array.isArray(state.searchResults) ? state.searchResults : [];
    const showWrap = query.length > 0;
    dom.searchResultsWrap.classList.toggle('d-none', !showWrap);
    dom.searchResultsContainer.innerHTML = '';

    if (!showWrap) {
      dom.searchResultsEmptyState.classList.add('d-none');
      return;
    }

    if (!results.length) {
      dom.searchResultsEmptyState.classList.remove('d-none');
      return;
    }

    dom.searchResultsEmptyState.classList.add('d-none');
    results.forEach((result) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'result-item text-start bg-body';
      const breadcrumb = Array.isArray(result.breadcrumb) ? result.breadcrumb.map((part) => part.caption || part.code).join(' > ') : '';
      button.innerHTML = `
        <div class="fw-semibold">${escapeHtml(result.code)}${result.caption ? ` <span class="text-muted fw-normal">• ${escapeHtml(result.caption)}</span>` : ''}</div>
        <div class="small text-muted">${escapeHtml(breadcrumb || 'No broader path available')}</div>
      `;
      button.addEventListener('click', () => {
        selectNode(result.code);
      });
      dom.searchResultsContainer.appendChild(button);
    });
  }

  function syncModeButtons() {
    if (!dom.exactModeBtn || !dom.descendantsModeBtn) return;
    dom.exactModeBtn.classList.toggle('active', state.mode === 'exact');
    dom.descendantsModeBtn.classList.toggle('active', state.mode === 'descendants');
  }

  function renderBreadcrumb(breadcrumb = []) {
    if (!dom.deweyBreadcrumb) return;
    dom.deweyBreadcrumb.innerHTML = breadcrumb.length
      ? breadcrumb.map((part) => `<span class="badge text-bg-light border text-dark me-1">${escapeHtml(part.caption || part.code)} <span class="text-muted">${escapeHtml(part.code)}</span></span>`).join('')
      : '<span class="text-muted small">No broader path available.</span>';
  }

  function renderChildNodes(children = []) {
    if (!dom.childNodesGrid || !dom.childNodesEmptyState || !dom.childNodesSummary) return;
    dom.childNodesGrid.innerHTML = '';
    if (!children.length) {
      dom.childNodesEmptyState.classList.remove('d-none');
      dom.childNodesSummary.textContent = 'No child nodes found.';
      return;
    }

    dom.childNodesEmptyState.classList.add('d-none');
    dom.childNodesSummary.textContent = `${children.length} child node${children.length === 1 ? '' : 's'}`;
    children.forEach((child) => {
      const col = document.createElement('div');
      col.className = 'col-12 col-lg-6';
      col.innerHTML = `
        <div class="child-card h-100">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div class="fw-semibold">${escapeHtml(child.code)}</div>
              <div class="text-muted small">${escapeHtml(child.caption || 'No caption')}</div>
            </div>
            <span class="badge text-bg-light border text-dark">${escapeHtml(String(child.descendantBookCount ?? 0))}</span>
          </div>
        </div>
      `;
      col.querySelector('.child-card')?.addEventListener('click', () => selectNode(child.code));
      dom.childNodesGrid.appendChild(col);
    });
  }

  function renderBooksTable(booksState) {
    if (!dom.booksTableBody || !dom.booksEmptyState || !dom.booksPaginationInfo || !dom.booksPaginationNav) return;
    const books = Array.isArray(booksState?.items) ? booksState.items : [];
    const total = Number.isInteger(booksState?.total) ? booksState.total : books.length;
    const page = Number.isInteger(booksState?.page) ? booksState.page : 1;
    const limit = Number.isInteger(booksState?.limit) ? booksState.limit : books.length;

    dom.booksTableBody.innerHTML = '';
    if (!books.length) {
      dom.booksEmptyState.classList.remove('d-none');
      dom.booksPaginationNav.classList.add('d-none');
      dom.booksPaginationInfo.textContent = '0 books';
      return;
    }

    dom.booksEmptyState.classList.add('d-none');

    books.forEach((book) => {
      const coverUrl = book.coverImageUrl || placeholderCover(book.title);
      const publication = formatPartialDate(book.publicationDate);
      const authorNames = extractAuthorNames(book);
      const authorText = authorNames.length
        ? authorNames.slice(0, 2).join(', ') + (authorNames.length > 2 ? `, +${authorNames.length - 2} more` : '')
        : '';
      const languageNames = Array.isArray(book.languages)
        ? book.languages.map((language) => language?.name || language).filter(Boolean)
        : [];
      const languageText = languageNames.slice(0, 2).join(', ') + (languageNames.length > 2 ? `, +${languageNames.length - 2} more` : '');
      const tags = Array.isArray(book.tags) ? book.tags : [];
      const visibleTags = tags.slice(0, 3);
      const remainingTags = Math.max(0, tags.length - visibleTags.length);

      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.dataset.rowHref = `book-details?id=${book.id}`;
      row.setAttribute('role', 'link');
      row.setAttribute('tabindex', '0');
      row.addEventListener('click', (event) => {
        if (event.target.closest('a, button, [data-no-row-nav]')) return;
        window.location.href = row.dataset.rowHref;
      });
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.href = row.dataset.rowHref;
        }
      });

      row.innerHTML = `
        <td class="list-col-book">
          <div class="d-flex align-items-center gap-3">
            <img class="cover-thumb rounded border" alt="Cover" src="${escapeHtml(coverUrl)}" onerror="this.onerror=null;this.src='${placeholderCover(book.title)}';" />
            <div style="min-width: 220px;">
              <div class="fw-semibold">${escapeHtml(book.title || 'Untitled')}</div>
              <div class="text-muted small ${authorText ? '' : 'd-none'}">by ${escapeHtml(authorText)}</div>
            </div>
          </div>
        </td>
        <td class="list-col-authors">${escapeHtml(authorText)}</td>
        <td class="list-col-type">${escapeHtml(book.bookTypeName || '')}</td>
        <td class="list-col-language">${escapeHtml(languageText)}</td>
        <td class="list-col-published">${escapeHtml(publication)}</td>
        <td class="list-col-tags">${visibleTags.map((tag) => `<span class="badge rounded-pill text-bg-light text-dark border">${escapeHtml(tag?.name || tag)}</span>`).join(' ')}${remainingTags > 0 ? ` <span class="badge rounded-pill text-bg-light text-dark border">+${remainingTags}</span>` : ''}</td>
      `;

      dom.booksTableBody.appendChild(row);
    });

    const start = (page - 1) * limit + 1;
    const end = Math.min(start + books.length - 1, total);
    dom.booksPaginationInfo.textContent = `${start} to ${end} of ${total}`;

    const totalPages = Math.max(1, Math.ceil(total / limit));
    dom.booksPaginationNav.innerHTML = '';
    dom.booksPaginationNav.classList.toggle('d-none', totalPages <= 1);

    const createPageItem = (pageNumber, label, disabled = false, active = false) => {
      const li = document.createElement('li');
      li.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'page-link';
      link.textContent = label;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        if (disabled || active) return;
        state.booksPage = pageNumber;
        updateUrl();
        loadSelectedNode();
      });
      li.appendChild(link);
      return li;
    };

    dom.booksPaginationNav.appendChild(createPageItem(page - 1, 'Previous', page <= 1));
    for (let currentPage = 1; currentPage <= totalPages; currentPage += 1) {
      dom.booksPaginationNav.appendChild(createPageItem(currentPage, String(currentPage), false, currentPage === page));
    }
    dom.booksPaginationNav.appendChild(createPageItem(page + 1, 'Next', page >= totalPages));
  }

  function renderSelectedNode(payload) {
    state.selectedNodePayload = payload;
    const node = payload?.node || null;
    if (!node) {
      dom.detailsLoadingState?.classList.add('d-none');
      dom.detailsContent?.classList.add('d-none');
      dom.detailsEmptyState?.classList.remove('d-none');
      return;
    }

    dom.detailsLoadingState?.classList.add('d-none');
    dom.detailsEmptyState?.classList.add('d-none');
    dom.detailsContent?.classList.remove('d-none');

    dom.deweyHeading.textContent = node.code;
    dom.deweySubtitle.textContent = node.caption || 'No caption is available for this node.';
    dom.deweyExactCount.textContent = String(node.exactBookCount ?? 0);
    dom.deweyDescendantCount.textContent = String(node.descendantBookCount ?? 0);
    dom.deweyChildCount.textContent = String(node.childCount ?? 0);
    dom.booksSummaryLine.textContent = state.mode === 'exact'
      ? 'Showing books assigned exactly to this Dewey code.'
      : 'Showing books assigned to this Dewey code and its descendant nodes.';

    renderBreadcrumb(node.breadcrumb || []);
    renderChildNodes(payload.childNodes || []);
    renderBooksTable(payload.books || { items: [] });
    syncModeButtons();
  }

  async function loadTree() {
    const data = await fetchJson('/dewey/roots');
    state.tree = Array.isArray(data.nodes) ? data.nodes : [];
    renderTree();
  }

  async function loadSearchResults() {
    const query = state.searchQuery.trim();
    if (!query) {
      state.searchResults = [];
      renderSearchResults();
      return;
    }

    try {
      const data = await fetchJson(`/dewey/search?q=${encodeURIComponent(query)}&limit=15`);
      state.searchResults = Array.isArray(data.results) ? data.results : [];
      renderSearchResults();
    } catch (error) {
      warn('Failed to search Dewey nodes.', error);
      state.searchResults = [];
      renderSearchResults();
    }
  }

  async function loadSelectedNode() {
    if (!state.selectedCode) {
      renderSelectedNode(null);
      return;
    }

    try {
      dom.detailsLoadingState?.classList.remove('d-none');
      dom.detailsContent?.classList.add('d-none');
      dom.detailsEmptyState?.classList.add('d-none');

      const data = await fetchJson(`/dewey/node/${encodeURIComponent(state.selectedCode)}?mode=${encodeURIComponent(state.mode)}&page=${encodeURIComponent(state.booksPage)}&limit=${encodeURIComponent(state.booksLimit)}`);
      renderSelectedNode(data);
      expandBreadcrumb(data?.node?.breadcrumb || []);
      renderTree();
    } catch (error) {
      errorLog('Failed to load Dewey node.', error);
      showAlert('Failed to load the selected Dewey node.', 'danger', [error.message || 'Unknown error']);
      dom.detailsLoadingState?.classList.add('d-none');
      dom.detailsContent?.classList.add('d-none');
      dom.detailsEmptyState?.classList.remove('d-none');
      dom.detailsEmptyState.textContent = 'Unable to load this Dewey node right now.';
    }
  }

  function selectNode(code) {
    state.selectedCode = String(code);
    state.booksPage = 1;
    const selected = findNodeByCode(state.selectedCode);
    if (selected?.breadcrumb) expandBreadcrumb(selected.breadcrumb);
    updateUrl();
    clearAlerts();
    loadSelectedNode();
    renderTree();
  }

  function showBlockedState(featureState) {
    dom.blockedState?.classList.remove('d-none');
    dom.app?.classList.add('d-none');
    const available = Boolean(featureState?.available);
    dom.blockedMessage.textContent = available
      ? 'Turn Dewey Decimal support on in Account settings to browse the Dewey Dashboard.'
      : 'Dewey Decimal support is not currently available for this deployment.';
  }

  function showDashboardApp() {
    dom.blockedState?.classList.add('d-none');
    dom.app?.classList.remove('d-none');
  }

  function expandAllTreeNodes() {
    flattenNodes(state.tree).forEach((node) => {
      if ((node.children || []).length > 0) state.expandedCodes.add(node.code);
    });
    saveExpanded();
    renderTree();
  }

  function bindEvents() {
    dom.expandAllBtn?.addEventListener('click', expandAllTreeNodes);
    dom.collapseAllBtn?.addEventListener('click', () => {
      state.expandedCodes.clear();
      saveExpanded();
      renderTree();
    });
    dom.clearTreeSearchBtn?.addEventListener('click', () => {
      state.searchQuery = '';
      state.searchResults = [];
      if (dom.treeSearchInput) dom.treeSearchInput.value = '';
      updateUrl();
      renderSearchResults();
    });
    dom.treeSearchInput?.addEventListener('input', debounce((event) => {
      state.searchQuery = event.target.value || '';
      updateUrl();
      loadSearchResults();
    }, 250));
    dom.exactModeBtn?.addEventListener('click', () => {
      if (state.mode === 'exact') return;
      state.mode = 'exact';
      state.booksPage = 1;
      updateUrl();
      loadSelectedNode();
    });
    dom.descendantsModeBtn?.addEventListener('click', () => {
      if (state.mode === 'descendants') return;
      state.mode = 'descendants';
      state.booksPage = 1;
      updateUrl();
      loadSelectedNode();
    });
    dom.booksPerPageInput?.addEventListener('change', () => {
      const parsed = Number.parseInt(dom.booksPerPageInput.value, 10);
      state.booksLimit = Number.isInteger(parsed) ? Math.max(1, Math.min(50, parsed)) : 10;
      dom.booksPerPageInput.value = String(state.booksLimit);
      state.booksPage = 1;
      updateUrl();
      loadSelectedNode();
    });
  }

  async function init() {
    log('Initializing Dewey Dashboard.');
    loadExpanded();
    hydrateStateFromUrl();
    if (dom.treeSearchInput) dom.treeSearchInput.value = state.searchQuery;
    if (dom.booksPerPageInput) dom.booksPerPageInput.value = String(state.booksLimit);
    bindEvents();

    const featureState = await window.deweyClient?.loadFeatureState?.();
    if (!featureState?.available || !featureState?.enabled) {
      showBlockedState(featureState || { available: false, enabled: false });
      return;
    }

    showDashboardApp();

    try {
      await loadTree();
      await loadSearchResults();

      if (!state.selectedCode && state.tree.length > 0) {
        state.selectedCode = state.tree[0].code;
      }
      if (state.selectedCode) {
        await loadSelectedNode();
        updateUrl();
      }
    } catch (error) {
      errorLog('Failed to initialize Dewey Dashboard.', error);
      showAlert('Failed to load the Dewey Dashboard.', 'danger', [error.message || 'Unknown error']);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
