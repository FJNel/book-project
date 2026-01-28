// Book type details page logic.
(function () {
  const log = (...args) => console.log('[BookTypeDetails]', ...args);
  const errorLog = (...args) => console.error('[BookTypeDetails]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const dom = {
    feedbackContainer: document.getElementById('feedbackContainer'),
    name: document.getElementById('bookTypeName'),
    description: document.getElementById('bookTypeDescription'),
    created: document.getElementById('bookTypeCreated'),
    updated: document.getElementById('bookTypeUpdated'),
    bookCount: document.getElementById('bookTypeBookCount'),
    share: document.getElementById('bookTypeShare'),
    avgPages: document.getElementById('bookTypeAvgPages'),
    deletedNotice: document.getElementById('bookTypeDeletedNotice'),
    deletedText: document.getElementById('bookTypeDeletedText'),
    editBtn: document.getElementById('editBookTypeBtn'),
    deleteBtn: document.getElementById('deleteBookTypeBtn'),
    restoreBtn: document.getElementById('restoreBookTypeBtn'),
    permanentDeleteBtn: document.getElementById('permanentDeleteBookTypeBtn'),
    bookTypeDeleteModal: document.getElementById('bookTypeDeleteModal'),
    bookTypeDeleteName: document.getElementById('bookTypeDeleteName'),
    bookTypeDeleteConfirm: document.getElementById('bookTypeDeleteConfirm'),
    bookTypeDeleteHelp: document.getElementById('bookTypeDeleteHelp'),
    bookTypeDeleteError: document.getElementById('bookTypeDeleteError'),
    bookTypeDeleteBtn: document.getElementById('bookTypeDeleteBtn'),
    restoreBookTypeModal: document.getElementById('restoreBookTypeModal'),
    restoreBookTypeMode: document.getElementById('restoreBookTypeMode'),
    restoreBookTypeModeHelp: document.getElementById('restoreBookTypeModeHelp'),
    restoreBookTypeChangesSummary: document.getElementById('restoreBookTypeChangesSummary'),
    restoreBookTypeError: document.getElementById('restoreBookTypeError'),
    restoreBookTypeConfirmBtn: document.getElementById('restoreBookTypeConfirmBtn'),
    permanentDeleteBookTypeModal: document.getElementById('permanentDeleteBookTypeModal'),
    permanentDeleteBookTypeName: document.getElementById('permanentDeleteBookTypeName'),
    permanentDeleteBookTypeConfirm: document.getElementById('permanentDeleteBookTypeConfirm'),
    permanentDeleteBookTypeHelp: document.getElementById('permanentDeleteBookTypeHelp'),
    permanentDeleteBookTypeError: document.getElementById('permanentDeleteBookTypeError'),
    permanentDeleteBookTypeConfirmBtn: document.getElementById('permanentDeleteBookTypeConfirmBtn')
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

  const showAlert = ({ message, type = 'danger', details = [] }) => {
    if (!dom.feedbackContainer) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
      <div class="fw-semibold mb-1">${message || 'Something went wrong.'}</div>
      ${Array.isArray(details) && details.length ? `<ul class="mb-1 small text-muted">${details.map((err) => `<li>${escapeHtml(err)}</li>`).join('')}</ul>` : ''}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    dom.feedbackContainer.innerHTML = '';
    dom.feedbackContainer.appendChild(alert);
  };

  const getIdFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  };

  let bookType = null;
  let deleteModalInstance = null;
  let restoreModalInstance = null;
  let permanentDeleteModalInstance = null;
  let deleteSaving = false;
  let restoreSaving = false;
  let permanentDeleteSaving = false;
  let initStarted = false;
  let loadInFlight = false;

  const resolvePageReady = (payload) => {
    if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
      window.pageContentReady.resolve(payload);
    }
  };

  const setHelpText = (el, message, isError = false) => {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('text-danger', isError);
    el.classList.toggle('text-muted', !isError);
  };

  const applyDeletedState = (isDeleted, deletedAt) => {
    document.querySelectorAll('[data-active-only]').forEach((el) => {
      el.classList.toggle('d-none', Boolean(isDeleted));
    });
    document.querySelectorAll('[data-deleted-only]').forEach((el) => {
      el.classList.toggle('d-none', !isDeleted);
    });
    if (dom.deletedNotice) {
      dom.deletedNotice.classList.toggle('d-none', !isDeleted);
    }
    if (dom.deletedText) {
      if (isDeleted) {
        const formatted = formatTimestamp(deletedAt) || 'Unknown date';
        dom.deletedText.textContent = `This book type was deleted on ${formatted}.`;
      } else {
        dom.deletedText.textContent = 'This book type is in the recycle bin.';
      }
    }
  };

  const updateView = () => {
    if (!bookType) return;
    dom.name.textContent = bookType.name || 'Book type';
    dom.description.textContent = bookType.description || 'No description provided.';
    dom.created.textContent = formatTimestamp(bookType.createdAt);
    dom.updated.textContent = formatTimestamp(bookType.updatedAt);
    dom.bookCount.textContent = bookType?.stats?.bookCount ?? '—';
    dom.share.textContent = bookType?.stats?.percentageOfBooks != null ? `${Number(bookType.stats.percentageOfBooks).toFixed(1)}%` : '—';
    dom.avgPages.textContent = bookType?.stats?.avgPageCount != null ? Math.round(bookType.stats.avgPageCount) : '—';
    applyDeletedState(Boolean(bookType.deletedAt), bookType.deletedAt);
  };

  const loadBookType = async () => {
    if (loadInFlight) return;
    loadInFlight = true;
    const id = getIdFromQuery();
    if (!id) {
      showAlert({ message: 'Select a book type to view.' });
      resolvePageReady({ success: false, error: 'Missing book type id.' });
      loadInFlight = false;
      return;
    }

    let pageLoaded = false;
    try {
      log('Loading book type', id);
      const response = await apiFetch('/booktype/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, returnStats: true, includeDeleted: true })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.message || 'Unable to load book type.';
        const details = Array.isArray(data?.errors) ? data.errors : [];
        throw new Error([message, ...details].filter(Boolean).join(' '));
      }
      bookType = data?.data?.bookType || data?.data || null;
      if (!bookType) {
        throw new Error('Book type not found.');
      }
      updateView();
      pageLoaded = true;
    } catch (err) {
      errorLog('Failed to load book type', err);
      showAlert({ message: err?.message || 'Unable to load book type right now.' });
    } finally {
      resolvePageReady({ success: pageLoaded });
      loadInFlight = false;
    }
  };

  const openEditModal = () => {
    if (!bookType) return;
    window.sharedAddModals?.open('booktype', {
      mode: 'edit',
      initial: {
        id: bookType.id,
        name: bookType.name || '',
        description: bookType.description || ''
      }
    });
  };

  const openDeleteModal = () => {
    if (!bookType) return;
    dom.bookTypeDeleteName.textContent = bookType.name || 'this book type';
    dom.bookTypeDeleteConfirm.value = '';
    setHelpText(dom.bookTypeDeleteHelp, 'Enter DELETE to enable deletion.', false);
    dom.bookTypeDeleteError.classList.add('d-none');
    dom.bookTypeDeleteBtn.disabled = true;
    if (!deleteModalInstance) deleteModalInstance = new bootstrap.Modal(dom.bookTypeDeleteModal);
    deleteModalInstance.show();
    log('Delete modal opened', bookType.id);
  };

  const updateDeleteState = () => {
    const value = dom.bookTypeDeleteConfirm.value.trim();
    const ready = value === 'DELETE';
    dom.bookTypeDeleteBtn.disabled = deleteSaving || !ready;
    if (!value) {
      setHelpText(dom.bookTypeDeleteHelp, 'Enter DELETE to enable deletion.', false);
    } else if (ready) {
      setHelpText(dom.bookTypeDeleteHelp, 'Ready to move to recycle bin.', false);
    } else {
      setHelpText(dom.bookTypeDeleteHelp, 'The confirmation text does not match.', true);
    }
  };

  const submitDelete = async () => {
    if (deleteSaving || dom.bookTypeDeleteConfirm.value.trim() !== 'DELETE') return;
    deleteSaving = true;
    dom.bookTypeDeleteBtn.disabled = true;
    dom.bookTypeDeleteError.classList.add('d-none');

    try {
      const payload = { id: bookType.id };
      log('Deleting book type', payload);
      const response = await apiFetch('/booktype', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.message || 'Unable to delete book type.';
        const details = Array.isArray(data?.errors) ? data.errors : [];
        throw new Error([message, ...details].filter(Boolean).join(' '));
      }
      if (deleteModalInstance) deleteModalInstance.hide();
      showAlert({ message: 'Book type moved to the recycle bin.', type: 'success' });
      setTimeout(() => { window.location.href = 'book-types'; }, 600);
    } catch (err) {
      errorLog('Delete failed', err);
      dom.bookTypeDeleteError.textContent = err?.message || 'Unable to delete book type.';
      dom.bookTypeDeleteError.classList.remove('d-none');
    } finally {
      deleteSaving = false;
      updateDeleteState();
    }
  };

  const updateRestoreSummary = () => {
    if (!dom.restoreBookTypeMode || !dom.restoreBookTypeChangesSummary) return;
    const mode = dom.restoreBookTypeMode.value || 'decline';
    const label = mode === 'merge' ? 'Merge' : mode === 'override' ? 'Override' : 'Decline';
    dom.restoreBookTypeChangesSummary.textContent = `Restore this book type using ${label} mode.`;
    if (dom.restoreBookTypeModeHelp) {
      const helpText = mode === 'merge'
        ? 'Merge combines details into existing items when possible.'
        : mode === 'override'
          ? 'Override replaces existing items by restoring this book type.'
          : 'Decline leaves the book type deleted if a conflict is found.';
      setHelpText(dom.restoreBookTypeModeHelp, helpText, false);
    }
  };

  const openRestoreModal = () => {
    if (!bookType) return;
    if (dom.restoreBookTypeMode) dom.restoreBookTypeMode.value = 'decline';
    if (dom.restoreBookTypeError) dom.restoreBookTypeError.classList.add('d-none');
    updateRestoreSummary();
    if (!restoreModalInstance) restoreModalInstance = new bootstrap.Modal(dom.restoreBookTypeModal);
    restoreModalInstance.show();
  };

  const submitRestore = async () => {
    if (restoreSaving || !bookType) return;
    restoreSaving = true;
    if (dom.restoreBookTypeConfirmBtn) dom.restoreBookTypeConfirmBtn.disabled = true;
    if (dom.restoreBookTypeError) dom.restoreBookTypeError.classList.add('d-none');

    try {
      const mode = dom.restoreBookTypeMode?.value || 'decline';
      const response = await apiFetch('/booktype/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookType.id, mode })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.message || 'Unable to restore book type.';
        const details = Array.isArray(data?.errors) ? data.errors : [];
        throw new Error([message, ...details].filter(Boolean).join(' '));
      }
      if (restoreModalInstance) restoreModalInstance.hide();
      showAlert({ message: 'Book type restored.', type: 'success' });
      await loadBookType();
    } catch (err) {
      if (dom.restoreBookTypeError) {
        dom.restoreBookTypeError.textContent = err?.message || 'Unable to restore book type.';
        dom.restoreBookTypeError.classList.remove('d-none');
      }
    } finally {
      restoreSaving = false;
      if (dom.restoreBookTypeConfirmBtn) dom.restoreBookTypeConfirmBtn.disabled = false;
    }
  };

  const updatePermanentDeleteState = () => {
    const value = dom.permanentDeleteBookTypeConfirm?.value.trim() || '';
    const ready = value === 'DELETE';
    if (dom.permanentDeleteBookTypeConfirmBtn) {
      dom.permanentDeleteBookTypeConfirmBtn.disabled = permanentDeleteSaving || !ready;
    }
    if (!dom.permanentDeleteBookTypeHelp) return;
    if (!value) {
      setHelpText(dom.permanentDeleteBookTypeHelp, 'Enter DELETE to enable permanent deletion.', false);
    } else if (ready) {
      setHelpText(dom.permanentDeleteBookTypeHelp, 'Confirmed.', false);
    } else {
      setHelpText(dom.permanentDeleteBookTypeHelp, 'The confirmation text does not match.', true);
    }
  };

  const openPermanentDeleteModal = () => {
    if (!bookType) return;
    if (dom.permanentDeleteBookTypeName) dom.permanentDeleteBookTypeName.textContent = bookType.name || 'this book type';
    if (dom.permanentDeleteBookTypeConfirm) dom.permanentDeleteBookTypeConfirm.value = '';
    if (dom.permanentDeleteBookTypeError) dom.permanentDeleteBookTypeError.classList.add('d-none');
    updatePermanentDeleteState();
    if (!permanentDeleteModalInstance) permanentDeleteModalInstance = new bootstrap.Modal(dom.permanentDeleteBookTypeModal);
    permanentDeleteModalInstance.show();
  };

  const submitPermanentDelete = async () => {
    if (permanentDeleteSaving || !bookType) return;
    const value = dom.permanentDeleteBookTypeConfirm?.value.trim().toLowerCase();
    if (value !== 'delete') return;
    permanentDeleteSaving = true;
    if (dom.permanentDeleteBookTypeConfirmBtn) dom.permanentDeleteBookTypeConfirmBtn.disabled = true;
    if (dom.permanentDeleteBookTypeError) dom.permanentDeleteBookTypeError.classList.add('d-none');

    try {
      const response = await apiFetch('/booktype/delete-permanent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookType.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.message || 'Unable to delete book type.';
        const details = Array.isArray(data?.errors) ? data.errors : [];
        throw new Error([message, ...details].filter(Boolean).join(' '));
      }
      if (permanentDeleteModalInstance) permanentDeleteModalInstance.hide();
      showAlert({ message: 'Book type deleted permanently.', type: 'success' });
      setTimeout(() => { window.location.href = 'book-types'; }, 700);
    } catch (err) {
      if (dom.permanentDeleteBookTypeError) {
        dom.permanentDeleteBookTypeError.textContent = err?.message || 'Unable to delete book type.';
        dom.permanentDeleteBookTypeError.classList.remove('d-none');
      }
    } finally {
      permanentDeleteSaving = false;
      updatePermanentDeleteState();
    }
  };

  const bindEvents = () => {
    dom.editBtn.addEventListener('click', openEditModal);
    dom.deleteBtn.addEventListener('click', openDeleteModal);
    dom.bookTypeDeleteConfirm.addEventListener('input', updateDeleteState);
    dom.bookTypeDeleteBtn.addEventListener('click', submitDelete);
    dom.restoreBtn?.addEventListener('click', openRestoreModal);
    dom.restoreBookTypeMode?.addEventListener('change', updateRestoreSummary);
    dom.restoreBookTypeConfirmBtn?.addEventListener('click', submitRestore);
    dom.permanentDeleteBtn?.addEventListener('click', openPermanentDeleteModal);
    dom.permanentDeleteBookTypeConfirm?.addEventListener('input', updatePermanentDeleteState);
    dom.permanentDeleteBookTypeConfirmBtn?.addEventListener('click', submitPermanentDelete);
  };

  const init = () => {
    if (initStarted) return;
    initStarted = true;
    bindEvents();
    loadBookType();
    const sharedEvents = window.sharedAddModals?.events;
    if (sharedEvents) {
      sharedEvents.addEventListener('booktype:updated', async (event) => {
        if (event?.detail?.id && bookType?.id && event.detail.id !== bookType.id) return;
        await loadBookType();
      });
    }
  };

  init();
})();
