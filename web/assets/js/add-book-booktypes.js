// Handles the Create Book Type modal.
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

    bindModalLock(modalEl, modalState);

    function validate() {
        let valid = true;
        clearHelpText(nameHelp);
        clearHelpText(descHelp);

        const name = nameInput.value.trim();
        if (!name) {
            setHelpText(nameHelp, 'Book Type Name is required.', true);
            valid = false;
        } else if (name.length < 2 || name.length > 100) {
            setHelpText(nameHelp, 'Book Type Name must be between 2 and 100 characters.', true);
            valid = false;
        }

        if (descInput.value && descInput.value.trim().length > 1000) {
            setHelpText(descHelp, 'Description must be 1000 characters or fewer.', true);
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
                const errors = data.errors && data.errors.length ? data.errors.join(' ') : data.message || 'Failed to add book type.';
                showAlert(errorAlert, errors);
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
        } catch (error) {
            showAlert(errorAlert, 'Unable to save book type. Please try again.');
        } finally {
            setLocked(false);
        }
    }

    function handleReset() {
        clearModalValues('addBookTypeModal', [nameInput, descInput]);
        clearHelpText(nameHelp);
        clearHelpText(descHelp);
        hideAlert(errorAlert);
    }

    modalEl.addEventListener('hidden.bs.modal', () => {
        cacheModalValues('addBookTypeModal', [nameInput, descInput]);
    });

    modalEl.addEventListener('shown.bs.modal', () => {
        restoreModalValues('addBookTypeModal', [nameInput, descInput]);
        hideAlert(errorAlert);
    });

    saveButton.addEventListener('click', handleSave);
    resetButton.addEventListener('click', handleReset);
})();
