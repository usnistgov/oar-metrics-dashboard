import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MetricsService } from '../../services/metrics.service';
import { ScopeService } from '../../services/scope.service';
import { HeaderComponent } from '../header/header.component';
import { CollectionMetric } from '../../models/metrics.models';
import { formatCount, formatPct, formatSize } from '../../format';
import { collectionSlug, sharePct } from '../../scope-stats';

/**
 * Collections landing / picker: a grid of collection cards (headline downloads + share of repo, data
 * volume and dataset count) that link into the scoped view. The discovery entry point for people who
 * don't know a collection's exact name.
 */
@Component({
  selector: 'app-collections-landing',
  standalone: true,
  imports: [RouterLink, MatIconModule, HeaderComponent],
  templateUrl: './collections-landing.component.html',
  styleUrl: './collections-landing.component.css',
})
export class CollectionsLandingComponent {
  private metrics = inject(MetricsService);
  readonly scope = inject(ScopeService);

  readonly collections = toSignal(this.metrics.collectionMetrics$, {
    initialValue: [] as CollectionMetric[],
  });

  readonly fmtCount = formatCount;
  readonly fmtSize = formatSize;
  readonly fmtPct = formatPct;
  readonly slug = collectionSlug;

  share(downloads: number): number {
    return sharePct(downloads, this.scope.repo().downloads);
  }
}
