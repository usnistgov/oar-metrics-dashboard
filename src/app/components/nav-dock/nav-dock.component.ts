import { Component, ElementRef, HostListener, computed, effect, inject, signal, viewChildren } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

interface NavItem {
  path: string;
  exact: boolean;
  label: string;
  icon: string;
}

/**
 * Index of the nav item matching `url` (exact match for '/', prefix match otherwise), or -1 when the
 * route is not in the nav (e.g. the guide) so the indicator can be hidden. Pure, for testability.
 */
export function navActiveIndex(url: string, items: { path: string; exact: boolean }[]): number {
  return items.findIndex((it) => (it.exact ? url === it.path : url.startsWith(it.path)));
}

/**
 * Frosted-glass navigation pill for the header. A blurred, rounded segmented control with a single
 * accent indicator that slides to the active route. Space-thrifty, clearly navigation, and keyboard
 * accessible. Motion is disabled for users who prefer reduced motion (see the stylesheet).
 */
@Component({
  selector: 'app-nav-dock',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './nav-dock.component.html',
  styleUrl: './nav-dock.component.css',
})
export class NavDockComponent {
  private router = inject(Router);

  readonly items: NavItem[] = [
    { path: '/', exact: true, label: 'All Metrics', icon: 'bar_chart' },
    { path: '/collections', exact: false, label: 'Collections', icon: 'dataset' },
  ];

  /** Current URL: seeds with the router's URL and tracks each completed navigation. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Index of the active item (exact match for '/', prefix match otherwise), or -1 if the current
   *  route is not in this nav (e.g. the guide) - in which case the indicator is hidden. */
  readonly activeIndex = computed(() => navActiveIndex(this.url(), this.items));

  private readonly links = viewChildren<ElementRef<HTMLElement>>('link');

  /** Sliding indicator geometry (x offset + width), applied as a transform + width. */
  readonly indicator = signal<{ x: number; w: number }>({ x: 0, w: 0 });

  constructor() {
    // Reposition the indicator whenever the active route or the rendered links change.
    effect(() => {
      this.activeIndex();
      this.links();
      requestAnimationFrame(() => this.place());
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.place();
  }

  private place(): void {
    const idx = this.activeIndex();
    if (idx < 0) return; // no active item here; the indicator is hidden via the template
    const el = this.links()[idx]?.nativeElement;
    if (el) this.indicator.set({ x: el.offsetLeft, w: el.offsetWidth });
  }
}
