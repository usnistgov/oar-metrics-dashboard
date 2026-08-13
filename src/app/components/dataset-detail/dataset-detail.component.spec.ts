import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { DatasetDetailComponent } from './dataset-detail.component';
import { MetricsService } from '../../services/metrics.service';
import { WatchlistService } from '../../services/watchlist.service';
import { EnrichedDataSetMetric, RecordResult } from '../../models/metrics.models';

describe('DatasetDetailComponent', () => {
  let component: DatasetDetailComponent;
  let fixture: ComponentFixture<DatasetDetailComponent>;
  let closeSpy: jest.Mock;
  let recordSpy: jest.Mock;

  const metric: EnrichedDataSetMetric = {
    ediid: 'ark:/88434/mds2-2388',
    title: 'Reference Spectra Dataset',
    record_download: 12345,
    number_users: 678,
    total_size_download: 2_500_000_000,
    first_time_logged: '2023-01-15T00:00:00Z',
    last_time_logged: '2024-05-20T00:00:00Z',
  };

  const record: RecordResult = {
    ediid: 'ark:/88434/mds2-2388',
    title: 'Resolved Record Title',
    doi: 'doi:10.18434/mds2-2388',
    topic: [{ tag: 'Chemistry' }, { tag: 'Physics' }],
    theme: ['Materials', 'Optics'],
  };

  // Build the component with overridable data + record payloads so individual tests can vary them.
  async function setup(
    data: { metric: EnrichedDataSetMetric } = { metric },
    recordResult: RecordResult | null = record,
  ): Promise<void> {
    TestBed.resetTestingModule();
    closeSpy = jest.fn();
    const metricsStub = {
      record: jest.fn().mockReturnValue(of(recordResult)),
    };
    recordSpy = metricsStub.record;

    await TestBed.configureTestingModule({
      imports: [DatasetDetailComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: closeSpy } },
        { provide: MetricsService, useValue: metricsStub },
        WatchlistService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DatasetDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('fetches the record metadata using the full ediid on construction', () => {
    expect(recordSpy).toHaveBeenCalledWith('ark:/88434/mds2-2388');
    expect(component.record()).toEqual(record);
    expect(component.loadingMeta()).toBe(false);
  });

  it('volume() formats terabytes', () => {
    expect(component.volume(3_400_000_000_000)).toBe('3.40 TB');
  });

  it('volume() formats gigabytes', () => {
    expect(component.volume(2_500_000_000)).toBe('2.50 GB');
  });

  it('volume() formats megabytes', () => {
    expect(component.volume(7_300_000)).toBe('7.3 MB');
  });

  it('volume() formats bytes and treats undefined as 0', () => {
    expect(component.volume(512)).toBe('512 B');
    expect(component.volume(undefined)).toBe('0 B');
  });

  it('count() formats with commas and treats undefined as 0', () => {
    expect(component.count(1234567)).toBe('1,234,567');
    expect(component.count(undefined)).toBe('0');
  });

  it('datasetUrl() uses the full ediid', () => {
    expect(component.datasetUrl()).toBe('https://data.nist.gov/od/id/ark:/88434/mds2-2388');
  });

  it('metricsUrl() uses the short ediid (ark prefix stripped)', () => {
    expect(component.metricsUrl()).toBe('https://data.nist.gov/pdr/metrics/mds2-2388');
  });

  it('domains() returns de-duplicated topic tags when present', async () => {
    await setup({ metric }, {
      ...record,
      topic: [{ tag: 'Chemistry' }, { tag: 'Chemistry' }, { tag: 'Physics' }],
    });
    expect(component.domains()).toEqual(['Chemistry', 'Physics']);
  });

  it('domains() falls back to themes when no topic tags', async () => {
    await setup({ metric }, { ...record, topic: [], theme: ['Materials', 'Materials', 'Optics'] });
    expect(component.domains()).toEqual(['Materials', 'Optics']);
  });

  it('domains() returns empty array when no record', async () => {
    await setup({ metric }, null);
    expect(component.domains()).toEqual([]);
  });

  it('title() prefers the metric title', () => {
    expect(component.title()).toBe('Reference Spectra Dataset');
  });

  it('title() falls back to the record title when metric title is empty', async () => {
    await setup({ metric: { ...metric, title: '' } }, record);
    expect(component.title()).toBe('Resolved Record Title');
  });

  it('title() falls back to the ediid when neither title is present', async () => {
    await setup({ metric: { ...metric, title: '' } }, { ...record, title: undefined });
    expect(component.title()).toBe('ark:/88434/mds2-2388');
  });

  it('close() closes the dialog', () => {
    component.close();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('renders the resolved domains as chips', () => {
    const chips = fixture.nativeElement.querySelectorAll('.detail-chip');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent.trim()).toBe('Chemistry');
  });
});
