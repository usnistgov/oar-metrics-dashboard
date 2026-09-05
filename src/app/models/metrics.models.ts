/**
 * Type definitions for the NIST RMM (Records Management & Metrics) API payloads consumed by
 * this dashboard. These replace the `any` types previously used across the widgets.
 *
 * Endpoints (see environments/*.ts and docs/01-knowledge.md §2.2):
 *   GET /rmm/usagemetrics/repo      -> RepoMetricsResponse
 *   GET /rmm/usagemetrics/records   -> DataSetMetricsResponse
 *   GET /rmm/records?ediid=...      -> RecordsResponse
 */

/** One month's repository-level aggregate (from /rmm/usagemetrics/repo). */
export interface RepoMetric {
  month_year: string;
  total_size: number;
  success_download: number;
  unique_users: number;
}

export interface RepoMetricsResponse {
  RepoMetrics: RepoMetric[];
}

/** Per-dataset usage log (from /rmm/usagemetrics/records). */
export interface DataSetMetric {
  pdrid?: string;
  ediid: string;
  first_time_logged?: string;
  last_time_logged?: string;
  total_size_download?: number;
  success_get?: number;
  number_users?: number;
  record_download?: number;
}

export interface DataSetMetricsResponse {
  DataSetMetrics: DataSetMetric[];
  /** Total number of datasets in the collection (used to know how many pages to fetch). */
  DataSetMetricsCount?: number;
}

/** A topic tag entry on a record's metadata. */
export interface RecordTopic {
  tag: string;
}

/** Dataset metadata record (from /rmm/records). Only the fields used by the app are typed. */
export interface RecordResult {
  ediid?: string;
  title?: string;
  doi?: string;
  theme?: string[];
  topic?: RecordTopic[];
}

/** A dataset returned by the catalog search, trimmed to what the lookup UI needs. */
export interface DatasetSearchResult {
  ediid: string;
  title: string;
  doi?: string;
  domains: string[];
}

export interface RecordsResponse {
  ResultData: RecordResult[];
}

/** A dataset usage log enriched with its resolved title (used by most-popular / latest / datacite). */
export interface EnrichedDataSetMetric extends DataSetMetric {
  title: string;
  doi?: string;
}

/** A science-domain / category name with an occurrence count. */
export interface CategoryCount {
  name: string;
  count: number;
}

/**
 * A PDR collection (a resource whose `@type` includes `nrda:ScienceTheme`) together with the ediids
 * of its member datasets (datasets that name it in their `isPartOf`). See docs/09-collections.md.
 */
export interface CollectionMembership {
  id: string; // the collection's @id / ediid, e.g. "ark:/88434/pdr0-0003"
  title: string; // the collection's own title, e.g. "Additive Manufacturing Data Collection"
  members: string[]; // member dataset ediids
}

/** A collection's usage metrics, rolled up by joining its members against the per-dataset metrics. */
export interface CollectionMetric {
  id: string;
  title: string;
  memberCount: number; // datasets curated into the collection
  membersWithUsage: number; // members that have a usage-metrics row (memberCount minus untracked)
  downloads: number; // Σ record_download across members
  size: number; // Σ total_size_download across members (bytes)
  users: number; // Σ number_users across members (user-sessions, NOT distinct people)
  firstLogged: string | null; // earliest first_time_logged across members (how far back the metrics go)
}

/** One collection's rollup PLUS its joined member rows - powers the drill-down drawer. */
export interface CollectionDetail extends CollectionMetric {
  repoSharePct: number; // the collection's downloads as a share (0-100) of all repo downloads
  members: DataSetMetric[]; // member datasets joined to their usage rows (those with usage; unsorted)
}

/**
 * A record returned by the catalog `/records` endpoint when we only need identity fields (used to
 * discover collections by `@type` and their members by `isPartOf.@id`).
 */
export interface CatalogRecordRef {
  '@id'?: string;
  ediid?: string;
  title?: string;
}

/** The `/records` query envelope (list + total count). */
export interface CatalogQueryResponse {
  ResultData?: CatalogRecordRef[];
  ResultCount?: number;
}
