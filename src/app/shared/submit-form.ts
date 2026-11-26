import { WritableSignal } from '@angular/core';
import { FieldTree, TreeValidationResult } from '@angular/forms/signals';

/**
 * What submitting does, for the `submission` option of the forms behind the Update, Log in, Submit
 * and Change password buttons: the button is always available. When something is wrong, every
 * field's message is shown (and read out by a screen reader), and the keyboard focus goes to the
 * first field that needs fixing, so nobody is left with a button that does nothing and no word on
 * why (WCAG 3.3.1 and 3.3.3). Either way, the message about the last attempt is cleared first.
 */
export function submissionOrFocusProblem(
  formError: WritableSignal<string | undefined>,
  action: () => Promise<TreeValidationResult>,
) {
  return {
    action: () => {
      formError.set(undefined);
      return action();
    },
    onInvalid: <TModel>(form: FieldTree<TModel>) => {
      formError.set(undefined);
      form().errorSummary()[0]?.fieldTree().focusBoundControl();
    },
  };
}
