import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CountComponent } from './count.component';

describe('CountComponent', () => {
  let fixture: ComponentFixture<CountComponent>;

  beforeEach(async () => {
    // Reduced-motion so the count-up settles synchronously on the final value (deterministic test).
    (globalThis as { matchMedia?: unknown }).matchMedia = jest.fn().mockReturnValue({ matches: true });
    await TestBed.configureTestingModule({ imports: [CountComponent] }).compileComponents();
    fixture = TestBed.createComponent(CountComponent);
  });

  it('renders a count with thousands separators', () => {
    fixture.componentRef.setInput('value', 1234567);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe((1234567).toLocaleString());
  });

  it('renders a data size when kind is "size"', () => {
    fixture.componentRef.setInput('value', 1_500_000_000_000); // 1.5 TB
    fixture.componentRef.setInput('kind', 'size');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('1.50 TB');
  });
});
