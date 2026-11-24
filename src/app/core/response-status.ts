import { inject, Injectable, RESPONSE_INIT } from '@angular/core';

/**
 * Sets the HTTP status of the page being server-rendered. In the browser there is no response
 * to change, so it does nothing there.
 */
@Injectable({ providedIn: 'root' })
export class ResponseStatus {
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  /** Marks the page as 404 so crawlers and link checkers don't treat a missing page as found. */
  setNotFound() {
    if (this.responseInit) {
      this.responseInit.status = 404;
    }
  }
}
