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
): CategoryCount[] {
  const counts: Record<string, number> = {};
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

    for (const name of domains) counts[name] = (counts[name] || 0) + 1;
  }

  return Object.keys(counts)
    .map((name) => ({ name, count: counts[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, amount);
}
