import { createSerialQueue, readJsonFile, writeJsonFile } from './data-files';

/**
 * A value kept in one JSON file in the data folder, for the stores that hold everything in
 * memory. It is read from disk the first time it is needed and then kept in memory; the code
 * using it changes the value it was given and calls `save`, which writes the file, one write at
 * a time.
 */
export function createJsonStore<Value>(options: {
  /** The name of the file in the data folder. */
  file: string;
  /** What there is before anything has been saved. A new value each time it is called. */
  empty: () => Value;
  /** Tidies up what was read from disk, for files saved by an older version of the app. */
  upgrade?: (value: Value) => void;
}) {
  const enqueue = createSerialQueue();
  let loaded: Promise<Value> | undefined;

  return {
    /** The value in memory: every caller gets the same object, so changes are seen by all. */
    load() {
      loaded ??= readJsonFile<Value>(options.file, options.empty()).then((value) => {
        options.upgrade?.(value);
        return value;
      });
      return loaded;
    },
    /** Writes the value to disk. Writes happen in the order they were asked for. */
    save(value: Value) {
      return enqueue(() => writeJsonFile(options.file, value));
    },
  };
}
