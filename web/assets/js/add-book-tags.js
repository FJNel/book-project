// Handles tag entry for the book.
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const { byId, setHelpText, clearHelpText, normalizeTag } = addBook.utils;
    const log = (...args) => console.log('[Add Book][Tags]', ...args);

    const input = byId('sevenEdtBookTag');
    const addButton = byId('sevenBtnAddBookTag');
    const listContainer = byId('selectedSeriesList-1');
    const placeholder = byId('noSeriesPlaceholder-1');
    const helpEl = byId('sevenBookTagHelp');
    const tagPattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;

    if (!input || !addButton || !listContainer) return;

    function renderTags() {
        listContainer.innerHTML = '';
        if (addBook.state.selections.tags.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.id = 'noTagsPlaceholder';
            li.textContent = 'No tags added yet.';
            listContainer.appendChild(li);
            return;
        }

        addBook.state.selections.tags.forEach((tag) => {
            const li = document.createElement('li');
            li.className = 'list-group-item';

            const badge = document.createElement('span');
            badge.className = 'badge rounded-pill bg-light fw-normal border rounded-1 border-1 border-black d-inline-flex align-items-center me-2 mb-1';

            const label = document.createElement('span');
            label.className = 'fs-6 text-black d-flex align-items-center';
            label.textContent = tag;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn d-flex align-items-center p-0 ms-1';
            removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" class="text-black" style="font-size:17px;"><path d="M16.3956 7.75734C16.7862 8.14786 16.7862 8.78103 16.3956 9.17155L13.4142 12.153L16.0896 14.8284C16.4802 15.2189 16.4802 15.8521 16.0896 16.2426C15.6991 16.6331 15.0659 16.6331 14.6754 16.2426L12 13.5672L9.32458 16.2426C8.93405 16.6331 8.30089 16.6331 7.91036 16.2426C7.51984 15.8521 7.51984 15.2189 7.91036 14.8284L10.5858 12.153L7.60436 9.17155C7.21383 8.78103 7.21383 8.14786 7.60436 7.75734C7.99488 7.36681 8.62805 7.36681 9.01857 7.75734L12 10.7388L14.9814 7.75734Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M4 1C2.34315 1 1 2.34315 1 4V20C1 21.6569 2.34315 23 4 23H20C21.6569 23 23 21.6569 23 20V4C23 2.34315 21.6569 1 20 1H4ZM20 3H4C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21H20C20.5523 21 21 20.5523 21 20V4C21 3.44772 20.5523 3 20 3Z" fill="currentColor"></path></svg>';
            removeBtn.addEventListener('click', () => removeTag(tag));

            label.appendChild(removeBtn);
            badge.appendChild(label);
            li.appendChild(badge);
            listContainer.appendChild(li);
        });
    }

    function validateTag(value) {
        if (!value) {
            return 'Please enter a tag before adding.';
        }
        if (value.length > 50) {
            return 'Tags must be 50 characters or fewer.';
        }
        if (!tagPattern.test(value)) {
            return 'Tags contain unsupported characters.';
        }
        const exists = addBook.state.selections.tags.some((tag) => tag.toLowerCase() === value.toLowerCase());
        if (exists) {
            return 'That tag has already been added.';
        }
        return null;
    }

    function addTag() {
        clearHelpText(helpEl);
        const normalized = normalizeTag(input.value);
        const error = validateTag(normalized);
        if (error) {
            setHelpText(helpEl, error, true);
            log('Tag validation error:', error);
            return;
        }
        addBook.state.selections.tags.push(normalized);
        input.value = '';
        renderTags();
        log('Tag added:', normalized);
    }

    function removeTag(tag) {
        addBook.state.selections.tags = addBook.state.selections.tags.filter((item) => item !== tag);
        renderTags();
        log('Tag removed:', tag);
    }

    input.addEventListener('input', () => {
        clearHelpText(helpEl);
        const normalized = normalizeTag(input.value);
        const error = validateTag(normalized);
        if (error && normalized) {
            setHelpText(helpEl, error, true);
        }
    });

    addButton.addEventListener('click', addTag);
    renderTags();
})();
