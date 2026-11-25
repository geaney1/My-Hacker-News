import { Service, signal } from '@angular/core';

/**
 * Which info tip is showing. Only one is at a time, so opening one hides the one that was open and
 * the explanations never pile up and push the form down.
 */
@Service()
export class OpenInfoTip {
  readonly openTipId = signal<string | undefined>(undefined);
}
