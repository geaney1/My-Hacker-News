describe('updates controller', () => {
  let api: { url: string; close: () => Promise<unknown> };
  const hackerNews = vi.fn<() => Promise<Response>>();
  const realFetch = globalThis.fetch;

  beforeEach(async () => {
    // A fresh copy of the modules each time, so the proxy's cache starts empty.
    vi.resetModules();
    hackerNews.mockReset();
    hackerNews.mockImplementation(async () => Response.json({ items: [1], profiles: ['anna'] }));
    vi.stubGlobal('fetch', hackerNews);
    const { startApiServer } = await import('./api-server.testing');
    api = await startApiServer();
  });

  afterEach(async () => {
    await api.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('answers with the changed items and profiles', async () => {
    const response = await realFetch(`${api.url}/updates`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [1], profiles: ['anna'] });
  });

  it('answers 502 with only a message when Hacker News fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    hackerNews.mockImplementation(async () => new Response('oops', { status: 503 }));

    const response = await realFetch(`${api.url}/updates`);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'Could not load the updates' });
  });
});
