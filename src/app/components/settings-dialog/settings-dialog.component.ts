import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../services/theme.service';
import { LayoutService } from '../../services/layout.service';
import { MetricsService } from '../../services/metrics.service';
import {
  ColorPickerDialogComponent,
  ColorPickerData,
} from '../color-picker-dialog/color-picker-dialog.component';

/**
 * Settings dialog opened from the cog FAB: dark-mode toggle, accent-color swatches (plus a custom
 * picker), and per-widget show/hide checkboxes. Reads/writes ThemeService and LayoutService directly.
 */
@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatCheckboxModule,
  ],
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.css',
})
export class SettingsDialogComponent {
  readonly theme = inject(ThemeService);
  readonly layout = inject(LayoutService);
  readonly metrics = inject(MetricsService);
  private ref = inject(MatDialogRef<SettingsDialogComponent>);
  private dialog = inject(MatDialog);

  close(): void {
    this.ref.close();
  }

  /** Open the custom color picker; live-preview while open, commit on Apply, revert on Cancel. */
  openColorPicker(): void {
    this.dialog
      .open(ColorPickerDialogComponent, {
        width: '300px',
        maxWidth: '95vw',
        autoFocus: 'dialog',
        data: { presets: this.theme.presets, initial: this.theme.color() } as ColorPickerData,
      })
      .afterClosed()
      .subscribe((hex?: string) => {
        if (hex) this.theme.setColor(hex);
        else this.theme.restore();
      });
  }
}
