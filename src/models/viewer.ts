/** Who is asking, and the parts of their profile that change what the server sends or saves. */
export type Viewer = {
  /** The logged-in user, or `undefined` for a visitor. */
  username?: string;
  /** Show Dead: dead stories and comments are included. */
  showDead: boolean;
  /** Delay: how many minutes the user's own comments stay hidden from others. */
  delayMinutes: number;
};
