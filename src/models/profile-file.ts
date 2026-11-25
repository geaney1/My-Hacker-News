import type { Profile } from './profile';

/** Profiles by lower-case username, so `Anna` and `anna` are the same person. */
export type ProfileFile = Record<string, Profile>;
