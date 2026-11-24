import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { SignJWT } from 'jose';

const secretText = 'a-test-secret-that-is-long-enough-for-hs256';

type Result = { status: number; body: Record<string, string> | null; cookie?: string; setCookie: string | null };

describe('auth routes', () => {
  let directory: string;
  let server: Server;
  let baseUrl: string;
  let resetRateLimits: () => void;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-routes-'));
    process.env['DATA_DIR'] = directory;
    process.env['SESSION_SECRET'] = secretText;
    const { authRouter, resetRateLimits: reset } = await import('./auth-routes');
    resetRateLimits = reset;

    const app = express();
    app.use('/api/auth', express.json({ limit: '10kb' }), authRouter);
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/auth`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    delete process.env['DATA_DIR'];
    delete process.env['SESSION_SECRET'];
    rmSync(directory, { recursive: true, force: true });
  });

  beforeEach(() => resetRateLimits());

  async function call(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    cookie?: string,
  ): Promise<Result> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.get('set-cookie');
    return {
      status: response.status,
      body: await response.json().catch(() => null),
      cookie: setCookie?.split(';')[0],
      setCookie,
    };
  }

  /** Signs up and logs in, and returns the session cookie. */
  async function signUpAndLogIn(username: string, password = 'correct-horse') {
    await call('POST', '/register', { username, password });
    const login = await call('POST', '/login', { username, password });
    expect(login.cookie).toBeTruthy();
    return login.cookie as string;
  }

  describe('register', () => {
    it('creates an account', async () => {
      const result = await call('POST', '/register', { username: 'Newbie', password: 'correct-horse' });
      expect(result.status).toBe(201);
      expect(result.body).toEqual({ username: 'Newbie' });
    });

    it('answers 409 when the username is taken, whatever its case', async () => {
      await call('POST', '/register', { username: 'Dupe', password: 'correct-horse' });
      const result = await call('POST', '/register', { username: 'dupe', password: 'another-pass1' });
      expect(result.status).toBe(409);
      expect(result.body?.['message']).toMatch(/taken/);
    });

    it('answers 400 for an invalid username or password, or a missing body', async () => {
      expect((await call('POST', '/register', { username: 'a', password: 'correct-horse' })).status).toBe(400);
      expect((await call('POST', '/register', { username: 'Valid', password: 'short' })).status).toBe(400);
      expect((await call('POST', '/register')).status).toBe(400);
    });
  });

  describe('login', () => {
    it('sets an HTTP-only session cookie and returns the username', async () => {
      await call('POST', '/register', { username: 'Logger', password: 'correct-horse' });
      const result = await call('POST', '/login', { username: 'LOGGER', password: 'correct-horse' });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ username: 'Logger' });
      expect(result.setCookie).toMatch(/^hn_session=[\w-]+\.[\w-]+\.[\w-]+;/);
      expect(result.setCookie).toMatch(/HttpOnly/i);
      expect(result.setCookie).toMatch(/SameSite=Lax/i);
    });

    it('gives the same answer for a wrong password and an unknown user', async () => {
      await call('POST', '/register', { username: 'Secret', password: 'correct-horse' });
      const wrongPassword = await call('POST', '/login', { username: 'Secret', password: 'nope-nope-nope' });
      const unknownUser = await call('POST', '/login', { username: 'ghost', password: 'correct-horse' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownUser.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownUser.body);
      expect(wrongPassword.cookie).toBeUndefined();
    });
  });

  describe('me and logout', () => {
    it('tells a logged-in user who they are', async () => {
      const cookie = await signUpAndLogIn('Whoami');
      const result = await call('GET', '/me', undefined, cookie);
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ username: 'Whoami' });
    });

    it('answers 401 without a cookie, and for a forged or garbage one', async () => {
      expect((await call('GET', '/me')).status).toBe(401);
      expect((await call('GET', '/me', undefined, 'hn_session=abc')).status).toBe(401);

      const forged = await new SignJWT({ ver: 0 })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('Whoami')
        .setIssuer('hacker-news-app')
        .setAudience('hacker-news-app')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode('a-different-secret-a-different-secret'));
      expect((await call('GET', '/me', undefined, `hn_session=${forged}`)).status).toBe(401);
    });

    it('issues a fresh token once the current one is more than half used', async () => {
      await signUpAndLogIn('Renewer');
      const old = await new SignJWT({ ver: 0 })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('Renewer')
        .setIssuer('hacker-news-app')
        .setAudience('hacker-news-app')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 13 * 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) + 11 * 3600)
        .sign(new TextEncoder().encode(secretText));

      const result = await call('GET', '/me', undefined, `hn_session=${old}`);
      expect(result.status).toBe(200);
      expect(result.cookie).toBeTruthy();
      expect(result.cookie).not.toBe(`hn_session=${old}`);
    });

    it('does not renew a fresh token', async () => {
      const cookie = await signUpAndLogIn('Fresh');
      expect((await call('GET', '/me', undefined, cookie)).setCookie).toBeNull();
    });

    it('logout clears the cookie', async () => {
      const result = await call('POST', '/logout', {});
      expect(result.status).toBe(204);
      expect(result.setCookie).toMatch(/^hn_session=;/);
      expect(result.setCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
  });

  describe('change password', () => {
    it('needs a login', async () => {
      const result = await call('POST', '/change-password', {
        currentPassword: 'correct-horse',
        newPassword: 'brand-new-pass',
      });
      expect(result.status).toBe(401);
    });

    it('rejects a wrong current password with 403 and changes nothing', async () => {
      const cookie = await signUpAndLogIn('Guarded');
      const result = await call(
        'POST',
        '/change-password',
        { currentPassword: 'wrong-wrong-1', newPassword: 'brand-new-pass' },
        cookie,
      );
      expect(result.status).toBe(403);
      expect((await call('POST', '/login', { username: 'Guarded', password: 'correct-horse' })).status).toBe(200);
    });

    it('rejects an invalid new password, or the same one again, with 400', async () => {
      const cookie = await signUpAndLogIn('Picky');
      const tooShort = await call('POST', '/change-password', { currentPassword: 'correct-horse', newPassword: 'short' }, cookie);
      const same = await call('POST', '/change-password', { currentPassword: 'correct-horse', newPassword: 'correct-horse' }, cookie);
      expect(tooShort.status).toBe(400);
      expect(same.status).toBe(400);
    });

    it('changes the password, ends the old sessions and keeps this one going', async () => {
      const oldCookie = await signUpAndLogIn('Changer');
      const otherDevice = (await call('POST', '/login', { username: 'Changer', password: 'correct-horse' })).cookie as string;

      const result = await call(
        'POST',
        '/change-password',
        { currentPassword: 'correct-horse', newPassword: 'brand-new-pass' },
        oldCookie,
      );
      expect(result.status).toBe(204);
      const newCookie = result.cookie as string;
      expect(newCookie).toBeTruthy();

      // Sessions started before the change no longer work, on any device.
      expect((await call('GET', '/me', undefined, oldCookie)).status).toBe(401);
      expect((await call('GET', '/me', undefined, otherDevice)).status).toBe(401);
      // The session that made the change carries on.
      expect((await call('GET', '/me', undefined, newCookie)).body).toEqual({ username: 'Changer' });

      // Only the new password logs in.
      expect((await call('POST', '/login', { username: 'Changer', password: 'correct-horse' })).status).toBe(401);
      expect((await call('POST', '/login', { username: 'Changer', password: 'brand-new-pass' })).status).toBe(200);
    });
  });

  describe('rate limiting', () => {
    it('answers 429 after 10 attempts in a minute from one address', async () => {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 12; attempt++) {
        statuses.push((await call('POST', '/login', { username: 'ghost', password: 'correct-horse' })).status);
      }
      expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
      expect(statuses.slice(10)).toEqual([429, 429]);
    });
  });
});
