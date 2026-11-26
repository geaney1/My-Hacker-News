import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { NewCommentsStore } from '../../../core/comments/new-comments.store';
import { HnItem } from '../../../models/hn-item';
import { StoriesPage } from './stories-page';

function story(id: number, overrides: Partial<HnItem> = {}): HnItem {
  return {
    id,
    type: 'story',
    title: `Story ${id}`,
    by: `author${id}`,
    score: 10,
    time: 1_700_000_000,
    descendants: id,
    url: `https://example.com/${id}`,
    ...overrides,
  };
}

describe('StoriesPage', () => {
  let fixture: ComponentFixture<StoriesPage>;
  let http: HttpTestingController;

  async function settle() {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    fixture.detectChanges();
  }

  /** Shows the Top list with the given stories on its first page. */
  async function open(stories: HnItem[]) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StoriesPage);
    fixture.componentRef.setInput('list', 'top');
    fixture.detectChanges();
    await settle();

    for (const request of http.match((candidate) => candidate.url.startsWith('/api/stories/'))) {
      request.flush(structuredClone({ total: stories.length, stories }));
    }
    for (const request of http.match('/api/updates')) {
      request.flush({ items: [], profiles: [] });
    }
    await settle();
  }

  const page = () => fixture.nativeElement as HTMLElement;
  const card = (title: string) =>
    Array.from(page().querySelectorAll<HTMLElement>('article.story')).find((element) =>
      element.textContent?.includes(title),
    ) as HTMLElement;

  describe('a dead story', () => {
    beforeEach(() => open([story(1), story(2, { dead: true })]));

    it('is marked [dead], and a live one is not', () => {
      expect(card('Story 2').querySelector('.dead')?.textContent).toBe('[dead]');
      expect(card('Story 1').querySelector('.dead')).toBeNull();
    });
  });

  describe('the "comments" link', () => {
    beforeEach(() =>
      open([story(8863, { descendants: 71 }), story(9, { descendants: undefined })]),
    );

    it("goes to the story's page in this app, with the story's id at the end of the address", () => {
      const link = card('Story 8863').querySelector<HTMLAnchorElement>('a.comments-link');
      expect(link?.getAttribute('href')).toBe('/item/8863');
    });

    it('stays in this tab: it does not open a new one', () => {
      const link = card('Story 8863').querySelector<HTMLAnchorElement>('a.comments-link');
      expect(link?.hasAttribute('target')).toBe(false);
    });

    it('shows the number of comments, and 0 when there is no count', () => {
      expect(card('Story 8863').querySelector('a.comments-link')?.textContent).toContain(
        '71 comments',
      );
      expect(card('Story 9').querySelector('a.comments-link')?.textContent).toContain('0 comments');
    });

    it('never links to Hacker News', () => {
      for (const link of Array.from(
        page().querySelectorAll<HTMLAnchorElement>('a.comments-link'),
      )) {
        expect(link.getAttribute('href')).not.toContain('ycombinator');
      }
    });

    it('counts the comments written in this app on a Hacker News story as soon as they are', async () => {
      const newComments = TestBed.inject(NewCommentsStore);
      newComments.add(8863, 'anna', 'One');
      newComments.add(8863, 'anna', 'Two');
      newComments.add(9, 'anna', 'The first on this one');
      await settle();

      expect(card('Story 8863').querySelector('a.comments-link')?.textContent).toContain(
        '73 comments',
      );
      expect(card('Story 9').querySelector('a.comments-link')?.textContent).toContain('1 comments');
    });

    it("uses each story's own id", () => {
      const hrefs = Array.from(page().querySelectorAll('a.comments-link')).map((link) =>
        link.getAttribute('href'),
      );
      expect(hrefs).toEqual(['/item/8863', '/item/9']);
    });
  });

  describe('the rest of a card', () => {
    beforeEach(() =>
      open([
        story(1),
        story(2, { type: 'job', title: 'We are hiring', url: '', descendants: undefined }),
        story(3, { title: 'Ask HN: something', url: undefined }),
      ]),
    );

    it('has no comments link on a job post, which has no discussion', () => {
      expect(card('We are hiring').querySelector('a.comments-link')).toBeNull();
    });

    it('opens the article itself, in a new tab, from the title', () => {
      const title = card('Story 1').querySelector<HTMLAnchorElement>('.story-title a');
      expect(title?.getAttribute('href')).toBe('https://example.com/1');
      expect(title?.target).toBe('_blank');
      expect(title?.rel).toContain('noopener');
    });

    it('opens a post that has no article (such as an Ask HN) on its page in this app', () => {
      const title = card('Ask HN: something').querySelector<HTMLAnchorElement>('.story-title a');
      expect(title?.getAttribute('href')).toBe('/item/3');
      expect(title?.hasAttribute('target')).toBe(false);
    });

    it("treats an empty article address like no article, and opens the story's page here", () => {
      const title = card('We are hiring').querySelector<HTMLAnchorElement>('.story-title a');
      expect(title?.getAttribute('href')).toBe('/item/2');
    });

    it('tells screen readers that a title that leaves the app opens in a new tab', () => {
      const article = card('Story 1').querySelector('.story-title a .visually-hidden');
      expect(article?.textContent).toBe('(opens in a new tab)');
      expect(card('Ask HN: something').querySelector('.story-title a .visually-hidden')).toBeNull();
    });

    it('never links to Hacker News', () => {
      expect(page().innerHTML).not.toContain('news.ycombinator.com');
    });

    it('links the author to their profile page in this app', () => {
      expect(card('Story 1').querySelector('a.author-link')?.getAttribute('href')).toBe(
        '/user/author1',
      );
    });

    it('shows the points, who wrote it and when', () => {
      const meta = card('Story 1').querySelector('.story-meta')?.textContent?.replace(/\s+/g, ' ');
      expect(meta).toContain('10 points');
      expect(meta).toContain('by author1');
      expect(meta).toMatch(/ago|just now/);
    });
  });

  it('empties the search, minimum score and "Go to page" boxes on logging in', async () => {
    await open(Array.from({ length: 45 }, (_, index) => story(index + 1)));
    const box = (id: string) => page().querySelector<HTMLInputElement>(`#${id}`)!;
    const type = (id: string, value: string) => {
      box(id).value = value;
      box(id).dispatchEvent(new Event('input'));
    };
    type('search', 'Story');
    type('min-score', '5');
    type('go-to-page', '2');
    await settle();

    const done = TestBed.inject(AuthStore).logIn('anna', 'long-enough-password');
    http.expectOne('/api/auth/login').flush({ username: 'anna' });
    await done;
    await settle();

    expect(box('search').value).toBe('');
    expect(box('min-score').value).toBe('0');
    expect(box('go-to-page').value).toBe('');
  });

  it('says so when there are no stories to show', async () => {
    await open([]);
    expect(page().querySelector('li.empty')?.textContent).toContain(
      'No stories match your filters',
    );
  });
});
