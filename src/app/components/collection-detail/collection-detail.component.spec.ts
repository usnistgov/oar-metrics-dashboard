import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { CollectionDetailComponent } from './collection-detail.component';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { CollectionDetail, RecordResult } from '../../models/metrics.models';

describe('CollectionDetailComponent', () => {
  let component: CollectionDetailComponent;
  let fixture: ComponentFixture<CollectionDetailComponent>;

  const detail: CollectionDetail = {
    id: 'col1',
    title: 'Additive Manufacturing',
    memberCount: 3,
    membersWithUsage: 2,
    downloads: 300,
    size: 3e12,
    users: 30,
    repoSharePct: 25,
    members: [
      { ediid: 'a', record_download: 100, number_users: 10, total_size_download: 2e12 },
      { ediid: 'b', record_download: 200, number_users: 20, total_size_download: 1e12 },
    ],
  };

  beforeEach(async () => {
    const metricsStub = {
      collectionDetail: () => new BehaviorSubject<CollectionDetail | null>(detail),
      record: (ediid: string) => of<RecordResult>({ ediid, title: `Title ${ediid}` }),
    };
    const watchStub = { isWatched: () => false, toggle: () => {} };

    await TestBed.configureTestingModule({
      imports: [CollectionDetailComponent],
      providers: [
        { provide: MetricsService, useValue: metricsStub },
        { provide: WatchlistService, useValue: watchStub },
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: { id: 'col1', title: 'Additive Manufacturing' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ranks members by downloads (desc) by default and resolves titles', () => {
    const rows = component.rows();
    expect(rows.map((r) => r.ediid)).toEqual(['b', 'a']);
    expect(rows[0].title).toBe('Title b');
  });

  it('re-ranks when the sort metric changes', () => {
    component.setSort('volume');
    expect(component.rows().map((r) => r.ediid)).toEqual(['a', 'b']); // a has the larger volume
  });

  it('computes the within-collection concentration figures', () => {
    expect(component.topShareLabel()).toBe('67%'); // top dataset (200) of 300 total
    expect(component.giniLabel()).not.toBe('-');
  });
});

describe('CollectionDetailComponent (titles not yet resolved)', () => {
  it('marks rows as pending (no ediid flash) until the title arrives', async () => {
    const pending = new Subject<RecordResult>(); // never emits -> titles stay unresolved
    await TestBed.configureTestingModule({
      imports: [CollectionDetailComponent],
      providers: [
        {
          provide: MetricsService,
          useValue: {
            collectionDetail: () =>
              new BehaviorSubject<CollectionDetail | null>({
                id: 'c',
                title: 'C',
                memberCount: 1,
                membersWithUsage: 1,
                downloads: 10,
                size: 0,
                users: 0,
                repoSharePct: 5,
                members: [{ ediid: 'ark:/88434/mds2-1', record_download: 10 }],
              }),
            record: () => pending.asObservable(),
          },
        },
        { provide: WatchlistService, useValue: { isWatched: () => false, toggle: () => {} } },
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: { id: 'c', title: 'C' } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CollectionDetailComponent);
    fixture.detectChanges();
    const rows = fixture.componentInstance.rows();
    expect(rows[0].pending).toBe(true);
    expect(rows[0].title).toBe(''); // never the raw ediid
  });
});
