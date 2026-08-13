import { Component, inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

/** One row rendered as a dataset card in the dialog. */
export interface DatasetDialogItem {
  rank?: number;
  title: string;
  sub?: string;
  chip?: string;
}

/** Payload passed to the dialog via MAT_DIALOG_DATA. */
export interface DatasetDialogData {
  title: string;
  items: DatasetDialogItem[];
}

/**
 * Generic, reusable "expanded list" dialog. Renders the same `.ds-*` dataset cards used in the
 * dashboard widgets, so the expanded view is visually consistent with the cards. Used by the
 * most-popular and popular-science-domains widgets.
 */
@Component({
  selector: 'app-dataset-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './dataset-dialog.component.html',
  styleUrl: './dataset-dialog.component.css',
})
export class DatasetDialogComponent {
  readonly data = inject<DatasetDialogData>(MAT_DIALOG_DATA);
}
