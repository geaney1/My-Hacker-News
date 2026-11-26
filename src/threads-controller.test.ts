import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('threads controller', () => {
  let directory: string;
  let api: { url: string; close: () => Promise<unknown> };
  const hackerNews = vi.fn<() => Promise<Response>>();
  const realFetch = globalThis.fetch;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-threads-controller-'));
    process.env['DATA_DIR'] = directory;
    // A fresh copy of the modules each time, so the proxy's cache starts empty.
    vi.resetModules();
    hackerNews.mockReset();
    hackerNews.mockImplementation(async () => Response.json({ id: 1, type: 'story' }));
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

  it('answers with the item and its comments', async () => {
    const response = await realFetch(`${api.url}/items/1/thread`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ item: { id: 1 }, comments: [] });
  });

  it('answers 404 for an item that does not exist', async () => {
    hackerNews.mockImplementation(async () => Response.json(null));

    const response = await realFetch(`${api.url}/items/1/thread`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'Item not found' });
  });

  it('answers 400 for an id that is not a number', async () => {
    const response = await realFetch(`${api.url}/items/abc/thread`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'id must be a positive whole number' });
  });

  it('answers 502 with only a message when Hacker News fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    hackerNews.mockImplementation(async () => new Response('oops', { status: 503 }));

    const response = await realFetch(`${api.url}/items/1/thread`);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'Could not load the comments' });
  });
});
