console.log("[Page Loading] Starting page-loading.js script...");

document.addEventListener('DOMContentLoaded', function() {
	const pageLoadingModalElement = document.getElementById('pageLoadingModal');
	if (pageLoadingModalElement) {
		// Create and expose the modal instance globally
		window.pageLoadingModal = new bootstrap.Modal(pageLoadingModalElement);
		window.pageLoadingModal.show();
		console.log("[Page Loading] Page loading modal shown.");
	} else {
		console.warn("[Page Loading] Page loading modal element NOT found.");
	}
});

console.log("[Page Loading] Page Loading Modal script complete. Awaiting app initialization.");