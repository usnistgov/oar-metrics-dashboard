import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MetricsService } from '../../services/metrics.service';
import { RepoMetric } from '../../models/metrics.models';

interface HeatCell {
  month: number;
  downloads: number;
  present: boolean;
  intensity: number;
  label: string;
}
interface HeatRow {
  year: number;
  cells: HeatCell[];
}

/**
 * Seasonality heatmap: a year x month grid of monthly downloads (from the repo metrics already in
 * memory), shaded by intensity so busy months and years stand out. Pure CSS grid, no chart library.
 */
@Component({
  selector: 'app-seasonality',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './seasonality.component.html',
  styleUrl: './seasonality.component.css',
})
export class SeasonalityComponent {
  private metrics = inject(MetricsService);
  private destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);
  readonly years = signal<HeatRow[]>([]);
  readonly monthLabels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  constructor() {
    this.metrics.repoMetrics$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => this.build(data));
  }

  /** Build the year x month matrix, shading each present month by downloads / max. */
  build(data: RepoMetric[]): void {
    const parsed = data
      .map((m) => ({ m, d: new Date(m.month_year) }))
      .filter((x) => !isNaN(x.d.getTime()));

    if (!parsed.length) {
      this.years.set([]);
      this.errorMsg.set(this.metrics.repoError() ? 'Failed to load data.' : null);
      this.loading.set(false);
      return;
    }

    const max = Math.max(...parsed.map((x) => x.m.success_download ?? 0), 1);
    const byYear = new Map<number, Map<number, RepoMetric>>();
    for (const x of parsed) {
      const year = x.d.getFullYear();
      const month = x.d.getMonth();
      if (!byYear.has(year)) byYear.set(year, new Map());
      byYear.get(year)!.set(month, x.m);
    }

    const rows = [...byYear.keys()]
      .sort((a, b) => a - b)
      .map((year): HeatRow => ({
        year,
        cells: Array.from({ length: 12 }, (_, month): HeatCell => {
          const m = byYear.get(year)!.get(month);
          const downloads = m?.success_download ?? 0;
          return {
            month,
            downloads,
            present: !!m,
            intensity: m ? Math.max(0.08, downloads / max) : 0,
            label: m ? `${m.month_year}: ${downloads.toLocaleString()} downloads` : '',
          };
        }),
      }));

    this.years.set(rows);
    this.errorMsg.set(null);
    this.loading.set(false);
  }
}
