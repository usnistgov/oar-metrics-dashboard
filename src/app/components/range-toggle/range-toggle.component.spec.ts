import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RangeToggleComponent, RangeKey } from './range-toggle.component';

describe('RangeToggleComponent', () => {
  let fixture: ComponentFixture<RangeToggleComponent>;
  let component: RangeToggleComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RangeToggleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RangeToggleComponent);
    component = fixture.componentInstance;
  });

  const buttons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button.range-opt'));

  it('renders one button per range option', () => {
    fixture.detectChanges();
    const labels = buttons().map((b) => b.textContent!.trim());
    expect(labels).toEqual(['12M', '24M', 'All']);
  });

  it('marks the button matching the current value as active', () => {
    fixture.componentRef.setInput('value', 'l12');
    fixture.detectChanges();

    const twelve = buttons().find((b) => b.textContent!.trim() === '12M')!;
    const all = buttons().find((b) => b.textContent!.trim() === 'All')!;

    expect(twelve.classList.contains('active')).toBe(true);
    expect(all.classList.contains('active')).toBe(false);
  });

  it('emits valueChange with the matching key when a button is clicked', () => {
    fixture.detectChanges();

    let emitted: RangeKey | undefined;
    component.valueChange.subscribe((v) => (emitted = v));

    const twentyFour = buttons().find((b) => b.textContent!.trim() === '24M')!;
    twentyFour.click();

    expect(emitted).toBe('l24');
  });
});
