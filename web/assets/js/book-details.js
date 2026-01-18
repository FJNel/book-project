document.addEventListener('DOMContentLoaded', () => {
  const log = (...args) => console.log('[Book Details]', ...args);
  const warn = (...args) => console.warn('[Book Details]', ...args);
  const errorLog = (...args) => console.error('[Book Details]', ...args);

  log('Initializing page.');
  if (window.rateLimitGuard?.hasReset && window.rateLimitGuard.hasReset()) {
    window.rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
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
  const manageAuthorsSelect = document.getElementById('manageAuthorsSelect');
  const manageAuthorsRole = document.getElementById('manageAuthorsRole');
  const addAuthorToBookBtn = document.getElementById('addAuthorToBookBtn');
  const manageAuthorsError = document.getElementById('manageAuthorsError');
  const openAddAuthorBtn = document.getElementById('openAddAuthorBtn');

  const editAuthorRoleModal = document.getElementById('editAuthorRoleModal');
  const authorRoleInput = document.getElementById('authorRoleInput');
  const authorRoleSummary = document.getElementById('authorRoleSummary');
  const authorRoleSaveBtn = document.getElementById('authorRoleSaveBtn');
  const authorRoleErrorAlert = document.getElementById('authorRoleErrorAlert');

  const removeAuthorModal = document.getElementById('removeAuthorModal');
  const removeAuthorText = document.getElementById('removeAuthorText');
  const removeAuthorConfirmBtn = document.getElementById('removeAuthorConfirmBtn');
  const removeAuthorError = document.getElementById('removeAuthorError');

  const manageSeriesModal = document.getElementById('manageSeriesModal');
  const manageSeriesList = document.getElementById('manageSeriesList');
  const manageSeriesSelect = document.getElementById('manageSeriesSelect');
  const manageSeriesOrder = document.getElementById('manageSeriesOrder');
  const addSeriesToBookBtn = document.getElementById('addSeriesToBookBtn');
  const manageSeriesError = document.getElementById('manageSeriesError');
  const openAddSeriesBtn = document.getElementById('openAddSeriesBtn');

  const editSeriesOrderModal = document.getElementById('editSeriesOrderModal');
  const seriesOrderInput = document.getElementById('seriesOrderInput');
  const seriesOrderSummary = document.getElementById('seriesOrderSummary');
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
  const copySaveBtn = document.getElementById('copySaveBtn');
  const openAddLocationBtn = document.getElementById('openAddLocationBtn');

  const deleteCopyModal = document.getElementById('deleteCopyModal');
  const deleteCopyText = document.getElementById('deleteCopyText');
  const deleteCopyConfirmBtn = document.getElementById('deleteCopyConfirmBtn');
  const deleteCopyErrorAlert = document.getElementById('deleteCopyErrorAlert');

  const addPublisherModal = document.getElementById('addPublisherModal');
  const addPublisherErrorAlert = document.getElementById('addPublisherErrorAlert');
  const addPublisherName = document.getElementById('addPublisherName');
  const addPublisherFounded = document.getElementById('addPublisherFounded');
  const addPublisherWebsite = document.getElementById('addPublisherWebsite');
  const addPublisherNotes = document.getElementById('addPublisherNotes');
  const addPublisherSaveBtn = document.getElementById('addPublisherSaveBtn');
  const addPublisherNameHelp = document.getElementById('addPublisherNameHelp');
  const addPublisherFoundedHelp = document.getElementById('addPublisherFoundedHelp');
  const addPublisherWebsiteHelp = document.getElementById('addPublisherWebsiteHelp');
  const addPublisherNotesHelp = document.getElementById('addPublisherNotesHelp');

  const addBookTypeModal = document.getElementById('addBookTypeModal');
  const addBookTypeErrorAlert = document.getElementById('addBookTypeErrorAlert');
  const addBookTypeName = document.getElementById('addBookTypeName');
  const addBookTypeDescription = document.getElementById('addBookTypeDescription');
  const addBookTypeSaveBtn = document.getElementById('addBookTypeSaveBtn');
  const addBookTypeNameHelp = document.getElementById('addBookTypeNameHelp');
  const addBookTypeDescriptionHelp = document.getElementById('addBookTypeDescriptionHelp');

  const addAuthorModal = document.getElementById('addAuthorModal');
  const addAuthorErrorAlert = document.getElementById('addAuthorErrorAlert');
  const addAuthorDisplayName = document.getElementById('addAuthorDisplayName');
  const addAuthorFirstNames = document.getElementById('addAuthorFirstNames');
  const addAuthorLastName = document.getElementById('addAuthorLastName');
  const addAuthorBirthDate = document.getElementById('addAuthorBirthDate');
  const addAuthorDeceased = document.getElementById('addAuthorDeceased');
  const addAuthorDeathDate = document.getElementById('addAuthorDeathDate');
  const addAuthorBio = document.getElementById('addAuthorBio');
  const addAuthorSaveBtn = document.getElementById('addAuthorSaveBtn');
  const addAuthorDisplayNameHelp = document.getElementById('addAuthorDisplayNameHelp');
  const addAuthorFirstNamesHelp = document.getElementById('addAuthorFirstNamesHelp');
  const addAuthorLastNameHelp = document.getElementById('addAuthorLastNameHelp');
  const addAuthorBirthDateHelp = document.getElementById('addAuthorBirthDateHelp');
  const addAuthorDeathDateHelp = document.getElementById('addAuthorDeathDateHelp');
  const addAuthorBioHelp = document.getElementById('addAuthorBioHelp');

  const addSeriesModal = document.getElementById('addSeriesModal');
  const addSeriesErrorAlert = document.getElementById('addSeriesErrorAlert');
  const addSeriesName = document.getElementById('addSeriesName');
  const addSeriesWebsite = document.getElementById('addSeriesWebsite');
  const addSeriesDescription = document.getElementById('addSeriesDescription');
  const addSeriesSaveBtn = document.getElementById('addSeriesSaveBtn');
  const addSeriesNameHelp = document.getElementById('addSeriesNameHelp');
  const addSeriesWebsiteHelp = document.getElementById('addSeriesWebsiteHelp');
  const addSeriesDescriptionHelp = document.getElementById('addSeriesDescriptionHelp');

  const addLocationModal = document.getElementById('addLocationModal');
  const addLocationErrorAlert = document.getElementById('addLocationErrorAlert');
  const addLocationName = document.getElementById('addLocationName');
  const addLocationParent = document.getElementById('addLocationParent');
  const addLocationNotes = document.getElementById('addLocationNotes');
  const addLocationSaveBtn = document.getElementById('addLocationSaveBtn');
  const addLocationNameHelp = document.getElementById('addLocationNameHelp');
  const addLocationParentHelp = document.getElementById('addLocationParentHelp');
  const addLocationNotesHelp = document.getElementById('addLocationNotesHelp');

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

  const setHelpText = (el, message, isError = false) => {
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('text-danger', Boolean(message) && isError);
  };

  const clearHelpText = (el) => setHelpText(el, '', false);

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

  const initializeTooltips = () => {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach((tooltipTriggerEl) => {
      if (bootstrap.Tooltip.getInstance(tooltipTriggerEl)) return;
      new bootstrap.Tooltip(tooltipTriggerEl);
    });
    log('Tooltips initialized.', { count: tooltipTriggerList.length });
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

  let bookRecord = null;
  let referenceData = {
    languages: null,
    bookTypes: null,
    publishers: null,
    authors: null,
    series: null,
    locations: null
  };
  let tagDraft = [];
  let authorRoleTarget = null;
  let removeAuthorTarget = null;
  let seriesOrderTarget = null;
  let removeSeriesTarget = null;
  let copyEditTarget = null;

  const toggleDetails = ({ row, wrap, chevron }) => {
    if (!row || !wrap || !chevron) return;
    const isOpen = row.getAttribute('data-expanded') === 'true';
    wrap.classList.toggle('d-none', isOpen);
    row.setAttribute('data-expanded', isOpen ? 'false' : 'true');
  };

  const enableExpandableRow = ({ row, wrap, chevron }) => {
    if (!row || !wrap || !chevron) return;
    row.classList.add('clickable-row');
    chevron.classList.remove('d-none');
    row.addEventListener('click', () => toggleDetails({ row, wrap, chevron }));
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
      item.className = 'list-group-item position-relative';
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
      item.className = 'list-group-item position-relative';
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

              <div class="col-12 col-lg-6">
                <div class="border rounded p-3">
                  <div class="fw-semibold mb-1">Story</div>
                  <p class="mb-0">${story || '(none)'}</p>
                </div>

                <div class="border rounded p-3 mt-3">
                  <div class="fw-semibold mb-1">Notes</div>
                  <p class="mb-0">${notes || '(none)'}</p>
                </div>
              </div>

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
                    <button class="btn btn-sm btn-outline-danger" type="button" data-copy-delete="${copy.id}" ${disableDelete ? 'disabled aria-disabled="true"' : ''}>
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
      const badge = document.createElement('span');
      badge.className = 'badge rounded-pill bg-white text-dark border px-3 py-2 fs-6 me-1 mb-1';
      badge.textContent = tag.name;
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
    const authorLine = authorNames.length > 0 ? authorNames.join(', ') : null;
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
    bookTypeNameEl.textContent = bookTypeName;
    bookTypeNameEl.classList.toggle('text-muted', !book.bookType?.name);

    const bookTypeDescription = book.bookType?.description ? book.bookType.description.trim() : '';
    const bookTypeDescriptionWrap = document.getElementById('bookTypeDescriptionWrap');
    if (bookTypeDescription) {
      document.getElementById('bookTypeDescription').textContent = bookTypeDescription;
      enableExpandableRow({
        row: bookTypeRow,
        wrap: bookTypeDescriptionWrap,
        chevron: document.getElementById('bookTypeChevron')
      });
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
      const publisherChevron = document.getElementById('publisherChevron');
      publisherRow.classList.add('clickable-row');
      publisherChevron.classList.remove('d-none');

      publisherDetails.forEach((detail) => {
        if (!detail.data) return;
        const wrap = document.getElementById(detail.wrap);
        const value = document.getElementById(detail.value);
        value.innerHTML = detail.data;
        wrap.classList.add('d-none');
      });

      publisherRow.addEventListener('click', () => {
        publisherDetails.forEach((detail) => {
          if (!detail.data) return;
          document.getElementById(detail.wrap).classList.toggle('d-none');
        });
      });
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
    } catch (error) {
      errorLog('Book load failed with exception.', error);
      await showInvalidModal(defaultInvalidBookMessage);
    } finally {
      await hideModal('pageLoadingModal');
    }
  };

  const fetchList = async (url, options) => {
    const response = await apiFetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.message || 'Request failed.';
      throw new Error(message);
    }
    if (!data || data.status !== 'success') {
      throw new Error('Invalid response.');
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
      body: JSON.stringify({ sortBy: 'displayName', order: 'asc', limit: 500, offset: 0 })
    });
    referenceData.authors = payload.authors || [];
    return referenceData.authors;
  };

  const loadSeriesList = async () => {
    if (referenceData.series) return referenceData.series;
    log('Loading series list.');
    const payload = await fetchList('/bookseries/list', {
      method: 'POST',
      body: JSON.stringify({ sortBy: 'name', order: 'asc', limit: 500, offset: 0 })
    });
    referenceData.series = payload.series || [];
    return referenceData.series;
  };

  const loadLocationsList = async () => {
    if (referenceData.locations) return referenceData.locations;
    log('Loading storage locations list.');
    const payload = await fetchList('/storagelocation/list', {
      method: 'POST',
      body: JSON.stringify({ sortBy: 'path', order: 'asc', limit: 500, offset: 0 })
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
    if (editBookErrorAlert) {
      editBookErrorAlert.classList.add('d-none');
      editBookErrorAlert.textContent = '';
    }
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
      await showModal(editBookModal, { backdrop: 'static', keyboard: false });
    } catch (error) {
      errorLog('Failed to prepare edit modal.', error);
    }
  };

  const validateEditBook = () => {
    let valid = true;
    const title = editBookTitle?.value.trim() || '';
    if (!title) {
      setHelpText(editBookTitleHelp, 'Title is required.', true);
      valid = false;
    } else if (title.length < 2 || title.length > 200) {
      setHelpText(editBookTitleHelp, 'Title must be between 2 and 200 characters.', true);
      valid = false;
    } else {
      clearHelpText(editBookTitleHelp);
    }

    const subtitle = editBookSubtitle?.value.trim() || '';
    if (subtitle && subtitle.length > 200) {
      setHelpText(editBookSubtitleHelp, 'Subtitle must be 200 characters or fewer.', true);
      valid = false;
    } else {
      clearHelpText(editBookSubtitleHelp);
    }

    const isbn = editBookIsbn?.value.trim() || '';
    if (isbn && isbn.length > 40) {
      setHelpText(editBookIsbnHelp, 'ISBN must be 40 characters or fewer.', true);
      valid = false;
    } else {
      clearHelpText(editBookIsbnHelp);
    }

    const publicationRaw = editBookPublication?.value.trim() || '';
    if (publicationRaw) {
      const parsed = parsePartialDateInput(publicationRaw);
      if (parsed.error) {
        setHelpText(editBookPublicationHelp, parsed.error, true);
        valid = false;
      } else {
        clearHelpText(editBookPublicationHelp);
      }
    } else {
      clearHelpText(editBookPublicationHelp);
    }

    const pagesRaw = editBookPages?.value.trim() || '';
    if (pagesRaw) {
      const pageValue = Number(pagesRaw);
      if (!Number.isInteger(pageValue) || pageValue <= 0) {
        setHelpText(editBookPagesHelp, 'Pages must be a positive whole number.', true);
        valid = false;
      } else {
        clearHelpText(editBookPagesHelp);
      }
    } else {
      clearHelpText(editBookPagesHelp);
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
    if (!validateEditBook()) return;
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
        if (editBookErrorAlert) {
          editBookErrorAlert.classList.remove('d-none');
          editBookErrorAlert.textContent = data.message || 'Unable to update book.';
        }
        warn('Book update failed.', { status: response.status, data });
        return;
      }
      await hideModal(editBookModal);
      await loadBook();
    } catch (error) {
      errorLog('Book update failed.', error);
      if (editBookErrorAlert) {
        editBookErrorAlert.classList.remove('d-none');
        editBookErrorAlert.textContent = 'Unable to update book right now.';
      }
    } finally {
      editBookSaveBtn.disabled = false;
    }
  };

  const openDeleteBookModal = () => {
    if (!bookRecord) return;
    if (deleteBookName) deleteBookName.textContent = bookRecord.title || 'this book';
    if (deleteBookErrorAlert) {
      deleteBookErrorAlert.classList.add('d-none');
      deleteBookErrorAlert.textContent = '';
    }
    showModal(deleteBookModal, { backdrop: 'static', keyboard: false });
  };

  const confirmDeleteBook = async () => {
    if (!bookRecord) return;
    deleteBookConfirmBtn.disabled = true;
    try {
      const response = await apiFetch('/book', { method: 'DELETE', body: JSON.stringify({ id: bookRecord.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (deleteBookErrorAlert) {
          deleteBookErrorAlert.classList.remove('d-none');
          deleteBookErrorAlert.textContent = data.message || 'Unable to delete book.';
        }
        warn('Book delete failed.', { status: response.status, data });
        return;
      }
      sessionStorage.setItem('booksFlash', 'Book deleted successfully.');
      window.location.href = 'books';
    } catch (error) {
      errorLog('Book delete failed.', error);
      if (deleteBookErrorAlert) {
        deleteBookErrorAlert.classList.remove('d-none');
        deleteBookErrorAlert.textContent = 'Unable to delete book right now.';
      }
    } finally {
      deleteBookConfirmBtn.disabled = false;
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
        <div class="d-flex gap-2">
          <button class="btn btn-link btn-sm p-0" type="button" data-author-role="${author.authorId}">Edit role</button>
          <button class="btn btn-link btn-sm text-danger p-0" type="button" data-author-remove="${author.authorId}">Remove</button>
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

  const openManageAuthorsModal = async () => {
    if (!bookRecord) return;
    if (manageAuthorsError) {
      manageAuthorsError.classList.add('d-none');
      manageAuthorsError.textContent = '';
    }
    try {
      const authors = await loadAuthorsList();
      populateSelect(manageAuthorsSelect, authors, { placeholder: 'Select author', labelKey: 'displayName', valueKey: 'id', includeEmpty: true });
      renderManageAuthorsList(bookRecord.authors || []);
      manageAuthorsRole.value = '';
      await showModal(manageAuthorsModal, { backdrop: 'static', keyboard: false });
    } catch (error) {
      errorLog('Failed to load authors.', error);
    }
  };

  const updateAuthorRoleSummary = (author, currentRole, nextRole) => {
    if (!authorRoleSummary || !bookRecord) return;
    const safeCurrent = currentRole || 'No role';
    const safeNext = nextRole || 'No role';
    authorRoleSummary.textContent = `Changing ${author.authorName || 'this author'}'s role on ${bookRecord.title || 'this book'} from ${safeCurrent} to ${safeNext}.`;
  };

  const openAuthorRoleModal = (authorId) => {
    const authors = bookRecord?.authors || [];
    const author = authors.find((entry) => entry.authorId === authorId);
    if (!author) return;
    authorRoleTarget = { author, currentRole: author.authorRole || 'Contributor' };
    authorRoleInput.value = author.authorRole === 'Contributor' ? '' : author.authorRole || '';
    if (authorRoleErrorAlert) {
      authorRoleErrorAlert.classList.add('d-none');
      authorRoleErrorAlert.textContent = '';
    }
    updateAuthorRoleSummary(author, authorRoleTarget.currentRole, authorRoleInput.value.trim());
    showModal(editAuthorRoleModal, { backdrop: 'static', keyboard: false });
  };

  const saveAuthorRole = async () => {
    if (!authorRoleTarget || !bookRecord) return;
    const nextRole = authorRoleInput.value.trim();
    const authors = (bookRecord.authors || []).map((entry) => ({
      authorId: entry.authorId,
      authorRole: entry.authorId === authorRoleTarget.author.authorId ? (nextRole || null) : (entry.authorRole || null)
    }));
    authorRoleSaveBtn.disabled = true;
    try {
      const response = await apiFetch('/book', { method: 'PUT', body: JSON.stringify({ id: bookRecord.id, authors }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (authorRoleErrorAlert) {
          authorRoleErrorAlert.classList.remove('d-none');
          authorRoleErrorAlert.textContent = data.message || 'Unable to update role.';
        }
        warn('Author role update failed.', { status: response.status, data });
        return;
      }
      await hideModal(editAuthorRoleModal);
      await loadBook();
      await openManageAuthorsModal();
    } catch (error) {
      errorLog('Author role update failed.', error);
      if (authorRoleErrorAlert) {
        authorRoleErrorAlert.classList.remove('d-none');
        authorRoleErrorAlert.textContent = 'Unable to update role right now.';
      }
    } finally {
      authorRoleSaveBtn.disabled = false;
    }
  };

  const openRemoveAuthorModal = (authorId) => {
    const authors = bookRecord?.authors || [];
    const author = authors.find((entry) => entry.authorId === authorId);
    if (!author) return;
    removeAuthorTarget = author;
    if (removeAuthorText) {
      removeAuthorText.textContent = `Removing ${author.authorName || 'this author'} from ${bookRecord.title || 'this book'}.`;
    }
    if (removeAuthorError) {
      removeAuthorError.classList.add('d-none');
      removeAuthorError.textContent = '';
    }
    showModal(removeAuthorModal, { backdrop: 'static', keyboard: false });
  };

  const confirmRemoveAuthor = async () => {
    if (!removeAuthorTarget || !bookRecord) return;
    const remainingAuthors = (bookRecord.authors || []).filter((entry) => entry.authorId !== removeAuthorTarget.authorId);
    removeAuthorConfirmBtn.disabled = true;
    try {
      const response = await apiFetch('/book', {
        method: 'PUT',
        body: JSON.stringify({
          id: bookRecord.id,
          authors: remainingAuthors.map((entry) => ({
            authorId: entry.authorId,
            authorRole: entry.authorRole || null
          }))
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (removeAuthorError) {
          removeAuthorError.classList.remove('d-none');
          removeAuthorError.textContent = data.message || 'Unable to remove author.';
        }
        warn('Remove author failed.', { status: response.status, data });
        return;
      }
      await hideModal(removeAuthorModal);
      await loadBook();
      await openManageAuthorsModal();
    } catch (error) {
      errorLog('Remove author failed.', error);
      if (removeAuthorError) {
        removeAuthorError.classList.remove('d-none');
        removeAuthorError.textContent = 'Unable to remove author right now.';
      }
    } finally {
      removeAuthorConfirmBtn.disabled = false;
    }
  };

  const addAuthorToBook = async () => {
    if (!bookRecord) return;
    const authorId = manageAuthorsSelect?.value ? Number(manageAuthorsSelect.value) : null;
    if (!authorId) {
      if (manageAuthorsError) {
        manageAuthorsError.classList.remove('d-none');
        manageAuthorsError.textContent = 'Select an author to add.';
      }
      return;
    }
    const existing = (bookRecord.authors || []).some((entry) => entry.authorId === authorId);
    if (existing) {
      if (manageAuthorsError) {
        manageAuthorsError.classList.remove('d-none');
        manageAuthorsError.textContent = 'That author is already linked.';
      }
      return;
    }
    const role = manageAuthorsRole?.value.trim() || null;
    const authors = (bookRecord.authors || []).map((entry) => ({
      authorId: entry.authorId,
      authorRole: entry.authorRole || null
    }));
    authors.push({ authorId, authorRole: role });
    addAuthorToBookBtn.disabled = true;
    try {
      const response = await apiFetch('/book', { method: 'PUT', body: JSON.stringify({ id: bookRecord.id, authors }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (manageAuthorsError) {
          manageAuthorsError.classList.remove('d-none');
          manageAuthorsError.textContent = data.message || 'Unable to add author.';
        }
        warn('Add author failed.', { status: response.status, data });
        return;
      }
      await loadBook();
      await openManageAuthorsModal();
    } catch (error) {
      errorLog('Add author failed.', error);
      if (manageAuthorsError) {
        manageAuthorsError.classList.remove('d-none');
        manageAuthorsError.textContent = 'Unable to add author right now.';
      }
    } finally {
      addAuthorToBookBtn.disabled = false;
    }
  };

  const openManageSeriesModal = async () => {
    if (!bookRecord) return;
    if (manageSeriesError) {
      manageSeriesError.classList.add('d-none');
      manageSeriesError.textContent = '';
    }
    try {
      const series = await loadSeriesList();
      populateSelect(manageSeriesSelect, series, { placeholder: 'Select series', labelKey: 'name', valueKey: 'id', includeEmpty: true });
      renderManageSeriesList(bookRecord.series || []);
      manageSeriesOrder.value = '';
      await showModal(manageSeriesModal, { backdrop: 'static', keyboard: false });
    } catch (error) {
      errorLog('Failed to load series.', error);
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
        <div class="d-flex gap-2">
          <button class="btn btn-link btn-sm p-0" type="button" data-series-edit="${entry.seriesId}">Edit order</button>
          <button class="btn btn-link btn-sm text-danger p-0" type="button" data-series-remove="${entry.seriesId}">Remove</button>
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

  const updateSeriesOrderSummary = (seriesEntry, currentOrder, nextOrder) => {
    if (!seriesOrderSummary || !bookRecord) return;
    const current = currentOrder !== null && currentOrder !== undefined ? String(currentOrder) : 'No order';
    const next = nextOrder !== null && nextOrder !== undefined ? String(nextOrder) : 'No order';
    seriesOrderSummary.textContent = `Changing ${bookRecord.title || 'this book'}'s order in ${seriesEntry.seriesName || 'this series'} from ${current} to ${next}.`;
  };

  const openSeriesOrderModal = (seriesId) => {
    const seriesEntry = (bookRecord?.series || []).find((entry) => entry.seriesId === seriesId);
    if (!seriesEntry) return;
    seriesOrderTarget = { seriesEntry, currentOrder: seriesEntry.bookOrder };
    seriesOrderInput.value = Number.isInteger(seriesEntry.bookOrder) ? String(seriesEntry.bookOrder) : '';
    if (seriesOrderErrorAlert) {
      seriesOrderErrorAlert.classList.add('d-none');
      seriesOrderErrorAlert.textContent = '';
    }
    updateSeriesOrderSummary(seriesEntry, seriesEntry.bookOrder, seriesOrderInput.value ? Number(seriesOrderInput.value) : null);
    showModal(editSeriesOrderModal, { backdrop: 'static', keyboard: false });
  };

  const saveSeriesOrder = async () => {
    if (!seriesOrderTarget || !bookRecord) return;
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
          seriesId: seriesOrderTarget.seriesEntry.seriesId,
          bookId: bookRecord.id,
          bookOrder: nextOrder
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (seriesOrderErrorAlert) {
          seriesOrderErrorAlert.classList.remove('d-none');
          seriesOrderErrorAlert.textContent = data.message || 'Unable to update order.';
        }
        warn('Series order update failed.', { status: response.status, data });
        return;
      }
      await hideModal(editSeriesOrderModal);
      await loadBook();
      await openManageSeriesModal();
    } catch (error) {
      errorLog('Series order update failed.', error);
      if (seriesOrderErrorAlert) {
        seriesOrderErrorAlert.classList.remove('d-none');
        seriesOrderErrorAlert.textContent = 'Unable to update order right now.';
      }
    } finally {
      seriesOrderSaveBtn.disabled = false;
    }
  };

  const openRemoveSeriesModal = (seriesId) => {
    const seriesEntry = (bookRecord?.series || []).find((entry) => entry.seriesId === seriesId);
    if (!seriesEntry) return;
    removeSeriesTarget = seriesEntry;
    if (removeSeriesText) {
      removeSeriesText.textContent = `Removing ${bookRecord.title || 'this book'} from ${seriesEntry.seriesName || 'this series'}.`;
    }
    if (removeSeriesError) {
      removeSeriesError.classList.add('d-none');
      removeSeriesError.textContent = '';
    }
    showModal(removeSeriesModal, { backdrop: 'static', keyboard: false });
  };

  const confirmRemoveSeries = async () => {
    if (!removeSeriesTarget || !bookRecord) return;
    removeSeriesConfirmBtn.disabled = true;
    try {
      const response = await apiFetch('/bookseries/link', {
        method: 'DELETE',
        body: JSON.stringify({ seriesId: removeSeriesTarget.seriesId, bookId: bookRecord.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (removeSeriesError) {
          removeSeriesError.classList.remove('d-none');
          removeSeriesError.textContent = data.message || 'Unable to remove series.';
        }
        warn('Remove series failed.', { status: response.status, data });
        return;
      }
      await hideModal(removeSeriesModal);
      await loadBook();
      await openManageSeriesModal();
    } catch (error) {
      errorLog('Remove series failed.', error);
      if (removeSeriesError) {
        removeSeriesError.classList.remove('d-none');
        removeSeriesError.textContent = 'Unable to remove series right now.';
      }
    } finally {
      removeSeriesConfirmBtn.disabled = false;
    }
  };

  const addSeriesToBook = async () => {
    if (!bookRecord) return;
    const seriesId = manageSeriesSelect?.value ? Number(manageSeriesSelect.value) : null;
    if (!seriesId) {
      if (manageSeriesError) {
        manageSeriesError.classList.remove('d-none');
        manageSeriesError.textContent = 'Select a series to add.';
      }
      return;
    }
    const existing = (bookRecord.series || []).some((entry) => entry.seriesId === seriesId);
    if (existing) {
      if (manageSeriesError) {
        manageSeriesError.classList.remove('d-none');
        manageSeriesError.textContent = 'That series is already linked.';
      }
      return;
    }
    const orderValue = manageSeriesOrder?.value.trim() || '';
    const order = orderValue ? Number(orderValue) : null;
    if (orderValue && (!Number.isInteger(order) || order <= 0)) {
      if (manageSeriesError) {
        manageSeriesError.classList.remove('d-none');
        manageSeriesError.textContent = 'Order must be a positive whole number.';
      }
      return;
    }
    addSeriesToBookBtn.disabled = true;
    try {
      const response = await apiFetch('/bookseries/link', {
        method: 'POST',
        body: JSON.stringify({ seriesId, bookId: bookRecord.id, bookOrder: order })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (manageSeriesError) {
          manageSeriesError.classList.remove('d-none');
          manageSeriesError.textContent = data.message || 'Unable to add series.';
        }
        warn('Add series failed.', { status: response.status, data });
        return;
      }
      await loadBook();
      await openManageSeriesModal();
    } catch (error) {
      errorLog('Add series failed.', error);
      if (manageSeriesError) {
        manageSeriesError.classList.remove('d-none');
        manageSeriesError.textContent = 'Unable to add series right now.';
      }
    } finally {
      addSeriesToBookBtn.disabled = false;
    }
  };

  const renderManageTags = () => {
    clearElement(manageTagsList);
    if (!tagDraft.length) {
      const empty = document.createElement('div');
      empty.className = 'text-muted';
      empty.textContent = 'No tags yet.';
      manageTagsList.appendChild(empty);
      return;
    }
    tagDraft.forEach((tag) => {
      const pill = document.createElement('span');
      pill.className = 'badge rounded-pill bg-white text-dark border px-3 py-2 fs-6 d-flex align-items-center gap-2';
      pill.innerHTML = `<span>${tag}</span><button class="btn btn-sm p-0 text-danger" type="button" data-tag-remove="${tag}">&times;</button>`;
      manageTagsList.appendChild(pill);
    });

    manageTagsList.querySelectorAll('[data-tag-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        const tag = button.getAttribute('data-tag-remove');
        tagDraft = tagDraft.filter((entry) => entry !== tag);
        updateBookTags();
      });
    });
  };

  const openManageTagsModal = () => {
    if (!bookRecord) return;
    tagDraft = (bookRecord.tags || []).map((tag) => tag.name);
    if (manageTagsError) {
      manageTagsError.classList.add('d-none');
      manageTagsError.textContent = '';
    }
    if (manageTagsHelp) manageTagsHelp.textContent = '';
    renderManageTags();
    manageTagsInput.value = '';
    showModal(manageTagsModal, { backdrop: 'static', keyboard: false });
  };

  const updateBookTags = async () => {
    if (!bookRecord) return;
    log('Updating book tags.', { tags: tagDraft });
    try {
      const response = await apiFetch('/book', {
        method: 'PUT',
        body: JSON.stringify({ id: bookRecord.id, tags: tagDraft })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (manageTagsError) {
          manageTagsError.classList.remove('d-none');
          manageTagsError.textContent = data.message || 'Unable to update tags.';
        }
        warn('Tag update failed.', { status: response.status, data });
        return;
      }
      await loadBook();
      renderManageTags();
    } catch (error) {
      errorLog('Tag update failed.', error);
      if (manageTagsError) {
        manageTagsError.classList.remove('d-none');
        manageTagsError.textContent = 'Unable to update tags right now.';
      }
    }
  };

  const addTag = () => {
    const value = manageTagsInput.value.trim();
    if (!value) {
      if (manageTagsHelp) manageTagsHelp.textContent = 'Enter a tag name.';
      return;
    }
    if (tagDraft.includes(value)) {
      if (manageTagsHelp) manageTagsHelp.textContent = 'That tag is already added.';
      return;
    }
    tagDraft.push(value);
    if (manageTagsHelp) manageTagsHelp.textContent = '';
    manageTagsInput.value = '';
    updateBookTags();
  };

  const openCopyModal = async ({ mode, copyId }) => {
    if (!bookRecord) return;
    copyEditTarget = { mode, copyId };
    if (editCopyErrorAlert) {
      editCopyErrorAlert.classList.add('d-none');
      editCopyErrorAlert.textContent = '';
    }
    if (copyLocationHelp) copyLocationHelp.textContent = '';
    if (copyAcquisitionDateHelp) copyAcquisitionDateHelp.textContent = '';
    try {
      const locations = await loadLocationsList();
      populateSelect(copyLocationSelect, locations, { placeholder: 'Select storage location', labelKey: 'path', valueKey: 'id', includeEmpty: true });
    } catch (error) {
      errorLog('Failed to load locations.', error);
    }
    if (mode === 'edit') {
      const copy = (bookRecord.bookCopies || []).find((entry) => entry.id === copyId);
      if (!copy) return;
      copyLocationSelect.value = copy.storageLocationId ? String(copy.storageLocationId) : '';
      copyAcquisitionDate.value = copy.acquisitionDate?.text || '';
      copyAcquiredFrom.value = copy.acquiredFrom || '';
      copyAcquisitionType.value = copy.acquisitionType || '';
      copyAcquisitionLocation.value = copy.acquisitionLocation || '';
      copyAcquisitionStory.value = copy.acquisitionStory || '';
      copyNotes.value = copy.notes || '';
    } else {
      copyLocationSelect.value = '';
      copyAcquisitionDate.value = '';
      copyAcquiredFrom.value = '';
      copyAcquisitionType.value = '';
      copyAcquisitionLocation.value = '';
      copyAcquisitionStory.value = '';
      copyNotes.value = '';
    }
    await showModal(editCopyModal, { backdrop: 'static', keyboard: false });
  };

  const saveCopy = async () => {
    if (!bookRecord || !copyEditTarget) return;
    const locationId = copyLocationSelect?.value ? Number(copyLocationSelect.value) : null;
    if (!locationId) {
      if (copyLocationHelp) copyLocationHelp.textContent = 'Select a storage location.';
      return;
    }
    const dateRaw = copyAcquisitionDate.value.trim();
    if (dateRaw) {
      const parsed = parsePartialDateInput(dateRaw);
      if (parsed.error) {
        if (copyAcquisitionDateHelp) copyAcquisitionDateHelp.textContent = parsed.error;
        return;
      }
    }
    copySaveBtn.disabled = true;
    try {
      const payload = {
        storageLocationId: locationId,
        acquisitionDate: dateRaw ? parsePartialDateInput(dateRaw).value : null,
        acquiredFrom: copyAcquiredFrom.value.trim() || null,
        acquisitionType: copyAcquisitionType.value.trim() || null,
        acquisitionLocation: copyAcquisitionLocation.value.trim() || null,
        acquisitionStory: copyAcquisitionStory.value.trim() || null,
        notes: copyNotes.value.trim() || null
      };
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (editCopyErrorAlert) {
          editCopyErrorAlert.classList.remove('d-none');
          editCopyErrorAlert.textContent = data.message || 'Unable to save copy.';
        }
        warn('Copy save failed.', { status: response.status, data });
        return;
      }
      await hideModal(editCopyModal);
      await loadBook();
    } catch (error) {
      errorLog('Copy save failed.', error);
      if (editCopyErrorAlert) {
        editCopyErrorAlert.classList.remove('d-none');
        editCopyErrorAlert.textContent = 'Unable to save copy right now.';
      }
    } finally {
      copySaveBtn.disabled = false;
    }
  };

  const openDeleteCopyModal = (copyId) => {
    const copies = bookRecord?.bookCopies || [];
    const copy = copies.find((entry) => entry.id === copyId);
    if (!copy) return;
    copyEditTarget = { mode: 'delete', copyId };
    if (deleteCopyText) deleteCopyText.textContent = `Remove copy stored at ${copy.storageLocationPath || 'unknown location'}?`;
    if (deleteCopyErrorAlert) {
      deleteCopyErrorAlert.classList.add('d-none');
      deleteCopyErrorAlert.textContent = '';
    }
    if (deleteCopyConfirmBtn) {
      deleteCopyConfirmBtn.disabled = copies.length <= 1;
      if (copies.length <= 1 && deleteCopyErrorAlert) {
        deleteCopyErrorAlert.classList.remove('d-none');
        deleteCopyErrorAlert.textContent = 'A book must have at least one copy.';
      }
    }
    showModal(deleteCopyModal, { backdrop: 'static', keyboard: false });
  };

  const confirmDeleteCopy = async () => {
    if (!bookRecord || !copyEditTarget || copyEditTarget.mode !== 'delete') return;
    deleteCopyConfirmBtn.disabled = true;
    try {
      const response = await apiFetch('/bookcopy', {
        method: 'DELETE',
        body: JSON.stringify({ id: copyEditTarget.copyId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (deleteCopyErrorAlert) {
          deleteCopyErrorAlert.classList.remove('d-none');
          deleteCopyErrorAlert.textContent = data.message || 'Unable to delete copy.';
        }
        warn('Copy delete failed.', { status: response.status, data });
        return;
      }
      await hideModal(deleteCopyModal);
      await loadBook();
    } catch (error) {
      errorLog('Copy delete failed.', error);
      if (deleteCopyErrorAlert) {
        deleteCopyErrorAlert.classList.remove('d-none');
        deleteCopyErrorAlert.textContent = 'Unable to delete copy right now.';
      }
    } finally {
      deleteCopyConfirmBtn.disabled = false;
    }
  };

  const savePublisher = async () => {
    const name = addPublisherName.value.trim();
    if (!name) {
      setHelpText(addPublisherNameHelp, 'Publisher name is required.', true);
      return;
    }
    clearHelpText(addPublisherNameHelp);
    const foundedRaw = addPublisherFounded.value.trim();
    if (foundedRaw) {
      const parsed = parsePartialDateInput(foundedRaw);
      if (parsed.error) {
        setHelpText(addPublisherFoundedHelp, parsed.error, true);
        return;
      }
      clearHelpText(addPublisherFoundedHelp);
    } else {
      clearHelpText(addPublisherFoundedHelp);
    }
    const websiteRaw = addPublisherWebsite.value.trim();
    if (websiteRaw && !normalizeUrl(websiteRaw)) {
      setHelpText(addPublisherWebsiteHelp, 'Website must be a valid URL.', true);
      return;
    }
    clearHelpText(addPublisherWebsiteHelp);

    const notes = addPublisherNotes.value.trim();
    if (notes.length > 1000) {
      setHelpText(addPublisherNotesHelp, 'Notes must be 1000 characters or fewer.', true);
      return;
    }
    clearHelpText(addPublisherNotesHelp);
    addPublisherSaveBtn.disabled = true;
    try {
      const payload = {
        name,
        foundedDate: foundedRaw ? parsePartialDateInput(foundedRaw).value : null,
        website: websiteRaw ? normalizeUrl(websiteRaw) : null,
        notes: notes || null
      };
      const response = await apiFetch('/publisher', { method: 'POST', body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (addPublisherErrorAlert) {
          addPublisherErrorAlert.classList.remove('d-none');
          addPublisherErrorAlert.textContent = data.message || 'Unable to save publisher.';
        }
        return;
      }
      referenceData.publishers = null;
      await loadPublishers();
      populateSelect(editBookPublisher, referenceData.publishers, { placeholder: 'No publisher', labelKey: 'name', valueKey: 'id', includeEmpty: true });
      editBookPublisher.value = data.data?.id ? String(data.data.id) : '';
      await hideModal(addPublisherModal);
    } catch (error) {
      errorLog('Save publisher failed.', error);
      if (addPublisherErrorAlert) {
        addPublisherErrorAlert.classList.remove('d-none');
        addPublisherErrorAlert.textContent = 'Unable to save publisher right now.';
      }
    } finally {
      addPublisherSaveBtn.disabled = false;
    }
  };

  const saveBookType = async () => {
    const name = addBookTypeName.value.trim();
    if (!name) {
      setHelpText(addBookTypeNameHelp, 'Book type name is required.', true);
      return;
    }
    clearHelpText(addBookTypeNameHelp);
    const desc = addBookTypeDescription.value.trim();
    if (desc.length > 500) {
      setHelpText(addBookTypeDescriptionHelp, 'Description must be 500 characters or fewer.', true);
      return;
    }
    clearHelpText(addBookTypeDescriptionHelp);
    addBookTypeSaveBtn.disabled = true;
    try {
      const response = await apiFetch('/booktype', { method: 'POST', body: JSON.stringify({ name, description: desc || null }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (addBookTypeErrorAlert) {
          addBookTypeErrorAlert.classList.remove('d-none');
          addBookTypeErrorAlert.textContent = data.message || 'Unable to save book type.';
        }
        return;
      }
      referenceData.bookTypes = null;
      await loadBookTypes();
      populateSelect(editBookType, referenceData.bookTypes, { placeholder: 'No book type', labelKey: 'name', valueKey: 'id', includeEmpty: true });
      editBookType.value = data.data?.id ? String(data.data.id) : '';
      await hideModal(addBookTypeModal);
    } catch (error) {
      errorLog('Save book type failed.', error);
      if (addBookTypeErrorAlert) {
        addBookTypeErrorAlert.classList.remove('d-none');
        addBookTypeErrorAlert.textContent = 'Unable to save book type right now.';
      }
    } finally {
      addBookTypeSaveBtn.disabled = false;
    }
  };

  const saveAuthor = async () => {
    const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;
    const displayName = addAuthorDisplayName.value.trim();
    if (!displayName) {
      setHelpText(addAuthorDisplayNameHelp, 'Display Name is required.', true);
      return;
    }
    if (displayName.length < 2 || displayName.length > 150 || !namePattern.test(displayName)) {
      setHelpText(addAuthorDisplayNameHelp, 'Display Name must be 2-150 characters and valid.', true);
      return;
    }
    clearHelpText(addAuthorDisplayNameHelp);

    const firstNames = addAuthorFirstNames.value.trim();
    if (firstNames && (firstNames.length < 2 || firstNames.length > 150 || !namePattern.test(firstNames))) {
      setHelpText(addAuthorFirstNamesHelp, 'First Name(s) must be 2-150 characters and valid.', true);
      return;
    }
    clearHelpText(addAuthorFirstNamesHelp);

    const lastName = addAuthorLastName.value.trim();
    if (lastName && (lastName.length < 2 || lastName.length > 100 || !namePattern.test(lastName))) {
      setHelpText(addAuthorLastNameHelp, 'Last Name must be 2-100 characters and valid.', true);
      return;
    }
    clearHelpText(addAuthorLastNameHelp);

    const birthRaw = addAuthorBirthDate.value.trim();
    if (birthRaw) {
      const parsed = parsePartialDateInput(birthRaw);
      if (parsed.error) {
        setHelpText(addAuthorBirthDateHelp, parsed.error, true);
        return;
      }
      clearHelpText(addAuthorBirthDateHelp);
    } else {
      clearHelpText(addAuthorBirthDateHelp);
    }

    const deathRaw = addAuthorDeathDate.value.trim();
    const deceased = Boolean(addAuthorDeceased.checked);
    if (deathRaw && !deceased) {
      setHelpText(addAuthorDeathDateHelp, 'Mark the author as deceased to set a death date.', true);
      return;
    }
    if (deathRaw) {
      const parsed = parsePartialDateInput(deathRaw);
      if (parsed.error) {
        setHelpText(addAuthorDeathDateHelp, parsed.error, true);
        return;
      }
      clearHelpText(addAuthorDeathDateHelp);
    } else {
      clearHelpText(addAuthorDeathDateHelp);
    }

    const bio = addAuthorBio.value.trim();
    if (bio.length > 1000) {
      setHelpText(addAuthorBioHelp, 'Bio must be 1000 characters or fewer.', true);
      return;
    }
    clearHelpText(addAuthorBioHelp);
    addAuthorSaveBtn.disabled = true;
    try {
      const payload = {
        displayName,
        firstNames: firstNames || null,
        lastName: lastName || null,
        birthDate: birthRaw ? parsePartialDateInput(birthRaw).value : null,
        deceased,
        deathDate: deathRaw ? parsePartialDateInput(deathRaw).value : null,
        bio: bio || null
      };
      const response = await apiFetch('/author', { method: 'POST', body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (addAuthorErrorAlert) {
          addAuthorErrorAlert.classList.remove('d-none');
          addAuthorErrorAlert.textContent = data.message || 'Unable to save author.';
        }
        return;
      }
      referenceData.authors = null;
      await loadAuthorsList();
      populateSelect(manageAuthorsSelect, referenceData.authors, { placeholder: 'Select author', labelKey: 'displayName', valueKey: 'id', includeEmpty: true });
      await hideModal(addAuthorModal);
      manageAuthorsSelect.value = data.data?.id ? String(data.data.id) : '';
    } catch (error) {
      errorLog('Save author failed.', error);
      if (addAuthorErrorAlert) {
        addAuthorErrorAlert.classList.remove('d-none');
        addAuthorErrorAlert.textContent = 'Unable to save author right now.';
      }
    } finally {
      addAuthorSaveBtn.disabled = false;
    }
  };

  const saveSeries = async () => {
    const name = addSeriesName.value.trim();
    if (!name) {
      setHelpText(addSeriesNameHelp, 'Series name is required.', true);
      return;
    }
    if (name.length < 2 || name.length > 150) {
      setHelpText(addSeriesNameHelp, 'Series name must be between 2 and 150 characters.', true);
      return;
    }
    clearHelpText(addSeriesNameHelp);
    const websiteRaw = addSeriesWebsite.value.trim();
    if (websiteRaw && !normalizeUrl(websiteRaw)) {
      setHelpText(addSeriesWebsiteHelp, 'Website must be a valid URL.', true);
      return;
    }
    clearHelpText(addSeriesWebsiteHelp);
    const desc = addSeriesDescription.value.trim();
    if (desc.length > 1000) {
      setHelpText(addSeriesDescriptionHelp, 'Description must be 1000 characters or fewer.', true);
      return;
    }
    clearHelpText(addSeriesDescriptionHelp);
    addSeriesSaveBtn.disabled = true;
    try {
      const response = await apiFetch('/bookseries', {
        method: 'POST',
        body: JSON.stringify({
          name,
          website: websiteRaw ? normalizeUrl(websiteRaw) : null,
          description: desc || null
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (addSeriesErrorAlert) {
          addSeriesErrorAlert.classList.remove('d-none');
          addSeriesErrorAlert.textContent = data.message || 'Unable to save series.';
        }
        return;
      }
      referenceData.series = null;
      await loadSeriesList();
      populateSelect(manageSeriesSelect, referenceData.series, { placeholder: 'Select series', labelKey: 'name', valueKey: 'id', includeEmpty: true });
      manageSeriesSelect.value = data.data?.id ? String(data.data.id) : '';
      await hideModal(addSeriesModal);
    } catch (error) {
      errorLog('Save series failed.', error);
      if (addSeriesErrorAlert) {
        addSeriesErrorAlert.classList.remove('d-none');
        addSeriesErrorAlert.textContent = 'Unable to save series right now.';
      }
    } finally {
      addSeriesSaveBtn.disabled = false;
    }
  };

  const saveLocation = async () => {
    const name = addLocationName.value.trim();
    if (!name) {
      setHelpText(addLocationNameHelp, 'Location name is required.', true);
      return;
    }
    if (name.length < 2 || name.length > 150) {
      setHelpText(addLocationNameHelp, 'Location name must be between 2 and 150 characters.', true);
      return;
    }
    clearHelpText(addLocationNameHelp);
    const parentId = addLocationParent?.value ? Number(addLocationParent.value) : null;
    const notes = addLocationNotes.value.trim();
    if (notes.length > 500) {
      setHelpText(addLocationNotesHelp, 'Notes must be 500 characters or fewer.', true);
      return;
    }
    clearHelpText(addLocationNotesHelp);
    addLocationSaveBtn.disabled = true;
    try {
      const response = await apiFetch('/storagelocation', {
        method: 'POST',
        body: JSON.stringify({ name, parentId, notes: notes || null })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (addLocationErrorAlert) {
          addLocationErrorAlert.classList.remove('d-none');
          addLocationErrorAlert.textContent = data.message || 'Unable to save location.';
        }
        return;
      }
      referenceData.locations = null;
      await loadLocationsList();
      populateSelect(copyLocationSelect, referenceData.locations, { placeholder: 'Select storage location', labelKey: 'path', valueKey: 'id', includeEmpty: true });
      copyLocationSelect.value = data.data?.id ? String(data.data.id) : '';
      populateSelect(addLocationParent, referenceData.locations, { placeholder: 'No parent', labelKey: 'path', valueKey: 'id', includeEmpty: true });
      await hideModal(addLocationModal);
    } catch (error) {
      errorLog('Save location failed.', error);
      if (addLocationErrorAlert) {
        addLocationErrorAlert.classList.remove('d-none');
        addLocationErrorAlert.textContent = 'Unable to save location right now.';
      }
    } finally {
      addLocationSaveBtn.disabled = false;
    }
  };

  const openAddLocationModal = async () => {
    try {
      const locations = await loadLocationsList();
      populateSelect(addLocationParent, locations, { placeholder: 'No parent', labelKey: 'path', valueKey: 'id', includeEmpty: true });
    } catch (error) {
      errorLog('Failed to load locations for parent selection.', error);
    }
    addLocationName.value = '';
    addLocationNotes.value = '';
    addLocationParent.value = '';
    if (addLocationErrorAlert) {
      addLocationErrorAlert.classList.add('d-none');
      addLocationErrorAlert.textContent = '';
    }
    showModal(addLocationModal, { backdrop: 'static', keyboard: false });
  };

  if (editBookBtn) editBookBtn.addEventListener('click', openEditBookModal);
  if (editBookSaveBtn) editBookSaveBtn.addEventListener('click', saveBookEdits);
  if (deleteBookBtn) deleteBookBtn.addEventListener('click', openDeleteBookModal);
  if (deleteBookConfirmBtn) deleteBookConfirmBtn.addEventListener('click', confirmDeleteBook);
  if (manageAuthorsBtn) manageAuthorsBtn.addEventListener('click', openManageAuthorsModal);
  if (manageSeriesBtn) manageSeriesBtn.addEventListener('click', openManageSeriesModal);
  if (manageTagsBtn) manageTagsBtn.addEventListener('click', openManageTagsModal);
  if (addCopyBtn) addCopyBtn.addEventListener('click', () => openCopyModal({ mode: 'create' }));
  if (addAuthorToBookBtn) addAuthorToBookBtn.addEventListener('click', addAuthorToBook);
  if (authorRoleSaveBtn) authorRoleSaveBtn.addEventListener('click', saveAuthorRole);
  if (removeAuthorConfirmBtn) removeAuthorConfirmBtn.addEventListener('click', confirmRemoveAuthor);
  if (addSeriesToBookBtn) addSeriesToBookBtn.addEventListener('click', addSeriesToBook);
  if (seriesOrderSaveBtn) seriesOrderSaveBtn.addEventListener('click', saveSeriesOrder);
  if (removeSeriesConfirmBtn) removeSeriesConfirmBtn.addEventListener('click', confirmRemoveSeries);
  if (addTagBtn) addTagBtn.addEventListener('click', addTag);
  if (copySaveBtn) copySaveBtn.addEventListener('click', saveCopy);
  if (deleteCopyConfirmBtn) deleteCopyConfirmBtn.addEventListener('click', confirmDeleteCopy);
  if (openAddPublisherBtn) openAddPublisherBtn.addEventListener('click', () => showModal(addPublisherModal, { backdrop: 'static', keyboard: false }));
  if (openAddBookTypeBtn) openAddBookTypeBtn.addEventListener('click', () => showModal(addBookTypeModal, { backdrop: 'static', keyboard: false }));
  if (addPublisherSaveBtn) addPublisherSaveBtn.addEventListener('click', savePublisher);
  if (addBookTypeSaveBtn) addBookTypeSaveBtn.addEventListener('click', saveBookType);
  if (openAddAuthorBtn) openAddAuthorBtn.addEventListener('click', () => showModal(addAuthorModal, { backdrop: 'static', keyboard: false }));
  if (addAuthorSaveBtn) addAuthorSaveBtn.addEventListener('click', saveAuthor);
  if (openAddSeriesBtn) openAddSeriesBtn.addEventListener('click', () => showModal(addSeriesModal, { backdrop: 'static', keyboard: false }));
  if (addSeriesSaveBtn) addSeriesSaveBtn.addEventListener('click', saveSeries);
  if (openAddLocationBtn) openAddLocationBtn.addEventListener('click', openAddLocationModal);
  if (addLocationSaveBtn) addLocationSaveBtn.addEventListener('click', saveLocation);

  if (authorRoleInput) {
    authorRoleInput.addEventListener('input', () => {
      if (!authorRoleTarget) return;
      updateAuthorRoleSummary(authorRoleTarget.author, authorRoleTarget.currentRole, authorRoleInput.value.trim());
    });
  }

  if (seriesOrderInput) {
    seriesOrderInput.addEventListener('input', () => {
      if (!seriesOrderTarget) return;
      updateSeriesOrderSummary(seriesOrderTarget.seriesEntry, seriesOrderTarget.currentOrder, seriesOrderInput.value ? Number(seriesOrderInput.value) : null);
    });
  }

  loadBook();
  initializeTooltips();
});
