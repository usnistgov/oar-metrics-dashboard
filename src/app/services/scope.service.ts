import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MetricsService } from './metrics.service';
import { buildCollectionDetail } from '../collection-stats';
import { collectionRank, matchesCollectionKey, repoTotals } from '../scope-stats';
import { CollectionDetail, CollectionMembership, DataSetMetric } from '../models/metrics.models';

/**
 * Holds the collection currently in scope for the Collections Metrics pages and derives its
 * rolled-up detail, the repo-wide denominators (for "share of repo"), and its rank. Every value is
 * computed by joining the collection's member ediids against the shared per-dataset list.
 *
 * NOTE: monthly time-series cannot be scoped this way. The per-dataset feed carries only lifetime
 * totals + first/last timestamps (no monthly history), and the monthly repo feed is repository-wide
 * with no dataset dimension - so trend/seasonality charts stay repo-wide until the backend exposes a
 * per-dataset monthly series.
 */
@Injectable({ providedIn: 'root' })
export class ScopeService {
  private metrics = inject(MetricsService);

  /** The collection currently in scope, as a route key (slug or full id). Set from the route. */
  readonly activeCollectionId = signal<string | null>(null);

  private readonly memberships = toSignal(this.metrics.collectionMemberships$, {
    initialValue: [] as CollectionMembership[],
  });
  private readonly datasets = toSignal(this.metrics.datasetMetrics$, {
    initialValue: [] as DataSetMetric[],
  });

  /** All collections, sorted by title - for the picker and the landing grid. */
  readonly collections = computed(() =>
    [...this.memberships()].sort((a, b) => a.title.localeCompare(b.title)),
  );

  readonly activeMembership = computed(() => {
    const key = this.activeCollectionId();
    if (!key) return null;
    return this.memberships().find((m) => matchesCollectionKey(m.id, key)) ?? null;
  });

  /** Rolled-up detail for the active collection (downloads/size/users/members/share). */
  readonly detail = computed<CollectionDetail | null>(() => {
    const m = this.activeMembership();
    return m ? buildCollectionDetail(m, this.datasets()) : null;
  });

  /** Repository-wide totals - the denominators for share-of-repo and comparisons. */
  readonly repo = computed(() => repoTotals(this.datasets()));

  /** The active collection's rank by downloads among all collections. */
  readonly rank = computed(() => {
    const m = this.activeMembership();
    return m ? collectionRank(this.memberships(), this.datasets(), m.id) : null;
  });

  /** True once the active id resolves to a real collection. */
  readonly resolved = computed(() => this.activeMembership() !== null);

  /** True once collection memberships have loaded (distinguishes "loading" from "unknown id"). */
  readonly membershipsLoaded = computed(() => this.memberships().length > 0);

  setCollection(id: string | null): void {
    this.activeCollectionId.set(id);
  }
}
