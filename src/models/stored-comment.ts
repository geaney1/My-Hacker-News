export type StoredComment = {
  id: number;
  /** The story (or question) submitted in this app that the comment is on. */
  itemId: number;
  username: string;
  /** What the user typed. It is turned into safe HTML only when shown. */
  text: string;
  submittedAt: number;
  /**
   * When other people can see it: the time it was written plus the author's Delay. The author
   * always sees it. Comments saved before Delay was used have none, and are visible.
   */
  visibleAt?: number;
};
