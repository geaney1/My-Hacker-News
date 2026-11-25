import type { HnComment } from './app/models/hn-comment';
import type { ItemThread } from './app/models/item-thread';
import { getLocalComments } from './comments-store';
import { getItem } from './stories-proxy';
import { anonymousViewer } from './viewer';
import type { LoadState } from './models/load-state';
import type { Viewer } from './models/viewer';

/** The most comments loaded for one thread, so a huge discussion cannot flood the server. */
const maxComments = 200;

/** Loads the replies for `ids`, and theirs in turn, until the comment budget is used up. */
async function loadReplies(ids: number[] | undefined, state: LoadState) {
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
    // Deleted comments, and ones that failed to load, are left out, and so are dead ones unless
    // the viewer has Show Dead turned on.
    if (item && !item.deleted && (!item.dead || state.showDead)) {
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
async function loadPollOptions(partIds: number[] | undefined, showDead: boolean) {
  const results = await Promise.allSettled((partIds ?? []).map(getItem));
  return results.flatMap((result) =>
    result.status === 'fulfilled' &&
    result.value &&
    !result.value.deleted &&
    (!result.value.dead || showDead)
      ? [result.value]
      : [],
  );
}

/**
 * An item with its comments. Dead ones are included only for a viewer with Show Dead, and a
 * comment written in this app is hidden from everyone but its author for the author's Delay.
 * Resolves to `null` when the item does not exist.
 */
export async function getThread(id: number, viewer: Viewer = anonymousViewer) {
  const item = await getItem(id);
  if (!item) {
    return null;
  }
  const state: LoadState = { remaining: maxComments, truncated: false, showDead: viewer.showDead };
  const [comments, pollOptions, localComments] = await Promise.all([
    loadReplies(item.kids, state),
    loadPollOptions(item.parts, viewer.showDead),
    // Comments written in this app, on a story that was submitted in this app.
    getLocalComments(item.id, viewer.username),
  ]);
  return {
    item: localComments.length ? { ...item, descendants: localComments.length } : item,
    comments: [...localComments, ...comments],
    pollOptions,
    truncated: state.truncated,
  } satisfies ItemThread;
}
