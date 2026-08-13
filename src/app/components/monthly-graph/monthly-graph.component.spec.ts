import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { MonthlyGraphComponent } from './monthly-graph.component';

describe('MonthlyGraphComponent', () => {
  let component: MonthlyGraphComponent;
  let fixture: ComponentFixture<MonthlyGraphComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlyGraphComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonthlyGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
