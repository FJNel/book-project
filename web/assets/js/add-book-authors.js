// Handles the Add Author modal.
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
        setPartialDateHelp
    } = addBook.utils;

    const modalEl = byId('addAuthorModal');
    if (!modalEl) return;

    const displayNameInput = byId('fourEdtAuthorDisplayName');
    const firstNameInput = byId('fourEdtAuthorFirstName');
    const lastNameInput = byId('fourEdtAuthorLastName');
    const birthDateInput = byId('fourEdtAuthorBirthDate');
    const deathDateInput = byId('fourEdtAuthorDeathDate');
    const deceasedToggle = byId('fourChkAuthorDeceased');
    const bioInput = byId('fourRdtAuthorBio');

    const birthHelp = byId('fourAuthorBirthDateHelp');
    const deathHelp = byId('fourAuthorDeathDateHelp');
    const errorAlert = byId('fourAuthorErrorAlert');

    const saveButton = byId('fourBtnSaveAuthor');
    const resetButton = byId('fourBtnResetAuthor');

    const spinnerState = attachButtonSpinner(saveButton);
    const modalState = { locked: false };

    bindModalLock(modalEl, modalState);

    function validate() {
        let valid = true;
        hideAlert(errorAlert);
        clearHelpText(birthHelp);
        clearHelpText(deathHelp);
        const errors = [];

        const displayName = displayNameInput.value.trim();
        if (!displayName) {
            errors.push('Display Name is required.');
            valid = false;
        } else if (displayName.length < 2 || displayName.length > 150) {
            errors.push('Display Name must be between 2 and 150 characters.');
            valid = false;
        }

        if (firstNameInput.value.trim()) {
            const value = firstNameInput.value.trim();
            if (value.length < 2 || value.length > 150) {
                errors.push('First Name(s) must be between 2 and 150 characters.');
                valid = false;
            }
        }
        if (lastNameInput.value.trim()) {
            const value = lastNameInput.value.trim();
            if (value.length < 2 || value.length > 100) {
                errors.push('Last Name must be between 2 and 100 characters.');
                valid = false;
            }
        }

        if (birthDateInput.value.trim()) {
            const parsed = parsePartialDateInput(birthDateInput.value);
            if (parsed.error) {
                setHelpText(birthHelp, parsed.error, true);
                valid = false;
            }
        }

        if (deceasedToggle.checked && deathDateInput.value.trim()) {
            const parsed = parsePartialDateInput(deathDateInput.value);
            if (parsed.error) {
                setHelpText(deathHelp, parsed.error, true);
                valid = false;
            }
        }

        if (errors.length) {
            showAlert(errorAlert, errors.join(' '));
        }

        return valid;
    }

    function setLocked(locked) {
        modalState.locked = locked;
        setModalLocked(modalEl, locked);
        toggleDisabled([
            displayNameInput,
            firstNameInput,
            lastNameInput,
            birthDateInput,
            deathDateInput,
            deceasedToggle,
            bioInput,
            resetButton
        ], locked);
        if (spinnerState) {
            setButtonLoading(saveButton, spinnerState.spinner, locked);
        }
    }

    async function handleSave() {
        if (!validate()) return;
        setLocked(true);

        const birthParsed = parsePartialDateInput(birthDateInput.value.trim());
        const deathParsed = parsePartialDateInput(deathDateInput.value.trim());

        const payload = {
            displayName: displayNameInput.value.trim(),
            firstNames: firstNameInput.value.trim() || null,
            lastName: lastNameInput.value.trim() || null,
            birthDate: birthParsed.value || null,
            deceased: deceasedToggle.checked,
            deathDate: deceasedToggle.checked ? (deathParsed.value || null) : null,
            bio: bioInput.value.trim() || null
        };

        try {
            const response = await apiFetch('/author', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errors = data.errors && data.errors.length ? data.errors.join(' ') : data.message || 'Failed to add author.';
                showAlert(errorAlert, errors);
                return;
            }

            const created = data.data || {};
            addBook.events.dispatchEvent(new CustomEvent('author:created', {
                detail: {
                    id: created.id,
                    displayName: created.displayName || payload.displayName
                }
            }));

            clearModalValues('addAuthorModal', [
                displayNameInput,
                firstNameInput,
                lastNameInput,
                birthDateInput,
                deathDateInput,
                deceasedToggle,
                bioInput
            ]);
            hideAlert(errorAlert);
            window.bootstrap?.Modal.getInstance(modalEl)?.hide();
        } catch (error) {
            showAlert(errorAlert, 'Unable to save author. Please try again.');
        } finally {
            setLocked(false);
        }
    }

    function handleReset() {
        clearModalValues('addAuthorModal', [
            displayNameInput,
            firstNameInput,
            lastNameInput,
            birthDateInput,
            deathDateInput,
            deceasedToggle,
            bioInput
        ]);
        clearHelpText(birthHelp);
        clearHelpText(deathHelp);
        hideAlert(errorAlert);
    }

    birthDateInput.addEventListener('input', () => setPartialDateHelp(birthDateInput, birthHelp));
    deathDateInput.addEventListener('input', () => setPartialDateHelp(deathDateInput, deathHelp));

    modalEl.addEventListener('hidden.bs.modal', () => {
        cacheModalValues('addAuthorModal', [
            displayNameInput,
            firstNameInput,
            lastNameInput,
            birthDateInput,
            deathDateInput,
            deceasedToggle,
            bioInput
        ]);
    });

    modalEl.addEventListener('shown.bs.modal', () => {
        restoreModalValues('addAuthorModal', [
            displayNameInput,
            firstNameInput,
            lastNameInput,
            birthDateInput,
            deathDateInput,
            deceasedToggle,
            bioInput
        ]);
        hideAlert(errorAlert);
        setPartialDateHelp(birthDateInput, birthHelp);
        setPartialDateHelp(deathDateInput, deathHelp);
    });

    saveButton.addEventListener('click', handleSave);
    resetButton.addEventListener('click', handleReset);
})();
