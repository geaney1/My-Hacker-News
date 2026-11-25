import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { StoriesStore } from '../stories/stories.store';
import { SubmitStory } from './submit-story';

describe('SubmitStory', () => {
  let fixture: ComponentFixture<SubmitStory>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SubmitStory);
    await settle();
  });

  afterEach(() => {
    http.match((request) => request.url.startsWith('/api/stories/'));
    http.verify();
    vi.restoreAllMocks();
  });

  // The dialog's stories store has a request waiting for an answer, so the app is never "stable".
  async function settle() {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  const page = () => fixture.nativeElement as HTMLElement;
  const field = (id: string) => page().querySelector<HTMLInputElement>(`input#${id}`) as HTMLInputElement;
  const button = () => page().querySelector<HTMLButtonElement>('button[type="submit"]') as HTMLButtonElement;
  // Whether the form is invalid: the button is never turned off, so this is what tells "could be
  // sent" from "could not".
  const formIsInvalid = () => {
    const instance = fixture.componentInstance as unknown as Record<string, unknown>;
    const name = Object.keys(instance).find((key) => /Form$/.test(key)) as string;
    return (instance[name] as () => { invalid(): boolean })().invalid();
  };
  const errorOf = (id: string) => page().querySelector(`#${id}-error`)?.textContent?.trim();

  async function type(id: string, value: string) {
    field(id).value = value;
    field(id).dispatchEvent(new Event('input'));
    await settle();
  }

  async function typeText(value: string) {
    const box = page().querySelector<HTMLTextAreaElement>('textarea#story-text') as HTMLTextAreaElement;
    box.value = value;
    box.dispatchEvent(new Event('input'));
    await settle();
  }

  async function leave(id: string) {
    const control = page().querySelector<HTMLElement>(`#${id}`) as HTMLElement;
    control.dispatchEvent(new Event('blur'));
    await settle();
  }

  async function submit() {
    page().querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  async function fill(title = 'A good story', url = 'https://example.com/post') {
    await type('story-title', title);
    await type('story-url', url);
  }

  describe('the text box', () => {
    const textBox = () => page().querySelector<HTMLTextAreaElement>('textarea#story-text') as HTMLTextAreaElement;

    it('is a labelled, multi-line text box that is optional', () => {
      expect(textBox()).not.toBeNull();
      expect(page().querySelector('label[for="story-text"]')?.textContent).toBe('Text');
    });

    it('does not stop the form being submitted when left empty, if there is a link', async () => {
      await fill();
      expect(formIsInvalid()).toBe(false);
    });

    it('is sent with the story, trimmed', async () => {
      await fill();
      await typeText('  Line one\nLine two  ');
      await submit();
      const request = http.expectOne('/api/submissions');
      expect(request.request.body.text).toBe('Line one\nLine two');
      request.flush({ id: '1', submittedAt: 1 }, { status: 201, statusText: 'Created' });
      await settle();
    });

    it('accepts 2000 characters and refuses 2001', async () => {
      await fill();
      await typeText('x'.repeat(2000));
      expect(formIsInvalid()).toBe(false);

      await typeText('x'.repeat(2001));
      textBox().dispatchEvent(new Event('blur'));
      await settle();
      expect(errorOf('story-text')).toBe('The text can be at most 2000 characters');
      expect(formIsInvalid()).toBe(true);
    });
  });

  describe('story or question', () => {
    it('submits a question when the link is blank', async () => {
      expect(button().textContent?.trim()).toBe('Submit question');
      await type('story-title', 'Ask: anything?');
      await typeText('My question');
      expect(button().textContent?.trim()).toBe('Submit question');
    });

    it('submits a story as soon as there is a link', async () => {
      await fill();
      expect(button().textContent?.trim()).toBe('Submit story');
    });

    it('goes back to a question when the link is cleared', async () => {
      await fill();
      await type('story-url', '   ');
      expect(button().textContent?.trim()).toBe('Submit question');
    });
  });

  describe('the dialog', () => {
    it('is a modal dialog titled "Submit a story", with a Title and a Link field', () => {
      expect(page().querySelector('app-auth-card dialog')).not.toBeNull();
      expect(page().querySelector('h2')?.textContent).toBe('Submit a story');
      expect(page().querySelector('label[for="story-title"]')?.textContent).toBe('Title');
      expect(page().querySelector('label[for="story-url"]')?.textContent).toBe('Link');
      expect(field('story-url').type).toBe('url');
    });

    it('tells the user the title limit', () => {
      expect(page().querySelector('#story-title-hint')?.textContent).toContain('80');
    });

    it('closes back to the list the user last had open', () => {
      TestBed.inject(StoriesStore).selectList('ask');
      fixture.detectChanges();
      expect(page().querySelector('a.close')?.getAttribute('href')).toBe('/ask');
    });
  });

  describe('validation', () => {
    it('cannot be submitted while the form is empty', () => {
      expect(formIsInvalid()).toBe(true);
    });

    it('keeps the button available when the form is empty: pressing it says what is missing and moves to the first field', async () => {
      expect(button().disabled).toBe(false);
      await submit();
      expect(errorOf('story-title')).toBe('A title is required');
      expect(document.activeElement).toBe(field('story-title'));
      http.expectNone('/api/submissions');
    });

    it('can be submitted with a title and a valid link', async () => {
      await fill();
      expect(formIsInvalid()).toBe(false);
    });

    it('asks for a title once the field has been left empty', async () => {
      await type('story-title', 'x');
      await type('story-title', '');
      await leave('story-title');
      expect(errorOf('story-title')).toBe('A title is required');
    });

    it('does not accept a title of only spaces', async () => {
      await type('story-title', '     ');
      await leave('story-title');
      expect(errorOf('story-title')).toBe('A title is required');
      await type('story-url', 'https://example.com');
      expect(formIsInvalid()).toBe(true);
    });

    it('accepts a title of exactly 80 characters, and refuses 81', async () => {
      await fill('x'.repeat(80));
      expect(formIsInvalid()).toBe(false);

      await type('story-title', 'x'.repeat(81));
      await leave('story-title');
      expect(errorOf('story-title')).toBe('A title can be at most 80 characters');
      expect(formIsInvalid()).toBe(true);
    });

    it('does not need a link: it can be left blank to ask a question for discussion', async () => {
      await type('story-title', 'Ask: how do you test signal forms?');
      await typeText('I would like to know.');
      await leave('story-url');
      expect(errorOf('story-url')).toBeUndefined();
      expect(formIsInvalid()).toBe(false);
    });

    it('needs text when there is no link, because the text is the question', async () => {
      await type('story-title', 'Ask: anything?');
      await leave('story-text');
      expect(errorOf('story-text')).toBe('Add a link, or text to start a discussion');
      expect(formIsInvalid()).toBe(true);

      await typeText('   ');
      expect(formIsInvalid()).toBe(true);

      await typeText('Now it is a question');
      expect(errorOf('story-text')).toBeUndefined();
      expect(formIsInvalid()).toBe(false);
    });

    it('makes the text optional once there is a link', async () => {
      expect(page().querySelector('label[for="story-text"]')?.textContent).toBe('Text');
      await fill();
      expect(page().querySelector('label[for="story-text"]')?.textContent).toBe('Text (optional)');
      expect(errorOf('story-text')).toBeUndefined();
      expect(formIsInvalid()).toBe(false);
    });

    it.each(['example.com', 'www.example.com/page', 'ftp://example.com', 'javascript:alert(1)', 'http://', 'not a link'])(
      'refuses the link %j, and says what is wanted',
      async (url) => {
        await fill('A good story', url);
        await leave('story-url');
        expect(errorOf('story-url')).toBe('Enter a full web address that starts with http:// or https://');
        expect(formIsInvalid()).toBe(true);
      },
    );

    it('accepts a link with a query and a fragment', async () => {
      await fill('A good story', 'https://example.com/a?b=c&d=e#f');
      expect(errorOf('story-url')).toBeUndefined();
      expect(formIsInvalid()).toBe(false);
    });

    it('refuses a link that is too long', async () => {
      await fill('A good story', `https://example.com/${'a'.repeat(2000)}`);
      await leave('story-url');
      expect(errorOf('story-url')).toBe('A link can be at most 2000 characters');
    });

    it('does not show an error before the user has touched the field', () => {
      expect(errorOf('story-title')).toBeUndefined();
      expect(errorOf('story-url')).toBeUndefined();
    });
  });

  describe('submitting', () => {
    it('saves the story on the app server, trimmed', async () => {
      await fill('  Padded  ', '  https://example.com/a?b=c  ');
      await submit();

      const request = http.expectOne('/api/submissions');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ title: 'Padded', url: 'https://example.com/a?b=c', text: '' });
      request.flush({ id: '1', submittedAt: 1 }, { status: 201, statusText: 'Created' });
      await settle();
    });

    it('never goes to Hacker News: nothing is opened', async () => {
      const openWindow = vi.spyOn(window, 'open').mockReturnValue(null);
      await fill();
      await submit();
      http.expectOne('/api/submissions').flush({ id: '1', submittedAt: 1 }, { status: 201, statusText: 'Created' });
      await settle();
      expect(openWindow).not.toHaveBeenCalled();
    });

    it('loads the story lists again, so the new story is in them', async () => {
      await fill();
      await submit();
      http.expectOne('/api/submissions').flush({ id: '1', kind: 'story', submittedAt: 1 }, { status: 201, statusText: 'Created' });
      await settle();
      expect(http.match((request) => request.url.startsWith('/api/stories/')).length).toBeGreaterThan(0);
    });

    it('then closes the dialog, back to the list the user last had open', async () => {
      TestBed.inject(StoriesStore).selectList('show');
      await fill();
      await submit();
      http.expectOne('/api/submissions').flush({ id: '1', submittedAt: 1 }, { status: 201, statusText: 'Created' });
      await settle();
      expect(navigate).toHaveBeenCalledWith('/show');
    });

    it.each([
      [400, 'Check the title and link and try again'],
      [401, 'Your session has ended. Log in again to continue.'],
      [403, 'You have submitted as many stories as are allowed'],
      [429, 'Too many attempts. Try again in a minute.'],
      [500, 'Something went wrong. Please try again.'],
    ])('stays open and explains a %i answer', async (status, message) => {
      await fill();
      await submit();
      http.expectOne('/api/submissions').flush({ message: 'no' }, { status, statusText: 'Error' });
      await settle();

      expect(page().querySelector('.form-error')?.textContent?.trim()).toBe(message);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('clears an earlier error when the user tries again', async () => {
      await fill();
      await submit();
      http.expectOne('/api/submissions').flush({}, { status: 500, statusText: 'Error' });
      await settle();
      expect(page().querySelector('.form-error')).not.toBeNull();

      await submit();
      expect(page().querySelector('.form-error')).toBeNull();
      http.expectOne('/api/submissions').flush({ id: '1', submittedAt: 1 }, { status: 201, statusText: 'Created' });
      await settle();
    });

    it('sends nothing when the form is empty, and shows what is wrong', async () => {
      await submit();
      expect(http.match('/api/submissions')).toHaveLength(0);
      expect(navigate).not.toHaveBeenCalled();
      expect(errorOf('story-title')).toBe('A title is required');
    });

    it('sends a question for discussion with no link, only text', async () => {
      await type('story-title', 'Ask: anything?');
      await typeText('My question');
      await submit();
      const request = http.expectOne('/api/submissions');
      expect(request.request.body).toEqual({ title: 'Ask: anything?', url: '', text: 'My question' });
      request.flush({ id: '1', submittedAt: 1 }, { status: 201, statusText: 'Created' });
      await settle();
    });

    it('sends nothing for an invalid link', async () => {
      await fill('A good story', 'example.com');
      await submit();
      expect(http.match('/api/submissions')).toHaveLength(0);
    });

    it('sends nothing for a title that is too long', async () => {
      await fill('x'.repeat(81));
      await submit();
      expect(http.match('/api/submissions')).toHaveLength(0);
    });
  });
});
