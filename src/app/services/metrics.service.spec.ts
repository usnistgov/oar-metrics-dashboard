import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MetricsService } from './metrics.service';

/** Verifies the cross-reload persistence (sessionStorage list + localStorage records). */
describe('MetricsService persistence', () => {
  const LIST_KEY = 'metrics.datasets.v1';
  const RECORDS_KEY = 'metrics.records.v1';

  function configure() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(HttpTestingController);
  }

  // A single-page dataset response (count <= page size => only one page is fetched).
  function flushDatasetList(http: HttpTestingController) {
    const req = http.expectOne((r) => r.url.includes('usagemetrics/records'));
    req.flush({
      DataSetMetricsCount: 2,
      DataSetMetrics: [
        { ediid: 'ark:/88434/mds2-a', record_download: 10, last_time_logged: '2026-01-01T00:00:00' },
        { ediid: 'ark:/88434/mds2-b', record_download: 5, last_time_logged: '2026-01-02T00:00:00' },
      ],
    });
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('writes the dataset list to sessionStorage on first load', () => {
    const http = configure();
    TestBed.inject(MetricsService).datasetMetrics$.subscribe();
    flushDatasetList(http);
    expect(sessionStorage.getItem(LIST_KEY)).toBeTruthy();
    http.verify();
  });

  it('serves the dataset list from sessionStorage on reload (no HTTP)', () => {
    // First load → fetch + persist.
    const http1 = configure();
    TestBed.inject(MetricsService).datasetMetrics$.subscribe();
    flushDatasetList(http1);
    http1.verify();

    // Simulate a browser reload: brand-new injector + service instance.
    TestBed.resetTestingModule();
    const http2 = configure();
    let emitted: unknown[] | undefined;
    TestBed.inject(MetricsService).datasetMetrics$.subscribe((d) => (emitted = d));

    http2.expectNone((r) => r.url.includes('usagemetrics/records')); // served from cache
    expect(emitted?.length).toBe(2);
  });

  it('persists a fetched record to localStorage and reuses it on reload (no HTTP)', (done) => {
    const http1 = configure();
    const svc1 = TestBed.inject(MetricsService);
    svc1.record('ark:/a').subscribe();
    http1.expectOne((r) => r.url.includes('records/ark:/a')).flush({
      ResultData: [{ title: 'Hello', doi: 'doi:10.1/x' }],
    });

    // The write is debounced (~800ms); wait it out, then "reload".
    setTimeout(() => {
      expect(localStorage.getItem(RECORDS_KEY)).toBeTruthy();
      http1.verify();

      TestBed.resetTestingModule();
      const http2 = configure();
      const svc2 = TestBed.inject(MetricsService);
      let rec: { title?: string } | null = null;
      svc2.record('ark:/a').subscribe((r) => (rec = r));
      http2.expectNone((r) => r.url.includes('records/ark:/a')); // reused from localStorage
      expect(rec).toEqual(expect.objectContaining({ title: 'Hello' }));
      done();
    }, 1000);
  });
});

