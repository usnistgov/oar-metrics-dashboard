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
import { MonthlyPopupComponent } from '../monthly-popup/monthly-popup.component';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { barChartOptions, barDataset } from '../../chart-theme';
import { RepoMetric } from '../../models/metrics.models';
import { RangeToggleComponent, RangeKey } from '../range-toggle/range-toggle.component';
import { MonthValue, YearValue, distinctYears, filterByMonthYear } from '../../month-filter';
import { MonthYearFilterComponent } from '../month-year-filter/month-year-filter.component';

Chart.register(...registerables); // pull in the chart types, scales, and plugins Chart.js needs

/**
 * "Monthly Download Sizes" card - a bar chart of total download volume (in TB) per month.
 * Reads the shared, cached repo metrics, supports a month/year filter, can open an enlarged
 * copy in a dialog, and re-renders with theme-aware colors when the theme changes.
 */
@Component({
  selector: 'app-monthly-graph',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule, MatTooltipModule, MatDialogModule, RangeToggleComponent, MonthYearFilterComponent],
  templateUrl: './monthly-graph.component.html',
  styleUrl: './monthly-graph.component.css',
})
export class MonthlyGraphComponent implements OnInit {
  private metrics = inject(MetricsService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private theme = inject(ThemeService);

  constructor() {
    // Repaint the chart with the new palette whenever the mode or accent color changes.
    effect(() => {
      this.theme.mode();
      this.theme.color();
      if (this.chart) this.applyFilter();
    });
  }

  chart: any;
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas'); // the <canvas> this chart draws into

  rawData: RepoMetric[] = [];        // the full, unfiltered series from the service
  range = signal<RangeKey>('all');   // visible time window (last 12 / 24 months / all)
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  // Custom month / year selector (no native <select>).
  readonly years = signal<number[]>([]);
  readonly selectedMonth = signal<MonthValue>('all');
  readonly selectedYear = signal<YearValue>('all');
  readonly emptySelection = signal(false);

  ngOnInit(): void {
    // Subscribe to the shared metrics; this also re-emits on auto/manual refresh.
    this.metrics.repoMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.rawData = data;
      this.years.set(distinctYears(data));
      this.loading.set(false);
      this.errorMsg.set(this.metrics.repoError() && data.length === 0 ? 'Failed to load data.' : null);
      this.applyFilter();
    });
  }

  // Redraw the chart for the selected time window, then the chosen month/year.
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

  // Clear the month/year selection and show the full window again.
  resetFilter() {
    this.selectedMonth.set('all');
    this.selectedYear.set('all');
    this.applyFilter();
  }

  // Open an enlarged copy of this chart in a dialog, carrying the current filter state.
  openExpanded() {
    this.dialog.open(MonthlyPopupComponent, {
      maxWidth: '95vw',
      data: { range: this.range(), month: this.selectedMonth(), year: this.selectedYear() },
    });
  }

  // (Re)build the Chart.js bar chart for the given rows.
  updateChart(data: RepoMetric[]) {
    const labels = data.map(item => item.month_year || 'Unknown');
    const values = data.map(item => (Math.pow(10, -12) * item.total_size) || 0); // bytes -> terabytes

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: { labels, datasets: [barDataset('Total Download Size', values)] },
      options: barChartOptions('Dates', 'Total Download Size (TB)'),
    };

    const canvas = this.chartCanvas()?.nativeElement;
    if (canvas) {
      if (this.chart) {
        this.chart.destroy(); // drop the previous instance before drawing a fresh one
      }
      this.chart = new Chart(canvas, config);
    }
  }
}
