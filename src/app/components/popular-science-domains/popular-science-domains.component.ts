import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MetricsService } from '../../services/metrics.service';
import { CategoryCount, DataSetMetric, RecordResult } from '../../models/metrics.models';
import { aggregateDomains, DomainLevel } from '../../science-domains';
import { DomainDatasetsComponent } from '../domain-datasets/domain-datasets.component';

/**
 * Science Domains card: ranks science domains by how many DISTINCT datasets carry each theme/topic
 * tag, aggregated over the FULL catalog (bulk-fetched once and cached by the service) rather than a
 * small top-downloads sample. The Collections view binds a `datasets` input; then only that
 * collection's members are counted. A `level` toggle groups by the broad top-level domain or the
 * granular subdomain. The full ranked list is shown in a scrollable, searchable list.
 */
@Component({
  selector: 'app-popular-science-domains',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule],
  templateUrl: './popular-science-domains.component.html',
  styleUrl: './popular-science-domains.component.css',
})
export class PopularScienceDomainsComponent implements OnInit {
  private static readonly LEVEL_KEY = 'scienceDomains.level'; // 'top' | 'sub'

  private metrics = inject(MetricsService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  private allRecords: RecordResult[] = [];        // Full catalog (domain fields) from the shared stream.
  categories: CategoryCount[] = [];               // All domains, ranked; rendered as a scrollable list.
  readonly level = signal<DomainLevel>(this.loadLevel()); // group by top-level domain or subdomain.
  readonly search = signal('');                   // filters the list by domain name.

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

  /** The ranked domains filtered by the search box (case-insensitive substring on the label). */
  get visibleCategories(): CategoryCount[] {
    const q = this.search().trim().toLowerCase();
    return q ? this.categories.filter((c) => c.name.toLowerCase().includes(q)) : this.categories;
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

  private loadLevel(): DomainLevel {
    try {
      const saved = localStorage.getItem(PopularScienceDomainsComponent.LEVEL_KEY);
      if (saved === 'top' || saved === 'sub') return saved;
    } catch { /* storage unavailable */ }
    return 'top';
  }

  /** Open the right-side drawer listing every dataset in the clicked domain (scoped to the same
   *  member set when this card is inside a collection view). */
  openDomain(name: string): void {
    this.dialog.open(DomainDatasetsComponent, {
      data: {
        domain: name,
        level: this.level(),
        scopedIds: this.scopedIds ? [...this.scopedIds] : null,
      },
      panelClass: 'detail-panel',
      position: { right: '0', top: '0' },
      width: '460px',
      maxWidth: '92vw',
      height: '100vh',
      autoFocus: 'dialog',
      ariaLabel: 'Datasets in science domain',
    });
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

  // Aggregate ALL domains over the catalog (or the scoped members). Synchronous - the catalog is
  // already resolved; leaves `loading` alone so the skeleton stays until the first catalog emission.
  private render(): void {
    const source = this.scopedIds
      ? this.allRecords.filter((r) => r.ediid && this.scopedIds!.has(r.ediid))
      : this.allRecords;
    this.errorMsg.set(this.metrics.catalogError() && source.length === 0 ? 'Failed to load data.' : null);
    this.categories = aggregateDomains(source, Number.MAX_SAFE_INTEGER, this.level());
  }
}