/** Verifies the catalog search request, field mapping, and error fallback. */
describe('MetricsService searchRecords', () => {
  function configure() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('issues a GET to records?searchphrase= with the phrase URL-encoded', () => {
    const http = configure();
    const svc = TestBed.inject(MetricsService);

    svc.searchRecords('foo bar/baz').subscribe();

    const req = http.expectOne(
      (r) => r.url.includes('records?searchphrase=') && r.url.includes('foo%20bar%2Fbaz'),
    );
    expect(req.request.method).toBe('GET');
    req.flush({ ResultData: [] });
    http.verify();
  });

  it('maps each result to { ediid, title, doi, domains } and drops rows without an ediid', () => {
    const http = configure();
    const svc = TestBed.inject(MetricsService);

    let results: any[] | undefined;
    svc.searchRecords('x').subscribe((r) => (results = r));

    http.expectOne((r) => r.url.includes('records?searchphrase=')).flush({
      ResultData: [
        // Has ediid, doi: prefix stripped, domains from topic tags (trimmed + de-duplicated).
        {
          ediid: 'ark:/1',
          title: 'First',
          doi: 'doi:10.1/a',
          topic: [{ tag: 'Chemistry' }, { tag: ' Chemistry ' }, { tag: 'Physics' }],
          theme: ['ShouldBeIgnored'],
        },
        // No ediid -> dropped.
        { title: 'Orphan', topic: [{ tag: 'Biology' }] },
        // No topic tags -> domains fall back to theme[]; title falls back to ediid when missing.
        { ediid: 'ark:/2', theme: ['Math', ' Math ', 'Stats'] },
      ],
    });

    expect(results?.length).toBe(2);
    expect(results?.[0]).toEqual({
      ediid: 'ark:/1',
      title: 'First',
      doi: '10.1/a',
      domains: ['Chemistry', 'Physics'],
    });
    expect(results?.[1]).toEqual({
      ediid: 'ark:/2',
      title: 'ark:/2',
      doi: undefined,
      domains: ['Math', 'Stats'],
    });
    http.verify();
  });

  it('returns an empty array on HTTP error', () => {
    const http = configure();
    const svc = TestBed.inject(MetricsService);

    let results: any[] | undefined;
    svc.searchRecords('x').subscribe((r) => (results = r));

    http
      .expectOne((r) => r.url.includes('records?searchphrase='))
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(results).toEqual([]);
    http.verify();
  });
});

/** Verifies the dataset list collapses duplicate ediids, keeping the higher-download row. */
describe('MetricsService dedupe', () => {
  function configure() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('collapses duplicate ediids to the higher-download row and keeps distinct rows', () => {
    const http = configure();
    let emitted: any[] | undefined;

    TestBed.inject(MetricsService).datasetMetrics$.subscribe((d) => (emitted = d));

    // dedupeByEdiid runs only on the multi-page path, so make the total span two pages
    // (count 101 > page size 100). Page 1 holds the duplicate + distinct row; page 2 holds
    // the higher-download duplicate of the same ediid.
    const page1 = http.expectOne((r) => r.url.includes('usagemetrics/records') && r.params.get('page') === '1');
    page1.flush({
      DataSetMetricsCount: 101,
      DataSetMetrics: [
        { ediid: 'ark:/88434/dup', record_download: 3, last_time_logged: '2026-01-01T00:00:00' },
        { ediid: 'ark:/88434/solo', record_download: 1, last_time_logged: '2026-01-03T00:00:00' },
      ],
    });

    const page2 = http.expectOne((r) => r.url.includes('usagemetrics/records') && r.params.get('page') === '2');
    page2.flush({
      DataSetMetricsCount: 101,
      DataSetMetrics: [
        { ediid: 'ark:/88434/dup', record_download: 9, last_time_logged: '2026-01-02T00:00:00' },
      ],
    });

    expect(emitted?.length).toBe(2);
    const dup = emitted?.find((r) => r.ediid === 'ark:/88434/dup');
    const solo = emitted?.find((r) => r.ediid === 'ark:/88434/solo');
    expect(dup?.record_download).toBe(9);
    expect(solo?.record_download).toBe(1);
    http.verify();
  });
});

