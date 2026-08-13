import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { combineLatest } from 'rxjs';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { CollectionMembership, DataSetMetric } from '../../models/metrics.models';
import { CollectionShare, ShareMetric, ShareSlice, collectionShare } from '../../collection-stats';
import { sliceColors } from '../../chart-theme';
import { CollectionDetailComponent } from '../collection-detail/collection-detail.component';

Chart.register(...registerables);

/**
 * "Collections' Share of Downloads" card: a doughnut splitting the whole repository into each PDR
 * collection plus a single "Not in a collection" remainder, so a viewer can see at a glance how much
 * of all activity curated collections actually capture (typically a small slice). Toggle between
 * total downloads and data volume. Slice math is union-deduped and honest, see
 * {@link collectionShare} and docs/09-collections.md.
 */
@Component({
  selector: 'app-collection-share',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule, MatDialogModule],
  templateUrl: './collection-share.component.html',
  styleUrl: './collection-share.component.css',
})
export class CollectionShareComponent implements AfterViewInit {
  private metrics = inject(MetricsService);
  private theme = inject(ThemeService);
  private destroyRef = inject(DestroyRef);
  private dialog = inject(MatDialog);

  chart: Chart | undefined;
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private memberships: CollectionMembership[] = [];
  private datasets: DataSetMetric[] = [];

  readonly metric = signal<ShareMetric>('downloads');
  readonly share = signal<CollectionShare | null>(null);
  /** Slice colors aligned to `share().slices` (accent tints + neutral remainder). */
  readonly colors = signal<string[]>([]);
  readonly loading = signal(true);
  readonly empty = signal(false);
  readonly errorMsg = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.theme.mode();
      this.theme.color();
      if (this.chart) this.recompute(); // re-tint + redraw on theme/accent change
    });
    combineLatest([this.metrics.collectionMemberships$, this.metrics.datasetMetrics$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([memberships, datasets]) => {
        this.memberships = memberships;
        this.datasets = datasets;
        this.recompute();
      });
  }

  ngAfterViewInit(): void {
    this.draw();
  }

  setMetric(m: ShareMetric): void {
    if (this.metric() === m) return;
    this.metric.set(m);
    this.recompute();
  }

  metricLabel(): string {
    return this.metric() === 'size' ? 'data volume' : 'downloads';
  }

  private recompute(): void {
    const s = collectionShare(this.memberships, this.datasets, this.metric());
    this.share.set(s);
    // The doughnut shows only the collections (the ~88% "not in a collection" remainder would dwarf
    // them and hide the small ones); coverage is surfaced as the center number instead.
    this.colors.set(sliceColors(this.collectionSlices().length));
    this.loading.set(false);
    this.empty.set(this.memberships.length === 0);
    this.errorMsg.set(this.metrics.datasetError() && this.datasets.length === 0 ? 'Failed to load data.' : null);
    this.draw();
  }

  /** The collection slices only (excludes the "Not in a collection" remainder). */
  collectionSlices(): ShareSlice[] {
    return this.share()?.slices.filter((s) => s.id) ?? [];
  }

  /** A slice's share of collection activity (denominator is the collections' union total). */
  pctOfCollections(value: number): number {
    const covered = this.share()?.covered ?? 0;
    return covered ? (value / covered) * 100 : 0;
  }

  /** Open the drill-down drawer for a collection slice (the remainder slice is not clickable). */
  openCollection(id: string, title: string): void {
    this.dialog.open(CollectionDetailComponent, {
      panelClass: 'detail-panel',
      position: { right: '0', top: '0' },
      width: '460px',
      maxWidth: '94vw',
      height: '100vh',
      autoFocus: 'dialog',
      ariaLabel: `${title} details`,
      data: { id, title },
    });
  }

  formatValue(value: number): string {
    return this.metric() === 'size' ? this.formatSize(value) : value.toLocaleString();
  }

  private formatSize(bytes: number): string {
    const tb = bytes * 1e-12;
    if (tb >= 1) return `${tb.toFixed(2)} TB`;
    const gb = bytes * 1e-9;
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    return `${(bytes * 1e-6).toFixed(0)} MB`;
  }

  private draw(): void {
    const canvas = this.chartCanvas()?.nativeElement;
    const s = this.share();
    if (!canvas || !s) return;

    const slices = this.collectionSlices();
    const cs = getComputedStyle(document.documentElement);
    const surface = cs.getPropertyValue('--color-surface').trim() || '#ffffff';
    const strong = cs.getPropertyValue('--color-text').trim() || '#1e293b';
    const muted = cs.getPropertyValue('--color-muted').trim() || '#64748b';
    const colors = this.colors();

    // Center label: how much of the whole repository these collections capture (the honest coverage
    // number), shown in the hole so it does not need an 88% slice that would hide the small ones.
    const centerText = {
      id: 'centerText',
      afterDraw: (chart: Chart) => {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        const pct = s.coveredPct;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = strong;
        ctx.font = '700 20px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${pct.toFixed(1)}%`, cx, cy - 5); // one decimal, matches the caption
        ctx.fillStyle = muted;
        ctx.font = '500 10px system-ui, -apple-system, sans-serif';
        ctx.fillText('of repo', cx, cy + 11);
        ctx.restore();
      },
    };

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: slices.map((x) => x.label),
        datasets: [
          {
            data: slices.map((x) => x.value),
            backgroundColor: colors,
            borderColor: surface,
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        animation: { duration: 650, easing: 'easeOutQuart' },
        onClick: (_evt, elements) => {
          const slice = elements.length ? slices[elements[0].index] : undefined;
          if (slice?.id) this.openCollection(slice.id, slice.label);
        },
        onHover: (evt, elements) => {
          const target = evt.native?.target as HTMLElement | undefined;
          if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: surface,
            titleColor: strong,
            bodyColor: strong,
            borderColor: muted,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
            callbacks: {
              label: (item) => {
                const slice = slices[item.dataIndex];
                if (!slice) return '';
                const pct = this.pctOfCollections(slice.value);
                return ` ${this.formatValue(slice.value)} (${pct.toFixed(pct < 10 ? 1 : 0)}% of collections)`;
              },
            },
          },
        },
      },
      plugins: [centerText],
    };

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(canvas, config);
  }
}
