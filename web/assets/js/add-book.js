// Core Add Book page logic (data loading, selections, and payload building).
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const {
        byId,
        setHelpText,
        clearHelpText,
        setPartialDateHelp,
        parsePartialDateInput,
        isValidUrl
    } = addBook.utils;

    const selectors = {
        title: byId('twoEdtTitle'),
        subtitle: byId('twoEdtSubtitle'),
        isbn: byId('twoEdtISBN'),
        publicationDate: byId('twoEdtPublicationDate'),
        pages: byId('twoSpnPages'),
        coverUrl: byId('twoEdtBookCoverURL'),
        description: byId('twoRdtBookDescription'),
        bookType: byId('threeCmbBookType'),
        bookTypeHelp: byId('threeBookTypeHelp'),
        bookTypeDesc: byId('threeLblBookTypeDescription'),
        publisher: byId('fiveCmbSelectPublisher'),
        publisherHelp: byId('bookPublisherHelp'),
        publisherFounded: byId('fiveLblPublisherFoundedDate'),
        publisherWebsite: byId('fiveLblPublisherWebsite'),
        publisherNotes: byId('fiveLblPublisherNotes'),
        authorSearch: byId('fourEdtAuthorSearch'),
        authorResults: byId('authorSearchResults'),
        authorList: byId('selectedAuthorsList'),
        authorPlaceholder: byId('noAuthorsPlaceholder'),
        authorTemplate: byId('liAuthorTemplate'),
        seriesSearch: byId('sixEdtSearchSeries'),
        seriesResults: byId('seriesSearchResults'),
        seriesList: byId('selectedSeriesList'),
        seriesPlaceholder: byId('noSeriesPlaceholder'),
        seriesTemplate: byId('liSeriesTemplate'),
        storageLocation: byId('eightCmbLocation'),
        storageLocationHelp: byId('eightBookLocationHelp'),
        storageLocationNotes: byId('eightLblLocationNotes'),
        acquisitionStory: byId('eightRdtStory'),
        acquisitionDate: byId('eightEdtAcquisitionDate'),
        acquisitionDateHelp: byId('eightAcquisitioDateHelp'),
        acquiredFrom: byId('eightEdtAcquiredFrom'),
        acquiredFromHelp: byId('eightAcquiredFromHelp'),
        acquisitionType: byId('eightCmbAcquisitionType'),
        acquisitionTypeHelp: byId('eightAcquisitioType'),
        acquisitionLocation: byId('eightEdtAcquisitionLocation'),
        acquisitionLocationHelp: byId('eightAcquisitionLocationHelp'),
        copyNotes: byId('eightRdtOtherNotes')
    };

    const authorTemplate = selectors.authorTemplate ? selectors.authorTemplate.cloneNode(true) : null;
    if (selectors.authorTemplate) {
        selectors.authorTemplate.remove();
    }

    const seriesTemplate = selectors.seriesTemplate ? selectors.seriesTemplate.cloneNode(true) : null;
    if (selectors.seriesTemplate) {
        selectors.seriesTemplate.remove();
    }

    function renderBookTypes() {
        if (!selectors.bookType) return;
        selectors.bookType.innerHTML = '<option value="none" selected>Select book type...</option>';
        if (addBook.state.bookTypes.length === 0) {
            selectors.bookType.disabled = true;
            setHelpText(selectors.bookTypeHelp, 'No book types available. Please add a new book type.', true);
            selectors.bookTypeDesc.textContent = 'No Book Type selected.';
            return;
        }
        selectors.bookType.disabled = false;
        clearHelpText(selectors.bookTypeHelp);
        addBook.state.bookTypes.forEach((type) => {
            const option = document.createElement('option');
            option.value = String(type.id);
            option.textContent = type.name;
            selectors.bookType.appendChild(option);
        });
    }

    function updateBookTypeDisplay() {
        const selectedId = selectors.bookType.value;
        if (!selectedId || selectedId === 'none') {
            addBook.state.selections.bookTypeId = null;
            selectors.bookTypeDesc.textContent = 'No Book Type selected.';
            return;
        }
        addBook.state.selections.bookTypeId = Number.parseInt(selectedId, 10);
        const type = addBook.state.bookTypes.find((entry) => String(entry.id) === selectedId);
        selectors.bookTypeDesc.textContent = type && type.description ? type.description : 'No description available.';
    }

    function renderPublishers() {
        if (!selectors.publisher) return;
        selectors.publisher.innerHTML = '<option value="none" selected>Select publisher...</option>';
        if (addBook.state.publishers.length === 0) {
            selectors.publisher.disabled = true;
            setHelpText(selectors.publisherHelp, 'No publishers available. Please add a new publisher.', true);
            selectors.publisherFounded.textContent = 'No Publisher selected.';
            selectors.publisherWebsite.textContent = 'No Publisher selected.';
            selectors.publisherNotes.textContent = 'No Publisher selected.';
            return;
        }
        selectors.publisher.disabled = false;
        clearHelpText(selectors.publisherHelp);
        addBook.state.publishers.forEach((publisher) => {
            const option = document.createElement('option');
            option.value = String(publisher.id);
            option.textContent = publisher.name;
            selectors.publisher.appendChild(option);
        });
    }

    function updatePublisherDisplay() {
        const selectedId = selectors.publisher.value;
        if (!selectedId || selectedId === 'none') {
            addBook.state.selections.publisherId = null;
            selectors.publisherFounded.textContent = 'No Publisher selected.';
            selectors.publisherWebsite.textContent = 'No Publisher selected.';
            selectors.publisherNotes.textContent = 'No Publisher selected.';
            return;
        }
        addBook.state.selections.publisherId = Number.parseInt(selectedId, 10);
        const publisher = addBook.state.publishers.find((entry) => String(entry.id) === selectedId);
        selectors.publisherFounded.textContent = publisher?.foundedDate?.text || 'No founded date provided.';
        selectors.publisherWebsite.textContent = publisher?.website || 'No website provided.';
        selectors.publisherNotes.textContent = publisher?.notes || 'No notes provided.';
    }

    function renderLocations() {
        if (!selectors.storageLocation) return;
        selectors.storageLocation.innerHTML = '<option value="none" selected>Select storage location...</option>';
        if (addBook.state.locations.length === 0) {
            selectors.storageLocation.disabled = true;
            setHelpText(selectors.storageLocationHelp, 'No storage locations available. Please add a new storage location.', true);
            selectors.storageLocationNotes.textContent = 'No storage location selected.';
            return;
        }
        selectors.storageLocation.disabled = false;
        clearHelpText(selectors.storageLocationHelp);
        addBook.state.locations.forEach((location) => {
            const option = document.createElement('option');
            option.value = String(location.id);
            option.textContent = location.path || location.name;
            selectors.storageLocation.appendChild(option);
        });
    }

    function updateLocationDisplay() {
        const selectedId = selectors.storageLocation.value;
        if (!selectedId || selectedId === 'none') {
            addBook.state.selections.storageLocationId = null;
            addBook.state.selections.storageLocationPath = null;
            selectors.storageLocationNotes.textContent = 'No storage location selected.';
            return;
        }
        const location = addBook.state.locations.find((entry) => String(entry.id) === selectedId);
        addBook.state.selections.storageLocationId = Number.parseInt(selectedId, 10);
        addBook.state.selections.storageLocationPath = location?.path || null;
        selectors.storageLocationNotes.textContent = location?.notes || 'No notes provided.';
    }

    function renderAuthors() {
        if (!selectors.authorList || !authorTemplate) return;
        selectors.authorList.innerHTML = '';
        if (addBook.state.selections.authors.length === 0) {
            const placeholder = document.createElement('li');
            placeholder.className = 'list-group-item';
            placeholder.id = 'noAuthorsPlaceholder';
            placeholder.textContent = 'No authors selected yet.';
            selectors.authorList.appendChild(placeholder);
            return;
        }

        addBook.state.selections.authors.forEach((author) => {
            const li = authorTemplate.cloneNode(true);
            li.id = '';
            const nameEl = li.querySelector('strong');
            const roleSelect = li.querySelector('select');
            const otherRoleInput = li.querySelector('input');
            const removeBtn = li.querySelector('button.btn-close');

            if (nameEl) {
                nameEl.textContent = author.displayName;
                nameEl.removeAttribute('id');
            }
            if (roleSelect) {
                roleSelect.removeAttribute('id');
                roleSelect.value = author.role || 'none';
                roleSelect.addEventListener('change', () => {
                    author.role = roleSelect.value === 'none' ? null : roleSelect.value;
                    if (author.role !== 'Other') {
                        author.customRole = '';
                        if (otherRoleInput) {
                            otherRoleInput.value = '';
                            otherRoleInput.closest('.input-group')?.classList.add('d-none');
                        }
                    } else {
                        otherRoleInput?.closest('.input-group')?.classList.remove('d-none');
                    }
                });
            }
            if (otherRoleInput) {
                otherRoleInput.removeAttribute('id');
                otherRoleInput.value = author.customRole || '';
                otherRoleInput.closest('.input-group')?.classList.toggle('d-none', author.role !== 'Other');
                otherRoleInput.addEventListener('input', () => {
                    author.customRole = otherRoleInput.value.trim();
                });
            }
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    addBook.state.selections.authors = addBook.state.selections.authors.filter((entry) => entry.id !== author.id);
                    renderAuthors();
                });
            }
            selectors.authorList.appendChild(li);
        });
    }

    function renderSeries() {
        if (!selectors.seriesList || !seriesTemplate) return;
        selectors.seriesList.innerHTML = '';
        if (addBook.state.selections.series.length === 0) {
            const placeholder = document.createElement('li');
            placeholder.className = 'list-group-item';
            placeholder.id = 'noSeriesPlaceholder';
            placeholder.textContent = 'No series selected yet.';
            selectors.seriesList.appendChild(placeholder);
            return;
        }

        addBook.state.selections.series.forEach((series) => {
            const li = seriesTemplate.cloneNode(true);
            li.id = '';
            const nameEl = li.querySelector('strong');
            const orderInput = li.querySelector('input');
            const removeBtn = li.querySelector('button.btn-close');

            if (nameEl) {
                nameEl.textContent = series.name;
                nameEl.removeAttribute('id');
            }
            if (orderInput) {
                orderInput.removeAttribute('id');
                orderInput.value = series.order || '';
                orderInput.addEventListener('input', () => {
                    const value = orderInput.value.trim();
                    series.order = value ? Number.parseInt(value, 10) : null;
                });
            }
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    addBook.state.selections.series = addBook.state.selections.series.filter((entry) => entry.id !== series.id);
                    renderSeries();
                });
            }
            selectors.seriesList.appendChild(li);
        });
    }

    function showSearchResults(container, items, onSelect) {
        if (!container) return;
        container.classList.remove('d-none');
        container.innerHTML = '';
        items.forEach((item) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'list-group-item list-group-item-action';
            option.textContent = item.displayName || item.name;
            option.addEventListener('click', () => onSelect(item));
            container.appendChild(option);
        });
    }

    function hideSearchResults(container) {
        if (!container) return;
        container.classList.add('d-none');
        container.innerHTML = '';
    }

    function handleAuthorSearch() {
        const query = selectors.authorSearch.value.trim().toLowerCase();
        if (!query) {
            hideSearchResults(selectors.authorResults);
            return;
        }
        const results = addBook.state.authors
            .filter((author) => !addBook.state.selections.authors.some((selected) => selected.id === author.id))
            .filter((author) => author.displayName.toLowerCase().includes(query));
        showSearchResults(selectors.authorResults, results, (author) => {
            addBook.state.selections.authors.push({ id: author.id, displayName: author.displayName, role: null, customRole: '' });
            selectors.authorSearch.value = '';
            hideSearchResults(selectors.authorResults);
            renderAuthors();
        });
    }

    function handleSeriesSearch() {
        const query = selectors.seriesSearch.value.trim().toLowerCase();
        if (!query) {
            hideSearchResults(selectors.seriesResults);
            return;
        }
        const results = addBook.state.series
            .filter((series) => !addBook.state.selections.series.some((selected) => selected.id === series.id))
            .filter((series) => series.name.toLowerCase().includes(query));
        showSearchResults(selectors.seriesResults, results, (series) => {
            addBook.state.selections.series.push({ id: series.id, name: series.name, order: null });
            selectors.seriesSearch.value = '';
            hideSearchResults(selectors.seriesResults);
            renderSeries();
        });
    }

    async function loadLanguages() {
        const response = await apiFetch('/languages', { method: 'GET' });
        const data = await response.json().catch(() => ({}));
        addBook.state.languages.all = response.ok ? (data.data?.languages || []) : [];
        addBook.events.dispatchEvent(new CustomEvent('languages:loaded', { detail: addBook.state.languages.all }));
    }

    async function loadBookTypes() {
        const response = await apiFetch('/booktype', { method: 'GET' });
        const data = await response.json().catch(() => ({}));
        addBook.state.bookTypes = response.ok ? (data.data?.bookTypes || []) : [];
        renderBookTypes();
    }

    async function loadPublishers() {
        const response = await apiFetch('/publisher', { method: 'GET' });
        const data = await response.json().catch(() => ({}));
        addBook.state.publishers = response.ok ? (data.data?.publishers || []) : [];
        renderPublishers();
    }

    async function loadAuthors() {
        const response = await apiFetch('/author', { method: 'GET' });
        const data = await response.json().catch(() => ({}));
        addBook.state.authors = response.ok ? (data.data?.authors || []) : [];
    }

    async function loadSeries() {
        const response = await apiFetch('/bookseries', { method: 'GET' });
        const data = await response.json().catch(() => ({}));
        addBook.state.series = response.ok ? (data.data?.series || []) : [];
    }

    async function loadLocations() {
        const response = await apiFetch('/storagelocation', { method: 'GET' });
        const data = await response.json().catch(() => ({}));
        addBook.state.locations = response.ok ? (data.data?.storageLocations || []) : [];
        renderLocations();
        addBook.events.dispatchEvent(new CustomEvent('locations:loaded', { detail: addBook.state.locations }));
    }

    addBook.buildPayload = function buildPayload({ dryRun = false } = {}) {
        const publicationParsed = parsePartialDateInput(selectors.publicationDate.value.trim());
        const acquisitionParsed = parsePartialDateInput(selectors.acquisitionDate.value.trim());
        const pageCountValue = selectors.pages.value ? Number.parseInt(selectors.pages.value, 10) : null;

        const authorsPayload = addBook.state.selections.authors.map((author) => {
            const role = author.role === 'Other' ? (author.customRole || null) : author.role;
            return { authorId: author.id, authorRole: role };
        });

        const seriesPayload = addBook.state.selections.series.map((series) => ({
            seriesId: series.id,
            bookOrder: series.order || undefined
        }));

        const payload = {
            title: selectors.title.value.trim(),
            subtitle: selectors.subtitle.value.trim() || null,
            isbn: selectors.isbn.value.trim() || null,
            publicationDate: publicationParsed.value || null,
            pageCount: Number.isInteger(pageCountValue) ? pageCountValue : null,
            coverImageUrl: selectors.coverUrl.value.trim() || null,
            description: selectors.description.value.trim() || null,
            bookTypeId: addBook.state.selections.bookTypeId || null,
            publisherId: addBook.state.selections.publisherId || null,
            authors: authorsPayload,
            languageIds: addBook.state.languages.selected.map((lang) => lang.id),
            tags: addBook.state.selections.tags,
            series: seriesPayload,
            bookCopy: {
                storageLocationId: addBook.state.selections.storageLocationId || null,
                storageLocationPath: addBook.state.selections.storageLocationPath || null,
                acquisitionStory: selectors.acquisitionStory.value.trim() || null,
                acquisitionDate: acquisitionParsed.value || null,
                acquiredFrom: selectors.acquiredFrom.value.trim() || null,
                acquisitionType: selectors.acquisitionType.value.trim() || null,
                acquisitionLocation: selectors.acquisitionLocation.value.trim() || null,
                notes: selectors.copyNotes.value.trim() || null
            },
            dryRun
        };

        return payload;
    };

    addBook.validateMainForm = function validateMainForm() {
        const errors = [];
        const title = selectors.title.value.trim();
        if (!title) {
            errors.push('Title is required.');
        } else if (title.length < 2 || title.length > 255) {
            errors.push('Title must be between 2 and 255 characters.');
        }

        if (selectors.subtitle.value.trim().length > 255) {
            errors.push('Subtitle must be 255 characters or fewer.');
        }

        if (selectors.isbn.value.trim()) {
            const isbn = selectors.isbn.value.trim();
            if (!/^[0-9Xx-]{10,17}$/.test(isbn)) {
                errors.push('ISBN must be 10-17 characters and contain digits, hyphens, or X.');
            }
        }

        if (selectors.coverUrl.value.trim() && !isValidUrl(selectors.coverUrl.value.trim())) {
            errors.push('Book cover URL must be a valid URL starting with http:// or https://');
        }

        if (selectors.description.value.trim().length > 2000) {
            errors.push('Description must be 2000 characters or fewer.');
        }

        if (selectors.pages.value) {
            const value = Number.parseInt(selectors.pages.value, 10);
            if (!Number.isInteger(value) || value < 1 || value > 10000) {
                errors.push('Number of pages must be between 1 and 10000.');
            }
        }

        if (selectors.publicationDate.value.trim()) {
            const parsed = parsePartialDateInput(selectors.publicationDate.value);
            if (parsed.error) {
                errors.push(parsed.error);
            }
        }

        if (selectors.acquisitionDate.value.trim()) {
            const parsed = parsePartialDateInput(selectors.acquisitionDate.value);
            if (parsed.error) {
                errors.push(parsed.error);
            }
        }

        addBook.state.selections.authors.forEach((author) => {
            if (author.role === 'Other' && (!author.customRole || author.customRole.trim().length < 2)) {
                errors.push(`Author role is required for ${author.displayName}.`);
            }
            if (author.customRole && author.customRole.length > 100) {
                errors.push(`Author role for ${author.displayName} must be 100 characters or fewer.`);
            }
        });

        addBook.state.selections.series.forEach((series) => {
            if (series.order !== null && series.order !== undefined) {
                if (!Number.isInteger(series.order) || series.order < 1 || series.order > 10000) {
                    errors.push(`Series order for ${series.name} must be between 1 and 10000.`);
                }
            }
        });

        return errors;
    };

    addBook.events.addEventListener('booktype:created', (event) => {
        if (!event.detail) return;
        addBook.state.bookTypes.push(event.detail);
        renderBookTypes();
        selectors.bookType.value = String(event.detail.id);
        updateBookTypeDisplay();
    });

    addBook.events.addEventListener('publisher:created', (event) => {
        if (!event.detail) return;
        addBook.state.publishers.push(event.detail);
        renderPublishers();
        selectors.publisher.value = String(event.detail.id);
        updatePublisherDisplay();
    });

    addBook.events.addEventListener('author:created', (event) => {
        if (!event.detail) return;
        addBook.state.authors.push(event.detail);
        addBook.state.selections.authors.push({ id: event.detail.id, displayName: event.detail.displayName, role: null, customRole: '' });
        renderAuthors();
    });

    addBook.events.addEventListener('series:created', (event) => {
        if (!event.detail) return;
        addBook.state.series.push(event.detail);
        addBook.state.selections.series.push({ id: event.detail.id, name: event.detail.name, order: null });
        renderSeries();
    });

    addBook.events.addEventListener('location:created', (event) => {
        if (!event.detail) return;
        addBook.state.locations.push(event.detail);
        renderLocations();
        selectors.storageLocation.value = String(event.detail.id);
        updateLocationDisplay();
    });

    function attachEvents() {
        selectors.bookType.addEventListener('change', updateBookTypeDisplay);
        selectors.publisher.addEventListener('change', updatePublisherDisplay);
        selectors.storageLocation.addEventListener('change', updateLocationDisplay);

        selectors.authorSearch.addEventListener('input', handleAuthorSearch);
        selectors.authorSearch.addEventListener('blur', () => setTimeout(() => hideSearchResults(selectors.authorResults), 150));

        selectors.seriesSearch.addEventListener('input', handleSeriesSearch);
        selectors.seriesSearch.addEventListener('blur', () => setTimeout(() => hideSearchResults(selectors.seriesResults), 150));

        selectors.publicationDate.addEventListener('input', () => setPartialDateHelp(selectors.publicationDate, byId('twoPublicationDateHelp')));
        selectors.acquisitionDate.addEventListener('input', () => setPartialDateHelp(selectors.acquisitionDate, selectors.acquisitionDateHelp));
    }

    async function initialize() {
        attachEvents();
        renderAuthors();
        renderSeries();
        await Promise.allSettled([
            loadLanguages(),
            loadBookTypes(),
            loadPublishers(),
            loadAuthors(),
            loadSeries(),
            loadLocations()
        ]);
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();
