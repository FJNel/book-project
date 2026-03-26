(function () {
  const log = (...args) => console.log('[Dewey]', ...args);
  const warn = (...args) => console.warn('[Dewey]', ...args);

  const DEWEY_CODE_PATTERN = /^\d{1,3}(\.\d+)?$/;
  let datasetPromise = null;
  let datasetCache = null;
  let featureStatePromise = null;
  let featureStateCache = null;

  function normalizeCode(value) {
    if (value === undefined || value === null || value === '') return null;
    const normalized = String(value)
      .trim()
      .replace(/,/g, '.')
      .replace(/\.+/g, '.');
    return normalized || null;
  }

  function isValidCode(value) {
    return Boolean(value) && DEWEY_CODE_PATTERN.test(value);
  }

  function buildLookup(entries) {
    const lookup = new Map();
    (entries || []).forEach((entry) => {
      if (!entry || !entry.code) return;
      lookup.set(entry.code, entry);
    });
    return lookup;
  }

  function buildCandidateCodes(code) {
    const normalized = normalizeCode(code);
    if (!normalized || !isValidCode(normalized)) return [];

    const candidates = [];
    const seen = new Set();
    const push = (value) => {
      if (!value || seen.has(value)) return;
      seen.add(value);
      candidates.push(value);
    };

    push(normalized);

    if (normalized.includes('.')) {
      let current = normalized;
      while (current.includes('.')) {
        const dotIndex = current.indexOf('.');
        const decimalPart = current.slice(dotIndex + 1);
        if (decimalPart.length > 1) {
          current = current.slice(0, -1);
          push(current);
          continue;
        }
        current = current.slice(0, dotIndex);
        push(current);
      }
    }

    const integerPart = normalized.split('.')[0];
    if (integerPart.length === 3) {
      for (let length = 2; length >= 1; length -= 1) {
        push(integerPart.slice(0, length).padEnd(3, '0'));
      }
    }

    return candidates;
  }

  function buildPathCodes(code) {
    const normalized = normalizeCode(code);
    if (!normalized || !isValidCode(normalized)) return [];

    const integerPart = normalized.split('.')[0].padStart(3, '0');
    const codes = [];
    const seen = new Set();
    const push = (value) => {
      if (!value || seen.has(value)) return;
      seen.add(value);
      codes.push(value);
    };

    push(integerPart[0] + '00');
    push(integerPart.slice(0, 2) + '0');
    push(integerPart);

    if (normalized.includes('.')) {
      const decimals = normalized.split('.')[1];
      for (let index = 1; index <= decimals.length; index += 1) {
        push(`${integerPart}.${decimals.slice(0, index)}`);
      }
    }

    return codes;
  }

  function resolveCode(code, entries) {
    const normalized = normalizeCode(code);
    if (!normalized) {
      return { code: null, normalized: null, valid: false, resolved: false, caption: null, matchedCode: null, path: [] };
    }

    if (!isValidCode(normalized)) {
      return { code, normalized, valid: false, resolved: false, caption: null, matchedCode: null, path: [] };
    }

    const lookup = buildLookup(entries);
    const match = buildCandidateCodes(normalized)
      .map((candidate) => lookup.get(candidate))
      .find(Boolean) || null;
    const path = buildPathCodes(match?.code || normalized)
      .map((pathCode) => lookup.get(pathCode))
      .filter(Boolean)
      .map((entry) => entry.caption);

    return {
      code,
      normalized,
      valid: true,
      resolved: Boolean(match),
      caption: match ? match.caption : null,
      matchedCode: match ? match.code : null,
      path
    };
  }

  function normalizeFeatureState(featureState) {
    const available = Boolean(featureState?.available);
    return {
      available,
      enabled: available && Boolean(featureState?.enabled)
    };
  }

  function readStoredFeatureState() {
    try {
      const raw = localStorage.getItem('userProfile');
      if (!raw) return null;
      const profile = JSON.parse(raw);
      if (!profile?.features?.dewey) return null;
      return normalizeFeatureState(profile.features.dewey);
    } catch (error) {
      warn('Unable to read stored Dewey feature state.', error);
      return null;
    }
  }

  function syncStoredFeatureState(featureState) {
    try {
      const raw = localStorage.getItem('userProfile');
      if (!raw) return;
      const profile = JSON.parse(raw);
      profile.features = profile.features && typeof profile.features === 'object' ? profile.features : {};
      profile.features.dewey = normalizeFeatureState(featureState);
      localStorage.setItem('userProfile', JSON.stringify(profile));
    } catch (error) {
      warn('Unable to persist Dewey feature state.', error);
    }
  }

  function setFeatureState(featureState) {
    featureStateCache = normalizeFeatureState(featureState);
    syncStoredFeatureState(featureStateCache);
    return featureStateCache;
  }

  async function loadFeatureState() {
    if (featureStateCache) return featureStateCache;

    const stored = readStoredFeatureState();
    if (stored) {
      featureStateCache = stored;
      return featureStateCache;
    }

    if (featureStatePromise) return featureStatePromise;

    featureStatePromise = (async () => {
      try {
        const response = await apiFetch('/users/me', { method: 'GET' });
        if (!response.ok) {
          warn('Unable to load Dewey feature state from profile.', { status: response.status });
          featureStateCache = { available: false, enabled: false };
          return featureStateCache;
        }

        const payload = await response.json().catch(() => ({}));
        featureStateCache = normalizeFeatureState(payload?.data?.features?.dewey);
        syncStoredFeatureState(featureStateCache);
        log('Dewey feature state loaded.', featureStateCache);
        return featureStateCache;
      } catch (error) {
        warn('Unable to load Dewey feature state.', error);
        featureStateCache = { available: false, enabled: false };
        return featureStateCache;
      } finally {
        featureStatePromise = null;
      }
    })();

    return featureStatePromise;
  }

  async function loadDataset() {
    if (datasetCache) return datasetCache;
    if (datasetPromise) return datasetPromise;

    datasetPromise = (async () => {
      try {
        const featureState = await loadFeatureState();
        if (!featureState.available) {
          log('Dewey feature is unavailable for this deployment.');
          datasetCache = { enabled: false, available: false, source: 'globally-unavailable', entries: [] };
          return datasetCache;
        }
        if (!featureState.enabled) {
          log('Dewey feature is disabled for this user.');
          datasetCache = { enabled: false, available: true, source: 'user-disabled', entries: [] };
          return datasetCache;
        }

        const response = await apiFetch('/me/dewey-dataset', { method: 'GET' });
        if (response.status === 403) {
          warn('Dewey dataset request was rejected for this account.');
          datasetCache = { enabled: false, available: featureState.available, source: 'inactive', entries: [] };
          return datasetCache;
        }
        if (!response.ok) {
          warn('Dewey dataset request failed.', { status: response.status });
          datasetCache = { enabled: true, available: false, source: 'unavailable', entries: [] };
          return datasetCache;
        }
        const payload = await response.json().catch(() => ({}));
        const entries = Array.isArray(payload?.data?.entries) ? payload.data.entries : [];
        datasetCache = {
          enabled: true,
          available: true,
          source: payload?.data?.source || 'default',
          entries
        };
        log('Dewey dataset loaded.', { source: datasetCache.source, entryCount: entries.length });
        return datasetCache;
      } catch (error) {
        warn('Dewey dataset request failed with exception.', error);
        datasetCache = { enabled: true, available: false, source: 'unavailable', entries: [] };
        return datasetCache;
      } finally {
        datasetPromise = null;
      }
    })();

    return datasetPromise;
  }

  window.deweyClient = {
    DEWEY_CODE_PATTERN,
    normalizeCode,
    isValidCode,
    resolveCode,
    loadFeatureState,
    setFeatureState,
    getFeatureState: () => featureStateCache,
    isFeatureEnabled: () => Boolean(featureStateCache?.enabled),
    loadDataset,
    getCachedDataset: () => datasetCache
  };
})();
