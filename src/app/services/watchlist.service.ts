import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks the datasets a user has starred, plus up to a few "pinned" priority datasets within that
 * list. Both are lists of ediids held in signals and mirrored to localStorage, so they survive
 * reloads. Components read the signals reactively and call the mutators to change them.
 */
@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private static readonly KEY = 'watchlist.v1';
  private static readonly PIN_KEY = 'watchlist.pins.v1';
  static readonly MAX_PINS = 3;

  private readonly _ids = signal<string[]>(this.load(WatchlistService.KEY));
  private readonly _pinned = signal<string[]>(this.load(WatchlistService.PIN_KEY));

  /** The watched dataset ediids, in the order they were added. */
  readonly ids = this._ids.asReadonly();
  readonly count = computed(() => this._ids().length);

  /** The pinned (priority) ediids, in pin order. A subset of the watched ids. */
  readonly pinned = this._pinned.asReadonly();
  readonly pinnedCount = computed(() => this._pinned().length);
  readonly canPinMore = computed(() => this._pinned().length < WatchlistService.MAX_PINS);

  isWatched(ediid: string): boolean {
    return this._ids().includes(ediid);
  }

  isPinned(ediid: string): boolean {
    return this._pinned().includes(ediid);
  }

  /** Add the dataset if absent, remove it if present. Unwatching also unpins. */
  toggle(ediid: string): void {
    if (this._ids().includes(ediid)) {
      this.remove(ediid);
    } else {
      this._ids.set([...this._ids(), ediid]);
      this.save();
    }
  }

  remove(ediid: string): void {
    this._ids.set(this._ids().filter((id) => id !== ediid));
    this.save();
    // A dataset that is no longer watched cannot stay pinned.
    if (this._pinned().includes(ediid)) {
      this._pinned.set(this._pinned().filter((id) => id !== ediid));
      this.savePins();
    }
  }

  /**
   * Pin if absent (only when under the limit), unpin if present. Returns false when a pin is blocked
   * because the limit is already reached.
   */
  togglePin(ediid: string): boolean {
    const current = this._pinned();
    if (current.includes(ediid)) {
      this._pinned.set(current.filter((id) => id !== ediid));
      this.savePins();
      return true;
    }
    if (current.length >= WatchlistService.MAX_PINS) return false;
    this._pinned.set([...current, ediid]);
    this.savePins();
    return true;
  }

  private load(key: string): string[] {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(WatchlistService.KEY, JSON.stringify(this._ids()));
    } catch {
      /* storage unavailable; the watchlist still works for this session */
    }
  }

  private savePins(): void {
    try {
      localStorage.setItem(WatchlistService.PIN_KEY, JSON.stringify(this._pinned()));
    } catch {
      /* storage unavailable */
    }
  }
}
