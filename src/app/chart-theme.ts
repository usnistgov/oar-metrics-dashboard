import { ChartOptions, ScriptableContext } from 'chart.js';

/** Read the live theme colors from the CSS variables (so charts follow light/dark + accent). */
function vars() {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    tick: read('--color-muted', '#64748b'), // axis titles / ticks
    strong: read('--color-text', '#1e293b'), // tooltip text
    grid: read('--chart-grid', 'rgba(16, 24, 40, 0.1)'), // gridlines (visible in light + dark)
    surface: read('--color-surface', '#ffffff'), // tooltip background
    accent: read('--color-accent', '#0d9488'), // bars / lines
  };
}

/** Legacy color bundle, kept for any direct callers. Prefer barDataset / barChartOptions. */
export function chartTheme(): { text: string; grid: string; bar: string; barBorder: string } {
  const v = vars();
  return { text: v.tick, grid: v.grid, bar: v.accent + 'a6', barBorder: v.accent };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const s = hex.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return null;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

/**
 * Colors for the collection-share doughnut: `n` tints of the live accent (darkest first, getting
 * lighter) for the collection slices. Pair with {@link restColor} for the "Not in a collection"
 * remainder so it reads as neutral rather than as another collection.
 */
export function sliceColors(n: number): string[] {
  const rgb = hexToRgb(vars().accent) ?? { r: 13, g: 148, b: 136 };
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? (i / (n - 1)) * 0.55 : 0; // mix toward white, up to ~55%
    out.push('#' + toHex(rgb.r + (255 - rgb.r) * t) + toHex(rgb.g + (255 - rgb.g) * t) + toHex(rgb.b + (255 - rgb.b) * t));
  }
  return out;
}

/** Neutral slate for the "remainder" slice; visible on both light and dark card surfaces. */
export function restColor(): string {
  return '#94a3b8';
}

/** A bar dataset with a subtle vertical accent gradient and rounded tops. */
export function barDataset(label: string, data: number[]) {
  const { accent } = vars();
  return {
    label,
    data,
    backgroundColor: (ctx: ScriptableContext<'bar'>) => {
      const area = ctx.chart.chartArea;
      if (!area) return accent; // before the first layout pass
      const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, accent + 'f2'); // ~95% near the top
      g.addColorStop(1, accent + '8c'); // ~55% near the baseline
      return g;
    },
    hoverBackgroundColor: accent,
    borderRadius: 5,
    borderSkipped: false as const,
    borderWidth: 0,
    maxBarThickness: 46,
  };
}

/**
 * Shared bar-chart options: a hairline y-grid only (no x-grid, no axis borders), no legend (the
 * charts have a single series), and a themed tooltip. Reads the current theme colors at call time.
 */
export function barChartOptions(xTitle: string, yTitle: string): ChartOptions<'bar'> {
  const { tick, strong, grid, surface } = vars();
  return {
    responsive: true,
    maintainAspectRatio: false,
    // Bars grow up from the zero baseline (each bar's top + base start at y=0, then ease to value).
    animation: { duration: 750, easing: 'easeOutQuart' },
    animations: {
      y: { from: (ctx) => ctx.chart.scales['y']?.getPixelForValue(0) ?? 0 },
      base: { from: (ctx) => ctx.chart.scales['y']?.getPixelForValue(0) ?? 0 },
    },
    scales: {
      x: {
        title: { display: true, text: xTitle, color: tick },
        ticks: { color: tick },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        title: { display: true, text: yTitle, color: tick },
        ticks: { color: tick },
        grid: { color: grid },
        border: { display: false },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: surface,
        titleColor: strong,
        bodyColor: strong,
        borderColor: grid,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
      },
    },
  };
}

/** A line dataset with a smooth accent stroke and a soft accent gradient fill underneath. */
export function lineDataset(label: string, data: number[]) {
  const { accent } = vars();
  return {
    label,
    data,
    borderColor: accent,
    backgroundColor: (ctx: ScriptableContext<'line'>) => {
      const area = ctx.chart.chartArea;
      if (!area) return accent + '22';
      const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, accent + '40'); // ~25% near the line
      g.addColorStop(1, accent + '05'); // ~2% at the baseline
      return g;
    },
    pointBackgroundColor: accent,
    fill: true,
    tension: 0.3,
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
  };
}

/** Shared line-chart options: hairline y-grid only, no x-grid/axis borders, no legend, themed tooltip. */
export function lineChartOptions(xTitle: string, yTitle: string): ChartOptions<'line'> {
  const { tick, strong, grid, surface } = vars();
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: { display: true, text: xTitle, color: tick },
        ticks: { color: tick, maxTicksLimit: 8 },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        title: { display: true, text: yTitle, color: tick },
        ticks: { color: tick },
        grid: { color: grid },
        border: { display: false },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: surface,
        titleColor: strong,
        bodyColor: strong,
        borderColor: grid,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
      },
    },
  };
}
