import { Component, computed, input } from '@angular/core';
import { Field, FormField } from '@angular/forms/signals';

/**
 * A labelled multi-line text box bound to a signal form field. Like the single-line field, it
 * shows the field's first error once touched and wires up `aria-describedby` for hint and error.
 */
@Component({
  selector: 'app-form-text-area',
  imports: [FormField],
  templateUrl: './form-text-area.html',
  styleUrl: '../form-text-field/form-text-field.scss',
})
export class FormTextArea {
  readonly field = input.required<Field<string>>();
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly rows = input(5);
  readonly hint = input<string>();

  protected readonly errorId = computed(() => `${this.fieldId()}-error`);
  protected readonly hintId = computed(() => `${this.fieldId()}-hint`);

  protected readonly errorMessage = computed(() => {
    const state = this.field()();
    return state.touched() && state.errors().length ? state.errors()[0].message : undefined;
  });

  protected readonly describedBy = computed(() => {
    const ids = [this.hint() ? this.hintId() : '', this.errorMessage() ? this.errorId() : ''];
    return ids.filter(Boolean).join(' ') || null;
  });
}
