import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, viewChild, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { MetricsService } from '../../services/metrics.service';
import { RepoMetric } from '../../models/metrics.models';
import { barChartOptions, barDataset } from '../../chart-theme';
import { MonthOption, filterByMonthRange, monthYearOptions } from '../../month-filter';
import { MonthRangeComponent } from '../month-range/month-range.component';

Chart.register(...registerables);

/** Enlarged "unique users per month" chart shown in a dialog (opened from the Unique Users card). */
@Component({
  selector: 'app-monthly-users-popup',
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatProgressSpinnerModule, MonthRangeComponent],
  templateUrl: './monthly-users-popup.component.html',
  styleUrl: './monthly-users-popup.component.css'
})
export class MonthlyUsersPopupComponent implements OnInit {
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
    const values = sorted.map(item => item.unique_users || 0);

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: { labels, datasets: [barDataset('Number of Unique Users', values)] },
      options: barChartOptions('Dates', 'Number of Unique Users'),
    };

    const canvas = this.chartCanvas()?.nativeElement;
    if (canvas) {
      if (this.chart) this.chart.destroy();
      this.chart = new Chart(canvas, config);
    }
  }
}
