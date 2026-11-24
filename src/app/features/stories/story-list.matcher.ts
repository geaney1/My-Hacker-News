import { UrlMatcher } from '@angular/router';
import { HnStoryList, hnStoryLists } from '../../models/hn-story-list';

/** Matches a single URL segment that is a story list name, e.g. `/top` or `/new`. */
export const storyListMatcher: UrlMatcher = (segments) => {
  const [segment] = segments;
  if (segments.length === 1 && hnStoryLists.includes(segment.path as HnStoryList)) {
    return { consumed: segments, posParams: { list: segment } };
  }
  return null;
};
