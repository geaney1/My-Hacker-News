import { Component, inject, input, signal } from '@angular/core';
import { apply, form, FormRoot } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthCard } from '../../../shared/auth-card/auth-card';
import { FormTextField } from '../../../shared/form-text-field/form-text-field';
import { AuthStore } from '../../../core/auth/auth.store';
import { safeReturnUrl } from '../../../core/navigation/return-url';
import { LogInModel } from '../../../models/log-in-model';
import { authFailureMessage } from '../../../shared/auth-failure-message';
import { StoriesStore } from '../../stories/stories.store';
import { passwordSchema } from '../password.schema';
import { usernameSchema } from '../username.schema';
import { Banner } from '../../../shared/banner/banner';
import { submissionOrFocusProblem } from '../../../shared/submit-form';

@Component({
  selector: 'app-log-in',
  imports: [Banner, AuthCard, FormRoot, FormTextField, RouterLink],
  templateUrl: './log-in.html',
  styleUrl: '../../../shared/auth-form.scss',
})
export class LogIn {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly storiesStore = inject(StoriesStore);

  /** Where a page that needs a login sent the user from, bound from the `returnUrl` query parameter. */
  readonly returnUrl = input<string>();

  /** Why the last attempt failed, shown above the button. */
  protected readonly formError = signal<string | undefined>(undefined);

  protected readonly LogInModel = signal<LogInModel>({ username: '', password: '' });

  protected readonly logInForm = form(
    this.LogInModel,
    (schemaPath) => {
      apply(schemaPath.username, usernameSchema);
      apply(schemaPath.password, passwordSchema);
    },
    {
      submission: submissionOrFocusProblem(this.formError, () => this.logIn()),
    },
  );

  protected readonly showPassword = signal(false);

  protected toggleShowPassword() {
    this.showPassword.update((isShown) => !isShown);
  }

  private async logIn() {
    const { username, password } = this.LogInModel();
    const failure = await this.authStore.logIn(username, password);
    if (failure) {
      this.formError.set(authFailureMessage(failure));
      return;
    }
    // Back to the page that asked for a login, or else the story list the user last had open.
    await this.router.navigateByUrl(
      safeReturnUrl(this.returnUrl()) ?? `/${this.storiesStore.selectedList()}`,
    );
  }
}
