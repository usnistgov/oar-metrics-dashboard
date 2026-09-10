import { CategoryCount, DataSetMetric, RecordResult } from './models/metrics.models';

/**
 * Standardize a domain label: trim, and normalize spacing around ":" so labels that differ only in
 * whitespace (e.g. "Physics :Optics" vs "Physics: Optics") group together.
 */
export function normalizeDomain(value: string): string {
  return (value ?? '').trim().replace(/\s*:\s*/g, ': ');
}

/** How to group domains: the broad top-level bucket, or the full granular subdomain path. */
export type DomainLevel = 'top' | 'sub';

/**
 * The top-level (generic) domain: the text before the first ":" in a normalized tag. NIST topic tags
 * are hierarchical (e.g. "Manufacturing: Robotics in manufacturing" -> "Manufacturing"). A tag with
 * no ":" is already top-level and is returned as-is.
 */
export function topLevelDomain(value: string): string {
  const norm = normalizeDomain(value);
  const i = norm.indexOf(':');
  return i === -1 ? norm : norm.slice(0, i).trim();
}

/**
 * The most-downloaded datasets worth inspecting for domains: those with both a `last_time_logged`
 * and an `ediid` (so their metadata can be resolved), ranked by downloads, capped at `sampleSize`.
 * Does not mutate the input.
 */
export function sampleTopDatasets(datasets: DataSetMetric[], sampleSize: number): DataSetMetric[] {
  return datasets
    .filter((d) => d.last_time_logged && d.ediid)
    .sort((a, b) => (b.record_download ?? 0) - (a.record_download ?? 0))
    .slice(0, sampleSize);
}

/**
 * Count the DISTINCT datasets belonging to each science domain, then return the top `amount` domains
 * by count (descending). A domain listed twice on the same record counts once for that dataset; a
 * record's `topic` tags take precedence, falling back to its `theme` names only when it has no tags.
 * `level` chooses the grouping: `'top'` collapses tags to their generic top-level bucket, `'sub'`
 * keeps the full granular subdomain path.
 */
/**
 * The distinct domain labels a record carries at the given level: its `topic` tags (preferred),
 * falling back to `theme` names when it has no tags. Mirrors the per-record logic in
 * {@link aggregateDomains}, so "which domains a dataset belongs to" stays consistent with the ranking.
 */
export function domainLabelsOf(record: RecordResult | null, level: DomainLevel): string[] {
  if (!record) return [];
  const label = (raw: string) => (level === 'top' ? topLevelDomain(raw) : normalizeDomain(raw));
  const set = new Set<string>();
  if (Array.isArray(record.topic) && record.topic.length > 0) {
    for (const t of record.topic) {
      if (t && typeof t === 'object' && 'tag' in t) {
        const name = label(t.tag);
        if (name) set.add(name);
      }
    }
  }
  if (set.size === 0 && Array.isArray(record.theme) && record.theme.length > 0) {
    for (const th of record.theme) {
      const name = label(th);
      if (name) set.add(name);
    }
  }
  return [...set];
}

export function aggregateDomains(
  records: (RecordResult | null)[],
  amount: number,
  level: DomainLevel = 'sub',
  usageByEdiid?: Map<string, DataSetMetric>,
): CategoryCount[] {
  const agg: Record<string, { count: number; downloads: number; users: number; volume: number }> = {};
  const label = (raw: string) => (level === 'top' ? topLevelDomain(raw) : normalizeDomain(raw));

  for (const record of records) {
    if (!record) continue;

    // Per-record Set so a duplicated tag on one record is only counted once for that dataset. At the
    // top level, two subdomains sharing a bucket (e.g. two "Chemistry:" tags) collapse to one entry.
    const domains = new Set<string>();

    if (Array.isArray(record.topic) && record.topic.length > 0) {
      for (const topicItem of record.topic) {
        if (topicItem && typeof topicItem === 'object' && 'tag' in topicItem) {
          const name = label(topicItem.tag);
          if (name) domains.add(name);
        }
      }
    }
    if (domains.size === 0 && Array.isArray(record.theme) && record.theme.length > 0) {
      for (const themeItem of record.theme) {
        const name = label(themeItem);
        if (name) domains.add(name);
      }
    }

    // Roll this dataset's usage into every domain it belongs to. When no usage lookup is given the
    // sums stay at zero and the domains are ranked by dataset count alone, as before.
    const usage = usageByEdiid && record.ediid ? usageByEdiid.get(record.ediid) : undefined;
    const downloads = usage?.record_download ?? 0;
    const users = usage?.number_users ?? 0;
    const volume = usage?.total_size_download ?? 0;

    for (const name of domains) {
      const bucket = agg[name] ?? (agg[name] = { count: 0, downloads: 0, users: 0, volume: 0 });
      bucket.count += 1;
      bucket.downloads += downloads;
      bucket.users += users;
      bucket.volume += volume;
    }
  }

  // Only attach the usage totals when a usage lookup was given; otherwise the result is a plain
  // name/count list, unchanged from the count-only ranking.
  return Object.keys(agg)
    .map((name) => {
      const bucket = agg[name];
      return usageByEdiid
        ? { name, count: bucket.count, downloads: bucket.downloads, users: bucket.users, volume: bucket.volume }
        : { name, count: bucket.count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, amount);
}

/** How the Science Domains card can be ordered: by dataset count or by a joined-in usage total. */
export type DomainSort = 'datasets' | 'downloads' | 'users' | 'volume';

/**
 * A comparator that orders domains by the chosen metric, highest first. Ties fall back to dataset
 * count and then the name, so the order is stable and predictable.
 */
export function domainComparator(key: DomainSort): (a: CategoryCount, b: CategoryCount) => number {
  const value = (c: CategoryCount) =>
    key === 'downloads' ? c.downloads ?? 0
    : key === 'users' ? c.users ?? 0
    : key === 'volume' ? c.volume ?? 0
    : c.count;
  return (a, b) => value(b) - value(a) || b.count - a.count || a.name.localeCompare(b.name);
}
