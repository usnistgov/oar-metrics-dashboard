import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { MonthlyUsersComponent } from './monthly-users.component';

describe('MonthlyUsersComponent', () => {
  let component: MonthlyUsersComponent;
  let fixture: ComponentFixture<MonthlyUsersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlyUsersComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonthlyUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
