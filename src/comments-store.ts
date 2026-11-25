import type { HnComment } from './app/models/hn-comment';
import { isLocalStoryId, localCommentIdBase } from './app/models/local-item-ids';
import { nextId } from './counters-store';
import { createJsonStore } from './json-store';
import { BadRequestError } from './hn-fetch';
import { getSubmittedItem, toItemHtml } from './submissions-store';

const maxCommentLength = 2000;

/** The most comments one user can have written, so nobody can fill the disk. */
const maxCommentsPerUser = 500;

type StoredComment = {
  id: number;
  /** The story (or question) submitted in this app that the comment is on. */
  itemId: number;
  username: string;
  /** What the user typed. It is turned into safe HTML only when shown. */
  text: string;
  submittedAt: number;
  /**
   * When other people can see it: the time it was written plus the author's Delay. The author
   * always sees it. Comments saved before Delay was used have none, and are visible.
   */
  visibleAt?: number;
};

/** Thrown when the story does not exist in this app, so it cannot have comments written here. */
export class NoSuchStoryError extends Error {}

/** Thrown when a user has written as many comments as they are allowed. */
export class TooManyCommentsError extends Error {}

const commentsStore = createJsonStore<StoredComment[]>({ file: 'comments.json', empty: () => [] });

const loadComments = () => commentsStore.load();

function toComment(comment: StoredComment): HnComment {
  return {
    id: comment.id,
    type: 'comment',
    by: comment.username,
    time: Math.floor(comment.submittedAt / 1000),
    text: toItemHtml(comment.text),
    parent: comment.itemId,
    replies: [],
  };
}

/**
 * The comments written in this app on a submitted story, newest first. Empty for any other item.
 * A comment still inside its author's Delay is only included for the author, `viewer`.
 */
export async function getLocalComments(itemId: number, viewer?: string) {
  if (!isLocalStoryId(itemId)) {
    return [];
  }
  const now = Date.now();
  return (await loadComments())
    .filter((comment) => comment.itemId === itemId)
    .filter(
      (comment) =>
        (comment.visibleAt ?? comment.submittedAt) <= now || comment.username === viewer,
    )
    .sort((first, second) => second.submittedAt - first.submittedAt)
    .map(toComment);
}

/** How many comments have been written in this app on a story. 0 for any other item. */
export async function countLocalComments(itemId: number) {
  return (await getLocalComments(itemId)).length;
}

/**
 * Saves a comment by `username` on a story submitted in this app. Other people see it once
 * `delaySeconds` (the author's Delay) have passed.
 */
export async function addLocalComment(
  username: string,
  itemId: number,
  textInput: unknown,
  delaySeconds = 0,
) {
  if (typeof textInput !== 'string' || textInput.trim() === '') {
    throw new BadRequestError('Write a comment before adding it');
  }
  const text = textInput.trim();
  if (text.length > maxCommentLength) {
    throw new BadRequestError(`A comment can be at most ${maxCommentLength} characters`);
  }
  if (!(await getSubmittedItem(itemId))) {
    throw new NoSuchStoryError();
  }

  const comments = await loadComments();
  if (comments.filter((comment) => comment.username === username).length >= maxCommentsPerUser) {
    throw new TooManyCommentsError();
  }
  const now = Date.now();
  const comment: StoredComment = {
    // From a counter, not the length of the list, so an id is never used twice.
    id: await nextId(
      'comment',
      comments.reduce((highest, existing) => Math.max(highest, existing.id), localCommentIdBase),
    ),
    itemId,
    username,
    text,
    submittedAt: now,
    visibleAt: now + delaySeconds * 1000,
  };
  comments.push(comment);
  await commentsStore.save(comments);
  return toComment(comment);
}
