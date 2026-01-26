(function () {
  const log = (...args) => console.log('[Navbar]', ...args);

  const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', href: 'dashboard' },
    { key: 'books', label: 'Books', href: 'books' },
    { key: 'book-types', label: 'Book types', href: 'book-types' },
    { key: 'publishers', label: 'Publishers', href: 'publishers' },
    { key: 'authors', label: 'Authors', href: 'authors' },
    { key: 'series', label: 'Series', href: 'series' },
    { key: 'storage-locations', label: 'Storage Locations', href: 'storage-locations' },
    { key: 'statistics', label: 'Statistics', href: 'statistics' }
  ];

  const ADMIN_ITEM = { key: 'admin', label: 'Admin', href: 'admin' };

  function parseProfile() {
    try {
      const raw = localStorage.getItem('userProfile');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function normalizePath(value) {
    if (!value) return '';
    const trimmed = value.split('?')[0].split('#')[0];
    const last = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    const parts = last.split('/');
    const segment = parts[parts.length - 1] || '';
    return segment.replace(/\.html$/i, '') || '';
  }

  function resolveActiveKey() {
    const segment = normalizePath(window.location.pathname);
    if (!segment || segment === 'index') return 'dashboard';
    if (segment.startsWith('admin')) return 'admin';
    if (segment.startsWith('book-type') || segment === 'book-types') return 'book-types';
    if (segment.startsWith('book') || segment === 'books' || segment === 'add-book') return 'books';
    if (segment.startsWith('author') || segment === 'authors') return 'authors';
    if (segment.startsWith('publisher') || segment === 'publishers') return 'publishers';
    if (segment.startsWith('series')) return 'series';
    if (segment.startsWith('storage')) return 'storage-locations';
    if (segment.startsWith('statistics')) return 'statistics';
    if (segment.startsWith('account')) return 'account';
    return segment;
  }

  function buildNavItems(activeKey, includeAdmin) {
    const items = includeAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;
    return items.map((item) => {
      const isActive = item.key === activeKey;
      const activeClass = isActive ? ' active' : '';
      const aria = isActive ? ' aria-current="page"' : '';
      return `<li class="nav-item"><a class="nav-link${activeClass}"${aria} href="${item.href}">${item.label}</a></li>`;
    }).join('');
  }

  function injectNavbar() {
    const container = document.getElementById('navbarContainer');
    if (!container) return;
    const profile = parseProfile();
    const includeAdmin = profile?.role === 'admin';
    const activeKey = resolveActiveKey();
    const navHtml = `
      <nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom sticky-top">
        <div class="container">
          <a class="navbar-brand fw-semibold" href="dashboard">The Book Project</a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="mainNav">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
              ${buildNavItems(activeKey, includeAdmin)}
            </ul>
            <div class="d-flex gap-2">
              <a class="btn btn-outline-secondary btn-sm" href="/account">Account</a>
              <button class="btn btn-outline-danger btn-sm js-logout-btn" type="button">Log out</button>
            </div>
          </div>
        </div>
      </nav>
    `;
    container.innerHTML = navHtml.trim();
    if (typeof window.attachLogoutHandlers === 'function') {
      window.attachLogoutHandlers();
    }
  }

  function init() {
    injectNavbar();
  }

  window.initNavbar = init;
  document.addEventListener('DOMContentLoaded', init);
})();
