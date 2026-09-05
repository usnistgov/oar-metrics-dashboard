import { Component, ElementRef, computed, inject, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MonthOption } from '../../month-filter';

/**
 * A custom month-year range selector: two connected dropdowns, From -> To, each picking a specific
 * month-year present in the data. The lists stay valid: From only offers months before To, and To
 * only offers months after From (so the two can never cross). Uses the app's themed mat-menu.
 * Stateless - the parent owns the values and reacts to the change events.
 */
@Component({
  selector: 'app-month-range',
  standalone: true,
  imports: [MatMenuModule, MatIconModule, MatTooltipModule],
  templateUrl: './month-range.component.html',
  styleUrl: './month-range.component.css',
})
export class MonthRangeComponent {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input<MonthOption[]>([]);
  readonly from = input<string>('');
  readonly to = input<string>('');
  readonly fromChange = output<string>();
  readonly toChange = output<string>();

  /** From can only be a month strictly before the current To. */
  readonly fromOptions = computed(() => {
    const to = this.to();
    return to ? this.options().filter((o) => o.value < to) : this.options();
  });

  /** To can only be a month strictly after the current From. */
  readonly toOptions = computed(() => {
    const from = this.from();
    return from ? this.options().filter((o) => o.value > from) : this.options();
  });

  readonly fromLabel = computed(() => this.options().find((o) => o.value === this.from())?.label ?? '');
  readonly toLabel = computed(() => this.options().find((o) => o.value === this.to())?.label ?? '');

  /**
   * While a From/To dropdown is open the mouse sits on the menu overlay (outside the card), so the
   * card loses :hover. Mirror the hover state onto the ancestor card via a `menu-open` class so the
   * card keeps its elevated look until the menu closes. No-op when not inside a card (e.g. dialogs).
   */
  onMenuToggle(open: boolean): void {
    this.el.nativeElement.closest('.mat-mdc-card')?.classList.toggle('menu-open', open);
  }
}

