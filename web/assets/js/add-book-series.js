// Handles the Add Series modal.
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const {
        byId,
        showAlert,
        showAlertWithDetails,
        hideAlert,
        attachButtonSpinner,
        setButtonLoading,
        toggleDisabled,
        bindModalLock,
        setModalLocked,
        cacheModalValues,
        restoreModalValues,
        clearModalValues,
        isValidUrl,
        setHelpText,
        clearHelpText,
        ensureHelpText
    } = addBook.utils;

    const modalEl = byId('addSeriesModal');
    if (!modalEl) return;

    const nameInput = byId('sixEdtSeriesName');
    const websiteInput = byId('sixEdtSeriesWebsite');
    const descInput = byId('sixRdtSeriesDescription');
    const nameHelp = ensureHelpText(nameInput, 'sixSeriesNameHelp');
    const websiteHelp = ensureHelpText(websiteInput, 'sixSeriesWebsiteHelp');
    const descHelp = ensureHelpText(descInput, 'sixSeriesDescriptionHelp');
    const errorAlert = byId('sixSeriesErrorAlert');
    const saveButton = byId('sixBtnSaveSeries');
    const resetButton = byId('sixBtnResetSeries');

    const spinnerState = attachButtonSpinner(saveButton);
    const modalState = { locked: false };
    const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;
    const log = (...args) => console.log('[Add Book][Series]', ...args);

    bindModalLock(modalEl, modalState);

    function getNameError() {
        const name = nameInput.value.trim();
        if (!name) {
            return 'Series Name is required.';
        }
        if (name.length < 2 || name.length > 150) {
            return 'Series Name must be between 2 and 150 characters.';
        }
        if (!namePattern.test(name)) {
            return 'Series Name contains unsupported characters.';
        }
        return null;
    }

    function validateName() {
        if (!nameInput.value.trim()) {
            setHelpText(nameHelp, 'This field is required.', true);
            return false;
        }
        const error = getNameError();
        if (error) {
            setHelpText(nameHelp, error, true);
            return false;
        }
        clearHelpText(nameHelp);
        return true;
    }

    function getWebsiteError() {
        const value = websiteInput.value.trim();
        if (!value) {
            return null;
        }
        if (value.length > 300) {
            return 'Series Website must be 300 characters or fewer.';
        }
        if (!isValidUrl(value)) {
            return 'Series Website must be a valid URL starting with http:// or https://';
        }
        return null;
    }

    function validateWebsite() {
        const error = getWebsiteError();
        if (error) {
            setHelpText(websiteHelp, error, true);
            return false;
        }
        clearHelpText(websiteHelp);
        return true;
    }

    function getDescriptionError() {
        const value = descInput.value.trim();
        if (!value) {
            return null;
        }
        if (value.length > 1000) {
            return 'Description must be 1000 characters or fewer.';
        }
        return null;
    }

    function validateDescription() {
        const error = getDescriptionError();
        if (error) {
            setHelpText(descHelp, error, true);
            return false;
        }
        clearHelpText(descHelp);
        return true;
    }

    function validate() {
        let valid = true;
        hideAlert(errorAlert);
        const errors = [];

        const nameError = getNameError();
        if (nameError) {
            errors.push(nameError);
            valid = false;
        }

        const websiteError = getWebsiteError();
        if (websiteError) {
            errors.push(websiteError);
            valid = false;
        }

        const descError = getDescriptionError();
        if (descError) {
            errors.push(descError);
            valid = false;
        }

        if (errors.length) {
            showAlertWithDetails(errorAlert, 'Please fix the following:', errors);
            log('Validation errors:', errors);
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
                const errorDetails = data.errors && data.errors.length ? data.errors : [];
                const message = data.message || 'Failed to add series.';
                showAlertWithDetails(errorAlert, message, errorDetails);
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
            if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
                await window.modalManager.hideModal(modalEl);
            } else {
                window.bootstrap?.Modal.getOrCreateInstance(modalEl)?.hide();
            }
            log('Series saved:', created);
        } catch (error) {
            showAlertWithDetails(errorAlert, 'Unable to save series. Please try again.');
            log('Failed to save series:', error);
        } finally {
            setLocked(false);
        }
    }

    function handleReset() {
        clearModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
        clearHelpText(nameHelp);
        clearHelpText(websiteHelp);
        clearHelpText(descHelp);
        hideAlert(errorAlert);
        log('Series modal reset.');
        validateName();
        validateWebsite();
        validateDescription();
    }

    modalEl.addEventListener('hidden.bs.modal', () => {
        cacheModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
    });

    modalEl.addEventListener('shown.bs.modal', () => {
        restoreModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
        hideAlert(errorAlert);
        validateName();
        validateWebsite();
        validateDescription();
    });

    saveButton.addEventListener('click', handleSave);
    resetButton.addEventListener('click', handleReset);

    nameInput.addEventListener('input', validateName);
    websiteInput.addEventListener('input', validateWebsite);
    descInput.addEventListener('input', validateDescription);
})();
