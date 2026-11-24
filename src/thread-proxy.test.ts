import type { HnItem } from './app/models/hn-item';

vi.mock('./stories-proxy', () => ({ getItem: vi.fn() }));

describe('thread proxy', () => {
  let getThread: typeof import('./thread-proxy').getThread;
  let getItem: ReturnType<typeof vi.fn>;

  /** Sets up the items the proxy will "fetch", by id. A missing id resolves to `null`. */
  function serve(items: HnItem[]) {
    const byId = new Map(items.map((item) => [item.id, item]));
    getItem.mockImplementation(async (id: number) => byId.get(id) ?? null);
  }

  beforeEach(async () => {
    ({ getThread } = await import('./thread-proxy'));
    getItem = (await import('./stories-proxy')).getItem as unknown as ReturnType<typeof vi.fn>;
    getItem.mockReset();
  });

  it('is null for an item that does not exist', async () => {
    serve([]);
    expect(await getThread(1)).toBeNull();
  });

  it('returns a story with no comments and no poll options', async () => {
    serve([{ id: 1, type: 'story', title: 'Hello' }]);
    expect(await getThread(1)).toEqual({
      item: { id: 1, type: 'story', title: 'Hello' },
      comments: [],
      pollOptions: [],
      truncated: false,
    });
  });

  it('nests replies under their comments and keeps the ranked order of kids', async () => {
    serve([
      { id: 1, type: 'story', kids: [30, 10, 20] },
      { id: 10, type: 'comment', kids: [11, 12] },
      { id: 11, type: 'comment' },
      { id: 12, type: 'comment', kids: [13] },
      { id: 13, type: 'comment' },
      { id: 20, type: 'comment' },
      { id: 30, type: 'comment' },
    ]);

    const thread = await getThread(1);
    expect(thread?.comments.map((comment) => comment.id)).toEqual([30, 10, 20]);
    const second = thread?.comments[1];
    expect(second?.replies.map((reply) => reply.id)).toEqual([11, 12]);
    expect(second?.replies[1].replies.map((reply) => reply.id)).toEqual([13]);
    expect(second?.replies[0].replies).toEqual([]);
  });

  it('leaves out deleted, dead and missing comments', async () => {
    serve([
      { id: 1, type: 'story', kids: [2, 3, 4, 5] },
      { id: 2, type: 'comment' },
      { id: 3, type: 'comment', deleted: true },
      { id: 4, type: 'comment', dead: true },
      // 5 does not exist
    ]);
    expect((await getThread(1))?.comments.map((comment) => comment.id)).toEqual([2]);
  });

  it('survives a comment that fails to load', async () => {
    serve([{ id: 1, type: 'story', kids: [2, 3] }, { id: 3, type: 'comment' }]);
    const original = getItem.getMockImplementation() as (id: number) => Promise<HnItem | null>;
    getItem.mockImplementation(async (id: number) => {
      if (id === 2) {
        throw new Error('network down');
      }
      return original(id);
    });
    expect((await getThread(1))?.comments.map((comment) => comment.id)).toEqual([3]);
  });

  it('loads at most 200 comments and says so when there were more', async () => {
    const kids = Array.from({ length: 250 }, (_, index) => index + 2);
    serve([
      { id: 1, type: 'story', kids },
      ...kids.map((id) => ({ id, type: 'comment' as const })),
    ]);

    const thread = await getThread(1);
    expect(thread?.comments).toHaveLength(200);
    expect(thread?.truncated).toBe(true);
  });

  it('shares the 200 comment limit with replies', async () => {
    const topLevel = Array.from({ length: 150 }, (_, index) => index + 2);
    const replies = Array.from({ length: 100 }, (_, index) => index + 1000);
    serve([
      { id: 1, type: 'story', kids: topLevel },
      ...topLevel.map((id, index) => ({ id, type: 'comment' as const, kids: index === 0 ? replies : undefined })),
      ...replies.map((id) => ({ id, type: 'comment' as const })),
    ]);

    const thread = await getThread(1);
    const total = (comments: NonNullable<typeof thread>['comments']): number =>
      comments.reduce((sum, comment) => sum + 1 + total(comment.replies), 0);
    expect(total(thread?.comments ?? [])).toBe(200);
    expect(thread?.truncated).toBe(true);
  });

  it('loads a poll\'s options in the poll\'s order and skips dead ones', async () => {
    serve([
      { id: 1, type: 'poll', parts: [12, 10, 11, 13] },
      { id: 10, type: 'pollopt', poll: 1, score: 5 },
      { id: 11, type: 'pollopt', poll: 1, score: 7, dead: true },
      { id: 12, type: 'pollopt', poll: 1, score: 9 },
    ]);
    expect((await getThread(1))?.pollOptions.map((option) => option.id)).toEqual([12, 10]);
  });
});
