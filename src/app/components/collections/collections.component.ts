import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { CollectionMetric } from '../../models/metrics.models';
import { chartTheme } from '../../chart-theme';
import { CollectionDetailComponent } from '../collection-detail/collection-detail.component';

Chart.register(...registerables);

/**
 * "Downloads by Collection" card: a horizontal bar of total downloads for each PDR collection
 * (`nrda:ScienceTheme`). Collections group curated datasets that name them via `isPartOf`; this rolls
 * their members' download counts up in memory (see MetricsService.collectionMetrics$ and
 * docs/09-collections.md). The tooltip adds member counts, volume and user-sessions.
 */
@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule, MatDialogModule],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.css',
})
export class CollectionsComponent implements AfterViewInit {
  private metrics = inject(MetricsService);
  private theme = inject(ThemeService);
  private destroyRef = inject(DestroyRef);
  private dialog = inject(MatDialog);

  chart: Chart | undefined;
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private rows: CollectionMetric[] = [];
  /** Same rows, exposed for the accessible legend/list under the chart. */
  readonly items = signal<CollectionMetric[]>([]);
  readonly loading = signal(true);
  readonly empty = signal(false);
  readonly errorMsg = signal<string | null>(null);

  // Headline figures shown above the chart.
  readonly collectionCount = signal(0);
  readonly totalMembers = signal(0);
  readonly totalDownloads = signal(0);

  constructor() {
    effect(() => {
      this.theme.mode();
      this.theme.color();
      if (this.chart) this.draw();
    });
    this.metrics.collectionMetrics$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.rows = data;
      this.items.set(data);
      this.collectionCount.set(data.length);
      this.totalMembers.set(data.reduce((s, r) => s + r.memberCount, 0));
      this.totalDownloads.set(data.reduce((s, r) => s + r.downloads, 0));
      this.loading.set(false);
      this.empty.set(data.length === 0);
      this.errorMsg.set(this.metrics.datasetError() && data.length === 0 ? 'Failed to load data.' : null);
      this.draw();
    });
  }

  ngAfterViewInit(): void {
    this.draw();
  }

  /** Open the right-side drill-down drawer for a collection (from a bar click or the legend). */
  openCollection(r: CollectionMetric): void {
    this.dialog.open(CollectionDetailComponent, {
      panelClass: 'detail-panel',
      position: { right: '0', top: '0' },
      width: '460px',
      maxWidth: '94vw',
      height: '100vh',
      autoFocus: 'dialog',
      ariaLabel: `${r.title} details`,
      data: { id: r.id, title: r.title },
    });
  }

  /** Short label for the y-axis (full title lives in the tooltip). */
  private shortLabel(title: string): string {
    const clean = title.replace(/\s+(Data\s+)?Collection$/i, '').trim() || title;
    return clean.length > 26 ? clean.slice(0, 24) + '…' : clean;
  }

  private draw(): void {
    const canvas = this.chartCanvas()?.nativeElement;
    if (!canvas) return;
    const t = chartTheme();
    const accent = t.barBorder;
    const cs = getComputedStyle(document.documentElement);
    const surface = cs.getPropertyValue('--color-surface').trim() || '#ffffff';
    const strong = cs.getPropertyValue('--color-text').trim() || '#1e293b';

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: this.rows.map((r) => this.shortLabel(r.title)),
        datasets: [
          {
            label: 'Downloads',
            data: this.rows.map((r) => r.downloads),
            backgroundColor: accent + 'cc',
            hoverBackgroundColor: accent,
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 650, easing: 'easeOutQuart' },
        onClick: (_evt, elements) => {
          const r = elements.length ? this.rows[elements[0].index] : undefined;
          if (r) this.openCollection(r);
        },
        onHover: (evt, elements) => {
          const target = evt.native?.target as HTMLElement | undefined;
          if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: 'Total downloads', color: t.text },
            ticks: { color: t.text, maxTicksLimit: 6, callback: (v) => Number(v).toLocaleString() },
            grid: { color: t.grid },
            border: { display: false },
          },
          y: {
            ticks: { color: t.text },
            grid: { display: false },
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
            callbacks: {
              title: (items) => this.rows[items[0].dataIndex]?.title ?? '',
              label: (item) => {
                const r = this.rows[item.dataIndex];
                if (!r) return '';
                return [
                  `${r.downloads.toLocaleString()} downloads`,
                  `${r.memberCount} datasets (${r.membersWithUsage} with usage)`,
                  `${this.formatSize(r.size)} · ${r.users.toLocaleString()} user-sessions`,
                ];
              },
            },
          },
        },
      },
    };

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(canvas, config);
  }

  /** Bytes → a compact TB/GB string. */
  private formatSize(bytes: number): string {
    const tb = bytes * 1e-12;
    if (tb >= 1) return `${tb.toFixed(2)} TB`;
    const gb = bytes * 1e-9;
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    return `${(bytes * 1e-6).toFixed(0)} MB`;
  }
}
