if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
  window.pageContentReady.reset();
}

document.addEventListener('DOMContentLoaded', () => {
  const log = (...args) => console.log('[Publisher Details]', ...args);
  const warn = (...args) => console.warn('[Publisher Details]', ...args);
  const errorLog = (...args) => console.error('[Publisher Details]', ...args);

  log('Initializing page.');
  if (window.rateLimitGuard?.hasReset && window.rateLimitGuard.hasReset()) {
    window.rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
    return;
  }

  const placeholderCover = (title) => {
    const text = encodeURIComponent(title || 'Book Cover');
    return `https://placehold.co/120x180?text=${text}&font=Lora`;
  };

  const invalidModal = document.getElementById('invalidPublisherModal');
  const invalidModalMessage = document.getElementById('invalidPublisherModalMessage');
  const invalidModalClose = document.getElementById('invalidPublisherModalClose');
  const defaultInvalidPublisherMessage = "This link doesn't seem to lead to a publisher in your library. Try going back to your publisher list and selecting it again.";

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

  const setTextOrHide = (wrap, el, text) => {
    if (!wrap || !el) return;
    if (text) {
      el.textContent = text;
      wrap.classList.remove('d-none');
      return;
    }
    el.textContent = '';
    wrap.classList.add('d-none');
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
    log('Showing invalid publisher modal.', { message });
    if (invalidModalMessage) invalidModalMessage.textContent = message || defaultInvalidPublisherMessage;
    await hideModal('pageLoadingModal');
    await showModal(invalidModal, { backdrop: 'static', keyboard: false });
  };

  if (invalidModalClose) {
    invalidModalClose.addEventListener('click', () => {
      log('Invalid publisher modal closed. Redirecting to publishers list.');
      window.location.href = 'publishers';
    });
  }

  const publisherIdParam = new URLSearchParams(window.location.search).get('id');
  const publisherId = Number.parseInt(publisherIdParam, 10);
  if (!Number.isInteger(publisherId) || publisherId <= 0) {
    warn('Invalid publisher id in URL.', { publisherIdParam });
    showInvalidModal(defaultInvalidPublisherMessage);
    return;
  }
  log('Resolved publisher id from URL.', { publisherId });

  const renderPublisher = (publisher) => {
    log('Rendering publisher details.');
    const name = publisher.name || 'Untitled publisher';
    const founded = formatPartialDate(publisher.foundedDate) || 'Unknown';
    const createdAt = formatTimestamp(publisher.createdAt);
    const updatedAt = formatTimestamp(publisher.updatedAt);
    const websiteLink = renderLink(publisher.website, publisher.website);

    const heading = document.getElementById('publisherNameHeading');
    const subtitle = document.getElementById('publisherSubtitle');
    const nameEl = document.getElementById('publisherName');
    const websiteEl = document.getElementById('publisherWebsite');
    const foundedEl = document.getElementById('publisherFounded');
    const createdEl = document.getElementById('publisherCreated');
    const updatedEl = document.getElementById('publisherUpdated');
    const notesEl = document.getElementById('publisherNotes');
    const createdWrap = document.getElementById('publisherCreatedWrap');
    const updatedWrap = document.getElementById('publisherUpdatedWrap');
    const notesSection = document.getElementById('publisherNotesSection');

    if (heading) heading.textContent = name;
    if (subtitle) {
      if (websiteLink) {
        subtitle.innerHTML = websiteLink;
        subtitle.classList.remove('d-none');
      } else {
        subtitle.textContent = '';
        subtitle.classList.add('d-none');
      }
    }
    if (nameEl) nameEl.textContent = name;
    if (websiteEl) {
      if (websiteLink) {
        websiteEl.innerHTML = websiteLink;
        websiteEl.classList.remove('d-none');
      } else {
        websiteEl.textContent = '';
        websiteEl.classList.add('d-none');
      }
    }
    if (foundedEl) foundedEl.textContent = founded;
    setTextOrHide(createdWrap, createdEl, createdAt || '');
    setTextOrHide(updatedWrap, updatedEl, updatedAt || '');
    if (notesSection && notesEl) {
      if (publisher.notes && publisher.notes.trim()) {
        notesEl.textContent = publisher.notes;
        notesSection.classList.remove('d-none');
      } else {
        notesEl.textContent = '';
        notesSection.classList.add('d-none');
      }
    }
  };

  const renderBooks = (books) => {
    log('Rendering publisher books.', { count: books.length });
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
              <div class="text-muted small list-meta-mobile">${escapeHtml(published)}</div>
            </div>
          </div>
        </td>
        <td class="list-col-type"><span class="text-muted">${escapeHtml(bookType)}</span></td>
        <td class="list-col-language"><span class="text-muted"${languageTitle}>${escapeHtml(languageLabel)}</span></td>
        <td class="list-col-published"><span class="text-muted">${escapeHtml(published)}</span></td>
        <td class="list-col-tags">${visibleTags.map((tag) => `<span class="badge rounded-pill text-bg-light text-dark border">${escapeHtml(tag.name)}</span>`).join(' ')}${remainingTags > 0 ? ` <span class="badge rounded-pill text-bg-light text-dark border">+${remainingTags}</span>` : ''}</td>
      `;
      row.addEventListener('click', () => {
        window.location.href = `book-details?id=${book.id}`;
      });
      body.appendChild(row);
    });
  };

  const handleResponseError = async (response) => {
    warn('Publisher request failed.', { status: response.status });
    if (response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      await hideModal('pageLoadingModal');
      await window.rateLimitGuard.showModal();
      return true;
    }
    await showInvalidModal(defaultInvalidPublisherMessage);
    return false;
  };

  const loadPublisher = async () => {
    log('Loading publisher data from API.');
    const response = await apiFetch(`/publisher/${publisherId}`, { method: 'GET' });
    log('Publisher API response received.', { ok: response.ok, status: response.status });
    if (!response.ok) {
      await handleResponseError(response);
      return null;
    }
    const payload = await response.json();
    if (!payload || payload.status !== 'success' || !payload.data) {
      await showInvalidModal(defaultInvalidPublisherMessage);
      return null;
    }
    renderPublisher(payload.data);
    return payload.data;
  };

  const loadBooks = async () => {
    log('Loading publisher books from API.');
    const response = await apiFetch('/book/list', {
      method: 'POST',
      body: JSON.stringify({
        filterPublisherId: [publisherId],
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
      await showInvalidModal(defaultInvalidPublisherMessage);
      return [];
    }
    return payload.data.books || [];
  };

  const loadPage = async () => {
    await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
    try {
      const publisher = await loadPublisher();
      if (!publisher) return;
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Publisher details load failed with exception.', error);
      await showInvalidModal(defaultInvalidPublisherMessage);
    } finally {
      await hideModal('pageLoadingModal');
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: true });
      }
    }
  };

  loadPage();
});
