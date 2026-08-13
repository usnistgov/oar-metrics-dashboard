import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { MonthlyDownloadsPopupComponent } from './monthly-downloads-popup.component';

describe('MonthlyDownloadsPopupComponent', () => {
  let component: MonthlyDownloadsPopupComponent;
  let fixture: ComponentFixture<MonthlyDownloadsPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlyDownloadsPopupComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonthlyDownloadsPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
