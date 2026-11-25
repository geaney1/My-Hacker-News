import type { HnItem } from './app/models/hn-item';

type StoriesProxy = typeof import('./stories-proxy');

// What users submitted in this app, by id. The real store is tested on its own.
const submitted = vi.hoisted(() => ({
  stories: [] as { id: number; time: number }[],
  questions: [] as { id: number; time: number }[],
  items: new Map<number, { id: number; title: string }>(),
}));
const commentCounts = vi.hoisted(() => new Map<number, number>());
vi.mock('./comments-store', () => ({
  countLocalComments: async (id: number) => commentCounts.get(id) ?? 0,
}));
vi.mock('./submissions-store', () => ({
  submittedStories: async (kind: 'story' | 'question') =>
    kind === 'story' ? submitted.stories : submitted.questions,
  getSubmittedItem: async (id: number) => submitted.items.get(id) ?? null,
}));

describe('stories proxy', () => {
  let proxy: StoriesProxy;
  let fetchMock: ReturnType<typeof vi.fn>;
  let lists: Record<string, number[] | null>;
  let items: Record<number, HnItem | null>;
  let failingIds: number[];

  beforeEach(async () => {
    submitted.stories = [];
    submitted.questions = [];
    submitted.items.clear();
    commentCounts.clear();
    // A fresh copy of the module each time, so the proxy's caches start empty.
    vi.resetModules();
    proxy = await import('./stories-proxy');

    lists = { topstories: [1, 2, 3, 4, 5, 6, 7], newstories: null };
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

  describe('stories submitted in this app', () => {
    beforeEach(() => {
      // Hacker News stories 1 and 2 (New, newest first: times 100 and 50), and 3 (Ask, time 70).
      items[1] = { id: 1, type: 'story', title: 'Story 1', time: 100 };
      items[2] = { id: 2, type: 'story', title: 'Story 2', time: 50 };
      items[3] = { id: 3, type: 'story', title: 'Story 3', time: 70 };
      lists['newstories'] = [1, 2];
      lists['askstories'] = [3];
      // Mine: two stories (time 75 and 20) and a question (time 90).
      submitted.stories = [
        { id: 2_000_000_002, time: 75 },
        { id: 2_000_000_001, time: 20 },
      ];
      submitted.questions = [{ id: 2_000_000_003, time: 90 }];
      for (const { id } of [...submitted.stories, ...submitted.questions]) {
        submitted.items.set(id, { id, title: `Mine ${id}` });
      }
    });

    it('are placed among the "new" stories by when they were made, and count in the total', async () => {
      const page = await proxy.getStoryPage('new', 1, 20);
      expect(page.total).toBe(4);
      // 1 (time 100), then mine at 75, then 2 (time 50), then mine at 20.
      expect(page.stories.map((story) => story.id)).toEqual([1, 2_000_000_002, 2, 2_000_000_001]);
    });

    it('are first only when they are the newest', async () => {
      submitted.stories = [{ id: 2_000_000_002, time: 500 }];
      expect((await proxy.getStoryPage('new', 1, 20)).stories.map((story) => story.id)).toEqual([
        2_000_000_002, 1, 2,
      ]);
    });

    it('are placed among the "ask" questions by when they were made, and not in "new"', async () => {
      expect((await proxy.getStoryPage('ask', 1, 20)).stories.map((story) => story.id)).toEqual([
        2_000_000_003, 3,
      ]);
      submitted.questions = [{ id: 2_000_000_003, time: 10 }];
      expect((await proxy.getStoryPage('ask', 1, 20)).stories.map((story) => story.id)).toEqual([
        3, 2_000_000_003,
      ]);
      expect(
        (await proxy.getStoryPage('new', 1, 20)).stories.map((story) => story.id),
      ).not.toContain(2_000_000_003);
    });

    it('are not in the other lists', async () => {
      for (const list of ['top', 'best', 'show', 'job']) {
        lists[`${list}stories`] = [1];
        const page = await proxy.getStoryPage(list, 1, 20);
        expect(page.stories.map((story) => story.id)).toEqual([1]);
      }
    });

    it('are paged along with the Hacker News stories', async () => {
      // The merged list is 1, mine, 2, mine: the second page of three is the last one.
      expect((await proxy.getStoryPage('new', 2, 3)).stories.map((story) => story.id)).toEqual([
        2_000_000_001,
      ]);
    });

    it('show how many comments have been written on them in this app', async () => {
      commentCounts.set(2_000_000_001, 2);
      expect((await proxy.getItem(2_000_000_001))?.descendants).toBe(2);
      expect(
        (await proxy.getStoryPage('new', 1, 20)).stories.find((story) => story.id === 2_000_000_001)
          ?.descendants,
      ).toBe(2);
      expect((await proxy.getItem(2_000_000_002))?.descendants).toBe(0);
    });

    it('are shown by getItem without asking Hacker News', async () => {
      fetchMock.mockClear();
      expect(await proxy.getItem(2_000_000_001)).toMatchObject({ title: 'Mine 2000000001' });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Show Dead', () => {
    beforeEach(() => {
      items[2] = { id: 2, type: 'story', title: 'Dead one', dead: true };
      items[3] = { id: 3, type: 'story', title: 'Deleted one', deleted: true };
    });

    it('leaves dead stories out by default, and always leaves deleted ones out', async () => {
      const page = await proxy.getStoryPage('top', 1, 20);
      expect(page.stories.map((story) => story.id)).toEqual([1, 4, 5, 6, 7]);
    });

    it('includes dead stories, but still not deleted ones, when Show Dead is on', async () => {
      const page = await proxy.getStoryPage('top', 1, 20, { showDead: true });
      expect(page.stories.map((story) => story.id)).toEqual([1, 2, 4, 5, 6, 7]);
    });

    it('still counts the same total either way', async () => {
      expect((await proxy.getStoryPage('top', 1, 20)).total).toBe(7);
      expect((await proxy.getStoryPage('top', 1, 20, { showDead: true })).total).toBe(7);
    });
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

    it('treats a list Hacker News has nothing for as empty', async () => {
      expect(await proxy.getStoryPage('new', 1, 20)).toEqual({ total: 0, stories: [] });
    });

    it.each(['nonsense', 'submit', 'welcome'])(
      'rejects the list %s, which Hacker News does not have, without asking it',
      async (list) => {
        await expect(proxy.getStoryPage(list, 1, 20)).rejects.toThrow(/Unknown story list/);
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

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
