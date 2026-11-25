import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

/**
 * Lets logged-in users through and sends everyone else to the log-in screen, remembering the
 * address they wanted so they can be taken there once they have logged in.
 */
function requireLogin(wantedUrl: string) {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  return (
    authStore.login() ||
    router.createUrlTree(['/log-in'], { queryParams: { returnUrl: wantedUrl } })
  );
}

export const loggedInGuard: CanActivateFn = (_route, state) => requireLogin(state.url);
