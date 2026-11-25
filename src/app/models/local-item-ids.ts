/**
 * Stories submitted in this app have ids from here up, and comments written on them from the
 * comment base up. Hacker News ids are far below both, so they never clash.
 */
export const localItemIdBase = 2_000_000_000;
export const localCommentIdBase = 3_000_000_000;

/** `true` for a story (or question) that was submitted in this app rather than on Hacker News. */
export const isLocalStoryId = (id: number) => id > localItemIdBase && id < localCommentIdBase;