/** Verifies the monthly repo-metrics stream: fetch + cache write, passive cache reuse, error fallback. */
describe('MetricsService repoMetrics$', () => {
  const REPO_KEY = 'metrics.repo.v1';

  function configure() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('fetches repo metrics, clears the error flag, stamps lastUpdated, and caches to sessionStorage', () => {
    const http = configure();
    const svc = TestBed.inject(MetricsService);

    let emitted: unknown[] | undefined;
    svc.repoMetrics$.subscribe((d) => (emitted = d));

    http.expectOne((r) => r.url.includes('usagemetrics/repo')).flush({
      RepoMetrics: [{ month_year: 'January 2025', total_size: 10, success_download: 2, unique_users: 1 }],
    });

    expect(emitted?.length).toBe(1);
    expect(svc.repoError()).toBe(false);
    expect(svc.lastUpdated()).not.toBeNull();
    expect(sessionStorage.getItem(REPO_KEY)).toBeTruthy();
    http.verify();
  });

  it('serves repo metrics from a fresh sessionStorage cache without an HTTP call', () => {
    sessionStorage.setItem(
      REPO_KEY,
      JSON.stringify({
        v: 2,
        savedAt: Date.now(),
        data: [{ month_year: 'June 2025', total_size: 0, success_download: 1, unique_users: 1 }],
      }),
    );

    const http = configure();
    let emitted: unknown[] | undefined;
    TestBed.inject(MetricsService).repoMetrics$.subscribe((d) => (emitted = d));

    http.expectNone((r) => r.url.includes('usagemetrics/repo'));
    expect(emitted?.length).toBe(1);
  });

  it('sets repoError and emits [] on HTTP error', () => {
    jest.useFakeTimers();
    try {
      const http = configure();
      const svc = TestBed.inject(MetricsService);

      let emitted: unknown[] | undefined;
      svc.repoMetrics$.subscribe((d) => (emitted = d));

      // The request retries 3 times (delay 800ms) before giving up; fail every attempt.
      for (let attempt = 0; attempt < 4; attempt++) {
        http
          .expectOne((r) => r.url.includes('usagemetrics/repo'))
          .flush('boom', { status: 500, statusText: 'Server Error' });
        jest.advanceTimersByTime(800);
      }

      expect(svc.repoError()).toBe(true);
      expect(emitted).toEqual([]);
      http.verify();
    } finally {
      jest.useRealTimers();
    }
  });
});

/** Verifies a hard refresh drops the caches, shows the loader, refetches, and clears the spinner. */
describe('MetricsService refresh (hard)', () => {
  const LIST_KEY = 'metrics.datasets.v1';

  function configure() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('drops the list cache synchronously, resets ready/refreshing, and refetches', () => {
    const http = configure();
    const svc = TestBed.inject(MetricsService);
    svc.datasetMetrics$.subscribe();

    http.expectOne((r) => r.url.includes('usagemetrics/records')).flush({
      DataSetMetricsCount: 1,
      DataSetMetrics: [{ ediid: 'ark:/88434/mds2-a', record_download: 1 }],
    });
    expect(sessionStorage.getItem(LIST_KEY)).toBeTruthy();

    svc.refresh();
    expect(svc.refreshing()).toBe(true);
    expect(svc.ready()).toBe(false);
    expect(sessionStorage.getItem(LIST_KEY)).toBeNull(); // cache dropped up front

    // The hard refresh re-pulls the list; completion clears the spinner and rewrites the cache.
    http.expectOne((r) => r.url.includes('usagemetrics/records')).flush({
      DataSetMetricsCount: 1,
      DataSetMetrics: [{ ediid: 'ark:/88434/mds2-a', record_download: 2 }],
    });
    expect(svc.refreshing()).toBe(false);
    expect(sessionStorage.getItem(LIST_KEY)).toBeTruthy();
    http.verify();
  });
});

