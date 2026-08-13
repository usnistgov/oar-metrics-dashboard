import { aggregateDomains, normalizeDomain, sampleTopDatasets } from './science-domains';
import { DataSetMetric, RecordResult } from './models/metrics.models';

describe('normalizeDomain', () => {
  it('trims and normalizes spacing around colons so equivalent labels group', () => {
    expect(normalizeDomain('  Physics  ')).toBe('Physics');
    expect(normalizeDomain('Physics :Optics')).toBe('Physics: Optics');
    expect(normalizeDomain('Physics:Optics')).toBe('Physics: Optics');
    expect(normalizeDomain('Physics: Optics')).toBe('Physics: Optics');
  });
});

describe('sampleTopDatasets', () => {
  const rows: DataSetMetric[] = [
    { ediid: 'a', record_download: 100, last_time_logged: '2026-01-01T00:00:00' },
    { ediid: 'b', record_download: 999 }, // no last_time_logged -> excluded
    { ediid: '', record_download: 500, last_time_logged: '2026-01-02T00:00:00' }, // no ediid -> excluded
    { ediid: 'c', record_download: 50, last_time_logged: '2026-01-03T00:00:00' },
  ];

  it('keeps only datasets with both ediid and last_time_logged, ranked by downloads, capped', () => {
    const sample = sampleTopDatasets(rows, 5);
    expect(sample.map((d) => d.ediid)).toEqual(['a', 'c']);
  });

  it('respects the sample size cap', () => {
    expect(sampleTopDatasets(rows, 1).map((d) => d.ediid)).toEqual(['a']);
  });
});

describe('aggregateDomains', () => {
  const rec = (over: Partial<RecordResult>): RecordResult => ({ ...over });

  it('counts distinct datasets per domain and ranks by count desc', () => {
    const records: (RecordResult | null)[] = [
      rec({ topic: [{ tag: 'Chemistry' }, { tag: 'Physics' }] }),
      rec({ topic: [{ tag: 'Chemistry' }] }),
      rec({ topic: [{ tag: 'Chemistry' }] }),
    ];
    expect(aggregateDomains(records, 5)).toEqual([
      { name: 'Chemistry', count: 3 },
      { name: 'Physics', count: 1 },
    ]);
  });

  it('counts a domain once per record even if the tag is duplicated on that record', () => {
    const records: (RecordResult | null)[] = [
      rec({ topic: [{ tag: 'Chemistry' }, { tag: ' Chemistry ' }] }),
    ];
    expect(aggregateDomains(records, 5)).toEqual([{ name: 'Chemistry', count: 1 }]);
  });

  it('falls back to theme[] only when a record has no topic tags', () => {
    const records: (RecordResult | null)[] = [
      rec({ theme: ['Math', 'Stats'] }),
      rec({ topic: [{ tag: 'Physics' }], theme: ['ShouldBeIgnored'] }),
    ];
    const result = aggregateDomains(records, 5);
    expect(result).toEqual(
      expect.arrayContaining([
        { name: 'Math', count: 1 },
        { name: 'Stats', count: 1 },
        { name: 'Physics', count: 1 },
      ]),
    );
    expect(result.find((c) => c.name === 'ShouldBeIgnored')).toBeUndefined();
  });

  it('ignores null records and caps at amount', () => {
    const records: (RecordResult | null)[] = [
      null,
      rec({ topic: [{ tag: 'A' }] }),
      rec({ topic: [{ tag: 'B' }] }),
      rec({ topic: [{ tag: 'C' }] }),
    ];
    expect(aggregateDomains(records, 2).length).toBe(2);
  });
});
