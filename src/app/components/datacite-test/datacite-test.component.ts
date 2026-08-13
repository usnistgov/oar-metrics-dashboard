import { Component, DestroyRef, ElementRef, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { MetricsService } from '../../services/metrics.service';
import { DataSetMetric, EnrichedDataSetMetric } from '../../models/metrics.models';
import { DataciteBadgeComponent } from '../datacite-badge/datacite-badge.component';

/**
 * DataCite Metrics card. Resolves DOIs for the top datasets, lets the user pick one from a custom
 * dropdown, and shows DataCite's citation and usage badge for the selection (via app-datacite-badge).
 */
@Component({
  selector: 'app-datacite-test',
  imports: [
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    DataciteBadgeComponent,
  ],
  templateUrl: './datacite-test.component.html',
  styleUrl: './datacite-test.component.css',
})
export class DataciteTestComponent implements OnInit {
  private readonly DOI_LIMIT = 25; // only resolve DOIs for the top-N datasets (a DOI picker, not a list)

  private metricsSvc = inject(MetricsService);
  private destroyRef = inject(DestroyRef);

  DOILogs: EnrichedDataSetMetric[] = []; // resolved {title, doi} for the picker
  selectedDOI = '';
  loading = signal(true);
  errorMsg = signal<string | null>(null);
  badgeOpen = signal(true); // "Citations & usage" collapsible state

  ngOnInit(): void {
    this.metricsSvc.datasetMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => this.render(data));
  }

  /** The currently-selected dataset (for the trigger label + the DOI link panel). */
  get selected(): EnrichedDataSetMetric | undefined {
    return this.DOILogs.find((log) => log.doi === this.selectedDOI);
  }

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  constructor() {
    // Keep --dc-menu-width synced to the trigger's width so the dropdown menu is never narrower than
    // the button (mat-menu hugs its content otherwise). ResizeObserver fires once on observe - so
    // the value is set before the menu first opens - and again on any responsive width change.
    effect((onCleanup) => {
      const el = this.trigger()?.nativeElement;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        document.documentElement.style.setProperty('--dc-menu-width', `${el.offsetWidth}px`);
      });
      ro.observe(el);
      onCleanup(() => ro.disconnect());
    });
  }

  /** Pick a dataset from the custom dropdown menu. */
  select(log: EnrichedDataSetMetric): void {
    this.selectedDOI = log.doi ?? '';
  }

  /** Polished fallback when there are no datasets/DOIs to show. */
  showFallback(): boolean {
    return this.errorMsg() !== null || this.DOILogs.length === 0;
  }
  get fallbackMessage(): string {
    return 'DataCite metrics are temporarily unavailable for the current datasets. Please check back in a little while.';
  }

  // Resolve DOIs+titles for the top datasets via the shared cache, then populate the picker.
  private render(data: DataSetMetric[]): void {
    const sample = data
      .filter((item) => item.last_time_logged && item.ediid)
      .sort((a, b) => (b.record_download ?? 0) - (a.record_download ?? 0))
      .slice(0, this.DOI_LIMIT);

    if (sample.length === 0) {
      this.DOILogs = [];
      this.errorMsg.set(this.metricsSvc.datasetError() ? 'Failed to load data.' : null);
      this.loading.set(false);
      return;
    }

    forkJoin(
      sample.map((log) =>
        this.metricsSvc.record(log.ediid).pipe(
          map((rec): EnrichedDataSetMetric => {
            let doi = rec?.doi ?? '';
            if (doi.startsWith('doi:')) doi = doi.substring('doi:'.length); // badge wants the bare DOI
            return { ...log, doi, title: rec?.title ?? '' };
          })
        )
      )
    )
      .pipe(
        // Keep only datasets whose DOI is actually registered in DataCite, so every picker entry
        // renders a real badge (an unregistered DOI would show a blank/broken badge).
        switchMap((results) => {
          const candidates = results.filter((log) => log.title && log.doi);
          if (candidates.length === 0) return of<EnrichedDataSetMetric[]>([]);
          return forkJoin(
            candidates.map((log) =>
              this.metricsSvc.doiResolves(log.doi as string).pipe(map((ok) => ({ log, ok })))
            )
          ).pipe(map((checked) => checked.filter((c) => c.ok).map((c) => c.log)));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((resolved) => {
        this.errorMsg.set(null);
        this.loading.set(false);
        this.DOILogs = resolved.sort((a, b) => a.title.localeCompare(b.title));

        if (this.DOILogs.length > 0) {
          this.selectedDOI = this.DOILogs[0].doi ?? '';
        }
      });
  }
}
