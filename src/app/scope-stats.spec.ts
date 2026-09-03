import { collectionRank, repoTotals, sharePct } from './scope-stats';
import { CollectionMembership, DataSetMetric } from './models/metrics.models';

const ds = (ediid: string, dl: number, size = 0, users = 0): DataSetMetric => ({
  ediid,
  record_download: dl,
  total_size_download: size,
  number_users: users,
});

describe('scope-stats', () => {
  const datasets = [ds('a', 100, 10, 5), ds('b', 50, 20, 3), ds('c', 25, 5, 2)];

  it('repoTotals sums every metric and counts datasets', () => {
    expect(repoTotals(datasets)).toEqual({ downloads: 175, size: 35, users: 10, datasetCount: 3 });
  });

  it('sharePct computes a percentage and guards divide-by-zero', () => {
    expect(sharePct(50, 200)).toBe(25);
    expect(sharePct(1, 0)).toBe(0);
  });

  it('collectionRank ranks a collection by downloads among all collections', () => {
    const memberships: CollectionMembership[] = [
      { id: 'X', title: 'X', members: ['a'] }, // 100 downloads
      { id: 'Y', title: 'Y', members: ['b', 'c'] }, // 75 downloads
    ];
    expect(collectionRank(memberships, datasets, 'X')).toEqual({ rank: 1, total: 2 });
    expect(collectionRank(memberships, datasets, 'Y')).toEqual({ rank: 2, total: 2 });
    expect(collectionRank(memberships, datasets, 'missing')).toBeNull();
  });
});