/** Verifies record() degrades to null on error, and the collection rollup/detail joins. */
describe('MetricsService records and collections', () => {
  function configure() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('record() emits null when the metadata fetch fails', () => {
    const http = configure();
    const svc = TestBed.inject(MetricsService);

    let rec: unknown = 'unset';
    svc.record('ark:/x').subscribe((r) => (rec = r));

    http
      .expectOne((r) => r.url.includes('records/ark:/x'))
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(rec).toBeNull();
    http.verify();
  });

  it('discovers collections, joins members against the dataset list, and rolls up usage', () => {
    const http = configure();
    const svc = TestBed.inject(MetricsService);

    let cols: any[] | undefined;
    svc.collectionMetrics$.subscribe((c) => (cols = c));

    // Dataset list (the join source).
    http.expectOne((r) => r.url.includes('usagemetrics/records')).flush({
      DataSetMetricsCount: 2,
      DataSetMetrics: [
        { ediid: 'ark:/88434/a', record_download: 100, total_size_download: 1000, number_users: 10 },
        { ediid: 'ark:/88434/b', record_download: 50, total_size_download: 500, number_users: 5 },
      ],
    });
    // Collection discovery by @type.
    http
      .expectOne((r) => r.url.includes('rmm/records') && r.url.includes('type='))
      .flush({ ResultData: [{ '@id': 'col1', title: 'One Collection', ediid: 'ediidcol1' }] });
    // Members of col1.
    http
      .expectOne((r) => r.url.includes('isPartOf'))
      .flush({ ResultData: [{ ediid: 'ark:/88434/a' }, { ediid: 'ark:/88434/b' }] });

    expect(cols?.length).toBe(1);
    expect(cols?.[0]).toEqual(
      expect.objectContaining({
        id: 'col1',
        title: 'One Collection', // normalized: trailing "Collection" is not doubled
        memberCount: 2,
        membersWithUsage: 2,
        downloads: 150,
        size: 1500,
        users: 15,
      }),
    );
    http.verify();
  });

  it('collectionDetail() emits null for an unknown collection id', () => {
    const http = configure();
    const svc = TestBed.inject(MetricsService);

    let detail: unknown = 'unset';
    svc.collectionDetail('nope').subscribe((d) => (detail = d));

    http
      .expectOne((r) => r.url.includes('usagemetrics/records'))
      .flush({ DataSetMetricsCount: 0, DataSetMetrics: [] });
    http
      .expectOne((r) => r.url.includes('rmm/records') && r.url.includes('type='))
      .flush({ ResultData: [] });

    expect(detail).toBeNull();
    http.verify();
  });
});

/** Verifies a page-1 failure surfaces datasetError and degrades to an empty list. */
describe('MetricsService dataset load failure', () => {
  function configure() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('sets datasetError and emits [] when the first page fails', () => {
    const http = configure();
    const svc = TestBed.inject(MetricsService);

    let emitted: unknown[] | undefined;
    jest.useFakeTimers();
    try {
      svc.datasetMetrics$.subscribe((d) => (emitted = d));

      // Page 1 retries 3 times (delay 800ms) before the load gives up; fail every attempt.
      for (let attempt = 0; attempt < 4; attempt++) {
        http
          .expectOne((r) => r.url.includes('usagemetrics/records'))
          .flush('boom', { status: 500, statusText: 'Server Error' });
        jest.advanceTimersByTime(800);
      }

      expect(svc.datasetError()).toBe(true);
      expect(emitted).toEqual([]);
      expect(svc.refreshing()).toBe(false); // finalize() always clears the spinner
      http.verify();
    } finally {
      jest.useRealTimers();
    }
  });
});

