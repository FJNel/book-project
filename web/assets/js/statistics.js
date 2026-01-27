// Statistics page logic: lazy-load sections, render charts, and handle timeline builder.
(function () {
  const log = (...args) => console.log('[Statistics]', ...args);
  const warn = (...args) => console.warn('[Statistics]', ...args);
  const errorLog = (...args) => console.error('[Statistics]', ...args);

  if (window.pageContentReady && typeof window.pageContentReady.reset === 'function') {
    window.pageContentReady.reset();
  }

  const dom = {
    feedbackContainer: document.getElementById('feedbackContainer'),
    refreshBtn: document.getElementById('refreshStatsBtn'),
    refreshSpinner: document.getElementById('refreshSpinner'),
    navButtons: Array.from(document.querySelectorAll('[data-section]')),
    sections: Array.from(document.querySelectorAll('[data-section-content]')),
    overview: {
      loading: document.getElementById('overviewLoading'),
      content: document.getElementById('overviewContent'),
      empty: document.getElementById('overviewEmpty'),
      totals: document.getElementById('overviewTotals'),
      highlights: document.getElementById('overviewHighlights')
    },
    books: {
      loading: document.getElementById('booksLoading'),
      content: document.getElementById('booksContent'),
      empty: document.getElementById('booksEmpty'),
      publicationChart: document.getElementById('booksPublicationChart'),
      publicationEmpty: document.getElementById('booksPublicationEmpty'),
      publicationHint: document.getElementById('booksPublicationEmptyHint'),
      typeChart: document.getElementById('booksTypeChart'),
      typeEmpty: document.getElementById('booksTypeEmpty'),
      typeHint: document.getElementById('booksTypeEmptyHint'),
      languageChart: document.getElementById('booksLanguageChart'),
      languageEmpty: document.getElementById('booksLanguageEmpty'),
      languageHint: document.getElementById('booksLanguageEmptyHint'),
      tagChart: document.getElementById('booksTagChart'),
      tagEmpty: document.getElementById('booksTagEmpty'),
      tagHint: document.getElementById('booksTagEmptyHint'),
      qualityGrid: document.getElementById('booksQualityGrid'),
      highlights: document.getElementById('booksHighlightsList'),
      correlationList: document.getElementById('booksCorrelationList')
    },
    authors: {
      loading: document.getElementById('authorsLoading'),
      content: document.getElementById('authorsContent'),
      empty: document.getElementById('authorsEmpty'),
      aliveChart: document.getElementById('authorsAliveChart'),
      aliveEmpty: document.getElementById('authorsAliveEmpty'),
      aliveHint: document.getElementById('authorsDeathEmptyHint'),
      decadeChart: document.getElementById('authorsDecadeChart'),
      decadeEmpty: document.getElementById('authorsDecadeEmpty'),
      decadeHint: document.getElementById('authorsBirthEmptyHint'),
      topTable: document.getElementById('authorsTopTable'),
      highlights: document.getElementById('authorsHighlights'),
      rolesChart: document.getElementById('authorRolesChart'),
      rolesEmpty: document.getElementById('authorRolesEmpty'),
      collabTable: document.getElementById('authorsCollabTable')
    },
    publishers: {
      loading: document.getElementById('publishersLoading'),
      content: document.getElementById('publishersContent'),
      empty: document.getElementById('publishersEmpty'),
      topChart: document.getElementById('publishersTopChart'),
      topEmpty: document.getElementById('publishersTopEmpty'),
      highlights: document.getElementById('publishersHighlights'),
      breakdownTable: document.getElementById('publishersBreakdownTable')
    },
    series: {
      loading: document.getElementById('seriesLoading'),
      content: document.getElementById('seriesContent'),
      empty: document.getElementById('seriesEmpty'),
      vsChart: document.getElementById('seriesVsStandaloneChart'),
      vsEmpty: document.getElementById('seriesVsStandaloneEmpty'),
      topChart: document.getElementById('seriesTopChart'),
      topEmpty: document.getElementById('seriesTopEmpty'),
      healthList: document.getElementById('seriesHealthList'),
      breakdownTable: document.getElementById('seriesBreakdownTable')
    },
    storage: {
      loading: document.getElementById('storageLoading'),
      content: document.getElementById('storageContent'),
      empty: document.getElementById('storageEmpty'),
      locationChart: document.getElementById('storageLocationChart'),
      locationEmpty: document.getElementById('storageLocationEmpty'),
      highlights: document.getElementById('storageHighlights'),
      breakdownTable: document.getElementById('storageBreakdownTable')
    },
    timeline: {
      loading: document.getElementById('timelineLoading'),
      content: document.getElementById('timelineContent'),
      empty: document.getElementById('timelineEmpty'),
      recordType: document.getElementById('timelineRecordType'),
      field: document.getElementById('timelineField'),
      mode: document.getElementById('timelineMode'),
      bucketsWrap: document.getElementById('timelineBucketsWrap'),
      buckets: document.getElementById('timelineBuckets'),
      manualRow: document.getElementById('timelineManualRow'),
      start: document.getElementById('timelineStart'),
      end: document.getElementById('timelineEnd'),
      step: document.getElementById('timelineStep'),
      stepUnit: document.getElementById('timelineStepUnit'),
      hideEmpty: document.getElementById('timelineHideEmpty'),
      runBtn: document.getElementById('timelineRunBtn'),
      runSpinner: document.getElementById('timelineRunSpinner'),
      error: document.getElementById('timelineError'),
      chart: document.getElementById('timelineChart'),
      chartEmpty: document.getElementById('timelineChartEmpty'),
      chartEmptyTitle: document.getElementById('timelineChartEmptyTitle'),
      chartEmptyText: document.getElementById('timelineChartEmptyText'),
      summary: document.getElementById('timelineSummary'),
      retryBtn: document.getElementById('timelineRetryBtn'),
      recordTypeError: document.getElementById('timelineRecordTypeError'),
      fieldError: document.getElementById('timelineFieldError'),
      bucketsError: document.getElementById('timelineBucketsError'),
      startError: document.getElementById('timelineStartError'),
      endError: document.getElementById('timelineEndError'),
      stepError: document.getElementById('timelineStepError'),
      stepUnitError: document.getElementById('timelineStepUnitError')
    }
  };

  const state = {
    activeSection: 'overview',
    sectionLoaded: new Set(),
    charts: new Map(),
    statsCache: new Map(),
    timelineRequestId: 0
  };

  const validSections = new Set(['overview', 'books', 'authors', 'publishers', 'series', 'storage', 'timeline']);

  const chartPalette = (() => {
    const style = getComputedStyle(document.documentElement);
    const colors = [
      style.getPropertyValue('--bs-primary').trim(),
      style.getPropertyValue('--bs-success').trim(),
      style.getPropertyValue('--bs-info').trim(),
      style.getPropertyValue('--bs-warning').trim(),
      style.getPropertyValue('--bs-danger').trim(),
      style.getPropertyValue('--bs-secondary').trim(),
      style.getPropertyValue('--bs-teal')?.trim(),
      style.getPropertyValue('--bs-indigo')?.trim()
    ].filter(Boolean);
    return colors.length ? colors : ['#0d6efd', '#198754', '#0dcaf0', '#ffc107', '#dc3545', '#6c757d'];
  })();

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const formatNumber = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0';
    return number.toLocaleString();
  };

  const formatMaybe = (value, fallback = '-') => {
    if (value === undefined || value === null || value === '') return fallback;
    return value;
  };

  const tooltipText = new Map([
    ['Books', 'Total number of books in your library.'],
    ['Book Copies', 'Total number of book copies tracked in your library.'],
    ['Authors', 'Total number of authors in your library.'],
    ['Series', 'Total number of series in your library.'],
    ['Publishers', 'Total number of publishers in your library.'],
    ['Storage locations', 'Total number of storage locations in your library.'],
    ['Most represented author', 'The author linked to the most books in your library.'],
    ['Most collected series', 'The series with the most books in your library.'],
    ['Most used location', 'The storage location with the most book copies.'],
    ['Most collected book type', 'The book type with the most books in your library.'],
    ['Most common publisher', 'The publisher linked to the most books in your library.'],
    ['Missing cover', 'Books without a cover image.'],
    ['Missing published date', 'Books without a published date.'],
    ['Missing pages', 'Books without a page count.'],
    ['Missing type', 'Books without a book type.'],
    ['Missing language', 'Books without languages assigned.'],
    ['Missing publisher', 'Books without a publisher.'],
    ['Oldest publication year', 'The earliest published year in your library.'],
    ['Newest publication year', 'The most recent published year in your library.'],
    ['Longest book', 'The book with the most pages in your library.'],
    ['Shortest book', 'The book with the fewest pages in your library.'],
    ['Untagged books', 'Books that do not have any tags assigned.'],
    ['Most used tag', 'The tag applied to the most books in your library.'],
    ['Most tagged book', 'The single book with the most tags assigned.'],
    ['Publisher and pages', 'Compares page counts between books with and without publishers. This is an association only and does not imply causation.'],
    ['Tags and pages', 'Compares page counts between tagged and untagged books. This is an association only and does not imply causation.'],
    ['With death date', 'Authors with a recorded death date.'],
    ['Authors by birth decade', 'Count of authors grouped by birth decade.'],
    ['Top authors', 'Authors with the most books linked to them.'],
    ['Contributor roles', 'Breakdown of author roles across book contributions.'],
    ['Collaboration pairs', 'Pairs of authors who appear together on books.'],
    ['Oldest author', 'Author with the earliest birth year on record.'],
    ['Youngest author', 'Author with the most recent birth year on record.'],
    ['Oldest founded publisher', 'Publisher with the earliest founded year.'],
    ['Total publishers', 'Total number of publishers in your library.'],
    ['Books in series', 'Books that belong to a series.'],
    ['Standalones', 'Books that are not part of any series.'],
    ['Missing order numbers', 'Series entries missing a book order number.'],
    ['Gaps in series order', 'Gaps detected in series ordering.'],
    ['Series without books', 'Series that currently have no books linked.'],
    ['Series with gaps', 'Series that contain gaps in ordering.'],
    ['Duplicate order numbers', 'Series with duplicate order positions.'],
    ['Null order entries', 'Series entries without an order number.'],
    ['Locations by copy count', 'Copy counts per storage location.'],
    ['Direct copies', 'Copies stored directly in this location.'],
    ['Nested copies', 'Copies stored in child locations.'],
    ['In range', 'Items that fall within the selected timeline range.'],
    ['Before start', 'Items dated before the selected start date.'],
    ['After end', 'Items dated after the selected end date.'],
    ['Unknown', 'Items missing a date for the selected field.']
  ]);

  const renderTooltipLabel = (label, extraClass = '') => {
    const tooltip = tooltipText.get(label);
    if (!tooltip) return `<span class="${extraClass}">${escapeHtml(label)}</span>`;
    const classAttr = extraClass ? ` class="${extraClass}"` : '';
    return `<span${classAttr} data-bs-toggle="tooltip" data-bs-title="${escapeHtml(tooltip)}">${escapeHtml(label)}</span>`;
  };

  const initTooltips = (scope = document) => {
    if (!window.bootstrap || !bootstrap.Tooltip) return;
    scope.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      bootstrap.Tooltip.getOrCreateInstance(el);
    });
  };

  const setFeedback = (message, variant = 'danger') => {
    if (!dom.feedbackContainer) return;
    if (!message) {
      dom.feedbackContainer.innerHTML = '';
      return;
    }
    dom.feedbackContainer.innerHTML = `
      <div class="alert alert-${variant} d-flex align-items-center" role="alert">
        <div>${escapeHtml(message)}</div>
      </div>
    `;
  };

  const showModal = async (target, options) => {
    if (window.modalManager && typeof window.modalManager.showModal === 'function') {
      await window.modalManager.showModal(target, options);
      return;
    }
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    bootstrap.Modal.getOrCreateInstance(element, options || {}).show();
  };

  const hideModal = async (target) => {
    if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
      await window.modalManager.hideModal(target);
      return;
    }
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    const instance = bootstrap.Modal.getInstance(element);
    if (instance) instance.hide();
  };

  const handleRateLimit = async (response) => {
    if (response && response.status === 429 && window.rateLimitGuard) {
      window.rateLimitGuard.record(response);
      await window.rateLimitGuard.showModal();
      return true;
    }
    return false;
  };

  const setSectionState = (sectionKey, { loading, empty } = {}) => {
    const section = dom[sectionKey];
    if (!section) return;
    if (section.loading) section.loading.classList.toggle('d-none', !loading);
    if (section.content) section.content.classList.toggle('d-none', Boolean(loading || empty));
    if (section.empty) section.empty.classList.toggle('d-none', !empty);
  };

  const setActiveSection = (sectionKey) => {
    state.activeSection = sectionKey;
    dom.navButtons.forEach((button) => {
      const active = button.dataset.section === sectionKey;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    dom.sections.forEach((section) => {
      const active = section.dataset.sectionContent === sectionKey;
      section.classList.toggle('active', active);
    });
  };

  const getSectionFromHash = () => {
    const raw = window.location.hash.replace('#', '').trim();
    if (!raw) return null;
    return validSections.has(raw) ? raw : null;
  };

  const updateHash = (sectionKey, { push = false } = {}) => {
    if (!sectionKey || !validSections.has(sectionKey)) return;
    const hash = `#${sectionKey}`;
    if (window.location.hash === hash) return;
    if (push) {
      window.location.hash = sectionKey;
    } else {
      history.replaceState(null, '', hash);
    }
  };

  const destroyCharts = () => {
    state.charts.forEach((chart) => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    state.charts.clear();
  };

  const renderChart = (canvasEl, config, emptyEl) => {
    if (!canvasEl) return;
    if (emptyEl) emptyEl.classList.add('d-none');
    const existing = state.charts.get(canvasEl.id);
    if (existing) existing.destroy();
    if (!config) {
      if (emptyEl) emptyEl.classList.remove('d-none');
      canvasEl.classList.add('d-none');
      return;
    }
    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      if (emptyEl) emptyEl.classList.remove('d-none');
      canvasEl.classList.add('d-none');
      return;
    }
    canvasEl.classList.remove('d-none');
    const chart = new Chart(ctx, config);
    state.charts.set(canvasEl.id, chart);
  };

  const buildQueryPath = (path, params) => {
    if (!params || !Object.keys(params).length) return path;
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        if (!value.length) return;
        value.forEach((entry) => {
          if (entry === undefined || entry === null || entry === '') return;
          query.append(key, entry);
        });
        return;
      }
      query.set(key, String(value));
    });
    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  const fetchStats = async (path, params, label) => {
    const payload = params && Object.keys(params).length ? params : undefined;
    const resolvedPath = path;
    const cacheKey = `${path}:${payload ? JSON.stringify(payload) : ''}`;
    if (state.statsCache.has(cacheKey)) {
      log('Stats cache hit.', { label, path: resolvedPath });
      return state.statsCache.get(cacheKey);
    }
    log('Stats request starting.', { label, path: resolvedPath, params: payload || null });
    const response = await apiFetch(resolvedPath, {
      method: 'POST',
      body: payload ? JSON.stringify(payload) : undefined
    });
    if (await handleRateLimit(response)) {
      throw new Error('rate-limited');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      warn('Stats request failed.', { label, status: response.status, data });
      throw new Error(data.message || 'Stats request failed.');
    }
    const stats = data.data?.stats ?? data.data ?? {};
    state.statsCache.set(cacheKey, stats);
    log('Stats response received.', { label, status: response.status });
    return stats;
  };

  const fetchStatsSafe = async (path, body, label) => {
    try {
      return await fetchStats(path, body, label);
    } catch (error) {
      warn('Stats request failed safely.', { label, error });
      return null;
    }
  };

  const renderTotals = (container, items) => {
    if (!container) return;
    container.innerHTML = items.map((item) => `
      <div class="col-6 col-md-4 col-xl-2">
        <div class="card shadow-sm h-100">
          <div class="card-body">
            <div class="stat-label">${renderTooltipLabel(item.label)}</div>
            <div class="stat-value">${escapeHtml(formatNumber(item.value))}</div>
          </div>
        </div>
      </div>
    `).join('');
    initTooltips(container);
  };

  const renderHighlightCards = (container, items) => {
    if (!container) return;
    container.innerHTML = items.map((item) => {
      const metaLine = item.meta ? `<div class="text-muted small">${escapeHtml(item.meta)}</div>` : '';
      const valueLine = item.value ? `<div class="fw-semibold">${escapeHtml(item.value)}</div>` : '<div class="text-muted">Not enough data</div>';
      const href = item.href || '';
      const cardAttrs = href ? `data-href="${escapeHtml(href)}" role="button" tabindex="0"` : '';
      const cardClass = href ? 'card shadow-sm mini-card h-100 clickable-card' : 'card shadow-sm mini-card h-100';
      return `
        <div class="col-12 col-md-6 col-lg-3">
          <div class="${cardClass}" ${cardAttrs}>
            <div class="card-body">
              <div class="highlight-label text-muted mb-1">${renderTooltipLabel(item.label)}</div>
              ${valueLine}
              ${metaLine}
            </div>
          </div>
        </div>
      `;
    }).join('');
    initTooltips(container);
  };

  const renderListItems = (container, items) => {
    if (!container) return;
    if (!items.length) {
      container.innerHTML = '<li class="text-muted">No data available.</li>';
      return;
    }
    container.innerHTML = items.map((item) => {
      if (item.html) {
        return `<li class="mb-2">${item.html}</li>`;
      }
      const detail = item.detail ? ` <span class="text-muted">${escapeHtml(item.detail)}</span>` : '';
      return `<li class="mb-2"><span class="fw-semibold">${renderTooltipLabel(item.label)}</span>${detail}</li>`;
    }).join('');
    initTooltips(container);
  };

  const setHint = (el, text) => {
    if (!el) return;
    if (!text) {
      el.textContent = '';
      el.classList.add('d-none');
      return;
    }
    el.textContent = text;
    el.classList.remove('d-none');
  };

  const setFieldError = (inputEl, errorEl, message) => {
    if (!inputEl || !errorEl) return;
    if (!message) {
      inputEl.classList.remove('is-invalid');
      errorEl.textContent = '';
      return;
    }
    inputEl.classList.add('is-invalid');
    errorEl.textContent = message;
  };

  const clearFieldErrors = () => {
    setFieldError(dom.timeline.recordType, dom.timeline.recordTypeError, '');
    setFieldError(dom.timeline.field, dom.timeline.fieldError, '');
    setFieldError(dom.timeline.buckets, dom.timeline.bucketsError, '');
    setFieldError(dom.timeline.start, dom.timeline.startError, '');
    setFieldError(dom.timeline.end, dom.timeline.endError, '');
    setFieldError(dom.timeline.step, dom.timeline.stepError, '');
    setFieldError(dom.timeline.stepUnit, dom.timeline.stepUnitError, '');
  };

  const renderTableRows = (container, rows, colspan = 2) => {
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = `<tr><td class=\"text-muted\" colspan=\"${colspan}\">No data available.</td></tr>`;
      return;
    }
    container.innerHTML = rows.join('');
  };

  const renderOverviewSection = async () => {
    const [userStats, authorStats, seriesStats, storageStats, bookTypeStats, publisherStats] = await Promise.all([
      fetchStatsSafe('/users/me/stats', null, 'user-totals'),
      fetchStatsSafe('/author/stats', { fields: ['mostRepresentedAuthor'] }, 'author-highlight'),
      fetchStatsSafe('/bookseries/stats', { fields: ['largestSeries'] }, 'series-highlight'),
      fetchStatsSafe('/storagelocation/stats', { fields: ['largestLocation'] }, 'storage-highlight'),
      fetchStatsSafe('/booktype/stats', { fields: ['mostCollectedType'] }, 'booktype-highlight'),
      fetchStatsSafe('/publisher/stats', { fields: ['mostCommonPublisher'] }, 'publisher-highlight')
    ]);

    const totals = [
      { label: 'Books', value: userStats?.books ?? userStats?.totalBooks ?? 0 },
      { label: 'Book Copies', value: userStats?.bookCopies ?? 0 },
      { label: 'Authors', value: userStats?.authors ?? 0 },
      { label: 'Series', value: userStats?.series ?? 0 },
      { label: 'Publishers', value: userStats?.publishers ?? 0 },
      { label: 'Storage locations', value: userStats?.storageLocations ?? 0 }
    ];
    renderTotals(dom.overview.totals, totals);

    const highlightItems = [
      {
        label: 'Most represented author',
        value: authorStats?.mostRepresentedAuthor?.displayName || '',
        meta: authorStats?.mostRepresentedAuthor?.bookCount !== undefined
          ? `${formatNumber(authorStats.mostRepresentedAuthor.bookCount)} books`
          : '',
        href: authorStats?.mostRepresentedAuthor?.id
          ? `author-details?id=${encodeURIComponent(authorStats.mostRepresentedAuthor.id)}`
          : 'authors'
      },
      {
        label: 'Most collected series',
        value: seriesStats?.largestSeries?.name || '',
        meta: seriesStats?.largestSeries?.bookCount !== undefined
          ? `${formatNumber(seriesStats.largestSeries.bookCount)} books`
          : '',
        href: seriesStats?.largestSeries?.id
          ? `series-details?id=${encodeURIComponent(seriesStats.largestSeries.id)}`
          : 'series'
      },
      {
        label: 'Most used location',
        value: storageStats?.largestLocation?.path || storageStats?.largestLocation?.name || '',
        meta: storageStats?.largestLocation?.directCopyCount !== undefined
          ? `${formatNumber(Number(storageStats.largestLocation.directCopyCount ?? 0))} copies`
          : '',
        href: storageStats?.largestLocation?.id
          ? `storage-locations?id=${encodeURIComponent(storageStats.largestLocation.id)}`
          : 'storage-locations'
      },
      {
        label: 'Most collected book type',
        value: bookTypeStats?.mostCollectedType?.name || '',
        meta: bookTypeStats?.mostCollectedType?.bookCount !== undefined
          ? `${formatNumber(bookTypeStats.mostCollectedType.bookCount)} books`
          : '',
        href: bookTypeStats?.mostCollectedType?.id
          ? `books?filterBookTypeId=${encodeURIComponent(bookTypeStats.mostCollectedType.id)}`
          : 'books'
      },
      {
        label: 'Most common publisher',
        value: publisherStats?.mostCommonPublisher?.name || '',
        meta: publisherStats?.mostCommonPublisher?.bookCount !== undefined
          ? `${formatNumber(publisherStats.mostCommonPublisher.bookCount)} books`
          : '',
        href: publisherStats?.mostCommonPublisher?.id
          ? `publisher-details?id=${encodeURIComponent(publisherStats.mostCommonPublisher.id)}`
          : 'publishers'
      }
    ];
    renderHighlightCards(dom.overview.highlights, highlightItems);

    const hasTotals = Boolean(userStats);
    const hasHighlights = highlightItems.some((item) => item.value);
    return hasTotals || hasHighlights;
  };

  const renderBookSection = async () => {
    const [bookStats, bookTypeStats, languageStats, bookTagStats] = await Promise.all([
      fetchStatsSafe('/book/stats', {
        fields: [
          'total',
          'withPublicationDate',
          'withCoverImage',
          'withPageCount',
          'withBookType',
          'withLanguages',
          'withPublisher',
          'withTags',
          'publicationYearHistogram',
          'oldestPublicationYear',
          'newestPublicationYear',
          'longestBook',
          'shortestBook',
          'publisherPageCountAssociation',
          'taggedPageCountAssociation'
        ]
      }, 'book-stats'),
      fetchStatsSafe('/booktype/stats', { fields: ['bookTypeBreakdown'] }, 'booktype-stats'),
      fetchStatsSafe('/languages/stats', { fields: ['languageBreakdown', 'booksMissingLanguage'] }, 'language-stats'),
      fetchStatsSafe('/booktags/stats', {
        fields: ['tagBreakdown', 'untaggedBooks', 'mostTaggedBook'],
        breakdownLimit: 8
      }, 'booktag-stats')
    ]);

    const histogram = Array.isArray(bookStats?.publicationYearHistogram)
      ? [...bookStats.publicationYearHistogram]
      : [];
    const yearCounts = new Map();
    let unknownCount = 0;
    histogram.forEach((entry) => {
      const year = Number(entry.year);
      const count = Number(entry.bookCount) || 0;
      if (Number.isInteger(year) && year > 0) {
        yearCounts.set(year, count);
      } else if (count > 0) {
        unknownCount += count;
      }
    });
    const years = Array.from(yearCounts.keys()).sort((a, b) => a - b);
    const publicationLabels = [];
    const publicationCounts = [];
    if (years.length) {
      const minYear = years[0];
      const maxYear = years[years.length - 1];
      for (let year = minYear; year <= maxYear; year += 1) {
        publicationLabels.push(String(year));
        publicationCounts.push(yearCounts.get(year) || 0);
      }
    }
    if (unknownCount > 0) {
      publicationLabels.push('Unknown');
      publicationCounts.push(unknownCount);
    }
    renderChart(dom.books.publicationChart, publicationLabels.length ? {
      type: 'bar',
      data: {
        labels: publicationLabels,
        datasets: [{
          label: 'Books',
          data: publicationCounts,
          backgroundColor: chartPalette[1]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 45, minRotation: 0 } },
          y: { beginAtZero: true }
        }
      }
    } : null, dom.books.publicationEmpty);

    const typeBreakdown = Array.isArray(bookTypeStats?.bookTypeBreakdown)
      ? bookTypeStats.bookTypeBreakdown.filter((entry) => Number(entry.bookCount) > 0)
      : [];
    const typeLabels = typeBreakdown.map((entry) => entry.name);
    const typeCounts = typeBreakdown.map((entry) => Number(entry.bookCount) || 0);
    renderChart(dom.books.typeChart, typeLabels.length ? {
      type: 'doughnut',
      data: {
        labels: typeLabels,
        datasets: [{
          data: typeCounts,
          backgroundColor: chartPalette
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    } : null, dom.books.typeEmpty);

    const languageBreakdown = Array.isArray(languageStats?.languageBreakdown)
      ? languageStats.languageBreakdown
      : Array.isArray(languageStats?.breakdownPerLanguage)
        ? languageStats.breakdownPerLanguage
        : [];
    const languageLabels = languageBreakdown.map((entry) => entry.name);
    const languageCounts = languageBreakdown.map((entry) => Number(entry.bookCount) || 0);
    renderChart(dom.books.languageChart, languageLabels.length ? {
      type: 'doughnut',
      data: {
        labels: languageLabels,
        datasets: [{
          data: languageCounts,
          backgroundColor: chartPalette
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    } : null, dom.books.languageEmpty);

    const tagBreakdown = Array.isArray(bookTagStats?.tagBreakdown)
      ? bookTagStats.tagBreakdown.filter((entry) => Number(entry.bookCount) > 0)
      : [];
    const tagLabels = tagBreakdown.map((entry) => entry.name);
    const tagCounts = tagBreakdown.map((entry) => Number(entry.bookCount) || 0);
    renderChart(dom.books.tagChart, tagLabels.length ? {
      type: 'bar',
      data: {
        labels: tagLabels,
        datasets: [{
          label: 'Books',
          data: tagCounts,
          backgroundColor: chartPalette[4]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    } : null, dom.books.tagEmpty);

    const totalBooks = Number(bookStats?.total ?? bookStats?.totalBooks ?? 0);
    const missingPublished = Math.max(totalBooks - Number(bookStats?.withPublicationDate ?? 0), 0);
    const missingType = Math.max(totalBooks - Number(bookStats?.withBookType ?? 0), 0);
    const missingLanguage = languageStats?.booksMissingLanguage?.count !== undefined
      ? Number(languageStats.booksMissingLanguage.count)
      : Math.max(totalBooks - Number(bookStats?.withLanguages ?? 0), 0);
    const missingTags = bookTagStats?.untaggedBooks?.count !== undefined
      ? Number(bookTagStats.untaggedBooks.count)
      : Math.max(totalBooks - Number(bookStats?.withTags ?? 0), 0);
    setHint(dom.books.publicationHint, missingPublished > 0 ? `${formatNumber(missingPublished)} books missing published date.` : '');
    setHint(dom.books.typeHint, missingType > 0 ? `${formatNumber(missingType)} books missing type.` : '');
    setHint(dom.books.languageHint, missingLanguage > 0 ? `${formatNumber(missingLanguage)} books missing language.` : '');
    setHint(dom.books.tagHint, missingTags > 0 ? `${formatNumber(missingTags)} books missing tags.` : '');
    const qualityItems = [
      { label: 'Missing cover', value: totalBooks - Number(bookStats?.withCoverImage ?? 0) },
      { label: 'Missing published date', value: totalBooks - Number(bookStats?.withPublicationDate ?? 0) },
      { label: 'Missing pages', value: totalBooks - Number(bookStats?.withPageCount ?? 0) },
      { label: 'Missing type', value: totalBooks - Number(bookStats?.withBookType ?? 0) },
      { label: 'Missing language', value: totalBooks - Number(bookStats?.withLanguages ?? 0) },
      { label: 'Missing publisher', value: totalBooks - Number(bookStats?.withPublisher ?? 0) }
    ];
    if (dom.books.qualityGrid) {
      dom.books.qualityGrid.innerHTML = qualityItems.map((item) => `
        <div class="col-6">
          <div class="stats-card p-3 h-100">
            <div class="stat-label">${renderTooltipLabel(item.label)}</div>
            <div class="stat-value">${escapeHtml(formatNumber(Math.max(item.value, 0)))}</div>
          </div>
        </div>
      `).join('');
      initTooltips(dom.books.qualityGrid);
    }

    const highlights = [];
    if (bookStats?.oldestPublicationYear) {
      highlights.push({
        label: 'Oldest publication year',
        detail: String(bookStats.oldestPublicationYear)
      });
    }
    if (bookStats?.newestPublicationYear) {
      highlights.push({
        label: 'Newest publication year',
        detail: String(bookStats.newestPublicationYear)
      });
    }
    if (bookStats?.longestBook?.title) {
      const longestLink = `<a href="book-details?id=${encodeURIComponent(bookStats.longestBook.id)}">${escapeHtml(bookStats.longestBook.title)}</a>`;
      highlights.push({
        html: `<span class="fw-semibold">${renderTooltipLabel('Longest book')}</span> <span class="text-muted">${longestLink} (${escapeHtml(formatNumber(bookStats.longestBook.pageCount))} pages)</span>`
      });
    }
    if (bookStats?.shortestBook?.title) {
      const shortestLink = `<a href="book-details?id=${encodeURIComponent(bookStats.shortestBook.id)}">${escapeHtml(bookStats.shortestBook.title)}</a>`;
      highlights.push({
        html: `<span class="fw-semibold">${renderTooltipLabel('Shortest book')}</span> <span class="text-muted">${shortestLink} (${escapeHtml(formatNumber(bookStats.shortestBook.pageCount))} pages)</span>`
      });
    }
    if (bookTagStats?.untaggedBooks?.count !== undefined) {
      highlights.push({
        label: 'Untagged books',
        detail: formatNumber(bookTagStats.untaggedBooks.count)
      });
    }
    if (tagBreakdown[0]?.name) {
      highlights.push({
        label: 'Most used tag',
        detail: `${tagBreakdown[0].name} (${formatNumber(tagBreakdown[0].bookCount)} books)`
      });
    }
    if (bookTagStats?.mostTaggedBook?.title) {
      const mostTaggedLink = `<a href="book-details?id=${encodeURIComponent(bookTagStats.mostTaggedBook.id)}">${escapeHtml(bookTagStats.mostTaggedBook.title)}</a>`;
      highlights.push({
        html: `<span class="fw-semibold">${renderTooltipLabel('Most tagged book')}</span> <span class="text-muted">${mostTaggedLink} (${escapeHtml(formatNumber(bookTagStats.mostTaggedBook.tagCount))} tags)</span>`
      });
    }
    renderListItems(dom.books.highlights, highlights);

    const correlationItems = [];
    const pushAssociation = (association, label, withLabel, withoutLabel) => {
      if (!association) return;
      const sampleSize = Number(association.sampleSize || 0);
      const minGroup = Number(association.minimumGroupSize || 0);
      const withCount = Number(association.withGroup?.count || 0);
      const withoutCount = Number(association.withoutGroup?.count || 0);
      const insight = association.insight || 'Not enough data yet.';
      const detail = `${insight} (N=${formatNumber(sampleSize)}; min per group ${formatNumber(minGroup)}; ${formatNumber(withCount)} ${withLabel}, ${formatNumber(withoutCount)} ${withoutLabel}). Association only; not causation.`;
      correlationItems.push({ label, detail });
    };

    pushAssociation(bookStats?.publisherPageCountAssociation, 'Publisher and pages', 'with publishers', 'without publishers');
    pushAssociation(bookStats?.taggedPageCountAssociation, 'Tags and pages', 'tagged', 'untagged');
    renderListItems(dom.books.correlationList, correlationItems);

    return Boolean(bookStats || bookTypeStats || languageStats || bookTagStats);
  };

  const renderAuthorSection = async () => {
    const [authorStats, bookAuthorStats] = await Promise.all([
      fetchStatsSafe('/author/stats', {
        fields: [
          'total',
          'withBirthDate',
          'withDeathDate',
          'breakdownPerAliveDeceased',
          'breakdownPerBirthDecade',
          'breakdownPerAuthor',
          'oldestAuthor',
          'youngestAuthor',
          'mostRepresentedAuthor'
        ]
      }, 'author-stats'),
      fetchStatsSafe('/bookauthor/stats', null, 'bookauthor-stats')
    ]);

    const aliveBreakdown = Array.isArray(authorStats?.breakdownPerAliveDeceased)
      ? authorStats.breakdownPerAliveDeceased
      : [];
    const authorTotal = Number(authorStats?.total ?? authorStats?.totalAuthors ?? 0);
    const missingBirthDates = Math.max(authorTotal - Number(authorStats?.withBirthDate ?? 0), 0);
    const missingDeathDates = Math.max(authorTotal - Number(authorStats?.withDeathDate ?? 0), 0);
    setHint(dom.authors.aliveHint, missingDeathDates > 0 ? `${formatNumber(missingDeathDates)} authors missing death dates.` : '');
    setHint(dom.authors.decadeHint, missingBirthDates > 0 ? `${formatNumber(missingBirthDates)} authors missing birth dates.` : '');
    const aliveLabels = aliveBreakdown.map((entry) => (entry.deceased ? 'With death date' : 'No death date'));
    const aliveCounts = aliveBreakdown.map((entry) => Number(entry.authorCount) || 0);
    renderChart(dom.authors.aliveChart, aliveLabels.length ? {
      type: 'doughnut',
      data: {
        labels: aliveLabels,
        datasets: [{ data: aliveCounts, backgroundColor: [chartPalette[4], chartPalette[2]] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    } : null, dom.authors.aliveEmpty);

    const decadeBreakdown = Array.isArray(authorStats?.breakdownPerBirthDecade)
      ? authorStats.breakdownPerBirthDecade
      : [];
    const decadeLabels = decadeBreakdown.map((entry) => `${entry.decade}s`);
    const decadeCounts = decadeBreakdown.map((entry) => Number(entry.authorCount) || 0);
    renderChart(dom.authors.decadeChart, decadeLabels.length ? {
      type: 'bar',
      data: {
        labels: decadeLabels,
        datasets: [{ label: 'Authors', data: decadeCounts, backgroundColor: chartPalette[3] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    } : null, dom.authors.decadeEmpty);

    const topAuthors = Array.isArray(authorStats?.breakdownPerAuthor)
      ? [...authorStats.breakdownPerAuthor]
        .sort((a, b) => {
          const countDelta = (Number(b.bookCount) || 0) - (Number(a.bookCount) || 0);
          if (countDelta !== 0) return countDelta;
          const nameA = String(a.displayName || '').toLowerCase();
          const nameB = String(b.displayName || '').toLowerCase();
          if (nameA && nameB) return nameA.localeCompare(nameB);
          return (Number(a.id) || 0) - (Number(b.id) || 0);
        })
        .slice(0, 6)
      : [];
    const topRows = topAuthors.map((entry) => `
      <tr class="clickable-row" data-row-href="author-details?id=${encodeURIComponent(entry.id)}">
        <td>${escapeHtml(entry.displayName || 'Unknown')}</td>
        <td class="text-end">${escapeHtml(formatNumber(entry.bookCount))}</td>
      </tr>
    `);
    renderTableRows(dom.authors.topTable, topRows, 2);

    const authorHighlights = [];
    if (authorStats?.mostRepresentedAuthor?.displayName) {
      authorHighlights.push({
        label: 'Most represented author',
        detail: `${authorStats.mostRepresentedAuthor.displayName} (${formatNumber(authorStats.mostRepresentedAuthor.bookCount)} books)`
      });
    }
    if (authorStats?.oldestAuthor?.displayName) {
      authorHighlights.push({
        label: 'Oldest author',
        detail: `${authorStats.oldestAuthor.displayName} (${formatMaybe(authorStats.oldestAuthor.birthYear)})`
      });
    }
    if (authorStats?.youngestAuthor?.displayName) {
      authorHighlights.push({
        label: 'Youngest author',
        detail: `${authorStats.youngestAuthor.displayName} (${formatMaybe(authorStats.youngestAuthor.birthYear)})`
      });
    }
    renderListItems(dom.authors.highlights, authorHighlights);

    const roleBreakdown = Array.isArray(bookAuthorStats?.authorRoleBreakdown)
      ? bookAuthorStats.authorRoleBreakdown
      : [];
    const roleLabels = roleBreakdown.map((entry) => entry.role);
    const roleCounts = roleBreakdown.map((entry) => Number(entry.count) || 0);
    renderChart(dom.authors.rolesChart, roleLabels.length ? {
      type: 'bar',
      data: {
        labels: roleLabels,
        datasets: [{ label: 'Contributions', data: roleCounts, backgroundColor: chartPalette[0] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    } : null, dom.authors.rolesEmpty);

    const collabPairs = Array.isArray(bookAuthorStats?.collaborationPairs)
      ? bookAuthorStats.collaborationPairs.slice(0, 6)
      : [];
    const collabRows = collabPairs.map((entry) => {
      const names = Array.isArray(entry.authors)
        ? entry.authors.map((author) => author.displayName).filter(Boolean).join(' & ')
        : 'Unknown';
      return `
        <tr>
          <td>${escapeHtml(names || 'Unknown')}</td>
          <td class="text-end">${escapeHtml(formatNumber(entry.bookCount))}</td>
        </tr>
      `;
    });
    renderTableRows(dom.authors.collabTable, collabRows, 2);

    return Boolean(authorStats || bookAuthorStats);
  };

  const renderPublisherSection = async () => {
    const publisherStats = await fetchStatsSafe('/publisher/stats', { fields: ['breakdownPerPublisher', 'mostCommonPublisher', 'oldestFoundedPublisher', 'total'] }, 'publisher-stats');
    const breakdown = Array.isArray(publisherStats?.breakdownPerPublisher)
      ? publisherStats.breakdownPerPublisher
      : [];
    const topPublishers = breakdown.slice(0, 8);
    const labels = topPublishers.map((entry) => entry.name);
    const counts = topPublishers.map((entry) => Number(entry.bookCount) || 0);
    renderChart(dom.publishers.topChart, labels.length ? {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Books', data: counts, backgroundColor: chartPalette[0] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    } : null, dom.publishers.topEmpty);

    const rows = topPublishers.map((entry) => `
      <tr class="clickable-row" data-row-href="publisher-details?id=${encodeURIComponent(entry.id)}">
        <td>${escapeHtml(entry.name || 'Unknown')}</td>
        <td class="text-end">${escapeHtml(formatNumber(entry.bookCount))}</td>
      </tr>
    `);
    renderTableRows(dom.publishers.breakdownTable, rows, 2);

    const highlightItems = [];
    if (publisherStats?.mostCommonPublisher?.name) {
      highlightItems.push({
        label: 'Most common publisher',
        detail: `${publisherStats.mostCommonPublisher.name} (${formatNumber(publisherStats.mostCommonPublisher.bookCount)} books)`
      });
    }
    if (publisherStats?.oldestFoundedPublisher?.name) {
      highlightItems.push({
        label: 'Oldest founded publisher',
        detail: `${publisherStats.oldestFoundedPublisher.name} (${formatMaybe(publisherStats.oldestFoundedPublisher.foundedYear)})`
      });
    }
    if (publisherStats?.total !== undefined) {
      highlightItems.push({
        label: 'Total publishers',
        detail: formatNumber(publisherStats.total)
      });
    }
    renderListItems(dom.publishers.highlights, highlightItems);

    return Boolean(publisherStats);
  };

  const renderSeriesSection = async () => {
    const [seriesStats, seriesBookStats] = await Promise.all([
      fetchStatsSafe('/bookseries/stats', { fields: ['breakdownPerSeries', 'largestSeries', 'total', 'withBooks'] }, 'series-stats'),
      fetchStatsSafe('/bookseriesbooks/stats', null, 'series-books-stats')
    ]);

    const seriesVs = [];
    if (seriesBookStats?.booksInSeries?.count !== undefined) {
      seriesVs.push({ label: 'In series', value: seriesBookStats.booksInSeries.count });
    }
    if (seriesBookStats?.standalones?.count !== undefined) {
      seriesVs.push({ label: 'Standalones', value: seriesBookStats.standalones.count });
    }
    renderChart(dom.series.vsChart, seriesVs.length ? {
      type: 'doughnut',
      data: {
        labels: seriesVs.map((item) => item.label),
        datasets: [{ data: seriesVs.map((item) => item.value), backgroundColor: [chartPalette[1], chartPalette[4]] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    } : null, dom.series.vsEmpty);

    const seriesBreakdown = Array.isArray(seriesStats?.breakdownPerSeries)
      ? seriesStats.breakdownPerSeries
      : [];
    const topSeries = seriesBreakdown.slice(0, 8);
    const seriesLabels = topSeries.map((entry) => entry.name);
    const seriesCounts = topSeries.map((entry) => Number(entry.bookCount) || 0);
    renderChart(dom.series.topChart, seriesLabels.length ? {
      type: 'bar',
      data: {
        labels: seriesLabels,
        datasets: [{ label: 'Books', data: seriesCounts, backgroundColor: chartPalette[2] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    } : null, dom.series.topEmpty);

    const healthItems = [];
    if (seriesBookStats?.outOfOrderEntries) {
      healthItems.push({
        label: 'Missing order numbers',
        detail: formatNumber(seriesBookStats.outOfOrderEntries.nullBookOrderCount ?? 0)
      });
      healthItems.push({
        label: 'Gaps in series order',
        detail: formatNumber(seriesBookStats.outOfOrderEntries.gapCount ?? 0)
      });
    }
    if (seriesStats?.withBooks !== undefined) {
      const withoutBooks = Math.max(Number(seriesStats.total ?? 0) - Number(seriesStats.withBooks ?? 0), 0);
      healthItems.push({
        label: 'Series without books',
        detail: formatNumber(withoutBooks)
      });
    }
    if (Array.isArray(seriesStats?.breakdownPerSeries)) {
      const totalGaps = seriesStats.breakdownPerSeries.reduce((sum, item) => sum + Number(item.gapCount || 0), 0);
      const totalDuplicates = seriesStats.breakdownPerSeries.reduce((sum, item) => sum + Number(item.duplicateOrderNumbers || 0), 0);
      const totalNulls = seriesStats.breakdownPerSeries.reduce((sum, item) => sum + Number(item.nullBookOrderCount || 0), 0);
      healthItems.push({ label: 'Series with gaps', detail: formatNumber(totalGaps) });
      healthItems.push({ label: 'Duplicate order numbers', detail: formatNumber(totalDuplicates) });
      healthItems.push({ label: 'Null order entries', detail: formatNumber(totalNulls) });
    }
    renderListItems(dom.series.healthList, healthItems);

    const breakdownRows = topSeries.map((entry) => `
      <tr class="clickable-row" data-row-href="series-details?id=${encodeURIComponent(entry.id)}">
        <td>${escapeHtml(entry.name || 'Unknown')}</td>
        <td class="text-end">${escapeHtml(formatNumber(entry.bookCount))}</td>
        <td class="text-end">${escapeHtml(formatNumber(entry.gapCount ?? 0))}</td>
      </tr>
    `);
    renderTableRows(dom.series.breakdownTable, breakdownRows, 3);

    return Boolean(seriesStats || seriesBookStats);
  };

  const renderStorageSection = async () => {
    const storageStats = await fetchStatsSafe('/storagelocation/stats', { fields: ['breakdownPerLocation', 'largestLocation', 'totalLocations'] }, 'storage-stats');
    const breakdown = Array.isArray(storageStats?.breakdownPerLocation)
      ? storageStats.breakdownPerLocation
      : [];
    const topLocations = breakdown.slice(0, 8);
    const locationLabels = topLocations.map((entry) => entry.path || entry.name || 'Unknown');
    const directCounts = topLocations.map((entry) => Number(entry.directCopyCount) || 0);
    const nestedCounts = topLocations.map((entry) => Number(entry.nestedCopyCount) || 0);
    const copyCounts = topLocations.map((_, index) => directCounts[index] + nestedCounts[index]);
    const hasDirectNested = directCounts.some((value) => value > 0) || nestedCounts.some((value) => value > 0);
    const datasets = hasDirectNested
      ? [
        { label: 'Direct', data: directCounts, backgroundColor: chartPalette[1] },
        { label: 'Nested', data: nestedCounts, backgroundColor: chartPalette[5] }
      ]
      : [{ label: 'Copies', data: copyCounts, backgroundColor: chartPalette[1] }];

    renderChart(dom.storage.locationChart, locationLabels.length ? {
      type: 'bar',
      data: { labels: locationLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: hasDirectNested },
          y: { stacked: hasDirectNested, beginAtZero: true }
        }
      }
    } : null, dom.storage.locationEmpty);

    if (dom.storage.highlights) {
      const mostUsed = storageStats?.largestLocation;
      if (mostUsed?.name) {
        const pathLabel = mostUsed.path || mostUsed.name;
        const directCount = Number(mostUsed.directCopyCount ?? 0);
        dom.storage.highlights.innerHTML = `
          <div class="stat-label">${escapeHtml(pathLabel)}</div>
          <div class="stat-value" data-bs-toggle="tooltip" data-bs-title="Direct copies stored in this location.">${escapeHtml(formatNumber(directCount))}</div>
          <div class="text-muted small">Direct copies in this location.</div>
          <div class="mt-3">
            <a class="btn btn-sm btn-outline-secondary" href="storage-locations?id=${encodeURIComponent(mostUsed.id)}">Open location</a>
          </div>
        `;
        initTooltips(dom.storage.highlights);
      } else {
        dom.storage.highlights.innerHTML = '<div class="text-muted">No storage data yet.</div>';
      }
    }

    const breakdownRows = breakdown.map((entry) => {
      const totalCopies = Number(entry.directCopyCount ?? 0) + Number(entry.nestedCopyCount ?? 0);
      return `
        <tr class="clickable-row" data-row-href="storage-locations?id=${encodeURIComponent(entry.id)}">
          <td>${escapeHtml(entry.path || 'Unknown')}</td>
          <td class="text-end">${escapeHtml(formatNumber(totalCopies))}</td>
          <td class="text-end">${escapeHtml(formatNumber(entry.directCopyCount ?? 0))}</td>
          <td class="text-end">${escapeHtml(formatNumber(entry.nestedCopyCount ?? 0))}</td>
        </tr>
      `;
    });
    renderTableRows(dom.storage.breakdownTable, breakdownRows, 4);

    return Boolean(storageStats);
  };

  const timelineRecordTypes = [
    { value: 'books', label: 'Books', fields: [
      { value: 'datePublished', label: 'Published date' }
    ] },
    { value: 'authors', label: 'Authors', fields: [
      { value: 'birthDate', label: 'Birth date' },
      { value: 'deathDate', label: 'Death date' }
    ] },
    { value: 'publishers', label: 'Publishers', fields: [
      { value: 'foundedDate', label: 'Founded date' }
    ] },
    { value: 'bookCopies', label: 'Book copies', fields: [
      { value: 'acquisitionDate', label: 'Acquisition date' }
    ] }
  ];

  const renderTimelineSummary = (payload) => {
    if (!dom.timeline.summary) return;
    const buckets = Array.isArray(payload?.buckets) ? payload.buckets : [];
    const inRange = buckets.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
    const summaryItems = [
      { label: 'In range', value: inRange },
      { label: 'Before start', value: payload?.beforeStart ?? 0 },
      { label: 'After end', value: payload?.afterEnd ?? 0 },
      { label: 'Unknown', value: payload?.unknown ?? 0 }
    ];
    dom.timeline.summary.innerHTML = summaryItems.map((item) => `
      <div class="col-6 col-md-3">
        <div class="stats-card p-3 h-100">
          <div class="stat-label">${renderTooltipLabel(item.label)}</div>
          <div class="stat-value">${escapeHtml(formatNumber(item.value))}</div>
        </div>
      </div>
    `).join('');
    initTooltips(dom.timeline.summary);
  };

  const renderTimelineChart = (payload) => {
    const buckets = Array.isArray(payload?.buckets) ? payload.buckets : [];
    const labels = buckets.map((bucket) => bucket.label || bucket.start);
    const counts = buckets.map((bucket) => Number(bucket.count) || 0);
    const onClick = (index) => {
      const bucket = buckets[index];
      if (!bucket) return;
      if (payload?.recordType === 'books' && payload?.field === 'datePublished') {
        const params = new URLSearchParams();
        if (bucket.start) params.set('filterPublishedAfter', bucket.start);
        if (bucket.end) params.set('filterPublishedBefore', bucket.end);
        window.location.href = `books?${params.toString()}`;
      }
    };

    renderChart(dom.timeline.chart, labels.length ? {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Count', data: counts, backgroundColor: chartPalette[0] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const index = elements[0].index;
          onClick(index);
        }
      }
    } : null, dom.timeline.chartEmpty);
  };

  const updateTimelineFields = () => {
    const selectedRecordType = dom.timeline.recordType?.value || 'books';
    const recordTypeConfig = timelineRecordTypes.find((entry) => entry.value === selectedRecordType) || timelineRecordTypes[0];
    if (!dom.timeline.field) return;
    dom.timeline.field.innerHTML = recordTypeConfig.fields
      .map((field) => `<option value="${escapeHtml(field.value)}">${escapeHtml(field.label)}</option>`)
      .join('');
  };

  const updateTimelineMode = () => {
    const mode = dom.timeline.mode?.value || 'auto';
    if (dom.timeline.manualRow) {
      dom.timeline.manualRow.classList.toggle('d-none', mode !== 'manual');
    }
    if (dom.timeline.bucketsWrap) {
      dom.timeline.bucketsWrap.classList.toggle('d-none', mode !== 'auto');
    }
    clearFieldErrors();
  };

  const parsePartialDate = (value, { isEnd = false } = {}) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parts = trimmed.split('-');
    if (parts.length < 1 || parts.length > 3) return null;
    const year = Number.parseInt(parts[0], 10);
    if (!Number.isInteger(year) || year < 1 || year > 9999) return null;
    let month = 1;
    let day = 1;
    if (parts.length >= 2) {
      month = Number.parseInt(parts[1], 10);
      if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    }
    if (parts.length === 3) {
      day = Number.parseInt(parts[2], 10);
      if (!Number.isInteger(day) || day < 1 || day > 31) return null;
    }
    if (isEnd) {
      if (parts.length === 1) {
        return new Date(Date.UTC(year, 11, 31));
      }
      if (parts.length === 2) {
        return new Date(Date.UTC(year, month, 0));
      }
    }
    return new Date(Date.UTC(year, month - 1, day));
  };

  const validateTimelineInputs = () => {
    clearFieldErrors();
    let isValid = true;
    const mode = dom.timeline.mode?.value || 'auto';
    const recordType = dom.timeline.recordType?.value || '';
    const field = dom.timeline.field?.value || '';

    if (!recordType) {
      setFieldError(dom.timeline.recordType, dom.timeline.recordTypeError, 'Select a record type.');
      isValid = false;
    }
    if (!field) {
      setFieldError(dom.timeline.field, dom.timeline.fieldError, 'Select a field.');
      isValid = false;
    }

    const payload = {
      recordType,
      field,
      auto: mode === 'auto',
      hideEmptyBuckets: Boolean(dom.timeline.hideEmpty?.checked)
    };

    if (mode === 'auto') {
      const bucketsValue = dom.timeline.buckets?.value;
      if (bucketsValue) {
        const buckets = Number(bucketsValue);
        if (!Number.isInteger(buckets) || buckets < 2 || buckets > 200) {
          setFieldError(dom.timeline.buckets, dom.timeline.bucketsError, 'Enter a bucket count between 2 and 200.');
          isValid = false;
        } else {
          payload.numberOfBuckets = buckets;
        }
      }
    } else {
      const startValue = dom.timeline.start?.value || '';
      const endValue = dom.timeline.end?.value || '';
      const stepValue = Number(dom.timeline.step?.value);
      const stepUnitValue = dom.timeline.stepUnit?.value || '';
      const startDate = parsePartialDate(startValue, { isEnd: false });
      const endDate = parsePartialDate(endValue, { isEnd: true });

      if (!startValue || !startDate) {
        setFieldError(dom.timeline.start, dom.timeline.startError, 'Enter a valid start date (YYYY or YYYY-MM).');
        isValid = false;
      }
      if (!endValue || !endDate) {
        setFieldError(dom.timeline.end, dom.timeline.endError, 'Enter a valid end date (YYYY or YYYY-MM).');
        isValid = false;
      }
      if (!Number.isInteger(stepValue) || stepValue < 1) {
        setFieldError(dom.timeline.step, dom.timeline.stepError, 'Step must be a positive number.');
        isValid = false;
      }
      if (!stepUnitValue) {
        setFieldError(dom.timeline.stepUnit, dom.timeline.stepUnitError, 'Select a step unit.');
        isValid = false;
      }
      if (startDate && endDate && startDate > endDate) {
        setFieldError(dom.timeline.end, dom.timeline.endError, 'End date must be after the start date.');
        isValid = false;
      }

      payload.start = startValue;
      payload.end = endValue;
      payload.step = stepValue || 1;
      payload.stepUnit = stepUnitValue || 'year';
    }

    return { isValid, payload };
  };

  const runTimeline = async () => {
    if (!dom.timeline.runBtn) return;
    setFeedback('');
    if (dom.timeline.error) dom.timeline.error.classList.add('d-none');
    const validation = validateTimelineInputs();
    if (!validation.isValid) {
      warn('Timeline validation failed.', validation);
      return;
    }

    if (dom.timeline.runSpinner) dom.timeline.runSpinner.classList.remove('d-none');
    dom.timeline.runBtn.disabled = true;

    const timelineChartId = dom.timeline.chart?.id;
    if (timelineChartId && state.charts.has(timelineChartId)) {
      state.charts.get(timelineChartId).destroy();
      state.charts.delete(timelineChartId);
    }
    if (dom.timeline.chart) dom.timeline.chart.classList.add('d-none');

    if (dom.timeline.chartEmpty) dom.timeline.chartEmpty.classList.remove('d-none');
    if (dom.timeline.chartEmptyTitle) dom.timeline.chartEmptyTitle.textContent = 'Loading timeline...';
    if (dom.timeline.chartEmptyText) dom.timeline.chartEmptyText.textContent = 'Fetching buckets from your library.';

    const requestId = ++state.timelineRequestId;
    const payload = validation.payload;

    log('Timeline request starting.', payload);

    try {
      const response = await apiFetch('/timeline/buckets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (requestId !== state.timelineRequestId) {
        log('Timeline request ignored (stale).');
        return;
      }
      if (await handleRateLimit(response)) return;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.errors?.[0] || data.message || 'Timeline request failed.';
        if (dom.timeline.error) {
          dom.timeline.error.textContent = message;
          dom.timeline.error.classList.remove('d-none');
        }
        if (dom.timeline.chartEmptyTitle) dom.timeline.chartEmptyTitle.textContent = 'Timeline failed';
        if (dom.timeline.chartEmptyText) dom.timeline.chartEmptyText.textContent = message;
        warn('Timeline request failed.', { status: response.status, data });
        return;
      }
      log('Timeline response received.', { buckets: data.buckets?.length || data.data?.buckets?.length });
      const payloadData = data.data || data;
      renderTimelineChart(payloadData);
      renderTimelineSummary(payloadData);
      const hasBuckets = Array.isArray(payloadData.buckets) && payloadData.buckets.length > 0;
      if (!hasBuckets) {
        if (dom.timeline.chartEmptyTitle) dom.timeline.chartEmptyTitle.textContent = 'No results for this range';
        if (dom.timeline.chartEmptyText) dom.timeline.chartEmptyText.textContent = 'Try widening the date range or switching to Auto mode.';
      }
      if (dom.timeline.chartEmpty) dom.timeline.chartEmpty.classList.toggle('d-none', hasBuckets);
    } catch (error) {
      errorLog('Timeline request error.', error);
      if (dom.timeline.error) {
        dom.timeline.error.textContent = 'Unable to build timeline right now. Please try again soon.';
        dom.timeline.error.classList.remove('d-none');
      }
      if (dom.timeline.chartEmptyTitle) dom.timeline.chartEmptyTitle.textContent = 'Timeline failed';
      if (dom.timeline.chartEmptyText) dom.timeline.chartEmptyText.textContent = 'Try again in a moment.';
    } finally {
      if (dom.timeline.runSpinner) dom.timeline.runSpinner.classList.add('d-none');
      dom.timeline.runBtn.disabled = false;
    }
  };

  const renderTimelineSection = async () => {
    if (dom.timeline.recordType) {
      dom.timeline.recordType.innerHTML = timelineRecordTypes
        .map((entry) => `<option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>`)
        .join('');
      updateTimelineFields();
      updateTimelineMode();
    }

    if (dom.timeline.chartEmpty) {
      dom.timeline.chartEmpty.classList.remove('d-none');
      if (dom.timeline.chartEmptyTitle) dom.timeline.chartEmptyTitle.textContent = 'Run a timeline';
      if (dom.timeline.chartEmptyText) dom.timeline.chartEmptyText.textContent = 'Generate buckets to see counts.';
    }
    return true;
  };

  const sectionLoaders = {
    overview: renderOverviewSection,
    books: renderBookSection,
    authors: renderAuthorSection,
    publishers: renderPublisherSection,
    series: renderSeriesSection,
    storage: renderStorageSection,
    timeline: renderTimelineSection
  };

  const showSection = async (sectionKey, { force = false, updateHash: shouldUpdateHash = true, pushHash = false } = {}) => {
    if (!sectionLoaders[sectionKey]) return;
    setActiveSection(sectionKey);
    if (shouldUpdateHash) updateHash(sectionKey, { push: pushHash });
    setSectionState(sectionKey, { loading: true, empty: false });

    if (!force && state.sectionLoaded.has(sectionKey)) {
      setSectionState(sectionKey, { loading: false, empty: false });
      return;
    }

    const loader = sectionLoaders[sectionKey];
    try {
      log('Section load started.', { section: sectionKey, force });
      const hasData = await loader();
      setSectionState(sectionKey, { loading: false, empty: !hasData });
      state.sectionLoaded.add(sectionKey);
      log('Section load completed.', { section: sectionKey, hasData });
    } catch (error) {
      errorLog('Section load failed.', { section: sectionKey, error });
      setSectionState(sectionKey, { loading: false, empty: true });
      setFeedback('Unable to load statistics right now. Please try again later.');
    }
  };

  const handleRefresh = async () => {
    if (dom.refreshBtn) dom.refreshBtn.disabled = true;
    if (dom.refreshSpinner) dom.refreshSpinner.classList.remove('d-none');
    setFeedback('');
    destroyCharts();
    state.sectionLoaded.clear();
    state.statsCache.clear();
    await showSection(state.activeSection, { force: true });
    if (dom.refreshSpinner) dom.refreshSpinner.classList.add('d-none');
    if (dom.refreshBtn) dom.refreshBtn.disabled = false;
  };

  const attachEvents = () => {
    dom.navButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const section = button.dataset.section;
        if (!section || section === state.activeSection) return;
        showSection(section, { updateHash: true, pushHash: true });
      });
    });

    if (dom.refreshBtn) {
      dom.refreshBtn.addEventListener('click', handleRefresh);
    }

    document.addEventListener('click', (event) => {
      const targetCard = event.target.closest('[data-href]');
      if (targetCard && targetCard.dataset.href) {
        window.location.href = targetCard.dataset.href;
        return;
      }
      const row = event.target.closest('[data-row-href]');
      if (row && row.dataset.rowHref) {
        window.location.href = row.dataset.rowHref;
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const targetCard = event.target.closest('[data-href]');
      if (targetCard && targetCard.dataset.href) {
        event.preventDefault();
        window.location.href = targetCard.dataset.href;
      }
    });

    window.addEventListener('hashchange', () => {
      const section = getSectionFromHash();
      if (!section || section === state.activeSection) return;
      log('Hash navigation triggered.', { section });
      showSection(section, { updateHash: false });
    });

    if (dom.timeline.recordType) {
      dom.timeline.recordType.addEventListener('change', () => {
        updateTimelineFields();
        clearFieldErrors();
      });
    }

    if (dom.timeline.field) {
      dom.timeline.field.addEventListener('change', () => {
        clearFieldErrors();
      });
    }

    if (dom.timeline.mode) {
      dom.timeline.mode.addEventListener('change', updateTimelineMode);
    }

    if (dom.timeline.runBtn) {
      dom.timeline.runBtn.addEventListener('click', runTimeline);
    }

    if (dom.timeline.retryBtn) {
      dom.timeline.retryBtn.addEventListener('click', () => {
        log('Retrying timeline section load.');
        showSection('timeline', { force: true, updateHash: true, pushHash: true });
      });
    }

    ['buckets', 'start', 'end', 'step'].forEach((key) => {
      const input = dom.timeline[key];
      if (!input) return;
      input.addEventListener('input', () => {
        clearFieldErrors();
      });
    });

    if (dom.timeline.stepUnit) {
      dom.timeline.stepUnit.addEventListener('change', () => {
        clearFieldErrors();
      });
    }

  };

  const init = async () => {
    log('Initializing statistics page.');
    if (window.rateLimitGuard?.hasReset && window.rateLimitGuard.hasReset()) {
      window.rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: false, rateLimited: true });
      }
      return;
    }
    attachEvents();
    initTooltips();
    const initialSection = getSectionFromHash() || state.activeSection;
    state.activeSection = initialSection;
    await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
    try {
      await showSection(initialSection, { force: true, updateHash: true });
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: true });
      }
    } catch (error) {
      errorLog('Statistics init failed.', error);
      if (window.pageContentReady && typeof window.pageContentReady.resolve === 'function') {
        window.pageContentReady.resolve({ success: false, error: error?.message || 'Unable to load statistics.' });
      }
    } finally {
      await hideModal('pageLoadingModal');
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
