// Handles the book cover preview modal.
(function () {
    const addBook = window.addBook;
    if (!addBook || !addBook.utils) return;

    const { byId, isValidUrl } = addBook.utils;

    const urlInput = byId('twoEdtBookCoverURL');
    const previewImg = byId('bookCoverPreviewImage');
    const previewModal = byId('bookCoverPreview');

    if (!urlInput || !previewImg || !previewModal) return;

    const placeholderSrc = previewImg.getAttribute('src');

    function updatePreview() {
        const value = urlInput.value.trim();
        if (!value || !isValidUrl(value)) {
            previewImg.src = placeholderSrc;
            return;
        }
        previewImg.src = value;
    }

    previewImg.addEventListener('error', () => {
        previewImg.src = placeholderSrc;
    });

    previewModal.addEventListener('shown.bs.modal', updatePreview);
})();
