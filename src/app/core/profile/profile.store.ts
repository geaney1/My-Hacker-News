import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, resource, Service } from '@angular/core';
import { ProfileApi } from '../api/profile-api';
import { AuthStore } from '../auth/auth.store';
import { UserProfileModel } from '../../models/user-profile-model';

/**
 * The logged-in user's saved profile. It is loaded once the user is logged in (in the browser,
 * which has the user's cookie), and the settings in it change how the app behaves: Show Dead,
 * and the No Procrast limits.
 */
@Service()
export class ProfileStore {
  private readonly authStore = inject(AuthStore);
  private readonly profileApi = inject(ProfileApi);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly profileResource = resource({
    // No username means nobody is logged in, so there is nothing to load.
    params: () => (this.isBrowser && this.authStore.login() ? this.authStore.username() : undefined),
    loader: () => this.profileApi.getProfile(),
  });

  /** The saved profile, or `undefined` while it loads, when nobody is logged in, or if it failed. */
  readonly profile = computed(() =>
    this.profileResource.hasValue() ? this.profileResource.value() : undefined,
  );

  readonly isLoading = this.profileResource.isLoading;

  /** `true` when the user has Show Dead turned on. */
  readonly showDead = computed(() => this.profile()?.showdead === 'yes');

  /** Loads the profile again, e.g. after a failure. */
  reload() {
    this.profileResource.reload();
  }

  /** Uses a profile that has just been saved, so the app follows the new settings at once. */
  remember(profile: UserProfileModel) {
    this.profileResource.set(profile);
  }
}
