import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScopeService } from '../../services/scope.service';
import { CollectionMembership } from '../../models/metrics.models';
import { collectionSlug } from '../../scope-stats';

/**
 * Sticky scope/context bar for the Collections pages: a breadcrumb plus a scope selector - a pill that
 * shows the active collection and opens a menu to switch, a dataset-count stat, and a "back to all
 * collections" action. The accent-tinted left border and pill make it unmistakable that the page
 * below is scoped to one collection.
 */
@Component({
  selector: 'app-scope-bar',
  standalone: true,
  imports: [RouterLink, MatMenuModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './scope-bar.component.html',
  styleUrl: './scope-bar.component.css',
})
export class ScopeBarComponent {
  readonly scope = inject(ScopeService);
  private router = inject(Router);

  readonly activeTitle = computed(() => this.scope.activeMembership()?.title ?? '');
  readonly activeId = computed(() => this.scope.activeMembership()?.id ?? null);

  /** Public landing page for the active collection on the data repository. */
  readonly collectionUrl = computed(() => {
    const id = this.scope.activeMembership()?.id;
    return id ? `https://data.nist.gov/od/id/${id}` : '';
  });

  select(c: CollectionMembership): void {
    if (c?.id) this.router.navigate(['/collections', collectionSlug(c.id)]);
  }
}
