import {
  formatVolume,
  popularComparator,
  popularSubLabel,
  rankDatasets,
} from './popular-sort';
import { DataSetMetric } from './models/metrics.models';

const ds = (over: Partial<DataSetMetric>): DataSetMetric => ({ ediid: 'x', ...over });

describe('popularComparator', () => {
  const a = ds({ record_download: 10, number_users: 1, total_size_download: 500, last_time_logged: '2026-01-01T00:00:00' });
  const b = ds({ record_download: 5, number_users: 9, total_size_download: 999, last_time_logged: '2026-06-01T00:00:00' });

  it('ranks by downloads (desc) by default', () => {
    expect([b, a].sort(popularComparator('downloads'))).toEqual([a, b]);
  });

  it('ranks by unique users (desc)', () => {
    expect([a, b].sort(popularComparator('users'))).toEqual([b, a]);
  });

  it('ranks by data volume (desc)', () => {
    expect([a, b].sort(popularComparator('volume'))).toEqual([b, a]);
  });

  it('ranks by recency (desc)', () => {
    expect([a, b].sort(popularComparator('recent'))).toEqual([b, a]);
  });

  it('treats missing metrics as zero (undated rows sort last on recency)', () => {
    const dated = ds({ last_time_logged: '2026-01-01T00:00:00' });
    const undated = ds({});
    expect([undated, dated].sort(popularComparator('recent'))).toEqual([dated, undated]);
  });
});

describe('rankDatasets', () => {
  const rows: DataSetMetric[] = [
    ds({ ediid: 'a', record_download: 100, last_time_logged: '2026-01-01T00:00:00' }),
    ds({ ediid: 'b', record_download: 50, last_time_logged: '2026-01-02T00:00:00' }),
    ds({ ediid: 'c', record_download: 999 }), // no last_time_logged -> excluded
    ds({ ediid: 'd', record_download: 10, last_time_logged: '2026-01-03T00:00:00' }),
  ];

  it('drops undated rows, sorts by the metric, and caps at amount', () => {
    const top = rankDatasets(rows, 'downloads', 2);
    expect(top.map((d) => d.ediid)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const before = rows.map((d) => d.ediid);
    rankDatasets(rows, 'recent', 4);
    expect(rows.map((d) => d.ediid)).toEqual(before);
  });

  it('returns [] for an empty list', () => {
    expect(rankDatasets([], 'downloads', 5)).toEqual([]);
  });
});

describe('formatVolume', () => {
  it('formats TB / GB / MB / B with the right precision', () => {
    expect(formatVolume(2.5e12)).toBe('2.50 TB');
    expect(formatVolume(3e9)).toBe('3.00 GB');
    expect(formatVolume(1.5e6)).toBe('1.5 MB');
    expect(formatVolume(1500)).toBe('1,500 B');
  });

  it('treats undefined as 0 B', () => {
    expect(formatVolume(undefined)).toBe('0 B');
  });
});

describe('popularSubLabel', () => {
  const log = ds({ record_download: 1234, number_users: 42, total_size_download: 2e9, last_time_logged: '2026-03-05T00:00:00' });

  it('renders a metric-appropriate sub-line per sort key', () => {
    expect(popularSubLabel(log, 'downloads')).toBe('1,234 downloads');
    expect(popularSubLabel(log, 'users')).toBe('42 users');
    expect(popularSubLabel(log, 'volume')).toBe('2.00 GB');
    expect(popularSubLabel(log, 'recent')).toBe('Mar 5, 2026');
  });

  it('shows "No date" for recency with no timestamp', () => {
    expect(popularSubLabel(ds({}), 'recent')).toBe('No date');
  });
});
