import type { HnUser } from './app/models/hn-user';
import { findAccount } from './accounts-store';
import { getProfile } from './profiles-store';
import { submittedItemIdsBy, toItemHtml } from './submissions-store';
import { BadRequestError, type CacheEntry, evictStale, fetchJson, isFresh } from './hn-fetch';

const maxCachedUsers = 1000;

/** Hacker News usernames are 2 to 15 letters, digits, underscores or dashes. */
const usernamePattern = /^[A-Za-z0-9_-]{2,15}$/;

const userCache = new Map<string, CacheEntry<HnUser | null>>();

/** A user of this app, shown when Hacker News has no user of that name. */
async function getLocalUser(username: string) {
  const account = await findAccount(username);
  if (!account) {
    return null;
  }
  const { about } = await getProfile(account.username);
  return {
    id: account.username,
    // Accounts made before the date was kept have none: 0 means "not known".
    created: account.createdAt ? Math.floor(account.createdAt / 1000) : 0,
    karma: 0,
    // The About box of their profile, as safe HTML. Their email is private and never sent.
    ...(about.trim() ? { about: toItemHtml(about.trim()) } : {}),
    submitted: await submittedItemIdsBy(account.username),
    local: true,
  } satisfies HnUser;
}

/**
 * Hacker News's user of that name or, when it has none, the account of that name in this app.
 * Resolves to `null` when neither exists.
 */
export async function getUser(username: string) {
  if (!usernamePattern.test(username)) {
    throw new BadRequestError(`Invalid username: ${username}`);
  }

  const cached = userCache.get(username);
  let user: HnUser | null;
  if (isFresh(cached)) {
    user = cached.value;
  } else {
    user = await fetchJson<HnUser | null>(`user/${username}.json`);
    evictStale(userCache, maxCachedUsers);
    userCache.set(username, { value: user, fetchedAt: Date.now() });
  }
  return user ?? (await getLocalUser(username));
}
