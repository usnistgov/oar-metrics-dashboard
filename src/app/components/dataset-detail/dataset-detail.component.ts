import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { EnrichedDataSetMetric, RecordResult } from '../../models/metrics.models';

/**
 * Right-side detail drawer for a single dataset. Opened from a dataset row; shows the usage metrics
 * already on the row plus the DOI and science domains resolved from the shared record cache.
 */
@Component({
  selector: 'app-dataset-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDialogModule, MatTooltipModule],
  templateUrl: './dataset-detail.component.html',
  styleUrl: './dataset-detail.component.css',
})
export class DatasetDetailComponent {
  private ref = inject(MatDialogRef<DatasetDetailComponent>);
  private metrics = inject(MetricsService);
  readonly watch = inject(WatchlistService);
  readonly data = inject<{ metric: EnrichedDataSetMetric }>(MAT_DIALOG_DATA);

  readonly record = signal<RecordResult | null>(null);
  readonly loadingMeta = signal(true);

  constructor() {
    // DOI + domains come from the per-record cache (already fetched for the popular/latest cards).
    this.metrics
      .record(this.data.metric.ediid)
      .pipe(takeUntilDestroyed())
      .subscribe((r) => {
        this.record.set(r);
        this.loadingMeta.set(false);
      });
  }

  get metric(): EnrichedDataSetMetric {
    return this.data.metric;
  }

  title(): string {
    return this.metric.title || this.record()?.title || this.metric.ediid;
  }

  // The dataset's detailed metrics page on the PDR (uses the short ediid, e.g. mds2-2388).
  metricsUrl(): string {
    const short = this.metric.ediid.split('/').pop() ?? this.metric.ediid;
    return `https://data.nist.gov/pdr/metrics/${short}`;
  }

  /** Topic tags if present, otherwise themes; de-duplicated. */
  domains(): string[] {
    const r = this.record();
    if (!r) return [];
    const tags = (r.topic ?? []).map((t) => t.tag);
    const source = tags.some(Boolean) ? tags : (r.theme ?? []);
    return Array.from(new Set(source.map((s) => (s ?? '').trim()).filter(Boolean)));
  }

  /** Bytes formatted with the largest sensible unit. */
  volume(bytes: number | undefined): string {
    const b = bytes ?? 0;
    if (b >= 1e12) return `${(b / 1e12).toFixed(2)} TB`;
    if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
    if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    return `${b.toLocaleString()} B`;
  }

  count(n: number | undefined): string {
    return (n ?? 0).toLocaleString();
  }

  datasetUrl(): string {
    return `https://data.nist.gov/od/id/${this.metric.ediid}`;
  }

  close(): void {
    this.ref.close();
  }
}
