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
            removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" class="text-black" style="font-size:17px;"><path d="M16.3956 7.75734C16.7862 8.14786 16.7862 8.78103 16.3956 9.17155L13.4142 12.153L16.0896 14.8284C16.4802 15.2189 16.4802 15.8521 16.0896 16.2426C15.6991 16.6331 15.0659 16.6331 14.6754 16.2426L12 13.5672L9.32458 16.2426C8.93405 16.6331 8.30089 16.6331 7.91036 16.2426C7.51984 15.8521 7.51984 15.2189 7.91036 14.8284L10.5858 12.153L7.60436 9.17155C7.21383 8.78103 7.21383 8.14786 7.60436 7.75734C7.99488 7.36681 8.62805 7.36681 9.01857 7.75734L12 10.7388L14.9814 7.75734C15.372 7.36681 16.0051 7.36681 16.3956 7.75734Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M4 1C2.34315 1 1 2.34315 1 4V20C1 21.6569 2.34315 23 4 23H20C21.6569 23 23 21.6569 23 20V4C23 2.34315 21.6569 1 20 1H4ZM20 3H4C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21H20C20.5523 21 21 20.5523 21 20V4C21 3.44772 20.5523 3 20 3Z" fill="currentColor"></path></svg>';
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
    addButton.addEventListener('click', addLanguage);
})();
