import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GuideComponent } from './guide.component';

describe('GuideComponent', () => {
  let component: GuideComponent;
  let fixture: ComponentFixture<GuideComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuideComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GuideComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has a table of contents and section headings', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.guide-toc')).toBeTruthy();
    expect(compiled.querySelectorAll('.guide-section h2').length).toBeGreaterThan(5);
  });

  it('links back to the dashboard', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const back = compiled.querySelector('a[routerlink="/"]');
    expect(back).toBeTruthy();
  });
});
