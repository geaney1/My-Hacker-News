import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('stories controller', () => {
  let directory: string;
  let api: { url: string; close: () => Promise<unknown> };
  const hackerNews = vi.fn<(address: string) => Promise<Response>>();
  const realFetch = globalThis.fetch;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-stories-controller-'));
    process.env['DATA_DIR'] = directory;
    // A fresh copy of the modules each time, so the proxy's caches start empty.
    vi.resetModules();
    hackerNews.mockReset();
    hackerNews.mockImplementation(async (address) =>
      Response.json(address.endsWith('topstories.json') ? [1, 2] : { id: 1, type: 'story' }),
    );
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

  it('answers with the page of the list that was asked for', async () => {
    const response = await realFetch(`${api.url}/stories/top?page=2&pageSize=1`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ total: 2, stories: [{ id: 1, type: 'story' }] });
    expect(hackerNews).toHaveBeenCalledWith('https://hacker-news.firebaseio.com/v0/item/2.json');
  });

  it.each(['/stories/nope', '/stories/top?page=0', '/stories/top?pageSize=101'])(
    'answers 400, saying why, to %s',
    async (path) => {
      const response = await realFetch(`${api.url}${path}`);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ message: expect.any(String) });
    },
  );

  it('answers 502 with only a message when Hacker News fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    hackerNews.mockImplementation(async () => new Response('oops', { status: 503 }));

    const response = await realFetch(`${api.url}/stories/top`);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'Could not load the stories' });
  });
});
