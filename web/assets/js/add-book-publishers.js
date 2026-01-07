// Handles the Add Publisher modal.
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const {
        byId,
        showAlert,
        showAlertWithDetails,
        hideAlert,
        setHelpText,
        clearHelpText,
        attachButtonSpinner,
        setButtonLoading,
        toggleDisabled,
        bindModalLock,
        setModalLocked,
        cacheModalValues,
        restoreModalValues,
        clearModalValues,
        parsePartialDateInput,
        setPartialDateHelp,
        isValidUrl,
        ensureHelpText
    } = addBook.utils;

    const modalEl = byId('addPublisherModal');
    if (!modalEl) return;

    const nameInput = byId('fiveEdtPublisherName');
    const foundedInput = byId('fiveEdtPublisherFoundedDate');
    const websiteInput = byId('fiveEdtPublisherWebsite');
    const notesInput = byId('fiveRdtPublisherNotes');
    const foundedHelp = byId('fivePublisherFoundedDateHelp');
    const nameHelp = ensureHelpText(nameInput, 'fivePublisherNameHelp');
    const websiteHelp = ensureHelpText(websiteInput, 'fivePublisherWebsiteHelp');
    const notesHelp = ensureHelpText(notesInput, 'fivePublisherNotesHelp');
    const errorAlert = byId('fivePublisherErrorAlert');
    const saveButton = byId('fiveBtnSavePublisher');
    const resetButton = byId('fiveBtnResetPublisher');

    const spinnerState = attachButtonSpinner(saveButton);
    const modalState = { locked: false };
    const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;
    const log = (...args) => console.log('[Add Book][Publishers]', ...args);

    bindModalLock(modalEl, modalState);

    function getNameError() {
        const name = nameInput.value.trim();
        if (!name) {
            return 'Publisher Name is required.';
        }
        if (name.length < 2 || name.length > 150) {
            return 'Publisher Name must be between 2 and 150 characters.';
        }
        if (!namePattern.test(name)) {
            return 'Publisher Name contains unsupported characters.';
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
            return 'Website must be 300 characters or fewer.';
        }
        if (!addBook.utils.normalizeUrl(value)) {
            return 'Website must be a valid URL starting with http:// or https://';
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

    function getNotesError() {
        const value = notesInput.value.trim();
        if (!value) {
            return null;
        }
        if (value.length > 1000) {
            return 'Notes must be 1000 characters or fewer.';
        }
        return null;
    }

    function validateNotes() {
        const error = getNotesError();
        if (error) {
            setHelpText(notesHelp, error, true);
            return false;
        }
        clearHelpText(notesHelp);
        return true;
    }

    function validate() {
        let valid = true;
        hideAlert(errorAlert);
        clearHelpText(foundedHelp);
        const errors = [];

        const nameError = getNameError();
        if (nameError) {
            errors.push(nameError);
            valid = false;
        }

        if (foundedInput.value.trim()) {
            const parsed = parsePartialDateInput(foundedInput.value);
            if (parsed.error) {
                setHelpText(foundedHelp, parsed.error, true);
                valid = false;
            }
        }

        const websiteError = getWebsiteError();
        if (websiteError) {
            errors.push(websiteError);
            valid = false;
        }

        const notesError = getNotesError();
        if (notesError) {
            errors.push(notesError);
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
        toggleDisabled([nameInput, foundedInput, websiteInput, notesInput, resetButton], locked);
        if (spinnerState) {
            setButtonLoading(saveButton, spinnerState.spinner, locked);
        }
    }

    async function handleSave() {
        if (!validate()) return;
        setLocked(true);
        const foundedParsed = parsePartialDateInput(foundedInput.value.trim());
        const payload = {
            name: nameInput.value.trim(),
            foundedDate: foundedParsed.value || null,
            website: addBook.utils.normalizeUrl(websiteInput.value.trim()) || null,
            notes: notesInput.value.trim() || null
        };

        try {
            const response = await apiFetch('/publisher', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errorDetails = data.errors && data.errors.length ? data.errors : [];
                const message = data.message || 'Failed to add publisher.';
                showAlertWithDetails(errorAlert, message, errorDetails);
                return;
            }

            const created = data.data || {};
            addBook.events.dispatchEvent(new CustomEvent('publisher:created', {
                detail: {
                    id: created.id,
                    name: created.name || payload.name,
                    foundedDate: created.foundedDate || payload.foundedDate,
                    website: created.website || payload.website,
                    notes: created.notes || payload.notes
                }
            }));

            clearModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
            hideAlert(errorAlert);
            setLocked(false);
            if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
                await window.modalManager.hideModal(modalEl);
            } else {
                window.bootstrap?.Modal.getOrCreateInstance(modalEl)?.hide();
            }
            log('Publisher saved:', created);
        } catch (error) {
            showAlertWithDetails(errorAlert, 'Unable to save publisher. Please try again.');
            log('Failed to save publisher:', error);
        } finally {
            setLocked(false);
        }
    }

    function handleReset() {
        clearModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
        clearHelpText(nameHelp);
        clearHelpText(foundedHelp);
        clearHelpText(websiteHelp);
        clearHelpText(notesHelp);
        hideAlert(errorAlert);
        log('Publisher modal reset.');
        validateName();
        validateWebsite();
        validateNotes();
    }

    foundedInput.addEventListener('input', () => setPartialDateHelp(foundedInput, foundedHelp));
    nameInput.addEventListener('input', validateName);
    websiteInput.addEventListener('input', validateWebsite);
    notesInput.addEventListener('input', validateNotes);

    modalEl.addEventListener('hidden.bs.modal', () => {
        cacheModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
    });

    modalEl.addEventListener('shown.bs.modal', () => {
        restoreModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
        hideAlert(errorAlert);
        setPartialDateHelp(foundedInput, foundedHelp);
        validateName();
        validateWebsite();
        validateNotes();
    });

    saveButton.addEventListener('click', handleSave);
    resetButton.addEventListener('click', handleReset);
})();
