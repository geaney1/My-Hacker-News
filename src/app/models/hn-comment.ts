import { HnItem } from './hn-item';

/** A comment together with the replies that were loaded for it. */
export type HnComment = HnItem & { replies: HnComment[] };
