import type { HnItem } from './app/models/hn-item';

type StoriesProxy = typeof import('./stories-proxy');

describe('stories proxy', () => {
  let proxy: StoriesProxy;
  let fetchMock: ReturnType<typeof vi.fn>;
  let lists: Record<string, number[] | null>;
  let items: Record<number, HnItem | null>;
  let failingIds: number[];

  beforeEach(async () => {
    // A fresh copy of the module each time, so the proxy's caches start empty.
    vi.resetModules();
    proxy = await import('./stories-proxy');

    lists = { topstories: [1, 2, 3, 4, 5, 6, 7], submitstories: null };
    items = {};
    failingIds = [];
    for (let id = 1; id <= 7; id++) {
      items[id] = { id, type: 'story', title: `Story ${id}`, score: id };
    }

    fetchMock = vi.fn(async (url: string) => {
      const path = url.replace('https://hacker-news.firebaseio.com/v0/', '').replace('.json', '');
      if (path.startsWith('item/')) {
        const id = Number(path.slice(5));
        if (failingIds.includes(id)) {
          throw new Error('network down');
        }
        return Response.json(items[id] ?? null);
      }
      return Response.json(lists[path] ?? null);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getStoryPage', () => {
    it('returns the requested page of a list with the total', async () => {
      const page = await proxy.getStoryPage('top', 2, 3);
      expect(page.total).toBe(7);
      expect(page.stories.map((story) => story.id)).toEqual([4, 5, 6]);
    });

    it('defaults to the first page of 20', async () => {
      const page = await proxy.getStoryPage('top', undefined, undefined);
      expect(page.stories).toHaveLength(7);
    });

    it('returns a short last page and an empty page past the end', async () => {
      expect((await proxy.getStoryPage('top', 3, 3)).stories.map((story) => story.id)).toEqual([7]);
      expect((await proxy.getStoryPage('top', 9, 3)).stories).toEqual([]);
    });

    it('leaves out deleted, dead and missing items, but still counts them in the total', async () => {
      items[2] = { id: 2, deleted: true };
      items[3] = { id: 3, dead: true, title: 'Dead' };
      items[4] = null;
      const page = await proxy.getStoryPage('top', 1, 7);
      expect(page.stories.map((story) => story.id)).toEqual([1, 5, 6, 7]);
      expect(page.total).toBe(7);
    });

    it('leaves out a story that fails to load instead of failing the whole page', async () => {
      failingIds = [3];
      const page = await proxy.getStoryPage('top', 1, 5);
      expect(page.stories.map((story) => story.id)).toEqual([1, 2, 4, 5]);
    });

    it('treats a list Hacker News does not have, such as "submit", as empty', async () => {
      expect(await proxy.getStoryPage('submit', 1, 20)).toEqual({ total: 0, stories: [] });
    });

    it('rejects an unknown list', async () => {
      await expect(proxy.getStoryPage('nonsense', 1, 20)).rejects.toThrow(/Unknown story list/);
    });

    it.each([0, -1, 1.5, 'abc'])('rejects the page %j', async (page) => {
      await expect(proxy.getStoryPage('top', page, 20)).rejects.toThrow(/page must be/);
    });

    it('rejects a page size that is invalid or over 100', async () => {
      await expect(proxy.getStoryPage('top', 1, 0)).rejects.toThrow(/pageSize must be/);
      await expect(proxy.getStoryPage('top', 1, 101)).rejects.toThrow(/at most 100/);
      await expect(proxy.getStoryPage('top', 1, 100)).resolves.toBeTruthy();
    });

    it('reuses the list and the items it has just fetched', async () => {
      await proxy.getStoryPage('top', 1, 3);
      const callsAfterFirst = fetchMock.mock.calls.length;
      await proxy.getStoryPage('top', 1, 3);
      expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
    });

    it('fetches again once the cached copy is a minute old', async () => {
      vi.useFakeTimers();
      try {
        await proxy.getStoryPage('top', 1, 3);
        const callsAfterFirst = fetchMock.mock.calls.length;
        vi.advanceTimersByTime(61_000);
        await proxy.getStoryPage('top', 1, 3);
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
      } finally {
        vi.useRealTimers();
      }
    });

    it('turns a failing Hacker News list request into an error', async () => {
      fetchMock.mockResolvedValueOnce(new Response('oops', { status: 500 }));
      await expect(proxy.getStoryPage('top', 1, 3)).rejects.toThrow(/500/);
    });
  });

  describe('getItem', () => {
    it('is null for an item that does not exist', async () => {
      expect(await proxy.getItem(999)).toBeNull();
    });
  });

  describe('parseItemId', () => {
    it('accepts a positive whole number, as text or a number', () => {
      expect(proxy.parseItemId('8863')).toBe(8863);
      expect(proxy.parseItemId(8863)).toBe(8863);
    });

    it.each(['abc', '0', '-4', '1.5', '', undefined])('rejects %j', (value) => {
      expect(() => proxy.parseItemId(value)).toThrow(/id must be/);
    });
  });
});
