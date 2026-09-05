import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, computed, viewChild, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { MetricsService } from '../../services/metrics.service';
import { RepoMetric } from '../../models/metrics.models';
import { barChartOptions, barDataset } from '../../chart-theme';
import { MonthOption, filterByMonthRange, matchPreset, monthYearOptions, presetRange } from '../../month-filter';
import { MonthRangeComponent } from '../month-range/month-range.component';
import { RangeToggleComponent, RangeKey } from '../range-toggle/range-toggle.component';

Chart.register(...registerables);

/** Enlarged "downloads per month" chart shown in a dialog (opened from the Monthly Downloads card). */
@Component({
  selector: 'app-monthly-downloads-popup',
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule, MonthRangeComponent, RangeToggleComponent],
  templateUrl: './monthly-downloads-popup.component.html',
  styleUrl: './monthly-downloads-popup.component.css'
})
export class MonthlyDownloadsPopupComponent implements OnInit {
  private metrics = inject(MetricsService);
  private destroyRef = inject(DestroyRef);
  chart: any;
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  rawData: RepoMetric[] = [];
  loading = signal(true);
  errorMsg = signal<string | null>(null);

  // Custom month-year range (From -> To); defaults to the full span (earliest -> latest).
  readonly options = signal<MonthOption[]>([]);
  readonly from = signal<string>('');
  readonly to = signal<string>('');
  readonly emptySelection = signal(false);

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

  // Keep rows within the selected [from, to] month range, then re-render.
  applyFilter() {
    const data = filterByMonthRange(this.rawData, this.from(), this.to());
    this.emptySelection.set(data.length === 0 && this.rawData.length > 0);
    this.updateChart(data);
  }

  setFrom(v: string) { this.from.set(v); this.applyFilter(); }
  setTo(v: string) { this.to.set(v); this.applyFilter(); }
  resetFilter() {
    const opts = this.options();
    this.from.set(opts[0]?.value ?? '');
    this.to.set(opts[opts.length - 1]?.value ?? '');
    this.applyFilter();
  }

  // Preset windows set the From/To for you; the toggle highlights only when the range matches one.
  readonly activePreset = computed(() => matchPreset(this.options(), this.from(), this.to()));
  setRange(key: RangeKey) {
    const r = presetRange(this.options(), key);
    this.from.set(r.from);
    this.to.set(r.to);
    this.applyFilter();
  }

  // Configures and renders the Chart.js bar graph using the provided data.
  updateChart(data: RepoMetric[]) {
    const sorted = [...data].sort(
      (a, b) => new Date(a.month_year ?? '').getTime() - new Date(b.month_year ?? '').getTime()
    );
    const labels = sorted.map(item => item.month_year || 'Unknown');
    const values = sorted.map(item => item.success_download || 0);

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
