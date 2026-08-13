import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { ConcentrationComponent } from './concentration.component';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { DataSetMetric } from '../../models/metrics.models';

describe('ConcentrationComponent', () => {
  let component: ConcentrationComponent;
  let fixture: ComponentFixture<ConcentrationComponent>;

  const data: DataSetMetric[] = [
    { ediid: 'a', record_download: 90 },
    { ediid: 'b', record_download: 10 },
    { ediid: 'c', record_download: 0 },
    { ediid: 'd', record_download: 0 },
  ];

  beforeEach(async () => {
    const metricsStub = {
      datasetMetrics$: new BehaviorSubject<DataSetMetric[]>(data),
      datasetError: () => false,
    };
    const themeStub = { mode: signal('light'), color: signal('#0d9488') };

    await TestBed.configureTestingModule({
      imports: [ConcentrationComponent],
      providers: [
        { provide: MetricsService, useValue: metricsStub },
        { provide: ThemeService, useValue: themeStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConcentrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes the headline concentration figures', () => {
    expect(component.top1()).toBe(90); // top 1% (=> top dataset) holds 90% of downloads
    expect(component.top10()).toBe(90);
    expect(component.zero()).toBe(50); // half the datasets never downloaded
    expect(component.giniLabel()).toBe('0.70');
  });
});
