import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('users controller', () => {
  let directory: string;
  let api: { url: string; close: () => Promise<unknown> };
  const hackerNews = vi.fn<() => Promise<Response>>();
  const realFetch = globalThis.fetch;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-users-controller-'));
    process.env['DATA_DIR'] = directory;
    // A fresh copy of the modules each time, so the proxy's cache starts empty.
    vi.resetModules();
    hackerNews.mockReset();
    hackerNews.mockImplementation(async () => Response.json({ id: 'anna', karma: 5 }));
    vi.stubGlobal('fetch', hackerNews);
    const { startApiServer } = await import('./api-server.testing');
    api = await startApiServer();
  });

  afterEach(async () => {
    await api.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  it('answers with the user', async () => {
    const response = await realFetch(`${api.url}/users/anna`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'anna', karma: 5 });
  });

  it('answers 404 for a user nobody has', async () => {
    hackerNews.mockImplementation(async () => Response.json(null));

    const response = await realFetch(`${api.url}/users/nobody`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'User not found' });
  });

  it('answers 400 for a name that cannot be a username', async () => {
    const response = await realFetch(`${api.url}/users/a`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'Invalid username: a' });
  });

  it('answers 502 with only a message when Hacker News fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    hackerNews.mockImplementation(async () => new Response('oops', { status: 503 }));

    const response = await realFetch(`${api.url}/users/anna`);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'Could not load the user' });
  });
});
