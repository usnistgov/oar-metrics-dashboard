import { DataSetMetric } from './models/metrics.models';

export interface GrowthPoint {
  period: string; // 'YYYY-MM'
  label: string; // 'Apr 2022'
  added: number; // datasets first active this month
  cumulative: number; // running total active by this month
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A collection's growth timeline: the cumulative count of its datasets that became active
 * (`first_time_logged`) by month. Built ONLY from real first-seen timestamps; months are filled
 * between the earliest and latest so the x-axis is continuous.
 *
 * This is honest temporal data (adoption/growth over time) - NOT a downloads-over-time trend, which
 * the per-dataset feed can't support (it stores lifetime totals, not monthly history).
 */
export function datasetGrowthSeries(datasets: DataSetMetric[]): GrowthPoint[] {
  const byMonth = new Map<string, number>();
  let min: string | null = null;
  let max: string | null = null;

  for (const d of datasets) {
    const t = d.first_time_logged;
    if (!t) continue;
    const dt = new Date(t);
    if (isNaN(dt.getTime())) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    if (min === null || key < min) min = key;
    if (max === null || key > max) max = key;
  }
  if (min === null || max === null) return [];

  const out: GrowthPoint[] = [];
  let year = Number(min.slice(0, 4));
  let month = Number(min.slice(5, 7));
  const endYear = Number(max.slice(0, 4));
  const endMonth = Number(max.slice(5, 7));
  let cumulative = 0;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const added = byMonth.get(key) ?? 0;
    cumulative += added;
    out.push({ period: key, label: `${MONTHS[month - 1]} ${year}`, added, cumulative });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return out;
}
