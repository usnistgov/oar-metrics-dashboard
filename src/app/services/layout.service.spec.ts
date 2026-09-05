import { TestBed } from '@angular/core/testing';
import { LayoutService } from './layout.service';

const KEY = 'dashboard.hidden.v1';

describe('LayoutService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  function create(): LayoutService {
    TestBed.configureTestingModule({});
    return TestBed.inject(LayoutService);
  }

  it('ships a default hidden set on first visit and reset shows everything', () => {
    const s = create();
    expect(s.widgets.length).toBeGreaterThan(0);
    expect(s.widgets.some((w) => !s.isVisible(w.id))).toBe(true); // some cards ship hidden
    s.reset();
    expect(s.widgets.every((w) => s.isVisible(w.id))).toBe(true);
  });

  it('toggle hides then shows a widget', () => {
    const s = create();
    s.toggle('engagement');
    expect(s.isVisible('engagement')).toBe(false);
    s.toggle('engagement');
    expect(s.isVisible('engagement')).toBe(true);
  });

  it('persists hidden widgets and reloads them', () => {
    const s = create();
    s.toggle('mostPopular'); // visible by default; toggling hides it
    expect(localStorage.getItem(KEY)).toContain('mostPopular');
    TestBed.resetTestingModule();
    const s2 = create();
    expect(s2.isVisible('mostPopular')).toBe(false);
  });

  it('reset shows everything again', () => {
    const s = create();
    s.toggle('kpi');
    s.toggle('engagement');
    s.reset();
    expect(s.isVisible('kpi')).toBe(true);
    expect(s.isVisible('engagement')).toBe(true);
  });

  it('returns all-visible for malformed storage', () => {
    localStorage.setItem(KEY, '{bad json');
    TestBed.resetTestingModule();
    const s = create();
    expect(s.isVisible('kpi')).toBe(true);
  });

  describe('card order', () => {
    const ORDER_KEY = 'dashboard.order.v1';
    const cardIds = (s: LayoutService) =>
      s.widgets.filter((w) => w.id !== 'kpi').map((w) => w.id);

    it('defaults to every draggable card (KPI excluded)', () => {
      const s = create();
      expect(s.order()).toEqual(cardIds(s));
      expect(s.order()).not.toContain('kpi');
    });

    it('visibleOrderedCards drops hidden cards but the order keeps them', () => {
      const s = create();
      s.toggle('monthlyUsers');
      expect(s.visibleOrderedCards()).not.toContain('monthlyUsers');
      expect(s.order()).toContain('monthlyUsers');
    });

    it('reorderVisible moves a card and persists across reloads', () => {
      const s = create();
      const before = s.visibleOrderedCards();
      s.reorderVisible(0, 2);
      expect(s.visibleOrderedCards()[2]).toBe(before[0]);
      expect(s.visibleOrderedCards().length).toBe(before.length);

      TestBed.resetTestingModule();
      const reloaded = create();
      expect(reloaded.visibleOrderedCards()[2]).toBe(before[0]);
    });

    it('reorderVisible leaves hidden cards in their slots', () => {
      const s = create();
      s.toggle('mostPopular');
      const visBefore = s.visibleOrderedCards();
      s.reorderVisible(0, 1);
      expect(s.order()).toContain('mostPopular');
      expect(s.visibleOrderedCards()).not.toContain('mostPopular');
      expect(s.visibleOrderedCards()[1]).toBe(visBefore[0]);
    });

    it('resetLayout restores the default order', () => {
      const s = create();
      s.reorderVisible(0, 3);
      s.resetLayout();
      expect(s.order()).toEqual(cardIds(s));
    });

    it('reconciles unknown and missing ids in stored order', () => {
      localStorage.setItem(ORDER_KEY, JSON.stringify(['heatmap', 'bogus', 'watchlist']));
      TestBed.resetTestingModule();
      const s = create();
      const order = s.order();
      expect(order).not.toContain('bogus');
      expect(order[0]).toBe('heatmap');
      expect(order[1]).toBe('watchlist');
      expect(order.length).toBe(cardIds(s).length);
    });
  });

  describe('pinning', () => {
    it('floats a pinned card to the top of the visible order', () => {
      const s = create();
      s.reset(); // start from all-visible so we can pin any card
      const last = s.order()[s.order().length - 1];
      expect(s.visibleOrderedCards()[0]).not.toBe(last);
      s.togglePin(last);
      expect(s.isPinned(last)).toBe(true);
      expect(s.visibleOrderedCards()[0]).toBe(last);
      expect(s.pinnedVisibleCount()).toBe(1);
    });

    it('keeps multiple pinned cards in front and persists them', () => {
      const s = create();
      s.reset(); // heatmap + datacite ship hidden by default; reveal them first
      s.togglePin('heatmap');
      s.togglePin('datacite');
      expect(s.visibleOrderedCards().slice(0, 2).sort()).toEqual(['datacite', 'heatmap']);

      TestBed.resetTestingModule();
      const reloaded = create();
      expect(reloaded.isPinned('heatmap')).toBe(true);
      expect(reloaded.isPinned('datacite')).toBe(true);
    });

    it('togglePin unpins a pinned card', () => {
      const s = create();
      s.togglePin('engagement');
      s.togglePin('engagement');
      expect(s.isPinned('engagement')).toBe(false);
    });

    it('reorderVisible never moves a pinned card', () => {
      const s = create();
      s.reset();
      s.togglePin('heatmap'); // floats to index 0
      const before = s.visibleOrderedCards();
      s.reorderVisible(0, 3);
      expect(s.visibleOrderedCards()).toEqual(before);
    });

    it('reorderVisible reorders only the unpinned cards below the pinned zone', () => {
      const s = create();
      s.reset(); // watchlist ships hidden by default; reveal it first
      s.togglePin('watchlist'); // pinned, index 0
      const vis = s.visibleOrderedCards();
      s.reorderVisible(1, 2); // swap the first two unpinned cards
      const after = s.visibleOrderedCards();
      expect(after[0]).toBe('watchlist');
      expect(after[1]).toBe(vis[2]);
      expect(after[2]).toBe(vis[1]);
    });
  });
});
