import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/**
 * User-facing guide page (route: /guide). A plain, human-readable walkthrough of the dashboard: what
 * it is, where the numbers come from, what every card and figure means, how to customise the layout,
 * and the watchlist / theme tips. Purely static content styled with the app's theme tokens, so it
 * follows light/dark + accent automatically. The shared app header provides the nav/brand.
 */
@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './guide.component.html',
  styleUrl: './guide.component.css',
})
export class GuideComponent {
  /**
   * Smooth-scroll in-page (`#section`) links to their target instead of letting the browser/router
   * treat them as a navigation (which reloaded the page). Delegated from the guide container so it
   * covers every anchor. External links and routerLinks are left untouched.
   */
  onAnchorClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const id = anchor.getAttribute('href')?.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      event.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
