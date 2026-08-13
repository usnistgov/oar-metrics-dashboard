import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CustomCountDialogComponent } from './custom-count-dialog.component';

describe('CustomCountDialogComponent', () => {
  let component: CustomCountDialogComponent;
  let fixture: ComponentFixture<CustomCountDialogComponent>;
  let dialogRef: { close: jest.Mock };

  function configure(data: unknown): void {
    dialogRef = { close: jest.fn() };
    TestBed.configureTestingModule({
      imports: [CustomCountDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    fixture = TestBed.createComponent(CustomCountDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('creates', () => {
    configure(5);
    expect(component).toBeTruthy();
  });

  it('initializes value from the injected dialog data', () => {
    configure(12);
    expect(component.value).toBe(12);
  });

  it('falls back to 5 when no data is provided', () => {
    configure(null);
    expect(component.value).toBe(5);
  });

  it('closes the dialog ref with the entered number on apply', () => {
    configure(5);
    component.value = 8;
    component.apply();
    expect(dialogRef.close).toHaveBeenCalledWith(8);
  });

  it('parses a numeric string value before closing', () => {
    configure(5);
    component.value = '20' as unknown as number;
    component.apply();
    expect(dialogRef.close).toHaveBeenCalledWith(20);
  });

  it('does not close when the value is zero', () => {
    configure(5);
    component.value = 0;
    component.apply();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('does not close when the value is negative', () => {
    configure(5);
    component.value = -3;
    component.apply();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('does not close when the value is not a number', () => {
    configure(5);
    component.value = 'abc' as unknown as number;
    component.apply();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
