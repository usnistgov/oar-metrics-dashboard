import { Component, DestroyRef, WritableSignal, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest } from 'rxjs';
import { MetricsService } from '../../services/metrics.service';
import { CatalogCoverage, DataSetMetric, RepoMetric } from '../../models/metrics.models';
import { formatSize } from '../../format';

/**
 * Executive KPI strip across the top of the dashboard: all-time downloads and download volume (each
 * with a "this year" sub-stat and a monthly sparkline), the most recent download, datasets tracked,
 * and how far back the data goes. Reads the already-cached repo + dataset metrics (no extra API
 * calls); the big numbers count up on load.
 */
@Component({
  selector: 'app-kpi-summary',
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: './kpi-summary.component.html',
  styleUrl: './kpi-summary.component.css',
})
export class KpiSummaryComponent {
  private metrics = inject(MetricsService);
  private destroyRef = inject(DestroyRef);

  // Whether to render the KPI tiles. When false (the KPI widget is hidden in Settings), nothing
  // renders - the Settings / Refresh actions live in the app header now.
  readonly showTiles = input(true);
  // Gates the tile rise-in animation so it plays as the loading overlay clears (not behind the blur).
  readonly ready = input(false);

  // Animated big numbers.
  readonly downloads = signal(0);
  readonly volumeTb = signal(0);
  readonly datasets = signal(0);
  readonly volTargetTb = signal(0); // final volume, so the unit (TB/PB) is stable during count-up

  // Catalog coverage (how many cataloged datasets have usage) - drives the Datasets tracked bar.
  readonly coverage = toSignal(this.metrics.catalogCoverage$, {
    initialValue: { catalog: 0, withUsage: 0, untracked: 0, offCatalog: 0, coverage: 0 } as CatalogCoverage,
  });
  readonly coveragePct = computed(() => Math.round(this.coverage().coverage * 100));
  readonly catalogLabel = computed(() => this.coverage().catalog.toLocaleString());

  // "This year" sub-stats (preformatted), the most-recent download, and the date-range tiles.
  readonly downloadsYear = signal('');
  readonly volumeYear = signal('');
  readonly recentRelative = signal('-');
  readonly recentAbsolute = signal('');
  readonly since = signal('-');
  readonly span = signal('');

  // Current month (month-to-date) downloads + volume, shown together in one tile.
  readonly monthName = signal('');
  readonly monthDownloads = signal('-');
  readonly monthVolume = signal('-');

  // Month-over-month change (latest month vs the previous one) for the two download tiles.
  readonly downloadsMoM = signal<number | null>(null);
  readonly volumeMoM = signal<number | null>(null);
  readonly downloadsMoMChip = computed(() => this.momChip(this.downloadsMoM()));
  readonly volumeMoMChip = computed(() => this.momChip(this.volumeMoM()));

  // Sparkline geometry (SVG point strings over a 100x28 viewBox).
  readonly dlLine = signal('');
  readonly dlArea = signal('');
  readonly volLine = signal('');
  readonly volArea = signal('');

  // Formatted big-number displays.
  readonly downloadsLabel = computed(() => this.compact(this.downloads()));
  readonly datasetsLabel = computed(() => Math.round(this.datasets()).toLocaleString());
  readonly volumeUnit = computed(() => (this.volTargetTb() >= 1000 ? 'PB' : 'TB'));
  readonly volumeLabel = computed(() =>
    this.volTargetTb() >= 1000
      ? (this.volumeTb() / 1000).toFixed(2)
      : Math.round(this.volumeTb()).toLocaleString(),
  );

  private animated = false;

