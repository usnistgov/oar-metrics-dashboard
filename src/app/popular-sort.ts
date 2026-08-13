import { DataSetMetric } from './models/metrics.models';

/** What to rank the "most popular" datasets by. */
export type PopularSort = 'downloads' | 'users' | 'volume' | 'recent';

/**
 * Descending comparator for the active ranking metric (biggest / most recent first). Missing values
 * sort as 0 (or epoch 0 for dates), so incomplete rows fall to the bottom rather than throwing.
 */
export function popularComparator(key: PopularSort): (a: DataSetMetric, b: DataSetMetric) => number {
  switch (key) {
    case 'users':
      return (a, b) => (b.number_users ?? 0) - (a.number_users ?? 0);
    case 'volume':
      return (a, b) => (b.total_size_download ?? 0) - (a.total_size_download ?? 0);
    case 'recent':
      return (a, b) =>
        new Date(b.last_time_logged ?? 0).getTime() - new Date(a.last_time_logged ?? 0).getTime();
    case 'downloads':
    default:
      return (a, b) => (b.record_download ?? 0) - (a.record_download ?? 0);
  }
}

/**
 * The top `amount` datasets by the active metric. Only datasets with a `last_time_logged` are ranked
 * (undated rows are treated as having no real activity). Does not mutate the input.
 */
export function rankDatasets(
  datasets: DataSetMetric[],
  key: PopularSort,
  amount: number,
): DataSetMetric[] {
  return datasets
    .filter((d) => d.last_time_logged)
    .sort(popularComparator(key))
    .slice(0, amount);
}

/** Human-readable data volume (bytes -> B/MB/GB/TB), matching the KPI/detail formatting. */
export function formatVolume(bytes: number | undefined): string {
  const b = bytes ?? 0;
  if (b >= 1e12) return `${(b / 1e12).toFixed(2)} TB`;
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${b.toLocaleString()} B`;
}

/** The sub-line shown under each dataset title, reflecting the active sort metric. */
export function popularSubLabel(log: DataSetMetric, key: PopularSort): string {
  switch (key) {
    case 'users':
      return `${(log.number_users ?? 0).toLocaleString()} users`;
    case 'volume':
      return formatVolume(log.total_size_download);
    case 'recent':
      return log.last_time_logged
        ? new Date(log.last_time_logged).toLocaleDateString('en', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'No date';
    case 'downloads':
    default:
      return `${(log.record_download ?? 0).toLocaleString()} downloads`;
  }
}
