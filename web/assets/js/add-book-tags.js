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

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex flex-wrap gap-2';
        addBook.state.selections.tags.forEach((tag) => {
            const badge = document.createElement('span');
            badge.className = 'badge rounded-pill bg-light fw-normal border rounded-1 border-1 border-black d-inline-flex align-items-center me-2 mb-1';

            const label = document.createElement('span');
            label.className = 'fs-6 text-black d-flex align-items-center';
            label.textContent = tag;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn d-flex align-items-center p-0 ms-1';
            removeBtn.setAttribute('aria-label', 'Remove tag');
            removeBtn.innerHTML = '<i class="bi bi-x-square fs-6" aria-hidden="true"></i>';
            removeBtn.addEventListener('click', () => removeTag(tag));

            label.appendChild(removeBtn);
            badge.appendChild(label);
            li.appendChild(badge);
        });
        listContainer.appendChild(li);
    }

    function validateTag(value) {
        if (!value) {
            return 'Please enter a tag before adding.';
        }
        if (value.length < 2) {
            return 'Tags must be at least 2 characters long.';
        }
        if (value.length > 50) {
            return 'Tags must be 50 characters or fewer.';
        }
        if (!tagPattern.test(value)) {
            return 'Tags contain unsupported characters.';
        }
        if (!/[A-Za-z]/.test(value)) {
            return 'Tags must include at least one letter.';
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
        clearHelpText(helpEl);
        helpEl?.classList.remove('attention-hint');
        addButton.classList.remove('pulse-add');
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
            helpEl?.classList.remove('attention-hint');
            addButton.classList.remove('pulse-add');
            return;
        }
        if (normalized) {
            setHelpText(helpEl, 'Click Add to save this tag.', false);
            helpEl?.classList.add('attention-hint');
            addButton.classList.add('pulse-add');
        } else {
            setHelpText(helpEl, 'Type a tag and click Add to save it.', false);
            helpEl?.classList.remove('attention-hint');
            addButton.classList.remove('pulse-add');
        }
    });

    addButton.addEventListener('click', addTag);
    renderTags();

    addBook.events.addEventListener('tags:updated', () => {
        renderTags();
    });
})();
