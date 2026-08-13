import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { LatestDownloadsComponent } from './latest-downloads.component';

describe('LatestDownloadsComponent', () => {
  let component: LatestDownloadsComponent;
  let fixture: ComponentFixture<LatestDownloadsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LatestDownloadsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LatestDownloadsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
