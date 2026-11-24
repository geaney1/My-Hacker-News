/** Response of `/v0/updates`: recently changed items and profiles. */
export type HnUpdates = {
  /** Ids of recently changed items. */
  items: number[];
  /** Usernames of recently changed profiles. */
  profiles: string[];
};
