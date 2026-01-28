// Core Add Book page logic (data loading, selections, and payload building).
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const {
        byId,
        setHelpText,
        clearHelpText,
        setPartialDateHelp,
        parsePartialDateInput,
        isValidUrl,
        normalizeUrl,
        normalizeIsbn,
        ensureHelpText
    } = addBook.utils;
    const log = (...args) => console.log('[Add Book]', ...args);
    if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
        window.pageContentReady.reset();
    }

    const rateLimitGuard = window.rateLimitGuard;

    const selectors = {
        title: byId('twoEdtTitle'),
        subtitle: byId('twoEdtSubtitle'),
        isbn: byId('twoEdtISBN'),
        publicationDate: byId('twoEdtPublicationDate'),
        pages: byId('twoSpnPages'),
        coverUrl: byId('twoEdtBookCoverURL'),
        description: byId('twoRdtBookDescription'),
        bookType: byId('threeCmbBookType'),
        bookTypeHelp: byId('threeBookTypeHelp'),
        bookTypeDesc: byId('threeLblBookTypeDescription'),
        publisher: byId('fiveCmbSelectPublisher'),
        publisherHelp: byId('bookPublisherHelp'),
        publisherFounded: byId('fiveLblPublisherFoundedDate'),
        publisherWebsite: byId('fiveLblPublisherWebsite'),
        publisherNotes: byId('fiveLblPublisherNotes'),
        authorSearch: byId('fourEdtAuthorSearch'),
        authorResults: byId('authorSearchResults'),
        authorSearchHelp: byId('fourAuthorSearchHelp'),
        authorList: byId('selectedAuthorsList'),
        authorPlaceholder: byId('noAuthorsPlaceholder'),
        authorTemplate: byId('liAuthorTemplate'),
        seriesSearch: byId('sixEdtSearchSeries'),
        seriesResults: byId('seriesSearchResults'),
        seriesSearchHelp: byId('sixSeriesSearchHelp'),
        seriesList: byId('selectedSeriesList'),
        seriesPlaceholder: byId('noSeriesPlaceholder'),
        seriesTemplate: byId('liSeriesTemplate'),
        storageLocation: byId('eightCmbLocation'),
        storageLocationHelp: byId('eightBookLocationHelp'),
        storageLocationNotes: byId('eightLblLocationNotes'),
        acquisitionStory: byId('eightRdtStory'),
        acquisitionStoryHelp: byId('bookTitleHelp-2'),
        acquisitionDate: byId('eightEdtAcquisitionDate'),
        acquisitionDateHelp: byId('eightAcquisitioDateHelp'),
        acquiredFrom: byId('eightEdtAcquiredFrom'),
        acquiredFromHelp: byId('eightAcquiredFromHelp'),
        acquisitionType: byId('eightCmbAcquisitionType'),
        acquisitionTypeHelp: byId('eightAcquisitioType'),
        acquisitionLocation: byId('eightEdtAcquisitionLocation'),
        acquisitionLocationHelp: byId('eightAcquisitionLocationHelp'),
        copyNotes: byId('eightRdtOtherNotes'),
        copyNotesHelp: byId('bookTitleHelp-1'),
        publicationDateHelp: byId('twoPublicationDateHelp'),
        titleHelp: byId('twoTitleHelp'),
        subtitleHelp: byId('twoSubtitleHelp'),
        isbnHelp: byId('twoISBNHelp'),
        pagesHelp: byId('twoPagesHelp'),
        coverUrlHelp: byId('twoBookCoverURLHelp'),
        descriptionHelp: byId('twoBookDescriptionHelp'),
        pageTitle: byId('addBookPageTitle'),
        pageLead: byId('addBookPageLead'),
        breadcrumbCurrent: byId('addBookBreadcrumbCurrent'),
        isbnLookupCard: byId('lookupByISBNCard'),
        reviewButton: byId('reviewAddBookBtn'),
        reviewModalTitle: byId('reviewAddBookModalTitle'),
        confirmButtonLabel: byId('confirmAddBookLabel'),
        editCopyNotice: byId('editCopyNotice'),
        editCopyNoticeLink: byId('editCopyNoticeLink'),
        editLoadError: byId('editBookLoadError'),
        editCopyUnavailableAlert: byId('editCopyUnavailableAlert'),
        editCopyUnavailableLink: byId('editCopyUnavailableLink'),
        bookCopyCard: byId('bookCopyDetailsCard'),
        invalidEditModal: byId('invalidEditBookModal'),
        invalidEditModalMessage: byId('invalidEditBookModalMessage'),
        invalidEditModalConfirm: byId('invalidEditBookModalConfirm')
    };

    selectors.titleHelp = ensureHelpText(selectors.title, 'twoTitleHelp');
    selectors.subtitleHelp = ensureHelpText(selectors.subtitle, 'twoSubtitleHelp');
    selectors.isbnHelp = ensureHelpText(selectors.isbn, 'twoISBNHelp');
    selectors.pagesHelp = ensureHelpText(selectors.pages, 'twoPagesHelp');
    selectors.coverUrlHelp = ensureHelpText(selectors.coverUrl, 'twoBookCoverURLHelp');
    selectors.descriptionHelp = ensureHelpText(selectors.description, 'twoBookDescriptionHelp');
    selectors.publicationDateHelp = ensureHelpText(selectors.publicationDate, 'twoPublicationDateHelp');
    selectors.acquisitionDateHelp = ensureHelpText(selectors.acquisitionDate, 'eightAcquisitioDateHelp');
    selectors.acquiredFromHelp = ensureHelpText(selectors.acquiredFrom, 'eightAcquiredFromHelp');
    selectors.acquisitionLocationHelp = ensureHelpText(selectors.acquisitionLocation, 'eightAcquisitionLocationHelp');
    selectors.acquisitionStoryHelp = ensureHelpText(selectors.acquisitionStory, 'bookTitleHelp-2');
    selectors.copyNotesHelp = ensureHelpText(selectors.copyNotes, 'bookTitleHelp-1');

    const authorTemplate = selectors.authorTemplate ? selectors.authorTemplate.cloneNode(true) : null;
    if (selectors.authorTemplate) {
        selectors.authorTemplate.remove();
    }

    const seriesTemplate = selectors.seriesTemplate ? selectors.seriesTemplate.cloneNode(true) : null;
    if (selectors.seriesTemplate) {
        selectors.seriesTemplate.remove();
    }

    const patterns = {
        title: /^[\p{L}0-9 .,'":;!?()&\/-]+$/u,
        subtitle: /^[\p{L}0-9 .,'":;!?()&\/-]+$/u,
        acquisitionType: /^[\p{L}0-9 .,'":;!?()&\/-]+$/u,
        personText: /^[\p{L}0-9 .,'":;!?()&\/-]+$/u,
        authorRole: /^[\p{L}0-9 .,'":;!?()&\/-]+$/u
    };

    const editState = addBook.state.edit || (addBook.state.edit = { enabled: false, bookId: null, copyId: null });
    const authorRoleOptions = new Set(['Author', 'Editor', 'Illustrator', 'Translator', 'Other']);

    function triggerInput(el) {
        if (!el) return;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function refreshInlineHelp() {
        const title = selectors.title.value.trim();
        if (!title) {
            setHelpText(selectors.titleHelp, 'This field is required.', true);
        } else if (title.length < 2 || title.length > 255) {
            setHelpText(selectors.titleHelp, 'Title must be between 2 and 255 characters.', true);
        } else if (!patterns.title.test(title)) {
            setHelpText(selectors.titleHelp, 'Title contains unsupported characters.', true);
        } else {
            clearHelpText(selectors.titleHelp);
        }

        const subtitle = selectors.subtitle.value.trim();
        if (!subtitle) {
            clearHelpText(selectors.subtitleHelp);
        } else if (subtitle.length > 255) {
            setHelpText(selectors.subtitleHelp, 'Subtitle must be 255 characters or fewer.', true);
        } else if (!patterns.subtitle.test(subtitle)) {
            setHelpText(selectors.subtitleHelp, 'Subtitle contains unsupported characters.', true);
        } else {
            clearHelpText(selectors.subtitleHelp);
        }

        const rawIsbn = selectors.isbn.value.trim();
        if (!rawIsbn) {
            clearHelpText(selectors.isbnHelp);
        } else {
            const normalized = normalizeIsbn(rawIsbn);
            if (!normalized) {
                setHelpText(selectors.isbnHelp, 'ISBN must be a valid ISBN-10 or ISBN-13 using digits and optional X (last character for ISBN-10).', true);
            } else {
                setHelpText(selectors.isbnHelp, `This ISBN will be stored as: ${normalized}`, false);
            }
        }

        const pagesRaw = selectors.pages.value.trim();
        if (!pagesRaw) {
            clearHelpText(selectors.pagesHelp);
        } else {
            const numeric = Number.parseInt(pagesRaw, 10);
            if (!Number.isInteger(numeric) || numeric < 1 || numeric > 10000) {
                setHelpText(selectors.pagesHelp, 'Number of pages must be between 1 and 10000.', true);
            } else {
                clearHelpText(selectors.pagesHelp);
            }
        }

        const coverRaw = selectors.coverUrl.value.trim();
        if (!coverRaw) {
            clearHelpText(selectors.coverUrlHelp);
        } else if (!normalizeUrl(coverRaw)) {
            setHelpText(selectors.coverUrlHelp, 'Book cover URL must be a valid URL starting with http:// or https://', true);
        } else {
            clearHelpText(selectors.coverUrlHelp);
        }

        const description = selectors.description.value.trim();
        if (!description) {
            clearHelpText(selectors.descriptionHelp);
        } else if (description.length > 2000) {
            setHelpText(selectors.descriptionHelp, 'Description must be 2000 characters or fewer.', true);
        } else {
            clearHelpText(selectors.descriptionHelp);
        }

        setPartialDateHelp(selectors.publicationDate, selectors.publicationDateHelp);
        setPartialDateHelp(selectors.acquisitionDate, selectors.acquisitionDateHelp);
    }

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

    const showInvalidEditModal = async (message) => {
        if (selectors.invalidEditModalMessage) {
            selectors.invalidEditModalMessage.textContent = message || 'We couldn’t find that book. Please return to your books list and try again.';
        }
        await hideModal('pageLoadingModal');
        await showModal(selectors.invalidEditModal, { backdrop: 'static', keyboard: false });
    };

    function getEditBookParam() {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('id') || params.get('bookId');
        if (!raw) return { raw: null, id: null };
        const parsed = Number.parseInt(raw, 10);
        const id = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        return { raw, id };
    }

    function isEditMode() {
        return editState.enabled && Number.isInteger(editState.bookId);
    }

    function applyEditModeUI() {
        if (!isEditMode()) return;
        if (selectors.isbnLookupCard) {
            selectors.isbnLookupCard.classList.add('d-none');
        }
        const detailTitle = document.querySelector('#bookDetailsCard .card-title');
        const typeTitle = document.querySelector('#bookBookTypeCard .card-title');
        const authorsTitle = document.querySelector('#bookAuthorsCard .card-title');
        const publisherTitle = document.querySelector('#bookPublishersCard .card-title');
        const seriesTitle = document.querySelector('#bookSeriesCard .card-title');
        const tagsTitle = document.querySelector('#bookTagsCard .card-title');
        if (detailTitle) detailTitle.textContent = 'Step 1: Enter Book Details';
        if (typeTitle) typeTitle.textContent = 'Step 2: Select Book Type';
        if (authorsTitle) authorsTitle.textContent = 'Step 3: Add Book Authors';
        if (publisherTitle) publisherTitle.textContent = 'Step 4: Add Book Publisher';
        if (seriesTitle) seriesTitle.textContent = 'Step 5: Add Book Series';
        if (tagsTitle) tagsTitle.textContent = 'Step 6: Add Book Tags';

        if (selectors.pageTitle) {
            selectors.pageTitle.textContent = 'Edit Book';
        }
        if (selectors.pageLead) {
            selectors.pageLead.textContent = 'Update the details for this book in your collection.';
        }
        if (selectors.breadcrumbCurrent) {
            selectors.breadcrumbCurrent.textContent = 'Edit Book';
        }
        if (selectors.reviewButton) {
            selectors.reviewButton.textContent = 'Review and Save Changes';
        }
        if (selectors.reviewModalTitle) {
            selectors.reviewModalTitle.textContent = 'Review Book Changes';
        }
        if (selectors.confirmButtonLabel) {
            selectors.confirmButtonLabel.textContent = 'Confirm and Save Changes';
        }
        if (selectors.editCopyNotice) {
            selectors.editCopyNotice.classList.remove('d-none');
        }
        if (selectors.editCopyNoticeLink && editState.bookId) {
            selectors.editCopyNoticeLink.href = `book-details?id=${editState.bookId}`;
        }
        if (selectors.editCopyUnavailableAlert) {
            selectors.editCopyUnavailableAlert.classList.remove('d-none');
        }
        if (selectors.editCopyUnavailableLink && editState.bookId) {
            selectors.editCopyUnavailableLink.href = `book-details?id=${editState.bookId}`;
        }
        if (selectors.bookCopyCard) {
            selectors.bookCopyCard.classList.add('d-none');
        }
    }

    function showEditLoadError() {
        if (selectors.editLoadError) {
            selectors.editLoadError.classList.remove('d-none');
        }
        if (selectors.reviewButton) {
            selectors.reviewButton.disabled = true;
        }
    }

    function mapAuthorRole(role) {
        if (!role) return { role: null, customRole: '' };
        if (authorRoleOptions.has(role)) {
            return { role, customRole: '' };
        }
        return { role: 'Other', customRole: role };
    }

    const editParam = getEditBookParam();
    const initialEditId = editParam.id;
    const invalidEditParam = Boolean(editParam.raw) && !Number.isInteger(initialEditId);
    if (Number.isInteger(initialEditId)) {
        editState.enabled = true;
        editState.bookId = initialEditId;
    }

    if (selectors.invalidEditModalConfirm) {
        selectors.invalidEditModalConfirm.addEventListener('click', () => {
            window.location.href = 'books';
        });
    }

    function renderBookTypes() {
        if (!selectors.bookType) return;
        selectors.bookType.innerHTML = '<option value="none" selected>Select book type...</option>';
        if (addBook.state.bookTypes.length === 0) {
            selectors.bookType.disabled = true;
            setHelpText(selectors.bookTypeHelp, 'No book types available. Please add a new book type.', true);
            selectors.bookTypeDesc.textContent = 'No Book Type selected.';
            selectors.bookTypeDesc?.parentElement?.classList.add('d-none');
            log('Book types loaded: none available.');
            return;
        }
        selectors.bookType.disabled = false;
        clearHelpText(selectors.bookTypeHelp);
        addBook.state.bookTypes.forEach((type) => {
            const option = document.createElement('option');
            option.value = String(type.id);
            option.textContent = type.name;
            selectors.bookType.appendChild(option);
        });
        updateBookTypeDisplay();
        log('Book types loaded:', addBook.state.bookTypes.length);
    }

    function updateBookTypeDisplay() {
        const selectedId = selectors.bookType.value;
        if (!selectedId || selectedId === 'none') {
            addBook.state.selections.bookTypeId = null;
            selectors.bookTypeDesc.textContent = 'No Book Type selected.';
            if (selectors.bookTypeDesc?.parentElement) {
                selectors.bookTypeDesc.parentElement.classList.add('d-none');
            }
            log('Book type cleared.');
            return;
        }
        addBook.state.selections.bookTypeId = Number.parseInt(selectedId, 10);
        const type = addBook.state.bookTypes.find((entry) => String(entry.id) === selectedId);
        selectors.bookTypeDesc.textContent = type && type.description ? type.description : 'No description available.';
        if (selectors.bookTypeDesc?.parentElement) {
            selectors.bookTypeDesc.parentElement.classList.remove('d-none');
        }
        log('Book type selected:', type || selectedId);
    }

    function renderPublishers() {
        if (!selectors.publisher) return;
        selectors.publisher.innerHTML = '<option value="none" selected>Select publisher...</option>';
        if (addBook.state.publishers.length === 0) {
            selectors.publisher.disabled = true;
            setHelpText(selectors.publisherHelp, 'No publishers available. Please add a new publisher.', true);
            selectors.publisherFounded.textContent = 'No Publisher selected.';
            selectors.publisherWebsite.textContent = 'No Publisher selected.';
            selectors.publisherNotes.textContent = 'No Publisher selected.';
            selectors.publisherFounded?.parentElement?.classList.add('d-none');
            log('Publishers loaded: none available.');
            return;
        }
        selectors.publisher.disabled = false;
        clearHelpText(selectors.publisherHelp);
        addBook.state.publishers.forEach((publisher) => {
            const option = document.createElement('option');
            option.value = String(publisher.id);
            option.textContent = publisher.name;
            selectors.publisher.appendChild(option);
        });
        updatePublisherDisplay();
        log('Publishers loaded:', addBook.state.publishers.length);
    }

    function updatePublisherDisplay() {
        const selectedId = selectors.publisher.value;
        if (!selectedId || selectedId === 'none') {
            addBook.state.selections.publisherId = null;
            selectors.publisherFounded.textContent = 'No Publisher selected.';
            selectors.publisherWebsite.textContent = 'No Publisher selected.';
            selectors.publisherNotes.textContent = 'No Publisher selected.';
            if (selectors.publisherFounded?.parentElement) {
                selectors.publisherFounded.parentElement.classList.add('d-none');
            }
            log('Publisher cleared.');
            return;
        }
        addBook.state.selections.publisherId = Number.parseInt(selectedId, 10);
        const publisher = addBook.state.publishers.find((entry) => String(entry.id) === selectedId);
        selectors.publisherFounded.textContent = publisher?.foundedDate?.text || 'No founded date provided.';
        const websiteValue = publisher?.website || '';
        const normalizedWebsite = websiteValue ? normalizeUrl(websiteValue) : null;
        if (normalizedWebsite) {
            selectors.publisherWebsite.innerHTML = `<a href="${normalizedWebsite}" target="_blank" rel="noopener">${normalizedWebsite}</a>`;
        } else {
            selectors.publisherWebsite.textContent = websiteValue || 'No website provided.';
        }
        selectors.publisherNotes.textContent = publisher?.notes || 'No notes provided.';
        if (selectors.publisherFounded?.parentElement) {
            selectors.publisherFounded.parentElement.classList.remove('d-none');
        }
        log('Publisher selected:', publisher || selectedId);
    }

    function renderLocations() {
        if (!selectors.storageLocation) return;
        selectors.storageLocation.innerHTML = '<option value="none" selected>Select storage location...</option>';
        if (addBook.state.locations.length === 0) {
            selectors.storageLocation.disabled = true;
            setHelpText(selectors.storageLocationHelp, 'No storage locations available. Please add a new storage location.', true);
            selectors.storageLocationNotes.textContent = 'No storage location selected.';
            selectors.storageLocationNotes?.parentElement?.classList.add('d-none');
            log('Storage locations loaded: none available.');
            return;
        }
        selectors.storageLocation.disabled = false;
        clearHelpText(selectors.storageLocationHelp);
        addBook.state.locations.forEach((location) => {
            const option = document.createElement('option');
            option.value = String(location.id);
            option.textContent = location.path || location.name;
            selectors.storageLocation.appendChild(option);
        });
        log('Storage locations loaded:', addBook.state.locations.length);
        updateLocationDisplay();
    }

    function updateLocationDisplay() {
        const selectedId = selectors.storageLocation.value;
        if (!selectedId || selectedId === 'none') {
            addBook.state.selections.storageLocationId = null;
            addBook.state.selections.storageLocationPath = null;
            selectors.storageLocationNotes.textContent = 'No storage location selected.';
            selectors.storageLocationNotes?.parentElement?.classList.add('d-none');
            log('Storage location cleared.');
            return;
        }
        const location = addBook.state.locations.find((entry) => String(entry.id) === selectedId);
        addBook.state.selections.storageLocationId = Number.parseInt(selectedId, 10);
        addBook.state.selections.storageLocationPath = location?.path || null;
        selectors.storageLocationNotes.textContent = location?.notes || 'No notes provided.';
        selectors.storageLocationNotes?.parentElement?.classList.remove('d-none');
        log('Storage location selected:', location || selectedId);
    }

    function renderAuthors() {
        if (!selectors.authorList || !authorTemplate) return;
        selectors.authorList.innerHTML = '';
        if (addBook.state.selections.authors.length === 0) {
            const placeholder = document.createElement('li');
            placeholder.className = 'list-group-item';
            placeholder.id = 'noAuthorsPlaceholder';
            placeholder.textContent = 'No authors selected yet.';
            selectors.authorList.appendChild(placeholder);
            log('Rendered authors: none selected.');
            updateAuthorSearchAvailability();
            return;
        }

        addBook.state.selections.authors.forEach((author) => {
            const li = authorTemplate.cloneNode(true);
            li.id = '';
            const nameEl = li.querySelector('strong');
            const roleSelect = li.querySelector('select');
            const otherRoleInput = li.querySelector('input');
            const removeBtn = li.querySelector('button.btn-close');

            if (nameEl) {
                nameEl.textContent = author.displayName;
                nameEl.removeAttribute('id');
            }
            if (roleSelect) {
                roleSelect.removeAttribute('id');
                roleSelect.id = `authorRole-${author.id}`;
                roleSelect.name = `authorRole-${author.id}`;
                roleSelect.value = author.role || 'none';
                roleSelect.addEventListener('change', () => {
                    author.role = roleSelect.value === 'none' ? null : roleSelect.value;
                    if (author.role !== 'Other') {
                        author.customRole = '';
                        if (otherRoleInput) {
                            otherRoleInput.value = '';
                            otherRoleInput.closest('.input-group')?.classList.add('d-none');
                        }
                        const helpEl = li.querySelector('.author-role-help');
                        helpEl?.classList.add('d-none');
                    } else {
                        otherRoleInput?.closest('.input-group')?.classList.remove('d-none');
                    }
                });
            }
            if (otherRoleInput) {
                otherRoleInput.removeAttribute('id');
                otherRoleInput.id = `authorOtherRole-${author.id}`;
                otherRoleInput.name = `authorOtherRole-${author.id}`;
                otherRoleInput.value = author.customRole || '';
                otherRoleInput.closest('.input-group')?.classList.toggle('d-none', author.role !== 'Other');
                let helpEl = li.querySelector('.author-role-help');
                if (!helpEl) {
                    helpEl = document.createElement('small');
                    helpEl.className = 'form-text text-danger d-none author-role-help';
                    otherRoleInput.closest('.col-12')?.appendChild(helpEl);
                }
                otherRoleInput.addEventListener('input', () => {
                    author.customRole = otherRoleInput.value.trim();
                    if (!author.customRole) {
                        helpEl.classList.add('d-none');
                        return;
                    }
                    if (author.customRole.length < 2 || author.customRole.length > 100 || !patterns.authorRole.test(author.customRole)) {
                        helpEl.textContent = 'Custom role must be 2-100 characters and use letters, numbers, and basic punctuation.';
                        helpEl.classList.remove('d-none');
                    } else {
                        helpEl.classList.add('d-none');
                    }
                });
                helpEl.classList.add('d-none');
            }
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    addBook.state.selections.authors = addBook.state.selections.authors.filter((entry) => entry.id !== author.id);
                    renderAuthors();
                });
            }
            selectors.authorList.appendChild(li);
        });
        log('Rendered authors:', addBook.state.selections.authors.length);
        updateAuthorSearchAvailability();
    }

    function renderSeries() {
        if (!selectors.seriesList || !seriesTemplate) return;
        selectors.seriesList.innerHTML = '';
        if (addBook.state.selections.series.length === 0) {
            const placeholder = document.createElement('li');
            placeholder.className = 'list-group-item';
            placeholder.id = 'noSeriesPlaceholder';
            placeholder.textContent = 'No series selected yet.';
            selectors.seriesList.appendChild(placeholder);
            log('Rendered series: none selected.');
            updateSeriesSearchAvailability();
            return;
        }

        addBook.state.selections.series.forEach((series) => {
            const li = seriesTemplate.cloneNode(true);
            li.id = '';
            const nameEl = li.querySelector('strong');
            const orderInput = li.querySelector('input');
            const removeBtn = li.querySelector('button.btn-close');

            if (nameEl) {
                nameEl.textContent = series.name;
                nameEl.removeAttribute('id');
            }
            if (orderInput) {
                orderInput.removeAttribute('id');
                orderInput.id = `seriesOrder-${series.id}`;
                orderInput.name = `seriesOrder-${series.id}`;
                orderInput.value = series.order || '';
                orderInput.addEventListener('input', () => {
                    const value = orderInput.value.trim();
                    const orderHelp = li.querySelector('.series-order-help');
                    if (!value) {
                        series.order = null;
                        orderHelp?.classList.add('d-none');
                        return;
                    }
                    const numeric = Number.parseInt(value, 10);
                    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 10000) {
                        if (orderHelp) {
                            orderHelp.textContent = 'Series order must be a whole number between 1 and 10000.';
                            orderHelp.classList.remove('d-none');
                        }
                        series.order = null;
                        return;
                    }
                    if (orderHelp) {
                        orderHelp.classList.add('d-none');
                    }
                    series.order = numeric;
                });
                let orderHelp = li.querySelector('.series-order-help');
                if (!orderHelp) {
                    orderHelp = document.createElement('small');
                    orderHelp.className = 'form-text text-danger d-none series-order-help';
                    orderInput.closest('.col-12')?.appendChild(orderHelp);
                }
            }
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    addBook.state.selections.series = addBook.state.selections.series.filter((entry) => entry.id !== series.id);
                    renderSeries();
                });
            }
            selectors.seriesList.appendChild(li);
        });
        log('Rendered series:', addBook.state.selections.series.length);
        updateSeriesSearchAvailability();
    }

    function showSearchResults(container, items, onSelect) {
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
    }

    function hideSearchResults(container) {
        if (!container) return;
        container.classList.add('d-none');
        container.innerHTML = '';
    }

    function selectFirstResult(container) {
        if (!container || container.classList.contains('d-none')) return false;
        const first = container.querySelector('button');
        if (!first) return false;
        first.click();
        return true;
    }

    function handleAuthorSearch() {
        const query = selectors.authorSearch.value.trim().toLowerCase();
        if (!query) {
            hideSearchResults(selectors.authorResults);
            return;
        }
        const results = addBook.state.authors
            .filter((author) => !addBook.state.selections.authors.some((selected) => selected.id === author.id))
            .filter((author) => author.displayName.toLowerCase().includes(query));
        showSearchResults(selectors.authorResults, results, (author) => {
            addBook.state.selections.authors.push({ id: author.id, displayName: author.displayName, role: null, customRole: '' });
            selectors.authorSearch.value = '';
            hideSearchResults(selectors.authorResults);
            renderAuthors();
            log('Author added from search:', author);
        });
    }

    function setSearchDisabled(input, helpEl, disabled, message) {
        if (!input) return;
        input.disabled = disabled;
        if (disabled) {
            setHelpText(helpEl, message, true);
        } else {
            clearHelpText(helpEl);
        }
    }

    function updateAuthorSearchAvailability() {
        const total = addBook.state.authors.length;
        const selected = addBook.state.selections.authors.length;
        if (!total) {
            setSearchDisabled(selectors.authorSearch, selectors.authorSearchHelp, true, 'No authors available yet. Add a new author to begin.');
            return;
        }
        if (selected >= total) {
            setSearchDisabled(selectors.authorSearch, selectors.authorSearchHelp, true, 'All available authors have been added.');
            return;
        }
        setSearchDisabled(selectors.authorSearch, selectors.authorSearchHelp, false, '');
    }

    function updateSeriesSearchAvailability() {
        const total = addBook.state.series.length;
        const selected = addBook.state.selections.series.length;
        if (!total) {
            setSearchDisabled(selectors.seriesSearch, selectors.seriesSearchHelp, true, 'No series available yet. Add a new series to begin.');
            return;
        }
        if (selected >= total) {
            setSearchDisabled(selectors.seriesSearch, selectors.seriesSearchHelp, true, 'All available series have been added.');
            return;
        }
        setSearchDisabled(selectors.seriesSearch, selectors.seriesSearchHelp, false, '');
    }

    function handleSeriesSearch() {
        const query = selectors.seriesSearch.value.trim().toLowerCase();
        if (!query) {
            hideSearchResults(selectors.seriesResults);
            return;
        }
        const results = addBook.state.series
            .filter((series) => !addBook.state.selections.series.some((selected) => selected.id === series.id))
            .filter((series) => series.name.toLowerCase().includes(query));
        showSearchResults(selectors.seriesResults, results, (series) => {
            addBook.state.selections.series.push({ id: series.id, name: series.name, order: null });
            selectors.seriesSearch.value = '';
            hideSearchResults(selectors.seriesResults);
            renderSeries();
            log('Series added from search:', series);
        });
    }

    async function loadLanguages() {
        log('Loading languages...');
        const response = await apiFetch('/languages', { method: 'GET' });
        if (response.status === 429) {
            rateLimitGuard?.record(response);
            return false;
        }
        const data = await response.json().catch(() => ({}));
        addBook.state.languages.all = response.ok ? (data.data?.languages || []) : [];
        addBook.events.dispatchEvent(new CustomEvent('languages:loaded', { detail: addBook.state.languages.all }));
        log('Languages loaded:', addBook.state.languages.all.length);
        if (!response.ok) {
            log('Languages failed to load:', response.status);
        }
        return response.ok;
    }

    async function loadBookTypes() {
        log('Loading book types...');
        const response = await apiFetch('/booktype', { method: 'GET' });
        if (response.status === 429) {
            rateLimitGuard?.record(response);
            return false;
        }
        const data = await response.json().catch(() => ({}));
        addBook.state.bookTypes = response.ok ? (data.data?.bookTypes || []) : [];
        renderBookTypes();
        if (!response.ok) {
            log('Book types failed to load:', response.status);
        }
        return response.ok;
    }

    async function loadPublishers() {
        log('Loading publishers...');
        const response = await apiFetch('/publisher', { method: 'GET' });
        if (response.status === 429) {
            rateLimitGuard?.record(response);
            return false;
        }
        const data = await response.json().catch(() => ({}));
        addBook.state.publishers = response.ok ? (data.data?.publishers || []) : [];
        renderPublishers();
        if (!response.ok) {
            log('Publishers failed to load:', response.status);
        }
        return response.ok;
    }

    async function loadAuthors() {
        log('Loading authors...');
        const response = await apiFetch('/author/list', {
            method: 'POST',
            body: JSON.stringify({ sortBy: 'displayName', order: 'asc', limit: 200 })
        });
        if (response.status === 429) {
            rateLimitGuard?.record(response);
            return false;
        }
        const data = await response.json().catch(() => ({}));
        addBook.state.authors = response.ok ? (data.data?.authors || []) : [];
        updateAuthorSearchAvailability();
        log('Authors loaded:', addBook.state.authors.length);
        if (!response.ok) {
            log('Authors failed to load:', response.status);
        }
        return response.ok;
    }

    async function loadSeries() {
        log('Loading series...');
        const response = await apiFetch('/bookseries/list', {
            method: 'POST',
            body: JSON.stringify({ sortBy: 'name', order: 'asc', limit: 200 })
        });
        if (response.status === 429) {
            rateLimitGuard?.record(response);
            return false;
        }
        const data = await response.json().catch(() => ({}));
        addBook.state.series = response.ok ? (data.data?.series || []) : [];
        updateSeriesSearchAvailability();
        log('Series loaded:', addBook.state.series.length);
        if (!response.ok) {
            log('Series failed to load:', response.status);
        }
        return response.ok;
    }

    async function loadLocations() {
        log('Loading storage locations...');
        const response = await apiFetch('/storagelocation/list', {
            method: 'POST',
            body: JSON.stringify({ sortBy: 'path', order: 'asc', limit: 200 })
        });
        if (response.status === 429) {
            rateLimitGuard?.record(response);
            return false;
        }
        const data = await response.json().catch(() => ({}));
        addBook.state.locations = response.ok ? (data.data?.storageLocations || []) : [];
        renderLocations();
        addBook.events.dispatchEvent(new CustomEvent('locations:loaded', { detail: addBook.state.locations }));
        if (!response.ok) {
            log('Storage locations failed to load:', response.status);
        }
        return response.ok;
    }

    function applyBookToForm(book) {
        if (!book) return;
        selectors.title.value = book.title || '';
        selectors.subtitle.value = book.subtitle || '';
        selectors.isbn.value = book.isbn || '';
        selectors.publicationDate.value = book.publicationDate?.text || '';
        selectors.pages.value = Number.isInteger(book.pageCount) ? String(book.pageCount) : '';
        selectors.coverUrl.value = book.coverImageUrl || '';
        selectors.description.value = book.description || '';

        const bookTypeId = book.bookType?.id ?? book.bookTypeId ?? null;
        addBook.state.selections.bookTypeId = Number.isInteger(bookTypeId) ? bookTypeId : null;
        if (selectors.bookType) {
            selectors.bookType.value = addBook.state.selections.bookTypeId ? String(addBook.state.selections.bookTypeId) : 'none';
            updateBookTypeDisplay();
        }

        const publisherId = book.publisher?.id ?? book.publisherId ?? null;
        addBook.state.selections.publisherId = Number.isInteger(publisherId) ? publisherId : null;
        if (selectors.publisher) {
            selectors.publisher.value = addBook.state.selections.publisherId ? String(addBook.state.selections.publisherId) : 'none';
            updatePublisherDisplay();
        }

        const authors = (book.authors || []).map((author) => {
            const mapped = mapAuthorRole(author.authorRole ?? author.role ?? null);
            return {
                id: author.authorId ?? author.id,
                displayName: author.authorName ?? author.displayName ?? 'Unknown Author',
                role: mapped.role,
                customRole: mapped.customRole
            };
        }).filter((author) => Number.isInteger(author.id));
        addBook.state.selections.authors = authors;
        renderAuthors();

        const series = (book.series || []).map((entry) => {
            const seriesId = entry.seriesId ?? entry.id;
            if (!Number.isInteger(seriesId)) return null;
            return {
                id: seriesId,
                name: entry.seriesName ?? entry.name ?? 'Unknown Series',
                order: Number.isInteger(entry.bookOrder) ? entry.bookOrder : null
            };
        }).filter(Boolean);
        addBook.state.selections.series = series;
        renderSeries();

        const tags = (book.tags || [])
            .map((tag) => (typeof tag === 'string' ? tag : tag?.name))
            .filter(Boolean);
        addBook.state.selections.tags = tags;
        addBook.events.dispatchEvent(new CustomEvent('tags:updated', { detail: tags }));

        const languages = (book.languages || []).map((lang) => {
            if (!lang || !Number.isInteger(lang.id)) return null;
            return addBook.state.languages.all.find((entry) => entry.id === lang.id) || lang;
        }).filter(Boolean);
        addBook.state.languages.selected = languages;
        addBook.events.dispatchEvent(new CustomEvent('languages:updated', { detail: languages }));

        const copies = Array.isArray(book.bookCopies) ? book.bookCopies : [];
        const firstCopy = copies.length > 0 ? copies[0] : null;
        editState.copyId = firstCopy?.id ?? null;
        selectors.acquisitionStory.value = firstCopy?.acquisitionStory || '';
        selectors.acquisitionDate.value = firstCopy?.acquisitionDate?.text || '';
        selectors.acquiredFrom.value = firstCopy?.acquiredFrom || '';
        selectors.acquisitionType.value = firstCopy?.acquisitionType || 'none';
        selectors.acquisitionLocation.value = firstCopy?.acquisitionLocation || '';
        selectors.copyNotes.value = firstCopy?.notes || '';

        if (firstCopy?.storageLocationId && selectors.storageLocation) {
            selectors.storageLocation.value = String(firstCopy.storageLocationId);
        } else if (selectors.storageLocation) {
            selectors.storageLocation.value = 'none';
        }
        updateLocationDisplay();
        if (firstCopy?.storageLocationPath && !addBook.state.selections.storageLocationPath) {
            addBook.state.selections.storageLocationPath = firstCopy.storageLocationPath;
        }

        refreshInlineHelp();
        triggerInput(selectors.title);
        triggerInput(selectors.subtitle);
        triggerInput(selectors.isbn);
        triggerInput(selectors.pages);
        triggerInput(selectors.coverUrl);
        triggerInput(selectors.description);
        triggerInput(selectors.publicationDate);
        triggerInput(selectors.acquisitionDate);
    }

    async function loadBookForEdit() {
        if (!isEditMode()) return true;
        log('Loading book for edit:', editState.bookId);
        try {
            const response = await apiFetch(`/book?id=${editState.bookId}`, { method: 'GET' });
            if (response.status === 429) {
                rateLimitGuard?.record(response);
                return false;
            }
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                log('Failed to load book for edit:', response.status, data);
                if (response.status === 404) {
                    await showInvalidEditModal('We couldn’t find that book. Please return to your books list and try again.');
                } else {
                    showEditLoadError();
                }
                return false;
            }
            const book = data.data || null;
            if (!book || !Number.isInteger(book.id)) {
                await showInvalidEditModal('We couldn’t find that book. Please return to your books list and try again.');
                return false;
            }
            applyBookToForm(book);
            log('Book loaded for edit:', book.id);
            return true;
        } catch (error) {
            log('Edit load exception:', error);
            showEditLoadError();
            return false;
        }
    }

    addBook.buildPayload = function buildPayload({ dryRun = false, includeCopy = true, includeId = false } = {}) {
        const publicationParsed = parsePartialDateInput(selectors.publicationDate.value.trim());
        const acquisitionParsed = parsePartialDateInput(selectors.acquisitionDate.value.trim());
        const pageCountValue = selectors.pages.value ? Number.parseInt(selectors.pages.value, 10) : null;

        const authorsPayload = addBook.state.selections.authors.map((author) => {
            const role = author.role === 'Other' ? (author.customRole || 'Other') : author.role;
            return { authorId: author.id, authorRole: role || null };
        });

        const seriesPayload = addBook.state.selections.series.map((series) => ({
            seriesId: series.id,
            bookOrder: series.order || undefined
        }));

        const storageLocationId = addBook.state.selections.storageLocationId || null;
        const storageLocationPath = addBook.state.selections.storageLocationPath || null;
        const acquisitionTypeValue = selectors.acquisitionType.value.trim();

        const bookCopy = {
            acquisitionStory: selectors.acquisitionStory.value.trim() || null,
            acquisitionDate: acquisitionParsed.value || null,
            acquiredFrom: selectors.acquiredFrom.value.trim() || null,
            acquisitionType: acquisitionTypeValue && acquisitionTypeValue !== 'none' ? acquisitionTypeValue : null,
            acquisitionLocation: selectors.acquisitionLocation.value.trim() || null,
            notes: selectors.copyNotes.value.trim() || null
        };
        if (storageLocationId) {
            bookCopy.storageLocationId = storageLocationId;
        }
        if (storageLocationPath) {
            bookCopy.storageLocationPath = storageLocationPath;
        }

        const normalizedIsbn = normalizeIsbn(selectors.isbn.value.trim());
        const normalizedCoverUrl = normalizeUrl(selectors.coverUrl.value.trim());

        const payload = {
            title: selectors.title.value.trim(),
            subtitle: selectors.subtitle.value.trim() || null,
            isbn: normalizedIsbn || null,
            publicationDate: publicationParsed.value || null,
            pageCount: Number.isInteger(pageCountValue) ? pageCountValue : null,
            coverImageUrl: normalizedCoverUrl || null,
            description: selectors.description.value.trim() || null,
            bookTypeId: addBook.state.selections.bookTypeId || null,
            publisherId: addBook.state.selections.publisherId || null,
            authors: authorsPayload,
            languageIds: addBook.state.languages.selected.map((lang) => lang.id),
            tags: addBook.state.selections.tags,
            series: seriesPayload
        };

        if (includeCopy) {
            payload.bookCopy = bookCopy;
        }
        if (includeId && Number.isInteger(editState.bookId)) {
            payload.id = editState.bookId;
        }
        if (dryRun) {
            payload.dryRun = true;
        }

        return payload;
    };

    addBook.buildCopyPayload = function buildCopyPayload() {
        const acquisitionParsed = parsePartialDateInput(selectors.acquisitionDate.value.trim());
        const acquisitionTypeValue = selectors.acquisitionType.value.trim();
        return {
            storageLocationId: addBook.state.selections.storageLocationId || null,
            storageLocationPath: addBook.state.selections.storageLocationPath || null,
            acquisitionStory: selectors.acquisitionStory.value.trim() || null,
            acquisitionDate: acquisitionParsed.value || null,
            acquiredFrom: selectors.acquiredFrom.value.trim() || null,
            acquisitionType: acquisitionTypeValue && acquisitionTypeValue !== 'none' ? acquisitionTypeValue : null,
            acquisitionLocation: selectors.acquisitionLocation.value.trim() || null,
            notes: selectors.copyNotes.value.trim() || null
        };
    };

    addBook.validateMainForm = function validateMainForm() {
        const errors = [];
        const title = selectors.title.value.trim();
        if (!title) {
            errors.push('Title is required.');
        } else if (title.length < 2 || title.length > 255) {
            errors.push('Title must be between 2 and 255 characters.');
        } else if (!patterns.title.test(title)) {
            errors.push('Title contains unsupported characters.');
        }

        if (selectors.subtitle.value.trim().length > 255) {
            errors.push('Subtitle must be 255 characters or fewer.');
        } else if (selectors.subtitle.value.trim() && !patterns.subtitle.test(selectors.subtitle.value.trim())) {
            errors.push('Subtitle contains unsupported characters.');
        }

        const rawIsbn = selectors.isbn.value.trim();
        if (rawIsbn) {
            const normalizedIsbn = addBook.utils.normalizeIsbn(rawIsbn);
            if (!normalizedIsbn) {
                errors.push('ISBN must be a valid ISBN-10 or ISBN-13 using digits and optional X (last character for ISBN-10).');
            }
        }

        const normalizedCover = selectors.coverUrl.value.trim() ? normalizeUrl(selectors.coverUrl.value.trim()) : null;
        if (selectors.coverUrl.value.trim() && !normalizedCover) {
            errors.push('Book cover URL must be a valid URL starting with http:// or https://');
        }

        if (selectors.description.value.trim().length > 2000) {
            errors.push('Description must be 2000 characters or fewer.');
        }

        if (selectors.pages.value) {
            const value = Number.parseInt(selectors.pages.value, 10);
            if (!Number.isInteger(value) || value < 1 || value > 10000) {
                errors.push('Number of pages must be between 1 and 10000.');
            }
        }

        if (selectors.publicationDate.value.trim()) {
            const parsed = parsePartialDateInput(selectors.publicationDate.value);
            if (parsed.error) {
                errors.push(parsed.error);
            }
        }

        if (selectors.acquisitionDate.value.trim()) {
            const parsed = parsePartialDateInput(selectors.acquisitionDate.value);
            if (parsed.error) {
                errors.push(parsed.error);
            }
        }

        if (selectors.acquisitionStory.value.trim().length > 2000) {
            errors.push('Acquisition story must be 2000 characters or fewer.');
        }

        if (selectors.acquiredFrom.value.trim().length > 255) {
            errors.push('Acquired from must be 255 characters or fewer.');
        } else if (selectors.acquiredFrom.value.trim() && !patterns.personText.test(selectors.acquiredFrom.value.trim())) {
            errors.push('Acquired from contains unsupported characters.');
        }

        const acquisitionTypeValue = selectors.acquisitionType.value.trim();
        if (acquisitionTypeValue && acquisitionTypeValue !== 'none' && acquisitionTypeValue.length > 100) {
            errors.push('Acquisition type must be 100 characters or fewer.');
        } else if (acquisitionTypeValue && acquisitionTypeValue !== 'none' && !patterns.acquisitionType.test(acquisitionTypeValue)) {
            errors.push('Acquisition type contains unsupported characters.');
        }

        if (selectors.acquisitionLocation.value.trim().length > 255) {
            errors.push('Acquisition location must be 255 characters or fewer.');
        } else if (selectors.acquisitionLocation.value.trim() && !patterns.personText.test(selectors.acquisitionLocation.value.trim())) {
            errors.push('Acquisition location contains unsupported characters.');
        }

        if (selectors.copyNotes.value.trim().length > 2000) {
            errors.push('Copy notes must be 2000 characters or fewer.');
        }

        addBook.state.selections.authors.forEach((author) => {
            if (author.customRole && author.customRole.length > 100) {
                errors.push(`Author role for ${author.displayName} must be 100 characters or fewer.`);
            }
            if (author.customRole && !patterns.authorRole.test(author.customRole)) {
                errors.push(`Author role for ${author.displayName} contains unsupported characters.`);
            }
        });

        addBook.state.selections.series.forEach((series) => {
            if (series.order !== null && series.order !== undefined) {
                if (!Number.isInteger(series.order) || series.order < 1 || series.order > 10000) {
                    errors.push(`Series order for ${series.name} must be between 1 and 10000.`);
                }
            }
        });

        if (errors.length) {
            log('Main form validation errors:', errors);
        } else {
            log('Main form validation passed.');
        }
        return errors;
    };

    addBook.focusFirstInvalidField = function focusFirstInvalidField() {
        const title = selectors.title.value.trim();
        if (!title || title.length < 2 || title.length > 255 || !patterns.title.test(title)) {
            return selectors.title;
        }

        const subtitle = selectors.subtitle.value.trim();
        if (subtitle && (subtitle.length > 255 || !patterns.subtitle.test(subtitle))) {
            return selectors.subtitle;
        }

        const isbn = selectors.isbn.value.trim();
        if (isbn && !/^[0-9Xx-]{10,17}$/.test(isbn)) {
            return selectors.isbn;
        }

        const coverUrl = selectors.coverUrl.value.trim();
        if (coverUrl && !isValidUrl(coverUrl)) {
            return selectors.coverUrl;
        }

        if (selectors.description.value.trim().length > 2000) {
            return selectors.description;
        }

        if (selectors.pages.value) {
            const value = Number.parseInt(selectors.pages.value, 10);
            if (!Number.isInteger(value) || value < 1 || value > 10000) {
                return selectors.pages;
            }
        }

        if (selectors.publicationDate.value.trim()) {
            const parsed = parsePartialDateInput(selectors.publicationDate.value);
            if (parsed.error) {
                return selectors.publicationDate;
            }
        }

        if (selectors.acquisitionDate.value.trim()) {
            const parsed = parsePartialDateInput(selectors.acquisitionDate.value);
            if (parsed.error) {
                return selectors.acquisitionDate;
            }
        }

        if (selectors.acquisitionStory.value.trim().length > 2000) {
            return selectors.acquisitionStory;
        }

        const acquiredFrom = selectors.acquiredFrom.value.trim();
        if (acquiredFrom && (acquiredFrom.length > 255 || !patterns.personText.test(acquiredFrom))) {
            return selectors.acquiredFrom;
        }

        const acquisitionTypeValue = selectors.acquisitionType.value.trim();
        if (acquisitionTypeValue && acquisitionTypeValue !== 'none' &&
            (acquisitionTypeValue.length > 100 || !patterns.acquisitionType.test(acquisitionTypeValue))) {
            return selectors.acquisitionType;
        }

        const acquisitionLocation = selectors.acquisitionLocation.value.trim();
        if (acquisitionLocation && (acquisitionLocation.length > 255 || !patterns.personText.test(acquisitionLocation))) {
            return selectors.acquisitionLocation;
        }

        if (selectors.copyNotes.value.trim().length > 2000) {
            return selectors.copyNotes;
        }

        const authorOtherInvalid = addBook.state.selections.authors.find((author) => {
            return author.customRole && (author.customRole.length > 100 || !patterns.authorRole.test(author.customRole));
        });
        if (authorOtherInvalid) {
            return byId(`authorOtherRole-${authorOtherInvalid.id}`);
        }

        const seriesOrderInvalid = addBook.state.selections.series.find((series) => {
            const input = byId(`seriesOrder-${series.id}`);
            if (!input) return false;
            const value = input.value.trim();
            if (!value) return false;
            const numeric = Number.parseInt(value, 10);
            return !Number.isInteger(numeric) || numeric < 1 || numeric > 10000;
        });
        if (seriesOrderInvalid) {
            return byId(`seriesOrder-${seriesOrderInvalid.id}`);
        }

        return null;
    };

    addBook.events.addEventListener('booktype:created', (event) => {
        if (!event.detail) return;
        addBook.state.bookTypes.push(event.detail);
        renderBookTypes();
        selectors.bookType.value = String(event.detail.id);
        updateBookTypeDisplay();
        log('Book type created event received:', event.detail);
    });

    addBook.events.addEventListener('publisher:created', (event) => {
        if (!event.detail) return;
        addBook.state.publishers.push(event.detail);
        renderPublishers();
        selectors.publisher.value = String(event.detail.id);
        updatePublisherDisplay();
        log('Publisher created event received:', event.detail);
    });

    addBook.events.addEventListener('author:created', (event) => {
        if (!event.detail) return;
        addBook.state.authors.push(event.detail);
        addBook.state.selections.authors.push({ id: event.detail.id, displayName: event.detail.displayName, role: null, customRole: '' });
        renderAuthors();
        updateAuthorSearchAvailability();
        log('Author created event received:', event.detail);
    });

    addBook.events.addEventListener('series:created', (event) => {
        if (!event.detail) return;
        addBook.state.series.push(event.detail);
        addBook.state.selections.series.push({ id: event.detail.id, name: event.detail.name, order: null });
        renderSeries();
        updateSeriesSearchAvailability();
        log('Series created event received:', event.detail);
    });

    addBook.events.addEventListener('location:created', (event) => {
        if (!event.detail) return;
        addBook.state.locations.push(event.detail);
        renderLocations();
        selectors.storageLocation.value = String(event.detail.id);
        updateLocationDisplay();
        log('Location created event received:', event.detail);
    });

    function attachEvents() {
        selectors.bookType.addEventListener('change', updateBookTypeDisplay);
        selectors.publisher.addEventListener('change', updatePublisherDisplay);
        selectors.storageLocation.addEventListener('change', updateLocationDisplay);

        const validateTitleField = () => {
            const value = selectors.title.value.trim();
            if (!value) {
                setHelpText(selectors.titleHelp, 'This field is required.', true);
                return;
            }
            if (value.length < 2 || value.length > 255) {
                setHelpText(selectors.titleHelp, 'Title must be between 2 and 255 characters.', true);
                return;
            }
            if (!patterns.title.test(value)) {
                setHelpText(selectors.titleHelp, 'Title contains unsupported characters.', true);
                return;
            }
            clearHelpText(selectors.titleHelp);
        };
        selectors.title.addEventListener('input', validateTitleField);
        selectors.subtitle.addEventListener('input', () => {
            const value = selectors.subtitle.value.trim();
            if (!value) {
                clearHelpText(selectors.subtitleHelp);
                return;
            }
            if (value.length > 255) {
                setHelpText(selectors.subtitleHelp, 'Subtitle must be 255 characters or fewer.', true);
                return;
            }
            if (!patterns.subtitle.test(value)) {
                setHelpText(selectors.subtitleHelp, 'Subtitle contains unsupported characters.', true);
                return;
            }
            clearHelpText(selectors.subtitleHelp);
        });
        selectors.isbn.addEventListener('input', () => {
            const value = selectors.isbn.value.trim();
            if (!value) {
                clearHelpText(selectors.isbnHelp);
                return;
            }
            const normalized = normalizeIsbn(value);
            if (!normalized) {
                setHelpText(selectors.isbnHelp, 'ISBN must be a valid ISBN-10 or ISBN-13 using digits and optional X (last character for ISBN-10).', true);
                return;
            }
            setHelpText(selectors.isbnHelp, `This ISBN will be stored as: ${normalized}`, false);
        });
        selectors.pages.addEventListener('input', () => {
            const value = selectors.pages.value.trim();
            if (!value) {
                clearHelpText(selectors.pagesHelp);
                return;
            }
            const numeric = Number.parseInt(value, 10);
            if (!Number.isInteger(numeric) || numeric < 1 || numeric > 10000) {
                setHelpText(selectors.pagesHelp, 'Number of pages must be between 1 and 10000.', true);
                return;
            }
            clearHelpText(selectors.pagesHelp);
        });
        selectors.coverUrl.addEventListener('input', () => {
            const value = selectors.coverUrl.value.trim();
            if (!value) {
                clearHelpText(selectors.coverUrlHelp);
                return;
            }
            if (!normalizeUrl(value)) {
                setHelpText(selectors.coverUrlHelp, 'Book cover URL must be a valid URL starting with http:// or https://', true);
                return;
            }
            clearHelpText(selectors.coverUrlHelp);
        });
        selectors.description.addEventListener('input', () => {
            const value = selectors.description.value.trim();
            if (!value) {
                clearHelpText(selectors.descriptionHelp);
                return;
            }
            if (value.length > 2000) {
                setHelpText(selectors.descriptionHelp, 'Description must be 2000 characters or fewer.', true);
                return;
            }
            clearHelpText(selectors.descriptionHelp);
        });

        selectors.authorSearch.addEventListener('input', handleAuthorSearch);
        selectors.authorSearch.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            selectFirstResult(selectors.authorResults);
        });
        selectors.authorSearch.addEventListener('blur', () => setTimeout(() => hideSearchResults(selectors.authorResults), 150));

        selectors.seriesSearch.addEventListener('input', handleSeriesSearch);
        selectors.seriesSearch.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            selectFirstResult(selectors.seriesResults);
        });
        selectors.seriesSearch.addEventListener('blur', () => setTimeout(() => hideSearchResults(selectors.seriesResults), 150));

        selectors.publicationDate.addEventListener('input', () => setPartialDateHelp(selectors.publicationDate, selectors.publicationDateHelp));
        selectors.acquisitionDate.addEventListener('input', () => setPartialDateHelp(selectors.acquisitionDate, selectors.acquisitionDateHelp));
        selectors.acquiredFrom.addEventListener('input', () => {
            const value = selectors.acquiredFrom.value.trim();
            if (!value) {
                clearHelpText(selectors.acquiredFromHelp);
                return;
            }
            if (value.length > 255 || !patterns.personText.test(value)) {
                setHelpText(selectors.acquiredFromHelp, 'Acquired from must be 255 characters or fewer and use letters, numbers, and basic punctuation.', true);
            } else {
                clearHelpText(selectors.acquiredFromHelp);
            }
        });
        selectors.acquisitionType.addEventListener('change', () => {
            const value = selectors.acquisitionType.value.trim();
            if (!value || value === 'none') {
                clearHelpText(selectors.acquisitionTypeHelp);
                return;
            }
            if (value.length > 100 || !patterns.acquisitionType.test(value)) {
                setHelpText(selectors.acquisitionTypeHelp, 'Acquisition type must be 100 characters or fewer and use letters, numbers, and basic punctuation.', true);
            } else {
                clearHelpText(selectors.acquisitionTypeHelp);
            }
        });
        selectors.acquisitionLocation.addEventListener('input', () => {
            const value = selectors.acquisitionLocation.value.trim();
            if (!value) {
                clearHelpText(selectors.acquisitionLocationHelp);
                return;
            }
            if (value.length > 255 || !patterns.personText.test(value)) {
                setHelpText(selectors.acquisitionLocationHelp, 'Acquisition location must be 255 characters or fewer and use letters, numbers, and basic punctuation.', true);
            } else {
                clearHelpText(selectors.acquisitionLocationHelp);
            }
        });
        selectors.acquisitionStory.addEventListener('input', () => {
            const value = selectors.acquisitionStory.value.trim();
            if (!value) {
                clearHelpText(selectors.acquisitionStoryHelp);
                return;
            }
            if (value.length > 2000) {
                setHelpText(selectors.acquisitionStoryHelp, 'Acquisition story must be 2000 characters or fewer.', true);
            } else {
                clearHelpText(selectors.acquisitionStoryHelp);
            }
        });
        selectors.copyNotes.addEventListener('input', () => {
            const value = selectors.copyNotes.value.trim();
            if (!value) {
                clearHelpText(selectors.copyNotesHelp);
                return;
            }
            if (value.length > 2000) {
                setHelpText(selectors.copyNotesHelp, 'Copy notes must be 2000 characters or fewer.', true);
            } else {
                clearHelpText(selectors.copyNotesHelp);
            }
        });

        selectors.title.addEventListener('blur', validateTitleField);
        validateTitleField();
    }

    async function initialize() {
        log('Initializing Add Book page...');
        if (invalidEditParam) {
            await showInvalidEditModal('We couldn’t find that book. Please return to your books list and try again.');
            if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
                window.pageContentReady.resolve({ success: false });
            }
            return;
        }
        attachEvents();
        applyEditModeUI();
        renderAuthors();
        renderSeries();
        const results = await Promise.allSettled([
            loadLanguages(),
            loadBookTypes(),
            loadPublishers(),
            loadAuthors(),
            loadSeries(),
            loadLocations()
        ]);
        const listOk = results.every((result) => result.status === 'fulfilled' && result.value === true);
        let editOk = true;
        if (isEditMode()) {
            await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
        }
        try {
            editOk = await loadBookForEdit();
        } finally {
            if (isEditMode()) {
                await hideModal('pageLoadingModal');
            }
        }
        const allOk = listOk && editOk;
        if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
            window.pageContentReady.resolve({ success: allOk });
        }
        if (rateLimitGuard?.hasReset()) {
            await rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
            return;
        }
        if (!allOk) {
            log('One or more data loads failed.', results);
        }
        if (window.authGuard && typeof window.authGuard.checkSessionAndPrompt === 'function') {
            await window.authGuard.checkSessionAndPrompt({ waitForMaintenance: true });
        }
        log('Initialization complete.');
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();
