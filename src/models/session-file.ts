import type { StoredSession } from './stored-session';

/**
 * Sessions by the SHA-256 hash of their ID. The ID itself is never stored, so someone who reads
 * the file cannot use it to log in as anybody.
 */
export type SessionFile = Record<string, StoredSession>;
