import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { DataSetMetric } from '../../models/metrics.models';
import { chartTheme } from '../../chart-theme';
import { downloadCounts, paretoCurve, topShare, zeroPct, gini, CurvePoint } from '../../download-stats';

Chart.register(...registerables);

/**
 * Download Concentration card: how unevenly downloads are spread across the catalog. Shows a Pareto
 * curve (cumulative % of downloads vs cumulative % of datasets, most-downloaded first) against an
 * "even distribution" diagonal, plus headline shares (top 1% / top 10% / never-downloaded) and a
 * Gini concentration index. All computed from the per-dataset record_download counts in memory.
 */
@Component({
  selector: 'app-concentration',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './concentration.component.html',
  styleUrl: './concentration.component.css',
})
export class ConcentrationComponent implements AfterViewInit {
  private metrics = inject(MetricsService);
  private theme = inject(ThemeService);
  private destroyRef = inject(DestroyRef);

  chart: Chart | undefined;
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private counts: number[] = [];
  private curve: CurvePoint[] = [];
  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);

  // Headline figures.
  readonly top1 = signal(0);
  readonly top10 = signal(0);
  readonly zero = signal(0);
  readonly giniLabel = signal('-');

  constructor() {
    effect(() => {
      this.theme.mode();
      this.theme.color();
      if (this.chart) this.draw();
    });
    this.metrics.datasetMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.recompute(data);
      this.loading.set(false);
      this.errorMsg.set(this.metrics.datasetError() && data.length === 0 ? 'Failed to load data.' : null);
      this.draw();
    });
  }

  ngAfterViewInit(): void {
    this.draw();
  }

  private recompute(data: DataSetMetric[]): void {
    this.counts = downloadCounts(data);
    this.curve = paretoCurve(this.counts);
    this.top1.set(Math.round(topShare(this.counts, 0.01)));
    this.top10.set(Math.round(topShare(this.counts, 0.1)));
    this.zero.set(Math.round(zeroPct(this.counts)));
    this.giniLabel.set(this.counts.length ? gini(this.counts).toFixed(2) : '-');
  }

  private draw(): void {
    const canvas = this.chartCanvas()?.nativeElement;
    if (!canvas) return;
    const t = chartTheme();
    const accent = t.barBorder;
    const cs = getComputedStyle(document.documentElement);
    const surface = cs.getPropertyValue('--color-surface').trim() || '#ffffff';
    const strong = cs.getPropertyValue('--color-text').trim() || '#1e293b';

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Even distribution',
            data: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
            borderColor: t.text,
            borderDash: [6, 6],
            borderWidth: 1,
            fill: false,
            pointRadius: 0,
            order: 2,
          },
          {
            label: 'Cumulative downloads',
            data: this.curve,
            borderColor: accent,
            backgroundColor: accent + '22',
            fill: true,
            borderWidth: 2,
            tension: 0.15,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: 100,
            title: { display: true, text: '% of datasets (most downloaded first)', color: t.text },
            ticks: { color: t.text, callback: (v) => `${v}%`, maxTicksLimit: 6 },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            type: 'linear',
            min: 0,
            max: 100,
            title: { display: true, text: '% of all downloads', color: t.text },
            ticks: { color: t.text, callback: (v) => `${v}%`, maxTicksLimit: 6 },
            grid: { color: t.grid },
            border: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: surface,
            titleColor: strong,
            bodyColor: strong,
            borderColor: t.grid,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            displayColors: false,
            filter: (item) => item.datasetIndex === 1,
            callbacks: {
              title: (items) => `Top ${Math.round(items[0].parsed.x ?? 0)}% of datasets`,
              label: (item) => `${Math.round(item.parsed.y ?? 0)}% of all downloads`,
            },
          },
        },
      },
    };

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(canvas, config);
  }
}
