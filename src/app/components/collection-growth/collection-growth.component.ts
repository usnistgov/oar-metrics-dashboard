import { AfterViewInit, Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, ChartOptions, TooltipItem, registerables } from 'chart.js';
import { ThemeService } from '../../services/theme.service';
import { DataSetMetric } from '../../models/metrics.models';
import { chartTheme, lineChartOptions, lineDataset } from '../../chart-theme';
import { datasetGrowthSeries } from '../../growth-stats';
import { RangeKey, RangeToggleComponent } from '../range-toggle/range-toggle.component';

Chart.register(...registerables);

/**
 * Collection growth timeline: a cumulative line of how many of a collection's datasets had become
 * active (first usage logged) by each month, from the members' real `first_time_logged` timestamps.
 * This is honest temporal data (adoption over time), NOT downloads-over-time. Bound via the
 * `datasets` input (a collection's member rows) so it follows the active scope.
 */
@Component({
  selector: 'app-collection-growth',
  standalone: true,
  imports: [RangeToggleComponent],
  templateUrl: './collection-growth.component.html',
  styleUrl: './collection-growth.component.css',
})
export class CollectionGrowthComponent implements AfterViewInit {
  private theme = inject(ThemeService);

  readonly datasets = input<DataSetMetric[]>([]);
  readonly series = computed(() => datasetGrowthSeries(this.datasets()));
  readonly hasData = computed(() => this.series().length > 0);

  /** Visible time window (last 12 / 24 months / all). */
  readonly range = signal<RangeKey>('all');

  /** The series sliced to the selected window (cumulative values stay absolute). */
  readonly visible = computed(() => {
    const s = this.series();
    if (this.range() === 'all') return s;
    return s.slice(this.range() === 'l12' ? -12 : -24);
  });

  private chart?: Chart;
  private viewReady = false;
  readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  constructor() {
    // Redraw when the scoped data / selected window changes or the theme (mode/accent) changes.
    effect(() => {
      this.visible();
      this.theme.mode();
      this.theme.color();
      if (this.viewReady) this.draw();
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.draw();
  }

  private draw(): void {
    const canvas = this.chartCanvas()?.nativeElement;
    if (!canvas) return;
    const pts = this.visible();

    // Short windows (<= 24 months) read best with monthly ticks; longer spans use year boundaries.
    const monthly = pts.length <= 24;
    const step = pts.length > 14 ? 2 : 1;

    const base = lineChartOptions('', 'Datasets active');
    const t = chartTheme();
    const options: ChartOptions<'line'> = {
      ...base,
      scales: {
        ...base.scales,
        x: {
          ...base.scales?.['x'],
          ticks: {
            color: t.text,
            autoSkip: false,
            maxRotation: 0,
            callback: (_value, index) => {
              const p = pts[index];
              if (!p) return '';
              if (monthly) {
                // Compact month labels ("Jan '25"); thin to every other tick on the 24-month view.
                if (index % step !== 0 && index !== pts.length - 1) return '';
                return `${p.label.slice(0, 3)} '${p.label.slice(-2)}`;
              }
              // Long span: label only each January (plus the first point) -> clean year boundaries.
              return p.period.endsWith('-01') || index === 0 ? p.period.slice(0, 4) : '';
            },
          },
        },
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            label: (item: TooltipItem<'line'>) => {
              const p = pts[item.dataIndex];
              if (!p) return '';
              return p.added
                ? `${p.cumulative} active  (+${p.added} this month)`
                : `${p.cumulative} active`;
            },
          },
        },
      },
    };

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: pts.map((p) => p.label),
        datasets: [lineDataset('Datasets active', pts.map((p) => p.cumulative))],
      },
      options,
    };

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(canvas, config);
  }
}
