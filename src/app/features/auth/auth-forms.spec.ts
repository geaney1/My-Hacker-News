import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { StoriesStore } from '../stories/stories.store';
import { ChangePassword } from '../change-password/change-password';
import { CreateUser } from './create-user/create-user';
import { LogIn } from './log-in/log-in';

/**
 * The log-in, create-user and change-password pages, used the way a person uses them: typing into
 * the fields and submitting, with a fake backend answering.
 */
describe('auth forms', () => {
  let fixture: ComponentFixture<unknown>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let navigateTo: ReturnType<typeof vi.spyOn>;

  function open(component: Type<unknown>, queryParams: Record<string, string> = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    navigateTo = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(component);
    for (const [name, value] of Object.entries(queryParams)) {
      fixture.componentRef.setInput(name, value);
    }
  }

  const page = () => fixture.nativeElement as HTMLElement;
  const field = (id: string) => page().querySelector<HTMLInputElement>(`input#${id}`) as HTMLInputElement;
  // Whether the form (whichever the page has) is invalid: the button is never turned off, so this is
  // what tells "could be sent" from "could not".
  const formIsInvalid = () => {
    const instance = fixture.componentInstance as unknown as Record<string, unknown>;
    const name = Object.keys(instance).find((key) => /Form$/.test(key)) as string;
    return (instance[name] as () => { invalid(): boolean })().invalid();
  };
  const formError = () => page().querySelector('.form-error')?.textContent?.trim();
  const fieldError = (id: string) => page().querySelector(`#${id}-error`)?.textContent?.trim();

  // The pages create the stories store, which has a request waiting for an answer, so the app is
  // never "stable". They are rendered directly and given a moment to finish instead.
  async function settle() {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function type(id: string, value: string) {
    field(id).value = value;
    field(id).dispatchEvent(new Event('input'));
    await settle();
  }

  async function blur(id: string) {
    field(id).dispatchEvent(new Event('blur'));
    await settle();
  }

  async function submit() {
    page().querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  afterEach(() => {
    // The story list loads in the background of these pages. It is not what is being tested.
    // Logging in also loads the user's profile in the background: not what these tests are about.
    http.match((request) => request.url.startsWith('/api/stories/') || request.url === '/api/profile');
    http.verify();
  });

  describe('log in', () => {
    beforeEach(async () => {
      open(LogIn);
      await settle();
    });

    it('cannot be submitted while the fields are empty or invalid', async () => {
      expect(formIsInvalid()).toBe(true);

      await type('username', 'Anna');
      await type('password', 'short');
      expect(formIsInvalid()).toBe(true);

      await submit();
      http.expectNone('/api/auth/login');
    });

    it('explains an invalid field once it has been left', async () => {
      await type('username', 'a');
      await blur('username');
      expect(fieldError('username')).toBe('Username must be at least 2 characters');
    });

    it('logs in with the right credentials and goes back to the story list the user had open', async () => {
      await type('username', 'Anna');
      await type('password', 'correct-horse');
      expect(formIsInvalid()).toBe(false);

      await submit();
      const request = http.expectOne('/api/auth/login');
      expect(request.request.body).toEqual({ username: 'Anna', password: 'correct-horse' });
      request.flush({ username: 'Anna' });
      await settle();

      expect(TestBed.inject(AuthStore).username()).toBe('Anna');
      expect(navigate).toHaveBeenCalledWith('/top');
    });

    it('goes to the list the user last had open, not always the first one', async () => {
      TestBed.inject(StoriesStore).selectList('best');
      await type('username', 'Anna');
      await type('password', 'correct-horse');
      await submit();
      http.expectOne('/api/auth/login').flush({ username: 'Anna' });
      await settle();

      expect(navigate).toHaveBeenCalledWith('/best');
    });

    it('shows the reason and stays on the page when the log-in fails', async () => {
      await type('username', 'Anna');
      await type('password', 'wrong-password');
      await submit();
      http.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
      await settle();

      expect(formError()).toBe('Incorrect username or password');
      expect(page().querySelector('.form-error [role="alert"]')?.getAttribute('role')).toBe('alert');
      expect(TestBed.inject(AuthStore).login()).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('clears the earlier error when trying again', async () => {
      await type('username', 'Anna');
      await type('password', 'wrong-password');
      await submit();
      http.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
      await settle();
      expect(formError()).toBeDefined();

      await submit();
      expect(formError()).toBeUndefined();
      http.expectOne('/api/auth/login').flush({ username: 'Anna' });
    });

    it('shows or hides the password', async () => {
      expect(field('password').type).toBe('password');
      page().querySelector<HTMLInputElement>('.show-password input')?.click();
      await settle();
      expect(field('password').type).toBe('text');
    });
  });

  describe('log in after being sent from a page that needs a login', () => {
    async function logInFrom(returnUrl: string) {
      open(LogIn, { returnUrl });
      await settle();
      await type('username', 'Anna');
      await type('password', 'correct-horse');
      await submit();
      http.expectOne('/api/auth/login').flush({ username: 'Anna' });
      await settle();
    }

    it('returns to the page that asked for the login', async () => {
      await logInFrom('/user-profile');
      expect(navigate).toHaveBeenCalledWith('/user-profile');
    });

    it.each(['https://evil.example', '//evil.example', '/log-in'])(
      'ignores the unsafe return address %s and goes to the story list instead',
      async (returnUrl) => {
        await logInFrom(returnUrl);
        expect(navigate).toHaveBeenCalledWith('/top');
      },
    );

    it('passes the return address on to the create-user page', async () => {
      open(LogIn, { returnUrl: '/user-profile' });
      await settle();
      const link = page().querySelector<HTMLAnchorElement>('a[href^="/create-user"]');
      expect(link?.getAttribute('href')).toBe('/create-user?returnUrl=%2Fuser-profile');
    });

    it('has a plain create-user link when there is no return address', async () => {
      open(LogIn);
      await settle();
      expect(page().querySelector('a[href^="/create-user"]')?.getAttribute('href')).toBe('/create-user');
    });
  });

  describe('create a new user', () => {
    beforeEach(async () => {
      open(CreateUser);
      await settle();
    });

    async function fill(username: string, password: string, confirmPassword = password) {
      await type('username', username);
      await type('password', password);
      await type('confirm-password', confirmPassword);
    }

    it('needs the two passwords to match', async () => {
      await fill('Anna', 'correct-horse', 'different-horse');
      await blur('confirm-password');

      expect(fieldError('confirm-password')).toBe('Passwords do not match');
      expect(formIsInvalid()).toBe(true);
    });

    it('creates the account and sends the user to log in', async () => {
      await fill('Anna', 'correct-horse');
      await submit();

      const request = http.expectOne('/api/auth/register');
      expect(request.request.body).toEqual({ username: 'Anna', password: 'correct-horse' });
      request.flush({ username: 'Anna' }, { status: 201, statusText: 'Created' });
      await settle();

      expect(navigateTo).toHaveBeenCalledWith(['/log-in'], { queryParams: { returnUrl: undefined } });
      // Creating a user does not log the user in.
      expect(TestBed.inject(AuthStore).login()).toBe(false);
    });

    it('keeps the return address when sending the user on to log in', async () => {
      open(CreateUser, { returnUrl: '/user-profile' });
      await settle();
      await fill('Anna', 'correct-horse');
      await submit();
      http.expectOne('/api/auth/register').flush({ username: 'Anna' }, { status: 201, statusText: 'Created' });
      await settle();

      expect(navigateTo).toHaveBeenCalledWith(['/log-in'], { queryParams: { returnUrl: '/user-profile' } });
    });

    it('says when the username is taken, and stays on the page', async () => {
      await fill('Anna', 'correct-horse');
      await submit();
      http.expectOne('/api/auth/register').flush({}, { status: 409, statusText: 'Conflict' });
      await settle();

      expect(formError()).toBe('That username is already taken');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('makes clear this is not a Hacker News account, and links to where a real Hacker News account is made', () => {
      expect(page().textContent).toContain('It is not a Hacker News account');
      const link = page().querySelector<HTMLAnchorElement>('a[href="https://news.ycombinator.com/login"]');
      expect(link).not.toBeNull();
      expect(link?.rel).toContain('noopener');
    });
  });

  describe('change password', () => {
    beforeEach(async () => {
      open(ChangePassword);
      await settle();
    });

    async function fill(current: string, next: string, confirmNext = next) {
      await type('current-password', current);
      await type('new-password', next);
      await type('confirm-new-password', confirmNext);
    }

    it('cannot be submitted with a new password that is the same as the current one', async () => {
      await fill('correct-horse', 'correct-horse');
      await blur('new-password');

      expect(fieldError('new-password')).toBe('New password must be different from the current password');
      expect(formIsInvalid()).toBe(true);
    });

    it('needs the new password to be repeated correctly', async () => {
      await fill('correct-horse', 'brand-new-pass', 'brand-new-typo');
      await blur('confirm-new-password');

      expect(fieldError('confirm-new-password')).toBe('Passwords do not match');
      expect(formIsInvalid()).toBe(true);
    });

    it('changes the password and returns to the profile', async () => {
      await fill('correct-horse', 'brand-new-pass');
      await submit();

      const request = http.expectOne('/api/auth/change-password');
      expect(request.request.body).toEqual({
        currentPassword: 'correct-horse',
        newPassword: 'brand-new-pass',
      });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(navigate).toHaveBeenCalledWith('/user-profile');
    });

    it('says when the current password is wrong, and stays on the page', async () => {
      await fill('wrong-wrong-1', 'brand-new-pass');
      await submit();
      http.expectOne('/api/auth/change-password').flush({}, { status: 403, statusText: 'Forbidden' });
      await settle();

      expect(formError()).toBe('The current password is incorrect');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('tells the user when their session has ended', async () => {
      await fill('correct-horse', 'brand-new-pass');
      await submit();
      http.expectOne('/api/auth/change-password').flush({}, { status: 401, statusText: 'Unauthorized' });
      await settle();

      expect(formError()).toBe('Your session has ended. Log in again to continue.');
    });
  });
});
