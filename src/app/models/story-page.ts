import { HnItem } from './hn-item';

/** One page of a story list: the stories on that page and how many the whole list holds. */
export type StoryPage = {
  total: number;
  stories: HnItem[];
};
