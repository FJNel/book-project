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
    editBtn: document.getElementById('editBookTypeBtn'),
    deleteBtn: document.getElementById('deleteBookTypeBtn'),
    bookTypeModal: document.getElementById('bookTypeModal'),
    bookTypeModalLabel: document.getElementById('bookTypeModalLabel'),
    bookTypeNameInput: document.getElementById('bookTypeNameInput'),
    bookTypeDescriptionInput: document.getElementById('bookTypeDescriptionInput'),
    bookTypeNameHelp: document.getElementById('bookTypeNameHelp'),
    bookTypeDescriptionHelp: document.getElementById('bookTypeDescriptionHelp'),
    bookTypeChanges: document.getElementById('bookTypeChanges'),
    bookTypeError: document.getElementById('bookTypeError'),
    bookTypeResetBtn: document.getElementById('bookTypeResetBtn'),
    bookTypeSaveBtn: document.getElementById('bookTypeSaveBtn'),
    bookTypeDeleteModal: document.getElementById('bookTypeDeleteModal'),
    bookTypeDeleteName: document.getElementById('bookTypeDeleteName'),
    bookTypeDeleteConfirm: document.getElementById('bookTypeDeleteConfirm'),
    bookTypeDeleteHelp: document.getElementById('bookTypeDeleteHelp'),
    bookTypeDeleteError: document.getElementById('bookTypeDeleteError'),
    bookTypeDeleteBtn: document.getElementById('bookTypeDeleteBtn')
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
  let modalInstance = null;
  let deleteModalInstance = null;
  let modalSaving = false;
  let deleteSaving = false;

  const updateView = () => {
    if (!bookType) return;
    dom.name.textContent = bookType.name || 'Book type';
    dom.description.textContent = bookType.description || 'No description provided.';
    dom.created.textContent = formatTimestamp(bookType.createdAt);
    dom.updated.textContent = formatTimestamp(bookType.updatedAt);
    dom.bookCount.textContent = bookType?.stats?.bookCount ?? '—';
    dom.share.textContent = bookType?.stats?.percentageOfBooks != null ? `${Number(bookType.stats.percentageOfBooks).toFixed(1)}%` : '—';
    dom.avgPages.textContent = bookType?.stats?.avgPageCount != null ? Math.round(bookType.stats.avgPageCount) : '—';
  };

  const loadBookType = async () => {
    const id = getIdFromQuery();
    if (!id) {
      showAlert({ message: 'Select a book type to view.' });
      return;
    }

    try {
      log('Loading book type', id);
      const response = await apiFetch('/booktype/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, returnStats: true })
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
    } catch (err) {
      errorLog('Failed to load book type', err);
      showAlert({ message: err?.message || 'Unable to load book type right now.' });
    }
  };

  const resetModalValidation = () => {
    dom.bookTypeError.classList.add('d-none');
    dom.bookTypeError.textContent = '';
    dom.bookTypeNameInput.classList.remove('is-valid', 'is-invalid');
    dom.bookTypeDescriptionInput.classList.remove('is-valid', 'is-invalid');
    dom.bookTypeNameHelp.classList.remove('text-danger');
    dom.bookTypeDescriptionHelp.classList.remove('text-danger');
    dom.bookTypeNameHelp.classList.add('text-muted');
    dom.bookTypeDescriptionHelp.classList.add('text-muted');
  };

  const getModalValues = () => ({
    name: dom.bookTypeNameInput.value.trim(),
    description: dom.bookTypeDescriptionInput.value.trim()
  });

  const getModalChanges = () => {
    const values = getModalValues();
    const changes = [];
    if (!bookType) return changes;
    if (values.name !== bookType.name) changes.push('Name updated');
    if ((values.description || '') !== (bookType.description || '')) changes.push('Description updated');
    return changes;
  };

  const validateModal = () => {
    resetModalValidation();
    const values = getModalValues();
    let valid = true;
    if (!values.name) {
      valid = false;
      dom.bookTypeNameInput.classList.add('is-invalid');
      dom.bookTypeNameHelp.textContent = 'A book type name is required.';
      dom.bookTypeNameHelp.classList.remove('text-muted');
      dom.bookTypeNameHelp.classList.add('text-danger');
    } else {
      dom.bookTypeNameInput.classList.add('is-valid');
      dom.bookTypeNameHelp.textContent = 'Looks good.';
    }

    if (values.description.length > 1000) {
      valid = false;
      dom.bookTypeDescriptionInput.classList.add('is-invalid');
      dom.bookTypeDescriptionHelp.textContent = 'Description is too long.';
      dom.bookTypeDescriptionHelp.classList.remove('text-muted');
      dom.bookTypeDescriptionHelp.classList.add('text-danger');
    } else if (values.description) {
      dom.bookTypeDescriptionInput.classList.add('is-valid');
      dom.bookTypeDescriptionHelp.textContent = 'Looks good.';
    }

    return valid;
  };

  const isModalReady = () => {
    const valid = validateModal();
    if (!valid) return false;
    return getModalChanges().length > 0;
  };

  const updateModalChanges = () => {
    const changes = getModalChanges();
    dom.bookTypeChanges.textContent = changes.length ? `Changes: ${changes.join(', ')}.` : 'No changes yet.';
    dom.bookTypeSaveBtn.disabled = modalSaving || !isModalReady();
  };

  const setModalLocked = (locked) => {
    modalSaving = locked;
    dom.bookTypeNameInput.disabled = locked;
    dom.bookTypeDescriptionInput.disabled = locked;
    dom.bookTypeResetBtn.disabled = locked;
    dom.bookTypeSaveBtn.disabled = locked || !isModalReady();
  };

  const openModal = () => {
    if (!bookType) return;
    dom.bookTypeModalLabel.textContent = 'Edit book type';
    dom.bookTypeNameInput.value = bookType.name || '';
    dom.bookTypeDescriptionInput.value = bookType.description || '';
    resetModalValidation();
    updateModalChanges();
    if (!modalInstance) modalInstance = new bootstrap.Modal(dom.bookTypeModal);
    modalInstance.show();
    log('Edit modal opened', bookType.id);
  };

  const submitModal = async () => {
    if (modalSaving || !isModalReady()) return;
    setModalLocked(true);
    dom.bookTypeError.classList.add('d-none');
    const values = getModalValues();
    try {
      const payload = {
        id: bookType.id,
        name: values.name,
        description: values.description || null
      };
      log('Updating book type', payload);
      const response = await apiFetch('/booktype', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.message || 'Unable to save changes.';
        const details = Array.isArray(data?.errors) ? data.errors : [];
        throw new Error([message, ...details].filter(Boolean).join(' '));
      }
      if (modalInstance) modalInstance.hide();
      bookType = data?.data?.bookType || data?.data || { ...bookType, ...payload };
      updateView();
      showAlert({ message: 'Book type updated.', type: 'success' });
    } catch (err) {
      errorLog('Update failed', err);
      dom.bookTypeError.textContent = err?.message || 'Unable to save changes.';
      dom.bookTypeError.classList.remove('d-none');
    } finally {
      setModalLocked(false);
    }
  };

  const openDeleteModal = () => {
    if (!bookType) return;
    dom.bookTypeDeleteName.textContent = bookType.name || 'this book type';
    dom.bookTypeDeleteConfirm.value = '';
    dom.bookTypeDeleteHelp.textContent = 'Enter DELETE to enable deletion.';
    dom.bookTypeDeleteHelp.classList.remove('text-danger');
    dom.bookTypeDeleteHelp.classList.add('text-muted');
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
      dom.bookTypeDeleteHelp.textContent = 'Enter DELETE to enable deletion.';
      dom.bookTypeDeleteHelp.classList.remove('text-danger');
      dom.bookTypeDeleteHelp.classList.add('text-muted');
    } else if (ready) {
      dom.bookTypeDeleteHelp.textContent = 'Ready to delete.';
      dom.bookTypeDeleteHelp.classList.remove('text-danger');
      dom.bookTypeDeleteHelp.classList.add('text-muted');
    } else {
      dom.bookTypeDeleteHelp.textContent = 'The confirmation text does not match.';
      dom.bookTypeDeleteHelp.classList.remove('text-muted');
      dom.bookTypeDeleteHelp.classList.add('text-danger');
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
      showAlert({ message: 'Book type deleted.', type: 'success' });
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

  const bindEvents = () => {
    dom.editBtn.addEventListener('click', openModal);
    dom.deleteBtn.addEventListener('click', openDeleteModal);
    dom.bookTypeNameInput.addEventListener('input', updateModalChanges);
    dom.bookTypeDescriptionInput.addEventListener('input', updateModalChanges);
    dom.bookTypeResetBtn.addEventListener('click', () => {
      if (!bookType) return;
      dom.bookTypeNameInput.value = bookType.name || '';
      dom.bookTypeDescriptionInput.value = bookType.description || '';
      resetModalValidation();
      updateModalChanges();
    });
    dom.bookTypeSaveBtn.addEventListener('click', submitModal);
    dom.bookTypeDeleteConfirm.addEventListener('input', updateDeleteState);
    dom.bookTypeDeleteBtn.addEventListener('click', submitDelete);
  };

  const init = () => {
    bindEvents();
    loadBookType();
  };

  init();
})();
