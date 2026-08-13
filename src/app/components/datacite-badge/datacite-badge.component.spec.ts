import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataciteBadgeComponent } from './datacite-badge.component';

describe('DataciteBadgeComponent', () => {
  let component: DataciteBadgeComponent;
  let fixture: ComponentFixture<DataciteBadgeComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DataciteBadgeComponent],
    });
    fixture = TestBed.createComponent(DataciteBadgeComponent);
    component = fixture.componentInstance;
  });

  it('creates without a doi', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component).toBeTruthy();
  });

  it('creates and renders with a doi and size inputs set', () => {
    fixture.componentRef.setInput('doi', '10.18434/mds2-2531');
    fixture.componentRef.setInput('zoom', 0.8);
    fixture.componentRef.setInput('imageSize', 64);
    fixture.componentRef.setInput('display', 'medium');
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component.doi()).toBe('10.18434/mds2-2531');
  });

  it('cleans up its timers on destroy without throwing', () => {
    fixture.componentRef.setInput('doi', '10.1/x');
    fixture.detectChanges();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
