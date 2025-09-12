let translations = {};

async function loadLang(lang) {
  const res = await fetch(`lang/${lang}.json`);
  translations = await res.json();
  applyTranslations();
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const keys = el.getAttribute("data-i18n").split(".");
    let text = translations;
    keys.forEach(k => text = text[k]);
    if (text) el.textContent = text;
  });
}

// Initial load
const langSwitcher = document.getElementById("langSwitcher");
loadLang(langSwitcher.value);
langSwitcher.addEventListener("change", e => loadLang(e.target.value));
