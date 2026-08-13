import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin, map } from 'rxjs';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { DataSetMetric, EnrichedDataSetMetric } from '../../models/metrics.models';
import { DatasetDetailComponent } from '../dataset-detail/dataset-detail.component';

/**
 * Latest Downloads card: the five most recently downloaded datasets, with their titles resolved
 * from the shared per-record cache.
 */
@Component({
  selector: 'app-latest-downloads',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, MatDialogModule],
  templateUrl: './latest-downloads.component.html',
  styleUrl: './latest-downloads.component.css'
})
export class LatestDownloadsComponent implements OnInit {
  private metrics = inject(MetricsService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  readonly watch = inject(WatchlistService);

  recentLogs: EnrichedDataSetMetric[] = []; // The 5 most recent downloads with their titles.
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    // Read the shared dataset list; re-render on auto/manual refresh.
    this.metrics.datasetMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => this.render(data));
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

  private render(data: DataSetMetric[]): void {
    // A few extra (top 10) so we can still show 5 after dropping any with unresolved titles.
    const recent = data
      .filter((item) => item.last_time_logged)
      .sort((a, b) => new Date(b.last_time_logged ?? 0).getTime() - new Date(a.last_time_logged ?? 0).getTime())
      .slice(0, 10);

    if (recent.length === 0) {
      this.recentLogs = [];
      this.errorMsg.set(this.metrics.datasetError() ? 'Failed to load data.' : null);
      this.loading.set(false);
      return;
    }

    forkJoin(
      recent.map((log) =>
        this.metrics
          .record(log.ediid)
          .pipe(map((rec): EnrichedDataSetMetric => ({ ...log, title: rec?.title || '' })))
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => {
        this.errorMsg.set(null);
        this.loading.set(false);
        this.recentLogs = results.filter((log) => log.title).slice(0, 5);
      });
  }
}
