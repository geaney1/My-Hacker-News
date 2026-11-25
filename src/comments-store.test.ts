import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('comments store', () => {
  let directory: string;
  let comments: typeof import('./comments-store');
  let submissions: typeof import('./submissions-store');
  let storyId: number;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-comments-'));
    process.env['DATA_DIR'] = directory;
    vi.resetModules();
    comments = await import('./comments-store');
    submissions = await import('./submissions-store');
    storyId = (await submissions.addSubmission('Billy', 'My story', 'https://example.com')).itemId;
  });

  afterEach(() => {
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it('has no comments on a story nobody has commented on', async () => {
    expect(await comments.getLocalComments(storyId)).toEqual([]);
  });

  it('saves a comment and gives it back as a comment, with the author and a time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000);
    await comments.addLocalComment('Anna', storyId, '  Nice one  ');

    expect(await comments.getLocalComments(storyId)).toEqual([
      expect.objectContaining({
        type: 'comment',
        by: 'Anna',
        time: 5,
        text: 'Nice one',
        parent: storyId,
        replies: [],
      }),
    ]);
  });

  it('gives comments ids far above the story ids, counting up', async () => {
    const first = await comments.addLocalComment('Anna', storyId, 'One');
    const second = await comments.addLocalComment('Anna', storyId, 'Two');
    expect(first.id).toBe(3_000_000_001);
    expect(second.id).toBe(3_000_000_002);
  });

  it('lists comments newest first, and only those of the story asked for', async () => {
    const other = (await submissions.addSubmission('Billy', 'Other', 'https://example.com')).itemId;
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    await comments.addLocalComment('Anna', storyId, 'First');
    vi.setSystemTime(2_000);
    await comments.addLocalComment('Anna', other, 'Elsewhere');
    vi.setSystemTime(3_000);
    await comments.addLocalComment('Ben', storyId, 'Second');

    expect((await comments.getLocalComments(storyId)).map((comment) => comment.text)).toEqual([
      'Second',
      'First',
    ]);
    expect((await comments.getLocalComments(other)).map((comment) => comment.text)).toEqual([
      'Elsewhere',
    ]);
  });

  it('escapes what was typed, so it cannot add HTML to the page', async () => {
    await comments.addLocalComment('Anna', storyId, '<script>alert(1)</script> & more\n\nNext');
    const [comment] = await comments.getLocalComments(storyId);
    expect(comment.text).toBe('&lt;script&gt;alert(1)&lt;/script&gt; &amp; more<p>Next');
  });

  it('keeps comments after a restart', async () => {
    await comments.addLocalComment('Anna', storyId, 'Still here');
    vi.resetModules();
    const again = await import('./comments-store');
    expect((await again.getLocalComments(storyId)).map((comment) => comment.text)).toEqual([
      'Still here',
    ]);
  });

  it.each([undefined, '', '   ', 5, null])('refuses the comment %j', async (text) => {
    await expect(comments.addLocalComment('Anna', storyId, text)).rejects.toThrow(
      /Write a comment/,
    );
  });

  it('refuses a comment of more than 2000 characters, and accepts exactly 2000', async () => {
    await expect(comments.addLocalComment('Anna', storyId, 'x'.repeat(2001))).rejects.toThrow(
      /at most 2000/,
    );
    await expect(
      comments.addLocalComment('Anna', storyId, 'x'.repeat(2000)),
    ).resolves.toBeDefined();
  });

  it('only allows comments on stories submitted in this app', async () => {
    await expect(comments.addLocalComment('Anna', 8863, 'Hi')).rejects.toBeInstanceOf(
      comments.NoSuchStoryError,
    );
    await expect(comments.addLocalComment('Anna', storyId + 50, 'Hi')).rejects.toBeInstanceOf(
      comments.NoSuchStoryError,
    );
  });

  it('counts the comments on a story, and is 0 for one without and for a Hacker News item', async () => {
    await comments.addLocalComment('Anna', storyId, 'One');
    await comments.addLocalComment('Ben', storyId, 'Two');
    expect(await comments.countLocalComments(storyId)).toBe(2);
    expect(await comments.countLocalComments(storyId + 1)).toBe(0);
    expect(await comments.countLocalComments(8863)).toBe(0);
  });

  describe('Delay', () => {
    it("hides a comment from everyone but its author until the author's delay has passed", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(10_000);
      await comments.addLocalComment('Anna', storyId, 'Slow one', 60);

      expect(
        (await comments.getLocalComments(storyId, 'Anna')).map((comment) => comment.text),
      ).toEqual(['Slow one']);
      expect(await comments.getLocalComments(storyId, 'Ben')).toEqual([]);
      expect(await comments.getLocalComments(storyId)).toEqual([]);
      expect(await comments.countLocalComments(storyId)).toBe(0);

      vi.setSystemTime(10_000 + 59_000);
      expect(await comments.getLocalComments(storyId, 'Ben')).toEqual([]);

      vi.setSystemTime(10_000 + 60_000);
      expect(
        (await comments.getLocalComments(storyId, 'Ben')).map((comment) => comment.text),
      ).toEqual(['Slow one']);
      expect(await comments.countLocalComments(storyId)).toBe(1);
    });

    it('shows a comment straight away when the author has no delay', async () => {
      await comments.addLocalComment('Anna', storyId, 'Quick one');
      expect(await comments.getLocalComments(storyId, 'Ben')).toHaveLength(1);
    });

    it('only delays the comments of the author who has a delay', async () => {
      await comments.addLocalComment('Anna', storyId, 'Delayed', 600);
      await comments.addLocalComment('Ben', storyId, 'Immediate', 0);
      expect(
        (await comments.getLocalComments(storyId, 'Cara')).map((comment) => comment.text),
      ).toEqual(['Immediate']);
    });
  });

  it('never gives a comment the id of one that was removed', async () => {
    await comments.addLocalComment('Anna', storyId, 'One');
    const second = await comments.addLocalComment('Anna', storyId, 'Two');

    const file = join(directory, 'comments.json');
    const saved = JSON.parse(readFileSync(file, 'utf8')) as unknown[];
    writeFileSync(file, JSON.stringify(saved.slice(0, 1)));
    vi.resetModules();
    const restarted = await import('./comments-store');
    await import('./submissions-store');

    const third = await restarted.addLocalComment('Anna', storyId, 'Three');
    expect(third.id).toBeGreaterThan(second.id);
  });

  it('has no local comments for a Hacker News item', async () => {
    expect(await comments.getLocalComments(8863)).toEqual([]);
  });
});
