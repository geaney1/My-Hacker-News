import type { Account } from './account';

/** Accounts by lower-case username, so `Anna` and `anna` are the same person. */
export type AccountFile = Record<string, Account>;
