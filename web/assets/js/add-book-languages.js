// Handles language selection for the book.
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const { byId, setHelpText, clearHelpText } = addBook.utils;
    const log = (...args) => console.log('[Add Book][Languages]', ...args);

    const languageSelect = byId('twoCmbLanguage');
    const addButton = byId('twoBtnAddLanguage');
    const listContainer = byId('selectedLanguagesContainer');
    const placeholder = byId('languagePillPlaceholder');
    const helpEl = byId('twoBookLanguageHelp');

    if (!languageSelect || !addButton || !listContainer) return;

    function renderSelected() {
        listContainer.innerHTML = '';
        if (addBook.state.languages.selected.length === 0) {
            const span = document.createElement('span');
            span.id = 'languagePillPlaceholder';
            span.textContent = 'No languages added yet.';
            listContainer.appendChild(span);
            return;
        }

        addBook.state.languages.selected.forEach((lang) => {
            const badge = document.createElement('span');
            badge.className = 'badge rounded-pill bg-light fw-normal border rounded-1 border-1 border-black d-inline-flex align-items-center me-2 mb-1';
            badge.dataset.languageId = String(lang.id);

            const label = document.createElement('span');
            label.className = 'fs-6 text-black d-flex align-items-center';
            label.textContent = lang.name;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn d-flex align-items-center p-0 ms-1';
            removeBtn.setAttribute('aria-label', 'Remove language');
            removeBtn.innerHTML = '<i class="bi bi-x-square fs-6" aria-hidden="true"></i>';
            removeBtn.addEventListener('click', () => removeLanguage(lang.id));

            label.appendChild(removeBtn);
            badge.appendChild(label);
            listContainer.appendChild(badge);
        });
    }

    function refreshSelectOptions() {
        languageSelect.innerHTML = '';
        const available = addBook.state.languages.all.filter((lang) => !addBook.state.languages.selected.some((sel) => sel.id === lang.id));
        if (available.length === 0) {
            languageSelect.disabled = true;
            addButton.disabled = true;
            setHelpText(helpEl, 'All available languages have been added.', true);
            helpEl?.classList.remove('attention-hint');
            addButton.classList.remove('pulse-add');
            return;
        }

        addButton.disabled = false;
        languageSelect.disabled = false;
        clearHelpText(helpEl);

        const placeholderOption = document.createElement('option');
        placeholderOption.value = 'none';
        placeholderOption.textContent = 'Select language...';
        placeholderOption.selected = true;
        languageSelect.appendChild(placeholderOption);

        available.forEach((lang) => {
            const option = document.createElement('option');
            option.value = String(lang.id);
            option.textContent = lang.name;
            languageSelect.appendChild(option);
        });
        setHelpText(helpEl, 'Select a language and click Add to save it.', false);
        helpEl?.classList.remove('attention-hint');
        addButton.classList.remove('pulse-add');
    }

    function addLanguage() {
        clearHelpText(helpEl);
        const selectedId = languageSelect.value;
        if (!selectedId || selectedId === 'none') {
            setHelpText(helpEl, 'Please select a language to add.', true);
            log('Add language failed: no selection.');
            return;
        }
        const lang = addBook.state.languages.all.find((entry) => String(entry.id) === selectedId);
        if (!lang) return;
        addBook.state.languages.selected.push(lang);
        refreshSelectOptions();
        renderSelected();
        clearHelpText(helpEl);
        helpEl?.classList.remove('attention-hint');
        addButton.classList.remove('pulse-add');
        log('Language added:', lang);
    }

    function removeLanguage(id) {
        addBook.state.languages.selected = addBook.state.languages.selected.filter((lang) => lang.id !== id);
        refreshSelectOptions();
        renderSelected();
        log('Language removed:', id);
    }

    addBook.events.addEventListener('languages:loaded', () => {
        refreshSelectOptions();
        renderSelected();
        log('Languages event received:', addBook.state.languages.all.length);
    });

    addBook.events.addEventListener('languages:updated', () => {
        refreshSelectOptions();
        renderSelected();
        log('Languages updated from edit mode.');
    });

    languageSelect.addEventListener('change', () => {
        if (!languageSelect.value || languageSelect.value === 'none') {
            clearHelpText(helpEl);
            helpEl?.classList.remove('attention-hint');
            addButton.classList.remove('pulse-add');
            return;
        }
        setHelpText(helpEl, 'Click Add to save this language.', false);
        helpEl?.classList.add('attention-hint');
        addButton.classList.add('pulse-add');
    });
    languageSelect.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        addLanguage();
    });
    addButton.addEventListener('click', addLanguage);
})();
