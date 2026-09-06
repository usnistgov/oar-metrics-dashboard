import { HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import {
  EMPTY,
  Observable,
  ReplaySubject,
  Subject,
  catchError,
  concatMap,
  defer,
  map,
  mergeMap,
  retry,
  tap,
  throwError,
  timer,
} from 'rxjs';

/**
 * Global rate gate + retry for RMM requests. Behind the OAR gateway, /rmm is limited to ~10 req/s,
 * and a dashboard refresh fans out many calls at once (paged lists, catalog, collection members,
 * per-record lookups). Every /rmm request is funneled through one shared queue that dispatches at
 * most one every REQUEST_GAP_MS, so the combined rate across all streams stays under the limit; any
 * 429/503 is retried with exponential backoff. Non-/rmm requests pass straight through.
 */
const REQUEST_GAP_MS = 120; // ~8 requests/second, safely under the gateway's 10 r/s

interface QueueItem {
  run: () => Observable<HttpEvent<unknown>>;
  out: ReplaySubject<HttpEvent<unknown>>;
}

const queue$ = new Subject<QueueItem>();

queue$
  .pipe(
    // Space dispatches so the sustained rate stays under the gateway limit (concurrency is naturally
    // bounded as a result). Each request still runs to completion in parallel once dispatched.
    concatMap((item) => timer(REQUEST_GAP_MS).pipe(map(() => item))),
    mergeMap(({ run, out }) =>
      run().pipe(
        tap({
          next: (e) => out.next(e),
          error: (e) => out.error(e),
          complete: () => out.complete(),
        }),
        catchError(() => EMPTY), // error already forwarded to `out`; keep the queue alive
      ),
    ),
  )
  .subscribe();

export const rmmThrottleInterceptor: HttpInterceptorFn = (req, next) => {
  if (!/\/rmm(\/|\?|$)/.test(req.url)) return next(req);
  return defer(() => {
    const out = new ReplaySubject<HttpEvent<unknown>>();
    queue$.next({
      run: () =>
        next(req).pipe(
          retry({
            count: 4,
            delay: (err: { status?: number }, attempt: number) =>
              err?.status === 429 || err?.status === 503
                ? timer(400 * Math.pow(2, attempt - 1)) // 400ms, 800ms, 1.6s, 3.2s
                : throwError(() => err),
          }),
        ),
      out,
    });
    return out.asObservable();
  });
};
