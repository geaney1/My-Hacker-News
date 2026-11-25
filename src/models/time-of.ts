/** Finds when a Hacker News story was made, in Unix seconds, or `undefined` if that is not known. */
export type TimeOf = (id: number) => Promise<number | undefined>;
