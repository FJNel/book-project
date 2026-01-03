// Handles the review + submit flow for Add Book.
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const { byId, showAlert, hideAlert, setButtonLoading, bindModalLock, setModalLocked } = addBook.utils;

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

        const entries = [
            ['Title', payload.title],
            ['Subtitle', payload.subtitle],
            ['ISBN', payload.isbn],
            ['Publication Date', payload.publicationDate?.text],
            ['Page Count', payload.pageCount],
            ['Book Type', payload.bookTypeId],
            ['Publisher', payload.publisherId],
            ['Languages', payload.languageIds?.length ? payload.languageIds.join(', ') : null],
            ['Tags', payload.tags?.length ? payload.tags.join(', ') : null],
            ['Authors', payload.authors?.length ? payload.authors.map((a) => `${a.authorId}${a.authorRole ? ` (${a.authorRole})` : ''}`).join(', ') : null],
            ['Series', payload.series?.length ? payload.series.map((s) => `${s.seriesId}${s.bookOrder ? ` (#${s.bookOrder})` : ''}`).join(', ') : null],
            ['Storage Location', payload.bookCopy?.storageLocationPath],
            ['Acquisition Date', payload.bookCopy?.acquisitionDate?.text]
        ];

        const list = document.createElement('ul');
        list.className = 'list-group';
        entries.forEach(([label, value]) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between';
            const name = document.createElement('span');
            name.textContent = label;
            const val = document.createElement('span');
            val.textContent = value || '—';
            li.appendChild(name);
            li.appendChild(val);
            list.appendChild(li);
        });

        summaryEl.appendChild(list);
    }

    async function runDryRun() {
        hideAlert(errorAlert);
        hideAlert(dryRunAlert);
        confirmButton.disabled = true;

        const validationErrors = addBook.validateMainForm();
        if (validationErrors.length) {
            showAlert(errorAlert, validationErrors.join(' '));
            return;
        }

        const payload = addBook.buildPayload({ dryRun: true });
        renderSummary(payload);

        try {
            const response = await apiFetch('/book', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errors = data.errors && data.errors.length ? data.errors.join(' ') : data.message || 'Validation failed.';
                showAlert(errorAlert, errors);
                confirmButton.disabled = true;
                return;
            }
            showAlert(dryRunAlert, data.message || 'Ready to be added.');
            confirmButton.disabled = false;
        } catch (error) {
            showAlert(errorAlert, 'Unable to validate the book right now.');
            confirmButton.disabled = true;
        }
    }

    async function submitBook() {
        modalState.locked = true;
        setModalLocked(modalEl, true);
        setButtonLoading(confirmButton, confirmSpinner, true);
        const payload = addBook.buildPayload({ dryRun: false });

        try {
            const response = await apiFetch('/book', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errors = data.errors && data.errors.length ? data.errors.join(' ') : data.message || 'Failed to add book.';
                showAlert(errorAlert, errors);
                return;
            }
            const id = data.data?.id;
            const target = id ? `${redirectBase}/${id}` : redirectBase;
            window.location.href = target;
        } catch (error) {
            showAlert(errorAlert, 'Unable to add the book right now.');
        } finally {
            setButtonLoading(confirmButton, confirmSpinner, false);
            modalState.locked = false;
            setModalLocked(modalEl, false);
        }
    }

    reviewButton.addEventListener('click', () => {
        const modal = window.bootstrap?.Modal.getOrCreateInstance(modalEl, { backdrop: 'static' });
        if (!modal) {
            return;
        }
        modal.show();
        runDryRun();
    });

    confirmButton.addEventListener('click', submitBook);
})();
