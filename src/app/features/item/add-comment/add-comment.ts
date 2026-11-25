import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { CommentsApi } from '../../../core/api/comments-api';
import { AuthStore } from '../../../core/auth/auth.store';
import { NewCommentsStore } from '../../../core/comments/new-comments.store';
import { StoriesStore } from '../../stories/stories.store';
import { isLocalStoryId } from '../../../models/local-item-ids';
import { NewCommentModel } from '../../../models/new-comment-model';
import { Banner } from '../../../shared/banner/banner';

/**
 * The box for writing a comment on a story. (When nobody is logged in the page shows a prompt to
 * log in instead, beside the comment count.) Where the comment goes depends on the story: on one
 * submitted in this app it is saved on this app's server; on a Hacker News story it is only kept
 * in memory, as Hacker News cannot be written to.
 *
 * Anything put inside the component (the page's Back button) is shown to the left of "Add comment",
 * or on its own when nobody is logged in and there is no comment box.
 */
@Component({
  selector: 'app-add-comment',
  imports: [Banner, FormField, NgTemplateOutlet],
  templateUrl: './add-comment.html',
  styleUrl: './add-comment.scss',
})
export class AddComment {
  private readonly commentsApi = inject(CommentsApi);
  private readonly newCommentsStore = inject(NewCommentsStore);
  private readonly authStore = inject(AuthStore);
  private readonly storiesStore = inject(StoriesStore);

  /** The story the comment is for. */
  readonly itemId = input.required<number>();

  /** Emitted once a comment has been saved on the server, so the page can load the story again. */
  readonly saved = output();

  protected readonly login = this.authStore.login;

  /** `true` for a story that was submitted in this app, whose comments are saved on the server. */
  protected readonly isLocalStory = computed(() => isLocalStoryId(this.itemId()));

  /** Why the last attempt to save a comment failed. */
  protected readonly commentError = signal<string | undefined>(undefined);

  protected readonly newCommentModel = signal<NewCommentModel>({ text: '' });

  protected readonly newCommentForm = form(this.newCommentModel, (schemaPath) => {
    required(schemaPath.text, { message: 'Write a comment before adding it' });
    validate(schemaPath.text, ({ value }) =>
      value().length > 0 && value().trim().length === 0
        ? { kind: 'blank', message: 'Write a comment before adding it' }
        : undefined,
    );
  });

  protected async onAddComment(event: Event) {
    event.preventDefault();
    this.commentError.set(undefined);
    await submit(this.newCommentForm, async () => {
      const { text } = this.newCommentModel();
      if (this.isLocalStory()) {
        const failure = await this.commentsApi.addComment(this.itemId(), text);
        if (failure) {
          this.commentError.set(failure);
          return;
        }
        this.newCommentForm().reset({ text: '' });
        // The lists are loaded again, so the story's comment count in them is current.
        this.storiesStore.reload();
        this.saved.emit();
        return;
      }
      this.newCommentsStore.add(this.itemId(), this.authStore.username(), text);
      this.newCommentForm().reset({ text: '' });
    });
  }
}
