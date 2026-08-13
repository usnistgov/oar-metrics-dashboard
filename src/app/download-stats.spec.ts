import {
  downloadCounts,
  healthStats,
  median,
  topShare,
  zeroPct,
  gini,
  paretoCurve,
} from './download-stats';
import { DataSetMetric } from './models/metrics.models';

describe('download-stats', () => {
  // 4 datasets, 100 total downloads, heavily concentrated in one.
  const data: DataSetMetric[] = [
    { ediid: 'a', record_download: 90 },
    { ediid: 'b', record_download: 10 },
    { ediid: 'c', record_download: 0 },
    { ediid: 'd' }, // missing -> 0
  ];

  it('downloadCounts coerces missing/negative to 0', () => {
    expect(downloadCounts(data)).toEqual([90, 10, 0, 0]);
  });

  it('median handles even and odd lengths', () => {
    expect(median([0, 0, 10, 90])).toBe(5); // (0 + 10) / 2
    expect(median([1, 2, 3])).toBe(2);
    expect(median([])).toBe(0);
  });

  it('healthStats computes coverage + central tendency', () => {
    const h = healthStats(data);
    expect(h.total).toBe(4);
    expect(h.withDownloads).toBe(2);
    expect(h.zeroDownloads).toBe(2);
    expect(h.pctWithDownloads).toBe(50);
    expect(h.totalDownloads).toBe(100);
    expect(h.mean).toBe(25); // 100 / 4
    expect(h.median).toBe(5);
    expect(h.meanActive).toBe(50); // 100 / 2 active
  });

  it('topShare returns the % of downloads from the top fraction of datasets', () => {
    expect(topShare([90, 10, 0, 0], 0.25)).toBe(90); // top 1 of 4
    expect(topShare([90, 10, 0, 0], 0.5)).toBe(100); // top 2 of 4
    expect(topShare([], 0.1)).toBe(0);
  });

  it('zeroPct returns the % of never-downloaded datasets', () => {
    expect(zeroPct([90, 10, 0, 0])).toBe(50);
    expect(zeroPct([])).toBe(0);
  });

  it('gini measures concentration (0 even, ~1 concentrated)', () => {
    expect(gini([5, 5, 5, 5])).toBe(0); // perfectly even
    expect(gini([90, 10, 0, 0])).toBeCloseTo(0.7, 5);
    expect(gini([])).toBe(0);
  });

  it('paretoCurve is cumulative, monotonic, and ends at (100, 100)', () => {
    const curve = paretoCurve([90, 10, 0, 0]);
    expect(curve[0]).toEqual({ x: 0, y: 0 });
    expect(curve[curve.length - 1]).toEqual({ x: 100, y: 100 });
    // 25% of datasets (the top one) already account for 90% of downloads.
    expect(curve.find((p) => p.x === 25)?.y).toBe(90);
    // monotonic non-decreasing in both axes
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].x).toBeGreaterThanOrEqual(curve[i - 1].x);
      expect(curve[i].y).toBeGreaterThanOrEqual(curve[i - 1].y);
    }
  });

  it('handles an empty repository gracefully', () => {
    const h = healthStats([]);
    expect(h.total).toBe(0);
    expect(h.mean).toBe(0);
    expect(h.median).toBe(0);
    expect(paretoCurve([])).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);
  });
});
