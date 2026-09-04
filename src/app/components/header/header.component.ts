import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MetricsService } from '../../services/metrics.service';
import { SettingsDialogComponent } from '../settings-dialog/settings-dialog.component';

/**
 * Shared app header: co-brand lockup (official NIST logo + dashboard name), primary nav (All Metrics
 * / Collections), the last-updated indicator, and the action buttons (Guide, Settings, Refresh).
 * Rendered in the app shell so it paints instantly and stays interactive during data load.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  readonly metrics = inject(MetricsService);
  private dialog = inject(MatDialog);

  // Ticks every 30s so the relative "(X ago)" label stays current.
  private readonly tick = toSignal(timer(0, 30_000), { initialValue: 0 });

  readonly relativeUpdated = computed(() => {
    this.tick();
    const updated = this.metrics.lastUpdated();
    return updated ? this.formatRelative(updated) : '';
  });

  /** Open the settings dialog (dark mode, accent color, widget visibility). */
  openSettings(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '420px',
      maxWidth: '94vw',
      maxHeight: '85vh',
      autoFocus: 'dialog',
      ariaLabel: 'Settings',
    });
  }

  private formatRelative(date: Date): string {
    const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
}
