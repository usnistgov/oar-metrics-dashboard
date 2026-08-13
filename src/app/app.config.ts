import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { ConfigService } from './services/config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Single application-wide HttpClient (replaces the deprecated per-component
    // HttpClientModule imports). withFetch() uses the modern Fetch API backend.
    provideHttpClient(withFetch()),
    // Load runtime config (assets/config.json) before the app starts so services read the
    // deployment's URLs/endpoints. Best-effort: falls back to built-in defaults.
    provideAppInitializer(() => inject(ConfigService).load()),
  ],
};
