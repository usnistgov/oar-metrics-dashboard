import { Component, computed, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface SortOption {
  value: string;
  label: string;
}

/**
 * A compact, custom "Sort by" dropdown using the app's themed mat-menu (no native <select>), sharing
 * the visual language of the Period control. Stateless - the parent owns the value and reacts to
 * `valueChange`.
 */
@Component({
  selector: 'app-sort-by',
  standalone: true,
  imports: [MatMenuModule, MatIconModule, MatTooltipModule],
  templateUrl: './sort-by.component.html',
  styleUrl: './sort-by.component.css',
})
export class SortByComponent {
  readonly label = input<string>('Sort by');
  readonly options = input<SortOption[]>([]);
  readonly value = input<string>('');
  readonly valueChange = output<string>();

  readonly currentLabel = computed(
    () => this.options().find((o) => o.value === this.value())?.label ?? '',
  );
}
