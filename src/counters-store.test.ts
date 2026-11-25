import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('counters store', () => {
  let directory: string;
  let nextId: typeof import('./counters-store').nextId;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-counters-'));
    process.env['DATA_DIR'] = directory;
    vi.resetModules();
    ({ nextId } = await import('./counters-store'));
  });

  afterEach(() => {
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  it('starts one above where it is told to start, and counts up', async () => {
    expect(await nextId('thing', 1000)).toBe(1001);
    expect(await nextId('thing', 1000)).toBe(1002);
    expect(await nextId('thing', 1000)).toBe(1003);
  });

  it('keeps a count for each name', async () => {
    expect(await nextId('a', 10)).toBe(11);
    expect(await nextId('b', 500)).toBe(501);
    expect(await nextId('a', 10)).toBe(12);
  });

  it('does not go back when the highest id still in use is lower than what it handed out', async () => {
    await nextId('thing', 100);
    await nextId('thing', 100);
    // Whatever had 102 was removed: the highest left is 100, but 102 must not be handed out again.
    expect(await nextId('thing', 100)).toBe(103);
  });

  it('jumps ahead of an id already in use, such as one saved before the counter was kept', async () => {
    expect(await nextId('thing', 5000)).toBe(5001);
    expect(await nextId('thing', 9000)).toBe(9001);
  });

  it('gives different ids to requests that arrive at once', async () => {
    const ids = await Promise.all(Array.from({ length: 50 }, () => nextId('thing', 0)));
    expect(new Set(ids).size).toBe(50);
    expect(Math.max(...ids)).toBe(50);
  });

  it('keeps counting after a restart', async () => {
    await nextId('thing', 0);
    await nextId('thing', 0);
    expect(JSON.parse(readFileSync(join(directory, 'counters.json'), 'utf8'))).toEqual({ thing: 2 });

    vi.resetModules();
    const again = (await import('./counters-store')).nextId;
    expect(await again('thing', 0)).toBe(3);
  });

  it('starts from what is on disk', async () => {
    writeFileSync(join(directory, 'counters.json'), JSON.stringify({ thing: 41 }));
    vi.resetModules();
    const fresh = (await import('./counters-store')).nextId;
    expect(await fresh('thing', 0)).toBe(42);
  });
});
