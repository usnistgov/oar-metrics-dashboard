// Jest test environment setup: initialize the Angular TestBed with zone.js, and provide a canvas
// mock so Chart.js components can render under jsdom (jsdom has no real <canvas>).
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import 'jest-canvas-mock';

setupZoneTestEnv();

// jsdom lacks ResizeObserver, which Chart.js uses for responsive charts (real browsers provide it).
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;
