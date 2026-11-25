import { Component, computed, input } from '@angular/core';
import { BannerKind } from '../../models/banner-kind';

let nextBannerId = 0;

/**
 * A notice across the page or the dialog, for something the user should know: that they are being
 * shut out for a while, that something could not be loaded, that stories have changed. It is tinted
 * and has an icon, so it cannot be mistaken for a story card or for the page's own content.
 *
 * What goes inside the banner is the message. An element marked `bannerAction` (a button or a
 * link) goes at the right, or under the message on a narrow screen. A banner of kind `error` is
 * announced to a screen reader at once; the others are announced politely.
 */
@Component({
  selector: 'app-banner',
  templateUrl: './banner.html',
  styleUrl: './banner.scss',
  host: { '[class]': 'hostClass()' },
})
export class Banner {
  readonly kind = input<BannerKind>('warning');

  /** A short heading above the message. Leave it out for a one-line notice. */
  readonly heading = input<string>();

  /** A smaller banner, for a notice inside a dialog. */
  readonly compact = input(false);

  protected readonly headingId = `banner-heading-${nextBannerId++}`;

  protected readonly role = computed(() => (this.kind() === 'error' ? 'alert' : 'status'));

  protected readonly hostClass = computed(
    () => `banner-${this.kind()}${this.compact() ? ' banner-compact' : ''}`,
  );
}
