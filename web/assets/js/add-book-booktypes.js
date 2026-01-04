// Handles the Create Book Type modal.
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
        clearModalValues
    } = addBook.utils;

    const modalEl = byId('addBookTypeModal');
    if (!modalEl) return;

    const nameInput = byId('threeEdtBookTypeName');
    const descInput = byId('threeRdtBookTypeDescription');
    const nameHelp = byId('threeBookTypeNameHelp');
    const descHelp = byId('threeBookTypeDescriptionHelp');
    const errorAlert = byId('threeBookTypeErrorAlert');
    const saveButton = byId('threeBtnSaveBookType');
    const resetButton = byId('threeBtnResetBookType');

    const spinnerState = attachButtonSpinner(saveButton);
    const modalState = { locked: false };
    const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;
    const log = (...args) => console.log('[Add Book][Book Types]', ...args);

    bindModalLock(modalEl, modalState);

    function validateName() {
        if (!nameInput.value.trim()) {
            setHelpText(nameHelp, 'This field is required.', true);
            return false;
        }
        const name = nameInput.value.trim();
        if (name.length < 2 || name.length > 100) {
            setHelpText(nameHelp, 'Book Type Name must be between 2 and 100 characters.', true);
            return false;
        }
        if (!namePattern.test(name)) {
            setHelpText(nameHelp, 'Book Type Name contains unsupported characters.', true);
            return false;
        }
        clearHelpText(nameHelp);
        return true;
    }

    function validateDescription() {
        if (descInput.value && descInput.value.trim().length > 1000) {
            setHelpText(descHelp, 'Description must be 1000 characters or fewer.', true);
            return false;
        }
        clearHelpText(descHelp);
        return true;
    }

    function validate() {
        let valid = true;
        if (!validateName()) {
            valid = false;
        }
        if (!validateDescription()) {
            valid = false;
        }

        return valid;
    }

    function setLocked(locked) {
        modalState.locked = locked;
        setModalLocked(modalEl, locked);
        toggleDisabled([nameInput, descInput, resetButton], locked);
        if (spinnerState) {
            setButtonLoading(saveButton, spinnerState.spinner, locked);
        }
    }

    async function handleSave() {
        hideAlert(errorAlert);
        if (!validate()) return;

        setLocked(true);
        const payload = {
            name: nameInput.value.trim(),
            description: descInput.value.trim() || null
        };

        try {
            const response = await apiFetch('/booktype', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errorDetails = data.errors && data.errors.length ? data.errors : [];
                const message = data.message || 'Failed to add book type.';
                showAlertWithDetails(errorAlert, message, errorDetails);
                return;
            }

            const created = data.data || {};
            addBook.events.dispatchEvent(new CustomEvent('booktype:created', {
                detail: {
                    id: created.id,
                    name: created.name || payload.name,
                    description: created.description || payload.description
                }
            }));

            clearModalValues('addBookTypeModal', [nameInput, descInput]);
            hideAlert(errorAlert);
            window.bootstrap?.Modal.getInstance(modalEl)?.hide();
            log('Book type saved:', created);
        } catch (error) {
            showAlertWithDetails(errorAlert, 'Unable to save book type. Please try again.');
            log('Failed to save book type:', error);
        } finally {
            setLocked(false);
        }
    }

    function handleReset() {
        clearModalValues('addBookTypeModal', [nameInput, descInput]);
        clearHelpText(nameHelp);
        clearHelpText(descHelp);
        hideAlert(errorAlert);
        log('Book type modal reset.');
        validateName();
        validateDescription();
    }

    modalEl.addEventListener('hidden.bs.modal', () => {
        cacheModalValues('addBookTypeModal', [nameInput, descInput]);
    });

    modalEl.addEventListener('shown.bs.modal', () => {
        restoreModalValues('addBookTypeModal', [nameInput, descInput]);
        hideAlert(errorAlert);
        validateName();
        validateDescription();
    });

    saveButton.addEventListener('click', handleSave);
    resetButton.addEventListener('click', handleReset);

    nameInput.addEventListener('input', validateName);
    descInput.addEventListener('input', validateDescription);
})();
