import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MetricsService } from './services/metrics.service';
import { ThemeService } from './services/theme.service';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';

/**
 * Application shell: renders the routed page (dashboard or guide), shows the initial loading overlay
 * (blurred content + top progress bar) until the base data is ready, but only on the dashboard, and
 * hosts the floating Settings control (cog FAB opening the settings dialog).
 */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  // Drives the initial loading screen (top progress bar + blurred content).
  readonly metrics = inject(MetricsService);
  // Light/dark mode + accent color (used by the settings dialog).
  readonly theme = inject(ThemeService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  /**
   * True on the dashboard route - the loading overlay/blur applies only there. The Collections pages
   * manage their own loading/empty states, and the Guide reads without waiting for data.
   */
  readonly onDashboard = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.isHome()),
    ),
    { initialValue: true },
  );

  private isHome(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path === '/' || path === '';
  }

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
}