/** Verifies the DataCite DOI-resolution check (200 keep, 404 drop, other errors inconclusive-keep). */
describe('MetricsService doiResolves', () => {
  const DC = 'api.datacite.org/dois/';

  function configure() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('returns false immediately for an empty DOI (no HTTP)', () => {
    const http = configure();
    let ok: boolean | undefined;
    TestBed.inject(MetricsService).doiResolves('').subscribe((v) => (ok = v));
    http.expectNone(() => true);
    expect(ok).toBe(false);
  });

  it('returns true when DataCite returns the DOI (200)', () => {
    const http = configure();
    let ok: boolean | undefined;
    TestBed.inject(MetricsService).doiResolves('10.18434/mds2-2388').subscribe((v) => (ok = v));
    http.expectOne((r) => r.url.includes(DC + '10.18434/mds2-2388')).flush({ data: {} });
    expect(ok).toBe(true);
    http.verify();
  });

  it('returns false when DataCite does not know the DOI (404)', () => {
    const http = configure();
    let ok: boolean | undefined;
    TestBed.inject(MetricsService).doiResolves('10.1/missing').subscribe((v) => (ok = v));
    http
      .expectOne((r) => r.url.includes(DC + '10.1/missing'))
      .flush(null, { status: 404, statusText: 'Not Found' });
    expect(ok).toBe(false);
    http.verify();
  });

  it('returns true on an inconclusive error (5xx) rather than hiding the dataset', () => {
    const http = configure();
    let ok: boolean | undefined;
    TestBed.inject(MetricsService).doiResolves('10.1/flaky').subscribe((v) => (ok = v));
    http
      .expectOne((r) => r.url.includes(DC + '10.1/flaky'))
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    expect(ok).toBe(true);
    http.verify();
  });

  it('caches the result per DOI (second call makes no HTTP request)', () => {
    const http = configure();
    const svc = TestBed.inject(MetricsService);
    svc.doiResolves('10.1/x').subscribe();
    http.expectOne((r) => r.url.includes(DC + '10.1/x')).flush({ data: {} });

    let ok: boolean | undefined;
    svc.doiResolves('10.1/x').subscribe((v) => (ok = v));
    http.expectNone((r) => r.url.includes(DC + '10.1/x'));
    expect(ok).toBe(true);
    http.verify();
  });
});

/** Verifies the no-flash reveal: both base caches fresh -> ready flips true in the constructor. */
describe('MetricsService no-flash reveal', () => {
  const REPO_KEY = 'metrics.repo.v1';
  const LIST_KEY = 'metrics.datasets.v1';

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('is ready synchronously (no subscription) when both base caches are fresh', () => {
    const envelope = (data: unknown) => JSON.stringify({ v: 2, savedAt: Date.now(), data });
    sessionStorage.setItem(REPO_KEY, envelope([{ month_year: 'January 2025' }]));
    sessionStorage.setItem(LIST_KEY, envelope([{ ediid: 'a', record_download: 1 }]));

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    expect(TestBed.inject(MetricsService).ready()).toBe(true);
  });
});

/** Verifies dedupe edge cases: rows without an ediid are kept, and ties break by recency. */
describe('MetricsService dedupe edges', () => {
  function configure() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('drops rows without a real dataset id and, on equal downloads, keeps the more recent row', () => {
    const http = configure();
    let emitted: any[] | undefined;
    TestBed.inject(MetricsService).datasetMetrics$.subscribe((d) => (emitted = d));

    // Multi-page (count 101 > page size 100) so dedupeByEdiid runs.
    http
      .expectOne((r) => r.url.includes('usagemetrics/records') && r.params.get('page') === '1')
      .flush({
        DataSetMetricsCount: 101,
        DataSetMetrics: [
          { ediid: 'ark:/88434/tie', record_download: 7, last_time_logged: '2026-01-01T00:00:00' },
          { record_download: 3 }, // no ediid -> dropped by cleanDatasets
        ],
      });
    http
      .expectOne((r) => r.url.includes('usagemetrics/records') && r.params.get('page') === '2')
      .flush({
        DataSetMetricsCount: 101,
        DataSetMetrics: [
          // Same downloads as page-1 'tie' but newer -> wins on the recency tie-break.
          { ediid: 'ark:/88434/tie', record_download: 7, last_time_logged: '2026-06-01T00:00:00' },
        ],
      });

    const tie = emitted?.find((r) => r.ediid === 'ark:/88434/tie');
    const noId = emitted?.filter((r) => !r.ediid);
    expect(tie?.last_time_logged).toBe('2026-06-01T00:00:00');
    expect(noId?.length).toBe(0); // non-dataset rows are cleaned out
    http.verify();
  });
});
