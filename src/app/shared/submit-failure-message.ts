import { SubmitFailure } from '../models/submit-failure';

const messages: Record<SubmitFailure, string> = {
  'invalid-input': 'Check the title and link and try again',
  'not-logged-in': 'Your session has ended. Log in again to continue.',
  'limit-reached': 'You have submitted as many stories as are allowed',
  'too-many-attempts': 'Too many attempts. Try again in a minute.',
  unavailable: 'Something went wrong. Please try again.',
};

/** The text shown to the user when a story could not be saved. */
export function submitFailureMessage(failure: SubmitFailure) {
  return messages[failure];
}
