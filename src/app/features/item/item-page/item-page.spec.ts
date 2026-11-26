import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { ItemThread } from '../../../models/item-thread';
import { ItemPage } from './item-page';

const localStoryId = 2_000_000_001;

function thread(id: number, comments: ItemThread['comments'] = []): ItemThread {
  return {
    item: {
      id,
      type: 'story',
      title: 'A story',
      by: 'Billy',
      time: 1,
      score: 1,
      descendants: comments.length,
    },
    comments,
    pollOptions: [],
    truncated: false,
  };
}

describe('ItemPage comments', () => {
  let fixture: ComponentFixture<ItemPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const login = TestBed.inject(AuthStore).logIn('Anna', 'correct-horse');
    http.expectOne('/api/auth/login').flush({ username: 'Anna' });
    await login;
  });

  afterEach(() => {
    // Logging in also loads the user's profile in the background: not what these tests are about.
    http.match(
      (request) => request.url === '/api/profile' || request.url.startsWith('/api/stories/'),
    );
    http.verify();
  });

  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };

  async function open(id: number, loaded: ItemThread) {
    fixture = TestBed.createComponent(ItemPage);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne(`/api/items/${id}/thread`).flush(loaded);
    await settle();
  }

  const page = () => fixture.nativeElement as HTMLElement;

  async function write(text: string) {
    const box = page().querySelector<HTMLTextAreaElement>(
      'textarea#new-comment',
    ) as HTMLTextAreaElement;
    box.value = text;
    box.dispatchEvent(new Event('input'));
    await settle();
    page()
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  describe('on a story submitted in this app', () => {
    it('shows the comments that came with the story', async () => {
      await open(
        localStoryId,
        thread(localStoryId, [
          {
            id: 3_000_000_001,
            type: 'comment',
            by: 'Ben',
            time: 1,
            text: 'Saved earlier',
            replies: [],
          },
        ]),
      );
      expect(page().textContent).toContain('Saved earlier');
      expect(page().textContent).toContain('1 comments');
      expect(page().querySelector('.comment-list a.author')?.textContent).toBe('Ben');
    });

    it("says comments are saved on the app's server", async () => {
      await open(localStoryId, thread(localStoryId));
      expect(page().querySelector('#new-comment-hint')?.textContent).toContain('saved on this app');
    });

    it('saves a new comment on the server, then loads the story again to show it', async () => {
      await open(localStoryId, thread(localStoryId));
      await write('My comment');

      const request = http.expectOne(`/api/items/${localStoryId}/comments`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ text: 'My comment' });
      request.flush({ id: 3_000_000_001, time: 1 }, { status: 201, statusText: 'Created' });
      await settle();

      http.expectOne(`/api/items/${localStoryId}/thread`).flush(
        thread(localStoryId, [
          {
            id: 3_000_000_001,
            type: 'comment',
            by: 'Anna',
            time: 1,
            text: 'My comment',
            replies: [],
          },
        ]),
      );
      await settle();
      expect(page().querySelector('.comment-list')?.textContent).toContain('My comment');
      expect(page().querySelector<HTMLTextAreaElement>('textarea#new-comment')?.value).toBe('');
    });

    it('keeps what was typed, and says why, when the comment could not be saved', async () => {
      await open(localStoryId, thread(localStoryId));
      await write('My comment');
      http
        .expectOne(`/api/items/${localStoryId}/comments`)
        .flush({}, { status: 500, statusText: 'Error' });
      await settle();

      expect(page().querySelector('app-banner [role="alert"]')?.textContent).toContain(
        'Something went wrong',
      );
      expect(page().querySelector<HTMLTextAreaElement>('textarea#new-comment')?.value).toBe(
        'My comment',
      );
    });
  });

  describe('on a Hacker News story', () => {
    it('keeps a new comment in memory only: nothing is sent to the server', async () => {
      await open(8863, thread(8863));
      await write('Just for me');

      expect(http.match((request) => request.url.endsWith('/comments'))).toHaveLength(0);
      expect(page().querySelector('.comment-list')?.textContent).toContain('Just for me');
      expect(page().querySelector('#new-comment-hint')?.textContent).toContain(
        'until you reload the page',
      );
    });
  });
});
