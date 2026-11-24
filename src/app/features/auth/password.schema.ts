import { maxLength, minLength, required, schema } from '@angular/forms/signals';

/** Password rules shared by the log-in and create-user forms: 8 to 72 characters. */
export const passwordSchema = schema<string>((password) => {
  required(password, { message: 'Password is required' });
  minLength(password, 8, { message: 'Password must be at least 8 characters' });
  maxLength(password, 72, { message: 'Password must be at most 72 characters' });
});
