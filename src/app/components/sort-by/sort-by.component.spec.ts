import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SortByComponent } from './sort-by.component';

describe('SortByComponent', () => {
  let component: SortByComponent;
  let fixture: ComponentFixture<SortByComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SortByComponent] }).compileComponents();
    fixture = TestBed.createComponent(SortByComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('options', [
      { value: 'downloads', label: 'Downloads' },
      { value: 'users', label: 'Unique users' },
    ]);
    fixture.componentRef.setInput('value', 'downloads');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the label for the current value', () => {
    expect(component.currentLabel()).toBe('Downloads');
    fixture.componentRef.setInput('value', 'users');
    expect(component.currentLabel()).toBe('Unique users');
  });

  it('returns an empty label for an unknown value', () => {
    fixture.componentRef.setInput('value', 'nope');
    expect(component.currentLabel()).toBe('');
  });
});
