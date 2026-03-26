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
        normalizeDeweyCode,
        ensureHelpText
    } = addBook.utils;
    const log = (...args) => console.log('[Add Book]', ...args);
    if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
        window.pageContentReady.reset();
    }

    const rateLimitGuard = window.rateLimitGuard;

    const selectors = {
        isbnLookupInput: byId('oneISBN'),
        isbnScanButton: byId('oneBtnScanISBN'),
        isbnLookupButton: byId('oneBtnLookup'),
        isbnLookupHelp: byId('oneISBNHelp'),
        isbnLookupForm: byId('isbnLookupForm'),
        isbnLookupLoadingModal: byId('lookupByISBNLoadingModal'),
        isbnBarcodeScannerModal: byId('isbnBarcodeScannerModal'),
        isbnBarcodeScannerPreviewWrap: byId('isbnBarcodeScannerPreviewWrap'),
        isbnBarcodeScannerVideo: byId('isbnBarcodeScannerVideo'),
        isbnBarcodeScannerStatus: byId('isbnBarcodeScannerStatus'),
        isbnBarcodeScannerRetry: byId('isbnBarcodeScannerRetry'),
        isbnBarcodeCaptureButton: byId('isbnBarcodeCaptureButton'),
        isbnBarcodeUploadButton: byId('isbnBarcodeUploadButton'),
        isbnBarcodeCaptureInput: byId('isbnBarcodeCaptureInput'),
        isbnBarcodeUploadInput: byId('isbnBarcodeUploadInput'),
        isbnLookupProgressBar: byId('isbnLookupProgressBar'),
        isbnLookupProgressText: byId('isbnLookupProgressText'),
        isbnLookupErrorModal: byId('isbnLookupErrorModal'),
        isbnLookupExistingAlert: byId('isbnLookupExistingAlert'),
        isbnLookupWarningsAlert: byId('isbnLookupWarningsAlert'),
        isbnLookupActionErrorAlert: byId('isbnLookupActionErrorAlert'),
        title: byId('twoEdtTitle'),
        subtitle: byId('twoEdtSubtitle'),
        isbn: byId('twoEdtISBN'),
        deweyCode: byId('twoEdtDeweyCode'),
        deweyFieldWrap: byId('twoDeweyFieldWrap'),
        deweyHelp: byId('twoDeweyCodeHelp'),
        deweyStatusWrap: byId('twoDeweyStatusWrap'),
        deweyCaption: byId('twoDeweyCaption'),
        deweyPath: byId('twoDeweyPath'),
        deweyUnavailable: byId('twoDeweyUnavailable'),
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
        bookTypeSuggestionAlert: byId('bookTypeSuggestionAlert'),
        bookTypeSuggestionText: byId('bookTypeSuggestionText'),
        bookTypeSuggestionDescriptionWrap: byId('bookTypeSuggestionDescriptionWrap'),
        bookTypeSuggestionDescription: byId('bookTypeSuggestionDescription'),
        bookTypeSuggestionApprove: byId('bookTypeSuggestionApprove'),
        bookTypeSuggestionReject: byId('bookTypeSuggestionReject'),
        bookAuthorsSuggestionAlert: byId('bookAuthorsSuggestionAlert'),
        bookAuthorsSuggestionList: byId('bookAuthorsSuggestionList'),
        bookPublisherSuggestionAlert: byId('bookPublisherSuggestionAlert'),
        bookPublisherSuggestionDetails: byId('bookPublisherSuggestionDetails'),
        bookPublisherSuggestionApprove: byId('bookPublisherSuggestionApprove'),
        bookPublisherSuggestionReject: byId('bookPublisherSuggestionReject'),
        bookSeriesSuggestionAlert: byId('bookSeriesSuggestionAlert'),
        bookSeriesSuggestionList: byId('bookSeriesSuggestionList'),
        tagsSuggestionAlert: byId('tagsSuggestionAlert'),
        tagsSuggestionList: byId('tagsSuggestionList'),
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
    selectors.isbnLookupHelp = ensureHelpText(selectors.isbnLookupInput, 'oneISBNHelp');
    selectors.subtitleHelp = ensureHelpText(selectors.subtitle, 'twoSubtitleHelp');
    selectors.isbnHelp = ensureHelpText(selectors.isbn, 'twoISBNHelp');
    selectors.deweyHelp = ensureHelpText(selectors.deweyCode, 'twoDeweyCodeHelp');
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
    const isbnLookupState = addBook.state.isbnLookup || (addBook.state.isbnLookup = {
        pending: null,
        linkedSummary: null,
        recentDurations: [],
        progressTimer: null,
        timeoutId: null,
        activeRequestToken: 0,
        scannerStream: null,
        scannerPollTimer: null,
        scannerActive: false,
        scannerStarting: false,
        scannerLookupTriggered: false,
        scannerSessionToken: 0,
        scannerImageProcessing: false,
        scannerImageObjectUrl: null,
        hardwareScannerTimer: null,
        hardwareScannerBurstCount: 0,
        hardwareScannerBurstStartedAt: 0,
        hardwareScannerLastKeyAt: 0,
        hardwareScannerEndedWithEnter: false,
        lastAutoLookupIsbn: null,
        lastAutoLookupAt: 0
    });
    const authorRoleOptions = new Set(['Author', 'Editor', 'Illustrator', 'Translator', 'Other']);
    let barcodeDetectorPromise = null;
    let zxingReaderPromise = null;

    function triggerInput(el) {
        if (!el) return;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function setDeweyVisibility(visible) {
        selectors.deweyFieldWrap?.classList.toggle('d-none', !visible);
    }

    function renderDeweyInterpretation(result, datasetState) {
        if (!selectors.deweyHelp) return;

        selectors.deweyStatusWrap?.classList.add('d-none');
        selectors.deweyUnavailable?.classList.add('d-none');
        if (selectors.deweyCaption) selectors.deweyCaption.textContent = '';
        if (selectors.deweyPath) selectors.deweyPath.textContent = '';

        if (!result?.normalized) {
            clearHelpText(selectors.deweyHelp);
            return;
        }

        if (!result.valid) {
            setHelpText(selectors.deweyHelp, 'Dewey Code must be 1 to 3 digits, with an optional decimal part such as 513.2.', true);
            return;
        }

        setHelpText(selectors.deweyHelp, `This Dewey Code will be stored as: ${result.normalized}`, false);

        if (datasetState && datasetState.enabled && !datasetState.available) {
            selectors.deweyUnavailable?.classList.remove('d-none');
            log('Dewey dataset unavailable; allowing manual entry fallback.');
            return;
        }

        if (!datasetState?.available) {
            return;
        }

        selectors.deweyStatusWrap?.classList.remove('d-none');
        if (result.resolved) {
            if (selectors.deweyCaption) {
                selectors.deweyCaption.textContent = `\u2192 ${result.caption || result.matchedCode}`;
            }
            if (selectors.deweyPath) {
                selectors.deweyPath.textContent = result.path.length > 0
                    ? `\u2192 ${result.path.join(' > ')}`
                    : '\u2192 Matching Dewey path found.';
            }
            return;
        }

        if (selectors.deweyCaption) {
            selectors.deweyCaption.textContent = '\u2192 Valid Dewey code, but not found in your current dataset.';
        }
        if (selectors.deweyPath) {
            selectors.deweyPath.textContent = '';
        }
    }

    function interpretDeweyInput() {
        const rawValue = selectors.deweyCode?.value || '';
        const normalized = normalizeDeweyCode(rawValue);
        const datasetState = addBook.state.dewey || {};
        const result = window.deweyClient
            ? window.deweyClient.resolveCode(normalized, datasetState.entries || [])
            : { normalized, valid: false, resolved: false, caption: null, path: [] };
        renderDeweyInterpretation(result, datasetState);
        return result;
    }

    async function initializeDeweyField() {
        if (!window.deweyClient) {
            setDeweyVisibility(true);
            addBook.state.dewey = { enabled: true, available: false, source: 'unavailable', entries: [] };
            selectors.deweyUnavailable?.classList.remove('d-none');
            log('Dewey client script is unavailable; showing manual fallback.');
            return;
        }

        const datasetState = await window.deweyClient.loadDataset();
        addBook.state.dewey = datasetState;

        if (!datasetState.enabled) {
            setDeweyVisibility(false);
            return;
        }

        setDeweyVisibility(true);
        interpretDeweyInput();
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

        interpretDeweyInput();

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

    const readApiPayload = async (response) => {
        if (typeof window.readApiResponse === 'function') {
            return window.readApiResponse(response);
        }
        return response.json().catch(() => ({}));
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

    function renderLookupAlert(alertEl, message, { type = 'info', details = [] } = {}) {
        if (!alertEl) return;
        const safeDetails = Array.isArray(details) ? details.filter(Boolean) : [];
        alertEl.classList.remove('d-none', 'alert-info', 'alert-warning', 'alert-danger');
        alertEl.classList.add(`alert-${type}`);
        alertEl.innerHTML = '';
        const strong = document.createElement('strong');
        strong.textContent = message || '';
        alertEl.appendChild(strong);
        if (safeDetails.length > 0) {
            const list = document.createElement('ul');
            list.className = 'mb-0 mt-2';
            safeDetails.forEach((detail) => {
                const li = document.createElement('li');
                li.textContent = detail;
                list.appendChild(li);
            });
            alertEl.appendChild(list);
        }
    }

    function clearLookupAlert(alertEl) {
        if (!alertEl) return;
        alertEl.classList.add('d-none');
        alertEl.innerHTML = '';
        alertEl.classList.remove('alert-info', 'alert-warning', 'alert-danger');
    }

    function clearLookupSuggestions() {
        isbnLookupState.pending = null;
        isbnLookupState.linkedSummary = null;
        clearLookupAlert(selectors.isbnLookupExistingAlert);
        clearLookupAlert(selectors.isbnLookupWarningsAlert);
        clearLookupAlert(selectors.isbnLookupActionErrorAlert);
        if (selectors.bookTypeSuggestionText) {
            selectors.bookTypeSuggestionText.textContent = '';
        }
        if (selectors.bookTypeSuggestionDescription) {
            selectors.bookTypeSuggestionDescription.textContent = '';
        }
        selectors.bookTypeSuggestionDescriptionWrap?.classList.add('d-none');
        selectors.bookAuthorsSuggestionList && (selectors.bookAuthorsSuggestionList.innerHTML = '');
        selectors.bookPublisherSuggestionDetails && (selectors.bookPublisherSuggestionDetails.innerHTML = '');
        selectors.bookSeriesSuggestionList && (selectors.bookSeriesSuggestionList.innerHTML = '');
        selectors.tagsSuggestionList && (selectors.tagsSuggestionList.innerHTML = '');
        [
            selectors.bookTypeSuggestionAlert,
            selectors.bookAuthorsSuggestionAlert,
            selectors.bookPublisherSuggestionAlert,
            selectors.bookSeriesSuggestionAlert,
            selectors.tagsSuggestionAlert
        ].forEach((element) => {
            if (element) element.classList.add('d-none');
        });
    }

    function getAverageLookupDuration() {
        const durations = Array.isArray(isbnLookupState.recentDurations) ? isbnLookupState.recentDurations : [];
        if (durations.length === 0) return 3000;
        const total = durations.reduce((sum, value) => sum + value, 0);
        return Math.max(1800, Math.min(6000, Math.round(total / durations.length)));
    }

    function updateLookupProgress(value) {
        const percent = Math.max(0, Math.min(100, Math.round(value)));
        if (selectors.isbnLookupProgressBar) {
            selectors.isbnLookupProgressBar.style.width = `${percent}%`;
            selectors.isbnLookupProgressBar.setAttribute('aria-valuenow', String(percent));
        }
        if (selectors.isbnLookupProgressText) {
            selectors.isbnLookupProgressText.textContent = `${percent}%`;
        }
    }

    function stopLookupProgressSimulation() {
        if (isbnLookupState.progressTimer) {
            window.clearInterval(isbnLookupState.progressTimer);
            isbnLookupState.progressTimer = null;
            log('ISBN lookup progress simulation stopped.');
        }
    }

    function clearLookupTimeout() {
        if (isbnLookupState.timeoutId) {
            window.clearTimeout(isbnLookupState.timeoutId);
            isbnLookupState.timeoutId = null;
        }
    }

    function startLookupProgressSimulation(requestToken) {
        stopLookupProgressSimulation();
        updateLookupProgress(4);
        const expectedDuration = getAverageLookupDuration();
        const startTime = Date.now();
        log('ISBN lookup progress simulation started.', { requestToken, expectedDuration });
        isbnLookupState.progressTimer = window.setInterval(() => {
            if (isbnLookupState.activeRequestToken !== requestToken) {
                stopLookupProgressSimulation();
                return;
            }
            const elapsed = Date.now() - startTime;
            const expected = Math.max(expectedDuration, 1);
            const ratio = Math.min(elapsed / expected, 1.6);
            let progress;
            if (ratio <= 0.6) {
                progress = 10 + (ratio / 0.6) * 58;
            } else {
                const tailRatio = Math.min((ratio - 0.6) / 1.0, 1);
                progress = 68 + (tailRatio * 26);
            }
            updateLookupProgress(Math.min(progress, 94));
        }, 120);
    }

    async function finalizeLookupProgress(requestToken, { success = false } = {}) {
        if (isbnLookupState.activeRequestToken !== requestToken) return;
        stopLookupProgressSimulation();
        if (success) {
            updateLookupProgress(100);
            log('ISBN lookup progress finalized at 100%.', { requestToken });
            await new Promise((resolve) => window.setTimeout(resolve, 180));
            return;
        }
        updateLookupProgress(0);
    }

    function rememberLookupDuration(durationMs) {
        if (!Number.isFinite(durationMs) || durationMs <= 0) return;
        isbnLookupState.recentDurations.push(durationMs);
        if (isbnLookupState.recentDurations.length > 5) {
            isbnLookupState.recentDurations.shift();
        }
        log('ISBN lookup duration recorded.', {
            durationMs,
            averageDurationMs: getAverageLookupDuration(),
            sampleSize: isbnLookupState.recentDurations.length
        });
    }

    async function hideLookupLoadingModalSafely() {
        try {
            log('Hiding ISBN lookup loading modal...');
            await hideModal(selectors.isbnLookupLoadingModal);
            log('ISBN lookup loading modal hidden.');
        } catch (error) {
            console.error('[Add Book] Failed to hide ISBN lookup loading modal.', error);
        }
    }

    function setLookupActionError(message, details) {
        if (!message) {
            clearLookupAlert(selectors.isbnLookupActionErrorAlert);
            return;
        }
        renderLookupAlert(selectors.isbnLookupActionErrorAlert, message, {
            type: 'danger',
            details: Array.isArray(details) ? details : (details ? [details] : [])
        });
    }

    function dedupeById(items, key = 'id') {
        const seen = new Set();
        return (Array.isArray(items) ? items : []).filter((item) => {
            if (!item || !Number.isInteger(item[key])) return false;
            if (seen.has(item[key])) return false;
            seen.add(item[key]);
            return true;
        });
    }

    function dedupeStrings(values) {
        const seen = new Set();
        return (Array.isArray(values) ? values : []).filter((value) => {
            const normalized = String(value || '').trim().toLowerCase();
            if (!normalized || seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
        });
    }

    function addAuthorSelection(author, roleValue) {
        const mapped = mapAuthorRole(roleValue ?? null);
        const existing = addBook.state.selections.authors.find((entry) => entry.id === author.id);
        if (existing) {
            existing.displayName = author.displayName || existing.displayName;
            existing.role = mapped.role;
            existing.customRole = mapped.customRole;
            return;
        }
        addBook.state.selections.authors.push({
            id: author.id,
            displayName: author.displayName || 'Unknown Author',
            role: mapped.role,
            customRole: mapped.customRole
        });
    }

    function addSeriesSelection(series, order) {
        const existing = addBook.state.selections.series.find((entry) => entry.id === series.id);
        if (existing) {
            existing.name = series.name || existing.name;
            existing.order = Number.isInteger(order) ? order : existing.order;
            return;
        }
        addBook.state.selections.series.push({
            id: series.id,
            name: series.name || 'Unknown Series',
            order: Number.isInteger(order) ? order : null
        });
    }

    function applyLookupBookFields(book) {
        if (!book) return;
        selectors.title.value = book.title || '';
        selectors.subtitle.value = book.subtitle || '';
        selectors.isbn.value = book.isbn || '';
        if (selectors.deweyCode) selectors.deweyCode.value = book.deweyCode || book.dewey?.code || '';
        selectors.publicationDate.value = book.publicationDate?.text || '';
        selectors.pages.value = Number.isInteger(book.pageCount) ? String(book.pageCount) : '';
        selectors.coverUrl.value = book.coverImageUrl || '';
        selectors.description.value = book.description || '';
        refreshInlineHelp();
        triggerInput(selectors.title);
        triggerInput(selectors.subtitle);
        triggerInput(selectors.isbn);
        triggerInput(selectors.deweyCode);
        triggerInput(selectors.pages);
        triggerInput(selectors.coverUrl);
        triggerInput(selectors.description);
        triggerInput(selectors.publicationDate);
    }

    function applyLookupExistingEntities(existingEntities = {}, book = {}) {
        const linked = [];

        const bookTypeId = existingEntities.bookType?.id ?? book.bookType?.id ?? null;
        addBook.state.selections.bookTypeId = Number.isInteger(bookTypeId) ? bookTypeId : null;
        if (selectors.bookType) {
            selectors.bookType.value = addBook.state.selections.bookTypeId ? String(addBook.state.selections.bookTypeId) : 'none';
            updateBookTypeDisplay();
        }
        if (existingEntities.bookType?.name) {
            linked.push(`Book type linked: ${existingEntities.bookType.name}.`);
        }

        const publisherId = existingEntities.publisher?.id ?? book.publisher?.id ?? null;
        addBook.state.selections.publisherId = Number.isInteger(publisherId) ? publisherId : null;
        if (selectors.publisher) {
            selectors.publisher.value = addBook.state.selections.publisherId ? String(addBook.state.selections.publisherId) : 'none';
            updatePublisherDisplay();
        }
        if (existingEntities.publisher?.name) {
            linked.push(`Publisher linked: ${existingEntities.publisher.name}.`);
        }

        addBook.state.selections.authors = [];
        const linkedAuthors = dedupeById(existingEntities.authors || [], 'id');
        linkedAuthors.forEach((author) => {
            addAuthorSelection({
                id: author.id,
                displayName: author.displayName || author.authorName
            }, author.authorRole || null);
        });
        renderAuthors();
        if (linkedAuthors.length > 0) {
            linked.push(`Authors linked: ${linkedAuthors.map((author) => author.displayName || author.authorName).join(', ')}.`);
        }

        addBook.state.selections.series = [];
        const linkedSeries = dedupeById(existingEntities.series || [], 'id');
        linkedSeries.forEach((series) => {
            addSeriesSelection({
                id: series.id,
                name: series.name || series.seriesName
            }, series.bookOrder);
        });
        renderSeries();
        if (linkedSeries.length > 0) {
            linked.push(`Series linked: ${linkedSeries.map((series) => series.name || series.seriesName).join(', ')}.`);
        }

        const linkedLanguages = dedupeById(existingEntities.languages || [], 'id')
            .map((language) => addBook.state.languages.all.find((entry) => entry.id === language.id) || language)
            .filter((language) => Number.isInteger(language?.id));
        addBook.state.languages.selected = linkedLanguages;
        addBook.events.dispatchEvent(new CustomEvent('languages:updated', { detail: linkedLanguages }));
        if (linkedLanguages.length > 0) {
            linked.push(`Languages linked: ${linkedLanguages.map((language) => language.name).join(', ')}.`);
        }

        const linkedTags = dedupeStrings((existingEntities.tags || []).map((tag) => tag?.name || tag));
        addBook.state.selections.tags = linkedTags;
        addBook.events.dispatchEvent(new CustomEvent('tags:updated', { detail: linkedTags }));
        if (linkedTags.length > 0) {
            linked.push(`Tags linked: ${linkedTags.join(', ')}.`);
        }

        isbnLookupState.linkedSummary = linked;
        if (linked.length > 0) {
            log('ISBN lookup existing entities auto-linked.', linked);
        }
    }

    function formatLookupDate(dateValue, emptyFallback = 'Unknown') {
        return dateValue?.text || emptyFallback;
    }

    function formatLookupLifeStatus(author) {
        const isDeceased = Boolean(author?.deceased || author?.deathDate);
        if (isDeceased) {
            return 'Marked as deceased';
        }
        return 'No death information available';
    }

    function createSuggestionButton(label, className, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                await onClick();
            } finally {
                if (button.isConnected) {
                    button.disabled = false;
                }
            }
        });
        return button;
    }

    function createDetailParagraph(label, value) {
        const paragraph = document.createElement('p');
        paragraph.className = 'mb-1 small text-muted';
        const strong = document.createElement('strong');
        strong.textContent = `${label}: `;
        paragraph.appendChild(strong);
        paragraph.appendChild(document.createTextNode(value || 'Unknown'));
        return paragraph;
    }

    function hideLookupSuggestionAlert(element, type) {
        if (!element || element.classList.contains('d-none')) return;
        element.classList.add('d-none');
        log('ISBN lookup suggestion alert hidden.', { type });
    }

    function showLookupSuggestionAlert(element, type, meta) {
        if (!element) return;
        element.classList.remove('d-none');
        log('ISBN lookup suggestion alert shown.', { type, ...meta });
    }

    function removeSuggestedAuthor(index) {
        if (!isbnLookupState.pending?.newEntities?.authors?.[index]) return;
        isbnLookupState.pending.newEntities.authors.splice(index, 1);
        log('ISBN lookup author suggestion rejected.', { index });
        renderLookupSuggestions();
    }

    function removeSuggestedPublisher() {
        if (!isbnLookupState.pending?.newEntities?.publisher) return;
        isbnLookupState.pending.newEntities.publisher = null;
        log('ISBN lookup publisher suggestion rejected.');
        renderLookupSuggestions();
    }

    function removeSuggestedSeries(index) {
        if (!isbnLookupState.pending?.newEntities?.series?.[index]) return;
        isbnLookupState.pending.newEntities.series.splice(index, 1);
        log('ISBN lookup series suggestion rejected.', { index });
        renderLookupSuggestions();
    }

    function removeSuggestedTag(index) {
        if (!isbnLookupState.pending?.newEntities?.tags?.[index]) return;
        isbnLookupState.pending.newEntities.tags.splice(index, 1);
        log('ISBN lookup tag suggestion rejected.', { index });
        renderLookupSuggestions();
    }

    function clearSuggestedBookType() {
        if (!isbnLookupState.pending?.newEntities?.bookType) return;
        isbnLookupState.pending.newEntities.bookType = null;
        log('ISBN lookup book type suggestion rejected.');
        renderLookupSuggestions();
    }

    function buildAuthorRoleValue(selectedRole, customRole) {
        const normalizedSelected = typeof selectedRole === 'string' ? selectedRole.trim() : '';
        const normalizedCustom = typeof customRole === 'string' ? customRole.trim() : '';
        if (!normalizedSelected || normalizedSelected === 'none') return null;
        if (normalizedSelected === 'Other') {
            if (!normalizedCustom) return null;
            if (normalizedCustom.length < 2 || normalizedCustom.length > 100 || !patterns.authorRole.test(normalizedCustom)) {
                return { error: 'Suggested author role contains unsupported characters or is too short.' };
            }
            return normalizedCustom;
        }
        return normalizedSelected;
    }

    async function approveSuggestedBookType() {
        const suggestion = isbnLookupState.pending?.newEntities?.bookType;
        if (!suggestion?.name) return;
        setLookupActionError('');
        const payload = {
            name: suggestion.name,
            description: suggestion.description || null
        };
        const response = await apiFetch('/booktype', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await readApiPayload(response);
        if (!response.ok) {
            const normalized = typeof window.normalizeApiErrorPayload === 'function'
                ? window.normalizeApiErrorPayload(data, 'Unable to add book type.')
                : { message: data.message || 'Unable to add book type.', errors: data.errors || [] };
            setLookupActionError(normalized.message, normalized.errors);
            return;
        }
        const created = data.data || {};
        addBook.state.bookTypes.push(created);
        renderBookTypes();
        addBook.state.selections.bookTypeId = created.id;
        if (selectors.bookType) {
            selectors.bookType.value = String(created.id);
            updateBookTypeDisplay();
        }
        isbnLookupState.pending.newEntities.bookType = null;
        log('ISBN lookup new book type approved.', { id: created.id, name: created.name || payload.name });
        renderLookupSuggestions();
    }

    async function approveSuggestedAuthor(index, roleValue) {
        const suggestion = isbnLookupState.pending?.newEntities?.authors?.[index];
        if (!suggestion) return;
        setLookupActionError('');
        const payload = {
            displayName: suggestion.displayName || suggestion.authorName || '',
            firstNames: suggestion.firstNames || null,
            lastName: suggestion.lastName || null,
            birthDate: suggestion.birthDate || null,
            deceased: Boolean(suggestion.deceased),
            deathDate: suggestion.deceased ? (suggestion.deathDate || null) : null,
            bio: suggestion.bio || null
        };
        const response = await apiFetch('/author', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await readApiPayload(response);
        if (!response.ok) {
            const normalized = typeof window.normalizeApiErrorPayload === 'function'
                ? window.normalizeApiErrorPayload(data, 'Unable to add author.')
                : { message: data.message || 'Unable to add author.', errors: data.errors || [] };
            setLookupActionError(normalized.message, normalized.errors);
            return;
        }
        const created = data.data || {};
        addBook.state.authors.push(created);
        addAuthorSelection({
            id: created.id,
            displayName: created.displayName || payload.displayName
        }, roleValue);
        renderAuthors();
        updateAuthorSearchAvailability();
        isbnLookupState.pending.newEntities.authors.splice(index, 1);
        log('ISBN lookup new author approved.', {
            id: created.id,
            displayName: created.displayName || payload.displayName,
            roleValue: roleValue || null
        });
        renderLookupSuggestions();
    }

    async function approveSuggestedPublisher() {
        const suggestion = isbnLookupState.pending?.newEntities?.publisher;
        if (!suggestion) return;
        setLookupActionError('');
        const payload = {
            name: suggestion.name,
            foundedDate: suggestion.foundedDate || null,
            website: suggestion.website || null,
            notes: suggestion.notes || null
        };
        const response = await apiFetch('/publisher', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await readApiPayload(response);
        if (!response.ok) {
            const normalized = typeof window.normalizeApiErrorPayload === 'function'
                ? window.normalizeApiErrorPayload(data, 'Unable to add publisher.')
                : { message: data.message || 'Unable to add publisher.', errors: data.errors || [] };
            setLookupActionError(normalized.message, normalized.errors);
            return;
        }
        const created = data.data || {};
        addBook.state.publishers.push(created);
        addBook.state.selections.publisherId = created.id;
        renderPublishers();
        if (selectors.publisher) {
            selectors.publisher.value = String(created.id);
            updatePublisherDisplay();
        }
        isbnLookupState.pending.newEntities.publisher = null;
        log('ISBN lookup new publisher approved.', { id: created.id, name: created.name || payload.name });
        renderLookupSuggestions();
    }

    async function approveSuggestedSeries(index) {
        const suggestion = isbnLookupState.pending?.newEntities?.series?.[index];
        if (!suggestion) return;
        setLookupActionError('');
        const payload = {
            name: suggestion.name || suggestion.seriesName,
            website: suggestion.website || null,
            description: suggestion.description || null
        };
        const response = await apiFetch('/bookseries', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await readApiPayload(response);
        if (!response.ok) {
            const normalized = typeof window.normalizeApiErrorPayload === 'function'
                ? window.normalizeApiErrorPayload(data, 'Unable to add series.')
                : { message: data.message || 'Unable to add series.', errors: data.errors || [] };
            setLookupActionError(normalized.message, normalized.errors);
            return;
        }
        const created = data.data || {};
        addBook.state.series.push(created);
        addSeriesSelection({
            id: created.id,
            name: created.name || payload.name
        }, suggestion.bookOrder);
        renderSeries();
        updateSeriesSearchAvailability();
        isbnLookupState.pending.newEntities.series.splice(index, 1);
        log('ISBN lookup new series approved.', {
            id: created.id,
            name: created.name || payload.name,
            bookOrder: suggestion.bookOrder ?? null
        });
        renderLookupSuggestions();
    }

    async function approveSuggestedTag(index) {
        const suggestion = isbnLookupState.pending?.newEntities?.tags?.[index];
        if (!suggestion) return;
        const tagName = suggestion.name || suggestion;
        if (!tagName) return;
        setLookupActionError('');
        if (!addBook.state.selections.tags.some((tag) => tag.toLowerCase() === tagName.toLowerCase())) {
            addBook.state.selections.tags.push(tagName);
            addBook.events.dispatchEvent(new CustomEvent('tags:updated', { detail: addBook.state.selections.tags }));
        }
        isbnLookupState.pending.newEntities.tags.splice(index, 1);
        log('ISBN lookup new tag approved.', { name: tagName });
        renderLookupSuggestions();
    }

    function renderLookupSuggestions() {
        const pending = isbnLookupState.pending;
        if (!pending) {
            clearLookupSuggestions();
            return;
        }

        clearLookupAlert(selectors.isbnLookupActionErrorAlert);
        const linkedSummary = Array.isArray(isbnLookupState.linkedSummary) ? isbnLookupState.linkedSummary : [];
        if (linkedSummary.length > 0) {
            renderLookupAlert(selectors.isbnLookupExistingAlert, 'Existing library matches were linked automatically.', {
                type: 'info',
                details: linkedSummary
            });
        } else {
            clearLookupAlert(selectors.isbnLookupExistingAlert);
        }

        const warnings = Array.isArray(pending.warnings) ? pending.warnings.filter(Boolean) : [];
        if (warnings.length > 0) {
            renderLookupAlert(selectors.isbnLookupWarningsAlert, 'A few lookup notes may need your attention.', {
                type: 'warning',
                details: warnings
            });
        } else {
            clearLookupAlert(selectors.isbnLookupWarningsAlert);
        }

        const newBookType = pending.newEntities?.bookType || null;
        const newPublisher = pending.newEntities?.publisher || null;
        const newAuthors = Array.isArray(pending.newEntities?.authors) ? pending.newEntities.authors : [];
        const newSeries = Array.isArray(pending.newEntities?.series) ? pending.newEntities.series : [];
        const newTags = Array.isArray(pending.newEntities?.tags) ? pending.newEntities.tags : [];

        if (newBookType?.name && selectors.bookTypeSuggestionAlert) {
            const sourceHint = typeof newBookType.sourceHint === 'string' && newBookType.sourceHint.trim()
                ? ` based on details such as "${newBookType.sourceHint.trim()}"`
                : '';
            selectors.bookTypeSuggestionText.textContent = `This book appears to be a ${newBookType.name}${sourceHint}. This type is not yet in your current list of book types.`;
            const hasDescription = Boolean(newBookType.description);
            selectors.bookTypeSuggestionDescription.textContent = newBookType.description || '';
            selectors.bookTypeSuggestionDescriptionWrap?.classList.toggle('d-none', !hasDescription);
            showLookupSuggestionAlert(selectors.bookTypeSuggestionAlert, 'bookType', { name: newBookType.name });
        } else {
            hideLookupSuggestionAlert(selectors.bookTypeSuggestionAlert, 'bookType');
        }

        if (newPublisher && selectors.bookPublisherSuggestionAlert && selectors.bookPublisherSuggestionDetails) {
            selectors.bookPublisherSuggestionDetails.innerHTML = '';
            selectors.bookPublisherSuggestionDetails.appendChild(createDetailParagraph('Publisher', newPublisher.name));
            if (newPublisher.foundedDate?.text) {
                selectors.bookPublisherSuggestionDetails.appendChild(createDetailParagraph('Founded Date', newPublisher.foundedDate.text));
            }
            if (newPublisher.website) {
                selectors.bookPublisherSuggestionDetails.appendChild(createDetailParagraph('Website', newPublisher.website));
            }
            if (newPublisher.notes) {
                selectors.bookPublisherSuggestionDetails.appendChild(createDetailParagraph('Notes', newPublisher.notes));
            }
            showLookupSuggestionAlert(selectors.bookPublisherSuggestionAlert, 'publisher', { name: newPublisher.name });
        } else {
            hideLookupSuggestionAlert(selectors.bookPublisherSuggestionAlert, 'publisher');
        }

        if (selectors.bookAuthorsSuggestionList) {
            selectors.bookAuthorsSuggestionList.innerHTML = '';
        }
        if (selectors.bookAuthorsSuggestionList && newAuthors.length > 0) {
            newAuthors.forEach((author, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'border-top pt-2 mt-2';

                const title = document.createElement('h6');
                title.className = 'mb-0';
                title.textContent = author.displayName || author.authorName || 'Suggested Author';
                wrapper.appendChild(title);

                if (author.bio) {
                    const bio = document.createElement('p');
                    bio.className = 'text-muted mb-2 small';
                    bio.textContent = author.bio;
                    wrapper.appendChild(bio);
                }

                const infoRow = document.createElement('div');
                infoRow.className = 'row';
                [
                    ['Author First Names', author.firstNames || 'Unknown'],
                    ['Author Surname', author.lastName || 'Unknown'],
                    ['Author Date of Birth', formatLookupDate(author.birthDate, 'Not provided')],
                    ['Author Status', formatLookupLifeStatus(author)]
                ].forEach(([label, value]) => {
                    const col = document.createElement('div');
                    col.className = 'col-12 col-md-6 col-xl-3';
                    col.appendChild(createDetailParagraph(label, value));
                    infoRow.appendChild(col);
                });
                wrapper.appendChild(infoRow);

                if (author.deceased || author.deathDate) {
                    wrapper.appendChild(createDetailParagraph('Author Date of Death', formatLookupDate(author.deathDate, 'Not provided')));
                }

                const roleRow = document.createElement('div');
                roleRow.className = 'row align-items-center mt-2';
                const roleLabelCol = document.createElement('div');
                roleLabelCol.className = 'col-12 col-md-3 col-xxl-2 mb-1 mb-md-0';
                const roleLabel = document.createElement('label');
                roleLabel.className = 'col-form-label p-0 small';
                roleLabel.textContent = "Author's Role:";
                roleLabelCol.appendChild(roleLabel);

                const roleSelectCol = document.createElement('div');
                roleSelectCol.className = 'col-12 col-md-3 mb-1 mb-md-0';
                const roleSelect = document.createElement('select');
                roleSelect.className = 'form-select form-select-sm';
                [
                    ['none', 'Select role...'],
                    ['Author', 'Author'],
                    ['Editor', 'Editor'],
                    ['Illustrator', 'Illustrator'],
                    ['Translator', 'Translator'],
                    ['Other', 'Other...']
                ].forEach(([value, label]) => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = label;
                    roleSelect.appendChild(option);
                });

                const initialRole = mapAuthorRole(author.authorRole || null);
                roleSelect.value = initialRole.role || 'none';
                roleSelectCol.appendChild(roleSelect);

                const customRoleCol = document.createElement('div');
                customRoleCol.className = 'col-12 col-md-5';
                const customRoleGroup = document.createElement('div');
                customRoleGroup.className = 'input-group input-group-sm';
                const customRoleLabel = document.createElement('span');
                customRoleLabel.className = 'input-group-text';
                customRoleLabel.textContent = 'Other Role:';
                const customRoleInput = document.createElement('input');
                customRoleInput.type = 'text';
                customRoleInput.className = 'form-control';
                customRoleInput.maxLength = 100;
                customRoleInput.minLength = 2;
                customRoleInput.placeholder = 'Other role...';
                customRoleInput.value = initialRole.customRole || '';
                customRoleGroup.appendChild(customRoleLabel);
                customRoleGroup.appendChild(customRoleInput);
                customRoleCol.appendChild(customRoleGroup);
                customRoleCol.classList.toggle('d-none', roleSelect.value !== 'Other');
                roleSelect.addEventListener('change', () => {
                    customRoleCol.classList.toggle('d-none', roleSelect.value !== 'Other');
                });

                roleRow.appendChild(roleLabelCol);
                roleRow.appendChild(roleSelectCol);
                roleRow.appendChild(customRoleCol);
                wrapper.appendChild(roleRow);

                const actions = document.createElement('div');
                actions.className = 'mt-2';
                actions.appendChild(createSuggestionButton('Yes, add and link this author.', 'btn btn-success btn-sm mt-2', async () => {
                    const roleValue = buildAuthorRoleValue(roleSelect.value, customRoleInput.value);
                    if (roleValue?.error) {
                        setLookupActionError(roleValue.error);
                        return;
                    }
                    await approveSuggestedAuthor(index, roleValue);
                }));
                actions.appendChild(createSuggestionButton('No thanks.', 'btn btn-secondary btn-sm ms-2 mt-2', () => removeSuggestedAuthor(index)));
                wrapper.appendChild(actions);
                selectors.bookAuthorsSuggestionList.appendChild(wrapper);
            });
            showLookupSuggestionAlert(selectors.bookAuthorsSuggestionAlert, 'authors', { count: newAuthors.length });
        } else {
            hideLookupSuggestionAlert(selectors.bookAuthorsSuggestionAlert, 'authors');
        }

        if (selectors.bookSeriesSuggestionList) {
            selectors.bookSeriesSuggestionList.innerHTML = '';
        }
        if (selectors.bookSeriesSuggestionList && newSeries.length > 0) {
            newSeries.forEach((series, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'border-top pt-2 mt-2';

                const title = document.createElement('h6');
                title.className = 'mb-0';
                title.textContent = series.name || series.seriesName || 'Suggested Series';
                wrapper.appendChild(title);

                if (series.description) {
                    const description = document.createElement('p');
                    description.className = 'text-muted mb-1 small';
                    description.textContent = series.description;
                    wrapper.appendChild(description);
                }
                if (series.website) {
                    wrapper.appendChild(createDetailParagraph('Website', series.website));
                }
                if (Number.isInteger(series.bookOrder)) {
                    wrapper.appendChild(createDetailParagraph('Book order in this series', String(series.bookOrder)));
                }

                const actions = document.createElement('div');
                actions.appendChild(createSuggestionButton('Yes, add and link this series.', 'btn btn-success btn-sm mt-2', () => approveSuggestedSeries(index)));
                actions.appendChild(createSuggestionButton('No thanks.', 'btn btn-secondary btn-sm ms-2 mt-2', () => removeSuggestedSeries(index)));
                wrapper.appendChild(actions);
                selectors.bookSeriesSuggestionList.appendChild(wrapper);
            });
            showLookupSuggestionAlert(selectors.bookSeriesSuggestionAlert, 'series', { count: newSeries.length });
        } else {
            hideLookupSuggestionAlert(selectors.bookSeriesSuggestionAlert, 'series');
        }

        if (selectors.tagsSuggestionList) {
            selectors.tagsSuggestionList.innerHTML = '';
        }
        if (selectors.tagsSuggestionList && newTags.length > 0) {
            newTags.forEach((tag, index) => {
                const name = tag?.name || tag;
                const badge = document.createElement('span');
                badge.className = 'badge rounded-pill bg-light fw-normal border rounded-1 border-1 border-black d-inline-flex align-items-center me-2 mb-1';

                const label = document.createElement('span');
                label.className = 'fs-6 text-black d-flex align-items-center';
                label.textContent = name;

                const actionGroup = document.createElement('div');
                actionGroup.className = 'btn-group btn-group-sm gap-0 ms-1';
                const approveButton = createSuggestionButton('', 'btn btn-sm p-1', () => approveSuggestedTag(index));
                approveButton.setAttribute('aria-label', 'Approve suggested tag');
                approveButton.innerHTML = '<i class="bi bi-plus-square fs-6" aria-hidden="true"></i>';
                const rejectButton = createSuggestionButton('', 'btn d-flex align-items-center p-0', () => removeSuggestedTag(index));
                rejectButton.setAttribute('aria-label', 'Reject suggested tag');
                rejectButton.innerHTML = '<i class="bi bi-x-square fs-6" aria-hidden="true"></i>';
                actionGroup.appendChild(approveButton);
                actionGroup.appendChild(rejectButton);
                label.appendChild(actionGroup);
                badge.appendChild(label);
                selectors.tagsSuggestionList.appendChild(badge);
            });
            showLookupSuggestionAlert(selectors.tagsSuggestionAlert, 'tags', { count: newTags.length });
        } else {
            hideLookupSuggestionAlert(selectors.tagsSuggestionAlert, 'tags');
        }
    }

    function clearLookupAppliedState() {
        log('Clearing prior ISBN lookup-applied form state.');
        clearLookupSuggestions();
        setLookupActionError('');

        selectors.title.value = '';
        selectors.subtitle.value = '';
        selectors.isbn.value = '';
        if (selectors.deweyCode) selectors.deweyCode.value = '';
        selectors.publicationDate.value = '';
        selectors.pages.value = '';
        selectors.coverUrl.value = '';
        selectors.description.value = '';

        addBook.state.selections.bookTypeId = null;
        if (selectors.bookType) {
            selectors.bookType.value = 'none';
            updateBookTypeDisplay();
        }

        addBook.state.selections.publisherId = null;
        if (selectors.publisher) {
            selectors.publisher.value = 'none';
            updatePublisherDisplay();
        }

        addBook.state.selections.authors = [];
        renderAuthors();
        updateAuthorSearchAvailability();

        addBook.state.selections.series = [];
        renderSeries();
        updateSeriesSearchAvailability();

        addBook.state.languages.selected = [];
        addBook.events.dispatchEvent(new CustomEvent('languages:updated', { detail: [] }));

        addBook.state.selections.tags = [];
        addBook.events.dispatchEvent(new CustomEvent('tags:updated', { detail: [] }));
    }

    function applyLookupResult(payload) {
        const book = payload?.book || {};
        const existingEntities = payload?.existingEntities || {};
        clearLookupAppliedState();
        isbnLookupState.pending = {
            newEntities: payload?.newEntities || {},
            warnings: payload?.warnings || []
        };
        applyLookupBookFields(book);
        applyLookupExistingEntities(existingEntities, book);
        log('Applying new ISBN lookup result after reset.');
        renderLookupSuggestions();
    }

    function resetLookupUiState() {
        stopLookupProgressSimulation();
        clearLookupTimeout();
        updateLookupProgress(0);
        clearLookupSuggestions();
        if (selectors.isbnLookupInput && !isEditMode()) {
            selectors.isbnLookupInput.disabled = false;
        }
        if (selectors.isbnScanButton && !isEditMode()) {
            selectors.isbnScanButton.disabled = false;
        }
        if (selectors.isbnLookupButton && !isEditMode()) {
            selectors.isbnLookupButton.disabled = false;
            selectors.isbnLookupButton.classList.remove('disabled');
        }
    }

    function setLookupUiLoading(loading) {
        if (selectors.isbnLookupInput) {
            selectors.isbnLookupInput.disabled = loading || isEditMode();
        }
        if (selectors.isbnScanButton) {
            selectors.isbnScanButton.disabled = loading || isEditMode();
        }
        if (selectors.isbnLookupButton) {
            selectors.isbnLookupButton.disabled = loading || isEditMode() || !normalizeIsbn(selectors.isbnLookupInput?.value || '');
            selectors.isbnLookupButton.classList.toggle('disabled', selectors.isbnLookupButton.disabled);
        }
    }

    function setScannerStatus(message, type = 'secondary') {
        if (!selectors.isbnBarcodeScannerStatus) return;
        selectors.isbnBarcodeScannerStatus.classList.remove('alert-secondary', 'alert-info', 'alert-warning', 'alert-danger', 'alert-success');
        selectors.isbnBarcodeScannerStatus.classList.add(`alert-${type}`);
        selectors.isbnBarcodeScannerStatus.textContent = message || '';
    }

    function setScannerRetryEnabled(enabled) {
        if (!selectors.isbnBarcodeScannerRetry) return;
        selectors.isbnBarcodeScannerRetry.disabled = !enabled;
    }

    function setScannerPreviewVisible(visible) {
        selectors.isbnBarcodeScannerPreviewWrap?.classList.toggle('d-none', !visible);
    }

    function setScannerImageButtonsEnabled(enabled) {
        if (selectors.isbnBarcodeCaptureButton) {
            selectors.isbnBarcodeCaptureButton.disabled = !enabled;
        }
        if (selectors.isbnBarcodeUploadButton) {
            selectors.isbnBarcodeUploadButton.disabled = !enabled;
        }
    }

    function clearScannerImageInputs() {
        if (selectors.isbnBarcodeCaptureInput) {
            selectors.isbnBarcodeCaptureInput.value = '';
        }
        if (selectors.isbnBarcodeUploadInput) {
            selectors.isbnBarcodeUploadInput.value = '';
        }
    }

    function cleanupScannerImageObjectUrl() {
        if (isbnLookupState.scannerImageObjectUrl) {
            URL.revokeObjectURL(isbnLookupState.scannerImageObjectUrl);
            isbnLookupState.scannerImageObjectUrl = null;
        }
    }

    function stopBarcodeScanner() {
        if (isbnLookupState.scannerPollTimer) {
            window.clearTimeout(isbnLookupState.scannerPollTimer);
            isbnLookupState.scannerPollTimer = null;
        }
        if (isbnLookupState.scannerStream) {
            isbnLookupState.scannerStream.getTracks().forEach((track) => track.stop());
            isbnLookupState.scannerStream = null;
        }
        if (selectors.isbnBarcodeScannerVideo) {
            selectors.isbnBarcodeScannerVideo.pause();
            selectors.isbnBarcodeScannerVideo.srcObject = null;
        }
        isbnLookupState.scannerActive = false;
        isbnLookupState.scannerStarting = false;
    }

    function resetBarcodeScannerUi() {
        stopBarcodeScanner();
        cleanupScannerImageObjectUrl();
        isbnLookupState.scannerLookupTriggered = false;
        isbnLookupState.scannerSessionToken = 0;
        isbnLookupState.scannerImageProcessing = false;
        setScannerRetryEnabled(true);
        setScannerImageButtonsEnabled(true);
        setScannerPreviewVisible(true);
        clearScannerImageInputs();
        setScannerStatus('Select “Retry Scan” to start your camera, or close this window and enter the ISBN manually.', 'secondary');
    }

    function extractIsbnCandidateFromBarcode(rawValue) {
        const cleaned = String(rawValue || '').replace(/[^0-9Xx]/g, '');
        if (!cleaned) return null;
        const isbn13Match = cleaned.match(/97[89][0-9]{10}/);
        if (isbn13Match) return isbn13Match[0];
        const isbn10Match = cleaned.match(/[0-9]{9}[0-9Xx]/);
        return isbn10Match ? isbn10Match[0] : null;
    }

    async function getBarcodeDetector() {
        if (typeof window.BarcodeDetector === 'undefined') {
            return null;
        }
        if (!barcodeDetectorPromise) {
            barcodeDetectorPromise = (async () => {
                const preferredFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
                if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
                    try {
                        const supported = await window.BarcodeDetector.getSupportedFormats();
                        log('BarcodeDetector supported formats reported.', {
                            supportedFormats: Array.isArray(supported) ? supported : []
                        });
                        if (Array.isArray(supported)) {
                            const formats = preferredFormats.filter((format) => supported.includes(format));
                            if (formats.length > 0) {
                                try {
                                    return new window.BarcodeDetector({ formats });
                                } catch (error) {
                                    log('BarcodeDetector initialization with preferred formats failed; retrying with default detector.', {
                                        message: error?.message || 'Unknown error'
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        log('BarcodeDetector.getSupportedFormats failed; retrying with default detector.', {
                            message: error?.message || 'Unknown error'
                        });
                    }
                }
                return new window.BarcodeDetector();
            })().catch((error) => {
                console.error('[Add Book] Barcode detector initialization failed.', error);
                barcodeDetectorPromise = null;
                return null;
            });
        }
        return barcodeDetectorPromise;
    }

    async function getZxingReader() {
        if (!window.ZXing?.BrowserMultiFormatReader) {
            return null;
        }
        if (!zxingReaderPromise) {
            zxingReaderPromise = Promise.resolve(new window.ZXing.BrowserMultiFormatReader()).catch((error) => {
                console.error('[Add Book] ZXing reader initialization failed.', error);
                zxingReaderPromise = null;
                return null;
            });
        }
        return zxingReaderPromise;
    }

    function isZxingAvailable() {
        return Boolean(window.ZXing?.BrowserMultiFormatReader);
    }

    function hasZxingLoadFailed() {
        return Boolean(window.__ZXING_LOAD_FAILED__);
    }

    function hasImageScannerFallback() {
        return typeof window.BarcodeDetector !== 'undefined' || isZxingAvailable();
    }

    function getImageScannerUnavailableMessage() {
        if (hasZxingLoadFailed()) {
            return 'Photo barcode scanning is not available right now. Please try live scanning if available, or enter the ISBN manually.';
        }
        return 'Image barcode scanning is not available right now. Please try live scanning if available, or enter the ISBN manually.';
    }

    async function loadScannerImage(file) {
        cleanupScannerImageObjectUrl();
        const objectUrl = URL.createObjectURL(file);
        isbnLookupState.scannerImageObjectUrl = objectUrl;
        const image = new Image();
        image.decoding = 'async';
        return new Promise((resolve, reject) => {
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Unable to read selected image.'));
            image.src = objectUrl;
        });
    }

    async function detectBarcodeFromImageWithDetector(image) {
        const detector = await getBarcodeDetector();
        if (!detector || !image) return null;
        const detections = await detector.detect(image);
        const barcode = Array.isArray(detections) ? detections.find((entry) => entry?.rawValue) : null;
        return barcode?.rawValue || null;
    }

    async function detectBarcodeFromImageWithZxing(image) {
        const reader = await getZxingReader();
        if (!reader || !image) return null;
        const result = await reader.decodeFromImageElement(image);
        return result?.text || null;
    }

    function resetHardwareScannerBurst() {
        isbnLookupState.hardwareScannerBurstCount = 0;
        isbnLookupState.hardwareScannerBurstStartedAt = 0;
        isbnLookupState.hardwareScannerLastKeyAt = 0;
        isbnLookupState.hardwareScannerEndedWithEnter = false;
    }

    function registerHardwareScannerKey(event) {
        if (isEditMode()) return;
        if (event?.altKey || event?.ctrlKey || event?.metaKey) return;
        const key = event?.key || '';
        const isCharacterKey = key.length === 1 || key === 'Backspace' || key === 'Delete';
        if (!isCharacterKey && key !== 'Enter') return;
        const now = Date.now();
        if (!isbnLookupState.hardwareScannerBurstStartedAt || now - isbnLookupState.hardwareScannerLastKeyAt > 120) {
            resetHardwareScannerBurst();
            isbnLookupState.hardwareScannerBurstStartedAt = now;
        }
        isbnLookupState.hardwareScannerLastKeyAt = now;
        if (key === 'Enter') {
            isbnLookupState.hardwareScannerEndedWithEnter = true;
            return;
        }
        isbnLookupState.hardwareScannerBurstCount += 1;
    }

    function isLikelyHardwareScannerInput() {
        const duration = isbnLookupState.hardwareScannerLastKeyAt - isbnLookupState.hardwareScannerBurstStartedAt;
        if (isbnLookupState.hardwareScannerEndedWithEnter) {
            return isbnLookupState.hardwareScannerBurstCount >= 8 && duration >= 0 && duration <= 900;
        }
        if (isbnLookupState.hardwareScannerBurstCount < 10) return false;
        return duration >= 0 && duration <= 500;
    }

    async function triggerLookupFromNormalizedIsbn(normalized, source) {
        if (!normalized || isEditMode()) return;
        const now = Date.now();
        if (isbnLookupState.lastAutoLookupIsbn === normalized && (now - isbnLookupState.lastAutoLookupAt) < 2000) {
            return;
        }
        isbnLookupState.lastAutoLookupIsbn = normalized;
        isbnLookupState.lastAutoLookupAt = now;
        if (selectors.isbnLookupInput) {
            selectors.isbnLookupInput.value = normalized;
            triggerInput(selectors.isbnLookupInput);
        }
        log('ISBN auto-lookup triggered from scan.', { source, normalized });
        await handleIsbnLookup();
    }

    function scheduleHardwareScannerLookup() {
        if (isbnLookupState.hardwareScannerTimer) {
            window.clearTimeout(isbnLookupState.hardwareScannerTimer);
            isbnLookupState.hardwareScannerTimer = null;
        }
        isbnLookupState.hardwareScannerTimer = window.setTimeout(async () => {
            const currentValue = selectors.isbnLookupInput?.value.trim() || '';
            const normalized = normalizeIsbn(currentValue);
            if (!normalized || !isLikelyHardwareScannerInput()) {
                return;
            }
            log('Hardware scanner input detected.', {
                normalized,
                burstCount: isbnLookupState.hardwareScannerBurstCount,
                endedWithEnter: isbnLookupState.hardwareScannerEndedWithEnter
            });
            resetHardwareScannerBurst();
            await triggerLookupFromNormalizedIsbn(normalized, 'hardware scanner');
        }, 140);
    }

    async function handleDetectedBarcode(rawValue, source = 'camera barcode') {
        if (isbnLookupState.scannerLookupTriggered || isEditMode()) return;
        const candidate = extractIsbnCandidateFromBarcode(rawValue);
        const normalized = normalizeIsbn(candidate || '');
        if (!normalized) {
            log('Invalid barcode detected.', { source, rawValue });
            setScannerStatus('That barcode was detected, but it does not look like a valid ISBN. Try again or enter the ISBN manually.', 'warning');
            return;
        }
        isbnLookupState.scannerLookupTriggered = true;
        log('Valid barcode detected.', { source, normalized });
        setScannerStatus(`Valid ISBN detected: ${normalized}. Starting lookup...`, 'success');
        if (selectors.isbnLookupInput) {
            selectors.isbnLookupInput.value = normalized;
            triggerInput(selectors.isbnLookupInput);
        }
        await hideModal(selectors.isbnBarcodeScannerModal);
        await triggerLookupFromNormalizedIsbn(normalized, source);
    }

    async function processScannerImageFile(file, source) {
        if (!file || isbnLookupState.scannerLookupTriggered || isbnLookupState.scannerImageProcessing || isEditMode()) return;
        if (file.type && !file.type.startsWith('image/')) {
            setScannerStatus('Please choose an image file that contains the barcode.', 'warning');
            clearScannerImageInputs();
            return;
        }
        isbnLookupState.scannerImageProcessing = true;
        stopBarcodeScanner();
        setScannerRetryEnabled(false);
        setScannerImageButtonsEnabled(false);
        try {
            log('Fallback image mode used.', { source });
            log('Image selected for barcode scan.', {
                source,
                fileName: file.name || null,
                fileType: file.type || null,
                fileSize: file.size || null
            });
            setScannerStatus('Processing the selected image for a barcode...', 'info');
            const image = await loadScannerImage(file);

            let rawValue = null;
            let detectorAttempted = false;
            try {
                detectorAttempted = true;
                rawValue = await detectBarcodeFromImageWithDetector(image);
            } catch (error) {
                log('Image barcode detection with BarcodeDetector failed.', { source, message: error?.message || 'Unknown error' });
            }

            if (!rawValue) {
                if (!isZxingAvailable()) {
                    if (!detectorAttempted) {
                        log('Image barcode fallback unavailable.', {
                            source,
                            zxingLoadFailed: hasZxingLoadFailed()
                        });
                        setScannerStatus(getImageScannerUnavailableMessage(), 'danger');
                        return;
                    }
                    log('Image barcode backup scanner unavailable after detector attempt.', {
                        source,
                        zxingLoadFailed: hasZxingLoadFailed()
                    });
                    setScannerStatus(
                        'We could not read a barcode from that image, and the backup image scanner is not available right now. Try another photo, use live scanning if available, or enter the ISBN manually.',
                        'warning'
                    );
                    return;
                }
                rawValue = await detectBarcodeFromImageWithZxing(image);
            }

            if (!rawValue) {
                log('Invalid/no barcode detected from image.', { source });
                setScannerStatus('We could not find a readable ISBN barcode in that image. Try another photo, or enter the ISBN manually.', 'warning');
                return;
            }

            log('Barcode detected from image.', { source, rawValue });
            await handleDetectedBarcode(rawValue, source);
            if (!isbnLookupState.scannerLookupTriggered) {
                log('Invalid/no barcode detected from image.', { source });
                setScannerStatus('A barcode was found in the image, but it did not look like a valid ISBN. Try another photo, or enter the ISBN manually.', 'warning');
            }
        } catch (error) {
            console.error('[Add Book] Image barcode processing failed.', error);
            setScannerStatus('We could not process that image. Try another photo, or enter the ISBN manually.', 'danger');
            log('Image barcode processing failed.', { source, message: error?.message || 'Unknown error' });
        } finally {
            cleanupScannerImageObjectUrl();
            clearScannerImageInputs();
            isbnLookupState.scannerImageProcessing = false;
            if (!isbnLookupState.scannerLookupTriggered) {
                setScannerRetryEnabled(true);
                setScannerImageButtonsEnabled(true);
            }
        }
    }

    async function pollBarcodeDetections(detector, sessionToken) {
        if (!detector || !selectors.isbnBarcodeScannerVideo) return;
        if (!isbnLookupState.scannerActive || isbnLookupState.scannerSessionToken !== sessionToken) return;
        try {
            const video = selectors.isbnBarcodeScannerVideo;
            if (video.readyState >= 2) {
                const detections = await detector.detect(video);
                const barcode = Array.isArray(detections) ? detections.find((entry) => entry?.rawValue) : null;
                if (barcode?.rawValue) {
                    await handleDetectedBarcode(barcode.rawValue);
                    if (isbnLookupState.scannerLookupTriggered) {
                        return;
                    }
                }
            }
        } catch (error) {
            console.error('[Add Book] Barcode scanning failed.', error);
            setScannerStatus('We couldn’t read the barcode from the camera feed. Try holding the barcode closer and steadier.', 'warning');
            log('Barcode scanning failed.', { message: error?.message || 'Unknown error' });
        }
        if (!isbnLookupState.scannerActive || isbnLookupState.scannerSessionToken !== sessionToken) return;
        isbnLookupState.scannerPollTimer = window.setTimeout(() => {
            pollBarcodeDetections(detector, sessionToken);
        }, 250);
    }

    async function startBarcodeScanner() {
        if (isEditMode()) return;
        if (isbnLookupState.scannerStarting) return;
        stopBarcodeScanner();
        isbnLookupState.scannerLookupTriggered = false;
        isbnLookupState.scannerStarting = true;
        setScannerRetryEnabled(false);
        setScannerImageButtonsEnabled(false);
        const hasBarcodeDetector = typeof window.BarcodeDetector !== 'undefined';
        const hasSupportedFormatsApi = typeof window.BarcodeDetector?.getSupportedFormats === 'function';
        const hasCameraAccess = Boolean(navigator.mediaDevices?.getUserMedia);
        log('Live barcode scan capability check.', {
            hasBarcodeDetector,
            hasSupportedFormatsApi,
            hasGetUserMedia: hasCameraAccess
        });
        const detector = await getBarcodeDetector();
        if (!detector) {
            isbnLookupState.scannerStarting = false;
            setScannerRetryEnabled(false);
            setScannerImageButtonsEnabled(hasImageScannerFallback());
            setScannerPreviewVisible(false);
            setScannerStatus(
                hasImageScannerFallback()
                    ? 'Live camera scanning is not supported in this browser. You can still take a photo or upload one to scan the barcode, or enter the ISBN manually.'
                    : getImageScannerUnavailableMessage(),
                'warning'
            );
            log('Fallback-only scanner mode selected.', {
                reason: hasBarcodeDetector ? 'barcode_detector_initialization_failed' : 'barcode_detector_missing',
                hasImageScannerFallback: hasImageScannerFallback()
            });
            return;
        }
        if (!hasCameraAccess) {
            isbnLookupState.scannerStarting = false;
            setScannerRetryEnabled(false);
            setScannerImageButtonsEnabled(hasImageScannerFallback());
            setScannerPreviewVisible(false);
            setScannerStatus(
                hasImageScannerFallback()
                    ? 'Live camera scanning is not available in this browser. You can still take a photo or upload one to scan the barcode, or enter the ISBN manually.'
                    : getImageScannerUnavailableMessage(),
                'warning'
            );
            log('Fallback-only scanner mode selected.', {
                reason: 'getusermedia_missing',
                hasImageScannerFallback: hasImageScannerFallback()
            });
            return;
        }

        try {
            log('Live barcode scanning supported.');
            log('Camera permission requested.');
            setScannerStatus('Requesting camera access...', 'info');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' }
                },
                audio: false
            });
            if (!selectors.isbnBarcodeScannerModal?.classList.contains('show')) {
                stream.getTracks().forEach((track) => track.stop());
                isbnLookupState.scannerStarting = false;
                setScannerRetryEnabled(true);
                setScannerImageButtonsEnabled(true);
                log('Scanner modal closed before camera access completed.');
                return;
            }
            isbnLookupState.scannerStream = stream;
            isbnLookupState.scannerActive = true;
            isbnLookupState.scannerStarting = false;
            setScannerRetryEnabled(true);
            setScannerImageButtonsEnabled(true);
            setScannerPreviewVisible(true);
            isbnLookupState.scannerSessionToken = Date.now();
            if (selectors.isbnBarcodeScannerVideo) {
                selectors.isbnBarcodeScannerVideo.srcObject = stream;
                await selectors.isbnBarcodeScannerVideo.play();
            }
            log('Camera permission granted.');
            setScannerStatus('Scanning for a barcode...', 'info');
            log('Barcode scanning started.', { sessionToken: isbnLookupState.scannerSessionToken });
            pollBarcodeDetections(detector, isbnLookupState.scannerSessionToken);
        } catch (error) {
            isbnLookupState.scannerStarting = false;
            setScannerRetryEnabled(true);
            setScannerImageButtonsEnabled(true);
            const denied = /denied|notallowed/i.test(error?.name || '') || /denied|notallowed/i.test(error?.message || '');
            log(denied ? 'Camera permission denied.' : 'Camera scanning could not start.', {
                message: error?.message || 'Unknown error'
            });
            setScannerStatus(
                denied
                    ? 'Camera access was denied. You can allow access and retry, take/upload a photo instead, or enter the ISBN manually.'
                    : 'We could not start the camera. Try again, use a photo instead, or enter the ISBN manually.',
                'danger'
            );
        }
    }

    async function openBarcodeScannerModal() {
        if (isEditMode()) return;
        log('Scanner modal opened.');
        setScannerRetryEnabled(false);
        setScannerImageButtonsEnabled(false);
        setScannerStatus('Opening camera scanner...', 'info');
        await showModal(selectors.isbnBarcodeScannerModal, { backdrop: 'static', keyboard: true });
        await startBarcodeScanner();
    }

    async function handleIsbnLookup() {
        if (isEditMode()) return;
        const requestToken = Date.now();
        isbnLookupState.activeRequestToken = requestToken;
        setLookupActionError('');
        clearLookupSuggestions();
        const rawIsbn = selectors.isbnLookupInput?.value.trim() || '';
        const normalized = normalizeIsbn(rawIsbn);
        log('ISBN lookup started.', { rawIsbn, requestToken });
        if (!normalized) {
            log('ISBN lookup blocked by invalid ISBN.', { rawIsbn, requestToken });
            setHelpText(selectors.isbnLookupHelp, 'ISBN must be a valid ISBN-10 or ISBN-13 using digits and optional X (last character for ISBN-10).', true);
            return;
        }
        log('ISBN lookup normalized ISBN.', { rawIsbn, normalized, requestToken });
        setHelpText(selectors.isbnLookupHelp, `This ISBN will be looked up as: ${normalized}`, false);
        setLookupUiLoading(true);
        updateLookupProgress(0);
        const startedAt = Date.now();
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        try {
            log('ISBN lookup showing loading modal...', { requestToken });
            await showModal(selectors.isbnLookupLoadingModal, { backdrop: 'static', keyboard: false });
            log('ISBN lookup loading modal shown.', { requestToken });
            startLookupProgressSimulation(requestToken);
            clearLookupTimeout();
            if (controller) {
                isbnLookupState.timeoutId = window.setTimeout(() => {
                    if (isbnLookupState.activeRequestToken !== requestToken) return;
                    log('ISBN lookup timeout reached.', { requestToken, normalized, timeoutMs: 10000 });
                    controller.abort();
                }, 10000);
            }
            log('ISBN lookup request sending...', {
                requestToken,
                path: '/book/isbn-lookup',
                isbn: normalized
            });
            const requestPromise = apiFetch('/book/isbn-lookup', {
                method: 'POST',
                body: JSON.stringify({ isbn: normalized }),
                signal: controller?.signal
            });
            const response = controller
                ? await requestPromise
                : await Promise.race([
                    requestPromise,
                    new Promise((_, reject) => {
                        isbnLookupState.timeoutId = window.setTimeout(() => {
                            if (isbnLookupState.activeRequestToken !== requestToken) return;
                            log('ISBN lookup timeout reached.', { requestToken, normalized, timeoutMs: 10000 });
                            reject(new Error('Request timed out.'));
                        }, 10000);
                    })
                ]);
            if (isbnLookupState.activeRequestToken !== requestToken) {
                log('ISBN lookup response ignored because a newer request is active.', { requestToken });
                return;
            }
            const durationMs = Date.now() - startedAt;
            rememberLookupDuration(durationMs);
            log('ISBN lookup response received.', {
                requestToken,
                status: response.status,
                ok: response.ok,
                durationMs
            });
            const data = await readApiPayload(response);
            log('ISBN lookup response payload parsed.', {
                requestToken,
                message: data?.message || null,
                warningsCount: Array.isArray(data?.data?.warnings) ? data.data.warnings.length : 0,
                hasBook: Boolean(data?.data?.book)
            });
            if (!response.ok) {
                const normalizedError = typeof window.normalizeApiErrorPayload === 'function'
                    ? window.normalizeApiErrorPayload(data, 'Unable to look up that ISBN.')
                    : { message: data.message || 'Unable to look up that ISBN.', errors: data.errors || [] };
                if (response.status === 404) {
                    log('ISBN lookup returned no metadata.', { requestToken, normalized });
                    await finalizeLookupProgress(requestToken, { success: false });
                    await hideLookupLoadingModalSafely();
                    await showModal(selectors.isbnLookupErrorModal);
                } else {
                    log('ISBN lookup returned handled error.', {
                        requestToken,
                        status: response.status,
                        message: normalizedError.message,
                        errors: normalizedError.errors
                    });
                    setHelpText(selectors.isbnLookupHelp, normalizedError.message, true);
                    await finalizeLookupProgress(requestToken, { success: false });
                    await hideLookupLoadingModalSafely();
                }
                return;
            }
            await finalizeLookupProgress(requestToken, { success: true });
            applyLookupResult(data.data || {});
            log('ISBN lookup succeeded.', {
                requestToken,
                warnings: Array.isArray(data?.data?.warnings) ? data.data.warnings : []
            });
            await hideLookupLoadingModalSafely();
        } catch (error) {
            if (isbnLookupState.activeRequestToken !== requestToken) {
                log('ISBN lookup exception ignored because a newer request is active.', { requestToken });
                return;
            }
            const isTimeout = controller?.signal?.aborted || error?.name === 'AbortError' || /timed out/i.test(error?.message || '');
            if (isTimeout) {
                log('ISBN lookup timed out.', { requestToken, normalized, timeoutMs: 10000 });
                setHelpText(selectors.isbnLookupHelp, 'ISBN lookup timed out after 10 seconds. Please try again.', true);
            } else {
                console.error('[Add Book] ISBN lookup failed.', error);
                log('ISBN lookup failed.', {
                    requestToken,
                    normalized,
                    message: error?.message || 'Unknown error'
                });
                setHelpText(selectors.isbnLookupHelp, 'Unable to look up that ISBN right now. Please try again.', true);
            }
            await finalizeLookupProgress(requestToken, { success: false });
            await hideLookupLoadingModalSafely();
        } finally {
            if (isbnLookupState.activeRequestToken === requestToken) {
                clearLookupTimeout();
                stopLookupProgressSimulation();
                setLookupUiLoading(false);
                log('ISBN lookup UI state restored.', { requestToken });
            }
        }
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
        log('Edit-book fetch start:', editState.bookId);
        try {
            const response = await apiFetch(`/book?id=${editState.bookId}`, { method: 'GET' });
            log('Edit-book fetch response received:', { status: response.status, bookId: editState.bookId });
            if (response.status === 429) {
                rateLimitGuard?.record(response);
                return false;
            }
            const data = await readApiPayload(response);
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
            log('Edit-book form population complete:', book.id);
            return true;
        } catch (error) {
            console.error('[Add Book] Edit load error path hit.', error);
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
        const normalizedDeweyCode = normalizeDeweyCode(selectors.deweyCode?.value || '');
        const normalizedCoverUrl = normalizeUrl(selectors.coverUrl.value.trim());

        const payload = {
            title: selectors.title.value.trim(),
            subtitle: selectors.subtitle.value.trim() || null,
            isbn: normalizedIsbn || null,
            deweyCode: normalizedDeweyCode || null,
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

        const rawDeweyCode = selectors.deweyCode?.value.trim() || '';
        if (rawDeweyCode) {
            const normalizedDewey = normalizeDeweyCode(rawDeweyCode);
            if (!window.deweyClient?.isValidCode(normalizedDewey)) {
                errors.push('Dewey Code must be 1 to 3 digits, with an optional decimal part such as 513.2.');
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

        const deweyCode = selectors.deweyCode?.value.trim() || '';
        if (deweyCode) {
            const normalizedDewey = normalizeDeweyCode(deweyCode);
            if (!window.deweyClient?.isValidCode(normalizedDewey)) {
                return selectors.deweyCode;
            }
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
        if (selectors.bookTypeSuggestionApprove) {
            selectors.bookTypeSuggestionApprove.addEventListener('click', async () => {
                selectors.bookTypeSuggestionApprove.disabled = true;
                try {
                    await approveSuggestedBookType();
                } finally {
                    if (selectors.bookTypeSuggestionApprove?.isConnected) {
                        selectors.bookTypeSuggestionApprove.disabled = false;
                    }
                }
            });
        }
        selectors.bookTypeSuggestionReject?.addEventListener('click', clearSuggestedBookType);
        if (selectors.bookPublisherSuggestionApprove) {
            selectors.bookPublisherSuggestionApprove.addEventListener('click', async () => {
                selectors.bookPublisherSuggestionApprove.disabled = true;
                try {
                    await approveSuggestedPublisher();
                } finally {
                    if (selectors.bookPublisherSuggestionApprove?.isConnected) {
                        selectors.bookPublisherSuggestionApprove.disabled = false;
                    }
                }
            });
        }
        selectors.bookPublisherSuggestionReject?.addEventListener('click', removeSuggestedPublisher);

        if (selectors.isbnLookupInput) {
            selectors.isbnLookupInput.disabled = isEditMode();
            selectors.isbnLookupInput.addEventListener('paste', () => {
                if (isEditMode()) return;
                log('ISBN paste detected in lookup field.');
                window.setTimeout(async () => {
                    const value = selectors.isbnLookupInput?.value.trim() || '';
                    const normalized = normalizeIsbn(value);
                    resetHardwareScannerBurst();
                    if (!normalized) {
                        return;
                    }
                    log('Valid pasted ISBN detected.', { normalized });
                    await triggerLookupFromNormalizedIsbn(normalized, 'paste');
                }, 0);
            });
            selectors.isbnLookupInput.addEventListener('input', () => {
                const value = selectors.isbnLookupInput.value.trim();
                if (!value) {
                    clearHelpText(selectors.isbnLookupHelp);
                    setLookupUiLoading(false);
                    selectors.isbnLookupButton.disabled = true;
                    selectors.isbnLookupButton.classList.add('disabled');
                    resetHardwareScannerBurst();
                    return;
                }
                const normalized = normalizeIsbn(value);
                if (!normalized) {
                    setHelpText(selectors.isbnLookupHelp, 'ISBN must be a valid ISBN-10 or ISBN-13 using digits and optional X (last character for ISBN-10).', true);
                    selectors.isbnLookupButton.disabled = true;
                    selectors.isbnLookupButton.classList.add('disabled');
                    scheduleHardwareScannerLookup();
                    return;
                }
                setHelpText(selectors.isbnLookupHelp, `This ISBN will be looked up as: ${normalized}`, false);
                selectors.isbnLookupButton.disabled = isEditMode();
                selectors.isbnLookupButton.classList.toggle('disabled', selectors.isbnLookupButton.disabled);
                scheduleHardwareScannerLookup();
            });
            selectors.isbnLookupInput.addEventListener('keydown', (event) => {
                registerHardwareScannerKey(event);
                if (event.key !== 'Enter') return;
                event.preventDefault();
                const normalized = normalizeIsbn(selectors.isbnLookupInput.value.trim());
                if (normalized && isLikelyHardwareScannerInput()) {
                    log('Hardware scanner input detected.', { normalized, endedWithEnter: true });
                    resetHardwareScannerBurst();
                    triggerLookupFromNormalizedIsbn(normalized, 'hardware scanner');
                    return;
                }
                handleIsbnLookup();
            });
        }
        if (selectors.isbnScanButton) {
            selectors.isbnScanButton.disabled = isEditMode();
            selectors.isbnScanButton.addEventListener('click', openBarcodeScannerModal);
        }
        if (selectors.isbnLookupButton) {
            selectors.isbnLookupButton.disabled = true;
            selectors.isbnLookupButton.classList.add('disabled');
            selectors.isbnLookupButton.addEventListener('click', handleIsbnLookup);
        }
        if (selectors.isbnLookupForm) {
            selectors.isbnLookupForm.addEventListener('submit', (event) => {
                event.preventDefault();
                handleIsbnLookup();
            });
        }
        selectors.isbnBarcodeScannerRetry?.addEventListener('click', () => {
            log('Barcode scanner retry requested.');
            startBarcodeScanner();
        });
        selectors.isbnBarcodeCaptureButton?.addEventListener('click', () => {
            if (isEditMode()) return;
            stopBarcodeScanner();
            setScannerStatus('Choose or capture a barcode photo to continue.', 'info');
            selectors.isbnBarcodeCaptureInput?.click();
        });
        selectors.isbnBarcodeUploadButton?.addEventListener('click', () => {
            if (isEditMode()) return;
            stopBarcodeScanner();
            setScannerStatus('Choose a barcode image to continue.', 'info');
            selectors.isbnBarcodeUploadInput?.click();
        });
        selectors.isbnBarcodeCaptureInput?.addEventListener('change', (event) => {
            const file = event.target?.files?.[0];
            if (!file) return;
            processScannerImageFile(file, 'captured barcode image');
        });
        selectors.isbnBarcodeUploadInput?.addEventListener('change', (event) => {
            const file = event.target?.files?.[0];
            if (!file) return;
            processScannerImageFile(file, 'uploaded barcode image');
        });
        selectors.isbnBarcodeScannerModal?.addEventListener('hide.bs.modal', () => {
            stopBarcodeScanner();
        });
        selectors.isbnBarcodeScannerModal?.addEventListener('hidden.bs.modal', () => {
            resetBarcodeScannerUi();
            log('Scanner modal closed.');
        });
        window.addEventListener('pagehide', stopBarcodeScanner);

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
        selectors.deweyCode?.addEventListener('input', () => {
            interpretDeweyInput();
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
        log('Initializing Add Book page...', { editMode: isEditMode(), bookId: editState.bookId });
        let listOk = false;
        let editOk = true;
        let allOk = false;
        let results = [];
        let shouldShowRateLimitModal = false;
        let shouldCheckAuthAfterReady = false;

        try {
            if (invalidEditParam) {
                log('Invalid edit parameter detected.', editParam);
                await showInvalidEditModal('We couldn’t find that book. Please return to your books list and try again.');
                return;
            }

            attachEvents();
            applyEditModeUI();
            resetLookupUiState();
            renderAuthors();
            renderSeries();
            await initializeDeweyField();

            log('Starting initial Add Book data loads...');
            results = await Promise.allSettled([
                loadLanguages(),
                loadBookTypes(),
                loadPublishers(),
                loadAuthors(),
                loadSeries(),
                loadLocations()
            ]);
            log('Initial Add Book data loads complete.');
            listOk = results.every((result) => result.status === 'fulfilled' && result.value === true);

            log('Starting edit-book load...');
            editOk = await loadBookForEdit();
            log('Edit-book load complete.', { editOk });
            allOk = listOk && editOk;

            log('Checking rate-limit guard...');
            if (rateLimitGuard?.hasReset()) {
                shouldShowRateLimitModal = true;
                log('Rate-limit guard active; deferring modal until after readiness release.');
                return;
            }
            log('Rate-limit guard clear.');

            if (!allOk) {
                log('One or more Add Book data loads failed.', { listOk, editOk, results });
            }

            if (window.authGuard && typeof window.authGuard.checkSessionAndPrompt === 'function') {
                shouldCheckAuthAfterReady = true;
                log('Deferring auth guard check until after readiness release.');
            }

            log('Initialization complete.', { allOk });
        } catch (error) {
            allOk = false;
            console.error('[Add Book] Initialization error path hit.', error);
            if (isEditMode()) {
                showEditLoadError();
            }
        } finally {
            log('Initialize finally entered.');
            if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
                try {
                    log('Resolving page content readiness.', { success: allOk, listOk, editOk });
                    window.pageContentReady.resolve({ success: allOk, listOk, editOk });
                    log('Page content readiness resolved.');
                } catch (resolveError) {
                    console.error('[Add Book] Failed to resolve page content readiness.', resolveError);
                }
            }
        }

        setTimeout(async () => {
            if (shouldShowRateLimitModal) {
                try {
                    log('Showing deferred rate-limit modal...');
                    await rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
                    log('Deferred rate-limit modal completed.');
                } catch (rateLimitError) {
                    console.error('[Add Book] Deferred rate-limit modal failed.', rateLimitError);
                }
                return;
            }

            if (shouldCheckAuthAfterReady) {
                try {
                    log('Starting deferred auth guard check...');
                    await window.authGuard.checkSessionAndPrompt({ waitForMaintenance: true });
                    log('Deferred auth guard check complete.');
                } catch (authGuardError) {
                    console.error('[Add Book] Deferred auth guard check failed.', authGuardError);
                }
            }
        }, 0);
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();
