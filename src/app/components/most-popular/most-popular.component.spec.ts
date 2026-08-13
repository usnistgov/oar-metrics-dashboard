import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { EnrichedDataSetMetric } from '../../models/metrics.models';
import { MostPopularComponent } from './most-popular.component';

describe('MostPopularComponent', () => {
  let component: MostPopularComponent;
  let fixture: ComponentFixture<MostPopularComponent>;

  const log: EnrichedDataSetMetric = {
    ediid: 'ark:/x',
    title: 'A dataset',
    record_download: 1234,
    number_users: 56,
    total_size_download: 2_500_000_000_000,
    last_time_logged: '2026-01-15T00:00:00',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MostPopularComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MostPopularComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults the sort to downloads', () => {
    expect(component.sortKey()).toBe('downloads');
  });

  it('setSort switches the active ranking metric', () => {
    component.setSort('users');
    expect(component.sortKey()).toBe('users');
  });

  it('subLabel reflects the active sort metric', () => {
    expect(component.subLabel(log)).toBe('1,234 downloads');
    component.setSort('users');
    expect(component.subLabel(log)).toBe('56 users');
    component.setSort('volume');
    expect(component.subLabel(log)).toBe('2.50 TB');
    component.setSort('recent');
    expect(component.subLabel(log)).toContain('Jan');
    expect(component.subLabel(log)).toContain('2026');
  });
});
