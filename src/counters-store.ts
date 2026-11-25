import { createJsonStore } from './json-store';

/** The last id handed out for each kind of thing, by name. */
const countersStore = createJsonStore<Record<string, number>>({
  file: 'counters.json',
  empty: () => ({}),
});

/**
 * The next id for `name`: always higher than any handed out before, so an id is never used twice,
 * even if what had it is later removed. `highestInUse` is the highest id that already exists (or
 * the lowest id to start from), which keeps ids from clashing with data saved before the counter
 * was kept.
 */
export async function nextId(name: string, highestInUse: number) {
  const counters = await countersStore.load();
  // Nothing is awaited between reading the counter and changing it, so two requests at once
  // cannot get the same id.
  const id = Math.max(counters[name] ?? 0, highestInUse) + 1;
  counters[name] = id;
  await countersStore.save(counters);
  return id;
}
