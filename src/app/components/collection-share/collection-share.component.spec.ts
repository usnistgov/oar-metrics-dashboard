import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { CollectionShareComponent } from './collection-share.component';
import { MetricsService } from '../../services/metrics.service';
import { ThemeService } from '../../services/theme.service';

// One collection (a+b) covering 150 of a 200-download repo; 'd' is uncategorized.
const memberships = [{ id: 'c1', title: 'One', members: ['a', 'b'] }];
const datasets = [
  { ediid: 'a', record_download: 100, total_size_download: 1000 },
  { ediid: 'b', record_download: 50, total_size_download: 500 },
  { ediid: 'd', record_download: 50, total_size_download: 250 },
];

const mockMetrics = {
  collectionMemberships$: of(memberships),
  datasetMetrics$: of(datasets),
  datasetError: () => false,
};
const mockTheme = { mode: () => 'light', color: () => '#0d9488' };

describe('CollectionShareComponent', () => {
  let component: CollectionShareComponent;
  let fixture: ComponentFixture<CollectionShareComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionShareComponent],
      providers: [
        { provide: MetricsService, useValue: mockMetrics },
        { provide: ThemeService, useValue: mockTheme },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionShareComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('splits the repo into collection slices plus a "Not in a collection" remainder', () => {
    const s = component.share();
    expect(s?.total).toBe(200);
    expect(s?.covered).toBe(150);
    expect(s?.coveredPct).toBeCloseTo(75);
    expect(s?.slices.map((x) => x.id)).toEqual(['c1', null]);
  });

  it('charts only the collections (not the remainder) so small ones stay visible', () => {
    // 'Not in a collection' is surfaced as the center coverage number, not a pie slice.
    expect(component.collectionSlices().map((x) => x.id)).toEqual(['c1']);
    expect(component.colors().length).toBe(component.collectionSlices().length);
  });

  it('reports each collection share relative to the collections total (not the whole repo)', () => {
    // c1 is the only collection, so it is 100% of collection activity (but only 75% of the repo).
    expect(component.pctOfCollections(150)).toBeCloseTo(100);
    expect(component.share()?.coveredPct).toBeCloseTo(75);
  });

  it('recomputes when the metric toggles to data volume', () => {
    component.setMetric('size');
    expect(component.metric()).toBe('size');
    expect(component.share()?.metric).toBe('size');
    expect(component.share()?.total).toBe(1750);
  });
});
