import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin, map } from 'rxjs';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { DataSetMetric, EnrichedDataSetMetric } from '../../models/metrics.models';
import { DatasetDialogComponent } from '../dataset-dialog/dataset-dialog.component';
import { CustomCountDialogComponent } from '../custom-count-dialog/custom-count-dialog.component';
import { DatasetDetailComponent } from '../dataset-detail/dataset-detail.component';
import { PopularSort, popularSubLabel, rankDatasets } from '../../popular-sort';

// Re-exported so existing importers (e.g. collection-detail) keep resolving it from here.
export type { PopularSort };

/**
 * Most Popular Datasets card: the top datasets ranked by downloads, unique users, data volume, or
 * recency (chosen from the actions menu). The count (5 / 10 / a custom value) is also chosen from
 * that menu and remembered in localStorage; titles are resolved from the shared per-record cache.
 */
@Component({
  selector: 'app-most-popular',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, MatDialogModule],
  templateUrl: './most-popular.component.html',
  styleUrl: './most-popular.component.css'
})
export class MostPopularComponent implements OnInit {
  private static readonly COUNT_KEY = 'mostPopular.count'; // localStorage key

  private metrics = inject(MetricsService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  readonly watch = inject(WatchlistService);

  private allDatasets: DataSetMetric[] = []; // Shared usage metrics from the service.
  mostPopularLog: EnrichedDataSetMetric[] = []; // The list rendered inline as dataset cards.
  count = '5';                                   // How many cards to show (persisted to localStorage).
  readonly sortKey = signal<PopularSort>('downloads'); // Active ranking metric.
  // Options for the header "Sort by" dropdown (value matches PopularSort).
  readonly sortOptions: { value: PopularSort; label: string }[] = [
    { value: 'downloads', label: 'Downloads' },
    { value: 'users', label: 'Unique users' },
    { value: 'volume', label: 'Data volume' },
    { value: 'recent', label: 'Most recent' },
  ];
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.count = this.loadCount(); // Restore the remembered count (custom or preset).
    // Read the shared dataset list; re-render on auto/manual refresh.
    this.metrics.datasetMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.allDatasets = data;
      this.render(this.parsedCount());
    });
  }

  // Public landing page for a dataset on the NIST PDR (the "View Dataset" hover action).
  datasetUrl(ediid: string): string {
    return `https://data.nist.gov/od/id/${ediid}`;
  }

  // Open the right-side detail drawer for a dataset row.
  openDetail(log: EnrichedDataSetMetric): void {
    this.dialog.open(DatasetDetailComponent, {
      data: { metric: log },
      panelClass: 'detail-panel',
      position: { right: '0', top: '0' },
      width: '420px',
      maxWidth: '92vw',
      height: '100vh',
      autoFocus: 'dialog',
      ariaLabel: 'Dataset details',
    });
  }

  // Parse the count, falling back to 5 for empty/invalid values.
  private parsedCount(): number {
    const n = parseInt(this.count, 10);
    return isNaN(n) || n <= 0 ? 5 : n;
  }

  // --- persistence ---------------------------------------------------------
  private loadCount(): string {
    try {
      const saved = localStorage.getItem(MostPopularComponent.COUNT_KEY);
      if (saved && parseInt(saved, 10) > 0) return saved;
    } catch { /* storage unavailable */ }
    return '5';
  }
  private saveCount(): void {
    try {
      localStorage.setItem(MostPopularComponent.COUNT_KEY, this.count);
    } catch { /* storage unavailable */ }
  }

  // --- actions-menu --------------------------------------------------------
  // Show a preset number of datasets.
  showCount(n: number): void {
    this.count = String(n);
    this.saveCount();
    this.render(n);
  }

  // Open the custom-count dialog; apply + remember the entered value.
  enableCustom(): void {
    this.dialog
      .open(CustomCountDialogComponent, { width: '360px', maxWidth: '95vw', data: this.parsedCount() })
      .afterClosed()
      .subscribe((n: number | undefined) => {
        if (n && n > 0) {
          this.count = String(n);
          this.saveCount();
          this.render(n);
        }
      });
  }

  resetCount(): void {
    this.count = '5';
    this.saveCount();
    this.render(5);
  }

  // Open the same list in a clean, larger Material dialog.
  openExpanded(): void {
    this.dialog.open(DatasetDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      autoFocus: 'dialog',   // focus the dialog, not the Close button
      data: {
        title: 'Most Popular Datasets',
        items: this.mostPopularLog.map((log, i) => ({
          rank: i + 1,
          title: log.title,
          sub: this.subLabel(log),
        })),
      },
    });
  }

  // Switch the ranking metric and re-render (titles are cached, so this is cheap).
  setSort(key: PopularSort): void {
    if (this.sortKey() === key) return;
    this.sortKey.set(key);
    this.render(this.parsedCount());
  }

  // The sub-line shown under each title, reflecting the active sort metric.
  subLabel(log: EnrichedDataSetMetric): string {
    return popularSubLabel(log, this.sortKey());
  }

  // Takes the top `amount` datasets by the active metric and resolves titles via the cached service.
  private render(amount: number): void {
    const top = rankDatasets(this.allDatasets, this.sortKey(), amount);

    if (top.length === 0) {
      this.mostPopularLog = [];
      this.errorMsg.set(this.metrics.datasetError() ? 'Failed to load data.' : null);
      this.loading.set(false);
      return;
    }

    // record() is cached per ediid, so titles already fetched by other cards are reused.
    forkJoin(
      top.map((log) =>
        this.metrics
          .record(log.ediid)
          .pipe(map((rec): EnrichedDataSetMetric => ({ ...log, title: rec?.title || 'No Title Found' })))
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => {
        this.errorMsg.set(null);
        this.loading.set(false);
        this.mostPopularLog = results.filter((log) => log.title && log.title !== 'No Title Found');
      });
  }
}
