import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { MonthlyUsersPopupComponent } from './monthly-users-popup.component';

describe('MonthlyUsersPopupComponent', () => {
  let component: MonthlyUsersPopupComponent;
  let fixture: ComponentFixture<MonthlyUsersPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlyUsersPopupComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonthlyUsersPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
