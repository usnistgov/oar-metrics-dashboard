import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, OnDestroy, effect, inject, input, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

/** Tag of the externally-loaded DataCite metrics web component (see index.html / unpkg CDN). */
const DATACITE_BADGE_TAG = 'data-metrics-badge';

/** Display modes the third-party widget supports. */
export type DataciteBadgeDisplay = 'small' | 'medium' | 'datacite' | 'regular';

/**
 * Reusable wrapper around DataCite's `<data-metrics-badge>` web component.
 *
 * It encapsulates the three quirks of that third-party widget:
 * 1. **Size:** it has no size API and renders in an OPEN shadow DOM, so external CSS can't reach it.
 *    `zoom` scales the whole widget; `imageSize` trims its badge graphic via a `<style>` injected
 *    into the shadow root.
 * 2. **Re-render:** it doesn't react to attribute changes, so the element is re-mounted on DOI change.
 * 3. **Availability:** it's loaded from a CDN; if that failed, we show an inline fallback.
 */
@Component({
  selector: 'app-datacite-badge',
  imports: [MatProgressSpinnerModule, MatIconModule],
  templateUrl: './datacite-badge.component.html',
  styleUrl: './datacite-badge.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DataciteBadgeComponent implements OnDestroy {
  /** Bare DOI (no "doi:" prefix), e.g. `10.18434/mds2-2531`. Empty → nothing renders. */
  readonly doi = input<string>('');
  /** Overall scale of the widget (CSS `zoom`). 1 = native size. */
  readonly zoom = input<number>(0.6);
  /** Size (px) of the badge graphic inside the widget. */
  readonly imageSize = input<number>(86);
  /** The widget's display mode. */
  readonly display = input<DataciteBadgeDisplay>('regular');

  private host = inject(ElementRef<HTMLElement>);

  /** CDN availability: null = checking, true/false = resolved. */
  readonly available = signal<boolean | null>(null);
  /** Whether the badge element is mounted (toggled to force a re-render on DOI change). */
  readonly mounted = signal(false);

  private mountHandle?: ReturnType<typeof setTimeout>;
  private availabilityHandle?: ReturnType<typeof setTimeout>;
  private injectHandle?: ReturnType<typeof setTimeout>;

  constructor() {
    this.checkAvailability();
    // Re-mount the badge whenever the DOI changes (the web component ignores attribute updates).
    effect(() => {
      const doi = this.doi();
      this.remount(!!doi);
    });
    // Re-apply size when imageSize changes while already mounted (no full re-mount needed).
    effect(() => {
      this.imageSize();
      if (this.mounted()) this.injectStyles();
    });
  }

  private remount(hasDoi: boolean): void {
    this.mounted.set(false);
    clearTimeout(this.mountHandle);
    if (!hasDoi) return;
    this.mountHandle = setTimeout(() => {
      this.mounted.set(true);
      this.injectStyles();
    }, 50);
  }

  private checkAvailability(): void {
    if (typeof customElements === 'undefined') {
      this.available.set(false);
      return;
    }
    if (customElements.get(DATACITE_BADGE_TAG)) {
      this.available.set(true);
      return;
    }
    let settled = false;
    customElements.whenDefined(DATACITE_BADGE_TAG).then(() => {
      if (!settled) { settled = true; this.available.set(true); }
    });
    this.availabilityHandle = setTimeout(() => {
      if (!settled) { settled = true; this.available.set(false); }
    }, 4000);
  }

  /**
   * Inject compact styles into the badge's OPEN shadow root (external CSS can't pierce shadow DOM).
   * Retries briefly because Angular renders the element and the widget mounts its content async.
   */
  private injectStyles(attempt = 0): void {
    if (attempt === 0) clearTimeout(this.injectHandle);
    const badge = this.host.nativeElement.querySelector(DATACITE_BADGE_TAG) as
      | (HTMLElement & { shadowRoot: ShadowRoot | null })
      | null;
    const root = badge?.shadowRoot ?? null;
    if (root) {
      let style = root.querySelector<HTMLStyleElement>('style[data-dc-compact]');
      if (!style) {
        style = document.createElement('style');
        style.setAttribute('data-dc-compact', '');
        root.appendChild(style);
      }
      const px = this.imageSize();
      style.textContent = `
        .medium-badge { width: ${px}px !important; height: ${px}px !important; }
        .metrics { padding-top: 4px !important; }
        .panel-footer { font-size: 12px !important; line-height: 1.3 !important; }
      `;
      return;
    }
    if (attempt < 25) {
      this.injectHandle = setTimeout(() => this.injectStyles(attempt + 1), 60);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.mountHandle);
    clearTimeout(this.availabilityHandle);
    clearTimeout(this.injectHandle);
  }
}
