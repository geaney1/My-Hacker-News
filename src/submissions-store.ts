import { randomUUID } from 'node:crypto';
import type { HnItem } from './app/models/hn-item';
import { localItemIdBase } from './app/models/local-item-ids';
import { BadRequestError } from './hn-fetch';
import { nextId } from './counters-store';
import { createJsonStore } from './json-store';
import type { SubmissionKind } from './models/submission-kind';
import type { Submission } from './models/submission';

export const maxTitleLength = 80;
export const maxUrlLength = 2000;
export const maxTextLength = 2000;

export { localItemIdBase };

/** The most stories one user can have saved, so nobody can fill the disk. */
const maxSubmissionsPerUser = 200;

/** Thrown when a user has saved as many stories as they are allowed. */
export class TooManySubmissionsError extends Error {}

const submissionsStore = createJsonStore<Submission[]>({
  file: 'submissions.json',
  empty: () => [],
  upgrade: (submissions) => {
    // Stories saved before they had item ids get one, in the order they were submitted.
    submissions.forEach((submission, index) => {
      submission.itemId ??= localItemIdBase + index + 1;
    });
  },
});

const loadSubmissions = () => submissionsStore.load();

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Turns what the user typed into the safe HTML that Hacker News uses for text. */
export function toItemHtml(text: string) {
  return text
    .replace(/[&<>"']/g, (character) => htmlEscapes[character])
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, '<br>'))
    .join('<p>');
}

/** A submission as the story lists and the story page show it. */
function toItem(submission: Submission): HnItem {
  return {
    id: submission.itemId,
    type: 'story',
    by: submission.username,
    time: Math.floor(submission.submittedAt / 1000),
    title: submission.title,
    ...(submission.url ? { url: submission.url } : {}),
    ...(submission.text ? { text: toItemHtml(submission.text) } : {}),
    score: 1,
    descendants: 0,
  };
}

/** `true` for a full web address that starts with http:// or https://. */
function isWebAddress(value: string) {
  try {
    const address = new URL(value);
    return ['http:', 'https:'].includes(address.protocol) && address.hostname !== '';
  } catch {
    return false;
  }
}

/**
 * Checks what the browser sent, and returns the trimmed fields. The title is required. The link
 * can be left out to ask a question for discussion, and then the text is required: it appears at
 * the top of the thread. With a link, the text is optional.
 */
function validateSubmission(title: unknown, url: unknown = '', text: unknown = '') {
  if (typeof title !== 'string' || typeof url !== 'string' || typeof text !== 'string') {
    throw new BadRequestError('A title is required');
  }
  const trimmedTitle = title.trim();
  const trimmedUrl = url.trim();
  if (trimmedTitle === '') {
    throw new BadRequestError('A title is required');
  }
  if (trimmedTitle.length > maxTitleLength) {
    throw new BadRequestError(`A title can be at most ${maxTitleLength} characters`);
  }
  if (trimmedUrl.length > maxUrlLength) {
    throw new BadRequestError(`A link can be at most ${maxUrlLength} characters`);
  }
  // The link can be left out, to ask a question for discussion.
  if (trimmedUrl !== '' && !isWebAddress(trimmedUrl)) {
    throw new BadRequestError('Enter a full web address that starts with http:// or https://');
  }
  const trimmedText = text.trim();
  if (trimmedText.length > maxTextLength) {
    throw new BadRequestError(`The text can be at most ${maxTextLength} characters`);
  }
  if (trimmedUrl === '' && trimmedText === '') {
    throw new BadRequestError('Add a link, or text to start a discussion');
  }
  const kind: SubmissionKind = trimmedUrl === '' ? 'question' : 'story';
  return { kind, title: trimmedTitle, url: trimmedUrl, text: trimmedText };
}

/** Saves a story for `username`. */
export async function addSubmission(
  username: string,
  title: unknown,
  url?: unknown,
  text?: unknown,
) {
  const fields = validateSubmission(title, url, text);
  const submissions = await loadSubmissions();
  if (
    submissions.filter((submission) => submission.username === username).length >=
    maxSubmissionsPerUser
  ) {
    throw new TooManySubmissionsError();
  }
  const submission: Submission = {
    id: randomUUID(),
    // From a counter, not the length of the list, so an id is never used twice.
    itemId: await nextId(
      'submission',
      submissions.reduce(
        (highest, existing) => Math.max(highest, existing.itemId),
        localItemIdBase,
      ),
    ),
    username,
    ...fields,
    submittedAt: Date.now(),
  };
  submissions.push(submission);
  await submissionsStore.save(submissions);
  return submission;
}

/**
 * The submitted stories or questions with when they were made (Unix seconds), newest first, for
 * the "new" or "ask" list.
 */
export async function submittedStories(kind: SubmissionKind) {
  const submissions = await loadSubmissions();
  return submissions
    .filter((submission) => submission.kind === kind)
    .sort((first, second) => second.submittedAt - first.submittedAt)
    .map((submission) => ({
      id: submission.itemId,
      time: Math.floor(submission.submittedAt / 1000),
    }));
}

/** The item ids of everything `username` submitted, newest first. */
export async function submittedItemIdsBy(username: string) {
  const submissions = await loadSubmissions();
  return submissions
    .filter((submission) => submission.username.toLowerCase() === username.toLowerCase())
    .sort((first, second) => second.submittedAt - first.submittedAt)
    .map((submission) => submission.itemId);
}

/** A submitted story as an item, or `null` when `id` is not one. */
export async function getSubmittedItem(id: number) {
  if (id <= localItemIdBase) {
    return null;
  }
  const submission = (await loadSubmissions()).find((candidate) => candidate.itemId === id);
  return submission ? toItem(submission) : null;
}
