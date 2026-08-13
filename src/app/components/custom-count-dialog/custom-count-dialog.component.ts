import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

/**
 * Small dialog for entering a custom number of items to display. Opened from the "Custom…"
 * action; returns the chosen number via `MatDialogRef.close(n)`.
 */
@Component({
  selector: 'app-custom-count-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule],
  templateUrl: './custom-count-dialog.component.html',
  styleUrl: './custom-count-dialog.component.css',
})
export class CustomCountDialogComponent {
  private ref = inject(MatDialogRef<CustomCountDialogComponent>);
  value = (inject(MAT_DIALOG_DATA) as number) ?? 5; // pre-filled with the current count

  apply(): void {
    const n = parseInt(String(this.value), 10);
    if (!isNaN(n) && n > 0) {
      this.ref.close(n);
    }
  }
}
