import { signal } from '@angular/core';
import { animateCount } from './animate';

describe('animateCount', () => {
  const original = (globalThis as { matchMedia?: unknown }).matchMedia;
  afterEach(() => {
    (globalThis as { matchMedia?: unknown }).matchMedia = original;
  });

  function mockReducedMotion(matches: boolean): void {
    (globalThis as { matchMedia?: unknown }).matchMedia = jest.fn().mockReturnValue({ matches });
  }

  it('sets the target immediately when duration is zero', () => {
    mockReducedMotion(false);
    const sig = signal(0);
    animateCount(sig, 4200, 0);
    expect(sig()).toBe(4200);
  });

  it('jumps straight to the target under prefers-reduced-motion (no tween)', () => {
    mockReducedMotion(true);
    const sig = signal(0);
    animateCount(sig, 999); // default duration, but reduced-motion short-circuits
    expect(sig()).toBe(999);
  });

  it('does not settle synchronously when motion is allowed', () => {
    mockReducedMotion(false);
    const sig = signal(0);
    animateCount(sig, 1000, 900);
    // The tween runs over rAF frames, so the value has not reached the target on this tick.
    expect(sig()).toBeLessThan(1000);
  });
});
