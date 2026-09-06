import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, Input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MetricsService } from '../../services/metrics.service';
import { CategoryCount, DataSetMetric, RecordResult } from '../../models/metrics.models';
import { DatasetDialogComponent } from '../dataset-dialog/dataset-dialog.component';
import { CustomCountDialogComponent } from '../custom-count-dialog/custom-count-dialog.component';
import { aggregateDomains, DomainLevel } from '../../science-domains';

/**
 * Science Domains card: ranks science domains by how many DISTINCT datasets carry each theme/topic
 * tag, aggregated over the FULL catalog (bulk-fetched once and cached by the service) rather than a
 * small top-downloads sample. The Collections view binds a `datasets` input; then only that
 * collection's members are counted. A `level` toggle groups by the broad top-level domain or the
 * granular subdomain.
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
  private static readonly LEVEL_KEY = 'scienceDomains.level'; // 'top' | 'sub'

  private metrics = inject(MetricsService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  private allRecords: RecordResult[] = [];      // Full catalog (domain fields) from the shared stream.
  mostPopularCategories: CategoryCount[] = [];  // Rendered inline as ranked rows.
  count = this.loadCount();                     // How many domains to show (persisted to localStorage).
  readonly level = signal<DomainLevel>(this.loadLevel()); // group by top-level domain or subdomain.

  /**
   * Optional collection scope. When the Collections view binds a member list, only those datasets'
   * ediids are counted; unbound, the card aggregates over the whole catalog.
   */
  private scopedIds: Set<string> | null = null;
  @Input() set datasets(value: DataSetMetric[] | null) {
    this.scopedIds = value
      ? new Set(value.map((d) => d.ediid).filter((id): id is string => !!id))
      : null;
    this.render();
  }
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    // One shared, cached bulk catalog fetch powers both the dashboard card and every collection view.
    this.metrics.catalogRecords$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((records) => {
      this.allRecords = records;
      this.loading.set(false);
      this.render();
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

  private loadLevel(): DomainLevel {
    try {
      const saved = localStorage.getItem(PopularScienceDomainsComponent.LEVEL_KEY);
      if (saved === 'top' || saved === 'sub') return saved;
    } catch { /* storage unavailable */ }
    return 'top';
  }

  /** Switch between top-level domains and subdomains; persists and re-ranks. */
  setLevel(level: DomainLevel): void {
    if (level === this.level()) return;
    this.level.set(level);
    try {
      localStorage.setItem(PopularScienceDomainsComponent.LEVEL_KEY, level);
    } catch { /* storage unavailable */ }
    this.render();
  }

  // --- actions-menu --------------------------------------------------------
  // Show a preset number of domains.
  showCount(n: number): void {
    this.count = String(n);
    this.saveCount();
    this.render();
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
          this.render();
        }
      });
  }

  resetCount(): void {
    this.count = '5';
    this.saveCount();
    this.render();
  }

  openExpanded(): void {
    this.dialog.open(DatasetDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      autoFocus: 'dialog',   // focus the dialog, not the Close button
      data: {
        title: 'Science Domains',
        items: this.mostPopularCategories.map((c, i) => ({
          rank: i + 1,
          title: c.name,
          sub: `${c.count.toLocaleString()} datasets`,
        })),
      },
    });
  }

  // Aggregate domains over the catalog (or the scoped members). Synchronous - the catalog is already
  // resolved; leaves `loading` alone so the skeleton stays until the first catalog emission.
  private render(): void {
    const source = this.scopedIds
      ? this.allRecords.filter((r) => r.ediid && this.scopedIds!.has(r.ediid))
      : this.allRecords;
    this.errorMsg.set(this.metrics.catalogError() && source.length === 0 ? 'Failed to load data.' : null);
    this.mostPopularCategories = aggregateDomains(source, this.parsedCount(), this.level());
  }
}
