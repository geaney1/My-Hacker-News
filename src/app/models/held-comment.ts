import { HnComment } from './hn-comment';

/** A comment written on a Hacker News story, and whether its author's Delay still holds it back. */
export type HeldComment = {
  comment: HnComment;
  /** `true` until the Delay has passed: only the author is shown the comment. */
  isHeld: boolean;
};
