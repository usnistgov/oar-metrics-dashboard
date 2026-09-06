import { Component, input, output } from '@angular/core';
import { DomainLevel } from '../../science-domains';

/**
 * Compact segmented control for the Science Domains card: switch between the broad top-level
 * "Domain" buckets and the granular "Subdomain" paths. Presentational only: reflects `value` and
 * emits `valueChange`; the parent owns the state.
 */
@Component({
  selector: 'app-domain-level-toggle',
  standalone: true,
  imports: [],
  template: `
    <div class="lvl-toggle" role="group" aria-label="Group science domains by">
      @for (opt of options; track opt.key) {
        <button
          type="button"
          class="lvl-opt"
          [class.active]="value() === opt.key"
          [attr.aria-pressed]="value() === opt.key"
          (click)="valueChange.emit(opt.key)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      /* iOS-style segmented control, matching the chart range toggle. */
      .lvl-toggle {
        display: inline-flex;
        align-items: center;
        height: 32px;
        padding: 2px;
        gap: 2px;
        box-sizing: border-box;
        background: var(--color-surface-2);
        border: 1px solid var(--color-line);
        border-radius: 8px;
      }
      .lvl-opt {
        appearance: none;
        border: none;
        background: transparent;
        color: var(--color-muted);
        font: inherit;
        font-size: 0.76rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        height: 100%;
        padding: 0 0.6rem;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
      }
      .lvl-opt:hover {
        color: var(--color-text);
      }
      .lvl-opt.active {
        background: var(--color-surface);
        color: var(--color-accent-strong);
        box-shadow: 0 1px 2px rgba(16, 24, 40, 0.12);
      }
      .lvl-opt:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 1px;
      }
    `,
  ],
})
export class DomainLevelToggleComponent {
  readonly value = input<DomainLevel>('top');
  readonly valueChange = output<DomainLevel>();

  readonly options = [
    { key: 'top' as const, label: 'Domain' },
    { key: 'sub' as const, label: 'Subdomain' },
  ];
}
