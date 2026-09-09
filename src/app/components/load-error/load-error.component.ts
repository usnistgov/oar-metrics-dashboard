import { Component, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Shared "couldn't load / retry" state, used wherever a base-data load fails (dashboard, collections)
 * so the failure looks and reads the same everywhere. Emits `retry` for the host to re-fetch.
 */
@Component({
  selector: 'app-load-error',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './load-error.component.html',
  styleUrl: './load-error.component.css',
})
export class LoadErrorComponent {
  readonly retry = output<void>();
}
