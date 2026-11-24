import { HnItemType } from './hn-item-type';

/**
 * Stories, comments, jobs, Ask HNs and polls are all items.
 * Only `id` is guaranteed; every other property may be absent.
 */
export type HnItem = {
  /** The item's unique id. */
  id: number;
  /** `true` if the item is deleted. */
  deleted?: boolean;
  /** The type of item. */
  type?: HnItemType;
  /** The username of the item's author. */
  by?: string;
  /** Creation date of the item, in Unix time (seconds). */
  time?: number;
  /** The comment, story or poll text. HTML. */
  text?: string;
  /** `true` if the item is dead. */
  dead?: boolean;
  /** The comment's parent: either another comment or the relevant story. */
  parent?: number;
  /** The pollopt's associated poll. */
  poll?: number;
  /** The ids of the item's comments, in ranked display order. */
  kids?: number[];
  /** The URL of the story. */
  url?: string;
  /** The story's score, or the votes for a pollopt. */
  score?: number;
  /** The title of the story, poll or job. HTML. */
  title?: string;
  /** A list of related pollopts, in display order. */
  parts?: number[];
  /** For stories or polls, the total comment count. */
  descendants?: number;
};
