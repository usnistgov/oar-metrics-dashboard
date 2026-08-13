import { RepoMetric } from './models/metrics.models';

/** Dropdown value: a 0-based month index, a 4-digit year, or 'all' (no constraint). */
export type MonthValue = number | 'all';
export type YearValue = number | 'all';

/** Month options for the filter dropdown (value is the JS month index). */
export const MONTHS: { value: number; label: string }[] = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' },
];

/** Distinct years present in the data, newest first (drives the Year dropdown). */
export function distinctYears(data: RepoMetric[]): number[] {
  const set = new Set<number>();
  for (const item of data) {
    const d = new Date(item.month_year ?? '');
    if (!isNaN(d.getTime())) set.add(d.getFullYear());
  }
  return [...set].sort((a, b) => b - a);
}

/** Keep rows matching the selected month and/or year (either may be 'all'). */
export function filterByMonthYear(
  data: RepoMetric[],
  month: MonthValue,
  year: YearValue,
): RepoMetric[] {
  if (month === 'all' && year === 'all') return data;
  return data.filter((item) => {
    const d = new Date(item.month_year ?? '');
    if (isNaN(d.getTime())) return false;
    return (year === 'all' || d.getFullYear() === year) && (month === 'all' || d.getMonth() === month);
  });
}
