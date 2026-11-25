import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import { HnItem } from '../../models/hn-item';
import { StoriesStore } from './stories.store';

/** Builds a story with the given id, using sensible defaults for everything else. */
function story(id: number, overrides: Partial<HnItem> = {}): HnItem {
  return {
    id,
    type: 'story',
    title: `Story ${id}`,
    by: `author${id}`,
    score: id * 10,
    ...overrides,
  };
}

@Component({ template: '' })
class Blank {}

describe('StoriesStore', () => {
  let store: StoriesStore;
  let http: HttpTestingController;

  /** Lets effects run and promises settle, so requests have been made. */
  async function settle() {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }

  const storyRequests = () => http.match((request) => request.url.startsWith('/api/stories/'));

  const pageOf = (request: TestRequest) => Number(request.request.params.get('page'));

  /**
   * Answers every outstanding request: story pages from `pages` (by list and page number), and
   * the Hacker News updates list with `changedIds`. Answering one request can start the next (a
   * loaded page starts the background fetch and the updates check), so it goes round a few times.
   */
  async function respond(
    pages: Record<string, { total: number; stories: HnItem[] }>,
    changedIds: number[] = [],
  ) {
    for (let round = 0; round < 3; round++) {
      await settle();
      for (const request of storyRequests()) {
        const list = request.request.url.split('/').pop();
        // A copy, as a real response is parsed afresh each time.
        request.flush(
          structuredClone(pages[`${list}:${pageOf(request)}`] ?? { total: 0, stories: [] }),
        );
      }
      for (const request of http.match('/api/updates')) {
        request.flush({ items: changedIds, profiles: [] });
      }
    }
    await settle();
  }

  /** A fresh store with a fresh fake backend. */
  function createStore() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(StoriesStore);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.clear();
    createStore();
  });

  describe('loading', () => {
    it('loads the first page of the selected list, 20 at a time', async () => {
      store.selectList('new');
      await settle();

      const [request] = storyRequests();
      expect(request.request.url).toBe('/api/stories/new');
      expect(request.request.params.get('page')).toBe('1');
      expect(request.request.params.get('pageSize')).toBe('20');
      request.flush({ total: 45, stories: [story(1), story(2)] });
      await settle();

      expect(store.stories().map((item) => item.id)).toEqual([1, 2]);
      expect(store.totalStories()).toBe(45);
      expect(store.totalPages()).toBe(3);
      expect(store.isLoading()).toBe(false);
    });

    it('reports an error when the stories cannot be loaded, and can try again', async () => {
      store.selectList('top');
      await settle();
      storyRequests()[0].flush('nope', { status: 502, statusText: 'Bad Gateway' });
      await settle();
      expect(store.error()).toBeTruthy();

      store.reload();
      await settle();
      storyRequests()[0].flush({ total: 1, stories: [story(1)] });
      await settle();
      expect(store.error()).toBeUndefined();
      expect(store.stories()).toHaveLength(1);
    });
  });

  describe('paging', () => {
    const twoPages = {
      'top:1': { total: 25, stories: [story(1), story(2)] },
      'top:2': { total: 25, stories: [story(21), story(22)] },
    };

    beforeEach(async () => {
      store.selectList('top');
      await respond(twoPages);
    });

    it('works out whether there is a next page', () => {
      expect(store.page()).toBe(1);
      expect(store.hasNextPage()).toBe(true);
    });

    it('goes to a page and loads it', async () => {
      store.goToPage(2);
      await respond(twoPages);

      expect(store.page()).toBe(2);
      expect(store.stories().map((item) => item.id)).toEqual([21, 22]);
      expect(store.hasNextPage()).toBe(false);
    });

    it.each([
      [0, 1],
      [-5, 1],
      [99, 2],
      [1.9, 1],
    ])('keeps a jump to page %d within the pages that exist (page %d)', (target, expected) => {
      store.goToPage(target);
      expect(store.page()).toBe(expected);
    });

    it('ignores a page that is not a number', () => {
      store.goToPage(Number.NaN);
      expect(store.page()).toBe(1);
    });

    it('starts again at page 1 when another list is chosen', async () => {
      store.goToPage(2);
      await respond(twoPages);

      store.selectList('best');
      expect(store.page()).toBe(1);
    });
  });

  describe('background loading', () => {
    it('fetches the next page once a page has loaded, before the user asks for it', async () => {
      store.selectList('best');
      await settle();
      storyRequests()[0].flush({ total: 25, stories: [story(1)] });
      await settle();

      const prefetch = storyRequests();
      expect(prefetch).toHaveLength(1);
      expect(prefetch[0].request.url).toBe('/api/stories/best');
      expect(pageOf(prefetch[0])).toBe(2);
    });

    it('does not fetch another page when the list has only one', async () => {
      store.selectList('best');
      await settle();
      storyRequests()[0].flush({ total: 5, stories: [story(1)] });
      await settle();

      expect(storyRequests()).toEqual([]);
    });
  });

  describe('filtering the current page', () => {
    beforeEach(async () => {
      store.selectList('top');
      await respond({
        'top:1': {
          total: 3,
          stories: [
            story(1, { title: 'Angular signals', by: 'anna', score: 120 }),
            story(2, { title: 'Rust news', by: 'ben', score: 40 }),
            story(3, { title: 'More ANGULAR', by: 'cara', score: 5 }),
          ],
        },
      });
    });

    it('shows every story with no filters', () => {
      expect(store.stories()).toHaveLength(3);
    });

    it('matches the search term in the title, ignoring case', () => {
      store.searchTerm.set('angular');
      expect(store.stories().map((item) => item.id)).toEqual([1, 3]);
    });

    it('matches the search term in the author name', () => {
      store.searchTerm.set('BEN');
      expect(store.stories().map((item) => item.id)).toEqual([2]);
    });

    it('ignores spaces around the search term', () => {
      store.searchTerm.set('  rust  ');
      expect(store.stories().map((item) => item.id)).toEqual([2]);
    });

    it('hides stories below the minimum score', () => {
      store.minScore.set(40);
      expect(store.stories().map((item) => item.id)).toEqual([1, 2]);
    });

    it('treats a missing score as 0', async () => {
      store.selectList('job');
      await respond({ 'job:1': { total: 1, stories: [story(9, { score: undefined })] } });

      store.minScore.set(1);
      expect(store.stories()).toEqual([]);
      store.minScore.set(0);
      expect(store.stories()).toHaveLength(1);
    });

    it('combines the search term and the minimum score', () => {
      store.searchTerm.set('angular');
      store.minScore.set(100);
      expect(store.stories().map((item) => item.id)).toEqual([1]);
    });

    it('keeps the total of the whole list while filtering', () => {
      store.minScore.set(1000);
      expect(store.stories()).toEqual([]);
      expect(store.totalStories()).toBe(3);
    });
  });

  describe('logging in and out', () => {
    async function logIn(username: string) {
      const done = TestBed.inject(AuthStore).logIn(username, 'long-enough-password');
      http.expectOne('/api/auth/login').flush({ username });
      await done;
      await settle();
    }

    async function logOut() {
      const done = TestBed.inject(AuthStore).logOut();
      http.expectOne('/api/auth/logout').flush({});
      await done;
      await settle();
    }

    const savedMinScore = () =>
      JSON.parse(localStorage.getItem('hacker-news.stories.preferences') ?? '{}').minScore;

    it('empties the search term and the minimum score on logging in', async () => {
      store.searchTerm.set('angular');
      store.minScore.set(40);
      await settle();

      await logIn('anna');

      expect(store.searchTerm()).toBe('');
      expect(store.minScore()).toBe(0);
    });

    it('empties them again on logging out', async () => {
      await logIn('anna');
      store.searchTerm.set('angular');
      store.minScore.set(40);
      await settle();

      await logOut();

      expect(store.searchTerm()).toBe('');
      expect(store.minScore()).toBe(0);
    });

    it('resets the saved minimum score too, so a reload does not bring it back', async () => {
      // Creating the store again after a render is a reload: the saved score is read back.
      localStorage.setItem('hacker-news.stories.preferences', JSON.stringify({ minScore: 40 }));
      createStore();
      TestBed.createComponent(Blank).detectChanges();
      await settle();
      expect(store.minScore()).toBe(40);

      await logIn('anna');

      expect(savedMinScore()).toBe(0);
    });
  });

  describe('stories that changed on Hacker News', () => {
    const page = { 'top:1': { total: 3, stories: [story(1), story(2), story(3)] } };

    // The store sets up its once-a-minute check when it is created, so the timers are faked first.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      createStore();
    });

    afterEach(() => vi.useRealTimers());

    it('reports none when nothing changed after the page was loaded', async () => {
      store.selectList('top');
      await respond(page, [2]);
      // Story 2 had already changed before the page loaded, so what is shown is up to date.
      expect(store.changedStoryCount()).toBe(0);
    });

    it('counts the stories on the page that changed since it was loaded', async () => {
      store.selectList('top');
      await respond(page, [2]);

      vi.advanceTimersByTime(60_000);
      await respond(page, [2, 3, 999]);

      // Story 3 is new to the list and on this page. Story 999 is not shown, so it does not count.
      expect(store.changedStoryCount()).toBe(1);
    });

    it('starts counting again after a refresh', async () => {
      store.selectList('top');
      await respond(page, []);
      vi.advanceTimersByTime(60_000);
      await respond(page, [1, 2]);
      expect(store.changedStoryCount()).toBe(2);

      store.reload();
      await respond(page, [1, 2]);
      expect(store.changedStoryCount()).toBe(0);
    });

    it('carries on quietly when the updates cannot be fetched', async () => {
      store.selectList('top');
      await respond(page, []);

      vi.advanceTimersByTime(60_000);
      await settle();
      http
        .match('/api/updates')
        .forEach((request) => request.flush('down', { status: 500, statusText: 'Server Error' }));
      await settle();

      expect(store.changedStoryCount()).toBe(0);
      expect(store.error()).toBeUndefined();
    });
  });
});
