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

/** A share value (0..100) -> a short percent label. */
export function formatPct(pct: number): string {
  if (!isFinite(pct) || pct <= 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}
