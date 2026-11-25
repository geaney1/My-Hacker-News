export type HnUser = {
  /** The user's unique username. Case-sensitive. */
  id: string;
  /** Creation date of the user, in Unix time (seconds). */
  created: number;
  /** The user's karma. */
  karma: number;
  /** The user's optional self-description. HTML. */
  about?: string;
  /** Ids of the user's stories, polls and comments. */
  submitted?: number[];
  /** `true` for a user of this app that Hacker News does not have. `created` is 0 when not known. */
  local?: boolean;
};
