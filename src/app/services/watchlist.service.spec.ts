import { TestBed } from '@angular/core/testing';
import { WatchlistService } from './watchlist.service';

/** The localStorage key the service mirrors its state to (see watchlist.service.ts). */
const KEY = 'watchlist.v1';

describe('WatchlistService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function create(): WatchlistService {
    TestBed.configureTestingModule({});
    return TestBed.inject(WatchlistService);
  }

  it('starts empty when localStorage has nothing', () => {
    const service = create();
    expect(service.ids()).toEqual([]);
    expect(service.count()).toBe(0);
  });

  it('toggle adds an ediid that is absent', () => {
    const service = create();
    service.toggle('ark:/a');
    expect(service.ids()).toEqual(['ark:/a']);
    expect(service.isWatched('ark:/a')).toBe(true);
  });

  it('toggle removes an ediid that is already present', () => {
    const service = create();
    service.toggle('ark:/a');
    service.toggle('ark:/a');
    expect(service.ids()).toEqual([]);
    expect(service.isWatched('ark:/a')).toBe(false);
  });

  it('isWatched reflects the current state', () => {
    const service = create();
    expect(service.isWatched('ark:/a')).toBe(false);
    service.toggle('ark:/a');
    expect(service.isWatched('ark:/a')).toBe(true);
    expect(service.isWatched('ark:/b')).toBe(false);
  });

  it('count reflects the number of watched ids', () => {
    const service = create();
    expect(service.count()).toBe(0);
    service.toggle('ark:/a');
    service.toggle('ark:/b');
    expect(service.count()).toBe(2);
  });

  it('preserves insertion order when adding multiple ids', () => {
    const service = create();
    service.toggle('ark:/a');
    service.toggle('ark:/b');
    service.toggle('ark:/c');
    expect(service.ids()).toEqual(['ark:/a', 'ark:/b', 'ark:/c']);
  });

  it('remove deletes a specific ediid', () => {
    const service = create();
    service.toggle('ark:/a');
    service.toggle('ark:/b');
    service.remove('ark:/a');
    expect(service.ids()).toEqual(['ark:/b']);
    expect(service.isWatched('ark:/a')).toBe(false);
  });

  it('remove on an absent ediid is a no-op', () => {
    const service = create();
    service.toggle('ark:/a');
    service.remove('ark:/missing');
    expect(service.ids()).toEqual(['ark:/a']);
  });

  it('persists the watchlist to localStorage on toggle', () => {
    const service = create();
    service.toggle('ark:/a');
    service.toggle('ark:/b');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['ark:/a', 'ark:/b']);
  });

  it('persists the watchlist to localStorage on remove', () => {
    const service = create();
    service.toggle('ark:/a');
    service.toggle('ark:/b');
    service.remove('ark:/a');
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['ark:/b']);
  });

  it('loads existing ids from localStorage on construction', () => {
    localStorage.setItem(KEY, JSON.stringify(['ark:/x', 'ark:/y']));
    // Re-create the injector so the service constructor reads the seeded value.
    TestBed.resetTestingModule();
    const service = create();
    expect(service.ids()).toEqual(['ark:/x', 'ark:/y']);
    expect(service.count()).toBe(2);
    expect(service.isWatched('ark:/x')).toBe(true);
  });

  it('returns empty for malformed JSON in localStorage without throwing', () => {
    localStorage.setItem(KEY, '{not valid json');
    TestBed.resetTestingModule();
    let service!: WatchlistService;
    expect(() => (service = create())).not.toThrow();
    expect(service.ids()).toEqual([]);
  });

  it('returns empty when the stored value is not an array', () => {
    localStorage.setItem(KEY, JSON.stringify({ ediid: 'ark:/a' }));
    TestBed.resetTestingModule();
    const service = create();
    expect(service.ids()).toEqual([]);
  });

  it('filters out non-string entries when loading', () => {
    localStorage.setItem(KEY, JSON.stringify(['ark:/a', 42, null, 'ark:/b']));
    TestBed.resetTestingModule();
    const service = create();
    expect(service.ids()).toEqual(['ark:/a', 'ark:/b']);
  });
});

describe('WatchlistService pinning', () => {
  const PIN_KEY = 'watchlist.pins.v1';

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  function create(): WatchlistService {
    TestBed.configureTestingModule({});
    return TestBed.inject(WatchlistService);
  }

  it('togglePin pins then unpins a dataset', () => {
    const s = create();
    expect(s.togglePin('ark:/a')).toBe(true);
    expect(s.isPinned('ark:/a')).toBe(true);
    expect(s.pinnedCount()).toBe(1);
    expect(s.togglePin('ark:/a')).toBe(true);
    expect(s.isPinned('ark:/a')).toBe(false);
  });

  it('blocks pinning beyond the max of 3', () => {
    const s = create();
    s.togglePin('a');
    s.togglePin('b');
    s.togglePin('c');
    expect(s.pinnedCount()).toBe(3);
    expect(s.canPinMore()).toBe(false);
    expect(s.togglePin('d')).toBe(false);
    expect(s.isPinned('d')).toBe(false);
    expect(s.pinnedCount()).toBe(3);
  });

  it('canPinMore reflects the limit', () => {
    const s = create();
    expect(s.canPinMore()).toBe(true);
    s.togglePin('a');
    s.togglePin('b');
    expect(s.canPinMore()).toBe(true);
    s.togglePin('c');
    expect(s.canPinMore()).toBe(false);
  });

  it('unwatching a pinned dataset also unpins it', () => {
    const s = create();
    s.toggle('ark:/a');
    s.togglePin('ark:/a');
    expect(s.isPinned('ark:/a')).toBe(true);
    s.toggle('ark:/a');
    expect(s.isWatched('ark:/a')).toBe(false);
    expect(s.isPinned('ark:/a')).toBe(false);
  });

  it('persists pins to localStorage and reloads them', () => {
    const s = create();
    s.togglePin('ark:/a');
    expect(localStorage.getItem(PIN_KEY)).toContain('ark:/a');
    TestBed.resetTestingModule();
    const s2 = create();
    expect(s2.isPinned('ark:/a')).toBe(true);
  });
});
