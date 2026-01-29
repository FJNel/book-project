(function () {
  const log = (...args) => console.log('[Health]', ...args);
  const warn = (...args) => console.warn('[Health]', ...args);

  const dom = {
    badge: document.getElementById('healthBadge'),
    badgeText: document.getElementById('healthBadgeText'),
    apiStatus: document.getElementById('healthApiStatus'),
    dbLatency: document.getElementById('healthDbLatency'),
    schemaStatus: document.getElementById('healthSchemaStatus'),
    schemaDetails: document.getElementById('healthSchemaDetails'),
    dbSslMode: document.getElementById('healthDbSslMode'),
    updatedAt: document.getElementById('healthUpdatedAt'),
    alert: document.getElementById('healthAlert'),
    retryBtn: document.getElementById('healthRetryBtn')
  };

  let inFlight = false;

  const STATUS_MAP = {
    healthy: { text: 'Healthy', className: 'text-bg-success', icon: 'bi bi-cloud-check' },
    degraded: { text: 'Degraded', className: 'text-bg-warning', icon: 'bi bi-dash-circle' },
    unhealthy: { text: 'Unhealthy', className: 'text-bg-danger', icon: 'bi bi-cloud-slash' },
    unreachable: { text: 'Unreachable', className: 'text-bg-danger', icon: 'bi bi-cloud-slash' },
    unknown: { text: 'Unknown', className: 'text-bg-secondary', icon: 'bi bi-question-circle' },
    checking: { text: 'Checking…', className: 'text-bg-secondary', icon: 'bi bi-cloud-check' }
  };

  function setBadge(state) {
    if (!dom.badge || !dom.badgeText) return;
    const next = STATUS_MAP[state] || STATUS_MAP.unknown;
    dom.badge.className = `badge ${next.className}`;
    dom.badgeText.textContent = next.text;
    const icon = dom.badge.querySelector('i');
    if (icon) {
      icon.className = next.icon;
      icon.setAttribute('aria-hidden', 'true');
    }
  }

  function showAlert(message, type = 'warning') {
    if (!dom.alert) return;
    dom.alert.textContent = message;
    dom.alert.className = `alert alert-${type} mt-3`;
    dom.alert.classList.remove('d-none');
  }

  function hideAlert() {
    if (!dom.alert) return;
    dom.alert.classList.add('d-none');
    dom.alert.textContent = '';
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value;
  }

  function formatMissingColumns(missingColumns) {
    if (!Array.isArray(missingColumns)) return '';
    return missingColumns
      .filter((entry) => entry && entry.table && entry.column)
      .map((entry) => `${entry.table}.${entry.column}`)
      .join(', ');
  }

  function applyPayload(payload = {}, { state, message } = {}) {
    const db = payload?.db || {};
    const status = String(payload?.status || '').toLowerCase();
    const dbHealthy = db?.healthy === true;
    const schemaOk = db?.schemaOk === true;
    const missingColumns = Array.isArray(db?.missingColumns) ? db.missingColumns : [];
    const missingList = formatMissingColumns(missingColumns);

    setText(dom.apiStatus, state === 'healthy' ? 'Online' : state === 'checking' ? 'Checking…' : 'Unavailable');
    setText(dom.dbLatency, Number.isFinite(db?.latencyMs) ? `${db.latencyMs} ms` : 'Unavailable');
    if (schemaOk === true) {
      setText(dom.schemaStatus, 'Ready');
    } else if (schemaOk === false) {
      setText(dom.schemaStatus, 'Needs update');
    } else {
      setText(dom.schemaStatus, state === 'healthy' ? 'Unknown' : 'Unavailable');
    }
    if (dom.schemaDetails) {
      if (schemaOk === false && missingList) {
        dom.schemaDetails.textContent = `Missing: ${missingList}`;
        dom.schemaDetails.classList.remove('d-none');
      } else {
        dom.schemaDetails.textContent = '';
        dom.schemaDetails.classList.add('d-none');
      }
    }
    setText(dom.dbSslMode, db?.sslMode || 'Unavailable');

    if (dom.updatedAt) {
      dom.updatedAt.textContent = `Last checked ${new Date().toLocaleString()}`;
    }

    if (state === 'degraded') {
      if (missingList) {
        showAlert(`Database schema needs updates. Missing: ${missingList}`, 'warning');
      } else if (message) {
        showAlert(message, 'warning');
      }
    }

    if (state === 'unhealthy') {
      showAlert(message || 'Health check reported a failure.', 'danger');
    }

    if (state === 'unreachable') {
      showAlert(message || 'Unable to reach the API health endpoint.', 'danger');
    }

    if (state === 'unknown') {
      showAlert(message || 'Health status could not be determined.', 'warning');
    }

    if (status && status !== 'ok' && state === 'healthy') {
      showAlert('Health status returned an unexpected value.', 'warning');
    }

    if (dbHealthy === false && state === 'healthy') {
      showAlert('Database connectivity reported as unhealthy.', 'danger');
    }
  }

  function evaluateState(payload = {}, responseOk) {
    if (!responseOk) return 'unhealthy';
    const status = String(payload?.status || '').toLowerCase();
    const db = payload?.db || {};
    if (status && status !== 'ok') return 'unhealthy';
    if (db?.healthy === false) return 'unhealthy';
    if (db?.schemaOk === false) return 'degraded';
    if (db?.healthy === true && db?.schemaOk === true) return 'healthy';
    return 'unknown';
  }

  async function fetchHealth() {
    if (inFlight) return;
    inFlight = true;
    hideAlert();
    setBadge('checking');
    setText(dom.apiStatus, 'Checking…');
    setText(dom.dbLatency, '—');
    setText(dom.schemaStatus, '—');
    setText(dom.dbSslMode, '—');
    if (dom.schemaDetails) {
      dom.schemaDetails.textContent = '';
      dom.schemaDetails.classList.add('d-none');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await apiFetch('/health', { method: 'GET', signal: controller.signal });
      let body = null;
      try {
        body = await response.json();
      } catch (err) {
        warn('Health response was not JSON', err);
        setBadge('unreachable');
        applyPayload({}, { state: 'unreachable', message: 'Health response was not JSON.' });
        return;
      }

      const payload = body?.data ?? null;
      if (!payload || typeof payload !== 'object') {
        setBadge('unknown');
        applyPayload({}, { state: 'unknown', message: 'Health payload did not match the expected schema.' });
        return;
      }

      const state = evaluateState(payload, response.ok);
      setBadge(state);
      applyPayload(payload, {
        state,
        message: body?.message || (Array.isArray(body?.errors) ? body.errors.join(' ') : '')
      });
    } catch (err) {
      warn('Health request failed', err);
      setBadge('unreachable');
      applyPayload({}, { state: 'unreachable', message: err?.message || 'Unable to reach the API health endpoint.' });
    } finally {
      clearTimeout(timeoutId);
      inFlight = false;
    }
  }

  async function initialize() {
    if (typeof showPageLoadingModal === 'function') {
      showPageLoadingModal();
    }
    try {
      await fetchHealth();
    } finally {
      if (typeof hidePageLoadingModal === 'function') {
        await hidePageLoadingModal();
      }
    }
  }

  dom.retryBtn?.addEventListener('click', () => fetchHealth());
  document.addEventListener('DOMContentLoaded', initialize);
})();
