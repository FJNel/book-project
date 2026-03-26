// Dashboard page logic: personalize greeting and quick links.
(function () {
  const log = (...args) => console.log('[Dashboard]', ...args);
  const warn = (...args) => console.warn('[Dashboard]', ...args);

  const dom = {
    greeting: document.getElementById('dashboardGreeting'),
    deweyCard: document.getElementById('dashboardDeweyCard')
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

  const renderFeatureCards = () => {
    try {
      const raw = localStorage.getItem('userProfile');
      const profile = raw ? JSON.parse(raw) : null;
      const deweyEnabled = Boolean(profile?.features?.dewey?.enabled);
      dom.deweyCard?.classList.toggle('d-none', !deweyEnabled);
    } catch (error) {
      warn('Failed to read feature state for dashboard cards.', error);
      dom.deweyCard?.classList.add('d-none');
    }
  };

  const init = () => {
    log('Initializing dashboard.');
    renderGreeting();
    renderFeatureCards();
  };

  document.addEventListener('DOMContentLoaded', init);
})();
