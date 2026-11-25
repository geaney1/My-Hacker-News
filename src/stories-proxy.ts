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
import { countLocalComments } from './comments-store';
import { mergeByTime } from './list-merge';
import { getSubmittedItem, submittedStories } from './submissions-store';

const maxPageSize = 100;
const maxCachedItems = 2000;

const idCache = new Map<HnStoryList, CacheEntry<number[]>>();
const itemCache = new Map<number, CacheEntry<HnItem | null>>();

async function getStoryIds(list: HnStoryList) {
  const cached = idCache.get(list);
  if (isFresh(cached)) {
    return cached.value;
  }
  // Hacker News answers null for a list that has nothing in it: treat that as empty.
  const ids = (await fetchJson<number[] | null>(`${list}stories.json`)) ?? [];
  idCache.set(list, { value: ids, fetchedAt: Date.now() });
  return ids;
}

/** Resolves to `null` when the item does not exist. */
export async function getItem(id: number) {
  // A story submitted in this app is kept here, not on Hacker News.
  const submitted = await getSubmittedItem(id);
  if (submitted) {
    // Its comments are written in this app too, so they are counted here.
    return { ...submitted, descendants: await countLocalComments(id) };
  }
  const cached = itemCache.get(id);
  if (isFresh(cached)) {
    return cached.value;
  }
  const item = await fetchJson<HnItem | null>(`item/${id}.json`);
  evictStale(itemCache, maxCachedItems);
  itemCache.set(id, { value: item, fetchedAt: Date.now() });
  return item;
}

/** When a Hacker News story was made, or `undefined` if it cannot be loaded or has no time. */
async function timeOfItem(id: number) {
  try {
    return (await getItem(id))?.time;
  } catch {
    return undefined;
  }
}

/**
 * Loads one page of a story list in a single call: the ids of the list, then the stories on
 * the requested page. Results are kept for a minute so users share the Hacker News requests.
 * Dead stories are left out unless the viewer has Show Dead turned on.
 */
export async function getStoryPage(
  list: string,
  pageParam: unknown,
  pageSizeParam: unknown,
  options: { showDead?: boolean } = {},
) {
  if (!hnStoryLists.includes(list as HnStoryList)) {
    throw new BadRequestError(`Unknown story list: ${list}`);
  }
  const page = parseCount(pageParam ?? 1, 'page');
  const pageSize = parseCount(pageSizeParam ?? 20, 'pageSize');
  if (pageSize > maxPageSize) {
    throw new BadRequestError(`pageSize must be at most ${maxPageSize}`);
  }

  // Stories submitted in this app are placed among the Hacker News ones by when they were made:
  // stories under "new" and questions under "ask".
  const hackerNewsIds = await getStoryIds(list as HnStoryList);
  const submitted =
    list === 'new' ? await submittedStories('story') : list === 'ask' ? await submittedStories('question') : [];
  const ids = await mergeByTime(hackerNewsIds, submitted, list === 'new' ? 'newest-first' : 'ranked', timeOfItem);
  const start = (page - 1) * pageSize;
  const results = await Promise.allSettled(ids.slice(start, start + pageSize).map(getItem));

  // A story that failed to load is left out instead of failing the whole page.
  const stories = results
    .filter((result): result is PromiseFulfilledResult<HnItem | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((item): item is HnItem => item !== null && !item.deleted && (!item.dead || !!options.showDead));

  return { total: ids.length, stories } satisfies StoryPage;
}

/** Parses the item id from a request, or throws a request error. */
export function parseItemId(idParam: unknown) {
  return parseCount(idParam, 'id');
}
