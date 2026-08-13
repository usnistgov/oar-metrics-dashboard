import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

/** A quick-pick accent color. `value` is the hex applied as `--color-accent`. */
export interface AccentPreset {
  key: string;
  label: string;
  value: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Owns the app's theme: light/dark mode + the primary accent color (a preset OR a custom hex).
 * Persists both to localStorage and applies them to `<html>` (`data-theme` + the `--color-accent`
 * CSS variable), which the token system in `styles.css` keys off. An inline script in `index.html`
 * applies the saved values before first paint to avoid a flash.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  static readonly MODE_KEY = 'theme.mode';
  static readonly COLOR_KEY = 'theme.color';

  /** Preset accents - a teal-family palette, complements, and a near-black (the header/footer tone). */
  readonly presets: AccentPreset[] = [
    { key: 'teal', label: 'Teal', value: '#0d9488' },
    { key: 'emerald', label: 'Emerald', value: '#059669' },
    { key: 'orange', label: 'Orange', value: '#ea580c' },
    { key: 'blue', label: 'Blue', value: '#2563eb' },
    { key: 'indigo', label: 'Indigo', value: '#4f46e5' },
    { key: 'rose', label: 'Rose', value: '#e11d48' },
    { key: 'black', label: 'Black', value: '#1f2937' }, // matches the header/footer tone
  ];

  readonly mode = signal<ThemeMode>(this.initialMode());
  /** The active accent as a resolved hex (preset value or a user-chosen custom color). */
  readonly color = signal<string>(this.initialColor());

  constructor() {
    this.apply(); // synchronous, before first paint
    effect(() => {
      this.mode();
      this.color();
      this.apply();
    });
  }

  toggleMode(): void {
    this.mode.set(this.mode() === 'dark' ? 'light' : 'dark');
  }

  /** Commit + persist an accent color (preset or custom). */
  setColor(hex: string): void {
    const normalized = this.normalize(hex);
    if (normalized) this.color.set(normalized);
  }

  /** True when `hex` is the active accent (for swatch highlighting). */
  isActive(hex: string): boolean {
    return this.color().toLowerCase() === hex.toLowerCase();
  }

  /** Apply a color to the UI WITHOUT committing/persisting (live preview while picking). */
  preview(hex: string): void {
    const normalized = this.normalize(hex);
    if (normalized) document.documentElement.style.setProperty('--color-accent', normalized);
  }

  /** Re-apply the committed color (cancel a preview). */
  restore(): void {
    document.documentElement.style.setProperty('--color-accent', this.color());
  }

  private normalize(hex: string): string | null {
    const h = (hex || '').trim();
    const withHash = h.startsWith('#') ? h : `#${h}`;
    return HEX_RE.test(withHash) ? withHash.toLowerCase() : null;
  }

  private apply(): void {
    const root = document.documentElement;
    root.setAttribute('data-theme', this.mode());
    root.style.setProperty('--color-accent', this.color());
    try {
      localStorage.setItem(ThemeService.MODE_KEY, this.mode());
      localStorage.setItem(ThemeService.COLOR_KEY, this.color());
    } catch {
      /* storage unavailable - theming still works for the session */
    }
  }

  private initialMode(): ThemeMode {
    try {
      const saved = localStorage.getItem(ThemeService.MODE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* ignore */
    }
    try {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  private initialColor(): string {
    try {
      const saved = this.normalize(localStorage.getItem(ThemeService.COLOR_KEY) ?? '');
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return this.presets[0].value; // teal
  }
}
