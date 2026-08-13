import { Component, computed, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MONTHS, MonthValue, YearValue } from '../../month-filter';

/**
 * A connected "Period" date selector: two custom dropdowns (Month, Year) joined into one control,
 * using the app's themed mat-menu (no native browser <select>). Reusable in both the chart cards
 * and their expanded dialogs. Stateless - the parent owns the values and reacts to the change events.
 */
@Component({
  selector: 'app-month-year-filter',
  standalone: true,
  imports: [MatMenuModule, MatIconModule, MatTooltipModule],
  templateUrl: './month-year-filter.component.html',
  styleUrl: './month-year-filter.component.css',
})
export class MonthYearFilterComponent {
  readonly years = input<number[]>([]);
  readonly month = input<MonthValue>('all');
  readonly year = input<YearValue>('all');
  readonly monthChange = output<MonthValue>();
  readonly yearChange = output<YearValue>();

  readonly months = MONTHS;
  readonly monthLabel = computed(() => {
    const m = this.month();
    return m === 'all' ? 'All months' : MONTHS[m].label;
  });
  readonly yearLabel = computed(() => {
    const y = this.year();
    return y === 'all' ? 'All years' : String(y);
  });
}
