import { Injectable, computed, signal } from '@angular/core';

export interface WidgetDef {
  id: string;
  label: string;
}

/**
 * Owns the dashboard layout: which widgets are hidden AND the order of the draggable cards. Both are
 * held in signals and mirrored to localStorage. The dashboard reads `isVisible(id)` /
 * `visibleOrderedCards()` to render; the settings dialog calls `toggle` / `reset` / `resetLayout`;
 * drag-and-drop calls `reorderVisible`. The KPI strip is intentionally NOT a draggable card.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private static readonly KEY = 'dashboard.hidden.v1';
  // Versioned so a future change to the DEFAULT card order can force existing users onto it: bump
  // the suffix (v1 -> v2) and old saved orders are ignored instead of preserved. Not needed for
  // adding/removing cards (order reconciliation handles those) - only to override users' saved order.
  private static readonly ORDER_KEY = 'dashboard.order.v1';
  private static readonly PIN_KEY = 'dashboard.pins.v1';

  /**
   * The shipped first-visit layout: what a brand-new user sees before customizing anything. These are
   * compiled into the build - edit them to change the out-of-the-box dashboard. They only SEED the
   * saved state: as soon as a user hides/shows or pins a card, their choice is written to localStorage
   * and wins over these on every later visit.
   *
   * - DEFAULT_HIDDEN: widget ids hidden by default (empty = show everything).
   * - DEFAULT_PINNED: widget ids pinned to the top by default.
   * - Default card ORDER is just the `widgets` array order below (minus the KPI strip); reorder that
   *   array to change the shipped order. Bump ORDER_KEY's version when you do, so existing users pick
   *   up the new default instead of keeping their old saved order.
   */
  private static readonly DEFAULT_HIDDEN: string[] = [
    'watchlist',
    'scienceDomains',
    'heatmap',
    'repoHealth',
    'collectionShare',
    'datacite',
    'untracked',
  ];
  private static readonly DEFAULT_PINNED: string[] = [];

  /** All toggleable widgets, in dashboard order (this order IS the default card order, minus KPI). */
  readonly widgets: WidgetDef[] = [
    { id: 'kpi', label: 'KPI summary' },
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'downloadSizes', label: 'Monthly Download Sizes' },
    { id: 'monthlyDownloads', label: 'Monthly Number of Downloads' },
    { id: 'scienceDomains', label: 'Science Domains' },
    { id: 'monthlyUsers', label: 'Unique Users per Month' },
    { id: 'mostPopular', label: 'Most Accessed Datasets' },
    { id: 'latestDownloads', label: 'Latest Downloads' },
    { id: 'heatmap', label: 'Monthly Download Heatmap' },
    { id: 'repoHealth', label: 'Repository Health' },
    { id: 'collections', label: 'Downloads by Collection' },
    { id: 'collectionShare', label: "Collections' Share of Repository" },
    { id: 'untracked', label: 'Untracked Datasets' },
    { id: 'datacite', label: 'DataCite Metrics' },
    // TODO (future enhancement): Engagement + Download Concentration are disabled for now while we
    // refine how they fit the dashboard. Their components, helpers, tests, and the dashboard @case
    // blocks all remain - just uncomment these two lines to bring them back into the layout + Settings.
    //   { id: 'engagement', label: 'Engagement' },
    //   { id: 'concentration', label: 'Download Concentration' },
  ];

  private readonly _hidden = signal<Set<string>>(this.load());
  readonly hidden = this._hidden.asReadonly();

  /** The draggable cards (everything except the KPI strip), in their default order. */
  private readonly defaultOrder = this.widgets.filter((w) => w.id !== 'kpi').map((w) => w.id);

  private readonly _order = signal<string[]>(this.loadOrder());
  private readonly _pinned = signal<Set<string>>(this.loadPins());
  readonly pinned = this._pinned.asReadonly();

  /** Card order reconciled against the canonical set: unknown ids dropped, new cards appended. */
  readonly order = computed<string[]>(() => {
    const saved = this._order().filter((id) => this.defaultOrder.includes(id));
    const missing = this.defaultOrder.filter((id) => !saved.includes(id));
    return [...saved, ...missing];
  });

  /**
   * Visible cards in display order - exactly what the dashboard renders. Pinned cards float to the
   * top (keeping their relative order); unpinned cards follow (in their drag order).
   */
  readonly visibleOrderedCards = computed<string[]>(() => {
    const vis = this.order().filter((id) => this.isVisible(id));
    return [...vis.filter((id) => this.isPinned(id)), ...vis.filter((id) => !this.isPinned(id))];
  });

  /** How many of the visible cards are pinned (the fixed zone at the top of the grid). */
  readonly pinnedVisibleCount = computed<number>(
    () => this.visibleOrderedCards().filter((id) => this.isPinned(id)).length,
  );

  labelFor(id: string): string {
    return this.widgets.find((w) => w.id === id)?.label ?? id;
  }

  isVisible(id: string): boolean {
    return !this._hidden().has(id);
  }

  isPinned(id: string): boolean {
    return this._pinned().has(id);
  }

  togglePin(id: string): void {
    const next = new Set(this._pinned());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._pinned.set(next);
    this.savePins();
  }

  toggle(id: string): void {
    const next = new Set(this._hidden());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._hidden.set(next);
    this.save();
  }

  /** Show every widget again. */
  reset(): void {
    this._hidden.set(new Set());
    this.save();
  }

  /**
   * Reorder by indices within the VISIBLE card list (as delivered by a CDK drop). Hidden cards keep
   * their slots in the full order; only the visible positions are rewritten.
   */
  reorderVisible(previousIndex: number, currentIndex: number): void {
    if (previousIndex === currentIndex) return;
    const vis = [...this.visibleOrderedCards()];
    if (
      previousIndex < 0 ||
      previousIndex >= vis.length ||
      currentIndex < 0 ||
      currentIndex >= vis.length
    ) {
      return;
    }
    const moved = vis[previousIndex];
    if (this.isPinned(moved)) return; // pinned cards are anchored and do not move
    vis.splice(previousIndex, 1);
    vis.splice(currentIndex, 0, moved);
    // Rewrite only the unpinned, visible slots of the order with their new relative sequence.
    const newUnpinned = vis.filter((id) => !this.isPinned(id));
    let i = 0;
    const next = this.order().map((id) =>
      this.isVisible(id) && !this.isPinned(id) ? newUnpinned[i++] : id,
    );
    this._order.set(next);
    this.saveOrder();
  }

  /** Restore the default card order. */
  resetLayout(): void {
    this._order.set([...this.defaultOrder]);
    this.saveOrder();
  }

  /** Restore the entire shipped default layout at once: card order, visibility, and pins. */
  restoreDefaults(): void {
    this._order.set([...this.defaultOrder]);
    this._hidden.set(new Set(LayoutService.DEFAULT_HIDDEN));
    this._pinned.set(new Set(LayoutService.DEFAULT_PINNED));
    this.saveOrder();
    this.save();
    this.savePins();
  }

  private loadOrder(): string[] {
    try {
      const raw = localStorage.getItem(LayoutService.ORDER_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private saveOrder(): void {
    try {
      localStorage.setItem(LayoutService.ORDER_KEY, JSON.stringify(this._order()));
    } catch {
      /* storage unavailable; ordering still works for this session */
    }
  }

  private loadPins(): Set<string> {
    return this.loadSet(LayoutService.PIN_KEY, LayoutService.DEFAULT_PINNED);
  }

  private savePins(): void {
    try {
      localStorage.setItem(LayoutService.PIN_KEY, JSON.stringify([...this._pinned()]));
    } catch {
      /* storage unavailable; pinning still works for this session */
    }
  }

  private load(): Set<string> {
    return this.loadSet(LayoutService.KEY, LayoutService.DEFAULT_HIDDEN);
  }

  /**
   * Load a saved id-set from storage, or seed from `fallback` on first visit. "First visit" = the key
   * is absent; a key present but empty (e.g. the user un-hid everything) is a real choice and kept.
   */
  private loadSet(key: string, fallback: string[]): Set<string> {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return new Set(fallback); // never saved yet -> ship the default
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
    } catch {
      return new Set(fallback);
    }
  }

  private save(): void {
    try {
      localStorage.setItem(LayoutService.KEY, JSON.stringify([...this._hidden()]));
    } catch {
      /* storage unavailable; visibility still works for this session */
    }
  }
}
