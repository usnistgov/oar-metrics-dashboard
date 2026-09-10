/** Shared display formatters for metric values, kept consistent across cards. */

/** Bytes -> a compact TB/GB/MB string (mirrors the collections card). */
export function formatSize(bytes: number): string {
  const tb = bytes * 1e-12;
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  const gb = bytes * 1e-9;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes * 1e-6).toFixed(0)} MB`;
}

/** Whole number with thousands separators. */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

/**
 * Parse a timestamp from the metrics API to epoch ms. The backend emits ISO strings in UTC but
 * WITHOUT a zone marker (e.g. "2026-09-10T13:15:13"); the JS Date parser reads an offset-less
 * date-time as browser-LOCAL, shifting the instant by the local offset (so a recent event can look
 * like it is in the future). We append "Z" when a time is present and no zone is, so it reads as UTC.
 * Returns NaN for empty or unparseable input.
 */
export function parseApiDate(value: string | null | undefined): number {
  if (!value) return NaN;
  const s = value.trim();
  const hasTime = /\d{2}:\d{2}/.test(s);
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  return new Date(hasTime && !hasZone ? `${s}Z` : s).getTime();
}

/** A share value (0..100) -> a short percent label. */
export function formatPct(pct: number): string {
  if (!isFinite(pct) || pct <= 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}
