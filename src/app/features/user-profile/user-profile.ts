import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { disabled, email, form, FormField, FormRoot, min, required } from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthCard } from '../../shared/auth-card/auth-card';
import { InfoTip } from '../../shared/info-tip/info-tip';
import { TimeAgoPipe } from '../../shared/time-ago.pipe';
import { FormTextField } from '../../shared/form-text-field/form-text-field';
import { HnApi } from '../../core/api/hn-api';
import { ProfileApi } from '../../core/api/profile-api';
import { ProfileStore } from '../../core/profile/profile.store';
import { ThemeStore } from '../../core/theme/theme.store';
import { AuthStore } from '../../core/auth/auth.store';
import { StoriesStore } from '../stories/stories.store';
import { UserProfileModel } from '../../models/user-profile-model';
import { Banner } from '../../shared/banner/banner';
import { submissionOrFocusProblem } from '../../shared/submit-form';

@Component({
  selector: 'app-user-profile',
  imports: [Banner, AuthCard, FormRoot, FormField, FormTextField, InfoTip, RouterLink, TimeAgoPipe],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.scss',
})
export class UserProfile {
  protected readonly authStore = inject(AuthStore);

  protected readonly initial = computed(() => this.authStore.username().charAt(0));

  private readonly hnApi = inject(HnApi);
  private readonly profileApi = inject(ProfileApi);
  protected readonly profileStore = inject(ProfileStore);
  protected readonly themeStore = inject(ThemeStore);
  private readonly router = inject(Router);
  private readonly storiesStore = inject(StoriesStore);

  /** The Hacker News profile for the logged-in username: `null` when there is no such user. */
  protected readonly hnUser = resource({
    params: () => this.authStore.username() || undefined,
    loader: ({ params }) => this.hnApi.getUser(params),
  });

  protected readonly yesNoOptions = ['no', 'yes'] as const;

  /** What is in the form: the saved profile once it has loaded, then whatever the user types. */
  protected readonly userProfileModel = linkedSignal<UserProfileModel>(
    () =>
      this.profileStore.profile() ?? {
        about: '',
        email: '',
        showdead: 'no',
        noprocrast: 'no',
        maxvisit: 20,
        minaway: 180,
        delay: 0,
      },
  );

  /** Why the last attempt to save failed, shown above the button. */
  protected readonly formError = signal<string | undefined>(undefined);

  protected readonly userProfileForm = form(
    this.userProfileModel,
    (schemaPath) => {
      required(schemaPath.email, { message: 'Email is required' });
      email(schemaPath.email, { message: 'Enter a valid email address' });
      min(schemaPath.maxvisit, 1, { message: 'Must be at least 1' });
      min(schemaPath.minaway, 0, { message: 'Must be 0 or more' });
      min(schemaPath.delay, 0, { message: 'Must be 0 or more' });
      // The two lock-out settings only matter when No Procrast is yes.
      disabled(schemaPath.maxvisit, {
        when: ({ valueOf }) => valueOf(schemaPath.noprocrast) !== 'yes',
      });
      disabled(schemaPath.minaway, {
        when: ({ valueOf }) => valueOf(schemaPath.noprocrast) !== 'yes',
      });
    },
    {
      submission: submissionOrFocusProblem(this.formError, () => this.saveProfile()),
    },
  );

  private async saveProfile() {
    const failure = await this.profileApi.saveProfile(this.userProfileModel());
    if (failure) {
      this.formError.set(failure);
      return;
    }
    // Saved: the app follows the new settings at once, and the dialog closes, back to the story list the user last had open.
    // The story pages remembered in this browser may have been made with the old settings (Show
    // Dead changes what is on them), so they are forgotten and loaded again.
    this.hnApi.clearStoryPageCache();
    this.profileStore.remember(this.userProfileModel());
    await this.router.navigateByUrl(`/${this.storiesStore.selectedList()}`);
  }
}
