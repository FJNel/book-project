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
  const editSeriesBtn = document.getElementById('editSeriesBtn');
  const deleteSeriesBtn = document.getElementById('deleteSeriesBtn');
  const editSeriesModal = document.getElementById('editSeriesModal');
  const seriesEditName = document.getElementById('seriesEditName');
  const seriesEditWebsite = document.getElementById('seriesEditWebsite');
  const seriesEditStartDate = document.getElementById('seriesEditStartDate');
  const seriesEditEndDate = document.getElementById('seriesEditEndDate');
  const seriesEditDescription = document.getElementById('seriesEditDescription');
  const seriesEditNameHelp = document.getElementById('seriesEditNameHelp');
  const seriesEditWebsiteHelp = document.getElementById('seriesEditWebsiteHelp');
  const seriesEditStartDateHelp = document.getElementById('seriesEditStartDateHelp');
  const seriesEditEndDateHelp = document.getElementById('seriesEditEndDateHelp');
  const seriesEditDescriptionHelp = document.getElementById('seriesEditDescriptionHelp');
  const seriesEditSaveBtn = document.getElementById('seriesEditSaveBtn');
  const seriesEditErrorAlert = document.getElementById('seriesEditErrorAlert');
  const deleteSeriesModal = document.getElementById('deleteSeriesModal');
  const deleteSeriesName = document.getElementById('deleteSeriesName');
  const seriesDeleteConfirmBtn = document.getElementById('seriesDeleteConfirmBtn');
  const seriesDeleteErrorAlert = document.getElementById('seriesDeleteErrorAlert');
  const editSeriesOrderModal = document.getElementById('editSeriesOrderModal');
  const seriesOrderInput = document.getElementById('seriesOrderInput');
  const seriesOrderSummary = document.getElementById('seriesOrderSummary');
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

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const parsePartialDateInput = (value) => {
    if (!value || !value.trim()) return { value: null };
    if (!window.partialDateParser || typeof window.partialDateParser.parsePartialDate !== 'function') {
      return { error: 'Date parser is unavailable.' };
    }
    const parsed = window.partialDateParser.parsePartialDate(value.trim());
    if (!parsed || !parsed.text) return { error: 'Please enter a valid date.' };
    return { value: parsed };
  };

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
    bookRecords = books;

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
      const order = getSeriesOrder(book);
      const orderLabel = order !== null && order !== undefined ? String(order) : '—';

      row.innerHTML = `
        <td class="list-col-order">
          <div class="d-flex flex-column gap-1">
            <span class="text-muted">${escapeHtml(orderLabel)}</span>
            <div class="d-flex gap-2 list-row-actions" aria-label="Row actions">
              <button class="btn btn-sm p-0 border-0 text-muted" type="button" data-order-edit="${book.id}" aria-label="Edit order" title="Edit order">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708z"/>
                  <path d="M12.5 6.207 9.793 3.5 4 9.293V12h2.707z"/>
                  <path fill-rule="evenodd" d="M1 13.5a.5.5 0 0 0 .5.5H5l8.5-8.5-3-3L2 11.5V13.5z"/>
                </svg>
              </button>
              <button class="btn btn-sm p-0 border-0 text-danger" type="button" data-order-remove="${book.id}" aria-label="Remove from series" title="Remove from series">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                  <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2h3.11a1 1 0 0 1 .98-.804h2.82a1 1 0 0 1 .98.804h3.11a1 1 0 0 1 1 1"/>
                </svg>
              </button>
            </div>
          </div>
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
      `;
      row.addEventListener('click', () => {
        window.location.href = `book-details?id=${book.id}`;
      });
      body.appendChild(row);
    });

    body.querySelectorAll('[data-order-edit]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const bookId = Number(button.getAttribute('data-order-edit'));
        if (Number.isInteger(bookId)) openOrderModal(bookId);
      });
    });
    body.querySelectorAll('[data-order-remove]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const bookId = Number(button.getAttribute('data-order-remove'));
        if (Number.isInteger(bookId)) openRemoveModal(bookId);
      });
    });
  };

  const openEditModal = () => {
    if (!seriesRecord) return;
    if (seriesEditName) seriesEditName.value = seriesRecord.name || '';
    if (seriesEditWebsite) seriesEditWebsite.value = seriesRecord.website || '';
    if (seriesEditStartDate) seriesEditStartDate.value = seriesRecord.startDate?.text || '';
    if (seriesEditEndDate) seriesEditEndDate.value = seriesRecord.endDate?.text || '';
    if (seriesEditDescription) seriesEditDescription.value = seriesRecord.description || '';
    [seriesEditNameHelp, seriesEditWebsiteHelp, seriesEditStartDateHelp, seriesEditEndDateHelp, seriesEditDescriptionHelp]
      .forEach((el) => clearHelpText(el));
    if (seriesEditErrorAlert) {
      seriesEditErrorAlert.classList.add('d-none');
      seriesEditErrorAlert.textContent = '';
    }
    showModal(editSeriesModal, { backdrop: 'static', keyboard: false });
  };

  const validateEditForm = () => {
    let valid = true;
    const name = seriesEditName?.value.trim() || '';
    if (!name) {
      setHelpText(seriesEditNameHelp, 'Series name is required.', true);
      valid = false;
    } else if (name.length < 2 || name.length > 150) {
      setHelpText(seriesEditNameHelp, 'Series name must be between 2 and 150 characters.', true);
      valid = false;
    } else {
      clearHelpText(seriesEditNameHelp);
    }

    const websiteRaw = seriesEditWebsite?.value.trim() || '';
    if (websiteRaw && !normalizeUrl(websiteRaw)) {
      setHelpText(seriesEditWebsiteHelp, 'Website must be a valid URL.', true);
      valid = false;
    } else {
      clearHelpText(seriesEditWebsiteHelp);
    }

    const startRaw = seriesEditStartDate?.value.trim() || '';
    if (startRaw) {
      const parsed = parsePartialDateInput(startRaw);
      if (parsed.error) {
        setHelpText(seriesEditStartDateHelp, parsed.error, true);
        valid = false;
      } else {
        clearHelpText(seriesEditStartDateHelp);
      }
    } else {
      clearHelpText(seriesEditStartDateHelp);
    }

    const endRaw = seriesEditEndDate?.value.trim() || '';
    if (endRaw) {
      const parsed = parsePartialDateInput(endRaw);
      if (parsed.error) {
        setHelpText(seriesEditEndDateHelp, parsed.error, true);
        valid = false;
      } else {
        clearHelpText(seriesEditEndDateHelp);
      }
    } else {
      clearHelpText(seriesEditEndDateHelp);
    }

    const descRaw = seriesEditDescription?.value.trim() || '';
    if (descRaw && descRaw.length > 1000) {
      setHelpText(seriesEditDescriptionHelp, 'Description must be 1000 characters or fewer.', true);
      valid = false;
    } else {
      clearHelpText(seriesEditDescriptionHelp);
    }

    return valid;
  };

  const saveSeriesEdits = async () => {
    if (!seriesRecord) return;
    if (!validateEditForm()) return;
    const name = seriesEditName.value.trim();
    const websiteRaw = seriesEditWebsite.value.trim();
    const startRaw = seriesEditStartDate.value.trim();
    const endRaw = seriesEditEndDate.value.trim();
    const descRaw = seriesEditDescription.value.trim();
    const payload = {
      id: seriesRecord.id,
      name,
      website: websiteRaw ? normalizeUrl(websiteRaw) : null,
      description: descRaw || null,
      startDate: startRaw ? parsePartialDateInput(startRaw).value : null,
      endDate: endRaw ? parsePartialDateInput(endRaw).value : null
    };
    log('Updating series.', { id: seriesRecord.id });
    seriesEditSaveBtn.disabled = true;
    try {
      const response = await apiFetch('/bookseries', { method: 'PUT', body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (seriesEditErrorAlert) {
          seriesEditErrorAlert.classList.remove('d-none');
          seriesEditErrorAlert.textContent = data.message || 'Unable to update series.';
        }
        warn('Series update failed.', { status: response.status, data });
        return;
      }
      await hideModal(editSeriesModal);
      log('Series updated successfully.');
      await loadSeries();
    } catch (error) {
      errorLog('Series update failed.', error);
      if (seriesEditErrorAlert) {
        seriesEditErrorAlert.classList.remove('d-none');
        seriesEditErrorAlert.textContent = 'Unable to update series right now.';
      }
    } finally {
      seriesEditSaveBtn.disabled = false;
    }
  };

  const openDeleteModal = () => {
    if (!seriesRecord) return;
    if (deleteSeriesName) deleteSeriesName.textContent = seriesRecord.name || 'this series';
    if (seriesDeleteErrorAlert) {
      seriesDeleteErrorAlert.classList.add('d-none');
      seriesDeleteErrorAlert.textContent = '';
    }
    showModal(deleteSeriesModal, { backdrop: 'static', keyboard: false });
  };

  const confirmDelete = async () => {
    if (!seriesRecord) return;
    seriesDeleteConfirmBtn.disabled = true;
    try {
      const response = await apiFetch('/bookseries', { method: 'DELETE', body: JSON.stringify({ id: seriesRecord.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (seriesDeleteErrorAlert) {
          seriesDeleteErrorAlert.classList.remove('d-none');
          seriesDeleteErrorAlert.textContent = data.message || 'Unable to delete series.';
        }
        warn('Series delete failed.', { status: response.status, data });
        return;
      }
      sessionStorage.setItem('seriesFlash', 'Series deleted successfully.');
      window.location.href = 'series';
    } catch (error) {
      errorLog('Series delete failed.', error);
      if (seriesDeleteErrorAlert) {
        seriesDeleteErrorAlert.classList.remove('d-none');
        seriesDeleteErrorAlert.textContent = 'Unable to delete series right now.';
      }
    } finally {
      seriesDeleteConfirmBtn.disabled = false;
    }
  };

  const updateOrderSummary = (book, currentOrder, nextOrder) => {
    if (!seriesOrderSummary || !seriesRecord) return;
    const current = currentOrder !== null && currentOrder !== undefined ? String(currentOrder) : 'No order';
    const next = nextOrder !== null && nextOrder !== undefined ? String(nextOrder) : 'No order';
    seriesOrderSummary.textContent = `Changing ${book.title || 'this book'}'s order in ${seriesRecord.name || 'this series'} from ${current} to ${next}.`;
  };

  const openOrderModal = (bookId) => {
    const book = bookRecords.find((entry) => entry.id === bookId);
    if (!book || !seriesRecord) return;
    const currentOrder = getSeriesOrder(book);
    orderEditTarget = { book, currentOrder };
    if (seriesOrderInput) seriesOrderInput.value = currentOrder || '';
    if (seriesOrderErrorAlert) {
      seriesOrderErrorAlert.classList.add('d-none');
      seriesOrderErrorAlert.textContent = '';
    }
    updateOrderSummary(book, currentOrder, seriesOrderInput.value ? Number(seriesOrderInput.value) : null);
    showModal(editSeriesOrderModal, { backdrop: 'static', keyboard: false });
  };

  const saveOrderChange = async () => {
    if (!orderEditTarget || !seriesRecord) return;
    const { book, currentOrder } = orderEditTarget;
    const rawValue = seriesOrderInput.value.trim();
    const nextOrder = rawValue ? Number(rawValue) : null;
    if (rawValue && (!Number.isInteger(nextOrder) || nextOrder <= 0)) {
      if (seriesOrderErrorAlert) {
        seriesOrderErrorAlert.classList.remove('d-none');
        seriesOrderErrorAlert.textContent = 'Order must be a positive whole number.';
      }
      return;
    }
    seriesOrderSaveBtn.disabled = true;
    try {
      const response = await apiFetch('/bookseries/link', {
        method: 'PUT',
        body: JSON.stringify({
          seriesId: seriesRecord.id,
          bookId: book.id,
          bookOrder: nextOrder
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (seriesOrderErrorAlert) {
          seriesOrderErrorAlert.classList.remove('d-none');
          seriesOrderErrorAlert.textContent = data.message || 'Unable to update order.';
        }
        warn('Order update failed.', { status: response.status, data });
        return;
      }
      log('Order updated.', { bookId: book.id, from: currentOrder, to: nextOrder });
      await hideModal(editSeriesOrderModal);
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Order update failed.', error);
      if (seriesOrderErrorAlert) {
        seriesOrderErrorAlert.classList.remove('d-none');
        seriesOrderErrorAlert.textContent = 'Unable to update order right now.';
      }
    } finally {
      seriesOrderSaveBtn.disabled = false;
    }
  };

  const openRemoveModal = (bookId) => {
    const book = bookRecords.find((entry) => entry.id === bookId);
    if (!book || !seriesRecord) return;
    removeTarget = { book };
    if (removeSeriesBookText) {
      removeSeriesBookText.textContent = `Removing ${book.title || 'this book'} from ${seriesRecord.name || 'this series'}.`;
    }
    if (removeSeriesBookError) {
      removeSeriesBookError.classList.add('d-none');
      removeSeriesBookError.textContent = '';
    }
    showModal(removeSeriesBookModal, { backdrop: 'static', keyboard: false });
  };

  const confirmRemove = async () => {
    if (!removeTarget || !seriesRecord) return;
    const { book } = removeTarget;
    removeSeriesBookConfirmBtn.disabled = true;
    try {
      const response = await apiFetch('/bookseries/link', {
        method: 'DELETE',
        body: JSON.stringify({
          seriesId: seriesRecord.id,
          bookId: book.id
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (removeSeriesBookError) {
          removeSeriesBookError.classList.remove('d-none');
          removeSeriesBookError.textContent = data.message || 'Unable to remove book from series.';
        }
        warn('Remove book failed.', { status: response.status, data });
        return;
      }
      await hideModal(removeSeriesBookModal);
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Remove book failed.', error);
      if (removeSeriesBookError) {
        removeSeriesBookError.classList.remove('d-none');
        removeSeriesBookError.textContent = 'Unable to remove book right now.';
      }
    } finally {
      removeSeriesBookConfirmBtn.disabled = false;
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

  if (editSeriesBtn) {
    editSeriesBtn.addEventListener('click', openEditModal);
  }
  if (seriesEditSaveBtn) {
    seriesEditSaveBtn.addEventListener('click', saveSeriesEdits);
  }
  if (deleteSeriesBtn) {
    deleteSeriesBtn.addEventListener('click', openDeleteModal);
  }
  if (seriesDeleteConfirmBtn) {
    seriesDeleteConfirmBtn.addEventListener('click', confirmDelete);
  }
  if (seriesOrderSaveBtn) {
    seriesOrderSaveBtn.addEventListener('click', saveOrderChange);
  }
  if (removeSeriesBookConfirmBtn) {
    removeSeriesBookConfirmBtn.addEventListener('click', confirmRemove);
  }
  if (seriesOrderInput) {
    seriesOrderInput.addEventListener('input', () => {
      if (!orderEditTarget) return;
      updateOrderSummary(orderEditTarget.book, orderEditTarget.currentOrder, seriesOrderInput.value ? Number(seriesOrderInput.value) : null);
    });
  }

  loadPage();
});
