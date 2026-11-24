type UpdatesProxy = typeof import('./updates-proxy');

describe('updates proxy', () => {
  let proxy: UpdatesProxy;
  let fetchMock: ReturnType<typeof vi.fn>;
  let answer: unknown;

  beforeEach(async () => {
    // A fresh copy of the module each time, so the proxy's cache starts empty.
    vi.resetModules();
    proxy = await import('./updates-proxy');

    answer = { items: [3, 2, 1], profiles: ['anna'] };
    fetchMock = vi.fn(async () => Response.json(answer));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns the changed items and profiles from the right Hacker News address', async () => {
    expect(await proxy.getUpdates()).toEqual({ items: [3, 2, 1], profiles: ['anna'] });
    expect(fetchMock).toHaveBeenCalledWith('https://hacker-news.firebaseio.com/v0/updates.json');
  });

  it('reuses the answer for 15 seconds, then asks again', async () => {
    vi.useFakeTimers();
    await proxy.getUpdates();
    vi.advanceTimersByTime(14_000);
    await proxy.getUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    answer = { items: [9], profiles: [] };
    vi.advanceTimersByTime(2_000);
    expect(await proxy.getUpdates()).toEqual({ items: [9], profiles: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('turns a failing Hacker News request into an error, and does not cache it', async () => {
    fetchMock.mockResolvedValueOnce(new Response('oops', { status: 503 }));
    await expect(proxy.getUpdates()).rejects.toThrow(/503/);
    expect(await proxy.getUpdates()).toEqual({ items: [3, 2, 1], profiles: ['anna'] });
  });
});
