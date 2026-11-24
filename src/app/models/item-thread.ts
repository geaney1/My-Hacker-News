import { HnComment } from './hn-comment';
import { HnItem } from './hn-item';

/** A story (or any item) with its comment tree. */
export type ItemThread = {
  item: HnItem;
  comments: HnComment[];
  /** For a poll, its options in display order. Empty for every other kind of item. */
  pollOptions: HnItem[];
  /** `true` when the item has more comments than were loaded. */
  truncated: boolean;
};
