import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MetricsService } from '../../services/metrics.service';
import { CatalogCoverage, DataSetMetric, RecordResult } from '../../models/metrics.models';
import { OffCatalogDialogComponent } from '../off-catalog-dialog/off-catalog-dialog.component';

/**
 * Untracked Datasets card: catalog datasets that have no recorded usage yet (published but never
 * downloaded, or usage not logged). The header badge shows the total; the search box filters by title.
 */
@Component({
  selector: 'app-untracked-datasets',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './untracked-datasets.component.html',
  styleUrl: './untracked-datasets.component.css',
})
export class UntrackedDatasetsComponent {
  private metrics = inject(MetricsService);
  private dialog = inject(MatDialog);

  private readonly all = toSignal(this.metrics.untrackedDatasets$, {
    initialValue: [] as RecordResult[],
  });

  readonly coverage = toSignal(this.metrics.catalogCoverage$, {
    initialValue: { catalog: 0, withUsage: 0, untracked: 0, offCatalog: 0, coverage: 0 } as CatalogCoverage,
  });

  readonly offCatalog = toSignal(this.metrics.offCatalogDatasets$, {
    initialValue: [] as DataSetMetric[],
  });

  readonly query = signal('');

  readonly total = computed(() => this.all().length);

  /** Open the modal listing the off-catalog datasets (usage but not in the catalog). */
  openOffCatalog(): void {
    this.dialog.open(OffCatalogDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '85vh',
      autoFocus: 'dialog',
      ariaLabel: 'Datasets with usage but not in the catalog',
      data: this.offCatalog(),
    });
  }

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.all();
    if (!q) return rows;
    return rows.filter(
      (r) => (r.title ?? '').toLowerCase().includes(q) || (r.ediid ?? '').toLowerCase().includes(q),
    );
  });

  /** PDR landing page for a dataset. */
  landingUrl(ediid?: string): string {
    return ediid ? `https://data.nist.gov/od/id/${ediid}` : '#';
  }
}
