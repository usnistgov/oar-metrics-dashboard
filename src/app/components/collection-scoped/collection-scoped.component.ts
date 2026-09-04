import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ScopeBarComponent } from '../scope-bar/scope-bar.component';
import { MostPopularComponent } from '../most-popular/most-popular.component';
import { PopularScienceDomainsComponent } from '../popular-science-domains/popular-science-domains.component';
import { CollectionGrowthComponent } from '../collection-growth/collection-growth.component';
import { SortByComponent } from '../sort-by/sort-by.component';
import { ScopeService } from '../../services/scope.service';
import { formatCount, formatPct, formatSize } from '../../format';
import { sharePct } from '../../scope-stats';

/**
 * Collections Metrics scoped view: every figure on this page is scoped to the collection named in the
 * route (`/collections/:id`). Phase 1 shows the totals-based summary (downloads, user-sessions, data
 * volume, dataset count) with share-of-repo and rank; monthly trend charts remain repository-wide
 * until a per-dataset monthly series exists (see the notice + ScopeService docs).
 */
@Component({
  selector: 'app-collection-scoped',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    ScopeBarComponent,
    MostPopularComponent,
    PopularScienceDomainsComponent,
    CollectionGrowthComponent,
    SortByComponent,
  ],
  templateUrl: './collection-scoped.component.html',
  styleUrl: './collection-scoped.component.css',
})
export class CollectionScopedComponent {
  readonly scope = inject(ScopeService);
  private route = inject(ActivatedRoute);

  readonly fmtCount = formatCount;
  readonly fmtSize = formatSize;
  readonly fmtPct = formatPct;
  readonly sharePct = sharePct;

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((p) => this.scope.setCollection(p.get('id')));
  }
}
