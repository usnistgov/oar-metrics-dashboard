import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, map, of, switchMap, take, tap } from 'rxjs';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { DatasetSearchResult } from '../../models/metrics.models';

interface AddRow {
  ediid: string;
  shortId: string;
  title: string;
  downloads: number;
  domains: string[];
}

/**
 * "Add dataset" dialog. Searches the full RMM record catalog on demand: as the user types (debounced),
 * it queries by phrase and shows the matching datasets with their title, id, and science domains.
 * Download counts are filled in from the in-memory dataset list. Each result can be added to the
 * watchlist. Empty by default with a hint; a spinner shows while a lookup is in flight.
 */
@Component({
  selector: 'app-watchlist-add-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './watchlist-add-dialog.component.html',
  styleUrl: './watchlist-add-dialog.component.css',
})
export class WatchlistAddDialogComponent {
  private static readonly MIN_CHARS = 2;

  private metrics = inject(MetricsService);
  private destroyRef = inject(DestroyRef);
  private ref = inject(MatDialogRef<WatchlistAddDialogComponent>);
  readonly watch = inject(WatchlistService);

  readonly query = signal('');
  readonly results = signal<AddRow[]>([]);
  readonly searching = signal(false);

  /** True once the query is long enough to search (drives the empty-hint vs results view). */
  readonly active = computed(() => this.query().trim().length >= WatchlistAddDialogComponent.MIN_CHARS);

  /** ediid -> download count, from the data already in memory (fills in the result rows). */
  private downloads = new Map<string, number>();

  constructor() {
    this.metrics.datasetMetrics$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((list) => {
      this.downloads = new Map(list.map((d) => [d.ediid, d.record_download ?? 0]));
    });

    toObservable(this.query)
      .pipe(
        map((q) => q.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        tap((q) => {
          const active = q.length >= WatchlistAddDialogComponent.MIN_CHARS;
          this.searching.set(active);
          if (!active) this.results.set([]);
        }),
        switchMap((q) =>
          q.length >= WatchlistAddDialogComponent.MIN_CHARS
            ? this.metrics.searchRecords(q).pipe(
                // searchphrase matches any field; keep only datasets whose TITLE contains the query.
                map((rows) =>
                  rows.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())).slice(0, 50),
                ),
              )
            : of<DatasetSearchResult[]>([]),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.results.set(rows.map((r) => this.toRow(r)));
        this.searching.set(false);
      });
  }

  private toRow(r: DatasetSearchResult): AddRow {
    return {
      ediid: r.ediid,
      shortId: r.ediid.split('/').pop() ?? r.ediid,
      title: r.title,
      domains: r.domains,
      downloads: this.downloads.get(r.ediid) ?? 0,
    };
  }

  close(): void {
    this.ref.close();
  }
}
