/** Why a story was not saved. */
export type SubmitFailure =
  | 'invalid-input'
  | 'not-logged-in'
  | 'limit-reached'
  | 'too-many-attempts'
  | 'unavailable';
