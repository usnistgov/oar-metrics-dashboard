import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { RepoHealthComponent } from './repo-health.component';
import { MetricsService } from '../../services/metrics.service';
import { DataSetMetric } from '../../models/metrics.models';

describe('RepoHealthComponent', () => {
  let component: RepoHealthComponent;
  let fixture: ComponentFixture<RepoHealthComponent>;

  const data: DataSetMetric[] = [
    { ediid: 'a', record_download: 90 },
    { ediid: 'b', record_download: 10 },
    { ediid: 'c', record_download: 0 },
    { ediid: 'd' },
  ];

  beforeEach(async () => {
    const metricsStub = {
      datasetMetrics$: new BehaviorSubject<DataSetMetric[]>(data),
      datasetError: () => false,
    };

    await TestBed.configureTestingModule({
      imports: [RepoHealthComponent],
      providers: [{ provide: MetricsService, useValue: metricsStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(RepoHealthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes the health stats from the dataset counts', () => {
    const s = component.stats();
    expect(s?.total).toBe(4);
    expect(s?.pctWithDownloads).toBe(50);
    expect(s?.zeroDownloads).toBe(2);
    expect(s?.median).toBe(5);
    expect(s?.mean).toBe(25);
    expect(s?.meanActive).toBe(50);
  });

  it('renders a tile per stat', () => {
    expect(fixture.nativeElement.querySelectorAll('.health-tile').length).toBe(6);
  });
});
