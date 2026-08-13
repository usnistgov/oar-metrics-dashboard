import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { PopularScienceDomainsComponent } from './popular-science-domains.component';

describe('PopularScienceDomainsComponent', () => {
  let component: PopularScienceDomainsComponent;
  let fixture: ComponentFixture<PopularScienceDomainsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PopularScienceDomainsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PopularScienceDomainsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
