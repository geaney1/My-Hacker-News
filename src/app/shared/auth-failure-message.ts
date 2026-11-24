import { AuthFailure } from '../models/auth-failure';

const messages: Record<AuthFailure, string> = {
  'invalid-credentials': 'Incorrect username or password',
  'wrong-current-password': 'The current password is incorrect',
  'not-logged-in': 'Your session has ended. Log in again to continue.',
  'username-taken': 'That username is already taken',
  'too-many-attempts': 'Too many attempts. Try again in a minute.',
  'invalid-input': 'Check what you entered and try again',
  unavailable: 'Something went wrong. Please try again.',
};

/** The text shown to the user for a failed sign-up, log-in or password change. */
export function authFailureMessage(failure: AuthFailure) {
  return messages[failure];
}
