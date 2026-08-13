import { DataSetMetric } from './models/metrics.models';

/** Repository-wide download health figures, computed across all datasets' all-time counts. */
export interface HealthStats {
  total: number; // total datasets
  withDownloads: number; // datasets with >= 1 download
  zeroDownloads: number; // datasets never downloaded
  pctWithDownloads: number; // 0-100
  totalDownloads: number;
  mean: number; // average downloads per dataset (all datasets)
  median: number; // median downloads per dataset (all datasets)
  meanActive: number; // average downloads among datasets with >= 1 download
}

/** A point on the cumulative concentration (Pareto) curve. */
export interface CurvePoint {
  x: number; // cumulative % of datasets (most-downloaded first)
  y: number; // cumulative % of all downloads
}

/** All-time download count per dataset (missing -> 0). */
export function downloadCounts(data: DataSetMetric[]): number[] {
  return data.map((d) => Math.max(0, d.record_download ?? 0));
}

export function median(counts: number[]): number {
  if (!counts.length) return 0;
  const sorted = [...counts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function healthStats(data: DataSetMetric[]): HealthStats {
  const counts = downloadCounts(data);
  const total = counts.length;
  const totalDownloads = counts.reduce((s, n) => s + n, 0);
  const withDownloads = counts.filter((n) => n > 0).length;
  const zeroDownloads = total - withDownloads;
  return {
    total,
    withDownloads,
    zeroDownloads,
    pctWithDownloads: total ? (withDownloads / total) * 100 : 0,
    totalDownloads,
    mean: total ? totalDownloads / total : 0,
    median: median(counts),
    meanActive: withDownloads ? totalDownloads / withDownloads : 0,
  };
}

/** % of all downloads contributed by the top `fraction` (0-1) of datasets, ranked descending. */
export function topShare(counts: number[], fraction: number): number {
  const total = counts.reduce((s, n) => s + n, 0);
  if (!total) return 0;
  const sorted = [...counts].sort((a, b) => b - a);
  const k = Math.min(sorted.length, Math.max(1, Math.ceil(sorted.length * fraction)));
  const top = sorted.slice(0, k).reduce((s, n) => s + n, 0);
  return (top / total) * 100;
}

/** % of datasets that have never been downloaded. */
export function zeroPct(counts: number[]): number {
  if (!counts.length) return 0;
  return (counts.filter((n) => n === 0).length / counts.length) * 100;
}

/** Gini coefficient of the distribution (0 = perfectly even, ~1 = all downloads in one dataset). */
export function gini(counts: number[]): number {
  const sorted = [...counts].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (!n || !total) return 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) weighted += (2 * (i + 1) - n - 1) * sorted[i];
  return weighted / (n * total);
}

/**
 * Cumulative Pareto curve (datasets ranked most-downloaded first), sampled to ~`steps` points for
 * plotting: each point is (cumulative % of datasets, cumulative % of downloads).
 */
export function paretoCurve(counts: number[], steps = 120): CurvePoint[] {
  const sorted = [...counts].sort((a, b) => b - a);
  const n = sorted.length;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (!n || !total) {
    return [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
  }
  const stride = Math.max(1, Math.floor(n / steps));
  const points: CurvePoint[] = [{ x: 0, y: 0 }];
  let cum = 0;
  for (let i = 0; i < n; i++) {
    cum += sorted[i];
    if (i % stride === 0 || i === n - 1) {
      points.push({ x: ((i + 1) / n) * 100, y: (cum / total) * 100 });
    }
  }
  return points;
}
