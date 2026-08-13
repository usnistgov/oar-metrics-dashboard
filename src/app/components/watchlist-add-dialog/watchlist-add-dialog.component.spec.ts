import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';

import { WatchlistAddDialogComponent } from './watchlist-add-dialog.component';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { DataSetMetric, DatasetSearchResult } from '../../models/metrics.models';

describe('WatchlistAddDialogComponent', () => {
  let component: WatchlistAddDialogComponent;
  let fixture: ComponentFixture<WatchlistAddDialogComponent>;
  let datasetMetrics$: BehaviorSubject<DataSetMetric[]>;
  let searchRecords: jest.Mock;
  let refStub: { close: jest.Mock };

  const datasetRows: DataSetMetric[] = [
    { ediid: 'ark:/a', record_download: 42 },
    { ediid: 'ark:/b', record_download: 7 },
  ];

  const searchResults: DatasetSearchResult[] = [
    { ediid: 'ark:/a', title: 'Carbon Dioxide Data', doi: '10.1/x', domains: ['Chemistry'] },
    { ediid: 'ark:/b', title: 'Steel Alloy Study', doi: undefined, domains: [] },
  ];

  beforeEach(async () => {
    localStorage.clear();

    datasetMetrics$ = new BehaviorSubject<DataSetMetric[]>(datasetRows);
    searchRecords = jest.fn().mockReturnValue(of(searchResults));
    refStub = { close: jest.fn() };

    const metricsStub = {
      datasetMetrics$,
      searchRecords,
    };

    await TestBed.configureTestingModule({
      imports: [WatchlistAddDialogComponent],
      providers: [
        { provide: MetricsService, useValue: metricsStub },
        { provide: MatDialogRef, useValue: refStub },
        WatchlistService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WatchlistAddDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('searches after the debounce and keeps only rows whose title contains the query', (done) => {
    // Run in the live zone (not fakeAsync): change detection auto-flushes the toObservable effect,
    // then we wait out the real 300ms debounce before asserting.
    component.query.set('carbon');
    fixture.detectChanges(); // flush the toObservable effect now so 'carbon' enters the debounce
    setTimeout(() => {
      fixture.detectChanges();

      expect(searchRecords).toHaveBeenCalledTimes(1);
      expect(searchRecords).toHaveBeenCalledWith('carbon');

      const results = component.results();
      expect(results.length).toBe(1);
      expect(results[0].ediid).toBe('ark:/a');
      expect(results[0].title).toBe('Carbon Dioxide Data');
      // downloads filled in from the in-memory dataset list.
      expect(results[0].downloads).toBe(42);
      expect(component.searching()).toBe(false);
      done();
    }, 400);
  });

  it('does not search and yields no results for a query under the min length', fakeAsync(() => {
    component.query.set('c');
    tick(300);
    fixture.detectChanges();

    expect(searchRecords).not.toHaveBeenCalled();
    expect(component.results()).toEqual([]);
    expect(component.active()).toBe(false);
  }));

  it('exposes active() once the query reaches the min length', () => {
    expect(component.active()).toBe(false);
    component.query.set('ca');
    expect(component.active()).toBe(true);
  });

  it('toRow maps a search result and fills downloads from the in-memory list', () => {
    const toRow = (component as unknown as {
      toRow(r: DatasetSearchResult): {
        ediid: string;
        shortId: string;
        title: string;
        downloads: number;
        domains: string[];
      };
    }).toRow.bind(component);

    const row = toRow(searchResults[0]);
    expect(row.ediid).toBe('ark:/a');
    expect(row.shortId).toBe('a');
    expect(row.title).toBe('Carbon Dioxide Data');
    expect(row.domains).toEqual(['Chemistry']);
    expect(row.downloads).toBe(42);
  });

  it('close() closes the dialog ref', () => {
    component.close();
    expect(refStub.close).toHaveBeenCalledTimes(1);
  });
});
