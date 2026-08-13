import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { KpiSummaryComponent } from './kpi-summary.component';
import { MetricsService } from '../../services/metrics.service';
import { DataSetMetric, RepoMetric } from '../../models/metrics.models';

describe('KpiSummaryComponent', () => {
  let component: KpiSummaryComponent;
  let fixture: ComponentFixture<KpiSummaryComponent>;
  let repo$: BehaviorSubject<RepoMetric[]>;
  let datasets$: BehaviorSubject<DataSetMetric[]>;

  // Realistic repo rows, returned newest-first (as the real API does). The component parses
  // month_year strings to dates and sorts them oldest-first internally.
  const repoRows: RepoMetric[] = [
    { month_year: 'June 2026', total_size: 600_000_000_000, success_download: 3000, unique_users: 300 },
    { month_year: 'May 2026', total_size: 500_000_000_000, success_download: 2000, unique_users: 200 },
    { month_year: 'January 2026', total_size: 400_000_000_000, success_download: 1000, unique_users: 100 },
  ];

  // One dataset with a known recent timestamp, plus one without a timestamp.
  const recentMs = Date.now() - 5 * 60 * 1000; // 5 minutes ago
  const datasetRows: DataSetMetric[] = [
    { ediid: 'ds-1', last_time_logged: new Date(recentMs).toISOString() },
    { ediid: 'ds-2' },
  ];

  beforeEach(async () => {
    repo$ = new BehaviorSubject<RepoMetric[]>(repoRows);
    datasets$ = new BehaviorSubject<DataSetMetric[]>(datasetRows);
    const stub = { repoMetrics$: repo$, datasetMetrics$: datasets$ };

    await TestBed.configureTestingModule({
      imports: [KpiSummaryComponent],
      providers: [{ provide: MetricsService, useValue: stub }],
    }).compileComponents();

    fixture = TestBed.createComponent(KpiSummaryComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits settings when the settings FAB is clicked', () => {
    fixture.detectChanges();
    let emitted = false;
    component.settings.subscribe(() => (emitted = true));
    fixture.nativeElement.querySelector('.kpi-fab:not(.kpi-fab-primary)').click();
    expect(emitted).toBe(true);
  });

  it('emits refresh when the refresh FAB is clicked', () => {
    fixture.detectChanges();
    let emitted = false;
    component.refresh.subscribe(() => (emitted = true));
    fixture.nativeElement.querySelector('.kpi-fab-primary').click();
    expect(emitted).toBe(true);
  });

  it('hides the KPI tiles but keeps the action stack when showTiles is false', () => {
    fixture.componentRef.setInput('showTiles', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kpi-row')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.kpi-fab').length).toBe(2);
  });

  it('flags the band ready (gates the rise-in animation) only when ready is true', () => {
    fixture.detectChanges();
    const band = fixture.nativeElement.querySelector('.kpi-band');
    expect(band.classList.contains('is-ready')).toBe(false);
    fixture.componentRef.setInput('ready', true);
    fixture.detectChanges();
    expect(band.classList.contains('is-ready')).toBe(true);
  });

  // ---- Pure private helpers (cast to any) ---------------------------------

  describe('compact()', () => {
    it('formats large numbers in compact notation', () => {
      const out = (component as any).compact(1234567);
      expect(typeof out).toBe('string');
      // Compact notation for ~1.23 million should contain an "M" suffix.
      expect(out).toContain('M');
    });

    it('formats thousands with a K suffix', () => {
      expect((component as any).compact(1500)).toContain('K');
    });
  });

  describe('volumeText()', () => {
    it('uses PB once the value reaches 1000 TB', () => {
      const out = (component as any).volumeText(1310);
      expect(out).toContain('PB');
      expect(out).toBe('1.31 PB');
    });

    it('uses TB below 1000', () => {
      const out = (component as any).volumeText(500);
      expect(out).toContain('TB');
      expect(out).not.toContain('PB');
      expect(out).toBe('500 TB');
    });
  });

  describe('relative()', () => {
    it('returns "just now" for very recent times', () => {
      expect((component as any).relative(Date.now() - 5 * 1000)).toBe('just now');
    });

    it('returns minutes ago', () => {
      const out = (component as any).relative(Date.now() - 5 * 60 * 1000);
      expect(out).toBe('5 min ago');
    });

    it('returns hours ago with correct pluralization', () => {
      expect((component as any).relative(Date.now() - 60 * 60 * 1000)).toBe('1 hour ago');
      expect((component as any).relative(Date.now() - 3 * 60 * 60 * 1000)).toBe('3 hours ago');
    });

    it('returns days ago with correct pluralization', () => {
      expect((component as any).relative(Date.now() - 24 * 60 * 60 * 1000)).toBe('1 day ago');
      expect((component as any).relative(Date.now() - 3 * 24 * 60 * 60 * 1000)).toBe('3 days ago');
    });
  });

  describe('points()', () => {
    it('returns a space-separated coordinate string', () => {
      const out = (component as any).points([1, 2, 3]);
      const coords = out.split(' ');
      expect(coords.length).toBe(3);
      // Each coordinate is "x,y".
      coords.forEach((c: string) => expect(c).toMatch(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/));
    });

    it('maps endpoints across the full width (0 to 100)', () => {
      const out = (component as any).points([1, 2, 3]);
      const coords = out.split(' ');
      expect(coords[0].split(',')[0]).toBe('0.0');
      expect(coords[coords.length - 1].split(',')[0]).toBe('100.0');
    });

    it('returns an empty string for fewer than 2 values', () => {
      expect((component as any).points([5])).toBe('');
      expect((component as any).points([])).toBe('');
    });
  });

  describe('areaPoints()', () => {
    it('closes the line to the baseline', () => {
      const out = (component as any).areaPoints([1, 2, 3]);
      expect(out.startsWith('0,28 ')).toBe(true);
      expect(out.endsWith(' 100,28')).toBe(true);
    });

    it('returns an empty string when there are not enough points', () => {
      expect((component as any).areaPoints([1])).toBe('');
    });
  });

  // ---- Deterministic derived signals after compute() ----------------------

  describe('derived signals after detectChanges()', () => {
    beforeEach(() => {
      fixture.detectChanges(); // subscribes and runs compute() synchronously
    });

    it('sets since() to the oldest month_year', () => {
      expect(component.since()).toBe('January 2026');
    });

    it('sets span() based on the data range', () => {
      // Jan 2026 to Jun 2026 is under a year, so it reports a month count.
      expect(component.span()).toBe('3 months of data');
    });

    it('sets downloadsYear() for the latest year', () => {
      // All three rows are in 2026: 1000 + 2000 + 3000 = 6000.
      expect(component.downloadsYear()).toBe(`+${(component as any).compact(6000)} in 2026`);
    });

    it('sets volumeYear() for the latest year', () => {
      // 1.5e12 bytes total -> 1.5 TB across 2026.
      const ytdVolume = (600_000_000_000 + 500_000_000_000 + 400_000_000_000) * 1e-12;
      expect(component.volumeYear()).toBe(`+${(component as any).volumeText(ytdVolume)} in 2026`);
    });

    it('sets volumeUnit() based on the final volume target', () => {
      // 1.5 TB total is well under 1000, so unit is TB.
      expect(component.volumeUnit()).toBe('TB');
    });

    it('sets recentRelative() and recentAbsolute() from the newest last_time_logged', () => {
      expect(component.recentRelative()).toBe('5 min ago');
      expect(component.recentAbsolute()).not.toBe('');
    });

    it('populates the sparkline geometry signals', () => {
      expect(component.dlLine()).not.toBe('');
      expect(component.dlArea()).not.toBe('');
      expect(component.volLine()).not.toBe('');
      expect(component.volArea()).not.toBe('');
    });
  });

  describe('multi-year data', () => {
    it('reports a year span when the data covers more than a year', () => {
      repo$.next([
        { month_year: 'June 2026', total_size: 100, success_download: 10, unique_users: 1 },
        { month_year: 'January 2024', total_size: 100, success_download: 10, unique_users: 1 },
      ]);
      fixture.detectChanges();
      expect(component.span()).toContain('years of data');
      expect(component.since()).toBe('January 2024');
    });
  });

  describe('month-over-month', () => {
    it('pctChange rounds the percent and returns null for a zero base', () => {
      expect((component as any).pctChange(100, 120)).toBe(20);
      expect((component as any).pctChange(200, 150)).toBe(-25);
      expect((component as any).pctChange(0, 50)).toBeNull();
    });

    it('momChip formats an up/down chip and null when unavailable', () => {
      const up = (component as any).momChip(8);
      expect(up.dir).toBe('up');
      expect(up.text).toContain('8%');
      const down = (component as any).momChip(-3);
      expect(down.dir).toBe('down');
      expect(down.text).toContain('3%');
      expect((component as any).momChip(null)).toBeNull();
    });
  });

  describe('empty data', () => {
    it('keeps placeholder values when there are no metrics', () => {
      // The component computes on construction, so test a fresh instance that only ever sees empty
      // data (the existing `fixture` already computed with the seeded rows in beforeEach).
      repo$.next([]);
      datasets$.next([]);
      const fresh = TestBed.createComponent(KpiSummaryComponent);
      fresh.detectChanges();
      const kpi = fresh.componentInstance;
      expect(kpi.since()).toBe('-');
      expect(kpi.recentRelative()).toBe('-');
      expect(kpi.dlLine()).toBe('');
    });
  });
});
