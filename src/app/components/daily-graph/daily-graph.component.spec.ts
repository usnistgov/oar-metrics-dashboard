import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { DailyGraphComponent } from './daily-graph.component';

describe('DailyGraphComponent', () => {
  let component: DailyGraphComponent;
  let fixture: ComponentFixture<DailyGraphComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyGraphComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DailyGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
