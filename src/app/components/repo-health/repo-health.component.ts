import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MetricsService } from '../../services/metrics.service';
import { healthStats, HealthStats } from '../../download-stats';

/**
 * Repository Health snapshot: quick context for the whole catalog (coverage + central tendency of
 * downloads per dataset), so the rest of the dashboard's totals can be read in proportion. Computed
 * from the per-dataset record_download counts already in memory.
 */
@Component({
  selector: 'app-repo-health',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './repo-health.component.html',
  styleUrl: './repo-health.component.css',
})
export class RepoHealthComponent {
  private metrics = inject(MetricsService);
  private destroyRef = inject(DestroyRef);

  readonly stats = signal<HealthStats | null>(null);
  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);

  constructor() {
    this.metrics.datasetMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.loading.set(false);
      if (this.metrics.datasetError() && data.length === 0) {
        this.errorMsg.set('Failed to load data.');
        this.stats.set(null);
      } else {
        this.errorMsg.set(null);
        this.stats.set(healthStats(data));
      }
    });
  }
}
