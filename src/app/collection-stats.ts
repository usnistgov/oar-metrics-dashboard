import {
  CollectionDetail,
  CollectionMembership,
  CollectionMetric,
  DataSetMetric,
} from './models/metrics.models';

/**
 * Roll up per-collection usage metrics by joining each collection's member ediids against the full
 * per-dataset metrics list (keyed by ediid). Members with no usage row are counted toward
 * `memberCount` but contribute nothing to the totals (and are surfaced via `membersWithUsage`).
 *
 * The result is sorted by downloads, descending. See docs/09-collections.md for the data model.
 */
export function rollupCollections(
  memberships: CollectionMembership[],
  datasets: DataSetMetric[],
): CollectionMetric[] {
  const byEdiid = new Map<string, DataSetMetric>();
  for (const d of datasets) {
    if (d.ediid) byEdiid.set(d.ediid, d);
  }

  return memberships
    .map((m): CollectionMetric => {
      let downloads = 0;
      let size = 0;
      let users = 0;
      let membersWithUsage = 0;
      let firstLogged: string | null = null;
      for (const ediid of m.members) {
        const d = byEdiid.get(ediid);
        if (!d) continue;
        membersWithUsage++;
        downloads += d.record_download ?? 0;
        size += d.total_size_download ?? 0;
        users += d.number_users ?? 0;
        // ISO timestamps compare lexically, so string min gives the earliest.
        const f = d.first_time_logged;
        if (f && (firstLogged === null || f < firstLogged)) firstLogged = f;
      }
      return {
        id: m.id,
        title: m.title,
        memberCount: m.members.length,
        membersWithUsage,
        downloads,
        size,
        users,
        firstLogged,
      };
    })
    .sort((a, b) => b.downloads - a.downloads);
}

/**
 * Build the drill-down detail for a single collection: its rollup, its member usage rows (joined and
 * kept for client-side sorting), and its downloads as a share of the whole repository's downloads.
 */
export function buildCollectionDetail(
  membership: CollectionMembership,
  datasets: DataSetMetric[],
): CollectionDetail {
  const byEdiid = new Map<string, DataSetMetric>();
  let repoDownloads = 0;
  for (const d of datasets) {
    if (d.ediid) byEdiid.set(d.ediid, d);
    repoDownloads += d.record_download ?? 0;
  }

  const members: DataSetMetric[] = [];
  let downloads = 0;
  let size = 0;
  let users = 0;
  let firstLogged: string | null = null;
  for (const ediid of membership.members) {
    const d = byEdiid.get(ediid);
    if (!d) continue;
    members.push(d);
    downloads += d.record_download ?? 0;
    size += d.total_size_download ?? 0;
    users += d.number_users ?? 0;
    const f = d.first_time_logged;
    if (f && (firstLogged === null || f < firstLogged)) firstLogged = f;
  }

  return {
    id: membership.id,
    title: membership.title,
    memberCount: membership.members.length,
    membersWithUsage: members.length,
    downloads,
    size,
    users,
    firstLogged,
    repoSharePct: repoDownloads ? (downloads / repoDownloads) * 100 : 0,
    members,
  };
}

/** Metric a collection-share pie can be split by (both are safely additive across datasets). */
export type ShareMetric = 'downloads' | 'size';

/** One slice of the collection-share pie. `id` is null for the "Not in a collection" remainder. */
export interface ShareSlice {
  id: string | null;
  label: string;
  value: number;
  pct: number; // share of the repository total, 0..100
}

export interface CollectionShare {
  metric: ShareMetric;
  /** Collections (descending) followed by the "Not in a collection" remainder. Sums to `total`. */
  slices: ShareSlice[];
  covered: number; // union-deduped total across all collection members
  total: number; // repository total for the metric
  coveredPct: number; // covered / total * 100
}

function metricValue(d: DataSetMetric, metric: ShareMetric): number {
  return (metric === 'size' ? d.total_size_download : d.record_download) ?? 0;
}

/**
 * Split the repository total (downloads or data volume) into per-collection slices plus a single
 * "Not in a collection" remainder, for a part-to-whole pie.
 *
 * Honesty rules baked in:
 * - Each member dataset is counted **once** even if it belongs to more than one collection
 *   (`isPartOf` is an array). Overlaps are assigned to the larger collection first, so the slices
 *   are disjoint and sum exactly to the repository total.
 * - The remainder is `total - covered`, i.e. real activity that no curated collection captures
 *   (typically the large majority, since membership is rare).
 * - Only `downloads` and `size` are offered; per-dataset user counts are sessions and are not
 *   additive into a "share of users", so they are deliberately excluded.
 */
export function collectionShare(
  memberships: CollectionMembership[],
  datasets: DataSetMetric[],
  metric: ShareMetric,
): CollectionShare {
  const byEdiid = new Map<string, DataSetMetric>();
  let total = 0;
  for (const d of datasets) {
    if (d.ediid) byEdiid.set(d.ediid, d);
    total += metricValue(d, metric);
  }

  // Assign overlapping members to the larger collection first so each dataset is counted once.
  const ordered = memberships
    .map((m) => {
      let raw = 0;
      for (const e of m.members) {
        const d = byEdiid.get(e);
        if (d) raw += metricValue(d, metric);
      }
      return { m, raw };
    })
    .sort((a, b) => b.raw - a.raw);

  const seen = new Set<string>();
  const collectionSlices: ShareSlice[] = [];
  let covered = 0;
  for (const { m } of ordered) {
    let value = 0;
    for (const e of m.members) {
      if (seen.has(e)) continue;
      const d = byEdiid.get(e);
      if (!d) continue;
      seen.add(e);
      value += metricValue(d, metric);
    }
    covered += value;
    collectionSlices.push({ id: m.id, label: m.title, value, pct: total ? (value / total) * 100 : 0 });
  }

  collectionSlices.sort((a, b) => b.value - a.value);
  const rest = Math.max(0, total - covered);
  const slices: ShareSlice[] = [
    ...collectionSlices,
    { id: null, label: 'Not in a collection', value: rest, pct: total ? (rest / total) * 100 : 0 },
  ];

  return { metric, slices, covered, total, coveredPct: total ? (covered / total) * 100 : 0 };
}
