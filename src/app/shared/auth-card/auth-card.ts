import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { StoriesStore } from '../../features/stories/stories.store';

let nextCardId = 0;

/**
 * The card used by the auth pages: a title, a close link and projected content. With `modal`
 * it is a dialog over the page behind it, which stays visible but cannot be used; without it, it
 * is an ordinary card in the page.
 */
@Component({
  selector: 'app-auth-card',
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './auth-card.html',
  styleUrl: './auth-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCard {
  private readonly router = inject(Router);
  private readonly storiesStore = inject(StoriesStore);

  readonly heading = input.required<string>();

  /** Show the card as a modal dialog over the page behind it. */
  readonly modal = input(false);

  /** Where closing goes. By default, back to the story list the user last had open. */
  readonly closeLink = input<string>();

  protected readonly closeTarget = computed(
    () => this.closeLink() ?? `/${this.storiesStore.selectedList()}`,
  );

  protected readonly headingId = `auth-card-title-${nextCardId++}`;

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.openAsModal());
  }

  /**
   * The server renders the dialog already open so it shows before any script has run. In the
   * browser it is reopened as a true modal: the page behind it becomes inert, focus stays inside,
   * and Escape closes it.
   */
  private openAsModal() {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog || typeof dialog.showModal !== 'function') {
      return;
    }
    dialog.removeAttribute('open');
    dialog.showModal();
    dialog.querySelector('input')?.focus();
  }

  /** Escape, or a click on the backdrop, closes the dialog: go back to where the user was. */
  protected onDialogClosed() {
    this.router.navigateByUrl(this.closeTarget());
  }

  /** A click on the dialog itself, outside its content box, is a click on the backdrop. */
  protected onDialogClick(event: MouseEvent) {
    const dialog = this.dialog()?.nativeElement;
    if (dialog && event.target === dialog) {
      dialog.close();
    }
  }
}
