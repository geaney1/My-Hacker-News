import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  resource,
  signal,
} from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { HnApi } from '../../../core/api/hn-api';
import { AuthStore } from '../../../core/auth/auth.store';
import { NewCommentsStore } from '../../../core/comments/new-comments.store';
import { ResponseStatus } from '../../../core/response-status';
import { HnItem } from '../../../models/hn-item';
import { NewCommentModel } from '../../../models/new-comment-model';
import { TimeAgoPipe } from '../../../shared/time-ago.pipe';
import { StoryComment } from '../story-comment/story-comment';

@Component({
  selector: 'app-item-page',
  imports: [FormField, RouterLink, StoryComment, TimeAgoPipe],
  templateUrl: './item-page.html',
  styleUrl: './item-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemPage {
  private readonly hnApi = inject(HnApi);
  private readonly location = inject(Location);
  private readonly responseStatus = inject(ResponseStatus);
  private readonly newCommentsStore = inject(NewCommentsStore);
  protected readonly authStore = inject(AuthStore);

  /** The item id from the URL (`/item/:id`), bound from the route parameter. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly thread = resource({
    params: () => this.id(),
    loader: ({ params }) => this.hnApi.getThread(params),
  });

  /** Comments written in this app for this story, shown above the loaded ones. */
  protected readonly newComments = computed(() => this.newCommentsStore.forItem(this.id()));

  protected readonly newCommentModel = signal<NewCommentModel>({ text: '' });

  protected readonly newCommentForm = form(this.newCommentModel, (schemaPath) => {
    required(schemaPath.text, { message: 'Write a comment before adding it' });
    validate(schemaPath.text, ({ value }) =>
      value().length > 0 && value().trim().length === 0
        ? { kind: 'blank', message: 'Write a comment before adding it' }
        : undefined,
    );
  });

  constructor() {
    // An item that does not exist is a 404, not a successful page.
    effect(() => {
      if (this.thread.value() === null) {
        this.responseStatus.setNotFound();
      }
    });
  }

  protected async onAddComment(event: Event) {
    event.preventDefault();
    await submit(this.newCommentForm, async () => {
      this.newCommentsStore.add(this.id(), this.authStore.username(), this.newCommentModel().text);
      this.newCommentForm().reset({ text: '' });
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
