import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const day = 24 * 60 * 60 * 1000;

describe('auth controller', () => {
  let directory: string;
  let api: { url: string; close: () => Promise<unknown> };
  let baseUrl: string;
  let resetRateLimits: () => void;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-auth-'));
    process.env['DATA_DIR'] = directory;
    const { resetRateLimits: reset } = await import('./auth-controller');
    resetRateLimits = reset;
    const { startApiServer } = await import('./api-server.testing');
    api = await startApiServer();
    baseUrl = `${api.url}/auth`;
  });

  afterAll(async () => {
    await api.close();
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  beforeEach(() => resetRateLimits());
  afterEach(() => vi.useRealTimers());

  async function call(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    cookie?: string,
    contentType = 'application/json',
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': contentType, ...(cookie ? { cookie } : {}) },
      body: body
        ? contentType === 'application/json'
          ? JSON.stringify(body)
          : String(body)
        : undefined,
    });
    const setCookie = response.headers.get('set-cookie');
    return {
      status: response.status,
      body: await response.json().catch(() => null),
      cookie: setCookie?.split(';')[0],
      setCookie,
    };
  }

  /** Creates a user and logs in, and returns the session cookie. */
  async function createUserAndLogIn(username: string, password = 'correct-horse') {
    await call('POST', '/register', { username, password });
    const login = await call('POST', '/login', { username, password });
    expect(login.cookie).toBeTruthy();
    return login.cookie as string;
  }

  const idOf = (cookie: string) => cookie.split('=')[1];

  describe('register', () => {
    it('creates an account', async () => {
      const result = await call('POST', '/register', {
        username: 'Newbie',
        password: 'correct-horse',
      });
      expect(result.status).toBe(201);
      expect(result.body).toEqual({ username: 'Newbie' });
    });

    it('does not log the new user in', async () => {
      const result = await call('POST', '/register', {
        username: 'NoCookie',
        password: 'correct-horse',
      });
      expect(result.setCookie).toBeNull();
    });

    it('answers 409 when the username is taken, whatever its case', async () => {
      await call('POST', '/register', { username: 'Dupe', password: 'correct-horse' });
      const result = await call('POST', '/register', {
        username: 'dupe',
        password: 'another-pass1',
      });
      expect(result.status).toBe(409);
      expect(result.body?.['message']).toMatch(/taken/);
    });

    it('answers 400 for an invalid username or password, or a missing body', async () => {
      expect(
        (await call('POST', '/register', { username: 'a', password: 'correct-horse' })).status,
      ).toBe(400);
      expect(
        (await call('POST', '/register', { username: 'Valid', password: 'short' })).status,
      ).toBe(400);
      expect((await call('POST', '/register')).status).toBe(400);
    });
  });

  describe('login', () => {
    it('sets a session cookie that only the browser can hold, and returns the username', async () => {
      await call('POST', '/register', { username: 'Logger', password: 'correct-horse' });
      const result = await call('POST', '/login', {
        username: 'LOGGER',
        password: 'correct-horse',
      });

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ username: 'Logger' });
      expect(result.setCookie).toMatch(/^hn_session=/);
      expect(result.setCookie).toMatch(/HttpOnly/i);
      expect(result.setCookie).toMatch(/SameSite=Lax/i);
      expect(result.setCookie).toMatch(/Max-Age=1209600/);
    });

    it('puts only a random session ID in the cookie, nothing about the user', async () => {
      const cookie = await createUserAndLogIn('Opaque');
      const id = idOf(cookie);

      expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(id).not.toContain('.');
      expect(Buffer.from(id, 'base64url').toString('utf8')).not.toContain('Opaque');
    });

    it('gives every log-in a different session ID', async () => {
      const first = await createUserAndLogIn('Twice');
      const second = (
        await call('POST', '/login', { username: 'Twice', password: 'correct-horse' })
      ).cookie as string;
      expect(idOf(second)).not.toBe(idOf(first));
    });

    it('gives the same answer for a wrong password and an unknown user', async () => {
      await call('POST', '/register', { username: 'Secret', password: 'correct-horse' });
      const wrongPassword = await call('POST', '/login', {
        username: 'Secret',
        password: 'nope-nope-nope',
      });
      const unknownUser = await call('POST', '/login', {
        username: 'ghost',
        password: 'correct-horse',
      });

      expect(wrongPassword.status).toBe(401);
      expect(unknownUser.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownUser.body);
      expect(wrongPassword.cookie).toBeUndefined();
    });

    it('ends the session the browser had before, and does not accept an ID it picked itself', async () => {
      const old = await createUserAndLogIn('Rotate');
      const planted = 'hn_session=an-id-an-attacker-chose-for-the-victim';

      const fresh = await call(
        'POST',
        '/login',
        { username: 'Rotate', password: 'correct-horse' },
        old,
      );
      expect((await call('GET', '/me', undefined, old)).status).toBe(401);
      expect(idOf(fresh.cookie as string)).not.toBe(idOf(old));

      const afterPlanting = await call(
        'POST',
        '/login',
        { username: 'Rotate', password: 'correct-horse' },
        planted,
      );
      expect(idOf(afterPlanting.cookie as string)).not.toBe(
        'an-id-an-attacker-chose-for-the-victim',
      );
      expect((await call('GET', '/me', undefined, planted)).status).toBe(401);
    });
  });

  describe('me', () => {
    it('tells a logged-in user who they are', async () => {
      const cookie = await createUserAndLogIn('Whoami');
      const result = await call('GET', '/me', undefined, cookie);
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ username: 'Whoami' });
    });

    it('answers 401 without a cookie, and for a made-up or garbage one', async () => {
      expect((await call('GET', '/me')).status).toBe(401);
      expect((await call('GET', '/me', undefined, 'hn_session=abc')).status).toBe(401);
      expect((await call('GET', '/me', undefined, `hn_session=${'A'.repeat(43)}`)).status).toBe(
        401,
      );
    });

    it('does not send a new cookie for a fresh session', async () => {
      const cookie = await createUserAndLogIn('Fresh');
      expect((await call('GET', '/me', undefined, cookie)).setCookie).toBeNull();
    });

    it('extends the session, and its cookie, once half its life has passed', async () => {
      const cookie = await createUserAndLogIn('Renewer');
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 8 * day);

      const result = await call('GET', '/me', undefined, cookie);
      expect(result.status).toBe(200);
      expect(result.cookie).toBe(cookie); // the same session ID, with a fresh lifetime
      expect(result.setCookie).toMatch(/Max-Age=1209600/);
    });

    it('answers 401 once the session has expired', async () => {
      const cookie = await createUserAndLogIn('Expired');
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 15 * day);

      expect((await call('GET', '/me', undefined, cookie)).status).toBe(401);
    });
  });

  describe('logout', () => {
    it('removes the cookie from the browser', async () => {
      const cookie = await createUserAndLogIn('Leaver');
      const result = await call('POST', '/logout', {}, cookie);

      expect(result.status).toBe(204);
      expect(result.setCookie).toMatch(/^hn_session=;/);
      expect(result.setCookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('ends the session on the server, so a copied cookie stops working', async () => {
      const cookie = await createUserAndLogIn('Copied');
      const copy = cookie; // what someone who read the cookie would hold
      expect((await call('GET', '/me', undefined, copy)).status).toBe(200);

      await call('POST', '/logout', {}, cookie);
      expect((await call('GET', '/me', undefined, copy)).status).toBe(401);
    });

    it('only ends the session it was called with', async () => {
      const laptop = await createUserAndLogIn('TwoDevices');
      const phone = (
        await call('POST', '/login', { username: 'TwoDevices', password: 'correct-horse' })
      ).cookie as string;

      await call('POST', '/logout', {}, laptop);
      expect((await call('GET', '/me', undefined, laptop)).status).toBe(401);
      expect((await call('GET', '/me', undefined, phone)).status).toBe(200);
    });

    it('is fine when nobody is logged in', async () => {
      expect((await call('POST', '/logout', {})).status).toBe(204);
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
      const cookie = await createUserAndLogIn('Guarded');
      const result = await call(
        'POST',
        '/change-password',
        { currentPassword: 'wrong-wrong-1', newPassword: 'brand-new-pass' },
        cookie,
      );
      expect(result.status).toBe(403);
      expect(
        (await call('POST', '/login', { username: 'Guarded', password: 'correct-horse' })).status,
      ).toBe(200);
    });

    it('rejects an invalid new password, or the same one again, with 400', async () => {
      const cookie = await createUserAndLogIn('Picky');
      const tooShort = await call(
        'POST',
        '/change-password',
        { currentPassword: 'correct-horse', newPassword: 'short' },
        cookie,
      );
      const same = await call(
        'POST',
        '/change-password',
        { currentPassword: 'correct-horse', newPassword: 'correct-horse' },
        cookie,
      );
      expect(tooShort.status).toBe(400);
      expect(same.status).toBe(400);
    });

    it('changes the password, ends every old session and keeps this browser logged in', async () => {
      const thisBrowser = await createUserAndLogIn('Changer');
      const otherDevice = (
        await call('POST', '/login', { username: 'Changer', password: 'correct-horse' })
      ).cookie as string;

      const result = await call(
        'POST',
        '/change-password',
        { currentPassword: 'correct-horse', newPassword: 'brand-new-pass' },
        thisBrowser,
      );
      expect(result.status).toBe(204);
      const newCookie = result.cookie as string;
      expect(newCookie).toBeTruthy();

      // Every session that existed before the change is gone, on every device.
      expect((await call('GET', '/me', undefined, thisBrowser)).status).toBe(401);
      expect((await call('GET', '/me', undefined, otherDevice)).status).toBe(401);
      // This browser has been given a new one.
      expect((await call('GET', '/me', undefined, newCookie)).body).toEqual({
        username: 'Changer',
      });

      // Only the new password logs in.
      expect(
        (await call('POST', '/login', { username: 'Changer', password: 'correct-horse' })).status,
      ).toBe(401);
      expect(
        (await call('POST', '/login', { username: 'Changer', password: 'brand-new-pass' })).status,
      ).toBe(200);
    });
  });

  describe('what is kept on the server', () => {
    it('stores sessions as hashes, never the ID that is in the cookie', async () => {
      const cookie = await createUserAndLogIn('Stored');
      const file = readFileSync(join(directory, 'sessions.json'), 'utf8');

      expect(file).not.toContain(idOf(cookie));
      expect(file).toContain('Stored');
    });
  });

  describe('requests that are not JSON', () => {
    it.each(['/login', '/register', '/logout', '/change-password'])(
      'refuses a POST to %s that is not JSON, as a plain cross-site form would send it',
      async (path) => {
        const result = await call(
          'POST',
          path,
          { username: 'x' } as never,
          undefined,
          'application/x-www-form-urlencoded',
        );
        expect(result.status).toBe(415);
      },
    );
  });

  describe('rate limiting', () => {
    it('answers 429 after 10 attempts in a minute from one address', async () => {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 12; attempt++) {
        statuses.push(
          (await call('POST', '/login', { username: 'ghost', password: 'correct-horse' })).status,
        );
      }
      expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
      expect(statuses.slice(10)).toEqual([429, 429]);
    });
  });
});
