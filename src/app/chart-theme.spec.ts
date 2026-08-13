import { chartTheme, barDataset, barChartOptions } from './chart-theme';
import { ScriptableContext } from 'chart.js';

describe('chart-theme', () => {
  // Properties we set on the document root so we can verify the theme reads them.
  const props = ['--color-muted', '--color-text', '--chart-grid', '--color-surface', '--color-accent'];

  afterEach(() => {
    // Clean up any CSS custom properties a test may have set.
    for (const p of props) {
      document.documentElement.style.removeProperty(p);
    }
  });

  describe('chartTheme()', () => {
    it('returns the text/grid/bar/barBorder bundle as strings', () => {
      const t = chartTheme();
      expect(typeof t.text).toBe('string');
      expect(typeof t.grid).toBe('string');
      expect(typeof t.bar).toBe('string');
      expect(typeof t.barBorder).toBe('string');
    });

    it('reads CSS custom properties from the document root', () => {
      document.documentElement.style.setProperty('--color-accent', '#0d9488');
      document.documentElement.style.setProperty('--color-muted', '#64748b');
      document.documentElement.style.setProperty('--chart-grid', '#e3e8ef');

      const t = chartTheme();
      expect(t.text).toBe('#64748b');
      expect(t.grid).toBe('#e3e8ef');
      // bar is the accent with an alpha suffix, barBorder is the raw accent.
      expect(t.barBorder).toBe('#0d9488');
      expect(t.bar).toBe('#0d9488a6');
    });

    it('falls back to defaults when no CSS variables are set', () => {
      const t = chartTheme();
      expect(t.text).toBe('#64748b');
      expect(t.grid).toBe('rgba(16, 24, 40, 0.1)');
      expect(t.barBorder).toBe('#0d9488');
    });
  });

  describe('barDataset(label, data)', () => {
    it('returns the expected structural properties', () => {
      const data = [1, 2, 3];
      const ds = barDataset('Downloads', data);

      expect(ds.label).toBe('Downloads');
      expect(ds.data).toBe(data);
      expect(ds.borderRadius).toBe(5);
      expect(ds.borderSkipped).toBe(false);
      expect(ds.borderWidth).toBe(0);
      expect(ds.maxBarThickness).toBe(46);
      expect(typeof ds.hoverBackgroundColor).toBe('string');
      expect(typeof ds.backgroundColor).toBe('function');
    });

    it('backgroundColor returns the fallback string when chartArea is null', () => {
      const ds = barDataset('X', [1]);
      const ctx = { chart: { chartArea: null, ctx: {} } } as unknown as ScriptableContext<'bar'>;
      const result = (ds.backgroundColor as (c: ScriptableContext<'bar'>) => unknown)(ctx);
      expect(typeof result).toBe('string');
    });

    it('backgroundColor returns the gradient object once chartArea exists', () => {
      const ds = barDataset('X', [1]);
      const gradient = { addColorStop: () => {} };
      const ctx = {
        chart: {
          chartArea: { top: 0, bottom: 100 },
          ctx: { createLinearGradient: () => gradient },
        },
      } as unknown as ScriptableContext<'bar'>;

      const result = (ds.backgroundColor as (c: ScriptableContext<'bar'>) => unknown)(ctx);
      expect(result).toBe(gradient);
    });
  });

  describe('barChartOptions(xTitle, yTitle)', () => {
    it('wires the axis titles, hides the x-grid and legend, and themes the tooltip', () => {
      const opts = barChartOptions('Month', 'Count');

      expect(opts.scales!['x']!.title!.text).toBe('Month');
      expect(opts.scales!['y']!.title!.text).toBe('Count');
      expect((opts.scales!['x']!.grid as { display: boolean }).display).toBe(false);
      expect(opts.plugins!.legend!.display).toBe(false);

      const tooltip = opts.plugins!.tooltip!;
      expect(tooltip).toBeTruthy();
      expect((tooltip as { displayColors: boolean }).displayColors).toBe(false);
    });
  });
});
