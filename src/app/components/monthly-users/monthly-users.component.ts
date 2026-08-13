import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, viewChild, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MonthlyUsersPopupComponent } from '../monthly-users-popup/monthly-users-popup.component';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { RepoMetric } from '../../models/metrics.models';
import { barChartOptions, barDataset } from '../../chart-theme';
import { RangeToggleComponent, RangeKey } from '../range-toggle/range-toggle.component';
import { MonthValue, YearValue, distinctYears, filterByMonthYear } from '../../month-filter';
import { MonthYearFilterComponent } from '../month-year-filter/month-year-filter.component';

Chart.register(...registerables); // Registers all necessary Chart.js components (e.g., bar charts, tooltips, legends).

/**
 * Bar chart of unique users per month. Reads the shared, cached repo metrics, supports a month/year
 * filter, can open an enlarged copy in a dialog, and re-renders with theme-aware colors when the
 * theme changes.
 */
@Component({
  selector: 'app-monthly-users',
  imports: [CommonModule, FormsModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule, MatTooltipModule, MatDialogModule, RangeToggleComponent, MonthYearFilterComponent],
  templateUrl: './monthly-users.component.html',
  styleUrl: './monthly-users.component.css'
})
export class MonthlyUsersComponent implements OnInit {
  private metrics = inject(MetricsService); // Shared, cached repo metrics.
  private dialog = inject(MatDialog); // Opens the enlarged chart in a Material dialog.
  private destroyRef = inject(DestroyRef);
  private theme = inject(ThemeService);

  constructor() {
    effect(() => {
      this.theme.mode();
      this.theme.color();
      if (this.chart) this.applyFilter();
    });
  }
  chart: any;
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas'); // Template ref to the <canvas> this chart renders into.

  rawData: RepoMetric[] = []; // Stores the raw, unfiltered data from the shared service.
  range = signal<RangeKey>('all'); // Visible time window (last 12 / 24 months / all).
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  // Custom month / year selector (no native <select>).
  readonly years = signal<number[]>([]);
  readonly selectedMonth = signal<MonthValue>('all');
  readonly selectedYear = signal<YearValue>('all');
  readonly emptySelection = signal(false);

  ngOnInit(): void {
    this.metrics.repoMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.rawData = data;
      this.years.set(distinctYears(data));
      this.loading.set(false);
      this.errorMsg.set(this.metrics.repoError() && data.length === 0 ? 'Failed to load data.' : null);
      this.applyFilter();
    });
  }

  // Redraw for the selected time window, then the chosen month/year.
  applyFilter() {
    const data = filterByMonthYear(
      this.sliceToRange(this.rawData),
      this.selectedMonth(),
      this.selectedYear()
    );
    this.emptySelection.set(data.length === 0 && this.rawData.length > 0);
    this.updateChart(data);
  }

  // Sort chronologically (the API returns newest-first) and keep only the selected window.
  private sliceToRange(data: RepoMetric[]): RepoMetric[] {
    const sorted = [...data].sort(
      (a, b) => new Date(a.month_year ?? '').getTime() - new Date(b.month_year ?? '').getTime()
    );
    if (this.range() === 'all') return sorted;
    return sorted.slice(this.range() === 'l12' ? -12 : -24);
  }

  // Switch the visible time window and redraw.
  setRange(key: RangeKey) {
    this.range.set(key);
    this.applyFilter();
  }

  // Update the month / year selection and redraw.
  setMonth(month: MonthValue) {
    this.selectedMonth.set(month);
    this.applyFilter();
  }
  setYear(year: YearValue) {
    this.selectedYear.set(year);
    this.applyFilter();
  }

  // Resets the month/year selection and shows the full window again.
  resetFilter() {
    this.selectedMonth.set('all');
    this.selectedYear.set('all');
    this.applyFilter();
  }

  // Opens the enlarged chart in a Material dialog, carrying the current filter state.
  openExpanded() {
    this.dialog.open(MonthlyUsersPopupComponent, {
      maxWidth: '95vw',
      data: { range: this.range(), month: this.selectedMonth(), year: this.selectedYear() },
    });
  }

  // Configures and renders the Chart.js bar graph using the provided data.
  updateChart(data: RepoMetric[]) {
    const labels = data.map(item => item.month_year || 'Unknown');
    const values = data.map(item => item.unique_users || 0);

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: { labels, datasets: [barDataset('Number of Unique Users', values)] },
      options: barChartOptions('Dates', 'Number of Unique Users'),
    };

    const canvas = this.chartCanvas()?.nativeElement;
    if (canvas) {
      if (this.chart) {
        this.chart.destroy(); // Destroy any existing Chart.js instance to prevent memory leaks and overlaps.
      }
      this.chart = new Chart(canvas, config); // Create a new Chart.js instance on the canvas with the defined configuration.
    }
  }
}