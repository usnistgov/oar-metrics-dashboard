import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { SeasonalityComponent } from './seasonality.component';
import { MetricsService } from '../../services/metrics.service';
import { RepoMetric } from '../../models/metrics.models';

describe('SeasonalityComponent', () => {
  let component: SeasonalityComponent;
  let fixture: ComponentFixture<SeasonalityComponent>;

  const repo: RepoMetric[] = [
    { month_year: 'January 2025', success_download: 50, total_size: 0, unique_users: 0 },
    { month_year: 'June 2026', success_download: 100, total_size: 0, unique_users: 0 },
  ];

  beforeEach(async () => {
    const metricsStub = {
      repoMetrics$: new BehaviorSubject<RepoMetric[]>(repo),
      repoError: () => false,
    };

    await TestBed.configureTestingModule({
      imports: [SeasonalityComponent],
      providers: [{ provide: MetricsService, useValue: metricsStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(SeasonalityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('builds a year-by-month matrix shaded by intensity', () => {
    const rows = component.years();
    expect(rows.map((r) => r.year)).toEqual([2025, 2026]);

    const jan2025 = rows[0].cells[0];
    expect(jan2025.present).toBe(true);
    expect(jan2025.downloads).toBe(50);
    expect(jan2025.intensity).toBeCloseTo(0.5); // 50 / max(100)

    const june2026 = rows[1].cells[5];
    expect(june2026.present).toBe(true);
    expect(june2026.intensity).toBe(1); // the busiest month

    expect(rows[0].cells[1].present).toBe(false); // February 2025 has no data
    expect(rows[0].cells.length).toBe(12);
  });

  it('clears the matrix when there is no data', () => {
    component.build([]);
    expect(component.years()).toEqual([]);
  });
});
