(function () {
  const log = (...args) => console.log('[AdminLibrary]', ...args);
  const errorLog = (...args) => console.error('[AdminLibrary]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const dom = {
    librarySubtitle: document.getElementById('librarySubtitle'),
    refreshBtn: document.getElementById('refreshBtn'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    perPageSelect: document.getElementById('perPageSelect'),
    includeDeleted: document.getElementById('includeDeleted'),
    feedbackContainer: document.getElementById('feedbackContainer'),
    resultsSummary: document.getElementById('resultsSummary'),
    resultsMeta: document.getElementById('resultsMeta'),
    listCount: document.getElementById('listCount'),
    table: document.getElementById('libraryTable'),
    paginationNav: document.getElementById('paginationNav')
  };

  const state = {
    userId: null,
    search: '',
    sort: { field: 'title', order: 'asc' },
    limit: 20,
    page: 1,
    includeDeleted: false,
    data: []
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

  const showAlert = ({ message, type = 'danger' }) => {
    if (!dom.feedbackContainer) return;
    dom.feedbackContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        <div class="fw-semibold">${escapeHtml(message || 'Something went wrong.')}</div>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  };

  const parseQuery = () => {
    const params = new URLSearchParams(window.location.search);
    state.userId = params.get('userId');
    const userName = params.get('userName');
    if (dom.librarySubtitle) {
      dom.librarySubtitle.textContent = userName
        ? `Read-only view for ${userName}.`
        : `Read-only view for user #${state.userId || '—'}.`;
    }
  };

  const renderPagination = (hasNextPage) => {
    dom.paginationNav.innerHTML = '';
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Admin library pagination');
    const ul = document.createElement('ul');
    ul.className = 'pagination mb-0';

    const createItem = (label, disabled, onClick) => {
      const li = document.createElement('li');
      li.className = `page-item ${disabled ? 'disabled' : ''}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'page-link';
      btn.textContent = label;
      btn.disabled = disabled;
      if (!disabled) btn.addEventListener('click', onClick);
      li.appendChild(btn);
      return li;
    };

    ul.appendChild(createItem('Previous', state.page <= 1, () => {
      state.page = Math.max(1, state.page - 1);
      loadBooks();
    }));

    const current = document.createElement('li');
    current.className = 'page-item active';
    current.innerHTML = `<span class="page-link">${state.page}</span>`;
    ul.appendChild(current);

    ul.appendChild(createItem('Next', !hasNextPage, () => {
      state.page += 1;
      loadBooks();
    }));

    nav.appendChild(ul);
    dom.paginationNav.appendChild(nav);
  };

  const renderList = (items = []) => {
    dom.table.innerHTML = '';
    if (!items.length) {
      dom.table.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No books found.</td></tr>';
      dom.resultsSummary.textContent = 'No books found.';
      dom.resultsMeta.textContent = '';
      dom.listCount.textContent = '0 loaded';
      renderPagination(false);
      return;
    }

    items.forEach((book) => {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      row.dataset.id = book.id;
      row.innerHTML = `
        <td>
          <div class="fw-semibold">${escapeHtml(book.title || '')}</div>
          ${book.subtitle ? `<div class="text-muted small">${escapeHtml(book.subtitle)}</div>` : ''}
        </td>
        <td>${escapeHtml(book.bookTypeName || '—')}</td>
        <td>${escapeHtml(book.publisherName || '—')}</td>
        <td>${formatTimestamp(book.updatedAt)}</td>
        <td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-action="view">View</button></td>
      `;
      dom.table.appendChild(row);
    });

    dom.resultsSummary.textContent = `${items.length} book${items.length === 1 ? '' : 's'} on this page`;
    dom.resultsMeta.textContent = `Page ${state.page}`;
    dom.listCount.textContent = `${items.length} loaded`;
    renderPagination(items.length === state.limit);
  };

  const loadBooks = async () => {
    if (!state.userId) {
      showAlert({ message: 'Select a user to view their library.' });
      return;
    }

    dom.table.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Loading…</td></tr>';
    dom.resultsSummary.textContent = 'Loading…';
    dom.resultsMeta.textContent = '';

    try {
      const payload = {
        search: state.search,
        sort: state.sort.field,
        order: state.sort.order,
        limit: state.limit,
        page: state.page,
        includeDeleted: state.includeDeleted
      };
      const response = await apiFetch(`/admin/users/${state.userId}/library/books/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to load books.');
      }
      state.data = data?.data?.books || [];
      renderList(state.data);
    } catch (err) {
      errorLog('Load failed', err);
      dom.table.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Unable to load books.</td></tr>';
      showAlert({ message: 'Unable to load books right now.' });
    }
  };

  const bindEvents = () => {
    dom.refreshBtn.addEventListener('click', () => loadBooks());
    dom.searchInput.addEventListener('input', (event) => {
      state.search = event.target.value.trim();
      state.page = 1;
      loadBooks();
    });
    dom.sortSelect.addEventListener('change', (event) => {
      const [field, order] = event.target.value.split(':');
      state.sort.field = field || 'title';
      state.sort.order = order || 'asc';
      state.page = 1;
      loadBooks();
    });
    dom.perPageSelect.addEventListener('change', (event) => {
      state.limit = Number.parseInt(event.target.value, 10) || 20;
      state.page = 1;
      loadBooks();
    });
    dom.includeDeleted.addEventListener('change', (event) => {
      state.includeDeleted = event.target.checked;
      state.page = 1;
      loadBooks();
    });
    dom.table.addEventListener('click', (event) => {
      const row = event.target.closest('tr');
      if (!row) return;
      const action = event.target.closest('button[data-action]');
      const bookId = row.dataset.id;
      if (!bookId) return;
      if (action || row) {
        window.location.href = `admin-library-details?userId=${encodeURIComponent(state.userId)}&bookId=${encodeURIComponent(bookId)}`;
      }
    });
  };

  const init = () => {
    parseQuery();
    bindEvents();
    loadBooks();
  };

  init();
})();
