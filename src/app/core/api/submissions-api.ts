import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SubmitFailure } from '../../models/submit-failure';

@Service()
export class SubmissionsApi {
  private readonly http = inject(HttpClient);

  /** Resolves to `undefined` when the story was saved, or the reason it was not. */
  async submitStory(title: string, url: string, text: string) {
    try {
      await firstValueFrom(this.http.post('/api/submissions', { title, url, text }));
      return undefined;
    } catch (error) {
      return this.failureFrom(error);
    }
  }

  private failureFrom(error: unknown): SubmitFailure {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 400:
          return 'invalid-input';
        case 401:
          return 'not-logged-in';
        case 403:
          return 'limit-reached';
        case 429:
          return 'too-many-attempts';
      }
    }
    return 'unavailable';
  }
}
