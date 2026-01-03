// Handles the Add Publisher modal.
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const {
        byId,
        showAlert,
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
        isValidUrl
    } = addBook.utils;

    const modalEl = byId('addPublisherModal');
    if (!modalEl) return;

    const nameInput = byId('fiveEdtPublisherName');
    const foundedInput = byId('fiveEdtPublisherFoundedDate');
    const websiteInput = byId('fiveEdtPublisherWebsite');
    const notesInput = byId('fiveRdtPublisherNotes');
    const foundedHelp = byId('fivePublisherFoundedDateHelp');
    const errorAlert = byId('fivePublisherErrorAlert');
    const saveButton = byId('fiveBtnSavePublisher');
    const resetButton = byId('fiveBtnResetPublisher');

    const spinnerState = attachButtonSpinner(saveButton);
    const modalState = { locked: false };

    bindModalLock(modalEl, modalState);

    function validate() {
        let valid = true;
        hideAlert(errorAlert);
        clearHelpText(foundedHelp);
        const errors = [];

        const name = nameInput.value.trim();
        if (!name) {
            errors.push('Publisher Name is required.');
            valid = false;
        } else if (name.length < 2 || name.length > 150) {
            errors.push('Publisher Name must be between 2 and 150 characters.');
            valid = false;
        }

        if (foundedInput.value.trim()) {
            const parsed = parsePartialDateInput(foundedInput.value);
            if (parsed.error) {
                setHelpText(foundedHelp, parsed.error, true);
                valid = false;
            }
        }

        if (websiteInput.value.trim() && !isValidUrl(websiteInput.value.trim())) {
            errors.push('Website must be a valid URL starting with http:// or https://');
            valid = false;
        }

        if (notesInput.value.trim().length > 1000) {
            errors.push('Notes must be 1000 characters or fewer.');
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
            website: websiteInput.value.trim() || null,
            notes: notesInput.value.trim() || null
        };

        try {
            const response = await apiFetch('/publisher', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errors = data.errors && data.errors.length ? data.errors.join(' ') : data.message || 'Failed to add publisher.';
                showAlert(errorAlert, errors);
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
            window.bootstrap?.Modal.getInstance(modalEl)?.hide();
        } catch (error) {
            showAlert(errorAlert, 'Unable to save publisher. Please try again.');
        } finally {
            setLocked(false);
        }
    }

    function handleReset() {
        clearModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
        clearHelpText(foundedHelp);
        hideAlert(errorAlert);
    }

    foundedInput.addEventListener('input', () => setPartialDateHelp(foundedInput, foundedHelp));

    modalEl.addEventListener('hidden.bs.modal', () => {
        cacheModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
    });

    modalEl.addEventListener('shown.bs.modal', () => {
        restoreModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
        hideAlert(errorAlert);
        setPartialDateHelp(foundedInput, foundedHelp);
    });

    saveButton.addEventListener('click', handleSave);
    resetButton.addEventListener('click', handleReset);
})();
