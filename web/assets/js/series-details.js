if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
  window.pageContentReady.reset();
}

document.addEventListener('DOMContentLoaded', () => {
  const log = (...args) => console.log('[Series Details]', ...args);
  const warn = (...args) => console.warn('[Series Details]', ...args);
  const errorLog = (...args) => console.error('[Series Details]', ...args);

  log('Initializing page.');
  if (window.rateLimitGuard?.hasReset && window.rateLimitGuard.hasReset()) {
    window.rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
    return;
  }

  const placeholderCover = (title) => {
    const text = encodeURIComponent(title || 'Book Cover');
    return `https://placehold.co/120x180?text=${text}&font=Lora`;
  };

  const invalidModal = document.getElementById('invalidSeriesModal');
  const invalidModalMessage = document.getElementById('invalidSeriesModalMessage');
  const invalidModalClose = document.getElementById('invalidSeriesModalClose');
  const defaultInvalidSeriesMessage = "This link doesn't seem to lead to a series in your library. Try going back to your series list and selecting it again.";

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

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const normalizeUrl = (value) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || /\s/.test(trimmed)) return null;
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(withScheme);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.href;
    } catch (error) {
      return null;
    }
  };

  const renderLink = (url, text) => {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;
    return `<a href="${normalized}" target="_blank" rel="noopener">${escapeHtml(text || normalized)}</a>`;
  };

  const setTextOrMuted = (el, text, fallback) => {
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.classList.remove('text-muted');
      return;
    }
    el.textContent = fallback;
    el.classList.add('text-muted');
  };

  const showModal = async (target, options) => {
    if (window.modalManager && typeof window.modalManager.showModal === 'function') {
      await window.modalManager.showModal(target, options);
      return;
    }
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    bootstrap.Modal.getOrCreateInstance(element, options || {}).show();
  };

  const hideModal = async (target) => {
    if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
      await window.modalManager.hideModal(target);
      return;
    }
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    const instance = bootstrap.Modal.getInstance(element);
    if (instance) instance.hide();
  };

  const showInvalidModal = async (message) => {
    log('Showing invalid series modal.', { message });
    if (invalidModalMessage) invalidModalMessage.textContent = message || defaultInvalidSeriesMessage;
    await hideModal('pageLoadingModal');
    await showModal(invalidModal, { backdrop: 'static', keyboard: false });
  };

  if (invalidModalClose) {
    invalidModalClose.addEventListener('click', () => {
      log('Invalid series modal closed. Redirecting to series list.');
      window.location.href = 'series';
    });
  }

  const seriesIdParam = new URLSearchParams(window.location.search).get('id');
  const seriesId = Number.parseInt(seriesIdParam, 10);
  if (!Number.isInteger(seriesId) || seriesId <= 0) {
    warn('Invalid series id in URL.', { seriesIdParam });
    showInvalidModal(defaultInvalidSeriesMessage);
    return;
  }
  log('Resolved series id from URL.', { seriesId });

  const renderSeries = (series) => {
    log('Rendering series details.');
    const name = series.name || 'Untitled series';
    const description = series.description || 'No description on file.';
    const start = formatPartialDate(series.startDate) || 'Unknown';
    const end = formatPartialDate(series.endDate) || 'Unknown';
    const createdAt = formatTimestamp(series.createdAt) || '—';
    const updatedAt = formatTimestamp(series.updatedAt) || '—';

    const heading = document.getElementById('seriesNameHeading');
    const subtitle = document.getElementById('seriesSubtitle');
    const nameEl = document.getElementById('seriesName');
    const websiteEl = document.getElementById('seriesWebsite');
    const startEl = document.getElementById('seriesStart');
    const endEl = document.getElementById('seriesEnd');
    const createdEl = document.getElementById('seriesCreated');
    const updatedEl = document.getElementById('seriesUpdated');
    const descriptionEl = document.getElementById('seriesDescription');

    if (heading) heading.textContent = name;
    if (subtitle) subtitle.textContent = series.website ? series.website : '';
    if (nameEl) nameEl.textContent = name;
    if (websiteEl) {
      const link = renderLink(series.website, series.website);
      if (link) {
        websiteEl.innerHTML = link;
        websiteEl.classList.remove('text-muted');
      } else {
        websiteEl.textContent = 'No website listed';
        websiteEl.classList.add('text-muted');
      }
    }
    setTextOrMuted(startEl, start, 'Unknown');
    setTextOrMuted(endEl, end, 'Unknown');
    setTextOrMuted(createdEl, createdAt, '—');
    setTextOrMuted(updatedEl, updatedAt, '—');
    setTextOrMuted(descriptionEl, description, 'No description on file.');
  };

  const getSeriesOrder = (book) => {
    if (!book || !Array.isArray(book.series)) return null;
    const entry = book.series.find((series) => series.seriesId === seriesId);
    return entry ? entry.bookOrder : null;
  };

  const renderBooks = (books) => {
    log('Rendering series books.', { count: books.length });
    const body = document.getElementById('booksTableBody');
    const countEl = document.getElementById('booksCount');
    const emptyState = document.getElementById('booksEmptyState');
    if (!body) return;

    body.innerHTML = '';
    if (countEl) countEl.textContent = `${books.length} book${books.length === 1 ? '' : 's'}`;

    if (!books.length) {
      if (emptyState) emptyState.classList.remove('d-none');
      return;
    }
    if (emptyState) emptyState.classList.add('d-none');

    books.forEach((book) => {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      const cover = book.coverImageUrl || placeholderCover(book.title);
      const subtitle = book.subtitle ? `<div class="text-muted small">${escapeHtml(book.subtitle)}</div>` : '';
      const languages = Array.isArray(book.languages) && book.languages.length
        ? book.languages.map((lang) => lang.name).join(', ')
        : '—';
      const tags = Array.isArray(book.tags) && book.tags.length
        ? book.tags.map((tag) => tag.name).join(', ')
        : '—';
      const published = formatPartialDate(book.publicationDate) || '—';
      const bookType = book.bookType?.name || book.bookTypeName || '—';
      const order = getSeriesOrder(book);
      const orderLabel = order !== null && order !== undefined ? String(order) : '—';

      row.innerHTML = `
        <td class="list-col-order"><span class="text-muted">${escapeHtml(orderLabel)}</span></td>
        <td class="list-col-book">
          <div class="d-flex align-items-center gap-3">
            <img src="${cover}" alt="${escapeHtml(book.title || 'Book cover')}" class="cover-thumb" />
            <div>
              <div class="fw-semibold">${escapeHtml(book.title || 'Untitled')}</div>
              ${subtitle}
              <div class="text-muted small list-meta-mobile">#${escapeHtml(orderLabel)} • ${escapeHtml(published)}</div>
            </div>
          </div>
        </td>
        <td class="list-col-type"><span class="text-muted">${escapeHtml(bookType)}</span></td>
        <td class="list-col-language"><span class="text-muted">${escapeHtml(languages)}</span></td>
        <td class="list-col-published"><span class="text-muted">${escapeHtml(published)}</span></td>
        <td class="list-col-tags"><span class="text-muted">${escapeHtml(tags)}</span></td>
      `;
      row.addEventListener('click', () => {
        window.location.href = `book-details?id=${book.id}`;
      });
      body.appendChild(row);
    });
  };

  const handleResponseError = async (response) => {
    warn('Series request failed.', { status: response.status });
    if (response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      await hideModal('pageLoadingModal');
      await window.rateLimitGuard.showModal();
      return true;
    }
    await showInvalidModal(defaultInvalidSeriesMessage);
    return false;
  };

  const loadSeries = async () => {
    log('Loading series data from API.');
    const response = await apiFetch(`/bookseries/${seriesId}`, { method: 'GET' });
    log('Series API response received.', { ok: response.ok, status: response.status });
    if (!response.ok) {
      await handleResponseError(response);
      return null;
    }
    const payload = await response.json();
    if (!payload || payload.status !== 'success' || !payload.data) {
      await showInvalidModal(defaultInvalidSeriesMessage);
      return null;
    }
    renderSeries(payload.data);
    return payload.data;
  };

  const loadBooks = async () => {
    log('Loading series books from API.');
    const response = await apiFetch('/book/list', {
      method: 'POST',
      body: JSON.stringify({
        filterSeriesId: [seriesId],
        sortBy: 'title',
        order: 'asc',
        limit: 200,
        view: 'all'
      })
    });
    log('Books API response received.', { ok: response.ok, status: response.status });
    if (!response.ok) {
      await handleResponseError(response);
      return [];
    }
    const payload = await response.json();
    if (!payload || payload.status !== 'success' || !payload.data) {
      await showInvalidModal(defaultInvalidSeriesMessage);
      return [];
    }
    return payload.data.books || [];
  };

  const loadPage = async () => {
    await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
    try {
      const series = await loadSeries();
      if (!series) return;
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Series details load failed with exception.', error);
      await showInvalidModal(defaultInvalidSeriesMessage);
    } finally {
      await hideModal('pageLoadingModal');
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: true });
      }
    }
  };

  loadPage();
});
