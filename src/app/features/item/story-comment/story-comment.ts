import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HnComment } from '../../../models/hn-comment';
import { TimeAgoPipe } from '../../../shared/time-ago.pipe';

/**
 * One comment and, nested beneath it, its replies. Each comment can be collapsed with its own
 * button. (A details element would not do: its summary cannot hold the author's link, as a link
 * inside a control is not accessible.)
 */
@Component({
  selector: 'app-story-comment',
  imports: [RouterLink, TimeAgoPipe],
  templateUrl: './story-comment.html',
  styleUrl: './story-comment.scss',
})
export class StoryComment {
  readonly comment = input.required<HnComment>();

  /** `true` while the comment's text and replies are folded away. */
  protected readonly collapsed = signal(false);

  /** What the fold button does, for screen readers: the sign alone says nothing. */
  protected readonly toggleLabel = computed(() => {
    const author = this.comment().by;
    return `${this.collapsed() ? 'Expand' : 'Collapse'} comment${author ? ` by ${author}` : ''}`;
  });

  protected toggle() {
    this.collapsed.update((isCollapsed) => !isCollapsed);
  }
}
