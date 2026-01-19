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
    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve({ success: false, rateLimited: true });
    }
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
  const editPublisherBtn = document.getElementById('editPublisherBtn');
  const deletePublisherBtn = document.getElementById('deletePublisherBtn');
  const deletePublisherModal = document.getElementById('deletePublisherModal');
  const deletePublisherName = document.getElementById('deletePublisherName');
  const publisherDeleteConfirmBtn = document.getElementById('publisherDeleteConfirmBtn');
  const publisherDeleteErrorAlert = document.getElementById('publisherDeleteErrorAlert');
  const removePublisherBookModal = document.getElementById('removePublisherBookModal');
  const removePublisherBookText = document.getElementById('removePublisherBookText');
  const removePublisherBookConfirmBtn = document.getElementById('removePublisherBookConfirmBtn');
  const removePublisherBookError = document.getElementById('removePublisherBookError');

  let publisherRecord = null;
  let removePublisherBookTarget = null;

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
    const raw = value.trim();
    if (!raw || /\s/.test(raw)) return null;
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withScheme);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.href;
    } catch (error) {
      return null;
    }
  };

  const setHelpText = (el, message, isError = false) => {
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('text-danger', Boolean(message) && isError);
  };

  const clearHelpText = (el) => setHelpText(el, '', false);

  const attachButtonSpinner = (button) => {
    if (!button) return null;
    if (button.querySelector('.spinner-border')) {
      return {
        spinner: button.querySelector('.spinner-border'),
        label: button.textContent.trim() || 'Submit'
      };
    }
    const label = button.textContent.trim() || 'Submit';
    button.textContent = '';
    const spinner = document.createElement('span');
    spinner.className = 'spinner-border spinner-border-sm d-none';
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-hidden', 'true');
    button.appendChild(spinner);
    button.appendChild(document.createTextNode(' '));
    button.appendChild(document.createTextNode(label));
    return { spinner, label };
  };

  const setButtonLoading = (button, spinner, isLoading) => {
    if (!button || !spinner) return;
    spinner.classList.toggle('d-none', !isLoading);
    button.disabled = isLoading;
  };

  const toggleDisabled = (elements, disabled) => {
    if (!elements) return;
    elements.forEach((el) => {
      if (el) el.disabled = disabled;
    });
  };

  const bindModalLock = (modalEl, state) => {
    if (!modalEl || modalEl.dataset.lockBound === 'true') return;
    modalEl.dataset.lockBound = 'true';
    modalEl.addEventListener('hide.bs.modal', () => {
      if (state.locked) {
        state.locked = false;
        warn('Modal hide triggered while locked; allowing hide to proceed.', { id: modalEl.id });
      }
    });
  };

  const setModalLocked = (modalEl, locked) => {
    if (!modalEl) return;
    modalEl.dataset.locked = locked ? 'true' : 'false';
    const closeButtons = modalEl.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
    closeButtons.forEach((btn) => {
      btn.disabled = locked;
    });
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

  const deleteModalState = { locked: false };
  const removeModalState = { locked: false };
  const deleteSpinner = attachButtonSpinner(publisherDeleteConfirmBtn);
  const removeSpinner = attachButtonSpinner(removePublisherBookConfirmBtn);

  bindModalLock(deletePublisherModal, deleteModalState);
  bindModalLock(removePublisherBookModal, removeModalState);

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
    publisherRecord = publisher;
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
      subtitle.textContent = '';
      subtitle.classList.add('d-none');
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
        <td class="list-col-actions text-end">
          <div class="row-actions d-inline-flex gap-1">
            <button class="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center p-2" type="button" data-book-remove="${book.id}" data-bs-toggle="tooltip" title="Remove publisher from this book" aria-label="Remove publisher from this book">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
              </svg>
            </button>
          </div>
        </td>
      `;
      row.addEventListener('click', () => {
        window.location.href = `book-details?id=${book.id}`;
      });
      body.appendChild(row);
    });

    body.querySelectorAll('[data-book-remove]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const bookId = Number.parseInt(button.getAttribute('data-book-remove'), 10);
        if (!Number.isInteger(bookId)) return;
        const target = books.find((entry) => entry.id === bookId);
        if (!target) return;
        openRemovePublisherBookModal(target);
      });
    });

    if (typeof window.initializeTooltips === 'function') {
      window.initializeTooltips();
    }
  };

  const openRemovePublisherBookModal = (book) => {
    if (!book) return;
    log('Opening remove publisher from book modal.', { bookId: book.id, publisherId: publisherRecord?.id });
    removeModalState.locked = false;
    setModalLocked(removePublisherBookModal, false);
    removePublisherBookTarget = book;
    if (removePublisherBookText) {
      removePublisherBookText.textContent = `Remove ${publisherRecord?.name || 'this publisher'} from ${book.title || 'this book'}?`;
    }
    if (removePublisherBookError) clearApiAlert(removePublisherBookError);
    showModal(removePublisherBookModal, { backdrop: 'static', keyboard: false });
  };

  const confirmRemovePublisherBook = async () => {
    if (!removePublisherBookTarget) return;
    removePublisherBookConfirmBtn.disabled = true;
    window.modalLock?.lock(removePublisherBookModal, 'Remove publisher');
    removeModalState.locked = true;
    setModalLocked(removePublisherBookModal, true);
    setButtonLoading(removePublisherBookConfirmBtn, removeSpinner?.spinner, true);
    try {
      const requestPayload = { id: removePublisherBookTarget.id, publisherId: null };
      log('Removing publisher from book.', { request: requestPayload });
      const response = await apiFetch('/book', {
        method: 'PUT',
        body: JSON.stringify(requestPayload)
      });
      const data = await response.json().catch(() => ({}));
      log('Remove publisher response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (removePublisherBookError) renderApiErrorAlert(removePublisherBookError, data, data.message || 'Unable to remove publisher from book.');
        warn('Remove publisher from book failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      await hideModal(removePublisherBookModal);
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Remove publisher from book failed.', error);
      if (removePublisherBookError) renderApiErrorAlert(removePublisherBookError, { message: 'Unable to remove publisher from book right now.' }, 'Unable to remove publisher from book right now.');
    } finally {
      removeModalState.locked = false;
      setModalLocked(removePublisherBookModal, false);
      setButtonLoading(removePublisherBookConfirmBtn, removeSpinner?.spinner, false);
      removePublisherBookConfirmBtn.disabled = false;
      window.modalLock?.unlock(removePublisherBookModal, 'finally');
    }
  };

  const openEditModal = () => {
    if (!publisherRecord) return;
    window.sharedAddModals?.open('publisher', {
      mode: 'edit',
      initial: {
        id: publisherRecord.id,
        name: publisherRecord.name || '',
        foundedDate: publisherRecord.foundedDate?.text || '',
        website: publisherRecord.website || '',
        notes: publisherRecord.notes || ''
      }
    });
  };

  const openDeleteModal = () => {
    if (!publisherRecord) return;
    log('Opening delete publisher modal.', { publisherId: publisherRecord.id });
    deleteModalState.locked = false;
    setModalLocked(deletePublisherModal, false);
    if (deletePublisherName) deletePublisherName.textContent = publisherRecord.name || 'this publisher';
    if (publisherDeleteErrorAlert) clearApiAlert(publisherDeleteErrorAlert);
    showModal(deletePublisherModal, { backdrop: 'static', keyboard: false });
  };

  const confirmDelete = async () => {
    if (!publisherRecord) return;
    publisherDeleteConfirmBtn.disabled = true;
    window.modalLock?.lock(deletePublisherModal, 'Delete publisher');
    deleteModalState.locked = true;
    setModalLocked(deletePublisherModal, true);
    setButtonLoading(publisherDeleteConfirmBtn, deleteSpinner?.spinner, true);
    try {
      const response = await apiFetch('/publisher', { method: 'DELETE', body: JSON.stringify({ id: publisherRecord.id }) });
      const data = await response.json().catch(() => ({}));
      log('Publisher delete response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (publisherDeleteErrorAlert) renderApiErrorAlert(publisherDeleteErrorAlert, data, data.message || 'Unable to delete publisher.');
        warn('Publisher delete failed.', { status: response.status, data });
        return;
      }
      sessionStorage.setItem('publishersFlash', 'Publisher deleted successfully.');
      window.location.href = 'publishers';
    } catch (error) {
      errorLog('Publisher delete failed.', error);
      if (publisherDeleteErrorAlert) renderApiErrorAlert(publisherDeleteErrorAlert, { message: 'Unable to delete publisher right now.' }, 'Unable to delete publisher right now.');
    } finally {
      deleteModalState.locked = false;
      setModalLocked(deletePublisherModal, false);
      setButtonLoading(publisherDeleteConfirmBtn, deleteSpinner?.spinner, false);
      publisherDeleteConfirmBtn.disabled = false;
      window.modalLock?.unlock(deletePublisherModal, 'finally');
    }
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
    let pageLoaded = false;
    await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
    try {
      const publisher = await loadPublisher();
      if (!publisher) return;
      const books = await loadBooks();
      renderBooks(books);
      pageLoaded = true;
    } catch (error) {
      errorLog('Publisher details load failed with exception.', error);
      await showInvalidModal(defaultInvalidPublisherMessage);
    } finally {
      await hideModal('pageLoadingModal');
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: pageLoaded });
      }
    }
  };

  loadPage();

  if (editPublisherBtn) {
    editPublisherBtn.addEventListener('click', openEditModal);
  }
  if (deletePublisherBtn) {
    deletePublisherBtn.addEventListener('click', openDeleteModal);
  }
  if (publisherDeleteConfirmBtn) {
    publisherDeleteConfirmBtn.addEventListener('click', confirmDelete);
  }
  if (removePublisherBookConfirmBtn) {
    removePublisherBookConfirmBtn.addEventListener('click', confirmRemovePublisherBook);
  }

  const sharedEvents = window.sharedAddModals?.events;
  if (sharedEvents) {
    sharedEvents.addEventListener('publisher:updated', async (event) => {
      if (event?.detail?.id && publisherRecord?.id && event.detail.id !== publisherRecord.id) return;
      await loadPublisher();
    });
  }
});
