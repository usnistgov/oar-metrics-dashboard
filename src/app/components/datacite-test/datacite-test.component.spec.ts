import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { DataciteTestComponent } from './datacite-test.component';
import { MetricsService } from '../../services/metrics.service';

// Top datasets (by downloads). 'd' has no DOI; 'b' has a DOI that DataCite doesn't recognize.
const datasets = [
  { ediid: 'a', last_time_logged: '2026-01-03T00:00:00', record_download: 100 },
  { ediid: 'b', last_time_logged: '2026-01-02T00:00:00', record_download: 50 },
  { ediid: 'c', last_time_logged: '2026-01-01T00:00:00', record_download: 10 },
  { ediid: 'd', last_time_logged: '2026-01-04T00:00:00', record_download: 5 },
];
const records: Record<string, { title: string; doi?: string } | null> = {
  a: { title: 'Alpha', doi: 'doi:10.1/a' },
  b: { title: 'Beta', doi: 'doi:10.1/b' },
  c: { title: 'Gamma', doi: 'doi:10.1/c' },
  d: { title: 'Delta' }, // no DOI -> excluded before the DataCite check
};
const resolves: Record<string, boolean> = { '10.1/a': true, '10.1/b': false, '10.1/c': true };

const mockMetrics = {
  datasetMetrics$: of(datasets),
  record: (id: string) => of(records[id] ?? null),
  doiResolves: (doi: string) => of(resolves[doi] ?? false),
  datasetError: () => false,
};

describe('DataciteTestComponent', () => {
  let component: DataciteTestComponent;
  let fixture: ComponentFixture<DataciteTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataciteTestComponent],
      providers: [
        { provide: MetricsService, useValue: mockMetrics },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DataciteTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists only datasets whose DOI resolves in DataCite (bare DOI, sorted by title)', () => {
    // 'b' dropped (DataCite 404), 'd' dropped (no DOI); 'a' and 'c' kept, sorted Alpha/Gamma.
    expect(component.DOILogs.map((l) => l.doi)).toEqual(['10.1/a', '10.1/c']);
    expect(component.DOILogs.map((l) => l.title)).toEqual(['Alpha', 'Gamma']);
  });

  it('selects the first resolvable DOI by default', () => {
    expect(component.selectedDOI).toBe('10.1/a');
  });

  it('hides the picker (fallback) when no listed DOI resolves', () => {
    expect(component.showFallback()).toBe(false);
    component.DOILogs = [];
    expect(component.showFallback()).toBe(true);
  });
});
