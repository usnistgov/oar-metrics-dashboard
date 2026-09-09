import { navActiveIndex } from './nav-dock.component';

describe('navActiveIndex', () => {
  const items = [
    { path: '/', exact: true },
    { path: '/collections', exact: false },
  ];

  it('matches the home route exactly', () => {
    expect(navActiveIndex('/', items)).toBe(0);
  });

  it('matches a section by prefix', () => {
    expect(navActiveIndex('/collections', items)).toBe(1);
    expect(navActiveIndex('/collections/mds2-123', items)).toBe(1);
  });

  it('does not match the exact home route for a sub-route', () => {
    // '/collections' must not count as home ('/'), or the indicator would sit on the wrong tab.
    expect(navActiveIndex('/collections', items)).not.toBe(0);
  });

  it('returns -1 when the route is not in the nav (e.g. the guide)', () => {
    expect(navActiveIndex('/guide', items)).toBe(-1);
  });
});
