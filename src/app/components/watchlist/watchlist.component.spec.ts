import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { WatchlistComponent } from './watchlist.component';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { DatasetDetailComponent } from '../dataset-detail/dataset-detail.component';
import { WatchlistAddDialogComponent } from '../watchlist-add-dialog/watchlist-add-dialog.component';
import { DataSetMetric, EnrichedDataSetMetric, RecordResult } from '../../models/metrics.models';

describe('WatchlistComponent', () => {
  let component: WatchlistComponent;
  let fixture: ComponentFixture<WatchlistComponent>;
  let datasetMetrics$: BehaviorSubject<DataSetMetric[]>;
  let dialogStub: { open: jest.Mock };

  const rows: DataSetMetric[] = [
    { ediid: 'ark:/a', record_download: 10, last_time_logged: '2026-01-01T00:00:00' },
    { ediid: 'ark:/b', record_download: 5, last_time_logged: '2026-02-01T00:00:00' },
  ];

  const titles: Record<string, string> = {
    'ark:/a': 'Title A',
    'ark:/b': 'Title B',
  };

  beforeEach(async () => {
    // Real WatchlistService reads from localStorage on construction; start clean.
    localStorage.clear();

    datasetMetrics$ = new BehaviorSubject<DataSetMetric[]>(rows);
    dialogStub = { open: jest.fn() };

    const metricsStub = {
      datasetMetrics$,
      record: (id: string) => of<RecordResult>({ title: titles[id] }),
    };

    await TestBed.configureTestingModule({
      imports: [WatchlistComponent],
      providers: [
        { provide: MetricsService, useValue: metricsStub },
        { provide: MatDialog, useValue: dialogStub },
        // Use the real WatchlistService (providedIn: root); localStorage cleared above.
        WatchlistService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WatchlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with an empty watchlist so entries() is empty', () => {
    expect(component.entries()).toEqual([]);
  });

  it('resolves a watched ediid to an enriched row with its title', () => {
    TestBed.inject(WatchlistService).toggle('ark:/a');
    fixture.detectChanges();

    const entries = component.entries();
    expect(entries.length).toBe(1);
    expect(entries[0].ediid).toBe('ark:/a');
    expect(entries[0].title).toBe('Title A');
    expect(entries[0].record_download).toBe(10);
  });

  it('drops a watched id that is not present in the dataset list', () => {
    TestBed.inject(WatchlistService).toggle('ark:/missing');
    fixture.detectChanges();

    expect(component.entries()).toEqual([]);
  });

  it('clears entries when the watched dataset is toggled back off', () => {
    const watch = TestBed.inject(WatchlistService);
    watch.toggle('ark:/a');
    fixture.detectChanges();
    expect(component.entries().length).toBe(1);

    watch.toggle('ark:/a');
    fixture.detectChanges();
    expect(component.entries()).toEqual([]);
  });

  it('splits entries into pinned and unpinned', () => {
    const watch = TestBed.inject(WatchlistService);
    watch.toggle('ark:/a');
    watch.toggle('ark:/b');
    fixture.detectChanges();
    expect(component.entries().length).toBe(2);

    watch.togglePin('ark:/a');
    fixture.detectChanges();
    expect(component.pinnedEntries().map((e) => e.ediid)).toEqual(['ark:/a']);
    expect(component.unpinnedEntries().map((e) => e.ediid)).toEqual(['ark:/b']);
  });

  it('pinTooltip reflects the pin state', () => {
    const watch = TestBed.inject(WatchlistService);
    watch.toggle('ark:/a');
    fixture.detectChanges();
    expect(component.pinTooltip('ark:/a')).toBe('Pin to top');
    component.togglePin('ark:/a');
    expect(component.pinTooltip('ark:/a')).toBe('Unpin');
  });

  it('openAddDialog() opens the add dialog component', () => {
    // The component imports MatDialogModule, so it injects the real MatDialog (which shadows the
    // module-level stub). Spy on that instance so open() does not actually run.
    const openSpy = jest
      .spyOn((component as unknown as { dialog: MatDialog }).dialog, 'open')
      .mockImplementation(() => undefined as never);
    component.openAddDialog();

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.lastCall![0]).toBe(WatchlistAddDialogComponent);
  });

  it('openDetail() opens the detail drawer with the metric as data', () => {
    const openSpy = jest
      .spyOn((component as unknown as { dialog: MatDialog }).dialog, 'open')
      .mockImplementation(() => undefined as never);
    const entry: EnrichedDataSetMetric = { ...rows[0], title: 'Title A' };
    component.openDetail(entry);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [comp, config] = openSpy.mock.lastCall as unknown as [unknown, { data: unknown }];
    expect(comp).toBe(DatasetDetailComponent);
    expect(config.data).toEqual({ metric: entry });
  });
});
