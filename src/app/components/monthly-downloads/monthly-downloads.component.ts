import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Component, DestroyRef, ElementRef, computed, viewChild, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MonthlyDownloadsPopupComponent } from '../monthly-downloads-popup/monthly-downloads-popup.component';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { RepoMetric } from '../../models/metrics.models';
import { barChartOptions, barDataset } from '../../chart-theme';
import { RangeToggleComponent, RangeKey } from '../range-toggle/range-toggle.component';
import { MonthOption, filterByMonthRange, matchPreset, monthYearOptions, presetRange } from '../../month-filter';
import { MonthRangeComponent } from '../month-range/month-range.component';

Chart.register(...registerables);

/**
 * Bar chart of successful downloads per month. Reads the shared, cached repo metrics, supports a
 * custom From -> To month range (plus 12M/24M/All presets), can open an enlarged copy in a dialog,
 * and re-renders with theme-aware colors when the theme changes.
 */
@Component({
  selector: 'app-monthly-downloads',
  imports: [CommonModule, FormsModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule, MatTooltipModule, MatDialogModule, RangeToggleComponent, MonthRangeComponent],
  templateUrl: './monthly-downloads.component.html',
  styleUrl: './monthly-downloads.component.css'
})
export class MonthlyDownloadsComponent implements OnInit {
  private metrics = inject(MetricsService);
  private dialog = inject(MatDialog);
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
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  rawData: RepoMetric[] = [];
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  // Custom month-year range (From -> To); defaults to the full span. Presets set these for you.
  readonly options = signal<MonthOption[]>([]);
  readonly from = signal<string>('');
  readonly to = signal<string>('');
  readonly emptySelection = signal(false);
  readonly activePreset = computed(() => matchPreset(this.options(), this.from(), this.to()));

  ngOnInit(): void {
    this.metrics.repoMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.rawData = data;
      const opts = monthYearOptions(data);
      this.options.set(opts);
      if (opts.length) {
        this.from.set(opts[0].value);
        this.to.set(opts[opts.length - 1].value);
      }
      this.loading.set(false);
      this.errorMsg.set(this.metrics.repoError() && data.length === 0 ? 'Failed to load data.' : null);
      this.applyFilter();
    });
  }

  // Sort chronologically (the API returns newest-first), then keep the selected [from, to] range.
  applyFilter() {
    const sorted = [...this.rawData].sort(
      (a, b) => new Date(a.month_year ?? '').getTime() - new Date(b.month_year ?? '').getTime()
    );
    const data = filterByMonthRange(sorted, this.from(), this.to());
    this.emptySelection.set(data.length === 0 && this.rawData.length > 0);
    this.updateChart(data);
  }

  setFrom(v: string) { this.from.set(v); this.applyFilter(); }
  setTo(v: string) { this.to.set(v); this.applyFilter(); }
  setRange(key: RangeKey) {
    const r = presetRange(this.options(), key);
    this.from.set(r.from);
    this.to.set(r.to);
    this.applyFilter();
  }
  resetFilter() {
    const opts = this.options();
    this.from.set(opts[0]?.value ?? '');
    this.to.set(opts[opts.length - 1]?.value ?? '');
    this.applyFilter();
  }

  openExpanded() {
    this.dialog.open(MonthlyDownloadsPopupComponent, {
      maxWidth: '95vw',
      data: { from: this.from(), to: this.to() },
    });
  }

  updateChart(data: RepoMetric[]) {
    const labels = data.map((item) => item.month_year || 'Unknown');
    const values = data.map((item) => item.success_download || 0);

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: { labels, datasets: [barDataset('Number of Downloads', values)] },
      options: barChartOptions('Dates', 'Number of Downloads'),
    };

    const canvas = this.chartCanvas()?.nativeElement;
    if (canvas) {
      if (this.chart) this.chart.destroy();
      this.chart = new Chart(canvas, config);
    }
  }
}
