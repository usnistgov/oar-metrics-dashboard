import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DatasetDialogComponent, DatasetDialogData } from './dataset-dialog.component';

describe('DatasetDialogComponent', () => {
  let component: DatasetDialogComponent;
  let fixture: ComponentFixture<DatasetDialogComponent>;

  const data: DatasetDialogData = {
    title: 'Most popular datasets',
    items: [
      { rank: 1, title: 'Dataset Alpha', sub: '1,000 downloads', chip: 'Chemistry' },
      { rank: 2, title: 'Dataset Beta', sub: '800 downloads' },
      { rank: 3, title: 'Dataset Gamma' },
    ],
  };

  async function setup(dialogData: DatasetDialogData = data): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DatasetDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: { close: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DatasetDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes the injected dialog data', () => {
    expect(component.data).toBe(data);
  });

  it('renders the dialog title', () => {
    const title = fixture.nativeElement.querySelector('[mat-dialog-title]');
    expect(title.textContent.trim()).toBe('Most popular datasets');
  });

  it('renders one list row per item', () => {
    const items = fixture.nativeElement.querySelectorAll('.ds-item');
    expect(items.length).toBe(3);
  });

  it('renders the item titles', () => {
    const titles = fixture.nativeElement.querySelectorAll('.ds-title');
    const text = Array.from(titles).map((el) => (el as HTMLElement).textContent?.trim());
    expect(text).toEqual(['Dataset Alpha', 'Dataset Beta', 'Dataset Gamma']);
  });

  it('renders optional rank, sub and chip only when present', () => {
    expect(fixture.nativeElement.querySelectorAll('.ds-rank').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.ds-sub').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.ds-chip').length).toBe(1);
  });

  it('renders an empty state when there are no items', async () => {
    await setup({ title: 'Empty list', items: [] });
    expect(fixture.nativeElement.querySelectorAll('.ds-item').length).toBe(0);
    const empty = fixture.nativeElement.querySelector('.ds-empty');
    expect(empty.textContent.trim()).toBe('No data available.');
  });
});
