import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Where the app keeps its data files (accounts, sessions, profiles, stories and comments). Set `DATA_DIR` to store them somewhere else. */
export const dataDirectory = process.env['DATA_DIR'] ?? join(process.cwd(), 'data');

/** Reads a JSON file from the data folder, or gives `fallback` when it does not exist yet. */
export async function readJsonFile<Value>(name: string, fallback: Value) {
  try {
    return JSON.parse(await readFile(join(dataDirectory, name), 'utf8')) as Value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

/**
 * Saves a JSON file in the data folder. It is written to a temporary file that is then renamed, so
 * the real file is never left half written. Only the owner can read it.
 */
export async function writeJsonFile(name: string, data: unknown) {
  await mkdir(dataDirectory, { recursive: true });
  const file = join(dataDirectory, name);
  const temporaryFile = `${file}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(temporaryFile, file);
}

/**
 * A queue that runs jobs one after another, so two requests can't write the same file at the same
 * time. A job that fails does not stop the jobs behind it.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <Result>(job: () => Promise<Result>) => {
    const result = tail.then(job);
    tail = result.catch(() => undefined);
    return result;
  };
}
