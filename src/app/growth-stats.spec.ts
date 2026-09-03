import { datasetGrowthSeries } from './growth-stats';
import { DataSetMetric } from './models/metrics.models';

const d = (ediid: string, first?: string): DataSetMetric => ({ ediid, first_time_logged: first });

describe('datasetGrowthSeries', () => {
  it('returns empty when no parseable timestamps', () => {
    expect(datasetGrowthSeries([d('a')])).toEqual([]);
    expect(datasetGrowthSeries([d('a', 'not-a-date')])).toEqual([]);
  });

  it('buckets by month, fills gaps, and accumulates', () => {
    const s = datasetGrowthSeries([
      d('a', '2022-01-10T00:00:00'),
      d('b', '2022-01-20T00:00:00'),
      d('c', '2022-03-05T00:00:00'),
    ]);
    expect(s.map((p) => p.period)).toEqual(['2022-01', '2022-02', '2022-03']);
    expect(s.map((p) => p.added)).toEqual([2, 0, 1]);
    expect(s.map((p) => p.cumulative)).toEqual([2, 2, 3]);
    expect(s[0].label).toBe('Jan 2022');
  });

  it('ignores unparseable dates but keeps valid ones', () => {
    const s = datasetGrowthSeries([d('a', 'nope'), d('b', '2023-06-01T00:00:00')]);
    expect(s.length).toBe(1);
    expect(s[0].cumulative).toBe(1);
  });
});
