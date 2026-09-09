import { ErrorHandler, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * Global handler for otherwise-uncaught errors (thrown in components, effects, async callbacks, etc.).
 *
 * Development: logs the full error and stack so it is easy to debug.
 *
 * Production: logs a single concise, sanitized line - error type plus a trimmed first line of the
 * message, never a stack trace, request body, or interpolated data. HTTP failures are reduced to
 * their status code so no URLs or response payloads reach the console. Known browser noise (e.g. the
 * benign ResizeObserver loop warning) is dropped entirely so the console shows only actionable items.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly isDev = !environment.production;

  handleError(error: unknown): void {
    if (this.isIgnorable(error)) return;

    if (this.isDev) {
      console.error('[metrics] Unhandled error:', error);
      return;
    }
    console.error(`[metrics] Unhandled error: ${this.safeMessage(error)}`);
  }

  /** Benign, non-actionable browser noise that would only clutter the console. */
  private isIgnorable(error: unknown): boolean {
    return /ResizeObserver loop|Non-Error promise rejection captured/i.test(this.rawMessage(error));
  }

  private rawMessage(error: unknown): string {
    if (error instanceof Error) return error.message ?? '';
    return typeof error === 'string' ? error : '';
  }

  /**
   * A short, non-sensitive description for production: error type plus the first line of the message,
   * capped. HTTP errors collapse to their status so URLs and bodies are never logged.
   */
  private safeMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) return `HTTP ${error.status}`;
    const name = error instanceof Error && error.name ? error.name : 'Error';
    const first = this.rawMessage(error).split('\n')[0].slice(0, 200);
    return first ? `${name}: ${first}` : name;
  }
}
