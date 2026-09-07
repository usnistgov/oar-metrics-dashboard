import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  Observable,
  catchError,
  combineLatest,
  concatMap,
  finalize,
  first,
  from,
  map,
  mergeMap,
  of,
  shareReplay,
  switchMap,
  tap,
  timeout,
  timer,
  toArray,
} from 'rxjs';
import { ConfigService } from './config.service';
import {
  CatalogCoverage,
  CatalogQueryResponse,
  CollectionDetail,
  CollectionMembership,
  CollectionMetric,
  DataSetMetric,
  DataSetMetricsResponse,
  DatasetSearchResult,
  RecordResult,
  RecordsResponse,
  RepoMetric,
  RepoMetricsResponse,
} from '../models/metrics.models';
import { buildCollectionDetail, rollupCollections } from '../collection-stats';

/** How a (re)load was triggered. */
type RefreshKind =
  | 'passive' // initial load / bootstrap - reuse persisted caches if still fresh
  | 'soft'    // auto-refresh tick - refetch the base lists, KEEP the record cache
  | 'hard';   // manual refresh - refetch everything and DROP all caches

/**
 * Single source of truth for all dashboard data.
 *
 * - Base data is fetched once and shared via `shareReplay`; widgets read the same response.
 * - The full dataset list (`/usagemetrics/records`) is paginated and sorted client-side (the server
 *   sort is broken - see `docs/oar-rmm-metrics-sort-bug.md` / {@link fetchAllDatasets}).
 * - Per-dataset metadata (`/records/{ediid}`) is cached per ediid (resolves title/doi/theme/topic).
 *
 * Caches survive a browser reload (the slow part is the per-record API at ~2s each):
 * - Record metadata → `localStorage` (static; long TTL). A reload reuses it → no spinner.
 * - Base lists → `sessionStorage` (per-tab; {@link REFRESH_MS} TTL). A reload within the TTL skips
 *   the multi-page fetch.
 *
 * Auto-refreshes every 10 minutes; the toolbar button calls {@link refresh} for a hard refresh.
 */
