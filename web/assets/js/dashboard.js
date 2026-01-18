// Dashboard page logic: personalize greeting and quick links.
(function () {
  const log = (...args) => console.log('[Dashboard]', ...args);
  const warn = (...args) => console.warn('[Dashboard]', ...args);

  const dom = {
    greeting: document.getElementById('dashboardGreeting')
  };

  const resolveUserName = () => {
    const raw = localStorage.getItem('userProfile');
    if (!raw) return null;
    try {
      const profile = JSON.parse(raw);
      return profile.preferredName || profile.fullName || null;
    } catch (error) {
      warn('Failed to parse user profile from storage.', error);
      return null;
    }
  };

  const renderGreeting = () => {
    const name = resolveUserName();
    if (!dom.greeting) return;
    dom.greeting.textContent = name ? `Welcome ${name}!` : 'Welcome!';
  };

  const init = () => {
    log('Initializing dashboard.');
    renderGreeting();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
