import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { apply, form, required, submit, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { authFailureMessage } from '../../shared/auth-failure-message';
import { AuthCard } from '../../shared/auth-card/auth-card';
import { FormTextField } from '../../shared/form-text-field/form-text-field';
import { ChangePasswordModel } from '../../models/change-password-model';
import { passwordSchema } from '../auth/password.schema';

@Component({
  selector: 'app-change-password',
  imports: [AuthCard, FormTextField],
  templateUrl: './change-password.html',
  styleUrl: '../../shared/auth-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePassword {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  /** Why the last attempt failed, shown above the button. */
  protected readonly formError = signal<string | undefined>(undefined);

  protected readonly changePasswordModel = signal<ChangePasswordModel>({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  protected readonly changePasswordForm = form(this.changePasswordModel, (schemaPath) => {
    required(schemaPath.currentPassword, { message: 'Current password is required' });

    apply(schemaPath.newPassword, passwordSchema);
    validate(schemaPath.newPassword, ({ value, valueOf }) =>
      value() && value() === valueOf(schemaPath.currentPassword)
        ? {
            kind: 'samePassword',
            message: 'New password must be different from the current password',
          }
        : undefined,
    );

    required(schemaPath.confirmNewPassword, { message: 'Please verify your new password' });
    validate(schemaPath.confirmNewPassword, ({ value, valueOf }) =>
      value() === valueOf(schemaPath.newPassword)
        ? undefined
        : { kind: 'passwordMismatch', message: 'Passwords do not match' },
    );
  });

  protected readonly showPassword = signal(false);

  protected toggleShowPassword() {
    this.showPassword.update((isShown) => !isShown);
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();
    this.formError.set(undefined);
    await submit(this.changePasswordForm, async () => {
      const { currentPassword, newPassword } = this.changePasswordModel();
      const failure = await this.authStore.changePassword(currentPassword, newPassword);
      if (failure) {
        this.formError.set(authFailureMessage(failure));
        return;
      }
      await this.router.navigateByUrl('/user-profile');
    });
  }
}
