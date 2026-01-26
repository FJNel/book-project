(function () {
  const log = (...args) => console.log('[AdminLibraryDetails]', ...args);
  const errorLog = (...args) => console.error('[AdminLibraryDetails]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const dom = {
    feedbackContainer: document.getElementById('feedbackContainer'),
    title: document.getElementById('bookTitle'),
    subtitle: document.getElementById('bookSubtitle'),
    description: document.getElementById('bookDescription'),
    isbn: document.getElementById('bookIsbn'),
    pages: document.getElementById('bookPages'),
    year: document.getElementById('bookYear'),
    status: document.getElementById('bookStatus'),
    authors: document.getElementById('bookAuthors'),
    tags: document.getElementById('bookTags'),
    bookType: document.getElementById('bookType'),
    publisher: document.getElementById('bookPublisher'),
    storage: document.getElementById('bookStorage'),
    created: document.getElementById('bookCreated'),
    updated: document.getElementById('bookUpdated'),
    libraryLink: document.getElementById('libraryLink'),
    backLink: document.getElementById('backLink')
  };

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const formatTimestamp = (value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const showAlert = (message) => {
    if (!dom.feedbackContainer) return;
    dom.feedbackContainer.innerHTML = `
      <div class="alert alert-danger">${escapeHtml(message || 'Unable to load data.')}</div>
    `;
  };

  const getQuery = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      userId: params.get('userId'),
      bookId: params.get('bookId')
    };
  };

  const updateLinks = (userId) => {
    const url = `admin-library?userId=${encodeURIComponent(userId)}`;
    if (dom.libraryLink) dom.libraryLink.href = url;
    if (dom.backLink) dom.backLink.href = url;
  };

  const renderDetails = (book) => {
    dom.title.textContent = book.title || 'Book';
    dom.subtitle.textContent = book.subtitle || 'No subtitle provided.';
    dom.description.textContent = book.description || 'No description provided.';
    dom.isbn.textContent = book.isbn || '—';
    dom.pages.textContent = book.pageCount != null ? book.pageCount : '—';
    dom.year.textContent = book.publishYear != null ? book.publishYear : '—';
    dom.status.textContent = book.deletedAt ? 'Removed' : 'Active';
    dom.bookType.textContent = book.bookType?.name || '—';
    dom.publisher.textContent = book.publisher?.name || '—';
    dom.storage.textContent = book.storageLocation?.name || '—';
    dom.created.textContent = formatTimestamp(book.createdAt);
    dom.updated.textContent = formatTimestamp(book.updatedAt);

    dom.authors.innerHTML = book.authors?.length
      ? book.authors.map((author) => `<span class="badge text-bg-light border me-1">${escapeHtml(author.name)}</span>`).join('')
      : '—';

    dom.tags.innerHTML = book.tags?.length
      ? book.tags.map((tag) => `<span class="badge text-bg-light border me-1">${escapeHtml(tag.name)}</span>`).join('')
      : '—';
  };

  const loadDetails = async () => {
    const { userId, bookId } = getQuery();
    if (!userId || !bookId) {
      showAlert('Select a book to view.');
      return;
    }
    updateLinks(userId);

    try {
      log('Loading book', userId, bookId);
      const response = await apiFetch(`/admin/users/${userId}/library/books/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to load book.');
      }
      renderDetails(data?.data?.book || data?.data);
    } catch (err) {
      errorLog('Failed to load book', err);
      showAlert('Unable to load book details right now.');
    }
  };

  loadDetails();
})();
