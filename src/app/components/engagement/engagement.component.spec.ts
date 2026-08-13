import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { EngagementComponent } from './engagement.component';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { RepoMetric } from '../../models/metrics.models';

describe('EngagementComponent', () => {
  let component: EngagementComponent;
  let fixture: ComponentFixture<EngagementComponent>;

  const repo: RepoMetric[] = [
    { month_year: 'February 2026', success_download: 200, total_size: 4_000_000_000, unique_users: 50 },
    { month_year: 'January 2026', success_download: 100, total_size: 1_000_000_000, unique_users: 20 },
  ];

  beforeEach(async () => {
    const metricsStub = {
      repoMetrics$: new BehaviorSubject<RepoMetric[]>(repo),
      repoError: () => false,
    };
    const themeStub = { mode: signal('light'), color: signal('#0d9488') };

    await TestBed.configureTestingModule({
      imports: [EngagementComponent],
      providers: [
        { provide: MetricsService, useValue: metricsStub },
        { provide: ThemeService, useValue: themeStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EngagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults the metric to per-user', () => {
    expect(component.metric()).toBe('peruser');
  });

  it('setMetric switches the active metric', () => {
    component.setMetric('avgsize');
    expect(component.metric()).toBe('avgsize');
  });

  it('seriesFor("peruser") computes downloads per user, chronologically sorted', () => {
    const s = component.seriesFor(repo, 'peruser');
    expect(s.labels).toEqual(['January 2026', 'February 2026']);
    expect(s.values).toEqual([5, 4]); // 100/20, 200/50
    expect(s.yTitle.toLowerCase()).toContain('user');
  });

  it('seriesFor("avgsize") computes average megabytes per download', () => {
    const s = component.seriesFor(repo, 'avgsize');
    expect(s.values).toEqual([10, 20]); // 1e9*1e-6/100, 4e9*1e-6/200
    expect(s.label).toContain('MB');
  });

  it('seriesFor guards divide-by-zero', () => {
    const zero: RepoMetric[] = [
      { month_year: 'March 2026', success_download: 0, total_size: 5, unique_users: 0 },
    ];
    expect(component.seriesFor(zero, 'peruser').values).toEqual([0]);
    expect(component.seriesFor(zero, 'avgsize').values).toEqual([0]);
  });

  it('seriesFor slices to the selected time range', () => {
    const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December'];
    const many: RepoMetric[] = Array.from({ length: 30 }, (_, i) => ({
      month_year: `${names[i % 12]} ${2024 + Math.floor(i / 12)}`,
      success_download: (i + 1) * 10,
      total_size: 0,
      unique_users: 1,
    }));
    expect(component.seriesFor(many, 'peruser', 'all').values.length).toBe(30);
    expect(component.seriesFor(many, 'peruser', 'l24').values.length).toBe(24);
    expect(component.seriesFor(many, 'peruser', 'l12').values.length).toBe(12);
  });

  it('setRange switches the active window', () => {
    expect(component.range()).toBe('all');
    component.setRange('l12');
    expect(component.range()).toBe('l12');
  });
});
