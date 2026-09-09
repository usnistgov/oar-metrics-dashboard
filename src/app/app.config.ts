import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { ConfigService } from './services/config.service';
import { AppErrorHandler } from './services/app-error-handler';
import { rmmThrottleInterceptor } from './services/rmm-throttle.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Single application-wide HttpClient (replaces the deprecated per-component
    // HttpClientModule imports). withFetch() uses the modern Fetch API backend.
    provideHttpClient(withFetch(), withInterceptors([rmmThrottleInterceptor])),
    // Load runtime config (assets/config.json) before the app starts so services read the
    // deployment's URLs/endpoints. Best-effort: falls back to built-in defaults.
    provideAppInitializer(() => inject(ConfigService).load()),
    // Global handler for uncaught errors: full detail in dev, concise + sanitized in production.
    { provide: ErrorHandler, useClass: AppErrorHandler },
  ],
};
