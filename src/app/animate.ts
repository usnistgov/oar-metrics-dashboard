import { WritableSignal } from '@angular/core';

/**
 * Ease a numeric signal from 0 to `target` with a short count-up (ease-out cubic), so headline
 * figures animate into place on first load. Honors `prefers-reduced-motion` by jumping straight to
 * the target. Shared by the dashboard KPI strip and the collection scoped view.
 */
export function animateCount(sig: WritableSignal<number>, target: number, ms = 900): void {
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || ms <= 0) {
    sig.set(target);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    sig.set(target * eased);
    if (t < 1) requestAnimationFrame(step);
    else sig.set(target);
  };
  requestAnimationFrame(step);
}
