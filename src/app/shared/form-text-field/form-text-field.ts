import { Component, computed, input } from '@angular/core';
import { Field, FormField } from '@angular/forms/signals';
import { InfoTip } from '../info-tip/info-tip';

/**
 * A labelled text, email, link, password or number input bound to a signal form field.
 * It shows the field's first error once the field has been touched and wires up
 * the `aria-describedby` relationships for the hint and the error.
 */
@Component({
  selector: 'app-form-text-field',
  imports: [FormField, InfoTip],
  templateUrl: './form-text-field.html',
  styleUrl: './form-text-field.scss',
})
export class FormTextField<TValue extends string | number> {
  readonly field = input.required<Field<TValue>>();
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly type = input<'text' | 'email' | 'password' | 'number' | 'url'>('text');
  readonly autocomplete = input<string>();
  readonly hint = input<string>();

  /** What the field is for. Gives the label a small "i" button that shows this when pressed. */
  readonly info = input<string>();

  /** `true` when the field has to be filled in. */
  protected readonly isRequired = computed(() => this.field()().required());

  protected readonly errorId = computed(() => `${this.fieldId()}-error`);
  protected readonly hintId = computed(() => `${this.fieldId()}-hint`);
  protected readonly infoId = computed(() => `${this.fieldId()}-info`);

  protected readonly errorMessage = computed(() => {
    const state = this.field()();
    return state.touched() && state.errors().length ? state.errors()[0].message : undefined;
  });

  protected readonly describedBy = computed(() => {
    // The explanation is described to a screen reader whether or not it is showing.
    const ids = [
      this.hint() ? this.hintId() : '',
      this.info() ? this.infoId() : '',
      this.errorMessage() ? this.errorId() : '',
    ];
    return ids.filter(Boolean).join(' ') || null;
  });
}
