import { Component, computed, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MonthOption } from '../../month-filter';

/**
 * A custom month-year range selector: two connected dropdowns, From -> To, each picking a specific
 * month-year present in the data (or Earliest / Latest for an open bound). Uses the app's themed
 * mat-menu (no native <select>). Stateless - the parent owns the values and reacts to the changes.
 */
@Component({
  selector: 'app-month-range',
  standalone: true,
  imports: [MatMenuModule, MatIconModule, MatTooltipModule],
  templateUrl: './month-range.component.html',
  styleUrl: './month-range.component.css',
})
export class MonthRangeComponent {
  readonly options = input<MonthOption[]>([]);
  readonly from = input<string | null>(null);
  readonly to = input<string | null>(null);
  readonly fromChange = output<string | null>();
  readonly toChange = output<string | null>();

  readonly fromLabel = computed(
    () => this.options().find((o) => o.value === this.from())?.label ?? 'Earliest',
  );
  readonly toLabel = computed(
    () => this.options().find((o) => o.value === this.to())?.label ?? 'Latest',
  );
}
