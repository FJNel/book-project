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
    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve({ success: false, rateLimited: true });
    }
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
  const seriesDeletedNotice = document.getElementById('seriesDeletedNotice');
  const seriesDeletedText = document.getElementById('seriesDeletedText');
  const editSeriesBtn = document.getElementById('editSeriesBtn');
  const deleteSeriesBtn = document.getElementById('deleteSeriesBtn');
  const restoreSeriesBtn = document.getElementById('restoreSeriesBtn');
  const permanentDeleteSeriesBtn = document.getElementById('permanentDeleteSeriesBtn');
  const deleteSeriesModal = document.getElementById('deleteSeriesModal');
  const deleteSeriesName = document.getElementById('deleteSeriesName');
  const seriesDeleteConfirmBtn = document.getElementById('seriesDeleteConfirmBtn');
  const seriesDeleteErrorAlert = document.getElementById('seriesDeleteErrorAlert');
  const restoreSeriesModal = document.getElementById('restoreSeriesModal');
  const restoreSeriesMode = document.getElementById('restoreSeriesMode');
  const restoreSeriesModeHelp = document.getElementById('restoreSeriesModeHelp');
  const restoreSeriesChangesSummary = document.getElementById('restoreSeriesChangesSummary');
  const restoreSeriesError = document.getElementById('restoreSeriesError');
  const restoreSeriesConfirmBtn = document.getElementById('restoreSeriesConfirmBtn');
  const permanentDeleteSeriesModal = document.getElementById('permanentDeleteSeriesModal');
  const permanentDeleteSeriesConfirm = document.getElementById('permanentDeleteSeriesConfirm');
  const permanentDeleteSeriesHelp = document.getElementById('permanentDeleteSeriesHelp');
  const permanentDeleteSeriesError = document.getElementById('permanentDeleteSeriesError');
  const permanentDeleteSeriesConfirmBtn = document.getElementById('permanentDeleteSeriesConfirmBtn');
  const editSeriesOrderModal = document.getElementById('editSeriesOrderModal');
  const seriesOrderInput = document.getElementById('seriesOrderInput');
  const seriesOrderResetBtn = document.getElementById('seriesOrderResetBtn');
  const seriesOrderChangeSummary = document.getElementById('seriesOrderChangeSummary');
  const seriesOrderSaveBtn = document.getElementById('seriesOrderSaveBtn');
  const seriesOrderErrorAlert = document.getElementById('seriesOrderErrorAlert');
  const removeSeriesBookModal = document.getElementById('removeSeriesBookModal');
  const removeSeriesBookText = document.getElementById('removeSeriesBookText');
  const removeSeriesBookConfirmBtn = document.getElementById('removeSeriesBookConfirmBtn');
  const removeSeriesBookError = document.getElementById('removeSeriesBookError');

  let seriesRecord = null;
  let bookRecords = [];
  let orderEditTarget = null;
  let removeTarget = null;


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

  const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const formatDateTime = (value) => {
    if (!value) return null;
    try {
      const parts = dateTimeFormatter.formatToParts(new Date(value));
      const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${lookup.day} ${lookup.month} ${lookup.year} ${lookup.hour}:${lookup.minute}`;
    } catch (e) {
      return value;
    }
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

  const orderModalState = { locked: false };
  const deleteModalState = { locked: false };
  const removeModalState = { locked: false };
  const restoreModalState = { locked: false };
  const permanentDeleteModalState = { locked: false };
  const orderSpinner = attachButtonSpinner(seriesOrderSaveBtn);
  const deleteSpinner = attachButtonSpinner(seriesDeleteConfirmBtn);
  const removeSpinner = attachButtonSpinner(removeSeriesBookConfirmBtn);
  const restoreSpinner = attachButtonSpinner(restoreSeriesConfirmBtn);
  const permanentDeleteSpinner = attachButtonSpinner(permanentDeleteSeriesConfirmBtn);

  bindModalLock(editSeriesOrderModal, orderModalState);
  bindModalLock(deleteSeriesModal, deleteModalState);
  bindModalLock(removeSeriesBookModal, removeModalState);
  bindModalLock(restoreSeriesModal, restoreModalState);
  bindModalLock(permanentDeleteSeriesModal, permanentDeleteModalState);

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

  const applyDeletedState = (isDeleted, deletedAt) => {
    document.querySelectorAll('[data-active-only]').forEach((el) => {
      el.classList.toggle('d-none', isDeleted);
    });
    document.querySelectorAll('[data-deleted-only]').forEach((el) => {
      el.classList.toggle('d-none', !isDeleted);
    });
    if (seriesDeletedNotice) {
      seriesDeletedNotice.classList.toggle('d-none', !isDeleted);
    }
    if (seriesDeletedText) {
      if (isDeleted) {
        const formatted = formatDateTime(deletedAt) || 'Unknown date';
        seriesDeletedText.textContent = `This series was deleted on ${formatted}.`;
      } else {
        seriesDeletedText.textContent = 'This series is in the recycle bin.';
      }
    }
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
    seriesRecord = series;
    const name = series.name || 'Untitled series';
    const description = series.description ? series.description.trim() : '';
    const start = formatPartialDate(series.startDate) || 'Unknown';
    const end = formatPartialDate(series.endDate) || 'Unknown';
    const createdAt = formatTimestamp(series.createdAt);
    const updatedAt = formatTimestamp(series.updatedAt);
    const websiteLink = renderLink(series.website, series.website);

    const heading = document.getElementById('seriesNameHeading');
    const subtitle = document.getElementById('seriesSubtitle');
    const nameEl = document.getElementById('seriesName');
    const websiteEl = document.getElementById('seriesWebsite');
    const startEl = document.getElementById('seriesStart');
    const endEl = document.getElementById('seriesEnd');
    const createdEl = document.getElementById('seriesCreated');
    const updatedEl = document.getElementById('seriesUpdated');
    const descriptionEl = document.getElementById('seriesDescription');
    const createdWrap = document.getElementById('seriesCreatedWrap');
    const updatedWrap = document.getElementById('seriesUpdatedWrap');
    const descriptionSection = document.getElementById('seriesDescriptionSection');

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
    if (startEl) startEl.textContent = start;
    if (endEl) endEl.textContent = end;
    setTextOrHide(createdWrap, createdEl, createdAt || '');
    setTextOrHide(updatedWrap, updatedEl, updatedAt || '');
    if (descriptionSection && descriptionEl) {
      if (description) {
        descriptionEl.textContent = description;
        descriptionSection.classList.remove('d-none');
      } else {
        descriptionEl.textContent = '';
        descriptionSection.classList.add('d-none');
      }
    }

    applyDeletedState(Boolean(series.deletedAt), series.deletedAt);
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
    const sortedBooks = [...books].sort((a, b) => {
      const orderA = getSeriesOrder(a);
      const orderB = getSeriesOrder(b);
      const missingA = orderA === null || orderA === undefined;
      const missingB = orderB === null || orderB === undefined;
      if (missingA && missingB) {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (missingA) return 1;
      if (missingB) return -1;
      if (orderA !== orderB) return orderA - orderB;
      return (a.title || '').localeCompare(b.title || '');
    });

    bookRecords = sortedBooks;

    sortedBooks.forEach((book) => {
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
      const order = getSeriesOrder(book);
      const orderLabel = order !== null && order !== undefined ? String(order) : '?';

      row.innerHTML = `
        <td class="list-col-order">
          <span class="text-muted">${escapeHtml(orderLabel)}</span>
        </td>
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
        <td class="list-col-language"><span class="text-muted"${languageTitle}>${escapeHtml(languageLabel)}</span></td>
        <td class="list-col-published"><span class="text-muted">${escapeHtml(published)}</span></td>
        <td class="list-col-tags">${visibleTags.map((tag) => `<span class="badge rounded-pill text-bg-light text-dark border">${escapeHtml(tag.name)}</span>`).join(' ')}${remainingTags > 0 ? ` <span class="badge rounded-pill text-bg-light text-dark border">+${remainingTags}</span>` : ''}</td>
        <td class="list-col-actions text-end">
          <div class="row-actions d-inline-flex gap-1" aria-label="Row actions">
            <button class="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-2" type="button" data-order-edit="${book.id}" aria-label="Edit series order" title="Edit series order" data-bs-toggle="tooltip">
              <i class="bi bi-pencil-fill" aria-hidden="true"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center p-2" type="button" data-order-remove="${book.id}" aria-label="Remove book from this series" title="Remove book from this series" data-bs-toggle="tooltip">
              <i class="bi bi-trash-fill"></i>
            </button>
          </div>
        </td>
      `;
      row.addEventListener('click', () => {
        window.location.href = `book-details?id=${book.id}`;
      });
      body.appendChild(row);
    });

    body.querySelectorAll('[data-order-edit]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const bookId = Number(button.getAttribute('data-order-edit'));
        if (Number.isInteger(bookId)) openOrderModal(bookId);
      });
    });
    body.querySelectorAll('[data-order-remove]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const bookId = Number(button.getAttribute('data-order-remove'));
        if (Number.isInteger(bookId)) openRemoveModal(bookId);
      });
    });

    if (typeof window.initializeTooltips === 'function') {
      window.initializeTooltips();
    }
  };

  const openEditModal = () => {
    if (!seriesRecord) return;
    window.sharedAddModals?.open('series', {
      mode: 'edit',
      initial: {
        id: seriesRecord.id,
        name: seriesRecord.name || '',
        website: seriesRecord.website || '',
        description: seriesRecord.description || ''
      }
    });
  };

  const openDeleteModal = () => {
    if (!seriesRecord) return;
    if (deleteSeriesName) deleteSeriesName.textContent = seriesRecord.name || 'this series';
    if (seriesDeleteErrorAlert) clearApiAlert(seriesDeleteErrorAlert);
    showModal(deleteSeriesModal, { backdrop: 'static', keyboard: false });
  };

  const confirmDelete = async () => {
    if (!seriesRecord) return;
    seriesDeleteConfirmBtn.disabled = true;
    window.modalLock?.lock(deleteSeriesModal, 'Delete series');
    deleteModalState.locked = true;
    setModalLocked(deleteSeriesModal, true);
    setButtonLoading(seriesDeleteConfirmBtn, deleteSpinner?.spinner, true);
    try {
      const response = await apiFetch('/bookseries', { method: 'DELETE', body: JSON.stringify({ id: seriesRecord.id }) });
      const data = await response.json().catch(() => ({}));
      log('Series delete response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (seriesDeleteErrorAlert) renderApiErrorAlert(seriesDeleteErrorAlert, data, data.message || 'Unable to delete series.');
        warn('Series delete failed.', { status: response.status, data });
        return;
      }
      sessionStorage.setItem('seriesFlash', 'Series deleted successfully.');
      window.location.href = 'series';
    } catch (error) {
      errorLog('Series delete failed.', error);
      if (seriesDeleteErrorAlert) renderApiErrorAlert(seriesDeleteErrorAlert, { message: 'Unable to delete series right now.' }, 'Unable to delete series right now.');
    } finally {
      deleteModalState.locked = false;
      setModalLocked(deleteSeriesModal, false);
      setButtonLoading(seriesDeleteConfirmBtn, deleteSpinner?.spinner, false);
      seriesDeleteConfirmBtn.disabled = false;
      window.modalLock?.unlock(deleteSeriesModal, 'finally');
    }
  };

  const updateRestoreSummary = () => {
    if (!restoreSeriesMode || !restoreSeriesChangesSummary) return;
    const mode = restoreSeriesMode.value || 'decline';
    const label = mode === 'merge' ? 'Merge' : mode === 'override' ? 'Override' : 'Decline';
    restoreSeriesChangesSummary.textContent = `Restore this series using ${label} mode.`;
    if (restoreSeriesModeHelp) {
      const helpText = mode === 'merge'
        ? 'Merge combines details into the existing series when possible.'
        : mode === 'override'
          ? 'Override replaces the existing series by restoring this one.'
          : 'Decline leaves the series deleted if a conflict is found.';
      restoreSeriesModeHelp.textContent = helpText;
      restoreSeriesModeHelp.classList.remove('text-danger');
      restoreSeriesModeHelp.classList.add('text-muted');
    }
  };

  const openRestoreModal = () => {
    if (!seriesRecord || !restoreSeriesModal) return;
    restoreModalState.locked = false;
    setModalLocked(restoreSeriesModal, false);
    if (restoreSeriesMode) restoreSeriesMode.value = 'decline';
    if (restoreSeriesError) clearApiAlert(restoreSeriesError);
    updateRestoreSummary();
    restoreSeriesConfirmBtn.disabled = false;
    showModal(restoreSeriesModal, { backdrop: 'static', keyboard: false });
  };

  const confirmRestore = async () => {
    if (!seriesRecord || !restoreSeriesConfirmBtn) return;
    const mode = restoreSeriesMode?.value || 'decline';
    if (restoreSeriesError) clearApiAlert(restoreSeriesError);
    restoreModalState.locked = true;
    setModalLocked(restoreSeriesModal, true);
    setButtonLoading(restoreSeriesConfirmBtn, restoreSpinner?.spinner, true);
    window.modalLock?.lock(restoreSeriesModal, 'Restore series');
    try {
      const response = await apiFetch('/bookseries/restore', {
        method: 'POST',
        body: JSON.stringify({ ids: [seriesRecord.id], mode })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (restoreSeriesError) renderApiErrorAlert(restoreSeriesError, data, data.message || 'Unable to restore series.');
        return;
      }
      await hideModal(restoreSeriesModal);
      const refreshed = await loadSeries();
      if (refreshed && !refreshed.deletedAt) {
        const books = await loadBooks();
        renderBooks(books);
      }
    } catch (error) {
      errorLog('Restore series failed.', error);
      if (restoreSeriesError) renderApiErrorAlert(restoreSeriesError, { message: 'Unable to restore series right now.' }, 'Unable to restore series right now.');
    } finally {
      restoreModalState.locked = false;
      setModalLocked(restoreSeriesModal, false);
      setButtonLoading(restoreSeriesConfirmBtn, restoreSpinner?.spinner, false);
      restoreSeriesConfirmBtn.disabled = false;
      window.modalLock?.unlock(restoreSeriesModal, 'finally');
    }
  };

  const updatePermanentDeleteState = () => {
    if (!permanentDeleteSeriesConfirmBtn || !permanentDeleteSeriesConfirm) return;
    const value = permanentDeleteSeriesConfirm.value.trim();
    const matches = value.toLowerCase() === 'delete';
    permanentDeleteSeriesConfirmBtn.disabled = !matches;
    if (permanentDeleteSeriesHelp) {
      setHelpText(permanentDeleteSeriesHelp, matches ? 'Confirmed.' : 'Enter DELETE to enable permanent deletion.', !matches);
    }
  };

  const openPermanentDeleteModal = () => {
    if (!seriesRecord || !permanentDeleteSeriesModal) return;
    permanentDeleteModalState.locked = false;
    setModalLocked(permanentDeleteSeriesModal, false);
    if (permanentDeleteSeriesConfirm) permanentDeleteSeriesConfirm.value = '';
    updatePermanentDeleteState();
    if (permanentDeleteSeriesError) clearApiAlert(permanentDeleteSeriesError);
    showModal(permanentDeleteSeriesModal, { backdrop: 'static', keyboard: false });
  };

  const confirmPermanentDelete = async () => {
    if (!seriesRecord || !permanentDeleteSeriesConfirmBtn) return;
    const value = permanentDeleteSeriesConfirm?.value.trim().toLowerCase();
    if (value !== 'delete') {
      updatePermanentDeleteState();
      return;
    }
    permanentDeleteModalState.locked = true;
    setModalLocked(permanentDeleteSeriesModal, true);
    setButtonLoading(permanentDeleteSeriesConfirmBtn, permanentDeleteSpinner?.spinner, true);
    window.modalLock?.lock(permanentDeleteSeriesModal, 'Delete series permanently');
    try {
      const response = await apiFetch('/bookseries/delete-permanent', {
        method: 'POST',
        body: JSON.stringify({ ids: [seriesRecord.id] })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (permanentDeleteSeriesError) renderApiErrorAlert(permanentDeleteSeriesError, data, data.message || 'Unable to delete series.');
        return;
      }
      sessionStorage.setItem('seriesFlash', 'Series deleted permanently.');
      window.location.href = 'series';
    } catch (error) {
      errorLog('Permanent delete failed.', error);
      if (permanentDeleteSeriesError) renderApiErrorAlert(permanentDeleteSeriesError, { message: 'Unable to delete series right now.' }, 'Unable to delete series right now.');
    } finally {
      permanentDeleteModalState.locked = false;
      setModalLocked(permanentDeleteSeriesModal, false);
      setButtonLoading(permanentDeleteSeriesConfirmBtn, permanentDeleteSpinner?.spinner, false);
      window.modalLock?.unlock(permanentDeleteSeriesModal, 'finally');
    }
  };

  const updateOrderChangeSummary = () => {
    if (!orderEditTarget || !seriesRecord || !seriesOrderChangeSummary) return;
    const currentLabel = orderEditTarget.originalInputValue || 'No order';
    const nextInput = seriesOrderInput.value.trim();
    const nextLabel = nextInput ? nextInput : 'No order';
    const hasChanges = nextInput !== orderEditTarget.originalInputValue;
    const seriesName = seriesRecord.name || 'this series';
    seriesOrderChangeSummary.textContent = hasChanges
      ? `Changing series order in '${seriesName}' from '${currentLabel}' to '${nextLabel}'.`
      : 'No changes yet.';
    if (seriesOrderSaveBtn) {
      seriesOrderSaveBtn.disabled = orderModalState.locked || !hasChanges;
    }
  };

  const resetOrderModal = () => {
    if (!orderEditTarget) return;
    seriesOrderInput.value = orderEditTarget.originalInputValue || '';
    if (seriesOrderErrorAlert) clearApiAlert(seriesOrderErrorAlert);
    updateOrderChangeSummary();
  };

  const openOrderModal = (bookId) => {
    const book = bookRecords.find((entry) => entry.id === bookId);
    if (!book || !seriesRecord) return;
    const currentOrder = getSeriesOrder(book);
    const originalInputValue = currentOrder !== null && currentOrder !== undefined ? String(currentOrder) : '';
    orderEditTarget = { book, currentOrder, originalInputValue };
    if (seriesOrderInput) seriesOrderInput.value = originalInputValue;
    if (seriesOrderErrorAlert) clearApiAlert(seriesOrderErrorAlert);
    updateOrderChangeSummary();
    showModal(editSeriesOrderModal, { backdrop: 'static', keyboard: false });
  };

  const saveOrderChange = async () => {
    if (!orderEditTarget || !seriesRecord) return;
    const { book, currentOrder } = orderEditTarget;
    const rawValue = seriesOrderInput.value.trim();
    const nextOrder = rawValue ? Number(rawValue) : null;
    if (rawValue && (!Number.isInteger(nextOrder) || nextOrder <= 0)) {
      if (seriesOrderErrorAlert) renderApiErrorAlert(seriesOrderErrorAlert, { message: 'Validation Error', errors: ['Order must be a positive whole number.'] }, 'Validation Error');
      return;
    }
    const requestPayload = {
      seriesId: seriesRecord.id,
      bookId: book.id,
      bookOrder: nextOrder
    };
    log('Updating series order.', { request: requestPayload });
    window.modalLock?.lock(editSeriesOrderModal, 'Update series order');
    seriesOrderSaveBtn.disabled = true;
    orderModalState.locked = true;
    setModalLocked(editSeriesOrderModal, true);
    setButtonLoading(seriesOrderSaveBtn, orderSpinner?.spinner, true);
    toggleDisabled([seriesOrderInput, seriesOrderResetBtn], true);
    try {
      const response = await apiFetch('/bookseries/link', {
        method: 'PUT',
        body: JSON.stringify(requestPayload)
      });
      const data = await response.json().catch(() => ({}));
      log('Series order response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (seriesOrderErrorAlert) renderApiErrorAlert(seriesOrderErrorAlert, data, data.message || 'Unable to update order.');
        warn('Order update failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      log('Order updated.', { bookId: book.id, from: currentOrder, to: nextOrder });
      await hideModal(editSeriesOrderModal);
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Order update failed.', error);
      if (seriesOrderErrorAlert) renderApiErrorAlert(seriesOrderErrorAlert, { message: 'Unable to update order right now.' }, 'Unable to update order right now.');
    } finally {
      orderModalState.locked = false;
      setModalLocked(editSeriesOrderModal, false);
      setButtonLoading(seriesOrderSaveBtn, orderSpinner?.spinner, false);
      toggleDisabled([seriesOrderInput, seriesOrderResetBtn], false);
      updateOrderChangeSummary();
      window.modalLock?.unlock(editSeriesOrderModal, 'finally');
    }
  };

  const openRemoveModal = (bookId) => {
    const book = bookRecords.find((entry) => entry.id === bookId);
    if (!book || !seriesRecord) return;
    removeTarget = { book };
    if (removeSeriesBookText) {
      removeSeriesBookText.textContent = `Removing ${book.title || 'this book'} from ${seriesRecord.name || 'this series'}.`;
    }
    if (removeSeriesBookError) clearApiAlert(removeSeriesBookError);
    showModal(removeSeriesBookModal, { backdrop: 'static', keyboard: false });
  };

  const confirmRemove = async () => {
    if (!removeTarget || !seriesRecord) return;
    const { book } = removeTarget;
    removeSeriesBookConfirmBtn.disabled = true;
    window.modalLock?.lock(removeSeriesBookModal, 'Remove book from series');
    removeModalState.locked = true;
    setModalLocked(removeSeriesBookModal, true);
    setButtonLoading(removeSeriesBookConfirmBtn, removeSpinner?.spinner, true);
    try {
      const requestPayload = {
        seriesId: seriesRecord.id,
        bookId: book.id
      };
      log('Removing book from series.', { request: requestPayload });
      const response = await apiFetch('/bookseries/link', {
        method: 'DELETE',
        body: JSON.stringify(requestPayload)
      });
      const data = await response.json().catch(() => ({}));
      log('Remove series book response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (removeSeriesBookError) renderApiErrorAlert(removeSeriesBookError, data, data.message || 'Unable to remove book from series.');
        warn('Remove book failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      await hideModal(removeSeriesBookModal);
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Remove book failed.', error);
      if (removeSeriesBookError) renderApiErrorAlert(removeSeriesBookError, { message: 'Unable to remove book right now.' }, 'Unable to remove book right now.');
    } finally {
      removeModalState.locked = false;
      setModalLocked(removeSeriesBookModal, false);
      setButtonLoading(removeSeriesBookConfirmBtn, removeSpinner?.spinner, false);
      removeSeriesBookConfirmBtn.disabled = false;
      window.modalLock?.unlock(removeSeriesBookModal, 'finally');
    }
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
    const response = await apiFetch(`/bookseries/${seriesId}?includeDeleted=true`, { method: 'GET' });
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
    let pageLoaded = false;
    await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
    try {
      const series = await loadSeries();
      if (!series) return;
      if (!series.deletedAt) {
        const books = await loadBooks();
        renderBooks(books);
      } else {
        renderBooks([]);
      }
      pageLoaded = true;
    } catch (error) {
      errorLog('Series details load failed with exception.', error);
      await showInvalidModal(defaultInvalidSeriesMessage);
    } finally {
      await hideModal('pageLoadingModal');
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: pageLoaded });
      }
    }
  };

  if (editSeriesBtn) {
    editSeriesBtn.addEventListener('click', openEditModal);
  }
  if (deleteSeriesBtn) {
    deleteSeriesBtn.addEventListener('click', openDeleteModal);
  }
  if (restoreSeriesBtn) {
    restoreSeriesBtn.addEventListener('click', openRestoreModal);
  }
  if (permanentDeleteSeriesBtn) {
    permanentDeleteSeriesBtn.addEventListener('click', openPermanentDeleteModal);
  }
  if (seriesDeleteConfirmBtn) {
    seriesDeleteConfirmBtn.addEventListener('click', confirmDelete);
  }
  if (restoreSeriesMode) {
    restoreSeriesMode.addEventListener('change', updateRestoreSummary);
  }
  if (restoreSeriesConfirmBtn) {
    restoreSeriesConfirmBtn.addEventListener('click', confirmRestore);
  }
  if (permanentDeleteSeriesConfirm) {
    permanentDeleteSeriesConfirm.addEventListener('input', updatePermanentDeleteState);
  }
  if (permanentDeleteSeriesConfirmBtn) {
    permanentDeleteSeriesConfirmBtn.addEventListener('click', confirmPermanentDelete);
  }
  if (seriesOrderSaveBtn) {
    seriesOrderSaveBtn.addEventListener('click', saveOrderChange);
  }
  if (seriesOrderResetBtn) {
    seriesOrderResetBtn.addEventListener('click', resetOrderModal);
  }
  if (removeSeriesBookConfirmBtn) {
    removeSeriesBookConfirmBtn.addEventListener('click', confirmRemove);
  }
  if (seriesOrderInput) {
    seriesOrderInput.addEventListener('input', () => {
      if (!orderEditTarget) return;
      updateOrderChangeSummary();
    });
  }

  const sharedEvents = window.sharedAddModals?.events;
  if (sharedEvents) {
    sharedEvents.addEventListener('series:updated', async () => {
      await loadSeries();
    });
  }

  loadPage();

  if (window.actionRouter && typeof window.actionRouter.register === 'function') {
    window.actionRouter.register('edit_series', async ({ params }) => {
      const targetId = Number.parseInt(params.series_id || params.seriesId || params.id, 10);
      if (!Number.isInteger(targetId) || targetId !== seriesId) return;
      if (!seriesRecord) {
        log('Action requested before series data loaded; waiting for page readiness.');
      }
      openEditModal();
    }, { removeKeys: ['series_id', 'seriesId', 'id'] });
    window.actionRouter.run({ source: 'series-details' });
  }
});
