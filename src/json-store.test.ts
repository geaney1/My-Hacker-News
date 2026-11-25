import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('json store', () => {
  let directory: string;
  let createJsonStore: typeof import('./json-store').createJsonStore;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-json-store-'));
    process.env['DATA_DIR'] = directory;
    vi.resetModules();
    ({ createJsonStore } = await import('./json-store'));
  });

  afterEach(() => {
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  const fileOn = (name: string) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as unknown;

  it('starts with what the store says is empty, when there is no file yet', async () => {
    const store = createJsonStore<string[]>({ file: 'list.json', empty: () => [] });
    expect(await store.load()).toEqual([]);
  });

  it('gives every caller the same object, so a change made by one is seen by the next', async () => {
    const store = createJsonStore<string[]>({ file: 'list.json', empty: () => [] });
    (await store.load()).push('first');
    expect(await store.load()).toEqual(['first']);
  });

  it('reads the file from disk only once', async () => {
    writeFileSync(join(directory, 'list.json'), JSON.stringify(['on disk']));
    const store = createJsonStore<string[]>({ file: 'list.json', empty: () => [] });
    expect(await store.load()).toEqual(['on disk']);

    writeFileSync(join(directory, 'list.json'), JSON.stringify(['changed behind its back']));
    expect(await store.load()).toEqual(['on disk']);
  });

  it('saves what it was given to the file, and a new store reads it back', async () => {
    const store = createJsonStore<Record<string, number>>({ file: 'map.json', empty: () => ({}) });
    const value = await store.load();
    value['a'] = 1;
    await store.save(value);
    expect(fileOn('map.json')).toEqual({ a: 1 });

    vi.resetModules();
    const again = (await import('./json-store')).createJsonStore<Record<string, number>>({
      file: 'map.json',
      empty: () => ({}),
    });
    expect(await again.load()).toEqual({ a: 1 });
  });

  it('writes in the order it was asked to, so the last change is the one on disk', async () => {
    const store = createJsonStore<number[]>({ file: 'numbers.json', empty: () => [] });
    const numbers = await store.load();
    const writes: Promise<unknown>[] = [];
    for (let count = 1; count <= 20; count++) {
      numbers.push(count);
      writes.push(store.save(numbers));
    }
    await Promise.all(writes);
    expect(fileOn('numbers.json')).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });

  it('lets a file saved by an older version be upgraded as it is read', async () => {
    writeFileSync(join(directory, 'old.json'), JSON.stringify([{ name: 'a' }, { name: 'b' }]));
    const store = createJsonStore<{ name: string; id?: number }[]>({
      file: 'old.json',
      empty: () => [],
      upgrade: (items) => items.forEach((item, index) => (item.id ??= index + 1)),
    });
    expect(await store.load()).toEqual([{ name: 'a', id: 1 }, { name: 'b', id: 2 }]);
  });

  it('keeps stores for different files apart', async () => {
    const first = createJsonStore<string[]>({ file: 'one.json', empty: () => [] });
    const second = createJsonStore<string[]>({ file: 'two.json', empty: () => [] });
    (await first.load()).push('only in one');
    expect(await second.load()).toEqual([]);
  });

  it('gives each store its own empty value, not one that is shared', async () => {
    const empty = () => [] as string[];
    const first = createJsonStore<string[]>({ file: 'a.json', empty });
    const second = createJsonStore<string[]>({ file: 'b.json', empty });
    (await first.load()).push('x');
    expect(await second.load()).toEqual([]);
  });
});
