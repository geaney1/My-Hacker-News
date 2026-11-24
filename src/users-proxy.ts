import type { HnUser } from './app/models/hn-user';
import { BadRequestError, type CacheEntry, evictStale, fetchJson, isFresh } from './hn-fetch';

const maxCachedUsers = 1000;

/** Hacker News usernames are 2 to 15 letters, digits, underscores or dashes. */
const usernamePattern = /^[A-Za-z0-9_-]{2,15}$/;

const userCache = new Map<string, CacheEntry<HnUser | null>>();

/** Resolves to `null` when the user does not exist or has no public activity. */
export async function getUser(username: string) {
  if (!usernamePattern.test(username)) {
    throw new BadRequestError(`Invalid username: ${username}`);
  }

  const cached = userCache.get(username);
  if (isFresh(cached)) {
    return cached.value;
  }
  const user = await fetchJson<HnUser | null>(`user/${username}.json`);
  evictStale(userCache, maxCachedUsers);
  userCache.set(username, { value: user, fetchedAt: Date.now() });
  return user;
}
