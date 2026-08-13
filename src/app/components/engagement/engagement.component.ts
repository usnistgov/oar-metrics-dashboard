import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { lineChartOptions, lineDataset } from '../../chart-theme';
import { RepoMetric } from '../../models/metrics.models';
import { RangeToggleComponent, RangeKey } from '../range-toggle/range-toggle.component';

Chart.register(...registerables);

export type EngagementMetric = 'peruser' | 'avgsize';

interface Series {
  labels: string[];
  values: number[];
  label: string;
  yTitle: string;
}

/**
 * Engagement card: derives two trends from the monthly repo metrics already in memory:
 *  - downloads per user (success_download / unique_users), and
 *  - average download size in MB (total_size / success_download).
 * A small toggle switches between them; the chart re-renders with theme-aware colors.
 */
@Component({
  selector: 'app-engagement',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, RangeToggleComponent],
  templateUrl: './engagement.component.html',
  styleUrl: './engagement.component.css',
})
export class EngagementComponent implements AfterViewInit {
  private metrics = inject(MetricsService);
  private theme = inject(ThemeService);
  private destroyRef = inject(DestroyRef);

  chart: Chart | undefined;
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private rawData: RepoMetric[] = [];
  readonly metric = signal<EngagementMetric>('peruser');
  readonly range = signal<RangeKey>('all');
  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);

  constructor() {
    // Repaint when the theme (mode or accent) changes.
    effect(() => {
      this.theme.mode();
      this.theme.color();
      if (this.chart) this.draw();
    });
    this.metrics.repoMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.rawData = data;
      this.loading.set(false);
      this.errorMsg.set(this.metrics.repoError() && data.length === 0 ? 'Failed to load data.' : null);
      this.draw();
    });
  }

  // The data may arrive (replayed from cache) before the canvas exists; draw once the view is ready.
  ngAfterViewInit(): void {
    this.draw();
  }

  setMetric(m: EngagementMetric): void {
    if (this.metric() === m) return;
    this.metric.set(m);
    this.draw();
  }

  setRange(r: RangeKey): void {
    if (this.range() === r) return;
    this.range.set(r);
    this.draw();
  }

  /**
   * Build the chart series for a metric, restricted to the selected window (pure: sorted
   * chronologically, sliced to the last 12/24 months or all, divide-by-zero guarded).
   */
  seriesFor(data: RepoMetric[], metric: EngagementMetric, range: RangeKey = 'all'): Series {
    const sorted = data
      .map((m) => ({ m, d: new Date(m.month_year) }))
      .filter((x) => !isNaN(x.d.getTime()))
      .sort((a, b) => a.d.getTime() - b.d.getTime());
    const months = range === 'all' ? sorted : sorted.slice(range === 'l12' ? -12 : -24);

    const perUser = metric === 'peruser';
    const values = months.map((x) => {
      const downloads = x.m.success_download ?? 0;
      if (perUser) {
        const users = x.m.unique_users ?? 0;
        return users ? downloads / users : 0;
      }
      return downloads ? ((x.m.total_size ?? 0) * 1e-6) / downloads : 0; // MB per download
    });

    return {
      labels: months.map((x) => x.m.month_year),
      values,
      label: perUser ? 'Downloads per user' : 'Avg download size (MB)',
      yTitle: perUser ? 'Downloads / user' : 'MB / download',
    };
  }

  private draw(): void {
    const s = this.seriesFor(this.rawData, this.metric(), this.range());
    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: { labels: s.labels, datasets: [lineDataset(s.label, s.values)] },
      options: lineChartOptions('Dates', s.yTitle),
    };
    const canvas = this.chartCanvas()?.nativeElement;
    if (canvas) {
      if (this.chart) this.chart.destroy();
      this.chart = new Chart(canvas, config);
    }
  }
}
