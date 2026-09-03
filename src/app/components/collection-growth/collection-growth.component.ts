import { AfterViewInit, Component, ElementRef, computed, effect, inject, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, ChartOptions, TooltipItem, registerables } from 'chart.js';
import { ThemeService } from '../../services/theme.service';
import { DataSetMetric } from '../../models/metrics.models';
import { chartTheme, lineChartOptions, lineDataset } from '../../chart-theme';
import { datasetGrowthSeries } from '../../growth-stats';

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
  imports: [],
  templateUrl: './collection-growth.component.html',
  styleUrl: './collection-growth.component.css',
})
export class CollectionGrowthComponent implements AfterViewInit {
  private theme = inject(ThemeService);

  readonly datasets = input<DataSetMetric[]>([]);
  readonly series = computed(() => datasetGrowthSeries(this.datasets()));
  readonly hasData = computed(() => this.series().length > 0);

  private chart?: Chart;
  private viewReady = false;
  readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  constructor() {
    // Redraw when the scoped data changes or the theme (mode/accent) changes.
    effect(() => {
      this.series();
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
    const pts = this.series();

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
            // Multi-year monthly data: label only the January of each year (plus the first point),
            // so the axis reads as clean year boundaries instead of arbitrary evenly-spaced months.
            callback: (_value, index) => {
              const p = pts[index];
              if (!p) return '';
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
