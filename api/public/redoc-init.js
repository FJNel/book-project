(function initRedoc() {
  const target = document.getElementById("redoc-container");
  if (!target) {
    console.error("Redoc container not found");
    return;
  }

  // Use local openapi.yaml served from the same origin.
  const specUrl = "./openapi.yaml";
  const options = {
    scrollYOffset: 0,
    hideDownloadButton: false,
    suppressWarnings: true
  };

  // Redoc global is provided by redoc.standalone.js
  function start() {
    if (window.Redoc && typeof window.Redoc.init === "function") {
      window.Redoc.init(specUrl, options, target);
    } else {
      console.error("Redoc is not available on window. Check script loading/CSP.");
    }
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }
})();
