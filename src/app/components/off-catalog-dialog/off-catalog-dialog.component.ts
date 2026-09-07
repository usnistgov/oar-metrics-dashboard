import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MetricsService } from '../../services/metrics.service';
import { DataSetMetric } from '../../models/metrics.models';
import { formatSize } from '../../format';

/**
 * Modal listing the datasets that have usage but are not in the catalog (withdrawn, or logged under
 * a different identifier than the catalog uses). Opened from the Untracked Datasets card. The list is
 * passed in via MAT_DIALOG_DATA and shown as a searchable table.
 */
@Component({
  selector: 'app-off-catalog-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './off-catalog-dialog.component.html',
  styleUrl: './off-catalog-dialog.component.css',
})
export class OffCatalogDialogComponent {
  private metrics = inject(MetricsService);
  private readonly items = (inject(MAT_DIALOG_DATA) as DataSetMetric[]) ?? [];
  readonly total = this.items.length;
  readonly query = signal('');

  // TEMP (remove after the ingester fix): per-row "now lives under" lookup. undefined = checking,
  // null = not re-published (genuinely withdrawn), string = the new catalog id. Resolved live by
  // matching file components, so it only runs when the modal is open (i.e. when a gap exists).
  readonly republished = signal<Record<string, string | null | undefined>>({});

  constructor() {
    for (const d of this.items) {
      const id = d.ediid;
      if (!id) continue;
      this.republished.update((m) => ({ ...m, [id]: undefined }));
      this.metrics.republishedId(id).subscribe((newId) =>
        this.republished.update((m) => ({ ...m, [id]: newId })),
      );
    }
  }

  /** Resolution state for a row: undefined (checking), a new id (string), or null (none). */
  republishedOf(ediid?: string): string | null | undefined {
    return ediid ? this.republished()[ediid] : null;
  }

  readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.items.filter((d) => (d.ediid ?? '').toLowerCase().includes(q)) : this.items;
  });

  landingUrl(ediid?: string): string {
    return ediid ? `https://data.nist.gov/od/id/${ediid}` : '#';
  }
  date(ts?: string): string {
    return ts ? ts.slice(0, 10) : '';
  }
  size(bytes?: number): string {
    return formatSize(bytes ?? 0);
  }
}
