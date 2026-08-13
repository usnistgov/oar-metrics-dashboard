import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  ColorPickerDialogComponent,
  ColorPickerData,
} from './color-picker-dialog.component';
import { ThemeService } from '../../services/theme.service';

describe('ColorPickerDialogComponent', () => {
  let component: ColorPickerDialogComponent;
  let fixture: ComponentFixture<ColorPickerDialogComponent>;
  let dialogRef: { close: jest.Mock };
  let theme: { preview: jest.Mock; restore: jest.Mock };

  const data: ColorPickerData = {
    presets: [
      { key: 'teal', label: 'Teal', value: '#0d9488' },
      { key: 'blue', label: 'Blue', value: '#2563eb' },
    ],
    initial: '#0d9488',
  };

  beforeEach(() => {
    dialogRef = { close: jest.fn() };
    theme = {
      preview: jest.fn(),
      restore: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [ColorPickerDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: ThemeService, useValue: theme },
      ],
    });
    fixture = TestBed.createComponent(ColorPickerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('initializes hsv signals from the initial color', () => {
    // #0d9488 is a teal, so hue should sit in the cyan/green band.
    expect(component.hex().toLowerCase()).toBe('#0d9488');
    expect(component.hexInput()).toBe('0d9488');
  });

  it('round-trips a hex value through the hsv signals', () => {
    component.onHexInput('2563eb');
    // The recomputed hex should match the input within rounding tolerance.
    expect(component.hex().toLowerCase()).toBe('#2563eb');
    expect(theme.preview).toHaveBeenCalledWith('#2563eb');
  });

  it('ignores invalid hex input without previewing', () => {
    theme.preview.mockClear();
    component.onHexInput('zzz');
    expect(theme.preview).not.toHaveBeenCalled();
    expect(component.hexInput()).toBe('zzz');
  });

  it('updates signals and previews when picking a preset', () => {
    theme.preview.mockClear();
    component.pickPreset('#2563eb');
    expect(component.hex().toLowerCase()).toBe('#2563eb');
    expect(component.hexInput()).toBe('2563eb');
    expect(theme.preview).toHaveBeenCalledWith('#2563eb');
  });

  it('closes the dialog ref with the chosen hex on apply', () => {
    component.pickPreset('#2563eb');
    component.apply();
    expect(dialogRef.close).toHaveBeenCalledWith('#2563eb');
  });

  it('closes the dialog ref with no value on cancel', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
