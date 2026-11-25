import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Store = typeof import('./submissions-store');

describe('submissions store as items', () => {
  let directory: string;
  let store: Store;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-submitted-'));
    process.env['DATA_DIR'] = directory;
    vi.resetModules();
    store = await import('./submissions-store');
  });

  afterEach(() => {
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it('gives each submission an item id far above any Hacker News id, counting up', async () => {
    const first = await store.addSubmission('Suin', 'First', 'https://example.com');
    const second = await store.addSubmission('Suin', 'Second', 'https://example.com');
    expect(first.itemId).toBe(store.localItemIdBase + 1);
    expect(second.itemId).toBe(store.localItemIdBase + 2);
    expect(store.localItemIdBase).toBeGreaterThan(1_000_000_000);
  });

  it('lists stories and questions separately, newest first', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const oldStory = await store.addSubmission('Suin', 'Old story', 'https://example.com');
    vi.setSystemTime(2_000);
    const question = await store.addSubmission('Suin', 'A question', undefined, 'Why?');
    vi.setSystemTime(3_000);
    const newStory = await store.addSubmission('Suin', 'New story', 'https://example.com');

    expect(await store.submittedStories('story')).toEqual([
      { id: newStory.itemId, time: 3 },
      { id: oldStory.itemId, time: 1 },
    ]);
    expect(await store.submittedStories('question')).toEqual([{ id: question.itemId, time: 2 }]);
  });

  it('shows a story as an item, with its link, and the author, time and title', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000);
    const saved = await store.addSubmission('Suin', 'My story', 'https://example.com/post');
    expect(await store.getSubmittedItem(saved.itemId)).toEqual({
      id: saved.itemId,
      type: 'story',
      by: 'Suin',
      time: 5,
      title: 'My story',
      url: 'https://example.com/post',
      score: 1,
      descendants: 0,
    });
  });

  it('shows a question with no link, and its text as safe HTML', async () => {
    const saved = await store.addSubmission(
      'Suin',
      'Ask: tags?',
      '',
      'Is <b>bold</b> & "quotes" safe?\nSecond line\n\nNew paragraph',
    );
    const item = await store.getSubmittedItem(saved.itemId);
    expect(item).not.toHaveProperty('url');
    expect(item?.text).toBe(
      'Is &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quotes&quot; safe?<br>Second line<p>New paragraph',
    );
  });

  it('lists what one user submitted, newest first, whatever the case of the name', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const first = await store.addSubmission('Billy', 'One', 'https://example.com');
    vi.setSystemTime(2_000);
    await store.addSubmission('Anna', 'Not Billy', 'https://example.com');
    vi.setSystemTime(3_000);
    const third = await store.addSubmission('Billy', 'Two', undefined, 'A question');

    expect(await store.submittedItemIdsBy('BILLY')).toEqual([third.itemId, first.itemId]);
    expect(await store.submittedItemIdsBy('nobody')).toEqual([]);
  });

  it('never gives a story the id of one that was removed', async () => {
    await store.addSubmission('Suin', 'First', 'https://example.com');
    const second = await store.addSubmission('Suin', 'Second', 'https://example.com');

    // The last story is removed from the file, as a delete would, and the server restarts.
    const file = join(directory, 'submissions.json');
    const saved = JSON.parse(readFileSync(file, 'utf8')) as { itemId: number }[];
    writeFileSync(file, JSON.stringify(saved.slice(0, 1)));
    vi.resetModules();
    const restarted = await import('./submissions-store');

    const third = await restarted.addSubmission('Suin', 'Third', 'https://example.com');
    expect(third.itemId).toBeGreaterThan(second.itemId);
  });

  it('carries on from the highest id in data saved before the counter was kept', async () => {
    writeFileSync(
      join(directory, 'submissions.json'),
      JSON.stringify([
        {
          id: 'a',
          itemId: store.localItemIdBase + 7,
          kind: 'story',
          username: 'Old',
          title: 'Old',
          url: 'https://example.com',
          text: '',
          submittedAt: 1,
        },
      ]),
    );
    vi.resetModules();
    const restarted = await import('./submissions-store');
    expect((await restarted.addSubmission('Suin', 'New', 'https://example.com')).itemId).toBe(
      store.localItemIdBase + 8,
    );
  });

  it('answers null for ids that are not submissions, including real Hacker News ids', async () => {
    await store.addSubmission('Suin', 'Mine', 'https://example.com');
    expect(await store.getSubmittedItem(8863)).toBeNull();
    expect(await store.getSubmittedItem(store.localItemIdBase)).toBeNull();
    expect(await store.getSubmittedItem(store.localItemIdBase + 99)).toBeNull();
  });

  it('gives item ids to stories that were saved before they had them', async () => {
    writeFileSync(
      join(directory, 'submissions.json'),
      JSON.stringify([
        {
          id: 'a',
          kind: 'story',
          username: 'Old',
          title: 'Old one',
          url: 'https://example.com',
          text: '',
          submittedAt: 1000,
        },
        {
          id: 'b',
          kind: 'question',
          username: 'Old',
          title: 'Old ask',
          url: '',
          text: 'Hi',
          submittedAt: 2000,
        },
      ]),
    );
    expect(await store.submittedStories('story')).toEqual([
      { id: store.localItemIdBase + 1, time: 1 },
    ]);
    expect(await store.submittedStories('question')).toEqual([
      { id: store.localItemIdBase + 2, time: 2 },
    ]);
  });
});
