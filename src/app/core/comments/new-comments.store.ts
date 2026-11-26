import { inject, Service, signal } from '@angular/core';
import { HeldComment } from '../../models/held-comment';
import { HnComment } from '../../models/hn-comment';
import { AuthStore } from '../auth/auth.store';

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Turns what the user typed into the HTML that Hacker News uses for comment text. */
function toCommentHtml(text: string) {
  return text
    .trim()
    .replace(/[&<>"']/g, (character) => htmlEscapes[character])
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, '<br>'))
    .join('<p>');
}

/** The longest a browser's timer can wait: about 24 days. A longer one would end at once. */
const longestTimerMilliseconds = 2 ** 31 - 1;

/**
 * Comments written on a Hacker News story. The Hacker News API is read-only, so they are only
 * kept in the browser's memory until the page is reloaded: they are not posted to Hacker News or
 * saved on this app's server.
 */
@Service()
export class NewCommentsStore {
  private readonly authStore = inject(AuthStore);

  private readonly commentsByItem = signal<ReadonlyMap<number, readonly HeldComment[]>>(new Map());

  /** Local comments get negative ids, so they can never clash with a real Hacker News id. */
  private nextId = -1;

  /**
   * The comments written for an item that whoever is looking may see, newest first. A comment still
   * inside its author's Delay is only included for the author.
   */
  forItem(itemId: number) {
    const viewer = this.authStore.username();
    return (this.commentsByItem().get(itemId) ?? [])
      .filter((held) => !held.isHeld || held.comment.by === viewer)
      .map((held) => held.comment);
  }

  /** Adds a comment. Other people see it once `delayMinutes` (the author's Delay) have passed. */
  add(itemId: number, author: string, text: string, delayMinutes = 0) {
    const comment: HnComment = {
      id: this.nextId--,
      type: 'comment',
      by: author,
      time: Math.floor(Date.now() / 1000),
      text: toCommentHtml(text),
      parent: itemId,
      replies: [],
    };
    const isHeld = delayMinutes > 0;
    this.commentsByItem.update((comments) =>
      new Map(comments).set(itemId, [{ comment, isHeld }, ...(comments.get(itemId) ?? [])]),
    );
    if (isHeld) {
      // A reload empties the store long before the longest timer ends.
      const wait = Math.min(delayMinutes * 60 * 1000, longestTimerMilliseconds);
      setTimeout(() => this.release(itemId, comment.id), wait);
    }
  }

  /** Lets everyone see a comment whose Delay has passed. */
  private release(itemId: number, commentId: number) {
    this.commentsByItem.update((comments) =>
      new Map(comments).set(
        itemId,
        (comments.get(itemId) ?? []).map((held) =>
          held.comment.id === commentId ? { ...held, isHeld: false } : held,
        ),
      ),
    );
  }
}
