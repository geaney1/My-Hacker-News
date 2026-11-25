import { FieldTree, submit, TreeValidationResult } from '@angular/forms/signals';

/**
 * Submits a form the way the Update, Log in, Submit and Change password buttons do: the button is
 * always available. When something is wrong, every field's message is shown (and read out by a
 * screen reader), and the keyboard focus goes to the first field that needs fixing, so nobody is
 * left with a button that does nothing and no word on why (WCAG 3.3.1 and 3.3.3).
 */
export function submitOrFocusProblem<TModel>(form: FieldTree<TModel>, action: () => Promise<TreeValidationResult>) {
  return submit(form, {
    action,
    onInvalid: () => form().errorSummary()[0]?.fieldTree().focusBoundControl(),
  });
}
