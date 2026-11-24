import { Injectable, signal } from '@angular/core';
import { HnComment } from '../../models/hn-comment';

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

/**
 * Comments written in this app. The Hacker News API is read-only and there is no backend yet,
 * so they are only kept in memory for the current session: they are not posted anywhere and
 * disappear when the page is reloaded.
 */
@Injectable({ providedIn: 'root' })
export class NewCommentsStore {
  private readonly commentsByItem = signal<ReadonlyMap<number, readonly HnComment[]>>(new Map());

  /** Local comments get negative ids, so they can never clash with a real Hacker News id. */
  private nextId = -1;

  /** The comments written for an item, newest first. */
  forItem(itemId: number) {
    return this.commentsByItem().get(itemId) ?? [];
  }

  add(itemId: number, author: string, text: string) {
    const comment: HnComment = {
      id: this.nextId--,
      type: 'comment',
      by: author,
      time: Math.floor(Date.now() / 1000),
      text: toCommentHtml(text),
      parent: itemId,
      replies: [],
    };
    this.commentsByItem.update((comments) =>
      new Map(comments).set(itemId, [comment, ...(comments.get(itemId) ?? [])]),
    );
  }
}
