import { Component, input, output } from '@angular/core';

/** Time-range options for the monthly charts. */
export type RangeKey = 'l12' | 'l24' | 'all';

/**
 * A compact, polished segmented control for choosing a chart time range (last 12 / 24 months / all).
 * Presentational only: it reflects `value` and emits `valueChange`; the parent owns the state.
 */
@Component({
  selector: 'app-range-toggle',
  standalone: true,
  imports: [],
  template: `
    <div class="range-toggle" role="group" aria-label="Chart time range">
      @for (opt of options; track opt.key) {
        <button
          type="button"
          class="range-opt"
          [class.active]="value() === opt.key"
          [attr.aria-pressed]="value() === opt.key"
          [attr.aria-label]="opt.aria"
          (click)="valueChange.emit(opt.key)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
  styleUrl: './range-toggle.component.css',
})
export class RangeToggleComponent {
  // Accepts any string so a custom (non-preset) range highlights none of the options.
  readonly value = input<string>('all');
  readonly valueChange = output<RangeKey>();

  readonly options = [
    { key: 'l12' as const, label: '12M', aria: 'Last 12 months' },
    { key: 'l24' as const, label: '24M', aria: 'Last 24 months' },
    { key: 'all' as const, label: 'All', aria: 'All months' },
  ];
}
