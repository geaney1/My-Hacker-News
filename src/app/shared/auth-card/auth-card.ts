import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { StoriesStore } from '../../features/stories/stories.store';

let nextCardId = 0;

/**
 * The dialog used by the log-in, create-user, change-password, submit and profile pages: a card
 * with a title, a close link and projected content, over the page behind it, which stays visible
 * but cannot be used.
 */
@Component({
  selector: 'app-auth-card',
  imports: [RouterLink],
  templateUrl: './auth-card.html',
  styleUrl: './auth-card.scss',
})
export class AuthCard {
  private readonly router = inject(Router);
  private readonly storiesStore = inject(StoriesStore);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly heading = input.required<string>();

  /** A wider card, for a longer form such as the profile. */
  readonly wide = input(false);

  /** Where closing goes. By default, back to the story list the user last had open. */
  readonly closeLink = input<string>();

  protected readonly closeTarget = computed(
    () => this.closeLink() ?? `/${this.storiesStore.selectedList()}`,
  );

  protected readonly headingId = `auth-card-title-${nextCardId++}`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.openAsModal());
  }

  /**
   * The server renders the dialog already open so it shows before any script has run. In the
   * browser it is reopened as a true modal: the page behind it becomes inert, focus stays inside,
   * and Escape closes it.
   */
  private openAsModal() {
    const dialog = this.dialog().nativeElement;
    if (typeof dialog.showModal !== 'function') {
      return;
    }
    // What had the focus (the link that opened the dialog), so the focus can go back to it.
    const opener = this.document.activeElement;
    dialog.removeAttribute('open');
    dialog.showModal();
    dialog.querySelector<HTMLElement>('input, textarea, select')?.focus();
    this.destroyRef.onDestroy(() => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    });
  }

  /** Escape, or a click on the backdrop, closes the dialog: go back to where the user was. */
  protected onDialogClosed() {
    this.router.navigateByUrl(this.closeTarget());
  }

  /**
   * Pressing the mouse on the Close icon or on the backdrop leaves the focus where it is. Otherwise
   * the field being left would show its error, the card would change size as it was being closed,
   * and the icon could move out from under the pointer.
   */
  protected keepFocusWhileClosing(event: MouseEvent) {
    const pressed = event.target as Element;
    if (pressed === this.dialog().nativeElement || pressed.closest('.close')) {
      event.preventDefault();
    }
  }

  /** A click on the dialog itself, outside its content box, is a click on the backdrop. */
  protected onDialogClick(event: MouseEvent) {
    const dialog = this.dialog().nativeElement;
    if (event.target === dialog) {
      dialog.close();
    }
  }
}
