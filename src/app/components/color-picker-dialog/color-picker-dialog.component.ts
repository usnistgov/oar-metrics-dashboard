import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AccentPreset, ThemeService } from '../../services/theme.service';

export interface ColorPickerData {
  presets: AccentPreset[];
  initial: string;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = (hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return { h: 0, s: 0, v: 0 };
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Polished HSV color picker (saturation/value box + hue slider + hex + presets) with live preview. */
@Component({
  selector: 'app-color-picker-dialog',
  imports: [MatButtonModule, MatDialogModule, MatTooltipModule],
  templateUrl: './color-picker-dialog.component.html',
  styleUrl: './color-picker-dialog.component.css',
})
export class ColorPickerDialogComponent {
  private ref = inject(MatDialogRef<ColorPickerDialogComponent, string>);
  private theme = inject(ThemeService);
  readonly data = inject<ColorPickerData>(MAT_DIALOG_DATA);

  private svBox = viewChild<ElementRef<HTMLElement>>('sv');
  private hueTrack = viewChild<ElementRef<HTMLElement>>('hue');

  readonly h = signal(0);
  readonly s = signal(0);
  readonly v = signal(0);
  readonly hexInput = signal('');

  readonly hex = computed(() => hsvToHex(this.h(), this.s(), this.v()));
  readonly hueColor = computed(() => `hsl(${this.h()}, 100%, 50%)`);

  constructor() {
    const { h, s, v } = hexToHsv(this.data.initial || '#0d9488');
    this.h.set(h);
    this.s.set(s);
    this.v.set(v);
    this.hexInput.set(this.hex().slice(1));
  }

  // --- saturation/value box (x = saturation, y = value) ---
  startSV(e: PointerEvent): void {
    this.moveSV(e);
    this.drag((ev) => this.moveSV(ev));
  }
  private moveSV(e: PointerEvent): void {
    const el = this.svBox()?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.s.set(clamp01((e.clientX - r.left) / r.width));
    this.v.set(1 - clamp01((e.clientY - r.top) / r.height));
    this.previewNow();
  }

  // --- hue slider ---
  startHue(e: PointerEvent): void {
    this.moveHue(e);
    this.drag((ev) => this.moveHue(ev));
  }
  private moveHue(e: PointerEvent): void {
    const el = this.hueTrack()?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.h.set(clamp01((e.clientX - r.left) / r.width) * 360);
    this.previewNow();
  }

  private drag(onMove: (e: PointerEvent) => void): void {
    const move = (e: PointerEvent) => onMove(e);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  onHexInput(raw: string): void {
    const cleaned = raw.replace('#', '');
    this.hexInput.set(cleaned);
    if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
      const { h, s, v } = hexToHsv(`#${cleaned}`);
      this.h.set(h);
      this.s.set(s);
      this.v.set(v);
      this.theme.preview(`#${cleaned}`);
    }
  }

  pickPreset(hex: string): void {
    const { h, s, v } = hexToHsv(hex);
    this.h.set(h);
    this.s.set(s);
    this.v.set(v);
    this.previewNow();
  }

  private previewNow(): void {
    this.hexInput.set(this.hex().slice(1));
    this.theme.preview(this.hex());
  }

  apply(): void {
    this.ref.close(this.hex());
  }
  cancel(): void {
    this.ref.close();
  }
}
