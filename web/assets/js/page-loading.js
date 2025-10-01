//Show loading modal while the page is loading using BS5 JS
console.log("[Initialization] Starting page-loading.js script...");
document.addEventListener('DOMContentLoaded', function() {
	const pageLoadingModalElement = document.getElementById('pageLoadingModal');
	if (pageLoadingModalElement) {
		console.log ("[Initialization] Page loading modal element found.");
		//Create and show the modal immediately
		const pageLoadingModal = new bootstrap.Modal(pageLoadingModalElement);
		pageLoadingModal.show();
		console.log("[Initialization] Page loading modal shown.");
		//Expose the modal instance globally for later hiding
		window.pageLoadingModal = pageLoadingModal;
	} else {
		console.warn("[Initialization] Page loading modal element NOT found.");
	}
	console.log("[Initialization] DOM fully loaded and parsed... Loading other scripts.");
});

console.log("[Initialization] All scripts loaded.");
//Once everything is loaded, hide the loading modal
window.addEventListener('load', function() {
	console.log("[Initialization] Window load event fired.");
	if (window.pageLoadingModal) {
		console.log("[Initialization] Hiding page loading modal...");
		window.pageLoadingModal.hide();
		console.log("[Initialization] Page loading modal hidden.");
	} else {
		console.warn("[Initialization] Page loading modal instance not found.");
	}
});
console.log("[Initialization] Initialization script complete. Application ready.");