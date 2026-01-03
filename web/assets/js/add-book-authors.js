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
        setPartialDateHelp,
        ensureHelpText
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
    const displayNameHelp = ensureHelpText(displayNameInput, 'fourAuthorDisplayNameHelp');
    const firstNameHelp = ensureHelpText(firstNameInput, 'fourAuthorFirstNameHelp');
    const lastNameHelp = ensureHelpText(lastNameInput, 'fourAuthorLastNameHelp');
    const bioHelp = ensureHelpText(bioInput, 'fourAuthorBioHelp');
    const errorAlert = byId('fourAuthorErrorAlert');

    const saveButton = byId('fourBtnSaveAuthor');
    const resetButton = byId('fourBtnResetAuthor');

    const spinnerState = attachButtonSpinner(saveButton);
    const modalState = { locked: false };
    const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;
    const log = (...args) => console.log('[Add Book][Authors]', ...args);

    bindModalLock(modalEl, modalState);

    function getDisplayNameError() {
        const displayName = displayNameInput.value.trim();
        if (!displayName) {
            return 'Display Name is required.';
        }
        if (displayName.length < 2 || displayName.length > 150) {
            return 'Display Name must be between 2 and 150 characters.';
        }
        if (!namePattern.test(displayName)) {
            return 'Display Name contains unsupported characters.';
        }
        return null;
    }

    function validateDisplayName() {
        if (!displayNameInput.value.trim()) {
            setHelpText(displayNameHelp, 'This field is required.', true);
            return false;
        }
        const error = getDisplayNameError();
        if (error) {
            setHelpText(displayNameHelp, error, true);
            return false;
        }
        clearHelpText(displayNameHelp);
        return true;
    }

    function getFirstNameError() {
        const value = firstNameInput.value.trim();
        if (!value) {
            return null;
        }
        if (value.length < 2 || value.length > 150) {
            return 'First Name(s) must be between 2 and 150 characters.';
        }
        if (!namePattern.test(value)) {
            return 'First Name(s) contains unsupported characters.';
        }
        return null;
    }

    function validateFirstName() {
        const error = getFirstNameError();
        if (error) {
            setHelpText(firstNameHelp, error, true);
            return false;
        }
        clearHelpText(firstNameHelp);
        return true;
    }

    function getLastNameError() {
        const value = lastNameInput.value.trim();
        if (!value) {
            return null;
        }
        if (value.length < 2 || value.length > 100) {
            return 'Last Name must be between 2 and 100 characters.';
        }
        if (!namePattern.test(value)) {
            return 'Last Name contains unsupported characters.';
        }
        return null;
    }

    function validateLastName() {
        const error = getLastNameError();
        if (error) {
            setHelpText(lastNameHelp, error, true);
            return false;
        }
        clearHelpText(lastNameHelp);
        return true;
    }

    function getBioError() {
        const value = bioInput.value.trim();
        if (!value) {
            return null;
        }
        if (value.length > 1000) {
            return 'Bio must be 1000 characters or fewer.';
        }
        return null;
    }

    function validateBio() {
        const error = getBioError();
        if (error) {
            setHelpText(bioHelp, error, true);
            return false;
        }
        clearHelpText(bioHelp);
        return true;
    }

    function validate() {
        let valid = true;
        hideAlert(errorAlert);
        clearHelpText(birthHelp);
        clearHelpText(deathHelp);
        const errors = [];

        const displayNameError = getDisplayNameError();
        if (displayNameError) {
            errors.push(displayNameError);
            valid = false;
        }
        const firstNameError = getFirstNameError();
        if (firstNameError) {
            errors.push(firstNameError);
            valid = false;
        }
        const lastNameError = getLastNameError();
        if (lastNameError) {
            errors.push(lastNameError);
            valid = false;
        }
        const bioError = getBioError();
        if (bioError) {
            errors.push(bioError);
            valid = false;
        }

        if (birthDateInput.value.trim()) {
            const parsed = parsePartialDateInput(birthDateInput.value);
            if (parsed.error) {
                setHelpText(birthHelp, parsed.error, true);
                valid = false;
            }
        }

        if (deathDateInput.value.trim() && !deceasedToggle.checked) {
            setHelpText(deathHelp, 'Mark the author as deceased to set a death date.', true);
            valid = false;
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
            log('Validation errors:', errors);
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
            log('Author saved:', created);
        } catch (error) {
            showAlert(errorAlert, 'Unable to save author. Please try again.');
            log('Failed to save author:', error);
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
        clearHelpText(displayNameHelp);
        clearHelpText(firstNameHelp);
        clearHelpText(lastNameHelp);
        clearHelpText(birthHelp);
        clearHelpText(deathHelp);
        clearHelpText(bioHelp);
        hideAlert(errorAlert);
        log('Author modal reset.');
    }

    birthDateInput.addEventListener('input', () => setPartialDateHelp(birthDateInput, birthHelp));
    deathDateInput.addEventListener('input', () => {
        if (!deceasedToggle.checked) {
            if (!deathDateInput.value.trim()) {
                clearHelpText(deathHelp);
                return;
            }
            setHelpText(deathHelp, 'Mark the author as deceased to set a death date.', true);
            return;
        }
        setPartialDateHelp(deathDateInput, deathHelp);
    });
    deceasedToggle.addEventListener('change', () => {
        if (!deceasedToggle.checked && deathDateInput.value.trim()) {
            setHelpText(deathHelp, 'Mark the author as deceased to set a death date.', true);
            return;
        }
        if (!deceasedToggle.checked) {
            clearHelpText(deathHelp);
            return;
        }
        setPartialDateHelp(deathDateInput, deathHelp);
    });
    displayNameInput.addEventListener('input', validateDisplayName);
    firstNameInput.addEventListener('input', validateFirstName);
    lastNameInput.addEventListener('input', validateLastName);
    bioInput.addEventListener('input', validateBio);

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
        validateDisplayName();
        validateFirstName();
        validateLastName();
        validateBio();
        setPartialDateHelp(birthDateInput, birthHelp);
        if (!deceasedToggle.checked && deathDateInput.value.trim()) {
            setHelpText(deathHelp, 'Mark the author as deceased to set a death date.', true);
        } else if (deceasedToggle.checked) {
            setPartialDateHelp(deathDateInput, deathHelp);
        } else {
            clearHelpText(deathHelp);
        }
    });

    saveButton.addEventListener('click', handleSave);
    resetButton.addEventListener('click', handleReset);
})();
