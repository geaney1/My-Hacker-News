import type { HnItem } from './app/models/hn-item';
import { hnStoryLists, type HnStoryList } from './app/models/hn-story-list';
import type { StoryPage } from './app/models/story-page';
import {
  BadRequestError,
  type CacheEntry,
  evictStale,
  fetchJson,
  isFresh,
  parseCount,
} from './hn-fetch';

const maxPageSize = 100;
const maxCachedItems = 2000;

const idCache = new Map<HnStoryList, CacheEntry<number[]>>();
const itemCache = new Map<number, CacheEntry<HnItem | null>>();

async function getStoryIds(list: HnStoryList) {
  const cached = idCache.get(list);
  if (isFresh(cached)) {
    return cached.value;
  }
  // A list that does not exist (e.g. "submit") comes back as null: treat it as empty.
  const ids = (await fetchJson<number[] | null>(`${list}stories.json`)) ?? [];
  idCache.set(list, { value: ids, fetchedAt: Date.now() });
  return ids;
}

/** Resolves to `null` when the item does not exist. */
export async function getItem(id: number) {
  const cached = itemCache.get(id);
  if (isFresh(cached)) {
    return cached.value;
  }
  const item = await fetchJson<HnItem | null>(`item/${id}.json`);
  evictStale(itemCache, maxCachedItems);
  itemCache.set(id, { value: item, fetchedAt: Date.now() });
  return item;
}

/** Parses the item id from a request, or throws a request error. */
export function parseItemId(idParam: unknown) {
  return parseCount(idParam, 'id');
}

/**
 * Loads one page of a story list in a single call: the ids of the list, then the stories on
 * the requested page. Results are kept for a minute so users share the Hacker News requests.
 */
export async function getStoryPage(list: string, pageParam: unknown, pageSizeParam: unknown) {
  if (!hnStoryLists.includes(list as HnStoryList)) {
    throw new BadRequestError(`Unknown story list: ${list}`);
  }
  const page = parseCount(pageParam ?? 1, 'page');
  const pageSize = parseCount(pageSizeParam ?? 20, 'pageSize');
  if (pageSize > maxPageSize) {
    throw new BadRequestError(`pageSize must be at most ${maxPageSize}`);
  }

  const ids = await getStoryIds(list as HnStoryList);
  const start = (page - 1) * pageSize;
  const results = await Promise.allSettled(ids.slice(start, start + pageSize).map(getItem));

  // A story that failed to load is left out instead of failing the whole page.
  const stories = results
    .filter((result): result is PromiseFulfilledResult<HnItem | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((item): item is HnItem => item !== null && !item.deleted && !item.dead);

  return { total: ids.length, stories } satisfies StoryPage;
}
