import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Field, FormField } from '@angular/forms/signals';

/**
 * A labelled text, email, password or number input bound to a signal form field.
 * It shows the field's first error once the field has been touched and wires up
 * the `aria-describedby` relationships for the hint and the error.
 */
@Component({
  selector: 'app-form-text-field',
  imports: [FormField],
  templateUrl: './form-text-field.html',
  styleUrl: './form-text-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormTextField<TValue extends string | number> {
  readonly field = input.required<Field<TValue>>();
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly type = input<'text' | 'email' | 'password' | 'number'>('text');
  readonly autocomplete = input<string>();
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
