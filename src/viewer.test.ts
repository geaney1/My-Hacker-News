import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Request } from 'express';

const profile = {
  about: '',
  email: 'anna@example.com',
  showdead: 'yes',
  noprocrast: 'no',
  maxvisit: 20,
  minaway: 180,
  delay: 45,
};

describe('viewerOf', () => {
  let directory: string;
  let viewerOf: (request: Request) => Promise<{ username?: string; showDead: boolean; delaySeconds: number }>;
  let sessionCookie: string;

  const requestWith = (cookie?: string) => ({ headers: cookie ? { cookie } : {} }) as unknown as Request;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-viewer-'));
    process.env['DATA_DIR'] = directory;
    const { createSession } = await import('./sessions-store');
    const { saveProfile } = await import('./profiles-store');
    ({ viewerOf } = await import('./viewer'));
    sessionCookie = `hn_session=${await createSession('Anna')}`;
    await saveProfile('Anna', profile);
  });

  afterAll(() => {
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  it('is a visitor with nothing special turned on when there is no session', async () => {
    expect(await viewerOf(requestWith())).toEqual({ showDead: false, delaySeconds: 0 });
    expect(await viewerOf(requestWith('hn_session=nope'))).toEqual({ showDead: false, delaySeconds: 0 });
  });

  it('is the logged-in user, with the Show Dead and Delay they saved', async () => {
    expect(await viewerOf(requestWith(sessionCookie))).toEqual({
      username: 'Anna',
      showDead: true,
      delaySeconds: 45,
    });
  });

  it('has the defaults for a logged-in user who has not saved a profile', async () => {
    const { createSession } = await import('./sessions-store');
    const fresh = `hn_session=${await createSession('Newbie')}`;
    expect(await viewerOf(requestWith(fresh))).toEqual({ username: 'Newbie', showDead: false, delaySeconds: 0 });
  });
});
