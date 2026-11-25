import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type DataFiles = typeof import('./data-files');

describe('data files', () => {
  let directory: string;
  let files: DataFiles;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'hn-data-'));
    process.env['DATA_DIR'] = directory;
    files = await import('./data-files');
  });

  afterAll(() => {
    delete process.env['DATA_DIR'];
    rmSync(directory, { recursive: true, force: true });
  });

  it('uses the folder named by DATA_DIR', () => {
    expect(files.dataDirectory).toBe(directory);
  });

  it('gives the fallback for a file that does not exist yet', async () => {
    expect(await files.readJsonFile('missing.json', { empty: true })).toEqual({ empty: true });
  });

  it('writes a file and reads the same data back', async () => {
    await files.writeJsonFile('things.json', { a: 1, list: [1, 2] });
    expect(await files.readJsonFile('things.json', null)).toEqual({ a: 1, list: [1, 2] });
  });

  it('creates the data folder when it is missing', async () => {
    rmSync(directory, { recursive: true, force: true });
    await files.writeJsonFile('again.json', { ok: true });
    expect(JSON.parse(readFileSync(join(directory, 'again.json'), 'utf8'))).toEqual({ ok: true });
  });

  it('leaves no temporary file behind', async () => {
    await files.writeJsonFile('clean.json', { ok: true });
    expect(existsSync(join(directory, 'clean.json.tmp'))).toBe(false);
  });

  it('does not hide a file that is damaged', async () => {
    await files.writeJsonFile('good.json', {});
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(directory, 'broken.json'), '{ not json');
    await expect(files.readJsonFile('broken.json', {})).rejects.toThrow();
  });

  describe('createSerialQueue', () => {
    it('runs jobs one after another, in the order they were added', async () => {
      const enqueue = files.createSerialQueue();
      const log: string[] = [];
      const job = (name: string, wait: number) => async () => {
        log.push(`${name} start`);
        await new Promise((resolve) => setTimeout(resolve, wait));
        log.push(`${name} end`);
        return name;
      };

      const results = await Promise.all([
        enqueue(job('a', 30)),
        enqueue(job('b', 5)),
        enqueue(job('c', 1)),
      ]);

      expect(results).toEqual(['a', 'b', 'c']);
      expect(log).toEqual(['a start', 'a end', 'b start', 'b end', 'c start', 'c end']);
    });

    it('carries on after a job fails, and still reports that failure to its own caller', async () => {
      const enqueue = files.createSerialQueue();
      const failing = enqueue(async () => {
        throw new Error('boom');
      });
      const next = enqueue(async () => 'still works');

      await expect(failing).rejects.toThrow('boom');
      await expect(next).resolves.toBe('still works');
    });
  });
});
