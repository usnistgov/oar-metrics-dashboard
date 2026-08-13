import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { from, map, mergeMap } from 'rxjs';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { CollectionDetail, DataSetMetric, EnrichedDataSetMetric } from '../../models/metrics.models';
import { gini } from '../../download-stats';
import { PopularSort } from '../most-popular/most-popular.component';
import { SortByComponent } from '../sort-by/sort-by.component';

/** A member dataset row for the list; `pending` is true until its title resolves (shows a skeleton). */
interface MemberRow extends EnrichedDataSetMetric {
  pending: boolean;
}

/**
 * Right-side drill-down drawer for one collection. Shows the rollup (downloads / datasets / volume /
 * repo share), a within-collection concentration line, and the member datasets ranked by a chosen
 * metric. Member rows reuse the shared `.ds-*` list chrome; titles come from the per-record cache.
 */
@Component({
  selector: 'app-collection-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    SortByComponent,
  ],
  templateUrl: './collection-detail.component.html',
  styleUrl: './collection-detail.component.css',
})
export class CollectionDetailComponent {
  private ref = inject(MatDialogRef<CollectionDetailComponent>);
  private metrics = inject(MetricsService);
  private destroyRef = inject(DestroyRef);
  readonly watch = inject(WatchlistService);
  readonly data = inject<{ id: string; title: string }>(MAT_DIALOG_DATA);

  readonly detail = signal<CollectionDetail | null>(null);
  readonly loading = signal(true);
  readonly sortKey = signal<PopularSort>('downloads');
  /** Resolved titles keyed by ediid (streamed in from the record cache / API). */
  private readonly titles = signal<Map<string, string>>(new Map());

  readonly sortOptions: { value: PopularSort; label: string }[] = [
    { value: 'downloads', label: 'Downloads' },
    { value: 'users', label: 'Unique users' },
    { value: 'volume', label: 'Data volume' },
    { value: 'recent', label: 'Most recent' },
  ];

  /**
   * Member rows sorted by the active metric. Each carries its resolved title, or is flagged
   * `pending` (title not yet resolved) so the template shows a skeleton instead of flashing the ediid.
   */
  readonly rows = computed<MemberRow[]>(() => {
    const d = this.detail();
    if (!d) return [];
    const titles = this.titles();
    return [...d.members].sort(this.comparator()).map((m) => {
      const title = titles.get(m.ediid);
      return { ...m, title: title ?? '', pending: !title };
    });
  });

  /** "Top dataset = X%" concentration within the collection. */
  readonly topShareLabel = computed(() => {
    const counts = (this.detail()?.members ?? []).map((m) => m.record_download ?? 0);
    const total = counts.reduce((s, n) => s + n, 0);
    return total ? `${Math.round((Math.max(...counts) / total) * 100)}%` : '-';
  });
  readonly giniLabel = computed(() => {
    const counts = (this.detail()?.members ?? []).map((m) => m.record_download ?? 0);
    return counts.length ? gini(counts).toFixed(2) : '-';
  });

  constructor() {
    this.metrics
      .collectionDetail(this.data.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((d) => {
        this.detail.set(d);
        this.loading.set(false);
        if (d) this.resolveTitles(d.members);
      });
  }

  /**
   * Resolve member titles from the shared record cache, throttled to 6 in flight so a big collection
   * doesn't flood the per-record API. Titles fill in progressively (record() is cached/multicast, so
   * anything another card already fetched returns instantly).
   */
  private resolveTitles(members: DataSetMetric[]): void {
    from(members)
      .pipe(
        mergeMap(
          (m) => this.metrics.record(m.ediid).pipe(map((rec) => [m.ediid, rec?.title] as const)),
          6,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([ediid, title]) => {
        if (!title) return;
        const next = new Map(this.titles());
        next.set(ediid, title);
        this.titles.set(next);
      });
  }

  setSort(key: PopularSort): void {
    this.sortKey.set(key);
  }

  private comparator(): (a: DataSetMetric, b: DataSetMetric) => number {
    switch (this.sortKey()) {
      case 'users':
        return (a, b) => (b.number_users ?? 0) - (a.number_users ?? 0);
      case 'volume':
        return (a, b) => (b.total_size_download ?? 0) - (a.total_size_download ?? 0);
      case 'recent':
        return (a, b) =>
          new Date(b.last_time_logged ?? 0).getTime() - new Date(a.last_time_logged ?? 0).getTime();
      default:
        return (a, b) => (b.record_download ?? 0) - (a.record_download ?? 0);
    }
  }

  /** Sub-line under each title, reflecting the active sort metric. */
  subLabel(log: EnrichedDataSetMetric): string {
    switch (this.sortKey()) {
      case 'users':
        return `${(log.number_users ?? 0).toLocaleString()} users`;
      case 'volume':
        return this.volume(log.total_size_download);
      case 'recent':
        return log.last_time_logged
          ? new Date(log.last_time_logged).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'No date';
      default:
        return `${(log.record_download ?? 0).toLocaleString()} downloads`;
    }
  }

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

  datasetUrl(ediid: string): string {
    return `https://data.nist.gov/od/id/${ediid}`;
  }

  /** The collection's own landing page on the PDR. */
  collectionUrl(): string {
    return `https://data.nist.gov/od/id/${this.data.id}`;
  }

  close(): void {
    this.ref.close();
  }
}
