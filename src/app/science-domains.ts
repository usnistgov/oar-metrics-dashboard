import { CategoryCount, DataSetMetric, RecordResult } from './models/metrics.models';

/**
 * Standardize a domain label: trim, and normalize spacing around ":" so labels that differ only in
 * whitespace (e.g. "Physics :Optics" vs "Physics: Optics") group together.
 */
export function normalizeDomain(value: string): string {
  return (value ?? '').trim().replace(/\s*:\s*/g, ': ');
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
 */
export function aggregateDomains(
  records: (RecordResult | null)[],
  amount: number,
): CategoryCount[] {
  const counts: Record<string, number> = {};

  for (const record of records) {
    if (!record) continue;

    // Per-record Set so a duplicated tag on one record is only counted once for that dataset.
    const domains = new Set<string>();

    if (Array.isArray(record.topic) && record.topic.length > 0) {
      for (const topicItem of record.topic) {
        if (topicItem && typeof topicItem === 'object' && 'tag' in topicItem) {
          const name = normalizeDomain(topicItem.tag);
          if (name) domains.add(name);
        }
      }
    }
    if (domains.size === 0 && Array.isArray(record.theme) && record.theme.length > 0) {
      for (const themeItem of record.theme) {
        const name = normalizeDomain(themeItem);
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
