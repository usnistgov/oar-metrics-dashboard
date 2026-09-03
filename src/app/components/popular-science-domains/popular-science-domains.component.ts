import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, Input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { from, map, mergeMap, toArray } from 'rxjs';
import { MetricsService } from '../../services/metrics.service';
import { CategoryCount, DataSetMetric, RecordResult } from '../../models/metrics.models';
import { DatasetDialogComponent } from '../dataset-dialog/dataset-dialog.component';
import { CustomCountDialogComponent } from '../custom-count-dialog/custom-count-dialog.component';
import { aggregateDomains, sampleTopDatasets } from '../../science-domains';

/**
 * Popular Science Domains card: ranks science domains by how many of the top datasets carry each
 * theme/topic tag. It samples the most-downloaded datasets, fetches their metadata, and counts the
 * distinct datasets per domain.
 */
@Component({
  selector: 'app-popular-science-domains',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDialogModule],
  templateUrl: './popular-science-domains.component.html',
  styleUrl: './popular-science-domains.component.css'
})
export class PopularScienceDomainsComponent implements OnInit {
  private static readonly COUNT_KEY = 'scienceDomains.count'; // localStorage key
  private readonly SAMPLE_SIZE = 30; // how many top datasets to inspect for domains (cached + throttled)

  private metrics = inject(MetricsService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  private allDatasets: DataSetMetric[] = []; // Shared usage metrics from the service.
  mostPopularCategories: CategoryCount[] = []; // Rendered inline as dataset cards.
  count = this.loadCount();                     // How many categories to show (persisted to localStorage).

  /**
   * Optional scoped dataset list. When bound (the Collections view passes a collection's member
   * rows), domains are aggregated over THIS list; unbound, the dashboard reads the global stream.
   */
  private scoped: DataSetMetric[] | null = null;
  @Input() set datasets(value: DataSetMetric[] | null) {
    this.scoped = value;
    if (value != null) {
      this.allDatasets = value;
      this.render(this.parsedCount());
    }
  }
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    // Scoped mode (a `datasets` input was bound) renders that list; skip the global stream.
    if (this.scoped != null) return;
    this.metrics.datasetMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.allDatasets = data;
      this.render(this.parsedCount());
    });
  }

  // --- empty / error fallback copy -----------------------------------------
  get emptyTitle(): string {
    return this.errorMsg() ? 'Couldn’t load science domains' : 'No science domains to show';
  }
  get emptyText(): string {
    return this.errorMsg()
      ? 'We couldn’t load the science-domain metrics right now. Please check back in a little while.'
      : 'There aren’t any categorized datasets to summarize right now. Please check back in a little while.';
  }

  private parsedCount(): number {
    const n = parseInt(this.count, 10);
    return isNaN(n) || n <= 0 ? 5 : n;
  }

  // --- persistence ---------------------------------------------------------
  private loadCount(): string {
    try {
      const saved = localStorage.getItem(PopularScienceDomainsComponent.COUNT_KEY);
      if (saved && parseInt(saved, 10) > 0) return saved;
    } catch { /* storage unavailable */ }
    return '5';
  }
  private saveCount(): void {
    try {
      localStorage.setItem(PopularScienceDomainsComponent.COUNT_KEY, this.count);
    } catch { /* storage unavailable */ }
  }

  // --- actions-menu --------------------------------------------------------
  // Show a preset number of domains.
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

  openExpanded(): void {
    this.dialog.open(DatasetDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      autoFocus: 'dialog',   // focus the dialog, not the Close button
      data: {
        title: 'Popular Science Domains',
        items: this.mostPopularCategories.map((c, i) => ({
          rank: i + 1,
          title: c.name,
          sub: `${c.count.toLocaleString()} datasets`,
        })),
      },
    });
  }

  // Inspect the top datasets' metadata (cached/throttled) and aggregate the top `amount` domains.
  private render(amount: number): void {
    const sample = sampleTopDatasets(this.allDatasets, this.SAMPLE_SIZE);

    if (sample.length === 0) {
      this.mostPopularCategories = [];
      this.errorMsg.set(this.metrics.datasetError() ? 'Failed to load data.' : null);
      this.loading.set(false);
      return;
    }

    from(sample)
      .pipe(
        // record() is cached per ediid and shared with the other cards; 6 in flight at most.
        mergeMap((log) => this.metrics.record(log.ediid), 6),
        toArray(),
        map((records: (RecordResult | null)[]) => aggregateDomains(records, amount)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((categories) => {
        this.errorMsg.set(null);
        this.loading.set(false);
        this.mostPopularCategories = categories;
      });
  }
}