@Injectable({ providedIn: 'root' })
export class MetricsService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  // Auto-refresh interval + base-list cache TTL, from runtime config (minutes), default 10, min 1.
  private readonly REFRESH_MS = Math.max(1, Number(this.config.get('autoRefreshMinutes')) || 10) * 60 * 1000;
  private readonly RECORD_TTL_MS = 24 * 60 * 60 * 1000; // persisted record metadata TTL (static data)
  private readonly REQUEST_TIMEOUT_MS = 10_000;       // per-request timeout so one slow call can't stall a card
  private readonly PAGE_SIZE = 100;                   // server's max page size
  private readonly PAGE_CONCURRENCY = 3;              // max parallel page requests while paginating (gentle on rate limits)

  private readonly MAX_PAGES = 50;                    // safety cap (50 * 100 = 5,000 datasets)

  // Storage. Bump STORE_VERSION when a payload shape changes (invalidates old caches).
  private static readonly STORE_VERSION = 1;
  private static readonly REPO_KEY = 'metrics.repo.v1';
  private static readonly LIST_KEY = 'metrics.datasets.v1';
  private static readonly RECORDS_KEY = 'metrics.records.v1';
  private static readonly COLLECTIONS_KEY = 'metrics.collections.v1';
  private static readonly CATALOG_KEY = 'metrics.catalog.v3'; // v3: added @id to the projection

  /** NERDm `@type` that marks a resource as a collection (see docs/09-collections.md). */
  private static readonly COLLECTION_TYPE = 'nrda:ScienceTheme';
  private static readonly MAX_COLLECTION_MEMBERS = 500; // one page is plenty (largest collection ~79)


  private readonly repoUrl = this.config.get('apiURLRepo');
  private readonly usageUrl = this.config.get('apiURLUsageRecord');
  private readonly recordsUrl = this.config.get('apiURLRecords');
  private readonly dataciteApi = this.config.get('dataciteApi');

  /** Fires on first subscription and on every (auto/manual) refresh, carrying the trigger kind. */
  private readonly refresh$ = new BehaviorSubject<RefreshKind>('passive');

  /** In-flight / resolved record observables, keyed by ediid (per session). */
  private readonly recordCache = new Map<string, Observable<RecordResult | null>>();
  /** Resolved record values mirrored to localStorage; hydrated once on startup. */
  private readonly persistedRecords = new Map<string, RecordResult>();
  private recordsFlushHandle?: ReturnType<typeof setTimeout>;
  private recordsDirty = false;

  /** In-flight / resolved "is this DOI registered in DataCite?" checks, keyed by bare DOI. */
  private readonly doiCache = new Map<string, Observable<boolean>>();

  /** When the base data was last (re)loaded - drives the toolbar "Updated …" indicator. */
  readonly lastUpdated = signal<Date | null>(null);
  readonly repoError = signal(false);
  readonly datasetError = signal(false);
  readonly catalogError = signal(false);
  /** True while a manual hard refresh is re-pulling the base data (drives the toolbar spinner). */
  readonly refreshing = signal(false);
  /** Flips true once the base data (repo + dataset list) is ready - drives the initial load screen. */
  readonly ready = signal(false);

  /**
   * Whether to reconcile usage against the catalog (fold ark @id / ediid / legacy-hex aliases to the
   * canonical ediid, merge + sum). Persisted; default on. Toggled from Settings. When off, the
   * reconciled stream passes the raw deduped usage through unchanged.
   */
  readonly reconcileEnabled = signal<boolean>(localStorage.getItem('metrics.reconcile.enabled') !== 'false');

  setReconcileEnabled(enabled: boolean): void {
    this.reconcileEnabled.set(enabled);
    localStorage.setItem('metrics.reconcile.enabled', String(enabled));
  }

  /** Monthly repository aggregates (size/downloads/users per month) - shared by the 3 charts. */
  readonly repoMetrics$: Observable<RepoMetric[]> = this.refresh$.pipe(
    switchMap((kind) => this.loadRepoMetrics(kind)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * The FULL dataset list - shared by most-popular / latest-downloads / science-domains / datacite.
   * Each widget sorts this client-side (downloads or recency) and slices the top-N it needs, so the
   * rankings are globally correct regardless of the server's (broken) sort.
   */
  readonly datasetMetrics$: Observable<DataSetMetric[]> = this.refresh$.pipe(
    switchMap((kind) => this.loadDatasets(kind)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * The full catalog trimmed to domain-bearing fields (ediid + topic + theme). Bulk-fetched in pages
   * and cached; powers the Science Domains card repo-wide (and per-collection by filtering on ediid),
   * instead of resolving records one-by-one. Lazy: only pulled once something subscribes.
   */
  readonly catalogRecords$: Observable<RecordResult[]> = this.refresh$.pipe(
    switchMap((kind) => this.loadCatalogRecords(kind)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * Usage reconciled against the catalog: re-key each usage row to the record's canonical `ediid`
   * (the ingester logs usage under whichever id the download URL used - the ark @id, the ediid, or a
   * legacy hex), then merge rows that resolve to the same record, summing the counts. Fixes
   * double-counting and phantom off-catalog rows. Degrades to plain dedupe when the catalog is
   * unavailable. TEMPORARY client-side mitigation; the real fix belongs in the metrics ingester.
   */
  readonly reconciledDatasets$: Observable<DataSetMetric[]> = combineLatest([
    this.datasetMetrics$,
    this.catalogRecords$,
    toObservable(this.reconcileEnabled),
  ]).pipe(
    map(([usage, catalog, enabled]) => (enabled ? this.reconcileUsage(usage, catalog) : usage)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * Catalog datasets with NO recorded usage: every catalog record whose ediid is absent from the
   * reconciled usage list. Published but never downloaded/logged. Powers the "Untracked Datasets"
   * card; sorted by title.
   */
  readonly untrackedDatasets$: Observable<RecordResult[]> = combineLatest([
    this.catalogRecords$,
    this.reconciledDatasets$,
  ]).pipe(
    map(([catalog, usage]) => {
      const tracked = new Set(usage.map((d) => d.ediid));
      return catalog
        .filter((r) => r.ediid && !tracked.has(r.ediid))
        .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * Coverage of the published catalog by usage, computed on reconciled ids so aliases don't inflate
   * the gap. Drives the Untracked card's summary and the Datasets tracked KPI bar.
   */
  readonly catalogCoverage$: Observable<CatalogCoverage> = combineLatest([
    this.catalogRecords$,
    this.reconciledDatasets$,
  ]).pipe(
    map(([catalog, usage]) => {
      const tracked = new Set(usage.map((d) => d.ediid));
      const catalogIds = new Set(catalog.map((r) => r.ediid).filter(Boolean));
      const withUsage = catalog.filter((r) => r.ediid && tracked.has(r.ediid)).length;
      const offCatalog = usage.filter((d) => !catalogIds.has(d.ediid)).length;
      return {
        catalog: catalog.length,
        withUsage,
        untracked: catalog.length - withUsage,
        offCatalog,
        coverage: catalog.length ? withUsage / catalog.length : 0,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * Off-catalog datasets: reconciled usage rows whose canonical ediid is still NOT in the catalog
   * (genuinely withdrawn/removed). Sorted by downloads. Backs the off-catalog modal on the Untracked card.
   */
  readonly offCatalogDatasets$: Observable<DataSetMetric[]> = combineLatest([
    this.reconciledDatasets$,
    this.catalogRecords$,
  ]).pipe(
    map(([usage, catalog]) => {
      const catalogIds = new Set(catalog.map((r) => r.ediid).filter(Boolean));
      return usage
        .filter((d) => !catalogIds.has(d.ediid))
        .sort((a, b) => (b.record_download ?? 0) - (a.record_download ?? 0));
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private get usageFilesUrl(): string {
    return this.usageUrl.replace(/\/records$/, '/files');
  }

  /**
   * TEMP: find the catalog record that re-published a withdrawn dataset's files under a NEW id (a
   * rename not linked via @id, so reconciliation cannot fold it). Looks the dataset's files up in the
   * usage file-metrics, then searches the catalog for a record with a matching file component.
   * Returns the new @id/ediid or null. Called on demand (off-catalog modal), so it only fires when a
   * gap exists. Remove once the ingester stores canonical ediids.
   */
  republishedId(ediid: string): Observable<string | null> {
    return this.http.get<Record<string, unknown>>(`${this.usageFilesUrl}/${encodeURIComponent(ediid)}`).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      map((r) => {
        const arr = (r['FilesMetrics'] ?? r['FileMetrics'] ?? r['DataSetMetrics'] ?? r['ResultData'] ?? []) as Array<{
          filepath?: string;
          filePath?: string;
        }>;
        const rels = arr
          .map((f) => String(f.filepath ?? f.filePath ?? ''))
          .map((fp) => fp.replace(/^[^/]+\//, '')) // strip the "<ediid>/" prefix
          .filter((fp) => fp && fp !== ediid && !fp.endsWith('.sha256'));
        return Array.from(new Set(rels)).slice(0, 3);
      }),
      switchMap((rels) =>
        rels.length === 0
          ? of<string | null>(null)
          : from(rels).pipe(
              concatMap((rel) =>
                this.http
                  .get<{ ResultData?: RecordResult[] }>(this.recordsUrl, {
                    params: { 'components.filepath': rel, include: 'ediid,@id' },
                  })
                  .pipe(
                    timeout(this.REQUEST_TIMEOUT_MS),
                    map((res) => {
                      const rec = res?.ResultData?.[0];
                      return rec ? ((rec['@id'] ?? rec.ediid) ?? null) : null;
                    }),
                    catchError(() => of<string | null>(null)),
                  ),
              ),
              first((id): id is string => !!id, null),
            ),
      ),
      catchError(() => of<string | null>(null)),
    );
  }

  /**
   * Collections (`nrda:ScienceTheme`) and their member ediids. Membership is static/curated, so it's
   * cached in localStorage with a long TTL and only refetched on a hard refresh. See {@link fetchCollections}.
   */
  readonly collectionMemberships$: Observable<CollectionMembership[]> = this.refresh$.pipe(
    switchMap((kind) => this.loadCollections(kind)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * Per-collection usage rollup - joins the membership map against the shared dataset list. Consumed
   * by the "Downloads by Collection" card. Recomputes whenever either source re-emits (e.g. refresh).
   */
  readonly collectionMetrics$: Observable<CollectionMetric[]> = combineLatest([
    this.collectionMemberships$,
    this.datasetMetrics$,
  ]).pipe(
    map(([memberships, datasets]) => rollupCollections(memberships, datasets)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * Drill-down detail for one collection (its rollup + joined member rows + repo share). Re-emits on
   * refresh. Emits `null` if the id isn't a known collection. The drawer resolves member titles via
   * {@link record}.
   */
  collectionDetail(id: string): Observable<CollectionDetail | null> {
    return combineLatest([this.collectionMemberships$, this.datasetMetrics$]).pipe(
      map(([memberships, datasets]) => {
        const membership = memberships.find((c) => c.id === id);
        return membership ? buildCollectionDetail(membership, datasets) : null;
      }),
    );
  }

  /** Initial-load-screen tracking: reveal the dashboard once BOTH base sets have first loaded. */
  private baseLoaded = { repo: false, dataset: false };

  constructor() {
    this.hydratePersistedRecords();

    // No-flash reveal: if both base sets are already cached fresh, reveal synchronously (before the
    // first paint). Otherwise the streams flip `ready` via markBaseLoaded() once they first emit -
    // kept lazy (the dashboard's subscriptions kick off the fetch), so we don't fetch eagerly here.
    if (
      this.readStore<RepoMetric[]>(sessionStorage, MetricsService.REPO_KEY, this.REFRESH_MS) &&
      this.readStore<DataSetMetric[]>(sessionStorage, MetricsService.LIST_KEY, this.REFRESH_MS)
    ) {
      this.ready.set(true);
    }

    // Auto-refresh: refetch the lists but KEEP the per-record cache (titles/dois/themes are static).
    timer(this.REFRESH_MS, this.REFRESH_MS).subscribe(() => this.refresh$.next('soft'));
  }

  /** Mark a base data set as loaded; reveal the dashboard once both are in. */
  private markBaseLoaded(which: 'repo' | 'dataset'): void {
    this.baseLoaded[which] = true;
    if (this.baseLoaded.repo && this.baseLoaded.dataset) this.ready.set(true);
  }

  /** Full metadata for one dataset, cached per ediid (in memory + localStorage) and shared. */
  record(ediid: string): Observable<RecordResult | null> {
    const existing = this.recordCache.get(ediid);
    if (existing) return existing;

    // Reuse a value persisted from a previous page load - no network call.
    const persisted = this.persistedRecords.get(ediid);
    if (persisted) {
      const obs = of(persisted);
      this.recordCache.set(ediid, obs);
      return obs;
    }

    const fetched = this.http.get<RecordsResponse>(`${this.recordsUrl}/${ediid}`).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      map((r) => r?.ResultData?.[0] ?? null),
      tap((rec) => {
        if (rec) this.rememberRecord(ediid, rec);
      }),
      catchError(() => of(null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.recordCache.set(ediid, fetched);
    return fetched;
  }

  /**
   * Whether a DOI is registered in DataCite (i.e. the badge web component will render it). Cached per
   * bare DOI. A definitive 404 -> false (DataCite doesn't know it); any other failure (network /
   * timeout / 5xx) is inconclusive, so we return true and let the badge try, rather than hide a
   * dataset because of a transient DataCite hiccup.
   */
  doiResolves(doi: string): Observable<boolean> {
    if (!doi) return of(false);
    const cached = this.doiCache.get(doi);
    if (cached) return cached;

    const check = this.http.get(`${this.dataciteApi}/${doi}`, { observe: 'response' }).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      map(() => true),
      catchError((err: unknown) => of(!(err instanceof HttpErrorResponse && err.status === 404))),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.doiCache.set(doi, check);
    return check;
  }

  /**
   * Search the full record catalog by phrase (matches titles, keywords, domains). The underlying
   * records are large, so we keep only the few fields the lookup UI needs and cap the result count.
   * Returns an empty list on error or timeout.
   */
  searchRecords(phrase: string): Observable<DatasetSearchResult[]> {
    const url = `${this.recordsUrl}?searchphrase=${encodeURIComponent(phrase)}`;
    return this.http.get<RecordsResponse>(url).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      map((r) =>
        (r?.ResultData ?? [])
          .filter((rec) => !!rec.ediid)
          .map((rec): DatasetSearchResult => {
            const tags = (rec.topic ?? []).map((t) => t.tag);
            const source = tags.some(Boolean) ? tags : (rec.theme ?? []);
            return {
              ediid: rec.ediid as string,
              title: rec.title || (rec.ediid as string),
              doi: rec.doi?.replace(/^doi:/, ''),
              domains: Array.from(new Set(source.map((s) => (s ?? '').trim()).filter(Boolean))),
            };
          }),
      ),
      catchError(() => of<DatasetSearchResult[]>([])),
    );
  }

  /** Force an immediate hard refresh of everything (drops every cache, in memory and storage). */
  refresh(): void {
    this.refreshing.set(true);
    // Show the full loading screen again until the base data has re-loaded.
    this.ready.set(false);
    this.baseLoaded = { repo: false, dataset: false };
    this.recordCache.clear();
    this.doiCache.clear();
    this.persistedRecords.clear();
    clearTimeout(this.recordsFlushHandle);
    this.recordsFlushHandle = undefined;
    this.recordsDirty = false;
    this.clearStore(localStorage, MetricsService.RECORDS_KEY);
    this.clearStore(localStorage, MetricsService.COLLECTIONS_KEY);
    this.clearStore(sessionStorage, MetricsService.LIST_KEY);
    this.clearStore(sessionStorage, MetricsService.REPO_KEY);
    this.refresh$.next('hard');
  }

  // ---------------------------------------------------------------------------
  // Base-data loaders (persisted-cache aware)
  // ---------------------------------------------------------------------------

  private loadRepoMetrics(kind: RefreshKind): Observable<RepoMetric[]> {
    if (kind === 'passive') {
      const cached = this.readStore<RepoMetric[]>(sessionStorage, MetricsService.REPO_KEY, this.REFRESH_MS);
      if (cached) {
        this.repoError.set(false);
        this.lastUpdated.set(new Date(cached.savedAt));
        this.markBaseLoaded('repo');
        return of(cached.data);
      }
    }
    return this.http.get<RepoMetricsResponse>(this.repoUrl).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      map((r) => r?.RepoMetrics ?? []),
      tap((rows) => {
        this.repoError.set(false);
        this.lastUpdated.set(this.now());
        this.markBaseLoaded('repo');
        if (rows.length) this.writeStore(sessionStorage, MetricsService.REPO_KEY, rows);
      }),
      catchError(() => {
        this.repoError.set(true);
        this.markBaseLoaded('repo'); // reveal even on failure (show empty/error states, not a stuck loader)
        return of<RepoMetric[]>([]);
      }),
    );
  }

  private loadDatasets(kind: RefreshKind): Observable<DataSetMetric[]> {
    if (kind === 'passive') {
      const cached = this.readStore<DataSetMetric[]>(sessionStorage, MetricsService.LIST_KEY, this.REFRESH_MS);
      if (cached) {
        this.datasetError.set(false);
        this.lastUpdated.set(new Date(cached.savedAt));
        this.markBaseLoaded('dataset');
        return of(cached.data);
      }
    }
    return this.fetchAllDatasets().pipe(
      tap((rows) => {
        this.markBaseLoaded('dataset'); // fires on success or the empty array from a page-1 failure
        if (rows.length) this.writeStore(sessionStorage, MetricsService.LIST_KEY, rows);
      }),
    );
  }

  /**
   * Collection membership - reused from localStorage on any non-hard load (it's static, curated data),
   * refetched from the catalog on a hard refresh. Never blocks the dashboard: on failure it degrades
   * to an empty list (the card shows its empty state).
   */
  private loadCollections(kind: RefreshKind): Observable<CollectionMembership[]> {
    if (kind !== 'hard') {
      const cached = this.readStore<CollectionMembership[]>(
        localStorage,
        MetricsService.COLLECTIONS_KEY,
        this.RECORD_TTL_MS,
      );
      if (cached) return of(cached.data);
    }
    return this.fetchCollections().pipe(
      tap((cols) => {
        if (cols.length) this.writeStore(localStorage, MetricsService.COLLECTIONS_KEY, cols);
      }),
    );
  }

  /**
   * Discover collections by `@type=nrda:ScienceTheme`, then fetch each one's members by
   * `isPartOf.@id`. Querying the ScienceThemes (rather than reverse-indexing `isPartOf` while paging
   * the catalog) means a newly-added collection appears automatically. Collections are few (~3) and
   * small, so this is a handful of cheap calls, throttled and cached.
   */
  private fetchCollections(): Observable<CollectionMembership[]> {
    const url =
      `${this.recordsUrl}?@type=${encodeURIComponent(MetricsService.COLLECTION_TYPE)}` +
      `&include=title,ediid,@id&size=50`;
    return this.http.get<CatalogQueryResponse>(url).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      map((r) =>
        (r?.ResultData ?? [])
          // Normalize titles: the catalog is inconsistent (some end in "Collection", some don't),
          // so strip any trailing "Collection" and re-append it for a uniform "... Collection" label.
          .map((rec) => ({
            id: rec['@id'] || rec.ediid || '',
            title: `${(rec.title ?? '').trim().replace(/\s+collection\s*$/i, '')} Collection`.trim(),
          }))
          .filter((c) => c.id),
      ),
      switchMap((defs) =>
        defs.length
          ? from(defs).pipe(
              mergeMap(
                (def) =>
                  this.fetchCollectionMembers(def.id).pipe(
                    map((members): CollectionMembership => ({ ...def, members })),
                  ),
                3, // throttle: at most 3 member queries in flight
              ),
              toArray(),
            )
          : of<CollectionMembership[]>([]),
      ),
      catchError(() => of<CollectionMembership[]>([])),
    );
  }

  /** Member ediids of one collection (datasets whose `isPartOf` names this collection's @id). */
  private fetchCollectionMembers(id: string): Observable<string[]> {
    const url =
      `${this.recordsUrl}?isPartOf.@id=${encodeURIComponent(id)}` +
      `&include=ediid&size=${MetricsService.MAX_COLLECTION_MEMBERS}`;
    return this.http.get<CatalogQueryResponse>(url).pipe(
      timeout(this.REQUEST_TIMEOUT_MS),
      map((r) => (r?.ResultData ?? []).map((rec) => rec.ediid ?? '').filter(Boolean)),
      catchError(() => of<string[]>([])),
    );
  }

  // ---------------------------------------------------------------------------
  // Dataset list source - the ONE place to change when the server sort is fixed.
  // ---------------------------------------------------------------------------

  /**
   * Fetch the entire dataset list by paginating every page and concatenating.
   *
   * WHY: the RMM server's sort params don't work (verified - `docs/oar-rmm-metrics-sort-bug.md`),
   * so the only way to rank datasets correctly (by downloads AND by recency) is to pull all of them
   * and sort on the client. Page 1 reveals the total count; the rest are fetched in parallel
   * (throttled) and de-duplicated by ediid.
   *
   * ➡️ WHEN THE SERVER IS FIXED (honors a sort param + has indexes), replace this whole method body
   * with a single bounded request, e.g.:
   *     return this.fetchDatasetPage(1, { 'sort.desc': 'record_download' }).pipe(map((p) => p.rows));
   * and delete `pageRange` / `dedupeByEdiid`. The `datasetMetrics$` contract is unchanged, so no
   * widget needs to change.
   */
  private fetchAllDatasets(): Observable<DataSetMetric[]> {
    return this.fetchDatasetPage(1).pipe(
      switchMap(({ rows: firstRows, total }) => {
        const pageCount = Math.min(Math.ceil((total || 0) / this.PAGE_SIZE) || 1, this.MAX_PAGES);
        if (pageCount <= 1) return of(this.cleanDatasets(firstRows));

        // Pages 2..pageCount, throttled; a failed page degrades to empty rather than failing all.
        return from(this.pageRange(2, pageCount)).pipe(
          mergeMap(
            (page) =>
              this.fetchDatasetPage(page).pipe(
                map((p) => p.rows),
                catchError(() => of<DataSetMetric[]>([])),
              ),
            this.PAGE_CONCURRENCY,
          ),
          toArray(),
          map((restPages) => this.cleanDatasets([firstRows, ...restPages].flat())),
        );
      }),
      tap(() => {
        this.datasetError.set(false);
        this.lastUpdated.set(this.now());
      }),
      catchError(() => {
        // Only reached if page 1 itself fails (per-page failures are caught above).
        this.datasetError.set(true);
        return of<DataSetMetric[]>([]);
      }),
      // The full-list refetch is the slowest base call; treat its completion as "refresh done".
      finalize(() => this.refreshing.set(false)),
    );
  }

  /** One page of the dataset list; also returns the server's total count. */
  private fetchDatasetPage(
    page: number,
    extraParams: Record<string, string | number> = {},
  ): Observable<{ rows: DataSetMetric[]; total: number }> {
    return this.http
      .get<DataSetMetricsResponse>(this.usageUrl, { params: { size: this.PAGE_SIZE, page, ...extraParams } })
      .pipe(
        timeout(this.REQUEST_TIMEOUT_MS),
        map((r) => ({ rows: r?.DataSetMetrics ?? [], total: r?.DataSetMetricsCount ?? 0 })),
      );
  }

  private pageRange(start: number, end: number): number[] {
    const pages: number[] = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }

  /**
   * Bulk-load the catalog's domain fields (ediid, topic, theme), paginated. Passive loads reuse the
   * sessionStorage cache within the TTL. A failed page degrades to empty rather than failing the
   * whole set; a page-1 failure flags catalogError so the card can show a graceful message.
   */
  private loadCatalogRecords(kind: RefreshKind): Observable<RecordResult[]> {
    if (kind === 'passive') {
      const cached = this.readStore<RecordResult[]>(sessionStorage, MetricsService.CATALOG_KEY, this.REFRESH_MS);
      if (cached) {
        this.catalogError.set(false);
        return of(cached.data);
      }
    }
    return this.fetchCatalogPage(1).pipe(
      switchMap(({ rows, total }) => {
        const pageCount = Math.min(Math.ceil((total || 0) / this.PAGE_SIZE) || 1, this.MAX_PAGES);
        if (pageCount <= 1) return of(rows);
        return from(this.pageRange(2, pageCount)).pipe(
          mergeMap(
            (page) =>
              this.fetchCatalogPage(page).pipe(
                map((p) => p.rows),
                catchError(() => of<RecordResult[]>([])),
              ),
            this.PAGE_CONCURRENCY,
          ),
          toArray(),
          map((rest) => [rows, ...rest].flat()),
        );
      }),
      tap((rows) => {
        this.catalogError.set(false);
        if (rows.length) this.writeStore(sessionStorage, MetricsService.CATALOG_KEY, rows);
      }),
      catchError(() => {
        this.catalogError.set(true);
        return of<RecordResult[]>([]);
      }),
    );
  }

  /** One catalog page trimmed to domain fields; also returns the server's total count. */
  private fetchCatalogPage(page: number): Observable<{ rows: RecordResult[]; total: number }> {
    return this.http
      .get<{ ResultData?: RecordResult[]; ResultCount?: number }>(this.recordsUrl, {
        params: { include: 'ediid,@id,topic,theme,title', size: this.PAGE_SIZE, page },
      })
      .pipe(
        timeout(this.REQUEST_TIMEOUT_MS),
        map((r) => ({ rows: r?.ResultData ?? [], total: r?.ResultCount ?? 0 })),
      );
  }

  /**
   * Normalize and filter the raw usage list to real PDR datasets before it reaches any widget. The
   * usage feed is noisy: many rows are web-server path artifacts (e.g. `_vti_bin`, `_private`,
   * `WebShop`) or per-file download paths with query strings (e.g.
   * `ark:/88434/mds2-2121/data.zip?...`). We reduce each id to its base ediid, drop anything that is
   * not a PDR dataset id (an `ark:/88434/<id>` or a legacy 32-hex EDI id), then dedupe. This keeps
   * "Datasets tracked" and every downstream card honest (counts, most-accessed, science domains).
   */
  private cleanDatasets(rows: DataSetMetric[]): DataSetMetric[] {
    const normalized = rows.map((row) =>
      row.ediid ? { ...row, ediid: this.baseEdiid(row.ediid) } : row,
    );
    return this.dedupeByEdiid(normalized.filter((row) => this.isRealDatasetId(row.ediid)));
  }

  /** Reduce a usage `ediid` to the dataset id: drop any query string and, for arks, any path after the base. */
  private baseEdiid(ediid: string): string {
    const noQuery = ediid.split('?', 1)[0];
    // ark:/88434/<id> -> keep the first four '/'-segments ("ark:", "", "88434", "<id>").
    return noQuery.startsWith('ark:/') ? noQuery.split('/').slice(0, 4).join('/') : noQuery;
  }

  /** True only for a PDR dataset id: an `ark:/88434/<id>` (no sub-path) or a legacy 32+ hex EDI id. */
  private isRealDatasetId(ediid?: string): boolean {
    if (!ediid) return false;
    return /^ark:\/88434\/[^/]+$/.test(ediid) || /^[0-9A-Fa-f]{32,}$/.test(ediid);
  }

  /**
   * Collapse duplicate ediids (the metrics collection has ~260 datasets with duplicate rows, mostly
   * empty `dl=0/t=null` junk, but a handful with *differing* download counts). Keep the most
   * significant row per ediid - highest downloads, ties broken by most recent - so a real dataset is
   * never represented by a `0`-download duplicate.
   */
  /**
   * Re-key usage rows to the record's canonical `ediid` using the catalog's `@id`/`ediid` map, then
   * merge rows that land on the same id (sum counts, widen the date range). With no catalog it falls
   * back to keying by the row's own ediid, i.e. plain dedupe.
   */
  private reconcileUsage(usage: DataSetMetric[], catalog: RecordResult[]): DataSetMetric[] {
    const toCanonical = new Map<string, string>();
    for (const r of catalog) {
      const canon = r.ediid;
      if (!canon) continue;
      toCanonical.set(canon, canon);
      const atId = r['@id'];
      if (atId) toCanonical.set(atId, canon);
    }
    const merged = new Map<string, DataSetMetric>();
    for (const row of usage) {
      if (!row.ediid) continue;
      const key = toCanonical.get(row.ediid) ?? row.ediid;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...row, ediid: key });
      } else {
        existing.record_download = (existing.record_download ?? 0) + (row.record_download ?? 0);
        existing.number_users = (existing.number_users ?? 0) + (row.number_users ?? 0);
        existing.total_size_download = (existing.total_size_download ?? 0) + (row.total_size_download ?? 0);
        existing.success_get = (existing.success_get ?? 0) + (row.success_get ?? 0);
        existing.first_time_logged = this.minStr(existing.first_time_logged, row.first_time_logged);
        existing.last_time_logged = this.maxStr(existing.last_time_logged, row.last_time_logged);
        existing.pdrid = existing.pdrid ?? row.pdrid;
      }
    }
    return [...merged.values()];
  }

  private minStr(a?: string, b?: string): string | undefined {
    if (!a) return b;
    if (!b) return a;
    return a < b ? a : b;
  }
  private maxStr(a?: string, b?: string): string | undefined {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
  }

  private dedupeByEdiid(rows: DataSetMetric[]): DataSetMetric[] {
    const best = new Map<string, DataSetMetric>();
    const noId: DataSetMetric[] = [];
    for (const row of rows) {
      if (!row.ediid) {
        noId.push(row);
        continue;
      }
      const existing = best.get(row.ediid);
      if (!existing || this.isMoreSignificant(row, existing)) best.set(row.ediid, row);
    }
    return [...best.values(), ...noId];
  }

  private isMoreSignificant(a: DataSetMetric, b: DataSetMetric): boolean {
    const ad = a.record_download ?? 0;
    const bd = b.record_download ?? 0;
    if (ad !== bd) return ad > bd;
    return new Date(a.last_time_logged ?? 0).getTime() > new Date(b.last_time_logged ?? 0).getTime();
  }

  // ---------------------------------------------------------------------------
  // Record persistence (localStorage, write-through, debounced)
  // ---------------------------------------------------------------------------

  private hydratePersistedRecords(): void {
    const cached = this.readStore<Record<string, RecordResult>>(
      localStorage,
      MetricsService.RECORDS_KEY,
      this.RECORD_TTL_MS,
    );
    if (cached?.data) {
      for (const [ediid, rec] of Object.entries(cached.data)) this.persistedRecords.set(ediid, rec);
    }
  }

  private rememberRecord(ediid: string, rec: RecordResult): void {
    this.persistedRecords.set(ediid, rec);
    this.recordsDirty = true;
    // Trailing throttle: flush at most every ~300ms *while records keep arriving* (not a debounce
    // that waits for the burst to end), so a reload mid-load still reuses whatever already resolved.
    if (this.recordsFlushHandle === undefined) {
      this.recordsFlushHandle = setTimeout(() => this.flushRecords(), 300);
    }
  }

  private flushRecords(): void {
    this.recordsFlushHandle = undefined;
    if (!this.recordsDirty) return;
    this.recordsDirty = false;
    const obj: Record<string, RecordResult> = {};
    for (const [k, v] of this.persistedRecords) obj[k] = v;
    this.writeStore(localStorage, MetricsService.RECORDS_KEY, obj);
  }

  // ---------------------------------------------------------------------------
  // Storage helpers (versioned envelope + TTL; all best-effort / quota-safe)
  // ---------------------------------------------------------------------------

  private readStore<T>(storage: Storage, key: string, maxAgeMs: number): { savedAt: number; data: T } | null {
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const env = JSON.parse(raw) as { v?: number; savedAt?: number; data?: T };
      if (env.v !== MetricsService.STORE_VERSION || typeof env.savedAt !== 'number') return null;
      if (this.now().getTime() - env.savedAt > maxAgeMs) return null;
      return { savedAt: env.savedAt, data: env.data as T };
    } catch {
      return null; // unparseable / storage unavailable
    }
  }

  private writeStore(storage: Storage, key: string, data: unknown): void {
    try {
      storage.setItem(key, JSON.stringify({ v: MetricsService.STORE_VERSION, savedAt: this.now().getTime(), data }));
    } catch {
      /* quota exceeded / storage unavailable - caching is best-effort */
    }
  }

  private clearStore(storage: Storage, key: string): void {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  // `new Date()` is fine in app code (the scripting restriction is for workflow scripts).
  private now(): Date {
    return new Date();
  }
}
