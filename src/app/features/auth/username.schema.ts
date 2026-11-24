import { maxLength, minLength, pattern, required, schema } from '@angular/forms/signals';

/**
 * Username rules shared by the log-in and create-user forms:
 * letters, digits, dashes and underscores only, 2 to 15 characters.
 */
export const usernameSchema = schema<string>((username) => {
  required(username, { message: 'Username is required' });
  pattern(username, /^[A-Za-z0-9_-]+$/, {
    message: 'Username can only contain letters, digits, dashes and underscores',
  });
  minLength(username, 2, { message: 'Username must be at least 2 characters' });
  maxLength(username, 15, { message: 'Username must be at most 15 characters' });
});
