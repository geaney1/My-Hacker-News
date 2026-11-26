import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Result = { status: number; body: Record<string, unknown> | null };

const valid = {
  about: 'Hello there',
  email: 'billy@example.com',
  showdead: 'yes',
  noprocrast: 'no',
  maxvisit: 30,
  minaway: 100,
  delay: 5,
};

describe('profile controller', () => {
  let directory: string;
  let api: { url: string; close: () => Promise<unknown> };
  let baseUrl: string;
  let billy: string;
  let anna: string;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-profile-'));
    process.env['DATA_DIR'] = directory;
    const { createSession } = await import('./sessions-store');
    billy = `hn_session=${await createSession('Billy')}`;
    anna = `hn_session=${await createSession('Anna')}`;

    const { startApiServer } = await import('./api-server.testing');
    api = await startApiServer();
    baseUrl = `${api.url}/profile`;
  });

  afterAll(async () => {
    await api.close();
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  async function call(
    method: 'GET' | 'PUT',
    cookie: string | null,
    body?: unknown,
    contentType = 'application/json',
  ) {
    const response = await fetch(baseUrl, {
      method,
      headers: { 'content-type': contentType, ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) } as Result;
  }

  it('gives the defaults to someone who has never saved a profile', async () => {
    const result = await call('GET', anna);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      about: '',
      email: '',
      showdead: 'no',
      noprocrast: 'no',
      maxvisit: 20,
      minaway: 180,
      delay: 0,
    });
  });

  it('saves a profile, and gives it back the next time', async () => {
    const saved = await call('PUT', billy, valid);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual(valid);

    expect((await call('GET', billy)).body).toEqual(valid);
  });

  it('keeps the profile on disk', async () => {
    await call('PUT', billy, valid);
    const file = JSON.parse(readFileSync(join(directory, 'profiles.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(file['billy']).toEqual(valid);
  });

  it("keeps each user's profile separate, and always saves to the session's user", async () => {
    await call('PUT', billy, { ...valid, email: 'billy@example.com' });
    await call('PUT', anna, { ...valid, email: 'anna@example.com', username: 'Billy' });

    expect((await call('GET', billy)).body?.['email']).toBe('billy@example.com');
    expect((await call('GET', anna)).body?.['email']).toBe('anna@example.com');
  });

  it('trims the email, and keeps only the known fields', async () => {
    const result = await call('PUT', billy, {
      ...valid,
      email: '  trimmed@example.com  ',
      extra: 'x',
    });
    expect(result.body?.['email']).toBe('trimmed@example.com');
    expect(result.body).not.toHaveProperty('extra');
  });

  it('answers 401 without a session, for both reading and saving', async () => {
    expect((await call('GET', null)).status).toBe(401);
    expect((await call('PUT', null, valid)).status).toBe(401);
    expect((await call('GET', 'hn_session=nope')).status).toBe(401);
  });

  it('answers 415 when the body is not JSON', async () => {
    expect((await call('PUT', billy, 'email=x', 'application/x-www-form-urlencoded')).status).toBe(
      415,
    );
  });

  it.each([
    ['no body', undefined],
    ['a missing email', { ...valid, email: undefined }],
    ['an empty email', { ...valid, email: '' }],
    ['an email that is not one', { ...valid, email: 'not-an-email' }],
    ['an email with a space', { ...valid, email: 'a b@example.com' }],
    ['about that is too long', { ...valid, about: 'x'.repeat(2001) }],
    ['about that is not text', { ...valid, about: 5 }],
    ['showdead that is not yes or no', { ...valid, showdead: 'maybe' }],
    ['noprocrast that is not yes or no', { ...valid, noprocrast: true }],
    ['maxvisit of 0', { ...valid, maxvisit: 0 }],
    ['a minaway below 0', { ...valid, minaway: -1 }],
    ['a delay that is not a whole number', { ...valid, delay: 1.5 }],
    ['a delay that is text', { ...valid, delay: '5' }],
    ['a huge maxvisit', { ...valid, maxvisit: 1e9 }],
  ])('answers 400 for %s, and saves nothing', async (_name, body) => {
    const before = (await call('GET', billy)).body;
    expect((await call('PUT', billy, body)).status).toBe(400);
    expect((await call('GET', billy)).body).toEqual(before);
  });
});
