import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

/** localStorage keys the service persists to (see theme.service.ts). */
const MODE_KEY = 'theme.mode';
const COLOR_KEY = 'theme.color';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    const root = document.documentElement;
    root.removeAttribute('data-theme');
    root.style.removeProperty('--color-accent');
  });

  function create(): ThemeService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  it('exposes a non-empty list of accent presets', () => {
    const service = create();
    expect(service.presets.length).toBeGreaterThan(0);
    for (const preset of service.presets) {
      expect(preset.value).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(typeof preset.key).toBe('string');
      expect(typeof preset.label).toBe('string');
    }
  });

  it('defaults the accent to the shipped default when nothing is saved', () => {
    const service = create();
    expect(service.color()).toBe(ThemeService.DEFAULT_COLOR);
  });

  it('defaults the mode to the shipped default when nothing is saved', () => {
    const service = create();
    expect(service.mode()).toBe(ThemeService.DEFAULT_MODE);
  });

  it('setColor accepts a valid #rrggbb hex and lowercases it', () => {
    const service = create();
    service.setColor('#ABCDEF');
    expect(service.color()).toBe('#abcdef');
  });

  it('setColor accepts a hex without a leading hash', () => {
    const service = create();
    service.setColor('123abc');
    expect(service.color()).toBe('#123abc');
  });

  it('setColor rejects invalid strings and keeps the previous color', () => {
    const service = create();
    service.setColor('#0d9488');
    service.setColor('not-a-color');
    service.setColor('#12345');
    service.setColor('#1234567');
    service.setColor('#gghhii');
    expect(service.color()).toBe('#0d9488');
  });

  it('isActive is case-insensitive and matches the active accent', () => {
    const service = create();
    service.setColor('#0d9488');
    expect(service.isActive('#0D9488')).toBe(true);
    expect(service.isActive('#0d9488')).toBe(true);
    expect(service.isActive('#059669')).toBe(false);
  });

  it('toggleMode flips light to dark and back', () => {
    const service = create();
    const start = service.mode();
    const flipped = start === 'dark' ? 'light' : 'dark';
    service.toggleMode();
    expect(service.mode()).toBe(flipped);
    service.toggleMode();
    expect(service.mode()).toBe(start);
  });

  it('apply sets the data-theme attribute on document.documentElement', () => {
    const service = create();
    service.mode.set('dark');
    TestBed.flushEffects?.();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    service.mode.set('light');
    TestBed.flushEffects?.();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('apply sets the --color-accent custom property on document.documentElement', () => {
    const service = create();
    service.setColor('#2563eb');
    TestBed.flushEffects?.();
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#2563eb');
  });

  it('persists the mode to localStorage', () => {
    const service = create();
    service.mode.set('dark');
    TestBed.flushEffects?.();
    expect(localStorage.getItem(MODE_KEY)).toBe('dark');
  });

  it('persists the color to localStorage', () => {
    const service = create();
    service.setColor('#7c3aed');
    TestBed.flushEffects?.();
    expect(localStorage.getItem(COLOR_KEY)).toBe('#7c3aed');
  });

  it('restores a saved mode and color from localStorage on construction', () => {
    localStorage.setItem(MODE_KEY, 'dark');
    localStorage.setItem(COLOR_KEY, '#e11d48');
    TestBed.resetTestingModule();
    const service = create();
    expect(service.mode()).toBe('dark');
    expect(service.color()).toBe('#e11d48');
  });

  it('preview sets --color-accent without committing the color', () => {
    const service = create();
    service.setColor('#0d9488');
    TestBed.flushEffects?.();
    service.preview('#059669');
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#059669');
    // The committed color is unchanged.
    expect(service.color()).toBe('#0d9488');
  });

  it('restore re-applies the committed color after a preview', () => {
    const service = create();
    service.setColor('#0d9488');
    TestBed.flushEffects?.();
    service.preview('#059669');
    service.restore();
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#0d9488');
  });
});
