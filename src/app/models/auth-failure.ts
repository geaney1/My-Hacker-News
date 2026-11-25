/** Why creating a user, logging in or changing a password did not succeed. */
export type AuthFailure =
  | 'invalid-credentials'
  | 'wrong-current-password'
  | 'not-logged-in'
  | 'username-taken'
  | 'too-many-attempts'
  | 'invalid-input'
  | 'unavailable';
