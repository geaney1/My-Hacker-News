export type Account = {
  /** The username as the user typed it when they created the account. */
  username: string;
  salt: string;
  hash: string;
  /** When the account was made, in Unix milliseconds. Accounts made before this was kept have none. */
  createdAt?: number;
};
