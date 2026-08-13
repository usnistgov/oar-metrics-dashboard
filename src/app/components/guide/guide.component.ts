import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/**
 * User-facing guide page (route: /guide). A plain, human-readable walkthrough of the dashboard: what
 * it is, where the numbers come from, what every card and figure means, how to customise the layout,
 * and the watchlist / theme tips. Purely static content styled with the app's theme tokens, so it
 * follows light/dark + accent automatically.
 */
@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [RouterLink, MatToolbarModule, MatIconModule, MatButtonModule],
  templateUrl: './guide.component.html',
  styleUrl: './guide.component.css',
})
export class GuideComponent {}
