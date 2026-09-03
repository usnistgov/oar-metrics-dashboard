import { Component, computed, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScopeService } from '../../services/scope.service';
import { CollectionMembership } from '../../models/metrics.models';
import { formatCount } from '../../format';
import { collectionSlug } from '../../scope-stats';

/**
 * Sticky scope/context bar for the Collections pages: a breadcrumb, a searchable collection picker
 * (type to switch), the active collection's dataset count, and a "clear to all collections" action.
 * The accent-tinted left border makes it unmistakable that the page below is scoped to one collection.
 */
@Component({
  selector: 'app-scope-bar',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './scope-bar.component.html',
  styleUrl: './scope-bar.component.css',
})
export class ScopeBarComponent {
  readonly scope = inject(ScopeService);
  private router = inject(Router);

  readonly search = new FormControl('');
  private readonly term = toSignal(this.search.valueChanges, { initialValue: '' });

  readonly fmtCount = formatCount;

  /** Collections filtered by the current search term (case-insensitive title match). */
  readonly filtered = computed(() => {
    const t = (this.term() ?? '').toString().toLowerCase().trim();
    const all = this.scope.collections();
    return t ? all.filter((c) => c.title.toLowerCase().includes(t)) : all;
  });

  readonly activeTitle = computed(() => this.scope.activeMembership()?.title ?? '');

  onSelect(event: MatAutocompleteSelectedEvent): void {
    const c = event.option.value as CollectionMembership;
    if (c?.id) {
      this.search.setValue('');
      this.router.navigate(['/collections', collectionSlug(c.id)]);
    }
  }

  clear(): void {
    this.router.navigate(['/collections']);
  }
}
