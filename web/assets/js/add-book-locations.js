// Handles the Add Storage Location modal.
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
        setHelpText,
        clearHelpText,
        ensureHelpText
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
    const baseFields = byId('eightBaseLocationFields');
    const nestedFields = byId('eightNestedLocationFields');

    const errorAlert = byId('eightLocationErrorAlert');
    const saveButton = byId('eightBtnSaveLocation');
    const resetButton = byId('eightBtnResetLocation');

    const spinnerState = attachButtonSpinner(saveButton);
    const modalState = { locked: false };
    const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;
    let cachedLocations = [];
    const log = (...args) => console.log('[Add Book][Locations]', ...args);

    const baseNameHelp = ensureHelpText(baseNameInput, 'eightLocationBaseNameHelp');
    const baseNotesHelp = ensureHelpText(baseNotesInput, 'eightLocationBaseNotesHelp');
    const parentHelp = ensureHelpText(parentSelect, 'eightLocationParentHelp');
    const nestedNameHelp = ensureHelpText(nestedNameInput, 'eightLocationNestedNameHelp');
    const nestedNotesHelp = ensureHelpText(nestedNotesInput, 'eightLocationNestedNotesHelp');

    bindModalLock(modalEl, modalState);

    [baseRadio, nestedRadio].forEach((radio) => {
        if (!radio) return;
        radio.removeAttribute('data-bs-toggle');
        radio.removeAttribute('data-bs-target');
        radio.removeAttribute('aria-controls');
    });

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

    function hasBaseLocations(locations) {
        return (locations || []).some((loc) => loc && (loc.parentId === null || loc.parentId === undefined));
    }

    function setCollapseVisibility(collapseEl, show) {
        if (!collapseEl) return;
        if (window.bootstrap && window.bootstrap.Collapse) {
            const instance = window.bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false });
            if (show) {
                instance.show();
            } else {
                instance.hide();
            }
            return;
        }
        collapseEl.classList.toggle('show', show);
    }

    function updateInlineHelp() {
        if (baseRadio.checked) {
            const name = baseNameInput.value.trim();
            if (!name) {
                setHelpText(baseNameHelp, 'This field is required.', true);
            } else if (name.length < 2 || name.length > 150) {
                setHelpText(baseNameHelp, 'Location Name must be between 2 and 150 characters.', true);
            } else if (!namePattern.test(name)) {
                setHelpText(baseNameHelp, 'Location Name contains unsupported characters.', true);
            } else {
                clearHelpText(baseNameHelp);
            }

            if (baseNotesInput.value.trim().length > 2000) {
                setHelpText(baseNotesHelp, 'Notes must be 2000 characters or fewer.', true);
            } else {
                clearHelpText(baseNotesHelp);
            }
            clearHelpText(parentHelp);
            clearHelpText(nestedNameHelp);
            clearHelpText(nestedNotesHelp);
            return;
        }

        const parentId = parentSelect.value;
        if (!parentId || parentId === 'none') {
            setHelpText(parentHelp, 'This field is required.', true);
        } else {
            clearHelpText(parentHelp);
        }

        const name = nestedNameInput.value.trim();
        if (!name) {
            setHelpText(nestedNameHelp, 'This field is required.', true);
        } else if (name.length < 2 || name.length > 150) {
            setHelpText(nestedNameHelp, 'Location Name must be between 2 and 150 characters.', true);
        } else if (!namePattern.test(name)) {
            setHelpText(nestedNameHelp, 'Location Name contains unsupported characters.', true);
        } else {
            clearHelpText(nestedNameHelp);
        }

        if (nestedNotesInput.value.trim().length > 2000) {
            setHelpText(nestedNotesHelp, 'Notes must be 2000 characters or fewer.', true);
        } else {
            clearHelpText(nestedNotesHelp);
        }
        clearHelpText(baseNameHelp);
        clearHelpText(baseNotesHelp);
    }

    function applyLocationMode() {
        const allowNested = hasBaseLocations(cachedLocations);
        nestedRadio.disabled = !allowNested;
        if (!allowNested) {
            nestedRadio.checked = false;
            baseRadio.checked = true;
            setHelpText(parentHelp, 'Add a base storage location before creating nested locations.', true);
        } else if (!nestedRadio.checked) {
            clearHelpText(parentHelp);
        }

        const isBase = baseRadio.checked;
        setCollapseVisibility(baseFields, isBase);
        setCollapseVisibility(nestedFields, !isBase);
        toggleDisabled([baseNameInput, baseNotesInput], !isBase);
        toggleDisabled([parentSelect, nestedNameInput, nestedNotesInput], isBase);
        updateInlineHelp();
        log('Location mode:', {
            allowNested,
            selected: isBase ? 'base' : 'nested'
        });
    }

    addBook.events.addEventListener('locations:loaded', (event) => {
        cachedLocations = event.detail || [];
        populateParents(cachedLocations);
        applyLocationMode();
        log('Locations loaded:', cachedLocations.length);
    });

    addBook.events.addEventListener('location:created', (event) => {
        if (!event.detail) return;
        cachedLocations = cachedLocations.concat(event.detail);
        populateParents(cachedLocations);
        applyLocationMode();
        log('Location created:', event.detail);
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
            } else if (!namePattern.test(name)) {
                errors.push('Location Name contains unsupported characters.');
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
            } else if (!namePattern.test(name)) {
                errors.push('Location Name contains unsupported characters.');
            }
            if (nestedNotesInput.value.trim().length > 2000) {
                errors.push('Notes must be 2000 characters or fewer.');
            }
        }

        if (errors.length) {
            showAlertWithDetails(errorAlert, 'Please fix the following:', errors);
            log('Validation errors:', errors);
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
                const errorDetails = data.errors && data.errors.length ? data.errors : [];
                const message = data.message || 'Failed to add location.';
                showAlertWithDetails(errorAlert, message, errorDetails);
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
            if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
                window.modalManager.hideModal(modalEl);
            } else {
                window.bootstrap?.Modal.getInstance(modalEl)?.hide();
            }
            log('Location saved:', created);
        } catch (error) {
            showAlertWithDetails(errorAlert, 'Unable to save location. Please try again.');
            log('Failed to save location:', error);
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
        applyLocationMode();
        hideAlert(errorAlert);
        log('Location modal reset.');
        updateInlineHelp();
    }

    baseRadio.addEventListener('change', applyLocationMode);
    nestedRadio.addEventListener('change', applyLocationMode);
    baseRadio.addEventListener('click', applyLocationMode);
    nestedRadio.addEventListener('click', applyLocationMode);
    baseNameInput.addEventListener('input', updateInlineHelp);
    baseNotesInput.addEventListener('input', updateInlineHelp);
    parentSelect.addEventListener('change', updateInlineHelp);
    nestedNameInput.addEventListener('input', updateInlineHelp);
    nestedNotesInput.addEventListener('input', updateInlineHelp);

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
        applyLocationMode();
    });

    saveButton.addEventListener('click', handleSave);
    resetButton.addEventListener('click', handleReset);
})();
