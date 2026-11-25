export type Visit = {
  /** When the current visit started, or 0 when there is none. */
  visitStart: number;
  /** The last time the app was open. */
  lastSeen: number;
  /** The user is shut out until then, or 0. */
  lockedUntil: number;
};
