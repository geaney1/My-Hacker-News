import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

/**
 * The current address (path and query) as a signal that updates after every navigation.
 * Call it where injection is available, such as a field initialiser.
 */
export function injectCurrentUrl() {
  const router = inject(Router);
  return toSignal(
    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => router.url),
    ),
    { initialValue: router.url },
  );
}

/** The first part of an address, e.g. `new` for `/new?x=1` or `log-in` for `/log-in`. */
export function firstSegmentOf(url: string) {
  return url.split(/[?#]/)[0].split('/')[1];
}
