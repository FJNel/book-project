if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
  window.pageContentReady.reset();
}

document.addEventListener('DOMContentLoaded', () => {
  const log = (...args) => console.log('[Author Details]', ...args);
  const warn = (...args) => console.warn('[Author Details]', ...args);
  const errorLog = (...args) => console.error('[Author Details]', ...args);

  log('Initializing page.');
  if (window.rateLimitGuard?.hasReset && window.rateLimitGuard.hasReset()) {
    window.rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
    return;
  }

  const placeholderCover = (title) => {
    const text = encodeURIComponent(title || 'Book Cover');
    return `https://placehold.co/120x180?text=${text}&font=Lora`;
  };

  const invalidModal = document.getElementById('invalidAuthorModal');
  const invalidModalMessage = document.getElementById('invalidAuthorModalMessage');
  const invalidModalClose = document.getElementById('invalidAuthorModalClose');
  const defaultInvalidAuthorMessage = "This link doesn't seem to lead to an author in your library. Try going back to your author list and selecting it again.";

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
    log('Showing invalid author modal.', { message });
    if (invalidModalMessage) invalidModalMessage.textContent = message || defaultInvalidAuthorMessage;
    await hideModal('pageLoadingModal');
    await showModal(invalidModal, { backdrop: 'static', keyboard: false });
  };

  if (invalidModalClose) {
    invalidModalClose.addEventListener('click', () => {
      log('Invalid author modal closed. Redirecting to authors list.');
      window.location.href = 'authors';
    });
  }

  const authorIdParam = new URLSearchParams(window.location.search).get('id');
  const authorId = Number.parseInt(authorIdParam, 10);
  if (!Number.isInteger(authorId) || authorId <= 0) {
    warn('Invalid author id in URL.', { authorIdParam });
    showInvalidModal(defaultInvalidAuthorMessage);
    return;
  }
  log('Resolved author id from URL.', { authorId });

  const renderAuthor = (author) => {
    log('Rendering author details.');
    const fullName = [author.firstNames, author.lastName].filter(Boolean).join(' ').trim();
    const displayName = author.displayName || fullName || 'Unknown author';
    const altName = fullName && fullName !== displayName ? fullName : '';
    const born = formatPartialDate(author.birthDate);
    const isDeceased = Boolean(author.deceased) || Boolean(author.deathDate);
    const died = isDeceased
      ? `Died: ${formatPartialDate(author.deathDate) || '(date unknown)'}`
      : null;
    const createdAt = formatTimestamp(author.createdAt);
    const updatedAt = formatTimestamp(author.updatedAt);

    const heading = document.getElementById('authorNameHeading');
    const subtitle = document.getElementById('authorSubtitle');
    const nameEl = document.getElementById('authorName');
    const altNameEl = document.getElementById('authorAltName');
    const bornEl = document.getElementById('authorBorn');
    const diedEl = document.getElementById('authorDied');
    const createdEl = document.getElementById('authorCreated');
    const updatedEl = document.getElementById('authorUpdated');
    const bioEl = document.getElementById('authorBio');
    const bornWrap = document.getElementById('authorBornWrap');
    const diedWrap = document.getElementById('authorDiedWrap');
    const createdWrap = document.getElementById('authorCreatedWrap');
    const updatedWrap = document.getElementById('authorUpdatedWrap');
    const bioSection = document.getElementById('authorBioSection');

    if (heading) heading.textContent = displayName;
    if (subtitle) {
      if (altName) {
        subtitle.textContent = `Also known as ${altName}`;
        subtitle.classList.remove('d-none');
      } else {
        subtitle.textContent = '';
        subtitle.classList.add('d-none');
      }
    }
    if (nameEl) nameEl.textContent = displayName;
    if (altNameEl) {
      if (altName) {
        altNameEl.textContent = altName;
        altNameEl.classList.remove('d-none');
      } else {
        altNameEl.textContent = '';
        altNameEl.classList.add('d-none');
      }
    }
    setTextOrHide(bornWrap, bornEl, born ? born : '');
    setTextOrHide(diedWrap, diedEl, died ? died.replace('Died: ', '') : '');
    setTextOrHide(createdWrap, createdEl, createdAt || '');
    setTextOrHide(updatedWrap, updatedEl, updatedAt || '');
    if (bioSection && bioEl) {
      if (author.bio && author.bio.trim()) {
        bioEl.textContent = author.bio;
        bioSection.classList.remove('d-none');
      } else {
        bioEl.textContent = '';
        bioSection.classList.add('d-none');
      }
    }
  };

  const extractAuthorRole = (book) => {
    if (!book || !Array.isArray(book.authors)) return 'Contributor';
    const entry = book.authors.find((author) => author.authorId === authorId);
    if (!entry) return 'Contributor';
    return entry.authorRole || 'Contributor';
  };

  const renderBooks = (books) => {
    log('Rendering author books.', { count: books.length });
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
      const role = extractAuthorRole(book);
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
              <div class="text-muted small list-meta-mobile">${escapeHtml(role)} • ${escapeHtml(published)}</div>
            </div>
          </div>
        </td>
        <td class="list-col-role"><span class="text-muted">${escapeHtml(role)}</span></td>
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
    warn('Author request failed.', { status: response.status });
    if (response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      await hideModal('pageLoadingModal');
      await window.rateLimitGuard.showModal();
      return true;
    }
    await showInvalidModal(defaultInvalidAuthorMessage);
    return false;
  };

  const loadAuthor = async () => {
    log('Loading author data from API.');
    const response = await apiFetch(`/author/${authorId}`, { method: 'GET' });
    log('Author API response received.', { ok: response.ok, status: response.status });
    if (!response.ok) {
      await handleResponseError(response);
      return null;
    }
    const payload = await response.json();
    if (!payload || payload.status !== 'success' || !payload.data) {
      await showInvalidModal(defaultInvalidAuthorMessage);
      return null;
    }
    renderAuthor(payload.data);
    return payload.data;
  };

  const loadBooks = async () => {
    log('Loading related books from API.');
    const response = await apiFetch('/book/list', {
      method: 'POST',
      body: JSON.stringify({
        filterAuthorId: [authorId],
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
      await showInvalidModal(defaultInvalidAuthorMessage);
      return [];
    }
    return payload.data.books || [];
  };

  const loadPage = async () => {
    await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
    try {
      const author = await loadAuthor();
      if (!author) return;
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Author details load failed with exception.', error);
      await showInvalidModal(defaultInvalidAuthorMessage);
    } finally {
      await hideModal('pageLoadingModal');
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: true });
      }
    }
  };

  loadPage();
});
