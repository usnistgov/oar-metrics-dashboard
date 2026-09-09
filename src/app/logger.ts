import { environment } from '../environments/environment';

/**
 * Environment-aware logging.
 *
 * Development (and any non-production build): verbose - debug/info/warn all print, and errors
 * include the full detail object/stack so problems are easy to trace locally.
 *
 * Production: quiet and sanitized - only errors reach the console, as a single concise line with
 * no detail objects, stacks, or payloads. Nothing that is noise to an end user (or that could carry
 * sensitive data) is emitted. This keeps the browser console clean for the people who actually see
 * it in production while staying maximally helpful for developers.
 */
const isDev = !environment.production;
const TAG = '[metrics]';

export const log = {
  debug: (...args: unknown[]): void => {
    if (isDev) console.debug(TAG, ...args);
  },
  info: (...args: unknown[]): void => {
    if (isDev) console.info(TAG, ...args);
  },
  warn: (...args: unknown[]): void => {
    if (isDev) console.warn(TAG, ...args);
  },
  /**
   * Errors always surface. In dev the optional `detail` (error object, values, etc.) is included;
   * in production only the short `message` is logged, so no payloads or sensitive values leak.
   */
  error: (message: string, detail?: unknown): void => {
    if (isDev) console.error(TAG, message, detail ?? '');
    else console.error(`${TAG} ${message}`);
  },
};
