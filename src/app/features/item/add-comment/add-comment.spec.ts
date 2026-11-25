import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { NewCommentsStore } from '../../../core/comments/new-comments.store';
import { AddComment } from './add-comment';

const localStoryId = 2_000_000_001;
const hackerNewsStoryId = 8863;

describe('AddComment', () => {
  let fixture: ComponentFixture<AddComment>;
  let http: HttpTestingController;
  let saved: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Saving a comment also loads the story lists again: that is checked on its own below.
    // Logging in also loads the user's profile in the background: not what these tests are about.
    http.match((request) => request.url.startsWith('/api/stories/') || request.url === '/api/profile');
    http.verify();
  });

  async function logIn() {
    const login = TestBed.inject(AuthStore).logIn('Anna', 'correct-horse');
    http.expectOne('/api/auth/login').flush({ username: 'Anna' });
    await login;
  }

  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };

  async function open(itemId: number) {
    fixture = TestBed.createComponent(AddComment);
    fixture.componentRef.setInput('itemId', itemId);
    saved = vi.fn<() => void>();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.detectChanges();
    await settle();
  }

  const page = () => fixture.nativeElement as HTMLElement;
  const box = () => page().querySelector<HTMLTextAreaElement>('textarea#new-comment') as HTMLTextAreaElement;
  const error = () => page().querySelector('#new-comment-error')?.textContent?.trim();

  async function write(text: string, send = true) {
    box().value = text;
    box().dispatchEvent(new Event('input'));
    await settle();
    if (send) {
      page().querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle();
    }
  }

  describe('when nobody is logged in', () => {
    beforeEach(() => open(localStoryId));

    it('offers no comment box, and leaves the log-in prompt to the page', () => {
      expect(page().querySelector('textarea')).toBeNull();
      expect(page().querySelector('.login-prompt')).toBeNull();
    });
  });

  describe('when logged in', () => {
    beforeEach(logIn);

    it('has a labelled comment box', async () => {
      await open(localStoryId);
      expect(page().querySelector('label[for="new-comment"]')?.textContent).toBe('Add a comment');
      expect(page().querySelector('.login-prompt')).toBeNull();
    });

    it('asks for something to be written, and sends nothing, when the box is empty or only spaces', async () => {
      await open(localStoryId);
      await write('   ');
      expect(error()).toBe('Write a comment before adding it');
      expect(http.match((request) => request.url.endsWith('/comments'))).toHaveLength(0);
      expect(saved).not.toHaveBeenCalled();
    });

    describe('on a story submitted in this app', () => {
      beforeEach(() => open(localStoryId));

      it('says the comment is saved on the app\'s server', () => {
        expect(page().querySelector('#new-comment-hint')?.textContent).toContain('saved on this app');
      });

      it('saves the comment on the server, empties the box, and says it is saved', async () => {
        await write('Nicely done');
        const request = http.expectOne(`/api/items/${localStoryId}/comments`);
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({ text: 'Nicely done' });
        request.flush({ id: 3_000_000_001, time: 1 }, { status: 201, statusText: 'Created' });
        await settle();

        expect(saved).toHaveBeenCalledOnce();
        expect(box().value).toBe('');
      });

      it('loads the story lists again, so the comment count in them is current', async () => {
        await write('Nicely done');
        http.expectOne(`/api/items/${localStoryId}/comments`).flush({}, { status: 201, statusText: 'Created' });
        await settle();
        expect(http.match((request) => request.url.startsWith('/api/stories/')).length).toBeGreaterThan(0);
      });

      it('keeps the text, and says why, when it could not be saved', async () => {
        await write('Nicely done');
        http.expectOne(`/api/items/${localStoryId}/comments`).flush({}, { status: 500, statusText: 'Error' });
        await settle();

        expect(saved).not.toHaveBeenCalled();
        expect(box().value).toBe('Nicely done');
        expect(page().querySelector('app-banner [role="alert"]')?.textContent).toContain('Something went wrong');
      });

      it('clears an earlier failure message when the user tries again', async () => {
        await write('Nicely done');
        http.expectOne(`/api/items/${localStoryId}/comments`).flush({}, { status: 500, statusText: 'Error' });
        await settle();
        expect(page().querySelector('app-banner [role="alert"]')).not.toBeNull();

        page().querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
        await settle();
        expect(page().querySelector('app-banner [role="alert"]')).toBeNull();
        http.expectOne(`/api/items/${localStoryId}/comments`).flush({}, { status: 201, statusText: 'Created' });
        await settle();
      });
    });

    describe('on a Hacker News story', () => {
      beforeEach(() => open(hackerNewsStoryId));

      it('says the comment is not saved and not posted to Hacker News', () => {
        const hint = page().querySelector('#new-comment-hint')?.textContent?.replace(/\s+/g, ' ');
        expect(hint).toContain('until you reload it');
        expect(hint).toContain('not posted to Hacker News');
      });

      it('keeps the comment in memory only, with the user as its author, and sends nothing', async () => {
        await write('Just for me');

        expect(http.match((request) => request.url.endsWith('/comments'))).toHaveLength(0);
        const kept = TestBed.inject(NewCommentsStore).forItem(hackerNewsStoryId);
        expect(kept.map((comment) => [comment.by, comment.text])).toEqual([['Anna', 'Just for me']]);
        expect(box().value).toBe('');
        expect(saved).not.toHaveBeenCalled();
      });
    });
  });
});
