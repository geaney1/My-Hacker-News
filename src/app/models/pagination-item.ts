/** One entry in the page list: a page number, or a gap standing in for skipped pages. */
export type PaginationItem = { kind: 'page'; page: number } | { kind: 'gap'; key: string };
