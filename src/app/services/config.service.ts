import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Runtime configuration for the dashboard. Everything here can be overridden per deployment by an
 * `assets/config.json` file (injected by the container at startup), so URLs, backend endpoints, and
 * the version do not require a rebuild to change.
 */
export interface AppConfig {
  /** Monthly repository aggregates endpoint. */
  apiURLRepo: string;
  /** Per-dataset usage-metrics list endpoint. */
  apiURLUsageRecord: string;
  /** Record-metadata (catalog) endpoint. */
  apiURLRecords: string;
  /** DataCite REST base used to check whether a DOI is registered. */
  dataciteApi: string;
  /** Human-readable build/deploy version, shown in the UI and useful for support. */
  version: string;
  /** Auto-refresh interval for the base data, in minutes (also the base-list cache TTL). */
  autoRefreshMinutes: number;
}

/**
 * Built-in defaults. The API paths are root-relative on purpose: in every OAR deployment the app is
 * served same-origin with the RMM API (the gateway routes `/rmm`), and the dev server proxies the
 * same paths, so the app works out of the box and a deployment only overrides what it needs to.
 */
export const DEFAULT_CONFIG: AppConfig = {
  apiURLRepo: environment.apiURLRepo,
  apiURLUsageRecord: environment.apiURLUsageRecord,
  apiURLRecords: environment.apiURLRecords,
  dataciteApi: 'https://api.datacite.org/dois',
  version: '1.0.0',
  autoRefreshMinutes: 10,
};

/**
 * Loads `assets/config.json` once at bootstrap (via an app initializer) and merges it over
 * {@link DEFAULT_CONFIG}. Loading is best-effort: a missing or unreadable file leaves the defaults in
 * place, so the app never fails to start over configuration.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  private config: AppConfig = DEFAULT_CONFIG;

  async load(): Promise<void> {
    const fetched = await firstValueFrom(
      // Relative path (no leading slash) so it resolves under the app's base-href when deployed
      // under a sub-path (e.g. /metrics/assets/config.json).
      this.http.get<Partial<AppConfig>>('assets/config.json').pipe(
        timeout(5000),
        catchError(() => of({} as Partial<AppConfig>)),
      ),
    );
    // Ignore empty/blank overrides so a half-filled file cannot wipe a working default.
    const clean = Object.fromEntries(
      Object.entries(fetched ?? {}).filter(([, v]) => v !== null && v !== ''),
    ) as Partial<AppConfig>;
    this.config = { ...DEFAULT_CONFIG, ...clean };
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  get snapshot(): Readonly<AppConfig> {
    return this.config;
  }
}
