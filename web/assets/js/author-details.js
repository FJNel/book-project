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
  const editAuthorBtn = document.getElementById('editAuthorBtn');
  const deleteAuthorBtn = document.getElementById('deleteAuthorBtn');
  const deleteAuthorModal = document.getElementById('deleteAuthorModal');
  const deleteAuthorName = document.getElementById('deleteAuthorName');
  const authorDeleteConfirmBtn = document.getElementById('authorDeleteConfirmBtn');
  const authorDeleteErrorAlert = document.getElementById('authorDeleteErrorAlert');
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
    modalEl.addEventListener('hide.bs.modal', (event) => {
      if (state.locked) event.preventDefault();
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
  const authorRoleSpinner = attachButtonSpinner(authorRoleSaveBtn);
  const deleteSpinner = attachButtonSpinner(authorDeleteConfirmBtn);
  const removeSpinner = attachButtonSpinner(removeAuthorBookConfirmBtn);

  bindModalLock(editAuthorRoleModal, authorRoleModalState);
  bindModalLock(deleteAuthorModal, deleteModalState);
  bindModalLock(removeAuthorBookModal, removeModalState);

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
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"></path>
              </svg>
            </button>
            <button class="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center p-2" type="button" data-role-remove="${book.id}" data-bs-toggle="tooltip" title="Remove author from this book" aria-label="Remove author from this book">
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
    if (authorDeleteErrorAlert) {
      authorDeleteErrorAlert.classList.add('d-none');
      authorDeleteErrorAlert.textContent = '';
    }
    showModal(deleteAuthorModal, { backdrop: 'static', keyboard: false });
  };

  const confirmDelete = async () => {
    if (!authorRecord) return;
    authorDeleteConfirmBtn.disabled = true;
    deleteModalState.locked = true;
    setModalLocked(deleteAuthorModal, true);
    setButtonLoading(authorDeleteConfirmBtn, deleteSpinner?.spinner, true);
    try {
      const response = await apiFetch('/author', { method: 'DELETE', body: JSON.stringify({ id: authorRecord.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (authorDeleteErrorAlert) {
          authorDeleteErrorAlert.classList.remove('d-none');
          authorDeleteErrorAlert.textContent = data.message || 'Unable to delete author.';
        }
        warn('Author delete failed.', { status: response.status, data });
        return;
      }
      sessionStorage.setItem('authorsFlash', 'Author deleted successfully.');
      window.location.href = 'authors';
    } catch (error) {
      errorLog('Author delete failed.', error);
      if (authorDeleteErrorAlert) {
        authorDeleteErrorAlert.classList.remove('d-none');
        authorDeleteErrorAlert.textContent = 'Unable to delete author right now.';
      }
    } finally {
      deleteModalState.locked = false;
      setModalLocked(deleteAuthorModal, false);
      setButtonLoading(authorDeleteConfirmBtn, deleteSpinner?.spinner, false);
      authorDeleteConfirmBtn.disabled = false;
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
    authorRoleChangeSummary.textContent = hasChanges
      ? `Changing ${authorRecord.displayName || 'this author'}'s role on ${roleEditTarget.book.title || 'this book'} from ${currentLabel} to ${nextLabel}.`
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
      authorId: entry.authorId,
      authorRole: entry.authorId === authorId ? (nextRole || null) : (entry.authorRole || null)
    })) : [];
    const requestPayload = { id: book.id, authors };
    log('Updating author role on book.', { request: requestPayload, bookId: book.id });
    setAuthorRoleLocked(true);
    try {
      const response = await apiFetch('/book', { method: 'PUT', body: JSON.stringify(requestPayload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (authorRoleErrorAlert) {
          authorRoleErrorAlert.classList.remove('d-none');
          authorRoleErrorAlert.textContent = data.message || 'Unable to update role.';
        }
        warn('Role update failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      log('Role updated.', { bookId: book.id, from: currentRole, to: nextRole || null });
      await hideModal(editAuthorRoleModal);
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Role update failed.', error);
      if (authorRoleErrorAlert) {
        authorRoleErrorAlert.classList.remove('d-none');
        authorRoleErrorAlert.textContent = 'Unable to update role right now.';
      }
    } finally {
      setAuthorRoleLocked(false);
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
      if (removeAuthorBookError) {
        removeAuthorBookError.classList.remove('d-none');
        removeAuthorBookError.textContent = 'A book must have at least one author.';
      }
      return;
    }
    removeAuthorBookConfirmBtn.disabled = true;
    removeModalState.locked = true;
    setModalLocked(removeAuthorBookModal, true);
    setButtonLoading(removeAuthorBookConfirmBtn, removeSpinner?.spinner, true);
    try {
      const requestPayload = {
        id: book.id,
        authors: remainingAuthors.map((entry) => ({
          authorId: entry.authorId,
          authorRole: entry.authorRole || null
        }))
      };
      log('Removing author from book.', { request: requestPayload, bookId: book.id });
      const response = await apiFetch('/book', {
        method: 'PUT',
        body: JSON.stringify(requestPayload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (removeAuthorBookError) {
          removeAuthorBookError.classList.remove('d-none');
          removeAuthorBookError.textContent = data.message || 'Unable to remove author.';
        }
        warn('Remove author failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      await hideModal(removeAuthorBookModal);
      const books = await loadBooks();
      renderBooks(books);
    } catch (error) {
      errorLog('Remove author failed.', error);
      if (removeAuthorBookError) {
        removeAuthorBookError.classList.remove('d-none');
        removeAuthorBookError.textContent = 'Unable to remove author right now.';
      }
    } finally {
      removeModalState.locked = false;
      setModalLocked(removeAuthorBookModal, false);
      setButtonLoading(removeAuthorBookConfirmBtn, removeSpinner?.spinner, false);
      removeAuthorBookConfirmBtn.disabled = false;
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
    let pageLoaded = false;
    await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
    try {
      const author = await loadAuthor();
      if (!author) return;
      const books = await loadBooks();
      renderBooks(books);
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

  if (editAuthorBtn) {
    editAuthorBtn.addEventListener('click', openEditModal);
  }
  if (deleteAuthorBtn) {
    deleteAuthorBtn.addEventListener('click', openDeleteModal);
  }
  if (authorDeleteConfirmBtn) {
    authorDeleteConfirmBtn.addEventListener('click', confirmDelete);
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
