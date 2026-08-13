import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { CollectionsComponent } from './collections.component';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';
import { CollectionMetric } from '../../models/metrics.models';

describe('CollectionsComponent', () => {
  let component: CollectionsComponent;
  let fixture: ComponentFixture<CollectionsComponent>;

  const data: CollectionMetric[] = [
    { id: 'c1', title: 'Alpha', memberCount: 3, membersWithUsage: 3, downloads: 300, size: 3e12, users: 30 },
    { id: 'c2', title: 'Beta', memberCount: 2, membersWithUsage: 1, downloads: 100, size: 1e12, users: 10 },
  ];

  beforeEach(async () => {
    const metricsStub = {
      collectionMetrics$: new BehaviorSubject<CollectionMetric[]>(data),
      datasetError: () => false,
    };
    const themeStub = { mode: signal('light'), color: signal('#0d9488') };

    await TestBed.configureTestingModule({
      imports: [CollectionsComponent],
      providers: [
        { provide: MetricsService, useValue: metricsStub },
        { provide: ThemeService, useValue: themeStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes the headline figures from the rolled-up collections', () => {
    expect(component.collectionCount()).toBe(2);
    expect(component.totalMembers()).toBe(5);
    expect(component.totalDownloads()).toBe(400);
    expect(component.empty()).toBe(false);
  });

  it('flags the empty state when there are no collections', () => {
    (TestBed.inject(MetricsService).collectionMetrics$ as BehaviorSubject<CollectionMetric[]>).next([]);
    expect(component.empty()).toBe(true);
    expect(component.collectionCount()).toBe(0);
  });
});
