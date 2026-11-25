import { Component, computed, inject, signal } from '@angular/core';
import { form, maxLength, required, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { SubmissionsApi } from '../../core/api/submissions-api';
import { SubmitStoryModel } from '../../models/submit-story-model';
import { AuthCard } from '../../shared/auth-card/auth-card';
import { FormTextArea } from '../../shared/form-text-area/form-text-area';
import { FormTextField } from '../../shared/form-text-field/form-text-field';
import { submitFailureMessage } from '../../shared/submit-failure-message';
import { StoriesStore } from '../stories/stories.store';
import { isWebAddress, maxTextLength, maxTitleLength, maxUrlLength } from './submit-rules';
import { Banner } from '../../shared/banner/banner';
import { submitOrFocusProblem } from '../../shared/submit-form';

/**
 * The "Submit" dialog: a title, and a link and/or text, checked here and saved on this app's server.
 * Leaving the link blank submits a question for discussion.
 */
@Component({
  selector: 'app-submit-story',
  imports: [Banner, AuthCard, FormTextArea, FormTextField],
  templateUrl: './submit-story.html',
  styleUrl: '../../shared/auth-form.scss',
})
export class SubmitStory {
  private readonly router = inject(Router);
  private readonly storiesStore = inject(StoriesStore);
  private readonly submissionsApi = inject(SubmissionsApi);

  protected readonly maxTitleLength = maxTitleLength;
  protected readonly maxTextLength = maxTextLength;

  /** Why the last attempt failed, shown above the button. */
  protected readonly formError = signal<string | undefined>(undefined);

  protected readonly submitModel = signal<SubmitStoryModel>({ title: '', url: '', text: '' });

  protected readonly submitForm = form(this.submitModel, (schemaPath) => {
    required(schemaPath.title, { message: 'A title is required' });
    validate(schemaPath.title, ({ value }) =>
      value().length > 0 && value().trim().length === 0
        ? { kind: 'blank', message: 'A title is required' }
        : undefined,
    );
    maxLength(schemaPath.title, maxTitleLength, {
      message: `A title can be at most ${maxTitleLength} characters`,
    });

    // The link can be left out to ask a question for discussion.
    validate(schemaPath.url, ({ value }) =>
      value().trim() === '' || isWebAddress(value())
        ? undefined
        : { kind: 'invalidUrl', message: 'Enter a full web address that starts with http:// or https://' },
    );
    maxLength(schemaPath.url, maxUrlLength, {
      message: `A link can be at most ${maxUrlLength} characters`,
    });

    // Without a link, the text is the question, and appears at the top of the thread.
    validate(schemaPath.text, ({ value, valueOf }) =>
      valueOf(schemaPath.url).trim() === '' && value().trim() === ''
        ? { kind: 'textOrLink', message: 'Add a link, or text to start a discussion' }
        : undefined,
    );
    maxLength(schemaPath.text, maxTextLength, {
      message: `The text can be at most ${maxTextLength} characters`,
    });
  });

  /** Without a link the submission is a question for discussion; with one, it is a story. */
  protected readonly isQuestion = computed(() => this.submitModel().url.trim() === '');

  /** The text is only optional when there is a link. */
  protected readonly textLabel = computed(() =>
    this.submitModel().url.trim() === '' ? 'Text' : 'Text (optional)',
  );

  protected readonly textHint = computed(() =>
    this.submitModel().url.trim() === ''
      ? `Your question, at the top of the discussion. At most ${maxTextLength} characters.`
      : `Optional. At most ${maxTextLength} characters.`,
  );

  protected async onSubmit(event: Event) {
    event.preventDefault();
    this.formError.set(undefined);
    await submitOrFocusProblem(this.submitForm, async () => {
      const { title, url, text } = this.submitModel();
      const failure = await this.submissionsApi.submitStory(title.trim(), url.trim(), text.trim());
      if (failure) {
        this.formError.set(submitFailureMessage(failure));
        return;
      }
      // The lists are loaded again, so the new story is in them.
      this.storiesStore.reload();
      await this.router.navigateByUrl(`/${this.storiesStore.selectedList()}`);
    });
  }
}
