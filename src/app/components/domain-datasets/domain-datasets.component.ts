import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest } from 'rxjs';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { EnrichedDataSetMetric } from '../../models/metrics.models';
import { formatCount, formatSize } from '../../format';
import { DomainLevel, domainLabelsOf } from '../../science-domains';
import { PopularSort, popularComparator, popularSubLabel } from '../../popular-sort';
import { SortByComponent } from '../sort-by/sort-by.component';
import { DatasetDetailComponent } from '../dataset-detail/dataset-detail.component';

/** Data passed in when opening the drawer: the domain to list, the grouping level, and an optional
 *  collection scope (member ediids) so it matches the card it was opened from. */
export interface DomainDatasetsData {
  domain: string;
  level: DomainLevel;
  scopedIds: string[] | null;
}

/**
 * Right-side drawer listing every dataset in a science domain. Reuses the shared catalog + usage
 * streams to build the list, the app's dataset-row visual language (ranked `.ds-item` rows, the
 * "View Dataset" pill, the watchlist star, the themed Sort-by dropdown), and opens the same
 * per-dataset detail drawer on a row click. Searchable and sortable.
 */
@Component({
  selector: 'app-domain-datasets',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, MatDialogModule, SortByComponent],
  templateUrl: './domain-datasets.component.html',
  styleUrl: './domain-datasets.component.css',
})
export class DomainDatasetsComponent {
  private ref = inject(MatDialogRef<DomainDatasetsComponent>);
  private dialog = inject(MatDialog);
  private metrics = inject(MetricsService);
  readonly watch = inject(WatchlistService);
  readonly data = inject<DomainDatasetsData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly search = signal('');
  readonly sortKey = signal<PopularSort>('downloads');
  private readonly all = signal<EnrichedDataSetMetric[]>([]);

  // Shared formatters, exposed for the template's totals line.
  readonly formatCount = formatCount;
  readonly formatSize = formatSize;

  // Matches the Most Popular card's Sort-by options so the control reads the same everywhere.
  readonly sortOptions: { value: PopularSort; label: string }[] = [
    { value: 'downloads', label: 'Downloads' },
    { value: 'users', label: 'Unique users' },
    { value: 'volume', label: 'Data volume' },
    { value: 'recent', label: 'Most recent' },
  ];

  /** All datasets in the domain, filtered by the search box and sorted by the chosen metric. Unlike
   *  the Most Popular card, undated rows are kept so the list is the domain's FULL membership. */
  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.all().filter(
      (r) => !q || r.title.toLowerCase().includes(q) || r.ediid.toLowerCase().includes(q),
    );
    return [...list].sort(popularComparator(this.sortKey()));
  });

  /** Aggregate usage for the datasets currently listed (the domain within this scope; narrows with
   *  the search box so it always matches the visible count). Sums mirror CollectionStats: downloads
   *  and volume are true totals, users are summed user-sessions (NOT distinct people). */
  readonly totals = computed(() => {
    let downloads = 0;
    let users = 0;
    let volume = 0;
    for (const r of this.rows()) {
      downloads += r.record_download ?? 0;
      users += r.number_users ?? 0;
      volume += r.total_size_download ?? 0;
    }
    return { downloads, users, volume };
  });

  constructor() {
    const scoped = this.data.scopedIds ? new Set(this.data.scopedIds) : null;
    combineLatest([this.metrics.catalogRecords$, this.metrics.reconciledDatasets$])
      .pipe(takeUntilDestroyed())
      .subscribe(([records, usage]) => {
        const usageByEdiid = new Map(usage.filter((u) => u.ediid).map((u) => [u.ediid, u]));
        const matched = records.filter(
          (r) =>
            r.ediid &&
            (!scoped || scoped.has(r.ediid)) &&
            domainLabelsOf(r, this.data.level).includes(this.data.domain),
        );
        this.all.set(
          matched.map((r) => {
            const u = usageByEdiid.get(r.ediid!);
            return {
              ediid: r.ediid!,
              title: r.title || r.ediid!,
              doi: r.doi,
              record_download: u?.record_download,
              number_users: u?.number_users,
              total_size_download: u?.total_size_download,
              last_time_logged: u?.last_time_logged,
            } as EnrichedDataSetMetric;
          }),
        );
        this.loading.set(false);
      });
  }

  /** The sub-line under each title, reflecting the active sort metric (same copy as Most Popular). */
  subLabel(log: EnrichedDataSetMetric): string {
    return popularSubLabel(log, this.sortKey());
  }

  setSort(key: PopularSort): void {
    this.sortKey.set(key);
  }

  /** Open the existing per-dataset detail drawer for a row. */
  openDataset(metric: EnrichedDataSetMetric): void {
    this.dialog.open(DatasetDetailComponent, {
      data: { metric },
      panelClass: 'detail-panel',
      position: { right: '0', top: '0' },
      width: '420px',
      maxWidth: '92vw',
      height: '100vh',
      autoFocus: 'dialog',
      ariaLabel: 'Dataset details',
    });
  }

  datasetUrl(ediid: string): string {
    return `https://data.nist.gov/od/id/${ediid}`;
  }

  close(): void {
    this.ref.close();
  }
}
