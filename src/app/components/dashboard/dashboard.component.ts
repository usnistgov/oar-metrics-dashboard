import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CdkDropList, CdkDrag, CdkDragHandle, CdkDragDrop } from '@angular/cdk/drag-drop';
import { MetricsService } from '../../services/metrics.service';
import { SettingsDialogComponent } from '../settings-dialog/settings-dialog.component';
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
import { ConcentrationComponent } from '../concentration/concentration.component';
import { RepoHealthComponent } from '../repo-health/repo-health.component';
import { CollectionsComponent } from '../collections/collections.component';
import { CollectionShareComponent } from '../collection-share/collection-share.component';

/**
 * Dashboard shell: the top toolbar (brand, last-updated indicator, manual refresh) and the
 * responsive grid of metric cards. Holds no data itself - each card reads from MetricsService.
 */
@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatMenuModule,
    MatTooltipModule, MatDialogModule, CdkDropList, CdkDrag, CdkDragHandle, KpiSummaryComponent, CurrentDateComponent,
    MonthlyGraphComponent, LatestDownloadsComponent, MostPopularComponent, PopularScienceDomainsComponent,
    MonthlyDownloadsComponent, MonthlyUsersComponent, DataciteTestComponent, WatchlistComponent,
    EngagementComponent, SeasonalityComponent, SortByComponent,
    ConcentrationComponent, RepoHealthComponent, CollectionsComponent, CollectionShareComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  // Exposed to the template for the "Updated …" indicator + manual hard-refresh button.
  readonly metrics = inject(MetricsService);
  // Per-widget show/hide state + draggable card order.
  readonly layout = inject(LayoutService);
  private dialog = inject(MatDialog);

  /** Open the settings dialog (from the KPI action stack). */
  openSettings(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '420px',
      maxWidth: '94vw',
      maxHeight: '85vh',
      autoFocus: 'dialog',
      ariaLabel: 'Settings',
    });
  }

  /** Persist a drag-to-reorder of the visible cards. */
  drop(event: CdkDragDrop<string[]>): void {
    this.layout.reorderVisible(event.previousIndex, event.currentIndex);
  }

  /** Block dropping an unpinned card into the pinned zone (the first N slots stay fixed). */
  readonly sortPredicate = (index: number): boolean => index >= this.layout.pinnedVisibleCount();
}
