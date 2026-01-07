// Handles the book cover preview modal.
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const { byId, isValidUrl } = addBook.utils;
    const log = (...args) => console.log('[Add Book][Cover]', ...args);

    const urlInput = byId('twoEdtBookCoverURL');
    const previewImg = byId('bookCoverPreviewImage');
    const previewModal = byId('bookCoverPreview');
    const previewButton = byId('twoBtnPreviewBookCover');

    if (!urlInput || !previewImg || !previewModal || !previewButton) return;

    const placeholderSrc = previewImg.getAttribute('src');

    function normalizeCoverUrl(rawValue) {
        if (!rawValue) return '';
        const trimmed = rawValue.trim();
        if (!trimmed) return '';
        try {
            const parsed = new URL(trimmed);
            if (parsed.hostname === 'www.reddit.com' && parsed.pathname === '/media') {
                const target = parsed.searchParams.get('url');
                if (target) {
                    return decodeURIComponent(target);
                }
            }
        } catch (error) {
            // fall through
        }
        return addBook.utils.normalizeUrl(trimmed) || trimmed;
    }

    function updatePreview() {
        const rawValue = urlInput.value.trim();
        const value = normalizeCoverUrl(rawValue);
        log('Preview requested.', { rawValue, normalized: value });
        if (!value || !isValidUrl(value)) {
            previewImg.src = placeholderSrc;
            log('Preview fallback: invalid or empty URL.');
            return;
        }
        previewImg.src = value;
    }

    function updatePreviewButton() {
        const rawValue = urlInput.value.trim();
        const value = normalizeCoverUrl(rawValue);
        const isEnabled = Boolean(value) && isValidUrl(value);
        previewButton.disabled = !isEnabled;
        log('Preview button state.', { rawValue, normalized: value, enabled: isEnabled });
    }

    previewImg.addEventListener('error', () => {
        previewImg.src = placeholderSrc;
        log('Preview image failed to load. Reverting to placeholder.');
    });
    previewImg.addEventListener('load', () => {
        log('Preview image loaded successfully.', previewImg.src);
    });

    previewModal.addEventListener('shown.bs.modal', updatePreview);
    urlInput.addEventListener('input', updatePreviewButton);
    updatePreviewButton();
})();
