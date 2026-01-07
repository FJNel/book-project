// Handles the review + submit flow for Add Book.
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const { byId, showAlert, showAlertWithDetails, hideAlert, setButtonLoading, bindModalLock, setModalLocked } = addBook.utils;
    const log = (...args) => console.log('[Add Book][Review]', ...args);

    const reviewButton = byId('reviewAddBookBtn');
    const modalEl = byId('reviewAddBookModal');
    const summaryEl = byId('reviewSummary');
    const errorAlert = byId('reviewErrorsAlert');
    const dryRunAlert = byId('reviewDryRunAlert');
    const confirmButton = byId('confirmAddBookBtn');
    const confirmSpinner = byId('confirmAddBookSpinner');

    if (!reviewButton || !modalEl) return;

    const redirectBase = window.ADD_BOOK_REDIRECT_BASE || '/books';
    const modalState = { locked: false };

    bindModalLock(modalEl, modalState);

    function renderSummary(payload) {
        if (!summaryEl) return;
        summaryEl.innerHTML = '';

        const bookTypeName = payload.bookTypeId
            ? addBook.state.bookTypes.find((entry) => entry.id === payload.bookTypeId)?.name
            : null;
        const publisherName = payload.publisherId
            ? addBook.state.publishers.find((entry) => entry.id === payload.publisherId)?.name
            : null;
        const languageNames = addBook.state.languages.selected.map((lang) => lang.name);
        const authorNames = addBook.state.selections.authors.map((author) => {
            const role = author.role === 'Other' ? (author.customRole || 'Other') : author.role;
            return role ? `${author.displayName} (${role})` : author.displayName;
        });
        const seriesNames = addBook.state.selections.series.map((series) => {
            return series.order ? `${series.name} (#${series.order})` : series.name;
        });

        function createChip(text) {
            const chip = document.createElement('span');
            chip.className = 'badge rounded-pill bg-light text-dark border me-1 mb-1';
            chip.textContent = text;
            return chip;
        }

        function addSection(title, entries) {
            const section = document.createElement('div');
            section.className = 'mb-3';
            const heading = document.createElement('h5');
            heading.textContent = title;
            heading.className = 'mb-2';
            section.appendChild(heading);

            const list = document.createElement('ul');
            list.className = 'list-group';
            entries.forEach(([label, value]) => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                const row = document.createElement('div');
                row.className = 'd-flex flex-column flex-md-row justify-content-between gap-2';
                const name = document.createElement('span');
                name.className = 'fw-semibold';
                name.textContent = label;
                const val = document.createElement('span');
                val.className = 'text-break';
                if (Array.isArray(value)) {
                    if (!value.length) {
                        val.textContent = '—';
                    } else {
                        const chipRow = document.createElement('span');
                        chipRow.className = 'd-flex flex-wrap gap-1';
                        value.forEach((item) => chipRow.appendChild(createChip(item)));
                        val.appendChild(chipRow);
                    }
                } else {
                    val.textContent = value || '—';
                }
                row.appendChild(name);
                row.appendChild(val);
                li.appendChild(row);
                list.appendChild(li);
            });
            section.appendChild(list);
            summaryEl.appendChild(section);
        }

        addSection('Book Details', [
            ['Title', payload.title],
            ['Subtitle', payload.subtitle],
            ['ISBN', payload.isbn],
            ['Publication Date', payload.publicationDate?.text ? [payload.publicationDate.text] : null],
            ['Page Count', payload.pageCount],
            ['Book Type', bookTypeName],
            ['Publisher', publisherName],
            ['Languages', languageNames.length ? languageNames : null],
            ['Tags', payload.tags?.length ? payload.tags : null]
        ]);

        const listSection = document.createElement('div');
        listSection.className = 'mb-3';
        const listHeading = document.createElement('h5');
        listHeading.textContent = 'People & Series';
        listHeading.className = 'mb-2';
        listSection.appendChild(listHeading);

        const authorList = document.createElement('ul');
        authorList.className = 'list-group mb-2';
        if (authorNames.length) {
            authorNames.forEach((name) => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.textContent = name;
                authorList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = 'No authors selected.';
            authorList.appendChild(li);
        }
        listSection.appendChild(authorList);

        const seriesList = document.createElement('ul');
        seriesList.className = 'list-group';
        if (seriesNames.length) {
            seriesNames.forEach((name) => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.textContent = name;
                seriesList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = 'No series selected.';
            seriesList.appendChild(li);
        }
        listSection.appendChild(seriesList);
        summaryEl.appendChild(listSection);

        addSection('Copy Details', [
            ['Storage Location', payload.bookCopy?.storageLocationPath],
            ['Acquisition Date', payload.bookCopy?.acquisitionDate?.text ? [payload.bookCopy.acquisitionDate.text] : null],
            ['Acquired From', payload.bookCopy?.acquiredFrom],
            ['Acquisition Type', payload.bookCopy?.acquisitionType],
            ['Acquisition Location', payload.bookCopy?.acquisitionLocation]
        ]);

        addSection('Additional Details', [
            ['Cover Image URL', payload.coverImageUrl],
            ['Description', payload.description],
            ['Copy Notes', payload.bookCopy?.notes]
        ]);
    }

    async function runDryRun() {
        hideAlert(errorAlert);
        hideAlert(dryRunAlert);
        confirmButton.disabled = true;

        if (typeof addBook.validateMainForm !== 'function') {
            showAlertWithDetails(errorAlert, 'Validation is not available yet.', 'Please refresh the page.');
            log('validateMainForm is unavailable.', addBook);
            return;
        }
        const validationErrors = addBook.validateMainForm();
        if (validationErrors.length) {
            showAlertWithDetails(errorAlert, 'Please fix the following:', validationErrors);
            log('Dry run blocked by validation errors.');
            return;
        }

        const payload = addBook.buildPayload({ dryRun: true });
        renderSummary(payload);
        log('Running dry run with payload:', payload);

        try {
            const response = await apiFetch('/book', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errors = data.errors && data.errors.length ? data.errors : [data.message || 'Validation failed.'];
                showAlertWithDetails(errorAlert, 'We could not validate this book yet:', errors);
                confirmButton.disabled = true;
                log('Dry run failed:', errors);
                return;
            }
            showAlertWithDetails(dryRunAlert, data.message || 'Ready to be added.');
            confirmButton.disabled = false;
            log('Dry run succeeded.');
        } catch (error) {
            showAlertWithDetails(errorAlert, 'Unable to validate the book right now.');
            confirmButton.disabled = true;
            log('Dry run exception:', error);
        }
    }

    async function submitBook() {
        modalState.locked = true;
        setModalLocked(modalEl, true);
        setButtonLoading(confirmButton, confirmSpinner, true);
        const payload = addBook.buildPayload({ dryRun: false });
        log('Submitting book payload:', payload);

        try {
            const response = await apiFetch('/book', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errors = data.errors && data.errors.length ? data.errors : [data.message || 'Failed to add book.'];
                showAlertWithDetails(errorAlert, 'Unable to add this book:', errors);
                log('Submit failed:', errors);
                return;
            }
            const id = data.data?.id;
            let target = redirectBase;
            if (id) {
                if (redirectBase.includes('{id}')) {
                    target = redirectBase.replace('{id}', id);
                } else if (redirectBase.includes('?') || redirectBase.endsWith('=')) {
                    target = `${redirectBase}${id}`;
                } else {
                    target = `${redirectBase}/${id}`;
                }
            }
            log('Book created. Redirecting to:', target);
            window.location.href = target;
        } catch (error) {
            showAlertWithDetails(errorAlert, 'Unable to add the book right now.');
            log('Submit exception:', error);
        } finally {
            setButtonLoading(confirmButton, confirmSpinner, false);
            modalState.locked = false;
            setModalLocked(modalEl, false);
        }
    }

    reviewButton.addEventListener('click', () => {
        if (typeof addBook.validateMainForm === 'function') {
            const validationErrors = addBook.validateMainForm();
            if (validationErrors.length) {
                const targetField = typeof addBook.focusFirstInvalidField === 'function'
                    ? addBook.focusFirstInvalidField()
                    : null;
                if (targetField && typeof targetField.focus === 'function') {
                    targetField.scrollIntoView({ block: 'center' });
                    requestAnimationFrame(() => {
                        targetField.focus({ preventScroll: true });
                    });
                }
                log('Review blocked by validation errors.', validationErrors);
                return;
            }
        }
        if (window.modalManager && typeof window.modalManager.showModal === 'function') {
            window.modalManager.showModal(modalEl, { backdrop: 'static', keyboard: false });
        } else {
            const modal = window.bootstrap?.Modal.getOrCreateInstance(modalEl, { backdrop: 'static', keyboard: false });
            if (!modal) {
                return;
            }
            modal.show();
        }
        runDryRun();
    });

    confirmButton.addEventListener('click', submitBook);
})();
