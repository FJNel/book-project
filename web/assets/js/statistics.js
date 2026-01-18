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
      typeChart: document.getElementById('booksTypeChart'),
      typeEmpty: document.getElementById('booksTypeEmpty'),
      languageChart: document.getElementById('booksLanguageChart'),
      languageEmpty: document.getElementById('booksLanguageEmpty'),
      tagChart: document.getElementById('booksTagChart'),
      tagEmpty: document.getElementById('booksTagEmpty'),
      qualityGrid: document.getElementById('booksQualityGrid'),
      highlights: document.getElementById('booksHighlightsList')
    },
    authors: {
      loading: document.getElementById('authorsLoading'),
      content: document.getElementById('authorsContent'),
      empty: document.getElementById('authorsEmpty'),
      aliveChart: document.getElementById('authorsAliveChart'),
      aliveEmpty: document.getElementById('authorsAliveEmpty'),
      decadeChart: document.getElementById('authorsDecadeChart'),
      decadeEmpty: document.getElementById('authorsDecadeEmpty'),
      topTable: document.getElementById('authorsTopTable'),
      highlights: document.getElementById('authorsHighlights'),
      rolesChart: document.getElementById('authorRolesChart'),
      rolesEmpty: document.getElementById('authorRolesEmpty'),
      collabTable: document.getElementById('authorsCollabTable')
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
      entity: document.getElementById('timelineEntity'),
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
      summary: document.getElementById('timelineSummary')
    }
  };

  const state = {
    activeSection: 'overview',
    sectionLoaded: new Set(),
    charts: new Map(),
    timelineRequestId: 0
  };

  const chartPalette = [
    '#1d3557',
    '#457b9d',
    '#2a9d8f',
    '#f4a261',
    '#e63946',
    '#9d4edd',
    '#6c757d',
    '#0d6efd'
  ];

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
      return;
    }
    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      if (emptyEl) emptyEl.classList.remove('d-none');
      return;
    }
    const chart = new Chart(ctx, config);
    state.charts.set(canvasEl.id, chart);
  };

  const fetchStats = async (path, body, label) => {
    const payload = body && Object.keys(body).length ? body : undefined;
    log('Stats request starting.', { label, path, body: payload || null });
    const response = await apiFetch(path, {
      method: 'GET',
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
            <div class="stat-label">${escapeHtml(item.label)}</div>
            <div class="stat-value">${escapeHtml(formatNumber(item.value))}</div>
          </div>
        </div>
      </div>
    `).join('');
  };

  const renderHighlightCards = (container, items) => {
    if (!container) return;
    container.innerHTML = items.map((item) => {
      const metaLine = item.meta ? `<div class="text-muted small">${escapeHtml(item.meta)}</div>` : '';
      const valueLine = item.value ? `<div class="fw-semibold">${escapeHtml(item.value)}</div>` : '<div class="text-muted">Not enough data</div>';
      const link = item.section
        ? `<button class="btn btn-link p-0 small" type="button" data-section-link="${escapeHtml(item.section)}">View</button>`
        : '';
      return `
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card shadow-sm mini-card h-100">
            <div class="card-body">
              <div class="text-muted small mb-1">${escapeHtml(item.label)}</div>
              ${valueLine}
              ${metaLine}
              ${link ? `<div class="mt-2">${link}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  const renderListItems = (container, items) => {
    if (!container) return;
    if (!items.length) {
      container.innerHTML = '<li class="text-muted">No data available.</li>';
      return;
    }
    container.innerHTML = items.map((item) => {
      const detail = item.detail ? ` <span class="text-muted">${escapeHtml(item.detail)}</span>` : '';
      return `<li class="mb-2"><span class="fw-semibold">${escapeHtml(item.label)}</span>${detail}</li>`;
    }).join('');
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
    const [userStats, authorStats, seriesStats, storageStats, bookTypeStats] = await Promise.all([
      fetchStatsSafe('/users/me/stats', null, 'user-totals'),
      fetchStatsSafe('/author/stats', { fields: ['mostRepresentedAuthor'] }, 'author-highlight'),
      fetchStatsSafe('/bookseries/stats', { fields: ['mostCollectedSeries'] }, 'series-highlight'),
      fetchStatsSafe('/storagelocation/stats', { fields: ['mostUsedLocation'] }, 'storage-highlight'),
      fetchStatsSafe('/booktype/stats', { fields: ['mostCollectedType'] }, 'booktype-highlight')
    ]);

    const totals = [
      { label: 'Books', value: userStats?.books ?? userStats?.totalBooks ?? 0 },
      { label: 'Authors', value: userStats?.authors ?? 0 },
      { label: 'Series', value: userStats?.series ?? 0 },
      { label: 'Publishers', value: userStats?.publishers ?? 0 },
      { label: 'Storage locations', value: userStats?.storageLocations ?? 0 },
      { label: 'Copies', value: userStats?.bookCopies ?? 0 }
    ];
    renderTotals(dom.overview.totals, totals);

    const highlightItems = [
      {
        label: 'Most represented author',
        value: authorStats?.mostRepresentedAuthor?.displayName || '',
        meta: authorStats?.mostRepresentedAuthor?.bookCount !== undefined
          ? `${formatNumber(authorStats.mostRepresentedAuthor.bookCount)} books`
          : '',
        section: 'authors'
      },
      {
        label: 'Most collected series',
        value: seriesStats?.mostCollectedSeries?.name || '',
        meta: seriesStats?.mostCollectedSeries?.bookCount !== undefined
          ? `${formatNumber(seriesStats.mostCollectedSeries.bookCount)} books`
          : '',
        section: 'series'
      },
      {
        label: 'Most used location',
        value: storageStats?.mostUsedLocation?.name || '',
        meta: storageStats?.mostUsedLocation?.copyCount !== undefined
          ? `${formatNumber(storageStats.mostUsedLocation.copyCount)} copies`
          : '',
        section: 'storage'
      },
      {
        label: 'Most collected book type',
        value: bookTypeStats?.mostCollectedType?.name || '',
        meta: bookTypeStats?.mostCollectedType?.bookCount !== undefined
          ? `${formatNumber(bookTypeStats.mostCollectedType.bookCount)} books`
          : '',
        section: 'books'
      }
    ];
    renderHighlightCards(dom.overview.highlights, highlightItems);

    const hasTotals = Boolean(userStats);
    const hasHighlights = highlightItems.some((item) => item.value);
    return hasTotals || hasHighlights;
  };

  const renderBookSection = async () => {
    const [bookStats, bookTypeStats, languageStats, tagStats, bookTagStats] = await Promise.all([
      fetchStatsSafe('/book/stats', {
        fields: [
          'total',
          'withPublicationDate',
          'withCoverImage',
          'withPageCount',
          'withBookType',
          'withLanguages',
          'withPublisher',
          'publicationYearHistogram',
          'oldestPublicationYear',
          'newestPublicationYear',
          'longestBook',
          'shortestBook'
        ]
      }, 'book-stats'),
      fetchStatsSafe('/booktype/stats', { fields: ['bookTypeBreakdown'] }, 'booktype-stats'),
      fetchStatsSafe('/languages/stats', null, 'language-stats'),
      fetchStatsSafe('/tags/stats', null, 'tag-stats'),
      fetchStatsSafe('/booktags/stats', null, 'booktag-stats')
    ]);

    const histogram = Array.isArray(bookStats?.publicationYearHistogram)
      ? [...bookStats.publicationYearHistogram]
      : [];
    histogram.sort((a, b) => (a.year || 0) - (b.year || 0));
    const publicationLabels = histogram.map((entry) => String(entry.year || 'Unknown'));
    const publicationCounts = histogram.map((entry) => Number(entry.bookCount) || 0);
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
      ? bookTypeStats.bookTypeBreakdown
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

    const languageBreakdown = Array.isArray(languageStats?.topLanguages)
      ? languageStats.topLanguages
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

    const tagBreakdown = Array.isArray(tagStats?.topTags)
      ? tagStats.topTags
      : [];
    const tagLabels = tagBreakdown.map((entry) => entry.name);
    const tagCounts = tagBreakdown.map((entry) => Number(entry.count ?? entry.bookCount) || 0);
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
            <div class="stat-label">${escapeHtml(item.label)}</div>
            <div class="stat-value">${escapeHtml(formatNumber(Math.max(item.value, 0)))}</div>
          </div>
        </div>
      `).join('');
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
      highlights.push({
        label: 'Longest book',
        detail: `${bookStats.longestBook.title} (${formatNumber(bookStats.longestBook.pageCount)} pages)`
      });
    }
    if (bookStats?.shortestBook?.title) {
      highlights.push({
        label: 'Shortest book',
        detail: `${bookStats.shortestBook.title} (${formatNumber(bookStats.shortestBook.pageCount)} pages)`
      });
    }
    if (bookTagStats?.untaggedBooks?.count !== undefined) {
      highlights.push({
        label: 'Untagged books',
        detail: formatNumber(bookTagStats.untaggedBooks.count)
      });
    }
    renderListItems(dom.books.highlights, highlights);

    return Boolean(bookStats || bookTypeStats || languageStats || tagStats || bookTagStats);
  };

  const renderAuthorSection = async () => {
    const [authorStats, bookAuthorStats] = await Promise.all([
      fetchStatsSafe('/author/stats', {
        fields: [
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
      ? authorStats.breakdownPerAuthor.slice(0, 6)
      : [];
    const topRows = topAuthors.map((entry) => `
      <tr>
        <td><a href="author-details?id=${encodeURIComponent(entry.id)}">${escapeHtml(entry.displayName || 'Unknown')}</a></td>
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

  const renderSeriesSection = async () => {
    const [seriesStats, seriesBookStats] = await Promise.all([
      fetchStatsSafe('/bookseries/stats', { fields: ['seriesBreakdown', 'breakdownPerSeries', 'mostCollectedSeries'] }, 'series-stats'),
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

    const seriesBreakdown = Array.isArray(seriesStats?.seriesBreakdown)
      ? seriesStats.seriesBreakdown
      : Array.isArray(seriesStats?.breakdownPerSeries)
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
      <tr>
        <td><a href="series-details?id=${encodeURIComponent(entry.id)}">${escapeHtml(entry.name || 'Unknown')}</a></td>
        <td class="text-end">${escapeHtml(formatNumber(entry.bookCount))}</td>
        <td class="text-end">${escapeHtml(formatNumber(entry.gapCount ?? 0))}</td>
      </tr>
    `);
    renderTableRows(dom.series.breakdownTable, breakdownRows, 3);

    return Boolean(seriesStats || seriesBookStats);
  };

  const renderStorageSection = async () => {
    const storageStats = await fetchStatsSafe('/storagelocation/stats', { fields: ['locationBreakdown', 'mostUsedLocation'] }, 'storage-stats');
    const breakdown = Array.isArray(storageStats?.locationBreakdown)
      ? storageStats.locationBreakdown
      : [];
    const topLocations = breakdown.slice(0, 8);
    const locationLabels = topLocations.map((entry) => entry.name);
    const copyCounts = topLocations.map((entry) => Number(entry.copyCount) || 0);
    const directCounts = topLocations.map((entry) => Number(entry.directCopyCount) || 0);
    const nestedCounts = topLocations.map((entry) => Number(entry.nestedCopyCount) || 0);
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
      const mostUsed = storageStats?.mostUsedLocation;
      if (mostUsed?.name) {
        dom.storage.highlights.innerHTML = `
          <div class="stat-label">${escapeHtml(mostUsed.name)}</div>
          <div class="stat-value">${escapeHtml(formatNumber(mostUsed.copyCount))}</div>
          <div class="text-muted small">Direct: ${escapeHtml(formatNumber(mostUsed.directCopyCount ?? 0))} | Nested: ${escapeHtml(formatNumber(mostUsed.nestedCopyCount ?? 0))}</div>
          <div class="mt-3">
            <a class="btn btn-sm btn-outline-secondary" href="storage-locations?id=${encodeURIComponent(mostUsed.id)}">Open location</a>
          </div>
        `;
      } else {
        dom.storage.highlights.innerHTML = '<div class="text-muted">No storage data yet.</div>';
      }
    }

    const breakdownRows = breakdown.map((entry) => `
      <tr>
        <td><a href="storage-locations?id=${encodeURIComponent(entry.id)}">${escapeHtml(entry.name || 'Unknown')}</a></td>
        <td class="text-end">${escapeHtml(formatNumber(entry.copyCount))}</td>
        <td class="text-end">${escapeHtml(formatNumber(entry.directCopyCount ?? 0))}</td>
        <td class="text-end">${escapeHtml(formatNumber(entry.nestedCopyCount ?? 0))}</td>
      </tr>
    `);
    renderTableRows(dom.storage.breakdownTable, breakdownRows, 4);

    return Boolean(storageStats);
  };

  const timelineEntities = [
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
          <div class="stat-label">${escapeHtml(item.label)}</div>
          <div class="stat-value">${escapeHtml(formatNumber(item.value))}</div>
        </div>
      </div>
    `).join('');
  };

  const renderTimelineChart = (payload) => {
    const buckets = Array.isArray(payload?.buckets) ? payload.buckets : [];
    const labels = buckets.map((bucket) => bucket.label || bucket.start);
    const counts = buckets.map((bucket) => Number(bucket.count) || 0);
    const onClick = (index) => {
      const bucket = buckets[index];
      if (!bucket) return;
      if (payload?.entity === 'books' && payload?.field === 'datePublished') {
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
    const selectedEntity = dom.timeline.entity?.value || 'books';
    const entityConfig = timelineEntities.find((entry) => entry.value === selectedEntity) || timelineEntities[0];
    if (!dom.timeline.field) return;
    dom.timeline.field.innerHTML = entityConfig.fields
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
  };

  const runTimeline = async () => {
    if (!dom.timeline.runBtn) return;
    setFeedback('');
    if (dom.timeline.error) dom.timeline.error.classList.add('d-none');
    if (dom.timeline.runSpinner) dom.timeline.runSpinner.classList.remove('d-none');
    dom.timeline.runBtn.disabled = true;

    const requestId = ++state.timelineRequestId;
    const mode = dom.timeline.mode?.value || 'auto';
    const payload = {
      entity: dom.timeline.entity?.value || 'books',
      field: dom.timeline.field?.value || 'datePublished',
      auto: mode === 'auto',
      hideEmptyBuckets: Boolean(dom.timeline.hideEmpty?.checked)
    };

    if (mode === 'auto') {
      const buckets = Number(dom.timeline.buckets?.value);
      if (Number.isFinite(buckets) && buckets > 0) {
        payload.numberOfBuckets = buckets;
      }
    } else {
      payload.start = dom.timeline.start?.value || '';
      payload.end = dom.timeline.end?.value || '';
      payload.step = Number(dom.timeline.step?.value || 1);
      payload.stepUnit = dom.timeline.stepUnit?.value || 'year';
    }

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
        warn('Timeline request failed.', { status: response.status, data });
        return;
      }
      log('Timeline response received.', { buckets: data.buckets?.length || data.data?.buckets?.length });
      const payloadData = data.data || data;
      renderTimelineChart(payloadData);
      renderTimelineSummary(payloadData);
      if (dom.timeline.chartEmpty) dom.timeline.chartEmpty.classList.toggle('d-none', Array.isArray(payloadData.buckets) && payloadData.buckets.length > 0);
    } catch (error) {
      errorLog('Timeline request error.', error);
      if (dom.timeline.error) {
        dom.timeline.error.textContent = 'Unable to build timeline right now. Please try again soon.';
        dom.timeline.error.classList.remove('d-none');
      }
    } finally {
      if (dom.timeline.runSpinner) dom.timeline.runSpinner.classList.add('d-none');
      dom.timeline.runBtn.disabled = false;
    }
  };

  const renderTimelineSection = async () => {
    if (dom.timeline.entity) {
      dom.timeline.entity.innerHTML = timelineEntities
        .map((entry) => `<option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>`)
        .join('');
      updateTimelineFields();
      updateTimelineMode();
    }

    if (dom.timeline.chartEmpty) {
      dom.timeline.chartEmpty.classList.remove('d-none');
    }
    return true;
  };

  const sectionLoaders = {
    overview: renderOverviewSection,
    books: renderBookSection,
    authors: renderAuthorSection,
    series: renderSeriesSection,
    storage: renderStorageSection,
    timeline: renderTimelineSection
  };

  const showSection = async (sectionKey, { force = false } = {}) => {
    if (!sectionLoaders[sectionKey]) return;
    setActiveSection(sectionKey);
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
    await showSection(state.activeSection, { force: true });
    if (dom.refreshSpinner) dom.refreshSpinner.classList.add('d-none');
    if (dom.refreshBtn) dom.refreshBtn.disabled = false;
  };

  const attachEvents = () => {
    dom.navButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const section = button.dataset.section;
        if (!section || section === state.activeSection) return;
        showSection(section);
      });
    });

    if (dom.refreshBtn) {
      dom.refreshBtn.addEventListener('click', handleRefresh);
    }

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-section-link]');
      if (!target) return;
      const section = target.getAttribute('data-section-link');
      if (!section) return;
      event.preventDefault();
      showSection(section);
    });

    if (dom.timeline.entity) {
      dom.timeline.entity.addEventListener('change', () => {
        updateTimelineFields();
      });
    }

    if (dom.timeline.mode) {
      dom.timeline.mode.addEventListener('change', updateTimelineMode);
    }

    if (dom.timeline.runBtn) {
      dom.timeline.runBtn.addEventListener('click', runTimeline);
    }
  };

  const init = async () => {
    log('Initializing statistics page.');
    if (window.rateLimitGuard?.hasReset && window.rateLimitGuard.hasReset()) {
      window.rateLimitGuard.showModal({ modalId: 'rateLimitModal' });
      return;
    }
    attachEvents();
    await showModal('pageLoadingModal', { backdrop: 'static', keyboard: false });
    await showSection(state.activeSection, { force: true });
    await hideModal('pageLoadingModal');
  };

  document.addEventListener('DOMContentLoaded', init);
})();
