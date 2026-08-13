import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { combineLatest, forkJoin, map, of, switchMap } from 'rxjs';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { DataSetMetric, EnrichedDataSetMetric } from '../../models/metrics.models';
import { DatasetDetailComponent } from '../dataset-detail/dataset-detail.component';
import { WatchlistAddDialogComponent } from '../watchlist-add-dialog/watchlist-add-dialog.component';

/**
 * Watchlist card: the datasets the user has starred. Resolves each watched ediid to its current
 * metrics (from the shared dataset list) and title (from the record cache), and reacts live as the
 * watchlist or the underlying data changes. Rows open the detail drawer; the star removes.
 */
@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, MatDialogModule],
  templateUrl: './watchlist.component.html',
  styleUrl: './watchlist.component.css',
})
export class WatchlistComponent {
  private metrics = inject(MetricsService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  readonly watch = inject(WatchlistService);

  readonly entries = signal<EnrichedDataSetMetric[]>([]);
  readonly loading = signal(true);

  /** Pinned entries (in pin order) and the rest, derived from the watchlist + pin state. */
  readonly pinnedEntries = computed(() => {
    const byId = new Map(this.entries().map((e) => [e.ediid, e]));
    return this.watch
      .pinned()
      .map((id) => byId.get(id))
      .filter((e): e is EnrichedDataSetMetric => !!e);
  });
  readonly unpinnedEntries = computed(() =>
    this.entries().filter((e) => !this.watch.isPinned(e.ediid)),
  );

  constructor() {
    combineLatest([this.metrics.datasetMetrics$, toObservable(this.watch.ids)])
      .pipe(
        switchMap(([datasets, ids]) => {
          const found = ids
            .map((id) => datasets.find((d) => d.ediid === id))
            .filter((d): d is DataSetMetric => !!d);
          if (!found.length) return of<EnrichedDataSetMetric[]>([]);
          return forkJoin(
            found.map((d) =>
              this.metrics
                .record(d.ediid)
                .pipe(map((r): EnrichedDataSetMetric => ({ ...d, title: r?.title || d.ediid }))),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.entries.set(rows);
        this.loading.set(false);
      });
  }

  // Open the "Add dataset" search dialog.
  openAddDialog(): void {
    this.dialog.open(WatchlistAddDialogComponent, {
      width: '560px',
      maxWidth: '92vw',
      autoFocus: 'first-tabbable',
      ariaLabel: 'Add dataset to watchlist',
    });
  }

  // Pin / unpin a dataset (the service enforces the max).
  togglePin(ediid: string): void {
    this.watch.togglePin(ediid);
  }

  pinTooltip(ediid: string): string {
    if (this.watch.isPinned(ediid)) return 'Unpin';
    return this.watch.canPinMore()
      ? 'Pin to top'
      : 'You can pin up to 3 datasets. Unpin one to add another.';
  }

  // Open the right-side detail drawer for a watched dataset.
  openDetail(entry: EnrichedDataSetMetric): void {
    this.dialog.open(DatasetDetailComponent, {
      data: { metric: entry },
      panelClass: 'detail-panel',
      position: { right: '0', top: '0' },
      width: '420px',
      maxWidth: '92vw',
      height: '100vh',
      autoFocus: 'dialog',
      ariaLabel: 'Dataset details',
    });
  }
}
