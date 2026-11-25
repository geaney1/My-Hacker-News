import { Component, computed, DestroyRef, ElementRef, inject, input } from '@angular/core';
import { OpenInfoTip } from './open-info-tip';

/**
 * A small "i" button, put beside the label of a field. Pressing it shows or hides a short
 * explanation of what the field is for. The explanation is always in the page, so a screen reader
 * reads it as the field's description (the field points at it with `aria-describedby`, using the
 * same `tipId`) whether or not it is showing.
 *
 * Only one explanation shows at a time, and it hides when the button is pressed again, when Escape
 * is pressed, or when anything outside it is clicked.
 *
 * The name of another setting in the explanation can be marked by putting it between double
 * asterisks, as in `**Max Visit**`. It is shown bold and in the accent colour, so it can be told
 * from the rest of the words as the name of a setting.
 */
@Component({
  selector: 'app-info-tip',
  templateUrl: './info-tip.html',
  styleUrl: './info-tip.scss',
  host: {
    '(keydown.escape)': 'close($event)',
    '(document:click)': 'closeOnClickOutside($event)',
  },
})
export class InfoTip {
  private readonly openTip = inject(OpenInfoTip);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The name of the field, so the button can say what it explains: "About Max Visit". */
  readonly label = input.required<string>();

  /** The explanation, with the names of settings between double asterisks. */
  readonly text = input.required<string>();

  /**
   * The explanation cut into pieces: plain words, and the names of settings. Every other piece is
   * a name (the text between the asterisks), starting with a plain one that may be empty.
   */
  protected readonly parts = computed(() =>
    this.text()
      .split(/\*\*(.+?)\*\*/)
      .map((text, index) => ({ text, isName: index % 2 === 1 })),
  );

  /** The id of the explanation, for the field's `aria-describedby`. */
  readonly tipId = input.required<string>();

  protected readonly open = computed(() => this.openTip.openTipId() === this.tipId());

  constructor() {
    // A tip left open when its dialog closes does not come back open when the dialog is reopened.
    inject(DestroyRef).onDestroy(() => {
      if (this.open()) {
        this.openTip.openTipId.set(undefined);
      }
    });
  }

  protected toggle() {
    this.openTip.openTipId.set(this.open() ? undefined : this.tipId());
  }

  /**
   * Escape hides the explanation, without closing a dialog the field is in. The browser closes a
   * dialog on Escape as a default action, so that is cancelled as well as the event stopped.
   */
  protected close(event: Event) {
    if (this.open()) {
      event.preventDefault();
      event.stopPropagation();
      this.openTip.openTipId.set(undefined);
    }
  }

  /** A click anywhere else hides the explanation. A click on this tip's own button is its toggle. */
  protected closeOnClickOutside(event: Event) {
    if (this.open() && !this.element.nativeElement.contains(event.target as Node)) {
      this.openTip.openTipId.set(undefined);
    }
  }
}
