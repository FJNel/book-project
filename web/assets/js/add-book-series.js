// Handles the Add Series modal.
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const {
        byId,
        showAlert,
        hideAlert,
        attachButtonSpinner,
        setButtonLoading,
        toggleDisabled,
        bindModalLock,
        setModalLocked,
        cacheModalValues,
        restoreModalValues,
        clearModalValues,
        isValidUrl
    } = addBook.utils;

    const modalEl = byId('addSeriesModal');
    if (!modalEl) return;

    const nameInput = byId('sixEdtSeriesName');
    const websiteInput = byId('sixEdtSeriesWebsite');
    const descInput = byId('sixRdtSeriesDescription');
    const errorAlert = byId('sixSeriesErrorAlert');
    const saveButton = byId('sixBtnSaveSeries');
    const resetButton = byId('sixBtnResetSeries');

    const spinnerState = attachButtonSpinner(saveButton);
    const modalState = { locked: false };

    bindModalLock(modalEl, modalState);

    function validate() {
        let valid = true;
        hideAlert(errorAlert);
        const errors = [];

        const name = nameInput.value.trim();
        if (!name) {
            errors.push('Series Name is required.');
            valid = false;
        } else if (name.length < 2 || name.length > 150) {
            errors.push('Series Name must be between 2 and 150 characters.');
            valid = false;
        }

        if (websiteInput.value.trim() && !isValidUrl(websiteInput.value.trim())) {
            errors.push('Series Website must be a valid URL starting with http:// or https://');
            valid = false;
        }

        if (descInput.value.trim().length > 1000) {
            errors.push('Description must be 1000 characters or fewer.');
            valid = false;
        }

        if (errors.length) {
            showAlert(errorAlert, errors.join(' '));
        }
        return valid;
    }

    function setLocked(locked) {
        modalState.locked = locked;
        setModalLocked(modalEl, locked);
        toggleDisabled([nameInput, websiteInput, descInput, resetButton], locked);
        if (spinnerState) {
            setButtonLoading(saveButton, spinnerState.spinner, locked);
        }
    }

    async function handleSave() {
        if (!validate()) return;
        setLocked(true);

        const payload = {
            name: nameInput.value.trim(),
            website: websiteInput.value.trim() || null,
            description: descInput.value.trim() || null
        };

        try {
            const response = await apiFetch('/bookseries', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errors = data.errors && data.errors.length ? data.errors.join(' ') : data.message || 'Failed to add series.';
                showAlert(errorAlert, errors);
                return;
            }

            const created = data.data || {};
            addBook.events.dispatchEvent(new CustomEvent('series:created', {
                detail: {
                    id: created.id,
                    name: created.name || payload.name,
                    description: created.description || payload.description,
                    website: created.website || payload.website
                }
            }));

            clearModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
            hideAlert(errorAlert);
            window.bootstrap?.Modal.getInstance(modalEl)?.hide();
        } catch (error) {
            showAlert(errorAlert, 'Unable to save series. Please try again.');
        } finally {
            setLocked(false);
        }
    }

    function handleReset() {
        clearModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
        hideAlert(errorAlert);
    }

    modalEl.addEventListener('hidden.bs.modal', () => {
        cacheModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
    });

    modalEl.addEventListener('shown.bs.modal', () => {
        restoreModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
        hideAlert(errorAlert);
    });

    saveButton.addEventListener('click', handleSave);
    resetButton.addEventListener('click', handleReset);
})();