  constructor() {
    // Datasets come from the reconciled stream so the "Datasets tracked" count matches the coverage
    // bar (aliases collapsed to their canonical ediid, no double counting).
    combineLatest([this.metrics.repoMetrics$, this.metrics.reconciledDatasets$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([repo, datasets]) => this.compute(repo, datasets));
  }

  private compute(repo: RepoMetric[], datasets: DataSetMetric[]): void {
    // month_year is "June 2026" (not lexically sortable, returned newest-first), so parse to dates.
    const months = repo
      .map((m) => ({ m, d: new Date(m.month_year) }))
      .filter((x) => !isNaN(x.d.getTime()))
      .sort((a, b) => a.d.getTime() - b.d.getTime());

    const dl = months.map((x) => x.m.success_download ?? 0);
    const vol = months.map((x) => (x.m.total_size ?? 0) * 1e-12); // bytes -> TB

    this.dlLine.set(this.points(dl));
    this.dlArea.set(this.areaPoints(dl));
    this.volLine.set(this.points(vol));
    this.volArea.set(this.areaPoints(vol));

    const totalDownloads = dl.reduce((s, n) => s + n, 0);
    const totalVolume = vol.reduce((s, n) => s + n, 0);
    this.volTargetTb.set(totalVolume);

    if (months.length) {
      const latest = months[months.length - 1];
      const year = latest.d.getFullYear();
      const ytd = months.filter((x) => x.d.getFullYear() === year);
      const ytdDownloads = ytd.reduce((s, x) => s + (x.m.success_download ?? 0), 0);
      const ytdVolume = ytd.reduce((s, x) => s + (x.m.total_size ?? 0) * 1e-12, 0);
      this.downloadsYear.set(`+${this.compact(ytdDownloads)} in ${year}`);
      this.volumeYear.set(`+${this.volumeText(ytdVolume)} in ${year}`);

      // Current month (the latest row) - downloads + volume, month-to-date.
      this.monthName.set(latest.m.month_year);
      this.monthDownloads.set(this.compact(latest.m.success_download ?? 0));
      this.monthVolume.set(formatSize(latest.m.total_size ?? 0));

      this.since.set(months[0].m.month_year);
      const years = (latest.d.getTime() - months[0].d.getTime()) / (365.25 * 864e5);
      this.span.set(
        years >= 1 ? `~${years.toFixed(1)} years of data` : `${months.length} months of data`,
      );

      if (months.length >= 2) {
        const cur = latest.m;
        const prev = months[months.length - 2].m;
        this.downloadsMoM.set(this.pctChange(prev.success_download ?? 0, cur.success_download ?? 0));
        this.volumeMoM.set(this.pctChange(prev.total_size ?? 0, cur.total_size ?? 0));
      } else {
        this.downloadsMoM.set(null);
        this.volumeMoM.set(null);
      }
    }

    // Most recent download = the newest last_time_logged across all datasets.
    let recentMs = 0;
    for (const d of datasets) {
      const t = d.last_time_logged ? new Date(d.last_time_logged).getTime() : NaN;
      if (!isNaN(t) && t > recentMs) recentMs = t;
    }
    if (recentMs > 0) {
      this.recentRelative.set(this.relative(recentMs));
      this.recentAbsolute.set(
        new Date(recentMs).toLocaleString('en', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
      );
    }

    // Count up once on first load; later refreshes (or reduced-motion) set the value directly.
    if (this.animated || this.prefersReducedMotion()) {
      this.animated = true;
      this.downloads.set(totalDownloads);
      this.volumeTb.set(totalVolume);
      this.datasets.set(datasets.length);
    } else {
      this.animated = true;
      this.animateTo(this.downloads, totalDownloads);
      this.animateTo(this.volumeTb, totalVolume);
      this.animateTo(this.datasets, datasets.length);
    }
  }

  private prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Ease a signal from 0 to its target with a short count-up animation. */
  private animateTo(sig: WritableSignal<number>, target: number, ms = 900): void {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      sig.set(target * eased);
      if (t < 1) requestAnimationFrame(step);
      else sig.set(target);
    };
    requestAnimationFrame(step);
  }

  /** Percent change from prev to cur, rounded; null when prev is 0 (growth is undefined). */
  private pctChange(prev: number, cur: number): number | null {
    if (!prev) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }

  /** Formats a percent into an up/down chip (the template picks the trend icon), or null. */
  private momChip(pct: number | null): { text: string; dir: 'up' | 'down' } | null {
    if (pct === null) return null;
    const dir: 'up' | 'down' = pct >= 0 ? 'up' : 'down';
    return { text: `${Math.abs(pct)}%`, dir };
  }

  private compact(n: number): string {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
  }

  /** Volume in TB, switching to PB once it reaches 1,000 TB. */
  private volumeText(tb: number): string {
    return tb >= 1000 ? `${(tb / 1000).toFixed(2)} PB` : `${Math.round(tb).toLocaleString()} TB`;
  }

  /** Compact "X ago" string for a timestamp (ms). */
  private relative(ms: number): string {
    const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  /** Polyline points for a sparkline over a 100x28 viewBox. */
  private points(values: number[], w = 100, h = 28): string {
    if (values.length < 2) return '';
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const step = w / (values.length - 1);
    return values
      .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
      .join(' ');
  }

  /** Same points, closed to the baseline, for the filled area under the line. */
  private areaPoints(values: number[], w = 100, h = 28): string {
    const p = this.points(values, w, h);
    return p ? `0,${h} ${p} ${w},${h}` : '';
  }
}
