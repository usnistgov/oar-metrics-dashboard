import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MetricsService } from '../../services/metrics.service';
import { CollectionsComponent } from '../collections/collections.component';
import { CollectionMetric } from '../../models/metrics.models';
import { formatCount } from '../../format';
import { collectionSlug } from '../../scope-stats';

/**
 * Collections landing / picker: a grid of collection cards (headline downloads + dataset count) that
 * link into the scoped view. The discovery entry point for people who don't know a collection's exact
 * name.
 */
@Component({
  selector: 'app-collections-landing',
  standalone: true,
  imports: [RouterLink, MatIconModule, CollectionsComponent],
  templateUrl: './collections-landing.component.html',
  styleUrl: './collections-landing.component.css',
})
export class CollectionsLandingComponent {
  private metrics = inject(MetricsService);

  readonly collections = toSignal(this.metrics.collectionMetrics$, {
    initialValue: [] as CollectionMetric[],
  });

  readonly fmtCount = formatCount;
  readonly slug = collectionSlug;
}
