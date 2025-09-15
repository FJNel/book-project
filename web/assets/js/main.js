
document.addEventListener('DOMContentLoaded', async () => {
    
	
	// Desktop mode check
    const isDesktop = window.innerWidth >= 1280;
    console.log(`[Viewport] Width: ${window.innerWidth}, isDesktop: ${isDesktop}`);
    if (!isDesktop) {
        console.log("[Viewport] Not desktop mode, showing desktopErrorModal.");
        const desktopModal = new bootstrap.Modal(document.getElementById('desktopErrorModal'));
        desktopModal.show();
    } else {
        console.log("[Viewport] Desktop mode detected.");
    }

    // API status check
    try {
        const res = await fetch('https://api.fjnel.co.za/');
        const json = await res.json();
        console.log("[API] Response:", json);
        if (!json || json.status !== "success" || json.message !== "API_IS_WORKING") {
            throw new Error("API status not OK");
        }
        console.log("[API] API is working correctly.");
    } catch (err) {
        console.error("[API] API check failed:", err);
        const apiModal = new bootstrap.Modal(document.getElementById('apiErrorModal'));
        apiModal.show();
    }
});