import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, viewChild, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { MetricsService } from '../../services/metrics.service';
import { RepoMetric } from '../../models/metrics.models';
import { barChartOptions, barDataset } from '../../chart-theme';
import { RangeToggleComponent, RangeKey } from '../range-toggle/range-toggle.component';
import { MonthValue, YearValue, distinctYears, filterByMonthYear } from '../../month-filter';
import { MonthYearFilterComponent } from '../month-year-filter/month-year-filter.component';

Chart.register(...registerables); // Registers all necessary Chart.js components (e.g., scales, controllers, elements).

/** Enlarged "unique users per month" chart shown in a dialog (opened from the Unique Users card). */
@Component({
  selector: 'app-monthly-users-popup',
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatProgressSpinnerModule, RangeToggleComponent, MonthYearFilterComponent],
  templateUrl: './monthly-users-popup.component.html',
  styleUrl: './monthly-users-popup.component.css'
})
export class MonthlyUsersPopupComponent implements OnInit {
  private metrics = inject(MetricsService); // Reads the already-cached repo metrics (no refetch).
  private destroyRef = inject(DestroyRef);
  chart: any;
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas'); // Template ref to the <canvas> this chart renders into.

  rawData: RepoMetric[] = []; // Stores the raw, unfiltered data from the shared service.
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  // Range + initial month/year are inherited from the card that opened this dialog.
  private dialogData = inject<{ range?: RangeKey; month?: MonthValue; year?: YearValue } | null>(
    MAT_DIALOG_DATA,
    { optional: true },
  );
  range = signal<RangeKey>(this.dialogData?.range ?? 'all');

  // Structured month / year filter (custom dropdown, no native <select>).
  readonly years = signal<number[]>([]); // distinct years present in the data
  readonly selectedMonth = signal<MonthValue>(this.dialogData?.month ?? 'all');
  readonly selectedYear = signal<YearValue>(this.dialogData?.year ?? 'all');
  readonly emptySelection = signal(false); // true when the current selection matches no months

  ngOnInit(): void {
    this.metrics.repoMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.rawData = data;
      this.years.set(distinctYears(data));
      this.loading.set(false);
      this.errorMsg.set(this.metrics.repoError() && data.length === 0 ? 'Failed to load data.' : null);
      this.applyFilter();
    });
  }

  // Applies the time window (12 / 24 / all) then the month/year selection, and re-renders.
  applyFilter() {
    const data = filterByMonthYear(
      this.sliceToRange(this.rawData),
      this.selectedMonth(),
      this.selectedYear()
    );
    this.emptySelection.set(data.length === 0 && this.rawData.length > 0);
    this.updateChart(data);
  }

  // Sort ascending chronologically, then keep the last 12 / 24 months (or all).
  private sliceToRange(data: RepoMetric[]): RepoMetric[] {
    const sorted = [...data].sort(
      (a, b) => new Date(a.month_year ?? '').getTime() - new Date(b.month_year ?? '').getTime()
    );
    if (this.range() === 'all') return sorted;
    return sorted.slice(this.range() === 'l12' ? -12 : -24);
  }

  // Change the visible time window and re-render.
  setRange(key: RangeKey) {
    if (this.range() === key) return;
    this.range.set(key);
    this.applyFilter();
  }

  // Update the month / year selection and re-render.
  setMonth(month: MonthValue) {
    this.selectedMonth.set(month);
    this.applyFilter();
  }
  setYear(year: YearValue) {
    this.selectedYear.set(year);
    this.applyFilter();
  }

  // Clears the month / year selection (keeps the selected time window) and re-renders.
  resetFilter() {
    this.selectedMonth.set('all');
    this.selectedYear.set('all');
    this.applyFilter();
  }

  // Configures and renders the Chart.js bar graph using the provided data.
  updateChart(data: RepoMetric[]) {
    // Sort ascending chronologically so the expanded chart matches the card's month order.
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
        if (this.chart) {
          this.chart.destroy(); // Destroys any existing Chart.js instance to prevent memory leaks and overlaps.
        }
        this.chart = new Chart(canvas, config); // Creates a new Chart.js instance on the canvas with the defined configuration.
      }
  }
}