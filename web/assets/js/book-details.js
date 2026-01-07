document.addEventListener('DOMContentLoaded', () => {
  const placeholderCover = 'assets/img/BookCoverPlaceholder.png';
  const invalidModal = document.getElementById('invalidBookModal');
  const invalidModalMessage = document.getElementById('invalidBookModalMessage');
  const invalidModalClose = document.getElementById('invalidBookModalClose');
  const pageLoadingModal = bootstrap.Modal.getOrCreateInstance(
    document.getElementById('pageLoadingModal'),
    { backdrop: 'static', keyboard: false }
  );

  const toggleSubtitle = (text) => {
    const el = document.getElementById('bookSubtitle');
    if (!text) {
      el.classList.add('d-none');
      return;
    }
    el.textContent = text;
    el.classList.remove('d-none');
  };

  const formatPartialDate = (date) => {
    if (!date) return null;
    if (date.text) return date.text;
    const parts = [];
    if (date.day) parts.push(String(date.day));
    if (date.month) {
      parts.push(new Date(2000, date.month - 1, 1).toLocaleString(undefined, { month: 'long' }));
    }
    if (date.year) parts.push(String(date.year));
    return parts.length ? parts.join(' ') : null;
  };

  const formatTimestamp = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const setTextOrMuted = (el, text, fallback) => {
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.classList.remove('text-muted');
      return;
    }
    el.textContent = fallback;
    el.classList.add('text-muted');
  };

  const clearElement = (el) => {
    if (el) el.innerHTML = '';
  };

  const showInvalidModal = (message) => {
    if (invalidModalMessage) invalidModalMessage.textContent = message;
    pageLoadingModal.hide();
    const modal = bootstrap.Modal.getOrCreateInstance(invalidModal, { backdrop: 'static', keyboard: false });
    modal.show();
  };

  if (invalidModalClose) {
    invalidModalClose.addEventListener('click', () => {
      window.location.href = 'https://bookproject.fjnel.co.za/books';
    });
  }

  const bookIdParam = new URLSearchParams(window.location.search).get('id');
  const bookId = Number.parseInt(bookIdParam, 10);
  if (!Number.isInteger(bookId) || bookId <= 0) {
    showInvalidModal("This link doesn't seem to lead to a book in your library. Try going back to your book list and selecting it again.");
    return;
  }

  const toggleDetails = ({ row, wrap, chevron }) => {
    if (!row || !wrap || !chevron) return;
    const isOpen = row.getAttribute('data-expanded') === 'true';
    wrap.classList.toggle('d-none', isOpen);
    row.setAttribute('data-expanded', isOpen ? 'false' : 'true');
  };

  const enableExpandableRow = ({ row, wrap, chevron }) => {
    if (!row || !wrap || !chevron) return;
    row.classList.add('clickable-row');
    chevron.classList.remove('d-none');
    row.addEventListener('click', () => toggleDetails({ row, wrap, chevron }));
  };

  const renderAuthors = (authors) => {
    const list = document.getElementById('authorsList');
    clearElement(list);
    if (!authors || authors.length === 0) {
      const item = document.createElement('li');
      item.className = 'list-group-item text-muted';
      item.textContent = 'No authors listed.';
      list.appendChild(item);
      return;
    }
    authors.forEach((author) => {
      const item = document.createElement('li');
      item.className = 'list-group-item position-relative';
      const name = author.authorName || 'Unknown author';
      const role = author.authorRole || 'Constributor';
      const deathLine = author.deceased
        ? `Died: ${formatPartialDate(author.deathDate) || '(date unknown)'}`
        : null;

      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div>
            <div class="fw-semibold mb-0">${name}</div>
            <div class="fst-italic text-muted small">${role}</div>
            ${deathLine ? `<div class="small text-muted mt-1"><span class="fw-semibold">Died:</span> ${deathLine.replace('Died: ', '')}</div>` : ''}
          </div>
        </div>
      `;
      list.appendChild(item);
    });
  };

  const renderSeries = (series) => {
    const list = document.getElementById('seriesList');
    clearElement(list);
    if (!series || series.length === 0) {
      const item = document.createElement('li');
      item.className = 'list-group-item text-muted';
      item.textContent = 'No series listed.';
      list.appendChild(item);
      return;
    }
    series.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'list-group-item position-relative';
      const name = entry.seriesName || 'Untitled series';
      item.innerHTML = `
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <div class="fw-semibold mb-0">${name}</div>
        </div>
      `;
      list.appendChild(item);
    });
  };

  const renderCopies = (copies) => {
    const accordion = document.getElementById('bookCopiesAccordion');
    clearElement(accordion);
    if (!copies || copies.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-muted small';
      empty.textContent = 'No copies yet.';
      accordion.appendChild(empty);
      return;
    }

    const disableDelete = copies.length <= 1;

    copies.forEach((copy, index) => {
      const copyId = copy.id || index + 1;
      const location = copy.storageLocationPath || 'Location unknown';
      const mutedClass = copy.storageLocationPath ? '' : 'text-muted';
      const headingId = `copyHeading${copyId}`;
      const collapseId = `copyCollapse${copyId}`;

      const item = document.createElement('div');
      item.className = 'accordion-item';
      item.innerHTML = `
        <h2 class="accordion-header" id="${headingId}">
          <button class="accordion-button ${index === 0 ? '' : 'collapsed'} text-dark bg-light" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="${collapseId}">
            Copy #${index + 1}
            <span class="ms-2 text-muted small d-none d-sm-inline">&bull; ${location}</span>
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" aria-labelledby="${headingId}" data-bs-parent="#bookCopiesAccordion">
          <div class="accordion-body">
            <div class="d-flex flex-column flex-md-row justify-content-between gap-2">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <div class="fw-semibold fs-6 mb-0">Stored at</div>
                <div class="fw-semibold mb-0 ${mutedClass}">${location}</div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" type="button" disabled aria-disabled="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"></path>
                  </svg>
                  <span>Edit Copy</span>
                </button>
                <button class="btn btn-sm btn-outline-danger" type="button" ${disableDelete ? 'disabled aria-disabled="true"' : ''}>
                  Remove Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      accordion.appendChild(item);
    });
  };

  const renderTags = (tags) => {
    const tagsWrap = document.getElementById('overviewTags');
    clearElement(tagsWrap);
    if (!tags || tags.length === 0) {
      const span = document.createElement('span');
      span.className = 'text-muted';
      span.textContent = 'No tags yet';
      tagsWrap.appendChild(span);
      return;
    }
    tags.forEach((tag) => {
      const badge = document.createElement('span');
      badge.className = 'badge rounded-pill text-bg-light border px-3 py-2 fs-6 me-1 mb-1';
      badge.textContent = tag.name;
      tagsWrap.appendChild(badge);
    });
  };

  const renderOverviewCounts = (book) => {
    const authorsCount = book.stats?.authorCount ?? (book.authors ? book.authors.length : 0);
    const seriesCount = book.stats?.seriesCount ?? (book.series ? book.series.length : 0);
    const copyCount = book.stats?.copyCount ?? (book.bookCopies ? book.bookCopies.length : 0);

    document.getElementById('overviewAuthorsCount').textContent = `Authors: ${authorsCount || 'none'}`;
    document.getElementById('overviewSeriesCount').textContent = `Series: ${seriesCount || 'none'}`;
    document.getElementById('overviewCopiesCount').textContent = `Copies: ${copyCount || 'none'}`;
  };

  const renderOwnership = (book) => {
    const firstAcquired = document.getElementById('overviewFirstAcquired');
    const added = document.getElementById('overviewAdded');
    const updated = document.getElementById('overviewUpdated');

    const acquisitionEntries = (book.bookCopies || [])
      .map((copy) => {
        const date = copy.acquisitionDate;
        const text = formatPartialDate(date);
        if (!text) return null;
        const value = date && date.year ? new Date(date.year, (date.month || 1) - 1, date.day || 1).getTime() : null;
        return { text, value };
      })
      .filter(Boolean);

    if (acquisitionEntries.length > 0) {
      const withValue = acquisitionEntries.filter((entry) => Number.isFinite(entry.value));
      const selected = withValue.length > 0
        ? withValue.sort((a, b) => a.value - b.value)[0]
        : acquisitionEntries[0];
      firstAcquired.textContent = `First acquired: ${selected.text}`;
      firstAcquired.classList.remove('d-none');
    }

    const addedText = formatTimestamp(book.createdAt);
    if (addedText) {
      added.innerHTML = `<span class="fw-semibold">Added:</span> ${addedText}`;
      added.classList.remove('d-none');
    }

    const updatedText = formatTimestamp(book.updatedAt);
    if (updatedText) {
      updated.innerHTML = `<span class="fw-semibold">Updated:</span> ${updatedText}`;
      updated.classList.remove('d-none');
    }
  };

  const renderBook = (book) => {
    document.getElementById('bookTitle').textContent = book.title;
    document.getElementById('bookTitleCompact').textContent = book.title;
    toggleSubtitle(book.subtitle ? book.subtitle.trim() : '');

    const coverImage = document.getElementById('bookCoverImage');
    coverImage.src = book.coverImageUrl || placeholderCover;

    const authorNames = (book.authors || [])
      .map((author) => author.authorName)
      .filter(Boolean);
    const authorLine = authorNames.length > 0 ? authorNames.join(', ') : null;
    setTextOrMuted(document.getElementById('bookAuthorsLine'), authorLine, 'Unknown author(s)');

    const formatLine = book.bookType?.name ? `Format: ${book.bookType.name}` : null;
    setTextOrMuted(document.getElementById('bookFormatLine'), formatLine, 'Format unknown');

    const description = book.description && book.description.trim() ? book.description : null;
    setTextOrMuted(document.getElementById('bookDescription'), description, 'No description available.');

    const publicationDate = formatPartialDate(book.publicationDate);
    const publicationRow = document.getElementById('corePublicationRow');
    if (publicationDate) {
      document.getElementById('corePublicationValue').textContent = publicationDate;
      publicationRow.classList.remove('d-none');
    } else {
      publicationRow.classList.add('d-none');
    }

    const languageNames = (book.languages || []).map((lang) => lang.name).filter(Boolean);
    setTextOrMuted(document.getElementById('coreLanguagesValue'), languageNames.join(', '), 'Language unknown');

    const pagesRow = document.getElementById('corePagesRow');
    if (Number.isInteger(book.pageCount)) {
      document.getElementById('corePagesValue').textContent = book.pageCount;
      pagesRow.classList.remove('d-none');
    } else {
      pagesRow.classList.add('d-none');
    }

    const isbnRow = document.getElementById('coreIsbnRow');
    if (book.isbn) {
      document.getElementById('coreIsbnValue').textContent = book.isbn;
      isbnRow.classList.remove('d-none');
    } else {
      isbnRow.classList.add('d-none');
    }

    const bookTypeRow = document.getElementById('bookTypeRow');
    const bookTypeName = book.bookType?.name || 'Format unknown';
    const bookTypeNameEl = document.getElementById('bookTypeName');
    bookTypeNameEl.textContent = bookTypeName;
    bookTypeNameEl.classList.toggle('text-muted', !book.bookType?.name);

    const bookTypeDescription = book.bookType?.description ? book.bookType.description.trim() : '';
    const bookTypeDescriptionWrap = document.getElementById('bookTypeDescriptionWrap');
    if (bookTypeDescription) {
      document.getElementById('bookTypeDescription').textContent = bookTypeDescription;
      enableExpandableRow({
        row: bookTypeRow,
        wrap: bookTypeDescriptionWrap,
        chevron: document.getElementById('bookTypeChevron')
      });
    }

    const publisherName = book.publisher?.name || 'Publisher unknown';
    const publisherNameEl = document.getElementById('publisherName');
    publisherNameEl.textContent = publisherName;
    publisherNameEl.classList.toggle('text-muted', !book.publisher?.name);

    const publisherDetails = [
      { wrap: 'publisherFoundedWrap', value: 'publisherFounded', data: formatPartialDate(book.publisher?.foundedDate) },
      { wrap: 'publisherWebsiteWrap', value: 'publisherWebsite', data: book.publisher?.website ? book.publisher.website.trim() : '' },
      { wrap: 'publisherNotesWrap', value: 'publisherNotes', data: book.publisher?.notes ? book.publisher.notes.trim() : '' }
    ];
    const hasPublisherDetails = publisherDetails.some((detail) => detail.data);
    if (hasPublisherDetails) {
      const publisherRow = document.getElementById('publisherRow');
      const publisherChevron = document.getElementById('publisherChevron');
      publisherRow.classList.add('clickable-row');
      publisherChevron.classList.remove('d-none');

      publisherDetails.forEach((detail) => {
        if (!detail.data) return;
        const wrap = document.getElementById(detail.wrap);
        const value = document.getElementById(detail.value);
        value.textContent = detail.data;
        wrap.classList.add('d-none');
      });

      publisherRow.addEventListener('click', () => {
        publisherDetails.forEach((detail) => {
          if (!detail.data) return;
          document.getElementById(detail.wrap).classList.toggle('d-none');
        });
      });
    }

    renderTags(book.tags || []);
    renderOverviewCounts(book);
    renderOwnership(book);
    renderAuthors(book.authors || []);
    renderSeries(book.series || []);
    renderCopies(book.bookCopies || []);
  };

  const handleResponseError = async (response) => {
    if (response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      pageLoadingModal.hide();
      await window.rateLimitGuard.showModal();
      return;
    }

    let message = 'The book could not be loaded.';
    try {
      const payload = await response.json();
      if (payload?.message) {
        message = payload.message;
      }
    } catch (error) {
      message = response.status === 404 ? 'Book not found.' : message;
    }
    showInvalidModal(message);
  };

  const loadBook = async () => {
    pageLoadingModal.show();
    try {
      const response = await apiFetch(`/book?id=${bookId}&view=all&returnStats=true`, { method: 'GET' });
      if (!response.ok) {
        await handleResponseError(response);
        return;
      }
      const payload = await response.json();
      if (!payload || payload.status !== 'success' || !payload.data) {
        showInvalidModal('The book could not be loaded.');
        return;
      }
      renderBook(payload.data);
    } catch (error) {
      showInvalidModal('The book could not be loaded.');
    } finally {
      pageLoadingModal.hide();
    }
  };

  loadBook();

  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach((tooltipTriggerEl) => {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
});
