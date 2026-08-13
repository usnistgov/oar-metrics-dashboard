import { MONTHS, distinctYears, filterByMonthYear } from './month-filter';
import { RepoMetric } from './models/metrics.models';

describe('month-filter', () => {
  const data: RepoMetric[] = [
    { month_year: 'January 2025', total_size: 0, success_download: 1, unique_users: 1 },
    { month_year: 'June 2025', total_size: 0, success_download: 1, unique_users: 1 },
    { month_year: 'June 2026', total_size: 0, success_download: 1, unique_users: 1 },
    { month_year: 'not a date', total_size: 0, success_download: 1, unique_users: 1 },
  ];

  it('MONTHS lists all 12 months in order', () => {
    expect(MONTHS.length).toBe(12);
    expect(MONTHS[0]).toEqual({ value: 0, label: 'January' });
    expect(MONTHS[11]).toEqual({ value: 11, label: 'December' });
  });

  it('distinctYears returns unique years newest-first, ignoring unparseable dates', () => {
    expect(distinctYears(data)).toEqual([2026, 2025]);
  });

  it('returns the same array when no month/year is selected', () => {
    expect(filterByMonthYear(data, 'all', 'all')).toBe(data);
  });

  it('filters by year', () => {
    expect(filterByMonthYear(data, 'all', 2025).map((x) => x.month_year)).toEqual([
      'January 2025',
      'June 2025',
    ]);
  });

  it('filters by month across years', () => {
    expect(filterByMonthYear(data, 5, 'all').map((x) => x.month_year)).toEqual([
      'June 2025',
      'June 2026',
    ]);
  });

  it('filters by month and year together', () => {
    expect(filterByMonthYear(data, 5, 2026).map((x) => x.month_year)).toEqual(['June 2026']);
  });

  it('drops unparseable dates when a filter is active', () => {
    expect(filterByMonthYear(data, 'all', 2025).some((x) => x.month_year === 'not a date')).toBe(false);
  });
});
