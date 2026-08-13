import { buildCollectionDetail, collectionShare, rollupCollections } from './collection-stats';
import { CollectionMembership, DataSetMetric } from './models/metrics.models';

describe('rollupCollections', () => {
  const datasets: DataSetMetric[] = [
    { ediid: 'a', record_download: 100, total_size_download: 1000, number_users: 10 },
    { ediid: 'b', record_download: 50, total_size_download: 500, number_users: 5 },
    { ediid: 'c', record_download: 5, total_size_download: 20, number_users: 1 },
  ];

  it('sums downloads/size/users across a collection\'s members', () => {
    const memberships: CollectionMembership[] = [
      { id: 'col1', title: 'One', members: ['a', 'b'] },
    ];
    const [c] = rollupCollections(memberships, datasets);
    expect(c.downloads).toBe(150);
    expect(c.size).toBe(1500);
    expect(c.users).toBe(15);
    expect(c.memberCount).toBe(2);
    expect(c.membersWithUsage).toBe(2);
  });

  it('counts members with no usage row toward memberCount but not the totals', () => {
    const memberships: CollectionMembership[] = [
      { id: 'col1', title: 'One', members: ['a', 'missing'] },
    ];
    const [c] = rollupCollections(memberships, datasets);
    expect(c.memberCount).toBe(2);
    expect(c.membersWithUsage).toBe(1);
    expect(c.downloads).toBe(100);
  });

  it('sorts collections by downloads descending', () => {
    const memberships: CollectionMembership[] = [
      { id: 'small', title: 'Small', members: ['c'] },
      { id: 'big', title: 'Big', members: ['a', 'b'] },
    ];
    const out = rollupCollections(memberships, datasets);
    expect(out.map((c) => c.id)).toEqual(['big', 'small']);
  });

  it('handles missing metric fields as zero', () => {
    const memberships: CollectionMembership[] = [
      { id: 'col1', title: 'One', members: ['x'] },
    ];
    const out = rollupCollections(memberships, [{ ediid: 'x' }]);
    expect(out[0].downloads).toBe(0);
    expect(out[0].membersWithUsage).toBe(1);
  });
});

describe('buildCollectionDetail', () => {
  const datasets: DataSetMetric[] = [
    { ediid: 'a', record_download: 100, total_size_download: 1000, number_users: 10 },
    { ediid: 'b', record_download: 50, total_size_download: 500, number_users: 5 },
    { ediid: 'outside', record_download: 350 }, // not a member; counts toward repo total only
  ];

  it('joins members, totals them, and computes the repo share', () => {
    const d = buildCollectionDetail({ id: 'c', title: 'C', members: ['a', 'b'] }, datasets);
    expect(d.members.map((m) => m.ediid)).toEqual(['a', 'b']);
    expect(d.downloads).toBe(150);
    expect(d.memberCount).toBe(2);
    expect(d.membersWithUsage).toBe(2);
    // repo total downloads = 100 + 50 + 350 = 500; collection has 150 -> 30%.
    expect(d.repoSharePct).toBeCloseTo(30);
  });

  it('skips members without a usage row but still counts them', () => {
    const d = buildCollectionDetail({ id: 'c', title: 'C', members: ['a', 'ghost'] }, datasets);
    expect(d.memberCount).toBe(2);
    expect(d.membersWithUsage).toBe(1);
    expect(d.members.map((m) => m.ediid)).toEqual(['a']);
  });
});

describe('collectionShare', () => {
  // Repo total downloads = 200; collections cover 150 of it (a+b), 50 is uncategorized (d).
  const datasets: DataSetMetric[] = [
    { ediid: 'a', record_download: 100, total_size_download: 1000 },
    { ediid: 'b', record_download: 50, total_size_download: 500 },
    { ediid: 'd', record_download: 50, total_size_download: 250 }, // in no collection
  ];

  it('produces per-collection slices plus a "Not in a collection" remainder that sums to the total', () => {
    const memberships: CollectionMembership[] = [{ id: 'c1', title: 'One', members: ['a', 'b'] }];
    const s = collectionShare(memberships, datasets, 'downloads');

    expect(s.total).toBe(200);
    expect(s.covered).toBe(150);
    expect(s.coveredPct).toBeCloseTo(75);
    // Collection slice first, remainder last.
    expect(s.slices.map((x) => x.id)).toEqual(['c1', null]);
    expect(s.slices[0]).toEqual(expect.objectContaining({ label: 'One', value: 150, pct: 75 }));
    expect(s.slices[1]).toEqual(expect.objectContaining({ label: 'Not in a collection', value: 50, pct: 25 }));
    // Slices always sum to the total.
    expect(s.slices.reduce((t, x) => t + x.value, 0)).toBe(s.total);
  });

  it('counts a dataset in two collections only once (assigned to the larger), so slices stay disjoint', () => {
    const memberships: CollectionMembership[] = [
      { id: 'big', title: 'Big', members: ['a', 'b'] }, // raw 150
      { id: 'small', title: 'Small', members: ['a'] }, // raw 100, overlaps on 'a'
    ];
    const s = collectionShare(memberships, datasets, 'downloads');

    const big = s.slices.find((x) => x.id === 'big');
    const small = s.slices.find((x) => x.id === 'small');
    expect(big?.value).toBe(150); // keeps 'a' + 'b'
    expect(small?.value).toBe(0); // 'a' already counted by Big
    expect(s.covered).toBe(150); // union, not 250
    expect(s.slices.reduce((t, x) => t + x.value, 0)).toBe(s.total);
  });

  it('splits by data volume when metric is "size"', () => {
    const memberships: CollectionMembership[] = [{ id: 'c1', title: 'One', members: ['a'] }];
    const s = collectionShare(memberships, datasets, 'size');
    expect(s.total).toBe(1750);
    expect(s.covered).toBe(1000);
    expect(s.slices[0]).toEqual(expect.objectContaining({ id: 'c1', value: 1000 }));
  });

  it('is all remainder when there are no collections', () => {
    const s = collectionShare([], datasets, 'downloads');
    expect(s.slices).toHaveLength(1);
    expect(s.slices[0]).toEqual(expect.objectContaining({ id: null, value: 200 }));
    expect(s.coveredPct).toBe(0);
  });
});
