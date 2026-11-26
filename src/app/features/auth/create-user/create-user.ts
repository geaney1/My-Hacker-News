import { Component, inject, input, signal } from '@angular/core';
import { apply, form, FormRoot, required, validate } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthCard } from '../../../shared/auth-card/auth-card';
import { FormTextField } from '../../../shared/form-text-field/form-text-field';
import { AuthStore } from '../../../core/auth/auth.store';
import { CreateUserModel } from '../../../models/create-user-model';
import { authFailureMessage } from '../../../shared/auth-failure-message';
import { passwordSchema } from '../password.schema';
import { usernameSchema } from '../username.schema';
import { Banner } from '../../../shared/banner/banner';
import { submissionOrFocusProblem } from '../../../shared/submit-form';

@Component({
  selector: 'app-create-user',
  imports: [Banner, AuthCard, FormRoot, FormTextField, RouterLink],
  templateUrl: './create-user.html',
  styleUrl: '../../../shared/auth-form.scss',
})
export class CreateUser {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  /** Where the user was sent from, passed on to the log-in page. Bound from the query parameter. */
  readonly returnUrl = input<string>();

  /** Why the last attempt failed, shown above the button. */
  protected readonly formError = signal<string | undefined>(undefined);

  protected readonly createUserModel = signal<CreateUserModel>({
    username: '',
    password: '',
    confirmPassword: '',
  });

  protected readonly createUserForm = form(
    this.createUserModel,
    (schemaPath) => {
      apply(schemaPath.username, usernameSchema);

      apply(schemaPath.password, passwordSchema);

      required(schemaPath.confirmPassword, { message: 'Please verify your password' });
      validate(schemaPath.confirmPassword, ({ value, valueOf }) =>
        value() === valueOf(schemaPath.password)
          ? undefined
          : { kind: 'passwordMismatch', message: 'Passwords do not match' },
      );
    },
    {
      submission: submissionOrFocusProblem(this.formError, () => this.createUser()),
    },
  );

  protected readonly showPassword = signal(false);

  protected toggleShowPassword() {
    this.showPassword.update((isShown) => !isShown);
  }

  private async createUser() {
    const { username, password } = this.createUserModel();
    const failure = await this.authStore.register(username, password);
    if (failure) {
      this.formError.set(authFailureMessage(failure));
      return;
    }
    await this.router.navigate(['/log-in'], { queryParams: { returnUrl: this.returnUrl() } });
  }
}
