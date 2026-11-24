/** Why a sign-up, log-in or password change did not succeed. */
export type AuthFailure =
  | 'invalid-credentials'
  | 'wrong-current-password'
  | 'not-logged-in'
  | 'username-taken'
  | 'too-many-attempts'
  | 'invalid-input'
  | 'unavailable';
