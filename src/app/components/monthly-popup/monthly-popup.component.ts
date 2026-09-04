import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, viewChild, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MetricsService } from '../../services/metrics.service';
import { RepoMetric } from '../../models/metrics.models';
import { barChartOptions, barDataset } from '../../chart-theme';
import { MonthOption, filterByMonthRange, monthYearOptions } from '../../month-filter';
import { MonthRangeComponent } from '../month-range/month-range.component';

Chart.register(...registerables);

/** Enlarged "monthly download size" chart shown in a dialog (opened from the Monthly Download Sizes card). */
@Component({
  selector: 'app-monthly-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatProgressSpinnerModule, MonthRangeComponent],
  templateUrl: './monthly-popup.component.html',
  styleUrl: './monthly-popup.component.css'
})
export class MonthlyPopupComponent implements OnInit {
  private metrics = inject(MetricsService);
  private destroyRef = inject(DestroyRef);
  chart: any;
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  rawData: RepoMetric[] = [];
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  // Custom month-year range (From -> To); null = open bound.
  readonly options = signal<MonthOption[]>([]);
  readonly from = signal<string | null>(null);
  readonly to = signal<string | null>(null);
  readonly emptySelection = signal(false);

  ngOnInit(): void {
    this.metrics.repoMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.rawData = data;
      this.options.set(monthYearOptions(data));
      this.loading.set(false);
      this.errorMsg.set(this.metrics.repoError() && data.length === 0 ? 'Failed to load data.' : null);
      this.applyFilter();
    });
  }

  // Keep rows within the selected [from, to] month range, then re-render.
  applyFilter() {
    const data = filterByMonthRange(this.rawData, this.from(), this.to());
    this.emptySelection.set(data.length === 0 && this.rawData.length > 0);
    this.updateChart(data);
  }

  setFrom(v: string | null) { this.from.set(v); this.applyFilter(); }
  setTo(v: string | null) { this.to.set(v); this.applyFilter(); }
  resetFilter() { this.from.set(null); this.to.set(null); this.applyFilter(); }

  // Configures and renders the Chart.js bar graph using the provided data.
  updateChart(data: RepoMetric[]) {
    const sorted = [...data].sort(
      (a, b) => new Date(a.month_year ?? '').getTime() - new Date(b.month_year ?? '').getTime()
    );
    const labels = sorted.map(item => item.month_year || 'Unknown');
    const values = sorted.map(item => (Math.pow(10, -12) * item.total_size) || 0); // bytes -> terabytes

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: { labels, datasets: [barDataset('Total Download Size', values)] },
      options: barChartOptions('Dates', 'Total Download Size (TB)'),
    };

    const canvas = this.chartCanvas()?.nativeElement;
    if (canvas) {
      if (this.chart) this.chart.destroy();
      this.chart = new Chart(canvas, config);
    }
  }
}
