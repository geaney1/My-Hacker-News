import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  let store: AuthStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const respondWith = (url: string, status: number, body: object = {}) =>
    http.expectOne(url).flush(body, { status, statusText: String(status) });

  it('starts logged out', () => {
    expect(store.login()).toBe(false);
    expect(store.username()).toBe('');
  });

  describe('initialize', () => {
    it('logs in the user the session cookie belongs to', async () => {
      const done = store.initialize();
      respondWith('/api/auth/me', 200, { username: 'Anna' });
      await done;

      expect(store.login()).toBe(true);
      expect(store.username()).toBe('Anna');
    });

    it('stays logged out when there is no valid session', async () => {
      const done = store.initialize();
      respondWith('/api/auth/me', 401, { message: 'Not logged in' });
      await done;

      expect(store.login()).toBe(false);
    });

    it('uses the answer the server already worked out, without asking again', async () => {
      TestBed.inject(TransferState).set(makeStateKey<string>('session-username'), 'Bob');
      await store.initialize();

      expect(store.username()).toBe('Bob');
      http.expectNone('/api/auth/me');
    });

    it('treats an empty answer from the server as logged out', async () => {
      TestBed.inject(TransferState).set(makeStateKey<string>('session-username'), '');
      await store.initialize();

      expect(store.login()).toBe(false);
      http.expectNone('/api/auth/me');
    });
  });

  describe('logIn', () => {
    it('sends the credentials and logs the user in', async () => {
      const result = store.logIn('Anna', 'correct-horse');
      const request = http.expectOne('/api/auth/login');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ username: 'Anna', password: 'correct-horse' });
      request.flush({ username: 'Anna' });

      expect(await result).toBeUndefined();
      expect(store.login()).toBe(true);
      expect(store.username()).toBe('Anna');
    });

    it.each([
      [401, 'invalid-credentials'],
      [400, 'invalid-input'],
      [429, 'too-many-attempts'],
      [500, 'unavailable'],
    ])('reports status %i as "%s" and stays logged out', async (status, failure) => {
      const result = store.logIn('Anna', 'wrong-password');
      respondWith('/api/auth/login', status);

      expect(await result).toBe(failure);
      expect(store.login()).toBe(false);
    });
  });

  describe('register', () => {
    it('creates the account without logging in', async () => {
      const result = store.register('Anna', 'correct-horse');
      const request = http.expectOne('/api/auth/register');
      expect(request.request.body).toEqual({ username: 'Anna', password: 'correct-horse' });
      request.flush({ username: 'Anna' }, { status: 201, statusText: 'Created' });

      expect(await result).toBeUndefined();
      expect(store.login()).toBe(false);
    });

    it.each([
      [409, 'username-taken'],
      [400, 'invalid-input'],
      [429, 'too-many-attempts'],
    ])('reports status %i as "%s"', async (status, failure) => {
      const result = store.register('Anna', 'correct-horse');
      respondWith('/api/auth/register', status);
      expect(await result).toBe(failure);
    });
  });

  describe('changePassword', () => {
    it('sends both passwords and succeeds', async () => {
      const result = store.changePassword('old-password-1', 'new-password-2');
      const request = http.expectOne('/api/auth/change-password');
      expect(request.request.body).toEqual({
        currentPassword: 'old-password-1',
        newPassword: 'new-password-2',
      });
      request.flush(null, { status: 204, statusText: 'No Content' });

      expect(await result).toBeUndefined();
    });

    it('reports a wrong current password and keeps the user logged in', async () => {
      const login = store.logIn('Anna', 'old-password-1');
      respondWith('/api/auth/login', 200, { username: 'Anna' });
      await login;

      const result = store.changePassword('wrong-wrong-1', 'new-password-2');
      respondWith('/api/auth/change-password', 403);

      expect(await result).toBe('wrong-current-password');
      expect(store.login()).toBe(true);
    });

    it('logs the user out when the server says the session has ended', async () => {
      const login = store.logIn('Anna', 'old-password-1');
      respondWith('/api/auth/login', 200, { username: 'Anna' });
      await login;

      const result = store.changePassword('old-password-1', 'new-password-2');
      respondWith('/api/auth/change-password', 401);

      expect(await result).toBe('not-logged-in');
      expect(store.login()).toBe(false);
    });
  });

  describe('logOut', () => {
    it('logs out straight away, before the server has answered, and ends the session', async () => {
      const login = store.logIn('Anna', 'correct-horse');
      respondWith('/api/auth/login', 200, { username: 'Anna' });
      await login;

      const done = store.logOut();
      expect(store.login()).toBe(false);
      expect(store.username()).toBe('');

      const request = http.expectOne('/api/auth/logout');
      expect(request.request.method).toBe('POST');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await done;
    });

    it('still logs out when the server cannot be reached', async () => {
      const login = store.logIn('Anna', 'correct-horse');
      respondWith('/api/auth/login', 200, { username: 'Anna' });
      await login;

      const done = store.logOut();
      respondWith('/api/auth/logout', 500);
      await expect(done).resolves.toBeUndefined();
      expect(store.login()).toBe(false);
    });
  });
});
