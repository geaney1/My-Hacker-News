import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  inject,
  makeStateKey,
  PLATFORM_ID,
  REQUEST,
  Service,
  signal,
  TransferState,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AuthFailure } from '../../models/auth-failure';
import { SessionResponse } from '../../models/session-response';

/** Carries the session's username from the server-rendered page to the browser. */
const sessionStateKey = makeStateKey<string>('session-username');

/**
 * Holds the logged-in state. Accounts and sessions live on the server: creating a user stores a
 * hashed password, and logging in sets a session cookie that this store checks on start-up.
 */
@Service()
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly transferState = inject(TransferState);
  private readonly request = inject(REQUEST, { optional: true });
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  private readonly loggedIn = signal(false);
  private readonly currentUsername = signal('');

  /** `true` while a user is logged in. */
  readonly login = this.loggedIn.asReadonly();
  readonly username = this.currentUsername.asReadonly();

  /**
   * Finds out who is logged in, from the session cookie. The server checks the cookie of the
   * incoming request and hands the answer to the browser, so both render the same page.
   */
  async initialize() {
    const fromServer = this.transferState.get(sessionStateKey, undefined);
    const username = fromServer !== undefined ? fromServer : await this.fetchSessionUsername();

    if (this.isServer) {
      this.transferState.set(sessionStateKey, username);
    }
    this.setUser(username);
  }

  /** Resolves to `undefined` on success, or the reason the log-in failed. */
  async logIn(username: string, password: string) {
    try {
      const session = await firstValueFrom(
        this.http.post<SessionResponse>('/api/auth/login', { username, password }),
      );
      this.setUser(session.username);
      return undefined;
    } catch (error) {
      return this.failureFrom(error);
    }
  }

  /** Resolves to `undefined` on success, or the reason creating the user failed. */
  async register(username: string, password: string) {
    try {
      await firstValueFrom(this.http.post('/api/auth/register', { username, password }));
      return undefined;
    } catch (error) {
      return this.failureFrom(error);
    }
  }

  /**
   * Resolves to `undefined` when the password was changed, or the reason it was not. The server
   * ends all the account's sessions and starts a new one for this browser, so the user stays
   * logged in.
   */
  async changePassword(currentPassword: string, newPassword: string) {
    try {
      await firstValueFrom(
        this.http.post('/api/auth/change-password', { currentPassword, newPassword }),
      );
      return undefined;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.setUser('');
        return 'not-logged-in' satisfies AuthFailure;
      }
      return this.failureFrom(error);
    }
  }

  /**
   * Ends the session on the server. Resolves to `undefined` on success, or the reason the log-out
   * failed. The user stays logged in until the server has answered: after a failure the browser
   * still has the session cookie, so a reload would show them as logged in.
   */
  async logOut() {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } catch (error) {
      return this.failureFrom(error);
    }
    this.setUser('');
    return undefined;
  }

  private setUser(username: string) {
    this.currentUsername.set(username);
    this.loggedIn.set(username !== '');
  }

  private async fetchSessionUsername() {
    // On the server the browser's cookie has to be passed on by hand.
    const cookie = this.request?.headers.get('cookie');
    try {
      const session = await firstValueFrom(
        this.http.get<SessionResponse>('/api/auth/me', {
          headers: cookie ? { cookie } : {},
        }),
      );
      return session.username;
    } catch {
      return '';
    }
  }

  private failureFrom(error: unknown): AuthFailure {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 400:
          return 'invalid-input';
        case 401:
          return 'invalid-credentials';
        case 403:
          return 'wrong-current-password';
        case 409:
          return 'username-taken';
        case 429:
          return 'too-many-attempts';
      }
    }
    return 'unavailable';
  }
}
