import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MetricsService } from '../../services/metrics.service';

/**
 * Shared app header: brand, primary nav (All Metrics / Collections), the last-updated indicator and
 * the manual refresh button. Used by the dashboard and the Collections pages so navigation and the
 * refresh control stay consistent across views.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  readonly metrics = inject(MetricsService);

  // Ticks every 30s so the relative "(X ago)" label stays current.
  private readonly tick = toSignal(timer(0, 30_000), { initialValue: 0 });

  readonly relativeUpdated = computed(() => {
    this.tick();
    const updated = this.metrics.lastUpdated();
    return updated ? this.formatRelative(updated) : '';
  });

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
