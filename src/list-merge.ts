/** A story submitted in this app, as far as placing it in a list goes. */
type LocalEntry = { id: number; time: number };

/** Finds when a Hacker News story was made, in Unix seconds, or `undefined` if that is not known. */
export type TimeOf = (id: number) => Promise<number | undefined>;

/**
 * How the Hacker News list is ordered. "newest-first" is strictly by time (New). "ranked" is by
 * Hacker News's own ranking, which only roughly follows time (Ask).
 */
type ListOrder = 'newest-first' | 'ranked';

/** How far to look past a story that has no time (a deleted one) for one that does. */
const probeLimit = 5;

/** How many stories to look at at once while scanning a ranked list. */
const scanBatch = 20;

async function timeAround(ids: number[], index: number, timeOf: TimeOf) {
  for (let probe = index; probe < Math.min(ids.length, index + probeLimit); probe++) {
    const time = await timeOf(ids[probe]);
    if (time !== undefined) {
      return time;
    }
  }
  return undefined;
}

/**
 * Where a story made at `time` goes in a list that is newest first: after every story that is
 * newer. A binary search, so only a handful of stories need their time looked up.
 */
async function positionInNewestFirst(ids: number[], time: number, timeOf: TimeOf) {
  let low = 0;
  let high = ids.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    const middleTime = await timeAround(ids, middle, timeOf);
    if (middleTime !== undefined && middleTime > time) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/**
 * Where a story made at `time` goes in a ranked list: before the first story that is older. The
 * list is not sorted by time, so it is scanned from the top, a few stories at a time.
 */
async function positionInRanked(ids: number[], time: number, timeOf: TimeOf) {
  for (let start = 0; start < ids.length; start += scanBatch) {
    const times = await Promise.all(ids.slice(start, start + scanBatch).map(timeOf));
    const older = times.findIndex((candidate) => candidate !== undefined && candidate <= time);
    if (older >= 0) {
      return start + older;
    }
  }
  return ids.length;
}

/**
 * Puts the stories submitted in this app into a Hacker News list by when they were made, so they
 * sit among the Hacker News stories of the same age instead of all being first. Stories submitted
 * here keep their own order (newest first). The list given is not changed.
 */
export async function mergeByTime(
  hackerNewsIds: number[],
  local: LocalEntry[],
  order: ListOrder,
  timeOf: TimeOf,
) {
  if (local.length === 0) {
    return hackerNewsIds;
  }

  const newestFirst = [...local].sort((first, second) => second.time - first.time);
  const place = order === 'newest-first' ? positionInNewestFirst : positionInRanked;

  // A story submitted earlier never goes above one submitted later.
  const positions: number[] = [];
  let lowest = 0;
  for (const entry of newestFirst) {
    lowest = Math.max(lowest, await place(hackerNewsIds, entry.time, timeOf));
    positions.push(lowest);
  }

  const merged: number[] = [];
  let next = 0;
  hackerNewsIds.forEach((id, index) => {
    while (next < newestFirst.length && positions[next] <= index) {
      merged.push(newestFirst[next++].id);
    }
    merged.push(id);
  });
  while (next < newestFirst.length) {
    merged.push(newestFirst[next++].id);
  }
  return merged;
}
