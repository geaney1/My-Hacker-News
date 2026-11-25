/** Where Hacker News's API is. Set `HN_API_URL` to use another one, such as the fake one in the end-to-end tests. */
const baseUrl = process.env['HN_API_URL'] ?? 'https://hacker-news.firebaseio.com/v0';

/** How long a response from Hacker News is reused by default, so users share the requests. */
const defaultCacheMilliseconds = 60 * 1000;

export type CacheEntry<Value> = { value: Value; fetchedAt: number };

/** Thrown when a request from the browser is invalid. The server answers it with a 400. */
export class BadRequestError extends Error {}

/** `true` while a cached entry is younger than `maxAgeMilliseconds` (a minute by default). */
export function isFresh(
  entry: CacheEntry<unknown> | undefined,
  maxAgeMilliseconds = defaultCacheMilliseconds,
): entry is CacheEntry<never> {
  return entry !== undefined && Date.now() - entry.fetchedAt < maxAgeMilliseconds;
}

export async function fetchJson<Value>(path: string) {
  const response = await fetch(`${baseUrl}/${path}`);
  if (!response.ok) {
    throw new Error(`Hacker News responded with ${response.status} for ${path}`);
  }
  return (await response.json()) as Value;
}

/** Drops expired entries once a cache has grown to `maxEntries`. */
export function evictStale<Key>(cache: Map<Key, CacheEntry<unknown>>, maxEntries: number) {
  if (cache.size < maxEntries) {
    return;
  }
  for (const [key, entry] of cache) {
    if (!isFresh(entry)) {
      cache.delete(key);
    }
  }
}

/** Parses a positive whole number, or throws a request error. */
export function parseCount(value: unknown, name: string) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    throw new BadRequestError(`${name} must be a positive whole number`);
  }
  return count;
}
