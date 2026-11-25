import { Location, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HnApi } from '../../../core/api/hn-api';
import { AuthStore } from '../../../core/auth/auth.store';
import { NewCommentsStore } from '../../../core/comments/new-comments.store';
import { ResponseStatus } from '../../../core/response-status';
import { HnItem } from '../../../models/hn-item';
import { TimeAgoPipe } from '../../../shared/time-ago.pipe';
import { AddComment } from '../add-comment/add-comment';
import { StoryComment } from '../story-comment/story-comment';
import { Banner } from '../../../shared/banner/banner';

@Component({
  selector: 'app-item-page',
  imports: [Banner, AddComment, NgTemplateOutlet, RouterLink, StoryComment, TimeAgoPipe],
  templateUrl: './item-page.html',
  styleUrl: './item-page.scss',
})
export class ItemPage {
  private readonly hnApi = inject(HnApi);
  private readonly location = inject(Location);
  private readonly responseStatus = inject(ResponseStatus);
  private readonly newCommentsStore = inject(NewCommentsStore);
  protected readonly login = inject(AuthStore).login;

  /** The item id from the URL (`/item/:id`), bound from the route parameter. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly thread = resource({
    params: () => this.id(),
    loader: ({ params }) => this.hnApi.getThread(params),
  });

  /** Comments written on this page for this Hacker News story (lost on reload), shown above the loaded ones. */
  protected readonly newComments = computed(() => this.newCommentsStore.forItem(this.id()));

  constructor() {
    // An item that does not exist is a 404, not a successful page.
    effect(() => {
      if (this.thread.value() === null) {
        this.responseStatus.setNotFound();
      }
    });
  }

  /** An option's share of all the votes in its poll, as a percentage. */
  protected votePercent(option: HnItem, options: HnItem[]) {
    const totalVotes = options.reduce((total, current) => total + (current.score ?? 0), 0);
    return totalVotes === 0 ? 0 : ((option.score ?? 0) / totalVotes) * 100;
  }

  protected goBack() {
    this.location.back();
  }
}
