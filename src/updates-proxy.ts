import type { HnUpdates } from './app/models/hn-updates';
import { fetchJson, isFresh } from './hn-fetch';
import type { CacheEntry } from './models/cache-entry';

/** Changes are listed for the last few minutes only, so this is kept for a short time. */
const updatesCacheMilliseconds = 15 * 1000;

let cached: CacheEntry<HnUpdates> | undefined;

/** The recently changed items and profiles. Shared by all users for a few seconds. */
export async function getUpdates() {
  if (isFresh(cached, updatesCacheMilliseconds)) {
    return cached.value;
  }
  const updates = await fetchJson<HnUpdates>('updates.json');
  cached = { value: updates, fetchedAt: Date.now() };
  return updates;
}
