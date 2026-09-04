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

// --- Custom month-year range (From -> To) ------------------------------------

/** A selectable month-year for the From/To range pickers. `value` is a sortable 'YYYY-MM' key. */
export interface MonthOption {
  value: string; // 'YYYY-MM'
  label: string; // 'Mon YYYY'
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM' key for a month_year string (lexically comparable), or null if unparseable. */
export function monthKey(monthYear: string): string | null {
  const d = new Date(monthYear ?? '');
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Distinct month-years present in the data, oldest first - drives the From/To pickers. */
export function monthYearOptions(data: RepoMetric[]): MonthOption[] {
  const map = new Map<string, string>();
  for (const item of data) {
    const d = new Date(item.month_year ?? '');
    if (isNaN(d.getTime())) continue;
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(value, `${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, label]) => ({ value, label }));
}

/** Keep rows within the inclusive [from, to] month range (either bound may be null = open-ended). */
export function filterByMonthRange(
  data: RepoMetric[],
  from: string | null,
  to: string | null,
): RepoMetric[] {
  if (!from && !to) return data;
  return data.filter((item) => {
    const k = monthKey(item.month_year ?? '');
    if (!k) return false;
    if (from && k < from) return false;
    if (to && k > to) return false;
    return true;
  });
}
