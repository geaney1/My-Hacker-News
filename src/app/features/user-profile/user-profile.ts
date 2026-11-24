import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { email, form, FormField, min, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TimeAgoPipe } from '../../shared/time-ago.pipe';
import { FormTextField } from '../../shared/form-text-field/form-text-field';
import { HnApi } from '../../core/api/hn-api';
import { AuthStore } from '../../core/auth/auth.store';
import { UserProfileModel } from '../../models/user-profile-model';

@Component({
  selector: 'app-user-profile',
  imports: [FormField, FormTextField, RouterLink, TimeAgoPipe],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfile {
  protected readonly authStore = inject(AuthStore);

  protected readonly initial = computed(() => this.authStore.username().charAt(0));

  private readonly hnApi = inject(HnApi);

  /** The Hacker News profile for the signed-in username: `null` when there is no such user. */
  protected readonly hnUser = resource({
    params: () => this.authStore.username() || undefined,
    loader: ({ params }) => this.hnApi.getUser(params),
  });

  protected readonly yesNoOptions = ['no', 'yes'] as const;

  protected readonly userProfileModel = signal<UserProfileModel>({
    about: '',
    email: '',
    showdead: 'no',
    noprocrast: 'no',
    maxvisit: 20,
    minaway: 180,
    delay: 0,
  });

  protected readonly userProfileForm = form(this.userProfileModel, (schemaPath) => {
    required(schemaPath.email, { message: 'Email is required' });
    email(schemaPath.email, { message: 'Enter a valid email address' });
    min(schemaPath.maxvisit, 1, { message: 'Must be at least 1' });
    min(schemaPath.minaway, 0, { message: 'Must be 0 or more' });
    min(schemaPath.delay, 0, { message: 'Must be 0 or more' });
  });

  protected readonly saved = signal(false);

  protected async onSubmit(event: Event) {
    event.preventDefault();
    this.saved.set(false);
    await submit(this.userProfileForm, async () => {
      // There is no backend yet, so the profile is not stored anywhere.
      this.saved.set(true);
    });
  }
}
