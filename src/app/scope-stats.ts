import { CollectionMembership, DataSetMetric } from './models/metrics.models';
import { rollupCollections } from './collection-stats';

export interface RepoTotals {
  downloads: number;
  size: number;
  users: number;
  datasetCount: number;
}

/** Repository-wide totals across every dataset row (the denominators for "share of repo"). */
export function repoTotals(datasets: DataSetMetric[]): RepoTotals {
  let downloads = 0;
  let size = 0;
  let users = 0;
  for (const d of datasets) {
    downloads += d.record_download ?? 0;
    size += d.total_size_download ?? 0;
    users += d.number_users ?? 0;
  }
  return { downloads, size, users, datasetCount: datasets.length };
}

/** A collection's 1-based rank by downloads among all collections (and the total count). */
export function collectionRank(
  memberships: CollectionMembership[],
  datasets: DataSetMetric[],
  id: string,
): { rank: number; total: number } | null {
  const rolled = rollupCollections(memberships, datasets); // already sorted by downloads, desc
  const idx = rolled.findIndex((c) => c.id === id);
  return idx >= 0 ? { rank: idx + 1, total: rolled.length } : null;
}

/** A part-of-whole share (0..100); guards divide-by-zero. */
export function sharePct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/**
 * A URL-safe slug for a collection id. Collection ids are arks (e.g. "ark:/88434/pdr0-0003") whose
 * slashes/colon break a single `:id` route param, so we route by the final segment ("pdr0-0003") and
 * resolve it back to the full id via {@link matchesCollectionKey}.
 */
export function collectionSlug(id: string): string {
  return id.split('/').pop() || id;
}

/** True if `key` (a slug or the full id) identifies the collection `id`. */
export function matchesCollectionKey(id: string, key: string): boolean {
  return id === key || collectionSlug(id) === key;
}
