if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
  window.pageContentReady.reset();
}

document.addEventListener('DOMContentLoaded', () => {
  const log = (...args) => console.log('[Book Details]', ...args);
  const warn = (...args) => console.warn('[Book Details]', ...args);
  const errorLog = (...args) => console.error('[Book Details]', ...args);
  const tagLog = (...args) => console.log('[BookDetails][Tags]', ...args);
  const authorLog = (...args) => console.log('[BookDetails][Authors]', ...args);
  const seriesLog = (...args) => console.log('[BookDetails][Series]', ...args);
  const copyLog = (...args) => console.log('[BookDetails][Copy]', ...args);

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
    return `https://placehold.co/600x900?text=${text}&font=Lora`;
  };

  const invalidModal = document.getElementById('invalidBookModal');
  const invalidModalMessage = document.getElementById('invalidBookModalMessage');
  const invalidModalClose = document.getElementById('invalidBookModalClose');
  const defaultInvalidBookMessage = "This link doesn't seem to lead to a book in your library. Try going back to your book list and selecting it again.";

  const editBookBtn = document.getElementById('editBookBtn');
  const deleteBookBtn = document.getElementById('deleteBookBtn');
  const manageAuthorsBtn = document.getElementById('manageAuthorsBtn');
  const manageSeriesBtn = document.getElementById('manageSeriesBtn');
  const manageTagsBtn = document.getElementById('manageTagsBtn');
  const addCopyBtn = document.getElementById('addCopyBtn');

  const editBookModal = document.getElementById('editBookModal');
  const editBookErrorAlert = document.getElementById('editBookErrorAlert');
  const editBookTitle = document.getElementById('editBookTitle');
  const editBookSubtitle = document.getElementById('editBookSubtitle');
  const editBookIsbn = document.getElementById('editBookIsbn');
  const editBookPublication = document.getElementById('editBookPublication');
  const editBookPages = document.getElementById('editBookPages');
  const editBookCover = document.getElementById('editBookCover');
  const editBookDescription = document.getElementById('editBookDescription');
  const editBookLanguages = document.getElementById('editBookLanguages');
  const editBookType = document.getElementById('editBookType');
  const editBookPublisher = document.getElementById('editBookPublisher');
  const editBookSaveBtn = document.getElementById('editBookSaveBtn');
  const editBookChangesSummary = document.getElementById('editBookChangesSummary');
  const editBookTitleHelp = document.getElementById('editBookTitleHelp');
  const editBookSubtitleHelp = document.getElementById('editBookSubtitleHelp');
  const editBookIsbnHelp = document.getElementById('editBookIsbnHelp');
  const editBookPublicationHelp = document.getElementById('editBookPublicationHelp');
  const editBookPagesHelp = document.getElementById('editBookPagesHelp');
  const editBookCoverHelp = document.getElementById('editBookCoverHelp');
  const editBookDescriptionHelp = document.getElementById('editBookDescriptionHelp');
  const openAddPublisherBtn = document.getElementById('openAddPublisherBtn');
  const openAddBookTypeBtn = document.getElementById('openAddBookTypeBtn');

  const deleteBookModal = document.getElementById('deleteBookModal');
  const deleteBookName = document.getElementById('deleteBookName');
  const deleteBookConfirmBtn = document.getElementById('deleteBookConfirmBtn');
  const deleteBookErrorAlert = document.getElementById('deleteBookErrorAlert');

  const manageAuthorsModal = document.getElementById('manageAuthorsModal');
  const manageAuthorsList = document.getElementById('manageAuthorsList');
  const manageAuthorsSearch = document.getElementById('manageAuthorsSearch');
  const manageAuthorsResults = document.getElementById('manageAuthorsResults');
  const manageAuthorsSearchHelp = document.getElementById('manageAuthorsSearchHelp');
  const manageAuthorsError = document.getElementById('manageAuthorsError');
  const openAddAuthorBtn = document.getElementById('openAddAuthorBtn');

  const editAuthorRoleModal = document.getElementById('editAuthorRoleModal');
  const authorRoleSelect = document.getElementById('authorRoleSelect');
  const authorRoleOtherWrap = document.getElementById('authorRoleOtherWrap');
  const authorRoleOtherInput = document.getElementById('authorRoleOtherInput');
  const authorRoleHelp = document.getElementById('authorRoleHelp');
  const authorRoleChangeSummary = document.getElementById('authorRoleChangeSummary');
  const authorRoleResetBtn = document.getElementById('authorRoleResetBtn');
  const authorRoleSaveBtn = document.getElementById('authorRoleSaveBtn');
  const authorRoleErrorAlert = document.getElementById('authorRoleErrorAlert');

  const removeAuthorModal = document.getElementById('removeAuthorModal');
  const removeAuthorText = document.getElementById('removeAuthorText');
  const removeAuthorConfirmBtn = document.getElementById('removeAuthorConfirmBtn');
  const removeAuthorError = document.getElementById('removeAuthorError');

  const manageSeriesModal = document.getElementById('manageSeriesModal');
  const manageSeriesList = document.getElementById('manageSeriesList');
  const manageSeriesSearch = document.getElementById('manageSeriesSearch');
  const manageSeriesResults = document.getElementById('manageSeriesResults');
  const manageSeriesSearchHelp = document.getElementById('manageSeriesSearchHelp');
  const manageSeriesError = document.getElementById('manageSeriesError');
  const openAddSeriesBtn = document.getElementById('openAddSeriesBtn');

  const editSeriesOrderModal = document.getElementById('editSeriesOrderModal');
  const seriesOrderInput = document.getElementById('seriesOrderInput');
  const seriesOrderChangeSummary = document.getElementById('seriesOrderChangeSummary');
  const seriesOrderSummary = document.getElementById('seriesOrderSummary');
  const seriesOrderResetBtn = document.getElementById('seriesOrderResetBtn');
  const seriesOrderSaveBtn = document.getElementById('seriesOrderSaveBtn');
  const seriesOrderErrorAlert = document.getElementById('seriesOrderErrorAlert');

  const removeSeriesModal = document.getElementById('removeSeriesModal');
  const removeSeriesText = document.getElementById('removeSeriesText');
  const removeSeriesConfirmBtn = document.getElementById('removeSeriesConfirmBtn');
  const removeSeriesError = document.getElementById('removeSeriesError');

  const manageTagsModal = document.getElementById('manageTagsModal');
  const manageTagsList = document.getElementById('manageTagsList');
  const manageTagsInput = document.getElementById('manageTagsInput');
  const manageTagsHelp = document.getElementById('manageTagsHelp');
  const addTagBtn = document.getElementById('addTagBtn');
  const manageTagsError = document.getElementById('manageTagsError');
  const manageTagsChangeSummary = document.getElementById('manageTagsChangeSummary');
  const manageTagsResetBtn = document.getElementById('manageTagsResetBtn');
  const manageTagsSaveBtn = document.getElementById('manageTagsSaveBtn');

  const editCopyModal = document.getElementById('editCopyModal');
  const editCopyErrorAlert = document.getElementById('editCopyErrorAlert');
  const copyLocationSelect = document.getElementById('copyLocationSelect');
  const copyLocationHelp = document.getElementById('copyLocationHelp');
  const copyAcquisitionDate = document.getElementById('copyAcquisitionDate');
  const copyAcquisitionDateHelp = document.getElementById('copyAcquisitionDateHelp');
  const copyAcquiredFrom = document.getElementById('copyAcquiredFrom');
  const copyAcquisitionType = document.getElementById('copyAcquisitionType');
  const copyAcquisitionLocation = document.getElementById('copyAcquisitionLocation');
  const copyAcquisitionStory = document.getElementById('copyAcquisitionStory');
  const copyNotes = document.getElementById('copyNotes');
  const copyChangeSummary = document.getElementById('copyChangeSummary');
  const copyResetBtn = document.getElementById('copyResetBtn');
  const copySaveBtn = document.getElementById('copySaveBtn');
  const editCopyModalLabel = document.getElementById('editCopyModalLabel');
  const openAddLocationBtn = document.getElementById('openAddLocationBtn');

  const deleteCopyModal = document.getElementById('deleteCopyModal');
  const deleteCopyText = document.getElementById('deleteCopyText');
  const deleteCopyConfirmBtn = document.getElementById('deleteCopyConfirmBtn');
  const deleteCopyErrorAlert = document.getElementById('deleteCopyErrorAlert');

  let bookRecord = null;
  let authorRoleTarget = null;
  let removeAuthorTarget = null;
  let seriesOrderTarget = null;
  let removeSeriesTarget = null;
  let copyEditTarget = null;
  let tagDraft = [];
  let tagOriginal = [];
  const referenceData = {
    languages: null,
    bookTypes: null,
    publishers: null,
    authors: null,
    series: null,
    locations: null
  };
  const authorRoleModalState = { locked: false };
  const seriesOrderModalState = { locked: false };
  const copyModalState = { locked: false };
  const deleteBookModalState = { locked: false };
  const removeAuthorModalState = { locked: false };
  const removeSeriesModalState = { locked: false };
  const deleteCopyModalState = { locked: false };
  const manageAuthorsModalState = { locked: false };
  const manageSeriesModalState = { locked: false };
  const manageTagsModalState = { locked: false };

  const toggleSubtitle = (text) => {
    const el = document.getElementById('bookSubtitle');
    if (!el) return;
    if (!text) {
      el.classList.add('d-none');
      return;
    }
    el.textContent = text;
    el.classList.remove('d-none');
  };

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

  const parsePartialDateInput = (value) => {
    if (!value || !value.trim()) return { value: null };
    if (!window.partialDateParser || typeof window.partialDateParser.parsePartialDate !== 'function') {
      return { error: 'Date parser is unavailable.' };
    }
    const parsed = window.partialDateParser.parsePartialDate(value.trim());
    if (!parsed || !parsed.text) return { error: 'Please enter a valid date.' };
    return { value: parsed };
  };

  const setPartialDateHelp = (inputEl, helpEl) => {
    if (!inputEl || !helpEl) return;
    const raw = inputEl.value.trim();
    if (!raw) {
      clearHelpText(helpEl);
      return;
    }
    const parsed = parsePartialDateInput(raw);
    if (parsed.error) {
      setHelpText(helpEl, parsed.error, true);
      return;
    }
    setHelpText(helpEl, `This date will be saved as: ${parsed.value.text}`, false);
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

  const clearElement = (el) => {
    if (el) el.innerHTML = '';
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

  const renderLink = (url, text) => {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;
    const safeText = text || normalized;
    return `<a href="${normalized}" target="_blank" rel="noopener">${safeText}</a>`;
  };

  const showInlineSuccess = (message) => {
    const host = document.querySelector('main.container');
    if (!host) return;
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show';
    alert.role = 'alert';
    alert.innerHTML = `
      <strong>${message}</strong>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    host.prepend(alert);
    setTimeout(() => {
      alert.classList.remove('show');
      alert.addEventListener('transitionend', () => alert.remove(), { once: true });
    }, 2500);
  };

  const refreshBook = async () => {
    try {
      const response = await apiFetch(`/book?id=${bookId}&view=all&returnStats=true`, { method: 'GET' });
      if (!response.ok) return null;
      const payload = await response.json().catch(() => ({}));
      if (!payload || payload.status !== 'success' || !payload.data) return null;
      renderBook(payload.data);
      return payload.data;
    } catch (error) {
      errorLog('Silent book refresh failed.', error);
      return null;
    }
  };

  const renderLoadingList = (listEl, label) => {
    if (!listEl) return;
    listEl.innerHTML = `
      <li class="list-group-item d-flex align-items-center gap-2 text-muted">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        <span>Loading ${label}…</span>
      </li>
    `;
  };

  const setHelpText = (el, message, isError = false) => {
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('text-danger', Boolean(message) && isError);
  };

  const clearHelpText = (el) => setHelpText(el, '', false);

  const formatPartialDateDisplay = (value) => {
    if (!value) return '';
    if (typeof value === 'object' && value.text) return String(value.text).trim();
    const raw = String(value).trim();
    if (!raw) return '';
    const parsed = parsePartialDateInput(raw);
    if (parsed && parsed.value && parsed.value.text) return parsed.value.text;
    return raw;
  };

  const describeChange = (fieldLabel, fromValue, toValue) => {
    const from = (fromValue || '').trim();
    const to = (toValue || '').trim();
    if (from === to) return null;
    if (!from && to) return `Adding ${fieldLabel}: '${to}'.`;
    if (from && !to) return `Clearing ${fieldLabel} (was '${from}').`;
    return `Changing ${fieldLabel} from '${from}' to '${to}'.`;
  };

  const formatList = (items) => {
    const list = items.filter(Boolean);
    if (!list.length) return '';
    if (list.length <= 6) return list.join(', ');
    return `${list.slice(0, 6).join(', ')}, and ${list.length - 6} more`;
  };

  const initializeTooltips = () => {
    if (typeof window.initializeTooltips === 'function') {
      window.initializeTooltips();
      return;
    }
    if (typeof bootstrap === 'undefined') return;
    const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach((el) => {
      bootstrap.Tooltip.getOrCreateInstance(el);
    });
  };

  const normalizeTag = (value) => {
    if (!value) return '';
    return value.trim().replace(/\s+/g, ' ');
  };

  const tagPattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;

  const showSearchResults = (container, items, onSelect) => {
    if (!container) return;
    container.classList.remove('d-none');
    container.innerHTML = '';
    items.forEach((item) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'list-group-item list-group-item-action';
      option.textContent = item.displayName || item.name;
      option.addEventListener('click', () => onSelect(item));
      container.appendChild(option);
    });
  };

  const hideSearchResults = (container) => {
    if (!container) return;
    container.classList.add('d-none');
    container.innerHTML = '';
  };

  const setSearchDisabled = (input, helpEl, disabled, message) => {
    if (!input) return;
    input.disabled = disabled;
    if (disabled) {
      setHelpText(helpEl, message, true);
    } else {
      clearHelpText(helpEl);
    }
  };

  const updateCopyLocationHelp = () => {
    if (!copyLocationHelp) return;
    const value = copyLocationSelect?.value ? String(copyLocationSelect.value) : '';
    if (!value) {
      setHelpText(copyLocationHelp, 'This field is required.', true);
      return;
    }
    clearHelpText(copyLocationHelp);
  };

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

  const setButtonLabel = (button, label) => {
    if (!button) return;
    Array.from(button.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .forEach((node) => button.removeChild(node));
    button.appendChild(document.createTextNode(` ${label}`));
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

  const setDeleteBookLocked = (locked) => {
    deleteBookModalState.locked = locked;
    setModalLocked(deleteBookModal, locked);
    if (deleteBookSpinner) setButtonLoading(deleteBookConfirmBtn, deleteBookSpinner.spinner, locked);
  };

  const setRemoveAuthorLocked = (locked) => {
    removeAuthorModalState.locked = locked;
    setModalLocked(removeAuthorModal, locked);
    if (removeAuthorSpinner) setButtonLoading(removeAuthorConfirmBtn, removeAuthorSpinner.spinner, locked);
  };

  const setRemoveSeriesLocked = (locked) => {
    removeSeriesModalState.locked = locked;
    setModalLocked(removeSeriesModal, locked);
    if (removeSeriesSpinner) setButtonLoading(removeSeriesConfirmBtn, removeSeriesSpinner.spinner, locked);
  };

  const setDeleteCopyLocked = (locked) => {
    deleteCopyModalState.locked = locked;
    setModalLocked(deleteCopyModal, locked);
    if (deleteCopySpinner) setButtonLoading(deleteCopyConfirmBtn, deleteCopySpinner.spinner, locked);
  };

  const setManageAuthorsLocked = (locked) => {
    manageAuthorsModalState.locked = locked;
    setModalLocked(manageAuthorsModal, locked);
    toggleDisabled([manageAuthorsSearch, openAddAuthorBtn], locked);
    manageAuthorsList?.querySelectorAll('button').forEach((btn) => { btn.disabled = locked; });
    manageAuthorsResults?.querySelectorAll('button').forEach((btn) => { btn.disabled = locked; });
  };

  const setManageSeriesLocked = (locked) => {
    manageSeriesModalState.locked = locked;
    setModalLocked(manageSeriesModal, locked);
    toggleDisabled([manageSeriesSearch, openAddSeriesBtn], locked);
    manageSeriesList?.querySelectorAll('button').forEach((btn) => { btn.disabled = locked; });
    manageSeriesResults?.querySelectorAll('button').forEach((btn) => { btn.disabled = locked; });
  };

  const setManageTagsLocked = (locked) => {
    manageTagsModalState.locked = locked;
    setModalLocked(manageTagsModal, locked);
    toggleDisabled([manageTagsInput, addTagBtn, manageTagsResetBtn, manageTagsSaveBtn], locked);
    manageTagsList?.querySelectorAll('button').forEach((btn) => { btn.disabled = locked; });
  };

  const authorRoleSpinner = attachButtonSpinner(authorRoleSaveBtn);
  const seriesOrderSpinner = attachButtonSpinner(seriesOrderSaveBtn);
  const copySpinner = attachButtonSpinner(copySaveBtn);
  const deleteBookSpinner = attachButtonSpinner(deleteBookConfirmBtn);
  const removeAuthorSpinner = attachButtonSpinner(removeAuthorConfirmBtn);
  const removeSeriesSpinner = attachButtonSpinner(removeSeriesConfirmBtn);
  const deleteCopySpinner = attachButtonSpinner(deleteCopyConfirmBtn);

  bindModalLock(editAuthorRoleModal, authorRoleModalState);
  bindModalLock(editSeriesOrderModal, seriesOrderModalState);
  bindModalLock(editCopyModal, copyModalState);
  bindModalLock(deleteBookModal, deleteBookModalState);
  bindModalLock(removeAuthorModal, removeAuthorModalState);
  bindModalLock(removeSeriesModal, removeSeriesModalState);
  bindModalLock(deleteCopyModal, deleteCopyModalState);
  bindModalLock(manageAuthorsModal, manageAuthorsModalState);
  bindModalLock(manageSeriesModal, manageSeriesModalState);
  bindModalLock(manageTagsModal, manageTagsModalState);

  const authorRolePattern = /^[\p{L}0-9 .,'":;!?()&\/-]+$/u;

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
    log('Showing invalid book modal.', { message });
    if (invalidModalMessage) invalidModalMessage.textContent = message || defaultInvalidBookMessage;
    await hideModal('pageLoadingModal');
    await showModal(invalidModal, { backdrop: 'static', keyboard: false });
  };

  if (invalidModalClose) {
    invalidModalClose.addEventListener('click', () => {
      log('Invalid book modal closed. Redirecting to books list.');
      window.location.href = 'books';
    });
  }

  const bookIdParam = new URLSearchParams(window.location.search).get('id');
  const bookId = Number.parseInt(bookIdParam, 10);
  if (!Number.isInteger(bookId) || bookId <= 0) {
    warn('Invalid book id in URL.', { bookIdParam });
    showInvalidModal(defaultInvalidBookMessage);
    return;
  }
  log('Resolved book id from URL.', { bookId });

  const bindBookTypeCard = () => {
    const row = document.getElementById('bookTypeRow');
    if (!row || row.dataset.bound === 'true') return;
    row.dataset.bound = 'true';
    const navigate = () => {
      const id = Number.parseInt(row.dataset.bookTypeId, 10);
      if (!Number.isInteger(id)) return;
      window.location.href = `books?filterBookTypeId=${encodeURIComponent(id)}&filterBookTypeMode=or`;
    };
    row.addEventListener('click', (event) => {
      if (event?.target?.closest && event.target.closest('a')) return;
      navigate();
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigate();
      }
    });
  };

  const renderAuthors = (authors) => {
    log('Rendering authors.', { count: authors ? authors.length : 0 });
    const list = document.getElementById('authorsList');
    clearElement(list);
    if (!authors || authors.length === 0) {
      const item = document.createElement('li');
      item.className = 'list-group-item text-muted';
      item.textContent = 'No authors listed.';
      list.appendChild(item);
      return;
    }
    authors.forEach((author) => {
      const item = document.createElement('li');
      item.className = 'list-group-item position-relative clickable-row';
      const name = author.authorName || 'Unknown author';
      const role = author.authorRole || 'Contributor';
      const birthLine = formatPartialDate(author.birthDate);
      const deathLine = author.deceased
        ? `Died: ${formatPartialDate(author.deathDate) || '(date unknown)'}`
        : null;

      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div>
            <div class="fw-semibold mb-0">${name}</div>
            <div class="fst-italic text-muted small">${role}</div>
            ${birthLine ? `<div class="small text-muted mt-1"><span class="fw-semibold">Born:</span> ${birthLine}</div>` : ''}
            ${deathLine ? `<div class="small text-muted mt-1"><span class="fw-semibold">Died:</span> ${deathLine.replace('Died: ', '')}</div>` : ''}
          </div>
        </div>
      `;
      if (Number.isInteger(author.authorId)) {
        item.addEventListener('click', () => {
          window.location.href = `author-details?id=${author.authorId}`;
        });
      }
      list.appendChild(item);
    });
  };

  const renderSeries = (series) => {
    log('Rendering series.', { count: series ? series.length : 0 });
    const list = document.getElementById('seriesList');
    clearElement(list);
    if (!series || series.length === 0) {
      const item = document.createElement('li');
      item.className = 'list-group-item text-muted';
      item.textContent = 'No series listed.';
      list.appendChild(item);
      return;
    }
    series.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'list-group-item position-relative clickable-row';
      const name = entry.seriesName || 'Untitled series';
      const bookOrder = Number.isInteger(entry.bookOrder) ? entry.bookOrder : null;
      const website = entry.seriesWebsite ? entry.seriesWebsite.trim() : '';
      const description = entry.seriesDescription ? entry.seriesDescription.trim() : '';
      const details = [];
      if (website) {
        const link = renderLink(website, website);
        details.push(`<div><span class="fw-semibold">Website:</span> ${link || website}</div>`);
      }
      if (description) {
        details.push(`<div class="mt-1"><span class="fw-semibold">Description:</span> ${description}</div>`);
      }
      const inlineBadge = details.length === 0;
      const badgeClass = inlineBadge
        ? 'badge text-bg-light border text-dark px-3 py-2 fs-6'
        : 'badge text-bg-light border text-dark px-3 py-2 fs-6 position-absolute top-0 end-0 mt-2 me-2';
      item.innerHTML = `
        <div class="d-flex ${inlineBadge ? 'justify-content-between' : 'align-items-center gap-2 flex-wrap'}">
          <div class="fw-semibold mb-0">${name}</div>
          ${inlineBadge && bookOrder !== null
            ? `<span class="${badgeClass}" data-bs-toggle="tooltip" title="Book's order in this series">#${bookOrder}</span>`
            : ''
          }
        </div>
        ${!inlineBadge && bookOrder !== null
          ? `<span class="${badgeClass}" data-bs-toggle="tooltip" title="Book's order in this series">#${bookOrder}</span>`
          : ''
        }
        ${details.length ? `<div class="small text-muted mt-2">${details.join('')}</div>` : ''}
      `;
      if (Number.isInteger(entry.seriesId)) {
        item.addEventListener('click', () => {
          window.location.href = `series-details?id=${entry.seriesId}`;
        });
      }
      list.appendChild(item);
    });
  };

  const renderCopies = (copies) => {
    log('Rendering copies.', { count: copies ? copies.length : 0 });
    const accordion = document.getElementById('bookCopiesAccordion');
    clearElement(accordion);
    if (!copies || copies.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-muted small';
      empty.textContent = 'No copies yet.';
      accordion.appendChild(empty);
      return;
    }

    const disableDelete = copies.length <= 1;

    copies.forEach((copy, index) => {
      const copyId = copy.id || index + 1;
      const location = copy.storageLocationPath || 'Location unknown';
      const mutedClass = copy.storageLocationPath ? '' : 'text-muted';
      const headingId = `copyHeading${copyId}`;
      const collapseId = `copyCollapse${copyId}`;
      const acquisitionLocation = copy.acquisitionLocation ? copy.acquisitionLocation.trim() : '';
      const story = copy.acquisitionStory ? copy.acquisitionStory.trim() : '';
      const notes = copy.notes ? copy.notes.trim() : '';
      const acquiredOn = formatPartialDate(copy.acquisitionDate);
      const acquiredFrom = copy.acquiredFrom ? copy.acquiredFrom.trim() : '';
      const acquisitionType = copy.acquisitionType ? copy.acquisitionType.trim() : '';
      const addedText = formatTimestamp(copy.createdAt);
      const updatedText = formatTimestamp(copy.updatedAt);
      const acquisitionRows = [];
      if (acquiredOn) {
        acquisitionRows.push(`
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <div class="text-muted">Acquired on</div>
            <div class="fw-semibold text-end">${acquiredOn}</div>
          </li>
        `);
      }
      if (acquiredFrom) {
        acquisitionRows.push(`
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <div class="text-muted">Acquired from</div>
            <div class="fw-semibold text-end">${acquiredFrom}</div>
          </li>
        `);
      }
      if (acquisitionType) {
        acquisitionRows.push(`
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <div class="text-muted">Acquisition type</div>
            <div class="fw-semibold text-end">${acquisitionType}</div>
          </li>
        `);
      }
      if (acquisitionLocation) {
        acquisitionRows.push(`
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <div class="text-muted">Acquisition location</div>
            <div class="fw-semibold text-end">${acquisitionLocation}</div>
          </li>
        `);
      }

      const storyNotesSection = (story || notes)
        ? `
              <div class="col-12 col-lg-6">
                ${story
                  ? `
                    <div class="border rounded p-3">
                      <div class="fw-semibold mb-1">Story</div>
                      <p class="mb-0">${story}</p>
                    </div>
                  `
                  : ''
                }
                ${notes
                  ? `
                    <div class="border rounded p-3 ${story ? 'mt-3' : ''}">
                      <div class="fw-semibold mb-1">Notes</div>
                      <p class="mb-0">${notes}</p>
                    </div>
                  `
                  : ''
                }
              </div>
            `
        : '';

      const item = document.createElement('div');
      item.className = 'accordion-item';
      item.innerHTML = `
        <h2 class="accordion-header" id="${headingId}">
          <button class="accordion-button ${index === 0 ? '' : 'collapsed'} text-dark bg-light" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="${collapseId}">
            Copy #${index + 1}
            <span class="ms-2 text-muted small d-none d-sm-inline">&bull; ${location}</span>
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" aria-labelledby="${headingId}" data-bs-parent="#bookCopiesAccordion">
          <div class="accordion-body">
            <div class="row g-3">
              <div class="col-12">
                <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
                  <div class="fw-semibold fs-6 mb-0">Stored at</div>
                  <div class="fw-semibold mb-0 ${mutedClass}">${location}</div>
                </div>
              </div>

              ${acquisitionRows.length
                ? `
                  <div class="col-12 col-lg-6">
                    <div class="fw-semibold text-muted mb-2">Acquisition</div>
                    <ul class="list-group h-100">${acquisitionRows.join('')}</ul>
                  </div>
                `
                : ''
              }

              ${storyNotesSection}

              <div class="col-12">
                <div class="d-flex flex-column flex-md-row justify-content-between gap-2">
                  <div class="text-muted small">
                    ${addedText ? `<span class="fw-semibold">Added:</span> <time datetime="${copy.createdAt}">${addedText}</time>` : ''}
                    ${addedText && updatedText ? '<span class="mx-1">&bull;</span>' : ''}
                    ${updatedText ? `<span class="fw-semibold">Updated:</span> <time datetime="${copy.updatedAt}">${updatedText}</time>` : ''}
                  </div>

                  <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" type="button" data-copy-edit="${copy.id}">
                      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"></path>
                      </svg>
                      <span>Edit Copy</span>
                    </button>
                    <button class="btn btn-sm btn-outline-danger d-flex align-items-center" type="button" data-copy-delete="${copy.id}" ${disableDelete ? 'disabled aria-disabled="true"' : ''}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash me-1" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                        <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                      </svg>
                      Remove Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      accordion.appendChild(item);
    });

    accordion.querySelectorAll('[data-copy-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number.parseInt(button.getAttribute('data-copy-edit'), 10);
        if (!Number.isInteger(id)) return;
        openCopyModal({ mode: 'edit', copyId: id });
      });
    });

    accordion.querySelectorAll('[data-copy-delete]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        const id = Number.parseInt(button.getAttribute('data-copy-delete'), 10);
        if (!Number.isInteger(id)) return;
        openDeleteCopyModal(id);
      });
    });
  };

  const renderTags = (tags) => {
    const tagsWrap = document.getElementById('overviewTags');
    clearElement(tagsWrap);
    if (!tags || tags.length === 0) {
      const span = document.createElement('span');
      span.className = 'text-muted';
      span.textContent = 'No tags yet';
      tagsWrap.appendChild(span);
      return;
    }
    tags.forEach((tag) => {
      const tagName = typeof tag === 'string' ? tag : tag?.name;
      if (!tagName) return;
      const tagId = Number.isInteger(tag?.id) ? tag.id : (Number.isInteger(tag?.tagId) ? tag.tagId : null);
      if (Number.isInteger(tagId)) {
        const badge = document.createElement('a');
        badge.className = 'badge rounded-pill bg-white text-dark border px-3 py-2 fs-6 me-1 mb-1 text-decoration-none';
        badge.href = `books?tags=${encodeURIComponent(tagId)}&filterTagMode=and`;
        badge.textContent = tagName;
        tagsWrap.appendChild(badge);
        return;
      }
      const badge = document.createElement('span');
      badge.className = 'badge rounded-pill bg-white text-dark border px-3 py-2 fs-6 me-1 mb-1';
      badge.textContent = tagName;
      tagsWrap.appendChild(badge);
    });
  };

  const renderOverviewCounts = (book) => {
    log('Rendering overview counts.');
    const authorsCount = book.stats?.authorCount ?? (book.authors ? book.authors.length : 0);
    const seriesCount = book.stats?.seriesCount ?? (book.series ? book.series.length : 0);
    const copyCount = book.stats?.copyCount ?? (book.bookCopies ? book.bookCopies.length : 0);

    document.getElementById('overviewAuthorsCount').innerHTML = `<span class="fw-semibold">Authors:</span> ${authorsCount || 'none'}`;
    document.getElementById('overviewSeriesCount').innerHTML = `<span class="fw-semibold">Series:</span> ${seriesCount || 'none'}`;
    document.getElementById('overviewCopiesCount').innerHTML = `<span class="fw-semibold">Copies:</span> ${copyCount || 'none'}`;
  };

  const renderOwnership = (book) => {
    log('Rendering ownership details.');
    const firstAcquired = document.getElementById('overviewFirstAcquired');
    const added = document.getElementById('overviewAdded');
    const updated = document.getElementById('overviewUpdated');

    const acquisitionEntries = (book.bookCopies || [])
      .map((copy) => {
        const date = copy.acquisitionDate;
        const text = formatPartialDate(date);
        if (!text) return null;
        const value = date && date.year ? new Date(date.year, (date.month || 1) - 1, date.day || 1).getTime() : null;
        return { text, value };
      })
      .filter(Boolean);

    if (acquisitionEntries.length > 0) {
      const withValue = acquisitionEntries.filter((entry) => Number.isFinite(entry.value));
      const selected = withValue.length > 0
        ? withValue.sort((a, b) => a.value - b.value)[0]
        : acquisitionEntries[0];
      firstAcquired.innerHTML = `<span class="fw-semibold">First acquired:</span> ${selected.text}`;
      firstAcquired.classList.remove('d-none');
    }

    const addedText = formatTimestamp(book.createdAt);
    if (addedText) {
      added.innerHTML = `<span class="fw-semibold">Added:</span> ${addedText}`;
      added.classList.remove('d-none');
    }

    const updatedText = formatTimestamp(book.updatedAt);
    if (updatedText) {
      updated.innerHTML = `<span class="fw-semibold">Updated:</span> ${updatedText}`;
      updated.classList.remove('d-none');
    }
  };

  const renderBook = (book) => {
    log('Rendering book payload.', { bookId: book?.id });
    bookRecord = book;

    document.getElementById('bookTitle').textContent = book.title;
    document.getElementById('bookTitleCompact').textContent = book.title;
    toggleSubtitle(book.subtitle ? book.subtitle.trim() : '');

    const coverImage = document.getElementById('bookCoverImage');
    const normalizedCover = normalizeUrl(book.coverImageUrl);
    const fallbackCover = placeholderCover(book.title);
    coverImage.src = normalizedCover || fallbackCover;
    coverImage.alt = book.title ? `${book.title} cover` : 'Book cover';
    coverImage.onerror = () => {
      coverImage.onerror = null;
      coverImage.src = fallbackCover;
    };

    const authorNames = (book.authors || [])
      .map((author) => author.authorName)
      .filter(Boolean);
    const authorLine = authorNames.length > 0 ? `by ${authorNames.join(', ')}` : null;
    setTextOrMuted(document.getElementById('bookAuthorsLine'), authorLine, 'Unknown author(s)');

    const formatLine = book.bookType?.name ? `Format: ${book.bookType.name}` : null;
    setTextOrMuted(document.getElementById('bookFormatLine'), formatLine, 'Format unknown');

    const description = book.description && book.description.trim() ? book.description : null;
    setTextOrMuted(document.getElementById('bookDescription'), description, 'No description available.');

    const publicationDate = formatPartialDate(book.publicationDate);
    const publicationRow = document.getElementById('corePublicationRow');
    if (publicationDate) {
      document.getElementById('corePublicationValue').textContent = publicationDate;
      publicationRow.classList.remove('d-none');
    } else {
      publicationRow.classList.add('d-none');
    }

    const languageNames = (book.languages || []).map((lang) => lang.name).filter(Boolean);
    setTextOrMuted(document.getElementById('coreLanguagesValue'), languageNames.join(', '), 'Language unknown');

    const pagesRow = document.getElementById('corePagesRow');
    if (Number.isInteger(book.pageCount)) {
      document.getElementById('corePagesValue').textContent = book.pageCount;
      pagesRow.classList.remove('d-none');
    } else {
      pagesRow.classList.add('d-none');
    }

    const isbnRow = document.getElementById('coreIsbnRow');
    if (book.isbn) {
      document.getElementById('coreIsbnValue').textContent = book.isbn;
      isbnRow.classList.remove('d-none');
    } else {
      isbnRow.classList.add('d-none');
    }

    const bookTypeRow = document.getElementById('bookTypeRow');
    const bookTypeName = book.bookType?.name || 'Format unknown';
    const bookTypeNameEl = document.getElementById('bookTypeName');
    if (bookTypeRow) {
      bookTypeRow.dataset.bookTypeId = Number.isInteger(book.bookType?.id) ? String(book.bookType.id) : '';
      bookTypeRow.dataset.bookTypeName = book.bookType?.name || '';
      bookTypeRow.setAttribute('aria-label', book.bookType?.name ? `Filter books by ${book.bookType.name}` : 'Book type');
      bookTypeRow.setAttribute('aria-disabled', Number.isInteger(book.bookType?.id) ? 'false' : 'true');
      bindBookTypeCard();
    }
    if (bookTypeNameEl) {
      bookTypeNameEl.textContent = bookTypeName;
      bookTypeNameEl.classList.toggle('text-muted', !book.bookType?.name);
    }

    const bookTypeDescription = book.bookType?.description ? book.bookType.description.trim() : '';
    const bookTypeDescriptionWrap = document.getElementById('bookTypeDescriptionWrap');
    if (bookTypeDescription) {
      document.getElementById('bookTypeDescription').textContent = bookTypeDescription;
      bookTypeDescriptionWrap.classList.remove('d-none');
    } else {
      bookTypeDescriptionWrap.classList.add('d-none');
    }

    const publisherName = book.publisher?.name || 'Publisher unknown';
    const publisherNameEl = document.getElementById('publisherName');
    publisherNameEl.textContent = publisherName;
    publisherNameEl.classList.toggle('text-muted', !book.publisher?.name);

    const publisherDetails = [
      { wrap: 'publisherFoundedWrap', value: 'publisherFounded', data: formatPartialDate(book.publisher?.foundedDate) },
      { wrap: 'publisherWebsiteWrap', value: 'publisherWebsite', data: book.publisher?.website ? renderLink(book.publisher.website, book.publisher.website) : '' },
      { wrap: 'publisherNotesWrap', value: 'publisherNotes', data: book.publisher?.notes ? book.publisher.notes.trim() : '' }
    ];
    const hasPublisherDetails = publisherDetails.some((detail) => detail.data);
    if (hasPublisherDetails) {
      const publisherRow = document.getElementById('publisherRow');
      publisherRow.classList.add('clickable-row');

      publisherDetails.forEach((detail) => {
        if (!detail.data) return;
        const wrap = document.getElementById(detail.wrap);
        const value = document.getElementById(detail.value);
        value.innerHTML = detail.data;
        wrap.classList.remove('d-none');
      });
      if (Number.isInteger(book.publisher?.id)) {
        publisherRow.addEventListener('click', (event) => {
          const target = event.target;
          if (target && target.closest && target.closest('a')) return;
          window.location.href = `publisher-details?id=${book.publisher.id}`;
        });
      }
    }

    renderTags(book.tags || []);
    renderOverviewCounts(book);
    renderOwnership(book);
    renderAuthors(book.authors || []);
    renderSeries(book.series || []);
    renderCopies(book.bookCopies || []);
    initializeTooltips();
    log('Render complete.');
  };

  const handleResponseError = async (response) => {
    warn('Book request failed.', { status: response.status });
    if (response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      await hideModal('pageLoadingModal');
      await window.rateLimitGuard.showModal();
      return;
    }
    await showInvalidModal(defaultInvalidBookMessage);
  };

  const loadBook = async () => {
    log('Loading book data from API.');
    let pageLoaded = false;
    await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
    try {
      const response = await apiFetch(`/book?id=${bookId}&view=all&returnStats=true`, { method: 'GET' });
      log('API response received.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        await handleResponseError(response);
        return;
      }
      const payload = await response.json();
      log('API payload parsed.', { status: payload?.status });
      if (!payload || payload.status !== 'success' || !payload.data) {
        await showInvalidModal(defaultInvalidBookMessage);
        return;
      }
      renderBook(payload.data);
      pageLoaded = true;
    } catch (error) {
      errorLog('Book load failed with exception.', error);
      await showInvalidModal(defaultInvalidBookMessage);
    } finally {
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: pageLoaded });
      }
      await hideModal('pageLoadingModal');
    }
  };

  const fetchList = async (url, options) => {
    const bodyPreview = options?.body ? options.body : null;
    log('List request starting.', { url, method: options?.method || 'GET', body: bodyPreview });
    const response = await apiFetch(url, options);
    const data = await response.json().catch(() => ({}));
    log('List request completed.', { url, status: response.status, ok: response.ok, data });
    if (!response.ok) {
      const message = data.message || 'Request failed.';
      const err = new Error(message);
      err.status = response.status;
      err.details = Array.isArray(data.errors) ? data.errors : [];
      throw err;
    }
    if (!data || data.status !== 'success') {
      const err = new Error('Invalid response.');
      err.status = response.status;
      throw err;
    }
    return data.data || {};
  };

  const loadLanguages = async () => {
    if (referenceData.languages) return referenceData.languages;
    log('Loading languages list.');
    const payload = await fetchList('/languages', { method: 'GET' });
    referenceData.languages = payload.languages || [];
    return referenceData.languages;
  };

  const loadBookTypes = async () => {
    if (referenceData.bookTypes) return referenceData.bookTypes;
    log('Loading book types list.');
    const payload = await fetchList('/booktype?nameOnly=true&sortBy=name&order=asc&limit=200', { method: 'GET' });
    referenceData.bookTypes = payload.bookTypes || [];
    return referenceData.bookTypes;
  };

  const loadPublishers = async () => {
    if (referenceData.publishers) return referenceData.publishers;
    log('Loading publishers list.');
    const payload = await fetchList('/publisher?nameOnly=true&sortBy=name&order=asc&limit=200', { method: 'GET' });
    referenceData.publishers = payload.publishers || [];
    return referenceData.publishers;
  };

  const loadAuthorsList = async () => {
    if (referenceData.authors) return referenceData.authors;
    log('Loading authors list.');
    const payload = await fetchList('/author/list', {
      method: 'POST',
      body: JSON.stringify({ sortBy: 'displayName', order: 'asc', limit: 200, offset: 0, includeDeleted: false, nameOnly: true })
    });
    referenceData.authors = payload.authors || [];
    return referenceData.authors;
  };

  const loadSeriesList = async () => {
    if (referenceData.series) return referenceData.series;
    log('Loading series list.');
    const payload = await fetchList('/bookseries/list', {
      method: 'POST',
      body: JSON.stringify({ sortBy: 'name', order: 'asc', limit: 200, offset: 0, includeDeleted: false, nameOnly: true })
    });
    referenceData.series = payload.series || [];
    return referenceData.series;
  };

  const loadLocationsList = async () => {
    if (referenceData.locations) return referenceData.locations;
    log('Loading storage locations list.');
    const payload = await fetchList('/storagelocation/list', {
      method: 'POST',
      body: JSON.stringify({ sortBy: 'path', order: 'asc', limit: 200, offset: 0 })
    });
    referenceData.locations = payload.storageLocations || [];
    return referenceData.locations;
  };

  const populateSelect = (select, items, { placeholder = 'Select...', labelKey = 'name', valueKey = 'id', includeEmpty = true } = {}) => {
    if (!select) return;
    select.innerHTML = '';
    if (includeEmpty) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = placeholder;
      select.appendChild(option);
    }
    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = String(item[valueKey]);
      option.textContent = item[labelKey];
      select.appendChild(option);
    });
  };

  const openEditBookModal = async () => {
    if (!bookRecord) return;
    if (editBookErrorAlert) clearApiAlert(editBookErrorAlert);
    try {
      const [languages, bookTypes, publishers] = await Promise.all([
        loadLanguages(),
        loadBookTypes(),
        loadPublishers()
      ]);
      if (editBookLanguages) {
        editBookLanguages.innerHTML = '';
        languages.forEach((lang) => {
          const option = document.createElement('option');
          option.value = String(lang.id);
          option.textContent = lang.name;
          editBookLanguages.appendChild(option);
        });
      }
      populateSelect(editBookType, bookTypes, { placeholder: 'No book type', labelKey: 'name', valueKey: 'id', includeEmpty: true });
      populateSelect(editBookPublisher, publishers, { placeholder: 'No publisher', labelKey: 'name', valueKey: 'id', includeEmpty: true });

      if (editBookTitle) editBookTitle.value = bookRecord.title || '';
      if (editBookSubtitle) editBookSubtitle.value = bookRecord.subtitle || '';
      if (editBookIsbn) editBookIsbn.value = bookRecord.isbn || '';
      if (editBookPublication) editBookPublication.value = bookRecord.publicationDate?.text || '';
      if (editBookPages) editBookPages.value = Number.isInteger(bookRecord.pageCount) ? String(bookRecord.pageCount) : '';
      if (editBookCover) editBookCover.value = bookRecord.coverImageUrl || '';
      if (editBookDescription) editBookDescription.value = bookRecord.description || '';

      const selectedLangIds = new Set((bookRecord.languages || []).map((lang) => String(lang.id)));
      if (editBookLanguages) {
        Array.from(editBookLanguages.options).forEach((option) => {
          option.selected = selectedLangIds.has(option.value);
        });
      }

      if (editBookType) {
        editBookType.value = bookRecord.bookType?.id ? String(bookRecord.bookType.id) : '';
      }
      if (editBookPublisher) {
        editBookPublisher.value = bookRecord.publisher?.id ? String(bookRecord.publisher.id) : '';
      }

      [editBookTitleHelp, editBookSubtitleHelp, editBookIsbnHelp, editBookPublicationHelp, editBookPagesHelp, editBookCoverHelp, editBookDescriptionHelp]
        .forEach((el) => clearHelpText(el));
      updateEditBookState();
      await showModal(editBookModal, { backdrop: 'static', keyboard: false });
    } catch (error) {
      errorLog('Failed to prepare edit modal.', error);
    }
  };

  const buildEditBookChanges = () => {
    if (!bookRecord) return [];
    const changes = [];
    const currentTitle = editBookTitle?.value.trim() || '';
    const currentSubtitle = editBookSubtitle?.value.trim() || '';
    const currentIsbn = editBookIsbn?.value.trim() || '';
    const currentPublication = formatPartialDateDisplay(editBookPublication?.value || '');
    const currentPages = editBookPages?.value.trim() || '';
    const currentCover = editBookCover?.value.trim() || '';
    const currentDescription = editBookDescription?.value.trim() || '';
    const currentBookType = editBookType?.value ? (editBookType.selectedOptions?.[0]?.textContent || '').trim() : '';
    const currentPublisher = editBookPublisher?.value ? (editBookPublisher.selectedOptions?.[0]?.textContent || '').trim() : '';

    const originalTitle = bookRecord.title || '';
    const originalSubtitle = bookRecord.subtitle || '';
    const originalIsbn = bookRecord.isbn || '';
    const originalPublication = formatPartialDateDisplay(bookRecord.publicationDate?.text || bookRecord.publicationDate || '');
    const originalPages = Number.isInteger(bookRecord.pageCount) ? String(bookRecord.pageCount) : '';
    const originalCover = bookRecord.coverImageUrl || '';
    const originalDescription = bookRecord.description || '';
    const originalBookType = bookRecord.bookType?.name || '';
    const originalPublisher = bookRecord.publisher?.name || '';

    const titleChange = describeChange('title', originalTitle, currentTitle);
    const subtitleChange = describeChange('subtitle', originalSubtitle, currentSubtitle);
    const isbnChange = describeChange('ISBN', originalIsbn, currentIsbn);
    const publicationChange = describeChange('publication date', originalPublication, currentPublication);
    const pagesChange = describeChange('page count', originalPages, currentPages);
    const coverChange = describeChange('cover image URL', originalCover, currentCover);
    const descriptionChange = describeChange('description', originalDescription, currentDescription);
    const typeChange = describeChange('book type', originalBookType, currentBookType);
    const publisherChange = describeChange('publisher', originalPublisher, currentPublisher);

    [titleChange, subtitleChange, isbnChange, publicationChange, pagesChange, coverChange, descriptionChange, typeChange, publisherChange]
      .forEach((entry) => { if (entry) changes.push(entry); });

    const originalLanguages = (bookRecord.languages || []).map((lang) => lang?.name).filter(Boolean);
    const currentLanguages = Array.from(editBookLanguages?.selectedOptions || [])
      .map((option) => option.textContent.trim())
      .filter(Boolean);
    const addedLangs = currentLanguages.filter((name) => !originalLanguages.includes(name));
    const removedLangs = originalLanguages.filter((name) => !currentLanguages.includes(name));
    if (addedLangs.length) changes.push(`Adding languages: ${formatList(addedLangs)}.`);
    if (removedLangs.length) changes.push(`Removing languages: ${formatList(removedLangs)}.`);

    return changes;
  };

  const updateEditBookState = () => {
    const valid = validateEditBook();
    const changes = buildEditBookChanges();
    if (editBookChangesSummary) {
      editBookChangesSummary.textContent = changes.length ? changes.join(' ') : 'No changes yet.';
    }
    if (editBookSaveBtn) editBookSaveBtn.disabled = !valid || changes.length === 0;
  };

  const validateEditBook = () => {
    let valid = true;
    const titlePattern = /^[\p{L}0-9 .,'":;!?()&\/-]+$/u;

    const title = editBookTitle?.value.trim() || '';
    if (!title) {
      setHelpText(editBookTitleHelp, 'This field is required.', true);
      valid = false;
    } else if (title.length < 2 || title.length > 255) {
      setHelpText(editBookTitleHelp, 'Title must be between 2 and 255 characters.', true);
      valid = false;
    } else if (!titlePattern.test(title)) {
      setHelpText(editBookTitleHelp, 'Title contains unsupported characters.', true);
      valid = false;
    } else {
      clearHelpText(editBookTitleHelp);
    }

    const subtitle = editBookSubtitle?.value.trim() || '';
    if (!subtitle) {
      clearHelpText(editBookSubtitleHelp);
    } else if (subtitle.length > 255) {
      setHelpText(editBookSubtitleHelp, 'Subtitle must be 255 characters or fewer.', true);
      valid = false;
    } else if (!titlePattern.test(subtitle)) {
      setHelpText(editBookSubtitleHelp, 'Subtitle contains unsupported characters.', true);
      valid = false;
    } else {
      clearHelpText(editBookSubtitleHelp);
    }

    const rawIsbn = editBookIsbn?.value.trim() || '';
    if (!rawIsbn) {
      clearHelpText(editBookIsbnHelp);
    } else {
      const cleaned = rawIsbn.replace(/[^0-9xX]/g, '').toUpperCase();
      const isValid = (cleaned.length === 10 && /^[0-9]{9}[0-9X]$/.test(cleaned))
        || (cleaned.length === 13 && /^[0-9]{13}$/.test(cleaned));
      if (!isValid) {
        setHelpText(editBookIsbnHelp, 'ISBN must be a valid ISBN-10 or ISBN-13 using digits and optional X (last character for ISBN-10).', true);
        valid = false;
      } else {
        setHelpText(editBookIsbnHelp, `This ISBN will be stored as: ${cleaned}`, false);
      }
    }

    const publicationRaw = editBookPublication?.value.trim() || '';
    if (!publicationRaw) {
      clearHelpText(editBookPublicationHelp);
    } else {
      const parsed = parsePartialDateInput(publicationRaw);
      if (parsed.error) {
        setHelpText(editBookPublicationHelp, parsed.error, true);
        valid = false;
      } else {
        setHelpText(editBookPublicationHelp, `This date will be saved as: ${parsed.value.text}`, false);
      }
    }

    const pagesRaw = editBookPages?.value.trim() || '';
    if (!pagesRaw) {
      clearHelpText(editBookPagesHelp);
    } else {
      const numeric = Number.parseInt(pagesRaw, 10);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 10000) {
        setHelpText(editBookPagesHelp, 'Number of pages must be between 1 and 10000.', true);
        valid = false;
      } else {
        clearHelpText(editBookPagesHelp);
      }
    }

    const coverRaw = editBookCover?.value.trim() || '';
    if (coverRaw && !normalizeUrl(coverRaw)) {
      setHelpText(editBookCoverHelp, 'Cover URL must be a valid URL.', true);
      valid = false;
    } else {
      clearHelpText(editBookCoverHelp);
    }

    const description = editBookDescription?.value.trim() || '';
    if (description && description.length > 2000) {
      setHelpText(editBookDescriptionHelp, 'Description must be 2000 characters or fewer.', true);
      valid = false;
    } else {
      clearHelpText(editBookDescriptionHelp);
    }

    return valid;
  };

  const saveBookEdits = async () => {
    if (!bookRecord) return;
    const changes = buildEditBookChanges();
    if (!validateEditBook()) return;
    if (changes.length === 0) return;
    const publicationRaw = editBookPublication.value.trim();
    const pagesRaw = editBookPages.value.trim();
    const languagesSelected = Array.from(editBookLanguages?.selectedOptions || []).map((option) => Number(option.value)).filter(Number.isFinite);
    const payload = {
      id: bookRecord.id,
      title: editBookTitle.value.trim(),
      subtitle: editBookSubtitle.value.trim() || null,
      isbn: editBookIsbn.value.trim() || null,
      publicationDate: publicationRaw ? parsePartialDateInput(publicationRaw).value : null,
      pageCount: pagesRaw ? Number(pagesRaw) : null,
      coverImageUrl: editBookCover.value.trim() ? normalizeUrl(editBookCover.value.trim()) : null,
      description: editBookDescription.value.trim() || null,
      languageIds: languagesSelected,
      bookTypeId: editBookType?.value ? Number(editBookType.value) : null,
      publisherId: editBookPublisher?.value ? Number(editBookPublisher.value) : null
    };

    log('Updating book.', { id: bookRecord.id, payload });
    editBookSaveBtn.disabled = true;
    try {
      const response = await apiFetch('/book', { method: 'PUT', body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (editBookErrorAlert) renderApiErrorAlert(editBookErrorAlert, data, data.message || 'Unable to update book.');
        warn('Book update failed.', { status: response.status, data });
        return;
      }
      await hideModal(editBookModal);
      await loadBook();
    } catch (error) {
      errorLog('Book update failed.', error);
      if (editBookErrorAlert) renderApiErrorAlert(editBookErrorAlert, { message: 'Unable to update book right now.' }, 'Unable to update book right now.');
    } finally {
      updateEditBookState();
    }
  };

  const openDeleteBookModal = () => {
    if (!bookRecord) return;
    log('Opening delete book modal.', { bookId: bookRecord.id });
    setDeleteBookLocked(false);
    if (deleteBookName) deleteBookName.textContent = bookRecord.title || 'this book';
    if (deleteBookErrorAlert) clearApiAlert(deleteBookErrorAlert);
    showModal(deleteBookModal, { backdrop: 'static', keyboard: false });
  };

  const confirmDeleteBook = async () => {
    if (!bookRecord) return;
    deleteBookConfirmBtn.disabled = true;
    window.modalLock?.lock(deleteBookModal, 'Delete book');
    setDeleteBookLocked(true);
    try {
      const response = await apiFetch('/book', { method: 'DELETE', body: JSON.stringify({ id: bookRecord.id }) });
      const data = await response.json().catch(() => ({}));
      log('Delete book response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (deleteBookErrorAlert) renderApiErrorAlert(deleteBookErrorAlert, data, data.message || 'Unable to delete book.');
        warn('Book delete failed.', { status: response.status, data });
        return;
      }
      sessionStorage.setItem('booksFlash', 'Book deleted successfully.');
      window.location.href = 'books';
    } catch (error) {
      errorLog('Book delete failed.', error);
      if (deleteBookErrorAlert) renderApiErrorAlert(deleteBookErrorAlert, { message: 'Unable to delete book right now.' }, 'Unable to delete book right now.');
    } finally {
      deleteBookConfirmBtn.disabled = false;
      setDeleteBookLocked(false);
      window.modalLock?.unlock(deleteBookModal, 'finally');
    }
  };

  const renderManageAuthorsList = (authors) => {
    clearElement(manageAuthorsList);
    if (!authors || authors.length === 0) {
      const item = document.createElement('li');
      item.className = 'list-group-item text-muted';
      item.textContent = 'No authors linked yet.';
      manageAuthorsList.appendChild(item);
      return;
    }
    authors.forEach((author) => {
      const item = document.createElement('li');
      item.className = 'list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2';
      const role = author.authorRole || 'Contributor';
      item.innerHTML = `
        <div>
          <div class="fw-semibold">${author.authorName || 'Unknown author'}</div>
          <div class="text-muted small">${role}</div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm d-flex align-items-center justify-content-center p-2 border-0 edit-icon-btn" type="button" data-author-role="${author.authorId}" data-bs-toggle="tooltip" title="Edit role" aria-label="Edit role">
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"></path>
            </svg>
          </button>
          <button class="btn btn-sm d-flex align-items-center justify-content-center p-2 border-0 text-danger" type="button" data-author-remove="${author.authorId}" data-bs-toggle="tooltip" title="Remove author from this book" aria-label="Remove author from this book">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
              <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
            </svg>
          </button>
        </div>
      `;
      manageAuthorsList.appendChild(item);
    });

    manageAuthorsList.querySelectorAll('[data-author-role]').forEach((button) => {
      button.addEventListener('click', () => {
        const authorId = Number.parseInt(button.getAttribute('data-author-role'), 10);
        if (!Number.isInteger(authorId)) return;
        openAuthorRoleModal(authorId);
      });
    });

    manageAuthorsList.querySelectorAll('[data-author-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        const authorId = Number.parseInt(button.getAttribute('data-author-remove'), 10);
        if (!Number.isInteger(authorId)) return;
        openRemoveAuthorModal(authorId);
      });
    });
  };

  const updateAuthorSearchAvailability = () => {
    const total = referenceData.authors ? referenceData.authors.length : 0;
    const selected = (bookRecord?.authors || []).length;
    if (!total) {
      setSearchDisabled(manageAuthorsSearch, manageAuthorsSearchHelp, true, 'No authors available yet. Add a new author to begin.');
      return;
    }
    if (selected >= total) {
      setSearchDisabled(manageAuthorsSearch, manageAuthorsSearchHelp, true, 'All available authors have been added.');
      return;
    }
    setSearchDisabled(manageAuthorsSearch, manageAuthorsSearchHelp, false, '');
  };

  const addAuthorFromSearch = async (author) => {
    if (!bookRecord || !author) return;
    const existing = (bookRecord.authors || []).some((entry) => entry.authorId === author.id);
    if (existing) return;
    const authors = (bookRecord.authors || []).map((entry) => ({
      authorId: entry.authorId,
      authorRole: entry.authorRole || null
    }));
    authors.push({ authorId: author.id, authorRole: null });

    if (manageAuthorsError) {
      manageAuthorsError.classList.add('d-none');
      manageAuthorsError.textContent = '';
    }

    const requestPayload = { id: bookRecord.id, authors };
    log('Adding author to book.', { request: requestPayload, authorId: author.id });
    window.modalLock?.lock(manageAuthorsModal, 'Add author');
    setManageAuthorsLocked(true);
    try {
      const response = await apiFetch('/book', { method: 'PUT', body: JSON.stringify(requestPayload) });
      const data = await response.json().catch(() => ({}));
      log('Add author response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (manageAuthorsError) {
          manageAuthorsError.classList.remove('d-none');
          manageAuthorsError.textContent = data.message || 'Unable to add author.';
        }
        warn('Add author failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      authorLog('Author added from search.', { authorId: author.id, authorName: author.displayName });
      if (data?.data) {
        renderBook(data.data);
      } else {
        await refreshBook();
      }
      renderManageAuthorsList(bookRecord.authors || []);
      updateAuthorSearchAvailability();
      if (manageAuthorsSearch) manageAuthorsSearch.value = '';
      hideSearchResults(manageAuthorsResults);
      openAuthorRoleModal(author.id);
    } catch (error) {
      errorLog('Add author failed.', error);
      if (manageAuthorsError) {
        manageAuthorsError.classList.remove('d-none');
        manageAuthorsError.textContent = 'Unable to add author right now.';
      }
    } finally {
      setManageAuthorsLocked(false);
      window.modalLock?.unlock(manageAuthorsModal, 'finally');
    }
  };

  const handleManageAuthorSearch = () => {
    if (!manageAuthorsSearch) return;
    const query = manageAuthorsSearch.value.trim().toLowerCase();
    if (!query) {
      hideSearchResults(manageAuthorsResults);
      return;
    }
    const results = (referenceData.authors || [])
      .filter((author) => !(bookRecord?.authors || []).some((selected) => selected.authorId === author.id))
      .filter((author) => (author.displayName || '').toLowerCase().includes(query));
    showSearchResults(manageAuthorsResults, results, addAuthorFromSearch);
  };

  const showListLoadError = (alertEl, label, error) => {
    if (!alertEl) return;
    const status = error?.status ? ` (HTTP ${error.status})` : '';
    const details = Array.isArray(error?.details) && error.details.length
      ? ` ${error.details.join(' ')}`
      : '';
    const message = error?.message || 'Unable to load data.';
    alertEl.classList.remove('d-none');
    alertEl.textContent = `Couldn’t load ${label}${status}. ${message}${details} Try refreshing and try again.`.trim();
  };

  const openManageAuthorsModal = async () => {
    if (!bookRecord) return;
    authorLog('Opened modal (loading=true).', { bookId: bookRecord.id });
    setManageAuthorsLocked(true);
    renderLoadingList(manageAuthorsList, 'authors');
    if (manageAuthorsError) {
      manageAuthorsError.classList.add('d-none');
      manageAuthorsError.textContent = '';
    }
    await showModal(manageAuthorsModal, { backdrop: 'static', keyboard: false });
    try {
      await loadAuthorsList();
      renderManageAuthorsList(bookRecord.authors || []);
      updateAuthorSearchAvailability();
      if (manageAuthorsSearch) manageAuthorsSearch.value = '';
      hideSearchResults(manageAuthorsResults);
    } catch (error) {
      errorLog('Failed to load authors.', error);
      showListLoadError(manageAuthorsError, 'authors', error);
    } finally {
      setManageAuthorsLocked(false);
      authorLog('Opened modal (loading=false).', { count: (bookRecord.authors || []).length });
    }
  };

  const authorRoleOptions = new Set(['Author', 'Editor', 'Illustrator', 'Translator']);

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
    if (!authorRoleChangeSummary) return;
    if (!authorRoleTarget || !bookRecord) {
      authorRoleChangeSummary.textContent = '';
      return;
    }
    const originalInput = authorRoleTarget.originalInputValue || '';
    const nextInput = getAuthorRoleValue();
    const hasChanges = nextInput !== originalInput;
    const currentLabel = authorRoleTarget.currentRole || 'No role';
    const nextLabel = nextInput || 'No role';
    const authorName = authorRoleTarget.author.authorName || 'this author';
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
    if (!authorRoleTarget) return;
    applyAuthorRoleFields(authorRoleTarget.originalInputValue || '');
    if (authorRoleErrorAlert) clearApiAlert(authorRoleErrorAlert);
    if (authorRoleHelp) {
      authorRoleHelp.textContent = 'Select a role or choose Other to enter a custom role.';
      authorRoleHelp.classList.remove('text-danger');
    }
    updateAuthorRoleChangeSummary();
  };

  const openAuthorRoleModal = async (authorId) => {
    const authors = bookRecord?.authors || [];
    const author = authors.find((entry) => entry.authorId === authorId);
    if (!author) return;
    authorLog('Opening author role modal.', { authorId });
    const currentRole = author.authorRole || 'Contributor';
    const originalInputValue = author.authorRole === 'Contributor' ? '' : author.authorRole || '';
    authorRoleTarget = { author, currentRole, originalInputValue };
    applyAuthorRoleFields(originalInputValue);
    if (authorRoleErrorAlert) clearApiAlert(authorRoleErrorAlert);
    if (authorRoleHelp) {
      authorRoleHelp.textContent = 'Select a role or choose Other to enter a custom role.';
      authorRoleHelp.classList.remove('text-danger');
    }
    updateAuthorRoleChangeSummary();
    if (window.modalStack && manageAuthorsModal?.classList.contains('show')) {
      await window.modalStack.push('manageAuthorsModal', 'editAuthorRoleModal');
      return;
    }
    showModal(editAuthorRoleModal, { backdrop: 'static', keyboard: false });
  };

  const saveAuthorRole = async () => {
    if (!authorRoleTarget || !bookRecord) return;
    const selectedRole = authorRoleSelect?.value || 'none';
    const nextRole = getAuthorRoleValue();
    if (selectedRole === 'Other' && (!nextRole || nextRole.length < 2 || nextRole.length > 100 || !authorRolePattern.test(nextRole))) {
      if (authorRoleHelp) {
        authorRoleHelp.textContent = 'Custom role must be 2-100 characters and use letters, numbers, and basic punctuation.';
        authorRoleHelp.classList.add('text-danger');
      }
      return;
    }
    const authors = (bookRecord.authors || []).map((entry) => ({
      authorId: entry.authorId,
      authorRole: entry.authorId === authorRoleTarget.author.authorId ? (nextRole || null) : (entry.authorRole || null)
    }));
    const requestPayload = { id: bookRecord.id, authors };
    authorLog('Save started.', { request: requestPayload, authorId: authorRoleTarget.author.authorId });
    window.modalLock?.lock(editAuthorRoleModal, 'Update author role');
    setAuthorRoleLocked(true);
    try {
      const response = await apiFetch('/book', { method: 'PUT', body: JSON.stringify(requestPayload) });
      const data = await response.json().catch(() => ({}));
      log('Author role response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (authorRoleErrorAlert) renderApiErrorAlert(authorRoleErrorAlert, data, data.message || 'Unable to update role.');
        warn('Author role update failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      if (data?.data) {
        renderBook(data.data);
      } else {
        await refreshBook();
      }
      await hideModal(editAuthorRoleModal);
      renderManageAuthorsList(bookRecord.authors || []);
      updateAuthorSearchAvailability();
      showInlineSuccess('Author role updated.');
      authorLog('Save finished.', { authorId: authorRoleTarget.author.authorId });
    } catch (error) {
      errorLog('Author role update failed.', error);
      if (authorRoleErrorAlert) renderApiErrorAlert(authorRoleErrorAlert, { message: 'Unable to update role right now.' }, 'Unable to update role right now.');
    } finally {
      setAuthorRoleLocked(false);
      window.modalLock?.unlock(editAuthorRoleModal, 'finally');
    }
  };

  const openRemoveAuthorModal = async (authorId) => {
    const authors = bookRecord?.authors || [];
    const author = authors.find((entry) => entry.authorId === authorId);
    if (!author) return;
    authorLog('Opening remove author modal.', { authorId });
    setRemoveAuthorLocked(false);
    removeAuthorTarget = author;
    if (removeAuthorText) {
      removeAuthorText.textContent = `Removing ${author.authorName || 'this author'} from ${bookRecord.title || 'this book'}.`;
    }
    if (removeAuthorError) {
      clearApiAlert(removeAuthorError);
    }
    if (window.modalStack && manageAuthorsModal?.classList.contains('show')) {
      await window.modalStack.push('manageAuthorsModal', 'removeAuthorModal');
      return;
    }
    showModal(removeAuthorModal, { backdrop: 'static', keyboard: false });
  };

  const confirmRemoveAuthor = async () => {
    if (!removeAuthorTarget || !bookRecord) return;
    const remainingAuthors = (bookRecord.authors || []).filter((entry) => entry.authorId !== removeAuthorTarget.authorId);
    const requestPayload = {
      id: bookRecord.id,
      authors: remainingAuthors.map((entry) => ({
        authorId: entry.authorId,
        authorRole: entry.authorRole || null
      }))
    };
    authorLog('Remove started.', { request: requestPayload, authorId: removeAuthorTarget.authorId });
    removeAuthorConfirmBtn.disabled = true;
    window.modalLock?.lock(removeAuthorModal, 'Remove author');
    setRemoveAuthorLocked(true);
    try {
      const response = await apiFetch('/book', {
        method: 'PUT',
        body: JSON.stringify(requestPayload)
      });
      const data = await response.json().catch(() => ({}));
      log('Remove author response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (removeAuthorError) renderApiErrorAlert(removeAuthorError, data, data.message || 'Unable to remove author.');
        warn('Remove author failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      if (data?.data) {
        renderBook(data.data);
      } else {
        await refreshBook();
      }
      await hideModal(removeAuthorModal);
      renderManageAuthorsList(bookRecord.authors || []);
      updateAuthorSearchAvailability();
      showInlineSuccess('Author removed from this book.');
      authorLog('Remove finished.', { authorId: removeAuthorTarget.authorId });
    } catch (error) {
      errorLog('Remove author failed.', error);
      if (removeAuthorError) renderApiErrorAlert(removeAuthorError, { message: 'Unable to remove author right now.' }, 'Unable to remove author right now.');
    } finally {
      removeAuthorConfirmBtn.disabled = false;
      setRemoveAuthorLocked(false);
      window.modalLock?.unlock(removeAuthorModal, 'finally');
    }
  };

  const openManageSeriesModal = async () => {
    if (!bookRecord) return;
    seriesLog('Opened modal (loading=true).', { bookId: bookRecord.id });
    setManageSeriesLocked(true);
    renderLoadingList(manageSeriesList, 'series');
    if (manageSeriesError) {
      manageSeriesError.classList.add('d-none');
      manageSeriesError.textContent = '';
    }
    await showModal(manageSeriesModal, { backdrop: 'static', keyboard: false });
    try {
      await loadSeriesList();
      renderManageSeriesList(bookRecord.series || []);
      updateSeriesSearchAvailability();
      if (manageSeriesSearch) manageSeriesSearch.value = '';
      hideSearchResults(manageSeriesResults);
    } catch (error) {
      errorLog('Failed to load series.', error);
      showListLoadError(manageSeriesError, 'series', error);
    } finally {
      setManageSeriesLocked(false);
      seriesLog('Opened modal (loading=false).', { count: (bookRecord.series || []).length });
    }
  };

  const renderManageSeriesList = (series) => {
    clearElement(manageSeriesList);
    if (!series || series.length === 0) {
      const item = document.createElement('li');
      item.className = 'list-group-item text-muted';
      item.textContent = 'No series linked yet.';
      manageSeriesList.appendChild(item);
      return;
    }
    series.forEach((entry) => {
      const orderLabel = Number.isInteger(entry.bookOrder) ? `Order ${entry.bookOrder}` : 'No order';
      const item = document.createElement('li');
      item.className = 'list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2';
      item.innerHTML = `
        <div>
          <div class="fw-semibold">${entry.seriesName || 'Untitled series'}</div>
          <div class="text-muted small">${orderLabel}</div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm d-flex align-items-center justify-content-center p-2 border-0 edit-icon-btn" type="button" data-series-edit="${entry.seriesId}" data-bs-toggle="tooltip" title="Edit order" aria-label="Edit order">
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"></path>
            </svg>
          </button>
          <button class="btn btn-sm d-flex align-items-center justify-content-center p-2 border-0 text-danger" type="button" data-series-remove="${entry.seriesId}" data-bs-toggle="tooltip" title="Remove series from this book" aria-label="Remove series from this book">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
              <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
            </svg>
          </button>
        </div>
      `;
      manageSeriesList.appendChild(item);
    });

    manageSeriesList.querySelectorAll('[data-series-edit]').forEach((button) => {
      button.addEventListener('click', () => {
        const seriesId = Number.parseInt(button.getAttribute('data-series-edit'), 10);
        if (!Number.isInteger(seriesId)) return;
        openSeriesOrderModal(seriesId);
      });
    });

    manageSeriesList.querySelectorAll('[data-series-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        const seriesId = Number.parseInt(button.getAttribute('data-series-remove'), 10);
        if (!Number.isInteger(seriesId)) return;
        openRemoveSeriesModal(seriesId);
      });
    });
  };

  const updateSeriesSearchAvailability = () => {
    const total = referenceData.series ? referenceData.series.length : 0;
    const selected = (bookRecord?.series || []).length;
    if (!total) {
      setSearchDisabled(manageSeriesSearch, manageSeriesSearchHelp, true, 'No series available yet. Add a new series to begin.');
      return;
    }
    if (selected >= total) {
      setSearchDisabled(manageSeriesSearch, manageSeriesSearchHelp, true, 'All available series have been added.');
      return;
    }
    setSearchDisabled(manageSeriesSearch, manageSeriesSearchHelp, false, '');
  };

  const addSeriesFromSearch = async (series) => {
    if (!bookRecord || !series) return;
    const existing = (bookRecord.series || []).some((entry) => entry.seriesId === series.id);
    if (existing) return;
    const payload = (bookRecord.series || []).map((entry) => ({
      seriesId: Number.parseInt(entry.seriesId, 10),
      bookOrder: Number.isInteger(entry.bookOrder) ? entry.bookOrder : null
    }));
    payload.push({ seriesId: Number.parseInt(series.id, 10), bookOrder: null });

    if (manageSeriesError) {
      clearApiAlert(manageSeriesError);
    }

    const requestPayload = { id: Number.parseInt(bookRecord.id, 10), series: payload };
    log('Adding series to book.', { request: requestPayload, seriesId: series.id });
    window.modalLock?.lock(manageSeriesModal, 'Add series');
    setManageSeriesLocked(true);
    try {
      const response = await apiFetch('/book', { method: 'PUT', body: requestPayload });
      const data = await response.json().catch(() => ({}));
      log('Add series response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (manageSeriesError) renderApiErrorAlert(manageSeriesError, data, data.message || 'Unable to add series.');
        warn('Add series failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      if (manageSeriesError) clearApiAlert(manageSeriesError);
      seriesLog('Series added from search.', { seriesId: series.id, seriesName: series.name });
      if (data?.data) {
        renderBook(data.data);
      } else {
        await refreshBook();
      }
      renderManageSeriesList(bookRecord.series || []);
      updateSeriesSearchAvailability();
      if (manageSeriesSearch) manageSeriesSearch.value = '';
      hideSearchResults(manageSeriesResults);
      openSeriesOrderModal(series.id);
    } catch (error) {
      errorLog('Add series failed.', error);
      if (manageSeriesError) {
        manageSeriesError.classList.remove('d-none');
        manageSeriesError.textContent = 'Unable to add series right now.';
      }
    } finally {
      setManageSeriesLocked(false);
      window.modalLock?.unlock(manageSeriesModal, 'finally');
    }
  };

  const handleManageSeriesSearch = () => {
    if (!manageSeriesSearch) return;
    const query = manageSeriesSearch.value.trim().toLowerCase();
    if (!query) {
      hideSearchResults(manageSeriesResults);
      return;
    }
    const results = (referenceData.series || [])
      .filter((series) => !(bookRecord?.series || []).some((selected) => selected.seriesId === series.id))
      .filter((series) => (series.name || '').toLowerCase().includes(query));
    showSearchResults(manageSeriesResults, results, addSeriesFromSearch);
  };

  const updateSeriesOrderSummary = (seriesEntry, currentOrder, nextOrder) => {
    if (!seriesOrderSummary || !bookRecord) return;
    const current = currentOrder !== null && currentOrder !== undefined ? String(currentOrder) : 'No order';
    const next = nextOrder !== null && nextOrder !== undefined ? String(nextOrder) : 'No order';
    seriesOrderSummary.textContent = `Changing ${bookRecord.title || 'this book'}'s order in ${seriesEntry.seriesName || 'this series'} from ${current} to ${next}.`;
  };

  const updateSeriesOrderChangeSummary = () => {
    if (!seriesOrderChangeSummary) return;
    if (!seriesOrderTarget || !bookRecord) {
      seriesOrderChangeSummary.textContent = '';
      return;
    }
    const originalInput = seriesOrderTarget.originalInputValue || '';
    const nextInput = seriesOrderInput.value.trim();
    const hasChanges = nextInput !== originalInput;
    const currentLabel = Number.isInteger(seriesOrderTarget.currentOrder)
      ? String(seriesOrderTarget.currentOrder)
      : 'No order';
    const nextLabel = nextInput ? nextInput : 'No order';
    const seriesName = seriesOrderTarget.seriesEntry.seriesName || 'this series';
    seriesOrderChangeSummary.textContent = hasChanges
      ? `Changing series order in '${seriesName}' from '${currentLabel}' to '${nextLabel}'.`
      : 'No changes yet.';
    if (seriesOrderSaveBtn) seriesOrderSaveBtn.disabled = seriesOrderModalState.locked || !hasChanges;
  };

  const setSeriesOrderLocked = (locked) => {
    seriesOrderModalState.locked = locked;
    setModalLocked(editSeriesOrderModal, locked);
    toggleDisabled([seriesOrderInput, seriesOrderResetBtn], locked);
    if (seriesOrderSpinner) setButtonLoading(seriesOrderSaveBtn, seriesOrderSpinner.spinner, locked);
    updateSeriesOrderChangeSummary();
  };

  const resetSeriesOrderModal = () => {
    if (!seriesOrderTarget) return;
    seriesOrderInput.value = seriesOrderTarget.originalInputValue || '';
    if (seriesOrderErrorAlert) {
      seriesOrderErrorAlert.classList.add('d-none');
      seriesOrderErrorAlert.textContent = '';
    }
    updateSeriesOrderSummary(
      seriesOrderTarget.seriesEntry,
      seriesOrderTarget.currentOrder,
      seriesOrderInput.value ? Number(seriesOrderInput.value) : null
    );
    updateSeriesOrderChangeSummary();
  };

  const openSeriesOrderModal = async (seriesId) => {
    const seriesEntry = (bookRecord?.series || []).find((entry) => entry.seriesId === seriesId);
    if (!seriesEntry) return;
    seriesLog('Opening series order modal.', { seriesId });
    const originalInputValue = Number.isInteger(seriesEntry.bookOrder) ? String(seriesEntry.bookOrder) : '';
    seriesOrderTarget = { seriesEntry, currentOrder: seriesEntry.bookOrder, originalInputValue };
    seriesOrderInput.value = originalInputValue;
    if (seriesOrderErrorAlert) {
      seriesOrderErrorAlert.classList.add('d-none');
      seriesOrderErrorAlert.textContent = '';
    }
    updateSeriesOrderSummary(seriesEntry, seriesEntry.bookOrder, seriesOrderInput.value ? Number(seriesOrderInput.value) : null);
    updateSeriesOrderChangeSummary();
    if (window.modalStack && manageSeriesModal?.classList.contains('show')) {
      await window.modalStack.push('manageSeriesModal', 'editSeriesOrderModal');
      return;
    }
    showModal(editSeriesOrderModal, { backdrop: 'static', keyboard: false });
  };

  const saveSeriesOrder = async () => {
    if (!seriesOrderTarget || !bookRecord) return;
    const rawValue = seriesOrderInput.value.trim();
    const nextOrder = rawValue ? Number(rawValue) : null;
    if (rawValue && (!Number.isInteger(nextOrder) || nextOrder <= 0)) {
      if (seriesOrderErrorAlert) renderApiErrorAlert(seriesOrderErrorAlert, { message: 'Validation Error', errors: ['Order must be a positive whole number.'] }, 'Validation Error');
      return;
    }
    const seriesId = Number.parseInt(seriesOrderTarget.seriesEntry.seriesId, 10);
    const bookId = Number.parseInt(bookRecord.id, 10);
    if (!Number.isInteger(seriesId) || !Number.isInteger(bookId)) {
      if (seriesOrderErrorAlert) renderApiErrorAlert(seriesOrderErrorAlert, { message: 'Validation Error', errors: ['Series and book identifiers must be valid numbers.'] });
      return;
    }
    const requestPayload = {
      seriesId,
      bookId,
      bookOrder: nextOrder
    };
    seriesLog('Save started.', {
      payload: requestPayload,
      types: {
        seriesId: typeof requestPayload.seriesId,
        bookId: typeof requestPayload.bookId,
        bookOrder: typeof requestPayload.bookOrder
      },
      json: JSON.stringify(requestPayload)
    });
    window.modalLock?.lock(editSeriesOrderModal, 'Update series order');
    setSeriesOrderLocked(true);
    try {
      const response = await apiFetch('/bookseries/link', {
        method: 'PUT',
        body: requestPayload
      });
      const data = await response.json().catch(() => ({}));
      log('Series order response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (seriesOrderErrorAlert) renderApiErrorAlert(seriesOrderErrorAlert, data, data.message || 'Unable to update order.');
        warn('Series order update failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      if (seriesOrderErrorAlert) clearApiAlert(seriesOrderErrorAlert);
      if (data?.data) {
        renderBook(data.data);
      } else {
        await refreshBook();
      }
      await hideModal(editSeriesOrderModal);
      renderManageSeriesList(bookRecord.series || []);
      updateSeriesSearchAvailability();
      showInlineSuccess('Series order updated.');
      seriesLog('Save finished.', { seriesId });
    } catch (error) {
      errorLog('Series order update failed.', error);
      if (seriesOrderErrorAlert) renderApiErrorAlert(seriesOrderErrorAlert, { message: 'Unable to update order right now.' }, 'Unable to update order right now.');
    } finally {
      setSeriesOrderLocked(false);
      window.modalLock?.unlock(editSeriesOrderModal, 'finally');
    }
  };

  const openRemoveSeriesModal = async (seriesId) => {
    const seriesEntry = (bookRecord?.series || []).find((entry) => entry.seriesId === seriesId);
    if (!seriesEntry) return;
    seriesLog('Opening remove series modal.', { seriesId });
    setRemoveSeriesLocked(false);
    removeSeriesTarget = seriesEntry;
    if (removeSeriesText) {
      removeSeriesText.textContent = `Removing ${bookRecord.title || 'this book'} from ${seriesEntry.seriesName || 'this series'}.`;
    }
    if (removeSeriesError) {
      removeSeriesError.classList.add('d-none');
      removeSeriesError.textContent = '';
    }
    if (window.modalStack && manageSeriesModal?.classList.contains('show')) {
      await window.modalStack.push('manageSeriesModal', 'removeSeriesModal');
      return;
    }
    showModal(removeSeriesModal, { backdrop: 'static', keyboard: false });
  };

  const confirmRemoveSeries = async () => {
    if (!removeSeriesTarget || !bookRecord) return;
    const seriesId = Number.parseInt(removeSeriesTarget.seriesId, 10);
    const bookId = Number.parseInt(bookRecord.id, 10);
    if (!Number.isInteger(seriesId) || !Number.isInteger(bookId)) {
      if (removeSeriesError) renderApiErrorAlert(removeSeriesError, { message: 'Validation Error', errors: ['Series and book identifiers must be valid numbers.'] });
      return;
    }
    const requestPayload = { seriesId, bookId };
    seriesLog('Remove started.', { request: requestPayload });
    removeSeriesConfirmBtn.disabled = true;
    window.modalLock?.lock(removeSeriesModal, 'Remove series');
    setRemoveSeriesLocked(true);
    try {
      const response = await apiFetch('/bookseries/link', {
        method: 'DELETE',
        body: requestPayload
      });
      const data = await response.json().catch(() => ({}));
      log('Remove series response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (removeSeriesError) renderApiErrorAlert(removeSeriesError, data, data.message || 'Unable to remove series.');
        warn('Remove series failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      if (removeSeriesError) clearApiAlert(removeSeriesError);
      if (data?.data) {
        renderBook(data.data);
      } else {
        await refreshBook();
      }
      await hideModal(removeSeriesModal);
      renderManageSeriesList(bookRecord.series || []);
      updateSeriesSearchAvailability();
      showInlineSuccess('Series removed from this book.');
      seriesLog('Remove finished.', { seriesId });
    } catch (error) {
      errorLog('Remove series failed.', error);
      if (removeSeriesError) renderApiErrorAlert(removeSeriesError, { message: 'Unable to remove series right now.' }, 'Unable to remove series right now.');
    } finally {
      removeSeriesConfirmBtn.disabled = false;
      setRemoveSeriesLocked(false);
      window.modalLock?.unlock(removeSeriesModal, 'finally');
    }
  };

  const getTagKey = (value) => String(value || '').trim().toLowerCase();

  const buildTagChanges = () => {
    const originalKeys = new Set(tagOriginal.map(getTagKey));
    const draftKeys = new Set(tagDraft.map(getTagKey));
    const additions = tagDraft.filter((tag) => !originalKeys.has(getTagKey(tag)));
    const removals = tagOriginal.filter((tag) => !draftKeys.has(getTagKey(tag)));
    return { additions, removals };
  };

  const syncManageTagsSummary = () => {
    const { additions, removals } = buildTagChanges();
    const hasChanges = additions.length > 0 || removals.length > 0;
    if (manageTagsChangeSummary) {
      if (!hasChanges) {
        manageTagsChangeSummary.textContent = 'No changes yet.';
      } else {
        const lines = [];
        if (additions.length) lines.push(`Adding tags: ${formatList(additions)}.`);
        if (removals.length) lines.push(`Removing tags: ${formatList(removals)}.`);
        manageTagsChangeSummary.textContent = lines.join(' ');
      }
    }
    if (manageTagsSaveBtn) manageTagsSaveBtn.disabled = manageTagsModalState.locked || !hasChanges;
    if (manageTagsResetBtn) manageTagsResetBtn.disabled = manageTagsModalState.locked || !hasChanges;
  };

  const renderManageTags = () => {
    clearElement(manageTagsList);
    if (!tagDraft.length) {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.id = 'manageTagsPlaceholder';
      li.textContent = 'No tags added yet.';
      manageTagsList.appendChild(li);
      syncManageTagsSummary();
      return;
    }

    const li = document.createElement('li');
    li.className = 'list-group-item d-flex flex-wrap gap-2';
    tagDraft.forEach((tag) => {
      const badge = document.createElement('span');
      badge.className = 'badge rounded-pill bg-light fw-normal border rounded-1 border-1 border-black d-inline-flex align-items-center me-2 mb-1';

      const label = document.createElement('span');
      label.className = 'fs-6 text-black d-flex align-items-center';
      label.textContent = tag;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn d-flex align-items-center p-0 ms-1';
      removeBtn.setAttribute('aria-label', 'Remove tag');
      removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" class="text-black" style="font-size:17px;"><path d="M16.3956 7.75734C16.7862 8.14786 16.7862 8.78103 16.3956 9.17155L13.4142 12.153L16.0896 14.8284C16.4802 15.2189 16.4802 15.8521 16.0896 16.2426C15.6991 16.6331 15.0659 16.6331 14.6754 16.2426L12 13.5672L9.32458 16.2426C8.93405 16.6331 8.30089 16.6331 7.91036 16.2426C7.51984 15.8521 7.51984 15.2189 7.91036 14.8284L10.5858 12.153L7.60436 9.17155C7.21383 8.78103 7.21383 8.14786 7.60436 7.75734C7.99488 7.36681 8.62805 7.36681 9.01857 7.75734L12 10.7388L14.9814 7.75734Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M4 1C2.34315 1 1 2.34315 1 4V20C1 21.6569 2.34315 23 4 23H20C21.6569 23 23 21.6569 23 20V4C23 2.34315 21.6569 1 20 1H4ZM20 3H4C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21H20C20.5523 21 21 20.5523 21 20V4C21 3.44772 20.5523 3 20 3Z" fill="currentColor"></path></svg>';
      removeBtn.addEventListener('click', () => {
        tagDraft = tagDraft.filter((entry) => entry !== tag);
        renderManageTags();
      });

      label.appendChild(removeBtn);
      badge.appendChild(label);
      li.appendChild(badge);
    });
    manageTagsList.appendChild(li);
    syncManageTagsSummary();
  };

  const openManageTagsModal = async () => {
    if (!bookRecord) return;
    tagLog('Opened modal (loading=true).', { bookId: bookRecord.id });
    setManageTagsLocked(true);
    renderLoadingList(manageTagsList, 'tags');
    manageTagsInput.value = '';
    if (manageTagsError) clearApiAlert(manageTagsError);
    if (manageTagsHelp) {
      manageTagsHelp.textContent = 'Type a tag and click Add to stage it.';
      manageTagsHelp.classList.remove('text-danger');
    }
    await showModal(manageTagsModal, { backdrop: 'static', keyboard: false });
    tagOriginal = (bookRecord.tags || []).map((tag) => (typeof tag === 'string' ? tag : tag?.name)).filter(Boolean);
    tagDraft = [...tagOriginal];
    renderManageTags();
    setManageTagsLocked(false);
    tagLog('Opened modal (loading=false).', { count: tagDraft.length });
  };

  const resetManageTags = () => {
    tagDraft = [...tagOriginal];
    renderManageTags();
    if (manageTagsError) clearApiAlert(manageTagsError);
    if (manageTagsInput) manageTagsInput.value = '';
    if (manageTagsHelp) {
      manageTagsHelp.textContent = 'Type a tag and click Add to stage it.';
      manageTagsHelp.classList.remove('text-danger', 'attention-hint');
    }
    addTagBtn?.classList.remove('pulse-add');
  };

  const saveManageTagsChanges = async () => {
    if (!bookRecord) return;
    const changes = buildTagChanges();
    if (!changes.additions.length && !changes.removals.length) return;
    const requestPayload = { id: Number.parseInt(bookRecord.id, 10), tags: tagDraft };
    tagLog('Save started.', { request: requestPayload, changes });
    window.modalLock?.lock(manageTagsModal, 'Update tags');
    setManageTagsLocked(true);
    try {
      const response = await apiFetch('/book', {
        method: 'PUT',
        body: requestPayload
      });
      const data = await response.json().catch(() => ({}));
      tagLog('Save response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (manageTagsError) renderApiErrorAlert(manageTagsError, data, data.message || 'Unable to update tags.');
        warn('Tag update failed.', { status: response.status, data, request: requestPayload });
        return;
      }
      if (manageTagsError) clearApiAlert(manageTagsError);
      if (data?.data) {
        renderBook(data.data);
      } else {
        await refreshBook();
      }
      tagOriginal = [...tagDraft];
      renderManageTags();
      await hideModal(manageTagsModal);
      showInlineSuccess('Tags updated.');
      tagLog('Save finished.', { count: tagDraft.length });
    } catch (error) {
      errorLog('Tag update failed.', error);
      if (manageTagsError) renderApiErrorAlert(manageTagsError, { message: 'Unable to update tags right now.' }, 'Unable to update tags right now.');
    } finally {
      setManageTagsLocked(false);
      window.modalLock?.unlock(manageTagsModal, 'finally');
    }
  };

  const validateTag = (value) => {
    if (!value) return 'Please enter a tag before adding.';
    if (value.length < 2) return 'Tags must be at least 2 characters long.';
    if (value.length > 50) return 'Tags must be 50 characters or fewer.';
    if (!tagPattern.test(value)) return 'Tags contain unsupported characters.';
    if (!/[A-Za-z]/.test(value)) return 'Tags must include at least one letter.';
    const exists = tagDraft.some((tag) => tag.toLowerCase() === value.toLowerCase());
    if (exists) return 'That tag has already been added.';
    return null;
  };

  const addTag = () => {
    clearHelpText(manageTagsHelp);
    const normalized = normalizeTag(manageTagsInput.value);
    const error = validateTag(normalized);
    if (error) {
      setHelpText(manageTagsHelp, error, true);
      log('Tag validation error:', error);
      return;
    }
    tagDraft.push(normalized);
    manageTagsInput.value = '';
    renderManageTags();
    clearHelpText(manageTagsHelp);
    manageTagsHelp?.classList.remove('attention-hint');
    addTagBtn?.classList.remove('pulse-add');
    tagLog('Tag staged:', normalized);
  };

  const getLocationLabelById = (locationId) => {
    if (!copyLocationSelect || !locationId) return '';
    const option = Array.from(copyLocationSelect.options).find((entry) => entry.value === String(locationId));
    return option ? option.textContent : '';
  };

  const getCopyCurrentValues = () => ({
    locationId: copyLocationSelect?.value ? Number(copyLocationSelect.value) : null,
    locationLabel: copyLocationSelect?.selectedOptions?.[0]?.textContent || '',
    acquisitionDate: copyAcquisitionDate.value.trim(),
    acquiredFrom: copyAcquiredFrom.value.trim(),
    acquisitionType: copyAcquisitionType?.value ? copyAcquisitionType.value.trim() : '',
    acquisitionLocation: copyAcquisitionLocation.value.trim(),
    acquisitionStory: copyAcquisitionStory.value.trim(),
    notes: copyNotes.value.trim()
  });

  const getCopyOriginalValues = () => (copyEditTarget?.original
    ? { ...copyEditTarget.original }
    : {
      locationId: null,
      locationLabel: '',
      acquisitionDate: '',
      acquiredFrom: '',
      acquisitionType: '',
      acquisitionLocation: '',
      acquisitionStory: '',
      notes: ''
    });

  const buildCopyChangeList = () => {
    if (!copyEditTarget || copyEditTarget.mode !== 'edit') return [];
    const current = getCopyCurrentValues();
    const original = getCopyOriginalValues();
    const changes = [];
    const locationChange = describeChange('storage location', original.locationLabel || '', current.locationLabel || '');
    const acquisitionDateChange = describeChange(
      'acquisition date',
      formatPartialDateDisplay(original.acquisitionDate || ''),
      formatPartialDateDisplay(current.acquisitionDate || '')
    );
    const acquiredFromChange = describeChange('acquired from', original.acquiredFrom, current.acquiredFrom);
    const acquisitionTypeChange = describeChange('acquisition type', original.acquisitionType, current.acquisitionType);
    const acquisitionLocationChange = describeChange('acquisition location', original.acquisitionLocation, current.acquisitionLocation);
    const acquisitionStoryChange = describeChange('acquisition story', original.acquisitionStory, current.acquisitionStory);
    const notesChange = describeChange('notes', original.notes, current.notes);
    [
      locationChange,
      acquisitionDateChange,
      acquiredFromChange,
      acquisitionTypeChange,
      acquisitionLocationChange,
      acquisitionStoryChange,
      notesChange
    ].forEach((entry) => { if (entry) changes.push(entry); });
    return changes;
  };

  const updateCopyChangeSummary = () => {
    if (!copyChangeSummary) return;
    if (!copyEditTarget || copyEditTarget.mode !== 'edit') {
      copyChangeSummary.textContent = '';
      if (copySaveBtn) copySaveBtn.disabled = copyModalState.locked;
      return;
    }
    const changes = buildCopyChangeList();
    copyChangeSummary.textContent = changes.length
      ? changes.join(' ')
      : 'No changes yet.';
    if (copySaveBtn) copySaveBtn.disabled = copyModalState.locked || changes.length === 0;
  };

  const setCopyLocked = (locked) => {
    copyModalState.locked = locked;
    setModalLocked(editCopyModal, locked);
    toggleDisabled([
      copyLocationSelect,
      copyAcquisitionDate,
      copyAcquiredFrom,
      copyAcquisitionType,
      copyAcquisitionLocation,
      copyAcquisitionStory,
      copyNotes,
      copyResetBtn
    ], locked);
    if (copySpinner) setButtonLoading(copySaveBtn, copySpinner.spinner, locked);
    updateCopyChangeSummary();
  };

  const setCopyLoading = (loading, message = 'Loading copy details…') => {
    toggleDisabled([
      copyLocationSelect,
      copyAcquisitionDate,
      copyAcquiredFrom,
      copyAcquisitionType,
      copyAcquisitionLocation,
      copyAcquisitionStory,
      copyNotes,
      copyResetBtn
    ], loading);
    if (copySaveBtn) copySaveBtn.disabled = loading || copyModalState.locked;
    if (copyLocationHelp) copyLocationHelp.textContent = loading ? message : '';
  };

  const resetCopyModal = () => {
    if (!copyEditTarget) return;
    if (copyEditTarget.mode === 'edit') {
      const original = getCopyOriginalValues();
      copyLocationSelect.value = original.locationId ? String(original.locationId) : '';
      copyAcquisitionDate.value = original.acquisitionDate || '';
      copyAcquiredFrom.value = original.acquiredFrom || '';
      copyAcquisitionType.value = original.acquisitionType || '';
      copyAcquisitionLocation.value = original.acquisitionLocation || '';
      copyAcquisitionStory.value = original.acquisitionStory || '';
      copyNotes.value = original.notes || '';
    } else {
      copyLocationSelect.value = '';
      copyAcquisitionDate.value = '';
      copyAcquiredFrom.value = '';
      copyAcquisitionType.value = '';
      copyAcquisitionLocation.value = '';
      copyAcquisitionStory.value = '';
      copyNotes.value = '';
    }
    clearHelpText(copyLocationHelp);
    clearHelpText(copyAcquisitionDateHelp);
    if (editCopyErrorAlert) clearApiAlert(editCopyErrorAlert);
    setPartialDateHelp(copyAcquisitionDate, copyAcquisitionDateHelp);
    updateCopyChangeSummary();
  };

  const openCopyModal = async ({ mode, copyId }) => {
    if (!bookRecord) return;
    copyLog('Opened modal (loading=true).', { mode, copyId: copyId || null });
    copyEditTarget = { mode, copyId, original: null };
    if (editCopyErrorAlert) clearApiAlert(editCopyErrorAlert);
    if (copyLocationHelp) copyLocationHelp.textContent = '';
    if (copyAcquisitionDateHelp) copyAcquisitionDateHelp.textContent = '';
    if (editCopyModalLabel) {
      editCopyModalLabel.textContent = mode === 'edit' ? 'Edit Copy' : 'Add Copy';
    }
    setButtonLabel(copySaveBtn, mode === 'edit' ? 'Save changes' : 'Add copy');
    if (copyResetBtn) copyResetBtn.textContent = mode === 'edit' ? 'Revert' : 'Reset';
    setCopyLoading(true);
    await showModal(editCopyModal, { backdrop: 'static', keyboard: false });
    try {
      const locations = await loadLocationsList();
      populateSelect(copyLocationSelect, locations, { placeholder: 'Select storage location', labelKey: 'path', valueKey: 'id', includeEmpty: true });
    } catch (error) {
      errorLog('Failed to load locations.', error);
      if (copyLocationHelp) copyLocationHelp.textContent = 'Unable to load storage locations right now.';
    }
    if (mode === 'edit') {
      const copy = (bookRecord.bookCopies || []).find((entry) => entry.id === copyId);
      if (!copy) {
        if (editCopyErrorAlert) renderApiErrorAlert(editCopyErrorAlert, { message: 'Validation Error', errors: ['The selected copy could not be found.'] }, 'Validation Error');
        setCopyLoading(false);
        return;
      }
      copyLocationSelect.value = copy.storageLocationId ? String(copy.storageLocationId) : '';
      copyAcquisitionDate.value = copy.acquisitionDate?.text || '';
      copyAcquiredFrom.value = copy.acquiredFrom || '';
      copyAcquisitionType.value = copy.acquisitionType || '';
      copyAcquisitionLocation.value = copy.acquisitionLocation || '';
      copyAcquisitionStory.value = copy.acquisitionStory || '';
      copyNotes.value = copy.notes || '';
      copyEditTarget.original = {
        locationId: copy.storageLocationId || null,
        locationLabel: copy.storageLocationPath || getLocationLabelById(copy.storageLocationId),
        acquisitionDate: copy.acquisitionDate?.text || '',
        acquiredFrom: copy.acquiredFrom || '',
        acquisitionType: copy.acquisitionType || '',
        acquisitionLocation: copy.acquisitionLocation || '',
        acquisitionStory: copy.acquisitionStory || '',
        notes: copy.notes || ''
      };
      setPartialDateHelp(copyAcquisitionDate, copyAcquisitionDateHelp);
    } else {
      copyLocationSelect.value = '';
      copyAcquisitionDate.value = '';
      copyAcquiredFrom.value = '';
      copyAcquisitionType.value = '';
      copyAcquisitionLocation.value = '';
      copyAcquisitionStory.value = '';
      copyNotes.value = '';
      clearHelpText(copyAcquisitionDateHelp);
    }
    updateCopyLocationHelp();
    updateCopyChangeSummary();
    setCopyLoading(false);
    copyLog('Opened modal (loading=false).', { mode, copyId: copyId || null });
  };

  const saveCopy = async () => {
    if (!bookRecord || !copyEditTarget) return;
    const step = (label, details = {}) => {
      log(`[Copy Save] ${label}`, { mode: copyEditTarget?.mode, copyId: copyEditTarget?.copyId, ...details });
    };
    step('(A) handler start');
    const locationId = copyLocationSelect?.value ? Number(copyLocationSelect.value) : null;
    if (!locationId) {
      setHelpText(copyLocationHelp, 'This field is required.', true);
      return;
    }
    const dateRaw = copyAcquisitionDate.value.trim();
    const parsedDate = dateRaw ? parsePartialDateInput(dateRaw) : { value: null };
    if (parsedDate.error) {
      if (copyAcquisitionDateHelp) copyAcquisitionDateHelp.textContent = parsedDate.error;
      return;
    }
    step('(B) before lock');
    window.modalLock?.lock(editCopyModal, copyEditTarget.mode === 'edit' ? 'Edit copy' : 'Add copy');
    setCopyLocked(true);
    step('(C) after lock applied');
    try {
      const acquisitionTypeValue = copyAcquisitionType?.value ? copyAcquisitionType.value.trim() : '';
      const payload = {
        storageLocationId: locationId,
        acquisitionDate: parsedDate.value,
        acquiredFrom: copyAcquiredFrom.value.trim() || null,
        acquisitionType: acquisitionTypeValue || null,
        acquisitionLocation: copyAcquisitionLocation.value.trim() || null,
        acquisitionStory: copyAcquisitionStory.value.trim() || null,
        notes: copyNotes.value.trim() || null
      };
      step('(D) before apiFetch', { hasDate: Boolean(parsedDate.value) });
      let response;
      if (copyEditTarget.mode === 'edit') {
        response = await apiFetch('/bookcopy', {
          method: 'PUT',
          body: JSON.stringify({ id: copyEditTarget.copyId, ...payload })
        });
      } else {
        response = await apiFetch('/bookcopy', {
          method: 'POST',
          body: JSON.stringify({ bookId: bookRecord.id, ...payload })
        });
      }
      step('(E) response received', { status: response?.status, ok: response?.ok });
      const data = await response.json().catch(() => ({}));
      step('(F) response parsed', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (editCopyErrorAlert) renderApiErrorAlert(editCopyErrorAlert, data, data.message || 'Unable to save copy.');
        warn('Copy save failed.', { status: response.status, data });
        return;
      }
      step('(G) before hideModal');
      await hideModal(editCopyModal);
      step('(H) after hideModal');
      step('(I) before refreshBook');
      await refreshBook();
      step('(J) after refreshBook');
      showInlineSuccess(copyEditTarget.mode === 'edit' ? 'Copy updated.' : 'Copy added.');
    } catch (error) {
      errorLog('Copy save failed.', error);
      if (editCopyErrorAlert) renderApiErrorAlert(editCopyErrorAlert, { message: 'Unable to save copy right now.' }, 'Unable to save copy right now.');
    } finally {
      step('(Z) finally start');
      try {
        setCopyLocked(false);
      } catch (unlockError) {
        errorLog('Copy save unlock failed.', unlockError);
      }
      window.modalLock?.unlock(editCopyModal, 'finally');
    }
  };

  const openDeleteCopyModal = (copyId) => {
    const copies = bookRecord?.bookCopies || [];
    const copy = copies.find((entry) => entry.id === copyId);
    if (!copy) return;
    log('Opening delete copy modal.', { copyId });
    setDeleteCopyLocked(false);
    copyEditTarget = { mode: 'delete', copyId };
    if (deleteCopyText) deleteCopyText.textContent = `Remove copy stored at ${copy.storageLocationPath || 'unknown location'}?`;
    if (deleteCopyErrorAlert) clearApiAlert(deleteCopyErrorAlert);
    if (deleteCopyConfirmBtn) {
      deleteCopyConfirmBtn.disabled = copies.length <= 1;
      if (copies.length <= 1 && deleteCopyErrorAlert) {
        renderApiErrorAlert(deleteCopyErrorAlert, { message: 'Validation Error', errors: ['A book must have at least one copy.'] }, 'Validation Error');
      }
    }
    showModal(deleteCopyModal, { backdrop: 'static', keyboard: false });
  };

  const confirmDeleteCopy = async () => {
    if (!bookRecord || !copyEditTarget || copyEditTarget.mode !== 'delete') return;
    deleteCopyConfirmBtn.disabled = true;
    window.modalLock?.lock(deleteCopyModal, 'Delete copy');
    setDeleteCopyLocked(true);
    try {
      const response = await apiFetch('/bookcopy', {
        method: 'DELETE',
        body: JSON.stringify({ id: copyEditTarget.copyId })
      });
      const data = await response.json().catch(() => ({}));
      log('Copy delete response parsed.', { ok: response.ok, status: response.status });
      if (!response.ok) {
        if (deleteCopyErrorAlert) renderApiErrorAlert(deleteCopyErrorAlert, data, data.message || 'Unable to delete copy.');
        warn('Copy delete failed.', { status: response.status, data });
        return;
      }
      await hideModal(deleteCopyModal);
      await refreshBook();
      showInlineSuccess('Copy removed.');
    } catch (error) {
      errorLog('Copy delete failed.', error);
      if (deleteCopyErrorAlert) renderApiErrorAlert(deleteCopyErrorAlert, { message: 'Unable to delete copy right now.' }, 'Unable to delete copy right now.');
    } finally {
      const lockedOut = (bookRecord?.bookCopies || []).length <= 1;
      deleteCopyConfirmBtn.disabled = lockedOut;
      setDeleteCopyLocked(false);
      window.modalLock?.unlock(deleteCopyModal, 'finally');
    }
  };

  const handleSharedModalReady = () => {
    window.sharedAddModalsConfig = window.sharedAddModalsConfig || {};
    window.sharedAddModalsConfig.getLocations = async () => loadLocationsList();

    const sharedEvents = window.sharedAddModals?.events;
    if (!sharedEvents) return;

    sharedEvents.addEventListener('publisher:created', async (event) => {
      referenceData.publishers = null;
      await loadPublishers();
      populateSelect(editBookPublisher, referenceData.publishers, { placeholder: 'No publisher', labelKey: 'name', valueKey: 'id', includeEmpty: true });
      if (event?.detail?.id) editBookPublisher.value = String(event.detail.id);
    });

    sharedEvents.addEventListener('booktype:created', async (event) => {
      referenceData.bookTypes = null;
      await loadBookTypes();
      populateSelect(editBookType, referenceData.bookTypes, { placeholder: 'No book type', labelKey: 'name', valueKey: 'id', includeEmpty: true });
      if (event?.detail?.id) editBookType.value = String(event.detail.id);
    });

    sharedEvents.addEventListener('author:created', async (event) => {
      referenceData.authors = null;
      await loadAuthorsList();
      updateAuthorSearchAvailability();
      if (event?.detail?.id) {
        const created = referenceData.authors.find((entry) => entry.id === event.detail.id);
        if (created) {
          showSearchResults(manageAuthorsResults, [created], addAuthorFromSearch);
        }
      }
    });

    sharedEvents.addEventListener('series:created', async (event) => {
      referenceData.series = null;
      await loadSeriesList();
      updateSeriesSearchAvailability();
      if (event?.detail?.id) {
        const created = referenceData.series.find((entry) => entry.id === event.detail.id);
        if (created) {
          showSearchResults(manageSeriesResults, [created], addSeriesFromSearch);
        }
      }
    });

    sharedEvents.addEventListener('location:created', async (event) => {
      referenceData.locations = null;
      await loadLocationsList();
      populateSelect(copyLocationSelect, referenceData.locations, { placeholder: 'Select storage location', labelKey: 'path', valueKey: 'id', includeEmpty: true });
      if (event?.detail?.id) copyLocationSelect.value = String(event.detail.id);
    });
  };

  if (editBookBtn) editBookBtn.addEventListener('click', () => {
    if (!bookRecord || !Number.isInteger(bookRecord.id)) return;
    window.location.href = `add-book?id=${bookRecord.id}`;
  });
  if (editBookSaveBtn) editBookSaveBtn.addEventListener('click', saveBookEdits);
  if (editBookTitle) editBookTitle.addEventListener('input', updateEditBookState);
  if (editBookSubtitle) editBookSubtitle.addEventListener('input', updateEditBookState);
  if (editBookIsbn) editBookIsbn.addEventListener('input', updateEditBookState);
  if (editBookPublication) editBookPublication.addEventListener('input', updateEditBookState);
  if (editBookPages) editBookPages.addEventListener('input', updateEditBookState);
  if (editBookCover) editBookCover.addEventListener('input', updateEditBookState);
  if (editBookDescription) editBookDescription.addEventListener('input', updateEditBookState);
  if (editBookLanguages) editBookLanguages.addEventListener('change', updateEditBookState);
  if (editBookType) editBookType.addEventListener('change', updateEditBookState);
  if (editBookPublisher) editBookPublisher.addEventListener('change', updateEditBookState);
  if (deleteBookBtn) deleteBookBtn.addEventListener('click', openDeleteBookModal);
  if (deleteBookConfirmBtn) deleteBookConfirmBtn.addEventListener('click', confirmDeleteBook);
  if (manageAuthorsBtn) manageAuthorsBtn.addEventListener('click', openManageAuthorsModal);
  if (manageSeriesBtn) manageSeriesBtn.addEventListener('click', openManageSeriesModal);
  if (manageTagsBtn) manageTagsBtn.addEventListener('click', openManageTagsModal);
  if (addCopyBtn) addCopyBtn.addEventListener('click', () => openCopyModal({ mode: 'create' }));
  if (authorRoleSaveBtn) authorRoleSaveBtn.addEventListener('click', saveAuthorRole);
  if (authorRoleResetBtn) authorRoleResetBtn.addEventListener('click', resetAuthorRoleModal);
  if (removeAuthorConfirmBtn) removeAuthorConfirmBtn.addEventListener('click', confirmRemoveAuthor);
  if (seriesOrderSaveBtn) seriesOrderSaveBtn.addEventListener('click', saveSeriesOrder);
  if (seriesOrderResetBtn) seriesOrderResetBtn.addEventListener('click', resetSeriesOrderModal);
  if (removeSeriesConfirmBtn) removeSeriesConfirmBtn.addEventListener('click', confirmRemoveSeries);
  if (addTagBtn) addTagBtn.addEventListener('click', addTag);
  if (manageTagsSaveBtn) manageTagsSaveBtn.addEventListener('click', saveManageTagsChanges);
  if (manageTagsResetBtn) manageTagsResetBtn.addEventListener('click', resetManageTags);
  if (manageTagsInput) {
    manageTagsInput.addEventListener('input', () => {
      clearHelpText(manageTagsHelp);
      const normalized = normalizeTag(manageTagsInput.value);
      const error = validateTag(normalized);
      if (error && normalized) {
        setHelpText(manageTagsHelp, error, true);
        manageTagsHelp?.classList.remove('attention-hint');
        addTagBtn?.classList.remove('pulse-add');
        return;
      }
      if (normalized) {
        setHelpText(manageTagsHelp, 'Click Add to stage this tag.', false);
        manageTagsHelp?.classList.add('attention-hint');
        addTagBtn?.classList.add('pulse-add');
      } else {
        setHelpText(manageTagsHelp, 'Type a tag and click Add to stage it.', false);
        manageTagsHelp?.classList.remove('attention-hint');
        addTagBtn?.classList.remove('pulse-add');
      }
    });
    manageTagsInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addTag();
      }
    });
  }
  if (manageAuthorsSearch) {
    manageAuthorsSearch.addEventListener('input', handleManageAuthorSearch);
    manageAuthorsSearch.addEventListener('blur', () => setTimeout(() => hideSearchResults(manageAuthorsResults), 150));
  }
  if (manageSeriesSearch) {
    manageSeriesSearch.addEventListener('input', handleManageSeriesSearch);
    manageSeriesSearch.addEventListener('blur', () => setTimeout(() => hideSearchResults(manageSeriesResults), 150));
  }
  if (authorRoleSelect) {
    authorRoleSelect.addEventListener('change', () => {
      if (!authorRoleTarget) return;
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
      if (!authorRoleTarget) return;
      updateAuthorRoleChangeSummary();
    });
  }
  if (copySaveBtn) copySaveBtn.addEventListener('click', saveCopy);
  if (copyResetBtn) copyResetBtn.addEventListener('click', resetCopyModal);
  if (deleteCopyConfirmBtn) deleteCopyConfirmBtn.addEventListener('click', confirmDeleteCopy);
  if (copyAcquisitionDate) copyAcquisitionDate.addEventListener('input', () => {
    setPartialDateHelp(copyAcquisitionDate, copyAcquisitionDateHelp);
    updateCopyChangeSummary();
  });
  if (copyLocationSelect) copyLocationSelect.addEventListener('change', () => {
    updateCopyLocationHelp();
    updateCopyChangeSummary();
  });
  if (copyAcquiredFrom) copyAcquiredFrom.addEventListener('input', updateCopyChangeSummary);
  if (copyAcquisitionType) copyAcquisitionType.addEventListener('change', updateCopyChangeSummary);
  if (copyAcquisitionLocation) copyAcquisitionLocation.addEventListener('input', updateCopyChangeSummary);
  if (copyAcquisitionStory) copyAcquisitionStory.addEventListener('input', updateCopyChangeSummary);
  if (copyNotes) copyNotes.addEventListener('input', updateCopyChangeSummary);
  if (openAddPublisherBtn) openAddPublisherBtn.addEventListener('click', () => window.sharedAddModals?.open('publisher'));
  if (openAddBookTypeBtn) openAddBookTypeBtn.addEventListener('click', () => window.sharedAddModals?.open('booktype'));
  if (openAddAuthorBtn) openAddAuthorBtn.addEventListener('click', () => window.sharedAddModals?.open('author'));
  if (openAddSeriesBtn) openAddSeriesBtn.addEventListener('click', () => window.sharedAddModals?.open('series'));
  if (openAddLocationBtn) openAddLocationBtn.addEventListener('click', () => window.sharedAddModals?.open('location'));

  handleSharedModalReady();

  if (editAuthorRoleModal) {
    editAuthorRoleModal.addEventListener('hidden.bs.modal', () => {
      window.modalStack?.pop('editAuthorRoleModal');
    });
  }
  if (removeAuthorModal) {
    removeAuthorModal.addEventListener('hidden.bs.modal', () => {
      window.modalStack?.pop('removeAuthorModal');
    });
  }
  if (editSeriesOrderModal) {
    editSeriesOrderModal.addEventListener('hidden.bs.modal', () => {
      window.modalStack?.pop('editSeriesOrderModal');
    });
  }
  if (removeSeriesModal) {
    removeSeriesModal.addEventListener('hidden.bs.modal', () => {
      window.modalStack?.pop('removeSeriesModal');
    });
  }

  

  if (seriesOrderInput) {
    seriesOrderInput.addEventListener('input', () => {
      if (!seriesOrderTarget) return;
      updateSeriesOrderSummary(seriesOrderTarget.seriesEntry, seriesOrderTarget.currentOrder, seriesOrderInput.value ? Number(seriesOrderInput.value) : null);
      updateSeriesOrderChangeSummary();
    });
  }

  loadBook();
  initializeTooltips();
});
