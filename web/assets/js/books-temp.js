// Temporary debug page to display GET /book JSON.
(function () {
    const log = (...args) => console.log('[Books Temp]', ...args);
    const statusEl = document.getElementById('booksStatus');
    const jsonEl = document.getElementById('booksJson');

    async function loadBooks() {
        if (statusEl) {
            statusEl.textContent = 'Loading books...';
            statusEl.className = 'alert alert-secondary';
        }
        const params = new URLSearchParams(window.location.search);
        const bookId = params.get('id');
        const path = bookId ? `/book?id=${encodeURIComponent(bookId)}` : '/book';
        log('Requesting GET', path);
        try {
            const response = await apiFetch(path, { method: 'GET' });
            const data = await response.json().catch(() => ({}));
            log('Response status:', response.status);

            if (!response.ok) {
                const message = data.message || 'Failed to load books.';
                if (statusEl) {
                    statusEl.textContent = message;
                    statusEl.className = 'alert alert-danger';
                }
                jsonEl.textContent = JSON.stringify(data, null, 2);
                return;
            }

            if (statusEl) {
                statusEl.textContent = 'Books loaded successfully.';
                statusEl.className = 'alert alert-success';
            }
            jsonEl.textContent = JSON.stringify(data, null, 2);
        } catch (error) {
            log('Request failed:', error);
            if (statusEl) {
                statusEl.textContent = 'Unable to load books right now.';
                statusEl.className = 'alert alert-danger';
            }
            jsonEl.textContent = '';
        }
    }

    document.addEventListener('DOMContentLoaded', loadBooks);
})();
