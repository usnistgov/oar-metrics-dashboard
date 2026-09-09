import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { CdkDropList, CdkDrag, CdkDragHandle, CdkDragDrop } from '@angular/cdk/drag-drop';
import { MetricsService } from '../../services/metrics.service';
import { LayoutService } from '../../services/layout.service';
import { KpiSummaryComponent } from '../kpi-summary/kpi-summary.component';
import { CurrentDateComponent } from '../current-date/current-date.component';
import { MonthlyGraphComponent } from '../monthly-graph/monthly-graph.component';
import { LatestDownloadsComponent } from "../latest-downloads/latest-downloads.component";
import { MostPopularComponent } from '../most-popular/most-popular.component';
import { PopularScienceDomainsComponent } from '../popular-science-domains/popular-science-domains.component';
import { MonthlyDownloadsComponent } from '../monthly-downloads/monthly-downloads.component';
import { MonthlyUsersComponent } from '../monthly-users/monthly-users.component';
import { DataciteTestComponent } from '../datacite-test/datacite-test.component';
import { WatchlistComponent } from '../watchlist/watchlist.component';
import { EngagementComponent } from '../engagement/engagement.component';
import { SeasonalityComponent } from '../seasonality/seasonality.component';
import { SortByComponent } from '../sort-by/sort-by.component';
import { DomainLevelToggleComponent } from '../domain-level-toggle/domain-level-toggle.component';
import { ConcentrationComponent } from '../concentration/concentration.component';
import { RepoHealthComponent } from '../repo-health/repo-health.component';
import { CollectionsComponent } from '../collections/collections.component';
import { CollectionShareComponent } from '../collection-share/collection-share.component';
import { UntrackedDatasetsComponent } from '../untracked-datasets/untracked-datasets.component';
import { LoadErrorComponent } from '../load-error/load-error.component';

/**
 * Dashboard shell: the top toolbar (brand, last-updated indicator, manual refresh) and the
 * responsive grid of metric cards. Holds no data itself - each card reads from MetricsService.
 */
@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatMenuModule,
    MatTooltipModule, CdkDropList, CdkDrag, CdkDragHandle, KpiSummaryComponent, CurrentDateComponent,
    MonthlyGraphComponent, LatestDownloadsComponent, MostPopularComponent, PopularScienceDomainsComponent,
    MonthlyDownloadsComponent, MonthlyUsersComponent, DataciteTestComponent, WatchlistComponent,
    EngagementComponent, SeasonalityComponent, SortByComponent, DomainLevelToggleComponent,
    ConcentrationComponent, RepoHealthComponent, CollectionsComponent, CollectionShareComponent,
    UntrackedDatasetsComponent, LoadErrorComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  // Exposed to the template for the "Updated …" indicator + manual hard-refresh button.
  readonly metrics = inject(MetricsService);
  // Per-widget show/hide state + draggable card order.
  readonly layout = inject(LayoutService);

  /** Persist a drag-to-reorder of the visible cards. */
  drop(event: CdkDragDrop<string[]>): void {
    this.layout.reorderVisible(event.previousIndex, event.currentIndex);
  }

  /** Block dropping an unpinned card into the pinned zone (the first N slots stay fixed). */
  readonly sortPredicate = (index: number): boolean => index >= this.layout.pinnedVisibleCount();
}
