/**
 * The story lists exposed by the API, each served as an array of item ids
 * from `/v0/<name>stories`. Top and new hold up to 500 ids, best is ranked,
 * and ask, show and job hold up to 200 ids.
 */
export type HnStoryList = 'top' | 'new' | 'best' | 'ask' | 'show' | 'job' | 'submit';

/** Every story list, used to validate the list in the URL. */
export const hnStoryLists: readonly HnStoryList[] = [
  'top',
  'new',
  'best',
  'ask',
  'show',
  'job',
  'submit',
];
