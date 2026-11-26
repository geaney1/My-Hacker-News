export type Profile = {
  about: string;
  email: string;
  showdead: 'yes' | 'no';
  noprocrast: 'yes' | 'no';
  maxvisit: number;
  minaway: number;
  /** How many minutes the user's new comments are held back from other people. */
  delay: number;
};
