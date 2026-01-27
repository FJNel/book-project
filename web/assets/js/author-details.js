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
    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve({ success: false, rateLimited: true });
    }
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
  const authorDeletedNotice = document.getElementById('authorDeletedNotice');
  const authorDeletedText = document.getElementById('authorDeletedText');
  const editAuthorBtn = document.getElementById('editAuthorBtn');
  const deleteAuthorBtn = document.getElementById('deleteAuthorBtn');
  const restoreAuthorBtn = document.getElementById('restoreAuthorBtn');
  const permanentDeleteAuthorBtn = document.getElementById('permanentDeleteAuthorBtn');
  const deleteAuthorModal = document.getElementById('deleteAuthorModal');
  const deleteAuthorName = document.getElementById('deleteAuthorName');
  const authorDeleteConfirmBtn = document.getElementById('authorDeleteConfirmBtn');
  const authorDeleteErrorAlert = document.getElementById('authorDeleteErrorAlert');
  const restoreAuthorModal = document.getElementById('restoreAuthorModal');
  const restoreAuthorMode = document.getElementById('restoreAuthorMode');
  const restoreAuthorModeHelp = document.getElementById('restoreAuthorModeHelp');
  const restoreAuthorChangesSummary = document.getElementById('restoreAuthorChangesSummary');
  const restoreAuthorError = document.getElementById('restoreAuthorError');
  const restoreAuthorConfirmBtn = document.getElementById('restoreAuthorConfirmBtn');
  const permanentDeleteAuthorModal = document.getElementById('permanentDeleteAuthorModal');
  const permanentDeleteAuthorConfirm = document.getElementById('permanentDeleteAuthorConfirm');
  const permanentDeleteAuthorHelp = document.getElementById('permanentDeleteAuthorHelp');
  const permanentDeleteAuthorError = document.getElementById('permanentDeleteAuthorError');
  const permanentDeleteAuthorConfirmBtn = document.getElementById('permanentDeleteAuthorConfirmBtn');
  const editAuthorRoleModal = document.getElementById('editAuthorRoleModal');
  const authorRoleSelect = document.getElementById('authorRoleSelect');
  const authorRoleOtherWrap = document.getElementById('authorRoleOtherWrap');
  const authorRoleOtherInput = document.getElementById('authorRoleOtherInput');
  const authorRoleHelp = document.getElementById('authorRoleHelp');
  const authorRoleChangeSummary = document.getElementById('authorRoleChangeSummary');
  const authorRoleResetBtn = document.getElementById('authorRoleResetBtn');
  const authorRoleSaveBtn = document.getElementById('authorRoleSaveBtn');
  const authorRoleErrorAlert = document.getElementById('authorRoleErrorAlert');
  const removeAuthorBookModal = document.getElementById('removeAuthorBookModal');
  const removeAuthorBookText = document.getElementById('removeAuthorBookText');
  const removeAuthorBookConfirmBtn = document.getElementById('removeAuthorBookConfirmBtn');
  const removeAuthorBookError = document.getElementById('removeAuthorBookError');

  let authorRecord = null;
  let bookRecords = [];
  let roleEditTarget = null;
  const authorRolePattern = /^[\p{L}0-9 .,'":;!?()&\/-]+$/u;
  const authorRoleOptions = new Set(['Author', 'Editor', 'Illustrator', 'Translator']);
  const authorRoleModalState = { locked: false };
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
    if (authorDeletedNotice) {
      authorDeletedNotice.classList.toggle('d-none', !isDeleted);
    }
    if (authorDeletedText) {
      if (isDeleted) {
        const formatted = formatDateTime(deletedAt) || 'Unknown date';
        authorDeletedText.textContent = `This author was deleted on ${formatted}.`;
      } else {
        authorDeletedText.textContent = 'This author is in the recycle bin.';
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
    log('Showing invalid author modal.', { message });
    if (invalidModalMessage) invalidModalMessage.textContent = message || defaultInvalidAuthorMessage;
    await hideModal('pageLoadingModal');
    await showModal(invalidModal, { backdrop: 'static', keyboard: false });
  };

  const deleteModalState = { locked: false };
  const removeModalState = { locked: false };
  const restoreModalState = { locked: false };
  const permanentDeleteModalState = { locked: false };
  const authorRoleSpinner = attachButtonSpinner(authorRoleSaveBtn);
  const deleteSpinner = attachButtonSpinner(authorDeleteConfirmBtn);
  const removeSpinner = attachButtonSpinner(removeAuthorBookConfirmBtn);
  const restoreSpinner = attachButtonSpinner(restoreAuthorConfirmBtn);
  const permanentDeleteSpinner = attachButtonSpinner(permanentDeleteAuthorConfirmBtn);

  bindModalLock(editAuthorRoleModal, authorRoleModalState);
  bindModalLock(deleteAuthorModal, deleteModalState);
  bindModalLock(removeAuthorBookModal, removeModalState);
  bindModalLock(restoreAuthorModal, restoreModalState);
  bindModalLock(permanentDeleteAuthorModal, permanentDeleteModalState);

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
    authorRecord = author;
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

    applyDeletedState(Boolean(author.deletedAt), author.deletedAt);
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
    bookRecords = books;

    books.forEach((book) => {
      const row = document.createElement('tr');
      row.className = 'clickable-row';
      const rowHref = `book-details?id=${book.id}`;
      row.dataset.rowHref = rowHref;
      row.setAttribute('role', 'link');
      row.setAttribute('tabindex', '0');
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
        <td class="list-col-role">
          <span class="text-muted">${escapeHtml(role)}</span>
        </td>
        <td class="list-col-type"><span class="text-muted">${escapeHtml(bookType)}</span></td>
        <td class="list-col-language"><span class="text-muted"${languageTitle}>${escapeHtml(languageLabel)}</span></td>
        <td class="list-col-published"><span class="text-muted">${escapeHtml(published)}</span></td>
        <td class="list-col-tags">${visibleTags.map((tag) => `<span class="badge rounded-pill text-bg-light text-dark border">${escapeHtml(tag.name)}</span>`).join(' ')}${remainingTags > 0 ? ` <span class="badge rounded-pill text-bg-light text-dark border">+${remainingTags}</span>` : ''}</td>
        <td class="list-col-actions text-end">
          <div class="row-actions d-inline-flex gap-1">
            <button class="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center p-2" type="button" data-role-edit="${book.id}" data-bs-toggle="tooltip" title="Edit author role" aria-label="Edit author role">
              <i class="bi bi-pencil-fill" aria-hidden="true"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center p-2" type="button" data-role-remove="${book.id}" data-bs-toggle="tooltip" title="Remove author from this book" aria-label="Remove author from this book">
              <i class="bi bi-trash-fill"></i>
            </button>
          </div>
        </td>
      `;
      row.addEventListener('click', (event) => {
        if (event.target.closest('button, a, input, select, textarea, [data-row-action], [data-stop-row]')) return;
        window.location.href = rowHref;
      });
      row.addEventListener('keydown', (event) => {
        if (event.target.closest && event.target.closest('button, a, input, select, textarea, [data-row-action], [data-stop-row]')) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.href = rowHref;
        }
      });
      body.appendChild(row);
    });

    body.querySelectorAll('[data-role-edit]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = Number.parseInt(button.getAttribute('data-role-edit'), 10);
        if (!Number.isInteger(id)) return;
        openRoleModal(id);
      });
    });

    body.querySelectorAll('[data-role-remove]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = Number.parseInt(button.getAttribute('data-role-remove'), 10);
        if (!Number.isInteger(id)) return;
        openRemoveModal(id);
      });
    });

    if (typeof window.initializeTooltips === 'function') {
      window.initializeTooltips();
    }
  };

  const openEditModal = () => {
    if (!authorRecord) return;
    window.sharedAddModals?.open('author', {
      mode: 'edit',
      initial: {
        id: authorRecord.id,
        displayName: authorRecord.displayName || '',
        firstNames: authorRecord.firstNames || '',
        lastName: authorRecord.lastName || '',
        birthDate: authorRecord.birthDate?.text || '',
        deathDate: authorRecord.deathDate?.text || '',
        deceased: Boolean(authorRecord.deceased),
        bio: authorRecord.bio || ''
      }
    });
  };

  const openDeleteModal = () => {
    if (!authorRecord) return;
    log('Opening delete author modal.', { authorId: authorRecord.id });
    deleteModalState.locked = false;
    setModalLocked(deleteAuthorModal, false);
    if (deleteAuthorName) deleteAuthorName.textContent = authorRecord.displayName || 'this author';
    if (authorDeleteErrorAlert) clearApiAlert(authorDeleteErrorAlert);
    showModal(deleteAuthorModal, { backdrop: 'static', keyboard: false });
  };

  const confirmDelete = async () => {
    if (!authorRecord) return;
    authorDeleteConfirmBtn.disabled = true;
    window.modalLock?.lock(deleteAuthorModal, 'Delete author');
    deleteModalState.locked = true;
    setModalLocked(deleteAuthorModal, true);
    setButtonLoading(authorDeleteConfirmBtn, deleteSpinner?.spinner, true);
    try {
      const response = await apiFetch('/author', { method: 'DELETE', body: JSON.stringify({ id: authorRecord.id }) });
      const data = await response.json().catch(() => ({}));
      log('Author delete response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (authorDeleteErrorAlert) renderApiErrorAlert(authorDeleteErrorAlert, data, data.message || 'Unable to delete author.');
        warn('Author delete failed.', { status: response.status, data });
        return;
      }
      sessionStorage.setItem('authorsFlash', 'Author deleted successfully.');
      window.location.href = 'authors';
    } catch (error) {
      errorLog('Author delete failed.', error);
      if (authorDeleteErrorAlert) renderApiErrorAlert(authorDeleteErrorAlert, { message: 'Unable to delete author right now.' }, 'Unable to delete author right now.');
    } finally {
      deleteModalState.locked = false;
      setModalLocked(deleteAuthorModal, false);
      setButtonLoading(authorDeleteConfirmBtn, deleteSpinner?.spinner, false);
      authorDeleteConfirmBtn.disabled = false;
      window.modalLock?.unlock(deleteAuthorModal, 'finally');
    }
  };

  const updateRestoreSummary = () => {
    if (!restoreAuthorMode || !restoreAuthorChangesSummary) return;
    const mode = restoreAuthorMode.value || 'decline';
    const label = mode === 'merge' ? 'Merge' : mode === 'override' ? 'Override' : 'Decline';
    restoreAuthorChangesSummary.textContent = `Restore this author using ${label} mode.`;
    if (restoreAuthorModeHelp) {
      const helpText = mode === 'merge'
        ? 'Merge combines details into the existing author when possible.'
        : mode === 'override'
          ? 'Override replaces the existing author by restoring this one.'
          : 'Decline leaves the author deleted if a conflict is found.';
      restoreAuthorModeHelp.textContent = helpText;
      restoreAuthorModeHelp.classList.remove('text-danger');
      restoreAuthorModeHelp.classList.add('text-muted');
    }
  };

  const openRestoreModal = () => {
    if (!authorRecord || !restoreAuthorModal) return;
    restoreModalState.locked = false;
    setModalLocked(restoreAuthorModal, false);
    if (restoreAuthorMode) restoreAuthorMode.value = 'decline';
    if (restoreAuthorError) clearApiAlert(restoreAuthorError);
    updateRestoreSummary();
    restoreAuthorConfirmBtn.disabled = false;
    showModal(restoreAuthorModal, { backdrop: 'static', keyboard: false });
  };

  const confirmRestore = async () => {
    if (!authorRecord || !restoreAuthorConfirmBtn) return;
    const mode = restoreAuthorMode?.value || 'decline';
    if (restoreAuthorError) clearApiAlert(restoreAuthorError);
    restoreModalState.locked = true;
    setModalLocked(restoreAuthorModal, true);
    setButtonLoading(restoreAuthorConfirmBtn, restoreSpinner?.spinner, true);
    window.modalLock?.lock(restoreAuthorModal, 'Restore author');
    try {
      const response = await apiFetch('/author/restore', {
        method: 'POST',
        body: JSON.stringify({ ids: [authorRecord.id], mode })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (restoreAuthorError) renderApiErrorAlert(restoreAuthorError, data, data.message || 'Unable to restore author.');
        return;
      }
      await hideModal(restoreAuthorModal);
      const refreshed = await loadAuthor();
      if (refreshed && !refreshed.deletedAt) {
        const books = await loadBooks();
        renderBooks(books);
      }
    } catch (error) {
      errorLog('Restore author failed.', error);
      if (restoreAuthorError) renderApiErrorAlert(restoreAuthorError, { message: 'Unable to restore author right now.' }, 'Unable to restore author right now.');
    } finally {
      restoreModalState.locked = false;
      setModalLocked(restoreAuthorModal, false);
      setButtonLoading(restoreAuthorConfirmBtn, restoreSpinner?.spinner, false);
      restoreAuthorConfirmBtn.disabled = false;
      window.modalLock?.unlock(restoreAuthorModal, 'finally');
    }
  };

  const updatePermanentDeleteState = () => {
    if (!permanentDeleteAuthorConfirmBtn || !permanentDeleteAuthorConfirm) return;
    const value = permanentDeleteAuthorConfirm.value.trim();
    const matches = value.toLowerCase() === 'delete';
    permanentDeleteAuthorConfirmBtn.disabled = !matches;
    if (permanentDeleteAuthorHelp) {
      setHelpText(permanentDeleteAuthorHelp, matches ? 'Confirmed.' : 'Enter DELETE to enable permanent deletion.', !matches);
    }
  };

  const openPermanentDeleteModal = () => {
    if (!authorRecord || !permanentDeleteAuthorModal) return;
    permanentDeleteModalState.locked = false;
    setModalLocked(permanentDeleteAuthorModal, false);
    if (permanentDeleteAuthorConfirm) permanentDeleteAuthorConfirm.value = '';
    updatePermanentDeleteState();
    if (permanentDeleteAuthorError) clearApiAlert(permanentDeleteAuthorError);
    showModal(permanentDeleteAuthorModal, { backdrop: 'static', keyboard: false });
  };

  const confirmPermanentDelete = async () => {
    if (!authorRecord || !permanentDeleteAuthorConfirmBtn) return;
    const value = permanentDeleteAuthorConfirm?.value.trim().toLowerCase();
    if (value !== 'delete') {
      updatePermanentDeleteState();
      return;
    }
    permanentDeleteModalState.locked = true;
    setModalLocked(permanentDeleteAuthorModal, true);
    setButtonLoading(permanentDeleteAuthorConfirmBtn, permanentDeleteSpinner?.spinner, true);
    window.modalLock?.lock(permanentDeleteAuthorModal, 'Delete author permanently');
    try {
      const response = await apiFetch('/author/delete-permanent', {
        method: 'POST',
        body: JSON.stringify({ ids: [authorRecord.id] })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (permanentDeleteAuthorError) renderApiErrorAlert(permanentDeleteAuthorError, data, data.message || 'Unable to delete author.');
        return;
      }
      sessionStorage.setItem('authorsFlash', 'Author deleted permanently.');
      window.location.href = 'authors';
    } catch (error) {
      errorLog('Permanent delete failed.', error);
      if (permanentDeleteAuthorError) renderApiErrorAlert(permanentDeleteAuthorError, { message: 'Unable to delete author right now.' }, 'Unable to delete author right now.');
    } finally {
      permanentDeleteModalState.locked = false;
      setModalLocked(permanentDeleteAuthorModal, false);
      setButtonLoading(permanentDeleteAuthorConfirmBtn, permanentDeleteSpinner?.spinner, false);
      window.modalLock?.unlock(permanentDeleteAuthorModal, 'finally');
    }
  };

  const getAuthorRoleValue = () => {
    if (!authorRoleSelect) return '';
    const selected = authorRoleSelect.value;
    if (selected === 'none') return '';
    if (selected === 'Other') return authorRoleOtherInput?.value.trim() || '';
    return selected || '';
  };

  const applyAuthorRoleFields = (role) => {
    if (!authorRoleSelect) return;
    if (!role) {
      authorRoleSelect.value = 'none';
      if (authorRoleOtherWrap) authorRoleOtherWrap.classList.add('d-none');
      if (authorRoleOtherInput) authorRoleOtherInput.value = '';
      return;
    }
    if (authorRoleOptions.has(role)) {
      authorRoleSelect.value = role;
      if (authorRoleOtherWrap) authorRoleOtherWrap.classList.add('d-none');
      if (authorRoleOtherInput) authorRoleOtherInput.value = '';
    } else {
      authorRoleSelect.value = 'Other';
      if (authorRoleOtherWrap) authorRoleOtherWrap.classList.remove('d-none');
      if (authorRoleOtherInput) authorRoleOtherInput.value = role;
    }
  };

  const updateAuthorRoleChangeSummary = () => {
    if (!authorRoleChangeSummary || !roleEditTarget || !authorRecord) return;
    const currentLabel = roleEditTarget.originalInputValue || 'No role';
    const nextInput = getAuthorRoleValue();
    const nextLabel = nextInput || 'No role';
    const hasChanges = nextInput !== roleEditTarget.originalInputValue;
    const authorName = authorRecord.displayName || 'this author';
    authorRoleChangeSummary.textContent = hasChanges
      ? `Changing author role for '${authorName}' from '${currentLabel}' to '${nextLabel}'.`
      : 'No changes yet.';
    if (authorRoleSaveBtn) authorRoleSaveBtn.disabled = authorRoleModalState.locked || !hasChanges;
  };

  const setAuthorRoleLocked = (locked) => {
    authorRoleModalState.locked = locked;
    setModalLocked(editAuthorRoleModal, locked);
    toggleDisabled([authorRoleSelect, authorRoleOtherInput, authorRoleResetBtn], locked);
    if (authorRoleSpinner) setButtonLoading(authorRoleSaveBtn, authorRoleSpinner.spinner, locked);
    updateAuthorRoleChangeSummary();
  };

  const resetAuthorRoleModal = () => {
    if (!roleEditTarget) return;
    applyAuthorRoleFields(roleEditTarget.originalInputValue || '');
    if (authorRoleErrorAlert) {
      authorRoleErrorAlert.classList.add('d-none');
      authorRoleErrorAlert.textContent = '';
    }
    if (authorRoleHelp) {
      authorRoleHelp.textContent = 'Select a role or choose Other to enter a custom role.';
      authorRoleHelp.classList.remove('text-danger');
    }
    updateAuthorRoleChangeSummary();
  };

  const openRoleModal = (bookId) => {
    const book = bookRecords.find((entry) => entry.id === bookId);
    if (!book || !authorRecord) return;
    log('Opening author role modal.', { bookId, authorId: authorRecord.id });
    const currentRole = extractAuthorRole(book);
    const originalInputValue = currentRole === 'Contributor' ? '' : (currentRole || '');
    roleEditTarget = { book, currentRole, originalInputValue };
    applyAuthorRoleFields(originalInputValue);
    if (authorRoleErrorAlert) {
      authorRoleErrorAlert.classList.add('d-none');
      authorRoleErrorAlert.textContent = '';
    }
    if (authorRoleHelp) {
      authorRoleHelp.textContent = 'Select a role or choose Other to enter a custom role.';
      authorRoleHelp.classList.remove('text-danger');
    }
    updateAuthorRoleChangeSummary();
    showModal(editAuthorRoleModal, { backdrop: 'static', keyboard: false });
  };

  const saveRoleChange = async () => {
    if (!roleEditTarget) return;
    const { book, currentRole } = roleEditTarget;
    const selectedRole = authorRoleSelect?.value || 'none';
    const nextRole = getAuthorRoleValue();
    if (selectedRole === 'Other' && (!nextRole || nextRole.length < 2 || nextRole.length > 100 || !authorRolePattern.test(nextRole))) {
      if (authorRoleHelp) {
        authorRoleHelp.textContent = 'Custom role must be 2-100 characters and use letters, numbers, and basic punctuation.';
        authorRoleHelp.classList.add('text-danger');
      }
      return;
    }
    const authors = Array.isArray(book.authors) ? book.authors.map((entry) => ({
      authorId: Number.parseInt(entry.authorId, 10),
      authorRole: entry.authorId === authorId ? (nextRole || null) : (entry.authorRole || null)
    })) : [];
    const requestPayload = { id: Number.parseInt(book.id, 10), authors };
    log('Updating author role on book.', { request: requestPayload, bookId: book.id });
    window.modalLock?.lock(editAuthorRoleModal, 'Update author role');
    setAuthorRoleLocked(true);
    try {
      const response = await apiFetch('/book', { method: 'PUT', body: requestPayload });
      const data = await response.json().catch(() => ({}));
      log('Author role response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (authorRoleErrorAlert) renderApiErrorAlert(authorRoleErrorAlert, data, data.message || 'Unable to update role.');
        warn('Role update failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      if (authorRoleErrorAlert) clearApiAlert(authorRoleErrorAlert);
      log('Role updated.', { bookId: book.id, from: currentRole, to: nextRole || null });
      await hideModal(editAuthorRoleModal);
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Role update failed.', error);
      if (authorRoleErrorAlert) renderApiErrorAlert(authorRoleErrorAlert, { message: 'Unable to update role right now.' }, 'Unable to update role right now.');
    } finally {
      setAuthorRoleLocked(false);
      window.modalLock?.unlock(editAuthorRoleModal, 'finally');
    }
  };

  const openRemoveModal = (bookId) => {
    const book = bookRecords.find((entry) => entry.id === bookId);
    if (!book || !authorRecord) return;
    log('Opening remove author modal.', { bookId, authorId: authorRecord.id });
    removeModalState.locked = false;
    setModalLocked(removeAuthorBookModal, false);
    removeTarget = { book };
    if (removeAuthorBookText) {
      removeAuthorBookText.textContent = `Removing ${authorRecord.displayName || 'this author'} from ${book.title || 'this book'}.`;
    }
    if (removeAuthorBookError) {
      removeAuthorBookError.classList.add('d-none');
      removeAuthorBookError.textContent = '';
    }
    showModal(removeAuthorBookModal, { backdrop: 'static', keyboard: false });
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const { book } = removeTarget;
    const remainingAuthors = Array.isArray(book.authors)
      ? book.authors.filter((entry) => entry.authorId !== authorId)
      : [];
    if (remainingAuthors.length === 0) {
      if (removeAuthorBookError) renderApiErrorAlert(removeAuthorBookError, { message: 'Validation Error', errors: ['A book must have at least one author.'] }, 'Validation Error');
      return;
    }
    removeAuthorBookConfirmBtn.disabled = true;
    window.modalLock?.lock(removeAuthorBookModal, 'Remove author');
    removeModalState.locked = true;
    setModalLocked(removeAuthorBookModal, true);
    setButtonLoading(removeAuthorBookConfirmBtn, removeSpinner?.spinner, true);
    try {
      const requestPayload = {
        id: Number.parseInt(book.id, 10),
        authors: remainingAuthors.map((entry) => ({
          authorId: Number.parseInt(entry.authorId, 10),
          authorRole: entry.authorRole || null
        }))
      };
      log('Removing author from book.', { request: requestPayload, bookId: book.id });
      const response = await apiFetch('/book', {
        method: 'PUT',
        body: requestPayload
      });
      const data = await response.json().catch(() => ({}));
      log('Remove author response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (removeAuthorBookError) renderApiErrorAlert(removeAuthorBookError, data, data.message || 'Unable to remove author.');
        warn('Remove author failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      if (removeAuthorBookError) clearApiAlert(removeAuthorBookError);
      await hideModal(removeAuthorBookModal);
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Remove author failed.', error);
      if (removeAuthorBookError) renderApiErrorAlert(removeAuthorBookError, { message: 'Unable to remove author right now.' }, 'Unable to remove author right now.');
    } finally {
      removeModalState.locked = false;
      setModalLocked(removeAuthorBookModal, false);
      setButtonLoading(removeAuthorBookConfirmBtn, removeSpinner?.spinner, false);
      removeAuthorBookConfirmBtn.disabled = false;
      window.modalLock?.unlock(removeAuthorBookModal, 'finally');
    }
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
    const response = await apiFetch(`/author/${authorId}?includeDeleted=true`, { method: 'GET' });
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
    let pageLoaded = false;
    await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
    try {
      const author = await loadAuthor();
      if (!author) return;
      if (!author.deletedAt) {
        const books = await loadBooks();
        renderBooks(books);
      } else {
        renderBooks([]);
      }
      pageLoaded = true;
    } catch (error) {
      errorLog('Author details load failed with exception.', error);
      await showInvalidModal(defaultInvalidAuthorMessage);
    } finally {
      await hideModal('pageLoadingModal');
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: pageLoaded });
      }
    }
  };

  loadPage();

  if (window.actionRouter && typeof window.actionRouter.register === 'function') {
    window.actionRouter.register('edit_author', async ({ params }) => {
      const targetId = Number.parseInt(params.author_id || params.authorId || params.id, 10);
      if (!Number.isInteger(targetId) || targetId !== authorId) return;
      if (!authorRecord) {
        log('Action requested before author data loaded; waiting for page readiness.');
      }
      openEditModal();
    }, { removeKeys: ['author_id', 'authorId', 'id'] });
    window.actionRouter.run({ source: 'author-details' });
  }

  if (editAuthorBtn) {
    editAuthorBtn.addEventListener('click', openEditModal);
  }
  if (deleteAuthorBtn) {
    deleteAuthorBtn.addEventListener('click', openDeleteModal);
  }
  if (restoreAuthorBtn) {
    restoreAuthorBtn.addEventListener('click', openRestoreModal);
  }
  if (permanentDeleteAuthorBtn) {
    permanentDeleteAuthorBtn.addEventListener('click', openPermanentDeleteModal);
  }
  if (authorDeleteConfirmBtn) {
    authorDeleteConfirmBtn.addEventListener('click', confirmDelete);
  }
  if (restoreAuthorConfirmBtn) {
    restoreAuthorConfirmBtn.addEventListener('click', confirmRestore);
  }
  if (restoreAuthorMode) {
    restoreAuthorMode.addEventListener('change', updateRestoreSummary);
  }
  if (permanentDeleteAuthorConfirmBtn) {
    permanentDeleteAuthorConfirmBtn.addEventListener('click', confirmPermanentDelete);
  }
  if (permanentDeleteAuthorConfirm) {
    permanentDeleteAuthorConfirm.addEventListener('input', updatePermanentDeleteState);
  }
  if (authorRoleSelect) {
    authorRoleSelect.addEventListener('change', () => {
      if (!roleEditTarget) return;
      const showOther = authorRoleSelect.value === 'Other';
      if (authorRoleOtherWrap) authorRoleOtherWrap.classList.toggle('d-none', !showOther);
      if (!showOther && authorRoleOtherInput) authorRoleOtherInput.value = '';
      if (authorRoleHelp) {
        authorRoleHelp.textContent = 'Select a role or choose Other to enter a custom role.';
        authorRoleHelp.classList.remove('text-danger');
      }
      updateAuthorRoleChangeSummary();
    });
  }
  if (authorRoleOtherInput) {
    authorRoleOtherInput.addEventListener('input', () => {
      if (!roleEditTarget) return;
      const nextRole = authorRoleOtherInput.value.trim();
      if (authorRoleSelect?.value === 'Other' && nextRole && (!authorRolePattern.test(nextRole) || nextRole.length < 2 || nextRole.length > 100)) {
        if (authorRoleHelp) {
          authorRoleHelp.textContent = 'Custom role must be 2-100 characters and use letters, numbers, and basic punctuation.';
          authorRoleHelp.classList.add('text-danger');
        }
      } else if (authorRoleHelp) {
        authorRoleHelp.textContent = 'Select a role or choose Other to enter a custom role.';
        authorRoleHelp.classList.remove('text-danger');
      }
      updateAuthorRoleChangeSummary();
    });
  }
  if (authorRoleResetBtn) {
    authorRoleResetBtn.addEventListener('click', resetAuthorRoleModal);
  }
  if (authorRoleSaveBtn) {
    authorRoleSaveBtn.addEventListener('click', saveRoleChange);
  }
  if (removeAuthorBookConfirmBtn) {
    removeAuthorBookConfirmBtn.addEventListener('click', confirmRemove);
  }

  const sharedEvents = window.sharedAddModals?.events;
  if (sharedEvents) {
    sharedEvents.addEventListener('author:updated', async (event) => {
      if (event?.detail?.id && authorRecord?.id && event.detail.id !== authorRecord.id) return;
      await loadAuthor();
    });
  }

});
