(function () {
  const log = (...args) => console.log('[Dewey]', ...args);
  const warn = (...args) => console.warn('[Dewey]', ...args);

  const DEWEY_CODE_PATTERN = /^\d{1,3}(\.\d+)?$/;
  const DATASET_STORAGE_KEY = 'bookProject.deweyDatasetCache.v1';
  const DATASET_CACHE_TTL_MS = 15 * 60 * 1000;
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

  function isFeatureActive(featureState = featureStateCache) {
    return Boolean(featureState?.available && featureState?.enabled);
  }

  function buildInactiveDatasetState(featureState, source) {
    return {
      enabled: Boolean(featureState?.enabled),
      available: Boolean(featureState?.available),
      source,
      version: null,
      entries: []
    };
  }

  function getStoredProfile() {
    try {
      const raw = localStorage.getItem('userProfile');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      warn('Unable to read stored user profile.', error);
      return null;
    }
  }

  function getCurrentUserId() {
    return getStoredProfile()?.id || null;
  }

  function readStoredDatasetCache() {
    try {
      const raw = localStorage.getItem(DATASET_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      warn('Unable to read stored Dewey dataset cache.', error);
      return null;
    }
  }

  function clearStoredDatasetCache() {
    try {
      localStorage.removeItem(DATASET_STORAGE_KEY);
    } catch (error) {
      warn('Unable to clear stored Dewey dataset cache.', error);
    }
  }

  function writeStoredDatasetCache(dataset) {
    try {
      const userId = getCurrentUserId();
      if (!userId || !dataset || !Array.isArray(dataset.entries)) return;
      localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify({
        userId,
        source: dataset.source || 'default',
        version: dataset.version || null,
        entries: dataset.entries,
        expiresAt: Date.now() + DATASET_CACHE_TTL_MS
      }));
    } catch (error) {
      warn('Unable to store Dewey dataset cache.', error);
    }
  }

  function readUsableStoredDataset(featureState) {
    if (!isFeatureActive(featureState)) return null;

    const cached = readStoredDatasetCache();
    const userId = getCurrentUserId();
    if (!cached || !userId) return null;
    if (cached.userId !== userId) return null;
    if (!Array.isArray(cached.entries)) return null;
    if (!cached.expiresAt || cached.expiresAt <= Date.now()) {
      clearStoredDatasetCache();
      return null;
    }

    return {
      enabled: true,
      available: true,
      source: cached.source || 'default',
      version: cached.version || null,
      entries: cached.entries
    };
  }

  function clearDatasetCache(reason) {
    if (datasetCache || datasetPromise) {
      log('Clearing Dewey dataset cache.', { reason });
    }
    datasetCache = null;
    datasetPromise = null;
    clearStoredDatasetCache();
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
    const nextFeatureState = normalizeFeatureState(featureState);
    const wasActive = isFeatureActive(featureStateCache);
    const willBeActive = isFeatureActive(nextFeatureState);

    if (!willBeActive) {
      clearDatasetCache(nextFeatureState.available ? 'feature-disabled' : 'feature-unavailable');
    } else if (!wasActive) {
      clearDatasetCache('feature-enabled');
    }

    featureStateCache = nextFeatureState;
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
    const featureState = await loadFeatureState();
    if (!featureState.available) {
      log('Skipping Dewey dataset fetch because the feature is unavailable for this deployment.');
      datasetCache = buildInactiveDatasetState(featureState, 'globally-unavailable');
      return datasetCache;
    }
    if (!featureState.enabled) {
      log('Skipping Dewey dataset fetch because the feature is disabled for this user.');
      datasetCache = buildInactiveDatasetState(featureState, 'user-disabled');
      return datasetCache;
    }

    if (datasetCache && datasetCache.enabled && datasetCache.available && isFeatureActive(featureState)) {
      return datasetCache;
    }
    const storedDataset = readUsableStoredDataset(featureState);
    if (storedDataset) {
      datasetCache = storedDataset;
      log('Using stored Dewey dataset cache.', {
        source: storedDataset.source,
        version: storedDataset.version,
        entryCount: storedDataset.entries.length
      });
      return datasetCache;
    }
    if (datasetPromise) return datasetPromise;

    datasetPromise = (async () => {
      try {
        const response = await apiFetch('/me/dewey-dataset', { method: 'GET' });
        if (response.status === 403) {
          warn('Dewey dataset request was rejected for this account.');
          datasetCache = buildInactiveDatasetState(featureState, 'inactive');
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
          version: payload?.data?.version || null,
          entries
        };
        writeStoredDatasetCache(datasetCache);
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
    isFeatureActive: () => isFeatureActive(featureStateCache),
    clearDatasetCache,
    loadDataset,
    getCachedDataset: () => datasetCache
  };
})();
