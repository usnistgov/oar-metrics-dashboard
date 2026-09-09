import { Component, computed, effect, input, signal } from '@angular/core';
import { formatCount, formatSize } from '../../format';
import { animateCount } from '../../animate';

/**
 * Renders a number that counts up to its value on first paint (and re-counts if the value changes),
 * using the shared ease-out tween. `kind` picks the formatter: a plain count or a data size.
 */
@Component({
  selector: 'app-count',
  standalone: true,
  template: `{{ display() }}`,
})
export class CountComponent {
  readonly value = input.required<number>();
  readonly kind = input<'count' | 'size'>('count');

  private readonly current = signal(0);
  readonly display = computed(() =>
    this.kind() === 'size' ? formatSize(this.current()) : formatCount(this.current()),
  );

  constructor() {
    effect(() => animateCount(this.current, this.value()));
  }
}
