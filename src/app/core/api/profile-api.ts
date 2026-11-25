import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserProfileModel } from '../../models/user-profile-model';

@Service()
export class ProfileApi {
  private readonly http = inject(HttpClient);

  /** The logged-in user's saved profile (the defaults when none is saved). */
  getProfile() {
    return firstValueFrom(this.http.get<UserProfileModel>('/api/profile'));
  }

  /** Resolves to `undefined` when the profile was saved, or the server's reason when it was not. */
  async saveProfile(profile: UserProfileModel) {
    try {
      await firstValueFrom(this.http.put('/api/profile', profile));
      return undefined;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return 'Your session has ended. Log in again to continue.';
      }
      if (error instanceof HttpErrorResponse && error.status === 400 && error.error?.message) {
        return String(error.error.message);
      }
      return 'Something went wrong. Please try again.';
    }
  }
}
