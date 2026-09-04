import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonthYearFilterComponent } from './month-year-filter.component';

describe('MonthYearFilterComponent', () => {
  let component: MonthYearFilterComponent;
  let fixture: ComponentFixture<MonthYearFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthYearFilterComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MonthYearFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to the "Month" / "Year" labels', () => {
    expect(component.monthLabel()).toBe('Month');
    expect(component.yearLabel()).toBe('Year');
  });

  it('reflects a selected month and year in the labels', () => {
    fixture.componentRef.setInput('month', 5);
    fixture.componentRef.setInput('year', 2026);
    expect(component.monthLabel()).toBe('June');
    expect(component.yearLabel()).toBe('2026');
  });
});
