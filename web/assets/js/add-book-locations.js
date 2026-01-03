// Handles the Add Storage Location modal.
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
        clearModalValues
    } = addBook.utils;

    const modalEl = byId('addLocationModal');
    if (!modalEl) return;

    const baseRadio = byId('eightRdoLocationBase');
    const nestedRadio = byId('eightRdoLocationNested');
    const baseNameInput = byId('eightEdtLocationNameBase');
    const baseNotesInput = byId('eightRdtLocationNotesBase');
    const parentSelect = byId('eightCmbParentLocation');
    const nestedNameInput = byId('eightEdtLocationNameNested');
    const nestedNotesInput = byId('eightRdtLocationNotesNested');

    const errorAlert = byId('eightLocationErrorAlert');
    const saveButton = byId('eightBtnSaveLocation');
    const resetButton = byId('eightBtnResetLocation');

    const spinnerState = attachButtonSpinner(saveButton);
    const modalState = { locked: false };

    bindModalLock(modalEl, modalState);

    function populateParents(locations) {
        if (!parentSelect) return;
        parentSelect.innerHTML = '<option value="none" selected> Select parent location...</option>';
        (locations || []).forEach((loc) => {
            const option = document.createElement('option');
            option.value = String(loc.id);
            option.textContent = loc.path || loc.name;
            parentSelect.appendChild(option);
        });
    }

    addBook.events.addEventListener('locations:loaded', (event) => {
        populateParents(event.detail || []);
    });

    function validate() {
        hideAlert(errorAlert);
        const errors = [];
        const isBase = baseRadio.checked;

        if (isBase) {
            const name = baseNameInput.value.trim();
            if (!name) {
                errors.push('Location Name is required.');
            } else if (name.length < 2 || name.length > 150) {
                errors.push('Location Name must be between 2 and 150 characters.');
            }
            if (baseNotesInput.value.trim().length > 2000) {
                errors.push('Notes must be 2000 characters or fewer.');
            }
        } else {
            const parentId = parentSelect.value;
            if (!parentId || parentId === 'none') {
                errors.push('Parent Location is required for nested locations.');
            }
            const name = nestedNameInput.value.trim();
            if (!name) {
                errors.push('Location Name is required.');
            } else if (name.length < 2 || name.length > 150) {
                errors.push('Location Name must be between 2 and 150 characters.');
            }
            if (nestedNotesInput.value.trim().length > 2000) {
                errors.push('Notes must be 2000 characters or fewer.');
            }
        }

        if (errors.length) {
            showAlert(errorAlert, errors.join(' '));
            return false;
        }
        return true;
    }

    function setLocked(locked) {
        modalState.locked = locked;
        setModalLocked(modalEl, locked);
        toggleDisabled([
            baseRadio,
            nestedRadio,
            baseNameInput,
            baseNotesInput,
            parentSelect,
            nestedNameInput,
            nestedNotesInput,
            resetButton
        ], locked);
        if (spinnerState) {
            setButtonLoading(saveButton, spinnerState.spinner, locked);
        }
    }

    async function handleSave() {
        if (!validate()) return;
        setLocked(true);
        const isBase = baseRadio.checked;
        const payload = {
            name: isBase ? baseNameInput.value.trim() : nestedNameInput.value.trim(),
            parentId: isBase ? null : Number.parseInt(parentSelect.value, 10),
            notes: isBase ? (baseNotesInput.value.trim() || null) : (nestedNotesInput.value.trim() || null)
        };

        try {
            const response = await apiFetch('/storagelocation', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errors = data.errors && data.errors.length ? data.errors.join(' ') : data.message || 'Failed to add location.';
                showAlert(errorAlert, errors);
                return;
            }

            const created = data.data || {};
            addBook.events.dispatchEvent(new CustomEvent('location:created', {
                detail: {
                    id: created.id,
                    name: created.name || payload.name,
                    path: created.path || payload.name,
                    notes: created.notes || payload.notes,
                    parentId: created.parentId || payload.parentId
                }
            }));

            clearModalValues('addLocationModal', [
                baseNameInput,
                baseNotesInput,
                parentSelect,
                nestedNameInput,
                nestedNotesInput,
                baseRadio,
                nestedRadio
            ]);
            hideAlert(errorAlert);
            window.bootstrap?.Modal.getInstance(modalEl)?.hide();
        } catch (error) {
            showAlert(errorAlert, 'Unable to save location. Please try again.');
        } finally {
            setLocked(false);
        }
    }

    function handleReset() {
        clearModalValues('addLocationModal', [
            baseNameInput,
            baseNotesInput,
            parentSelect,
            nestedNameInput,
            nestedNotesInput,
            baseRadio,
            nestedRadio
        ]);
        baseRadio.checked = true;
        hideAlert(errorAlert);
    }

    modalEl.addEventListener('hidden.bs.modal', () => {
        cacheModalValues('addLocationModal', [
            baseNameInput,
            baseNotesInput,
            parentSelect,
            nestedNameInput,
            nestedNotesInput,
            baseRadio,
            nestedRadio
        ]);
    });

    modalEl.addEventListener('shown.bs.modal', () => {
        restoreModalValues('addLocationModal', [
            baseNameInput,
            baseNotesInput,
            parentSelect,
            nestedNameInput,
            nestedNotesInput,
            baseRadio,
            nestedRadio
        ]);
        hideAlert(errorAlert);
    });

    saveButton.addEventListener('click', handleSave);
    resetButton.addEventListener('click', handleReset);
})();
