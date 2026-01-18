// Shared helpers and state for the Add Book page.
(function () {
    const addBook = window.addBook = window.addBook || {};

    addBook.state = addBook.state || {
        languages: { all: [], selected: [] },
        bookTypes: [],
        publishers: [],
        authors: [],
        series: [],
        locations: [],
        edit: {
            enabled: false,
            bookId: null,
            copyId: null
        },
        selections: {
            bookTypeId: null,
            publisherId: null,
            authors: [],
            series: [],
            tags: [],
            storageLocationId: null,
            storageLocationPath: null
        },
        modalCache: {}
    };

    addBook.events = addBook.events || new EventTarget();

    function byId(id) {
        return document.getElementById(id);
    }

    function setHelpText(el, message, isError = false) {
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('text-danger', Boolean(message) && isError);
    }

    function clearHelpText(el) {
        if (!el) return;
        el.textContent = '';
        el.classList.remove('text-danger');
    }

    function showAlert(alertEl, html) {
        if (!alertEl) return;
        alertEl.innerHTML = html;
        alertEl.classList.remove('d-none');
    }

    function showAlertWithDetails(alertEl, title, details) {
        if (!alertEl) return;
        const safeTitle = title || 'Alert';
        const detailText = Array.isArray(details)
            ? details.filter(Boolean).join(' ')
            : (details || '');
        const content = detailText
            ? `<span><strong>${safeTitle}</strong> ${detailText}</span>`
            : `<span><strong>${safeTitle}</strong></span>`;
        showAlert(alertEl, content);
    }

    function hideAlert(alertEl) {
        if (!alertEl) return;
        alertEl.classList.add('d-none');
        alertEl.innerHTML = '';
    }

    function attachButtonSpinner(button) {
        if (!button) return null;
        if (button.querySelector('.spinner-border')) {
            return {
                spinner: button.querySelector('.spinner-border'),
                label: button.textContent.trim() || 'Submit'
            };
        }
        const label = button.textContent.trim() || 'Submit';
        button.textContent = '';
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm d-none';
        spinner.setAttribute('role', 'status');
        spinner.setAttribute('aria-hidden', 'true');
        const textNode = document.createTextNode(label);
        button.appendChild(spinner);
        button.appendChild(document.createTextNode(' '));
        button.appendChild(textNode);
        return { spinner, label };
    }

    function setButtonLoading(button, spinner, isLoading) {
        if (!button || !spinner) return;
        spinner.classList.toggle('d-none', !isLoading);
        button.disabled = isLoading;
    }

    function toggleDisabled(elements, disabled) {
        if (!elements) return;
        elements.forEach((el) => {
            if (el) {
                el.disabled = disabled;
            }
        });
    }

    function bindModalLock(modalEl, state) {
        if (!modalEl || modalEl.dataset.lockBound === 'true') return;
        modalEl.dataset.lockBound = 'true';
        modalEl.addEventListener('hide.bs.modal', (event) => {
            if (state.locked) {
                event.preventDefault();
            }
        });
    }

    function setModalLocked(modalEl, locked) {
        if (!modalEl) return;
        modalEl.dataset.locked = locked ? 'true' : 'false';
        const closeButtons = modalEl.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
        closeButtons.forEach((btn) => {
            btn.disabled = locked;
        });
    }

    function cacheModalValues(modalId, fields) {
        if (!modalId) return;
        addBook.state.modalCache[modalId] = addBook.state.modalCache[modalId] || {};
        fields.forEach((field) => {
            if (!field || !field.id) return;
            if (field.type === 'checkbox' || field.type === 'radio') {
                addBook.state.modalCache[modalId][field.id] = field.checked;
            } else {
                addBook.state.modalCache[modalId][field.id] = field.value;
            }
        });
    }

    function restoreModalValues(modalId, fields) {
        const cache = addBook.state.modalCache[modalId];
        if (!cache) return;
        fields.forEach((field) => {
            if (!field || !field.id) return;
            if (!(field.id in cache)) return;
            if (field.type === 'checkbox' || field.type === 'radio') {
                field.checked = Boolean(cache[field.id]);
            } else {
                field.value = cache[field.id];
            }
        });
    }

    function clearModalValues(modalId, fields) {
        if (modalId) {
            addBook.state.modalCache[modalId] = {};
        }
        fields.forEach((field) => {
            if (!field) return;
            if (field.type === 'checkbox' || field.type === 'radio') {
                field.checked = false;
            } else {
                field.value = '';
            }
        });
    }

    function parsePartialDateInput(value) {
        if (!value || !value.trim()) {
            return { value: null };
        }
        if (!window.partialDateParser || typeof window.partialDateParser.parsePartialDate !== 'function') {
            return { error: 'Date parser is unavailable.' };
        }
        const parsed = window.partialDateParser.parsePartialDate(value.trim());
        if (!parsed || !parsed.text) {
            return { error: 'Please enter a valid date.' };
        }
        return { value: parsed };
    }

    function setPartialDateHelp(inputEl, helpEl) {
        if (!inputEl || !helpEl) return;
        const raw = inputEl.value.trim();
        if (!raw) {
            clearHelpText(helpEl);
            return;
        }
        const parsed = parsePartialDateInput(raw);
        if (parsed.error) {
            setHelpText(helpEl, parsed.error, true);
            return;
        }
        setHelpText(helpEl, `Your date will be stored as: ${parsed.value.text}`, false);
    }

    function normalizeUrl(value) {
        if (!value) return null;
        const raw = value.trim();
        if (!raw || /\s/.test(raw)) return null;
        const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        try {
            const url = new URL(withScheme);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
            return url.href;
        } catch (error) {
            return null;
        }
    }

    function isValidUrl(value) {
        return Boolean(normalizeUrl(value));
    }

    function normalizeTag(value) {
        if (!value) return '';
        return value.trim().replace(/\s+/g, ' ');
    }

    function normalizeIsbn(value) {
        if (!value) return null;
        const cleaned = value.replace(/[^0-9xX]/g, '').toUpperCase();
        if (cleaned.length === 10 && /^[0-9]{9}[0-9X]$/.test(cleaned)) return cleaned;
        if (cleaned.length === 13 && /^[0-9]{13}$/.test(cleaned)) return cleaned;
        return null;
    }

    function ensureHelpText(inputEl, helpId) {
        if (!inputEl) return null;
        let helpEl = helpId ? document.getElementById(helpId) : null;
        if (!helpEl) {
            helpEl = document.createElement('small');
            helpEl.className = 'form-text';
            if (helpId) {
                helpEl.id = helpId;
            }
            inputEl.insertAdjacentElement('afterend', helpEl);
        }
        return helpEl;
    }

    addBook.utils = {
        byId,
        setHelpText,
        clearHelpText,
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
        parsePartialDateInput,
        setPartialDateHelp,
        isValidUrl,
        normalizeUrl,
        normalizeTag,
        normalizeIsbn,
        ensureHelpText
    };
})();
