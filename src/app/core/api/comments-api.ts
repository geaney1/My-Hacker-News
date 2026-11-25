import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Service()
export class CommentsApi {
  private readonly http = inject(HttpClient);

  /**
   * Saves a comment on a story that was submitted in this app. Resolves to `undefined` when it
   * was saved, or the reason it was not.
   */
  async addComment(itemId: number, text: string) {
    try {
      await firstValueFrom(this.http.post(`/api/items/${itemId}/comments`, { text }));
      return undefined;
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          return 'Your session has ended. Log in again to continue.';
        }
        if (error.status === 400 && error.error?.message) {
          return String(error.error.message);
        }
        if (error.status === 429) {
          return 'Too many attempts. Try again in a minute.';
        }
      }
      return 'Something went wrong. Please try again.';
    }
  }
}
