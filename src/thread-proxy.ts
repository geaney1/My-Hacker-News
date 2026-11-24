import type { HnComment } from './app/models/hn-comment';
import type { ItemThread } from './app/models/item-thread';
import { getItem } from './stories-proxy';

/** The most comments loaded for one thread, so a huge discussion cannot flood the server. */
const maxComments = 200;

type LoadState = { remaining: number; truncated: boolean };

/** Loads the replies for `ids`, and theirs in turn, until the comment budget is used up. */
async function loadReplies(ids: number[] | undefined, state: LoadState): Promise<HnComment[]> {
  if (!ids?.length) {
    return [];
  }

  const idsToLoad = ids.slice(0, state.remaining);
  state.remaining -= idsToLoad.length;
  if (idsToLoad.length < ids.length) {
    state.truncated = true;
  }

  const results = await Promise.allSettled(idsToLoad.map(getItem));
  const comments: HnComment[] = [];
  for (const result of results) {
    const item = result.status === 'fulfilled' ? result.value : null;
    // Deleted and dead comments, and ones that failed to load, are left out.
    if (item && !item.deleted && !item.dead) {
      comments.push({ ...item, replies: [] });
    }
  }

  await Promise.all(
    comments.map(async (comment) => {
      comment.replies = await loadReplies(comment.kids, state);
    }),
  );
  return comments;
}

/** The options of a poll, in the order the poll lists them. Options that fail to load are left out. */
async function loadPollOptions(partIds: number[] | undefined) {
  const results = await Promise.allSettled((partIds ?? []).map(getItem));
  return results.flatMap((result) =>
    result.status === 'fulfilled' && result.value && !result.value.deleted && !result.value.dead
      ? [result.value]
      : [],
  );
}

/** Resolves to `null` when the item does not exist. */
export async function getThread(id: number) {
  const item = await getItem(id);
  if (!item) {
    return null;
  }
  const state: LoadState = { remaining: maxComments, truncated: false };
  const [comments, pollOptions] = await Promise.all([
    loadReplies(item.kids, state),
    loadPollOptions(item.parts),
  ]);
  return { item, comments, pollOptions, truncated: state.truncated } satisfies ItemThread;
}
