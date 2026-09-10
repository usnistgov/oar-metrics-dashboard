import { Component, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ScopeBarComponent } from '../scope-bar/scope-bar.component';
import { MostPopularComponent } from '../most-popular/most-popular.component';
import { PopularScienceDomainsComponent } from '../popular-science-domains/popular-science-domains.component';
import { CollectionGrowthComponent } from '../collection-growth/collection-growth.component';
import { DomainLevelToggleComponent } from '../domain-level-toggle/domain-level-toggle.component';
import { ScopeService } from '../../services/scope.service';
import { formatCount, formatSize } from '../../format';
import { animateCount } from '../../animate';

/**
 * Collections Metrics scoped view: every figure on this page is scoped to the collection named in the
 * route (`/collections/:id`). Phase 1 shows the totals-based summary (downloads, user-sessions, data
 * volume, dataset count); monthly trend charts remain repository-wide until a per-dataset monthly
 * series exists (see the notice + ScopeService docs).
 */
@Component({
  selector: 'app-collection-scoped',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    ScopeBarComponent,
    MostPopularComponent,
    PopularScienceDomainsComponent,
    CollectionGrowthComponent,
    DomainLevelToggleComponent,
  ],
  templateUrl: './collection-scoped.component.html',
  styleUrl: './collection-scoped.component.css',
})
export class CollectionScopedComponent {
  readonly scope = inject(ScopeService);
  private route = inject(ActivatedRoute);

  readonly fmtCount = formatCount;
  readonly fmtSize = formatSize;

  // Count-up copies of the headline figures, matching the dashboard KPI motion.
  readonly downloadsAnim = signal(0);
  readonly usersAnim = signal(0);
  readonly sizeAnim = signal(0);
  readonly datasetsAnim = signal(0);

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((p) => this.scope.setCollection(p.get('id')));

    // Count the headline numbers up whenever a collection's detail loads (or changes).
    effect(() => {
      const d = this.scope.detail();
      if (!d) return;
      animateCount(this.downloadsAnim, d.downloads);
      animateCount(this.usersAnim, d.users);
      animateCount(this.sizeAnim, d.size);
      animateCount(this.datasetsAnim, d.membersWithUsage);
    });
  }
}
