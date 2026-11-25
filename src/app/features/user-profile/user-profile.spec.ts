import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { HnApi } from '../../core/api/hn-api';
import { ProfileStore } from '../../core/profile/profile.store';
import { ThemeStore } from '../../core/theme/theme.store';
import { StoriesStore } from '../stories/stories.store';
import { UserProfile } from './user-profile';

const defaults = { about: '', email: '', showdead: 'no', noprocrast: 'no', maxvisit: 20, minaway: 180, delay: 0 };

describe('UserProfile', () => {
  let fixture: ComponentFixture<UserProfile>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const login = TestBed.inject(AuthStore).logIn('Billy', 'correct-horse');
    http.expectOne('/api/auth/login').flush({ username: 'Billy' });
    await login;

    fixture = TestBed.createComponent(UserProfile);
    await settle();
    http.expectOne('/api/profile').flush(defaults);
    await settle();
  });

  afterEach(() => {
    http.match((request) => request.url.startsWith('/api/stories/') || request.url.startsWith('/api/users/'));
    http.verify();
    vi.restoreAllMocks();
  });

  async function settle() {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  const page = () => fixture.nativeElement as HTMLElement;
  const updateButton = () => page().querySelector<HTMLButtonElement>('button[type="submit"]') as HTMLButtonElement;

  async function typeEmail(value: string) {
    const input = page().querySelector<HTMLInputElement>('input#email') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function submit() {
    page().querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  it('is a modal dialog titled "Profile"', () => {
    expect(page().querySelector('app-auth-card dialog')).not.toBeNull();
    expect(page().querySelector('h2')?.textContent).toBe('Profile');
  });

  it('has a close icon in the top right, which goes back to the list the user last had open', () => {
    TestBed.inject(StoriesStore).selectList('show');
    fixture.detectChanges();
    const close = page().querySelector('a.close');
    expect(close?.getAttribute('aria-label')).toBe('Close');
    expect(close?.getAttribute('href')).toBe('/show');
    expect(close?.querySelector('svg')).not.toBeNull();
  });

  describe('the theme button', () => {
    const themeButton = () => page().querySelector<HTMLButtonElement>('.actions button.button-outline') as HTMLButtonElement;

    beforeEach(() => {
      localStorage.removeItem('hacker-news.theme');
    });

    it('offers the dark theme while the light one is on, with no explanation under it', () => {
      expect(themeButton().textContent?.trim()).toBe('Switch to Dark theme');
      expect(page().querySelector('.field-hint')).toBeNull();
    });

    it('switches to the dark theme when pressed, and back to the light one when pressed again', async () => {
      const theme = TestBed.inject(ThemeStore);
      theme.theme.set('light');

      themeButton().click();
      await settle();
      expect(theme.theme()).toBe('dark');
      expect(themeButton().textContent?.trim()).toBe('Switch to Light theme');

      themeButton().click();
      await settle();
      expect(theme.theme()).toBe('light');
      expect(themeButton().textContent?.trim()).toBe('Switch to Dark theme');
    });

    it('is a plain button: it does not save the profile or close the dialog', async () => {
      themeButton().click();
      await settle();
      expect(themeButton().type).toBe('button');
      expect(navigate).not.toHaveBeenCalled();
      expect(http.match('/api/profile')).toHaveLength(0);
    });
  });

  it('has the theme button and a Change password link in the same row as Update', () => {
    const row = page().querySelector('.actions') as HTMLElement;
    expect(row.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Update');
    const link = row.querySelector('a');
    expect(link?.textContent?.trim()).toBe('Change password');
    expect(link?.getAttribute('href')).toBe('/change-password');
    expect(link?.classList.contains('button')).toBe(true);
    expect(row.querySelector('button.button-outline')?.textContent?.trim()).toMatch(/^Switch to (Dark|Light) theme$/);
    expect(page().querySelector('nav')).toBeNull();
  });

  it('closes the dialog when Update is chosen, back to the list the user last had open', async () => {
    TestBed.inject(StoriesStore).selectList('ask');
    await typeEmail('billy@example.com');
    await submit();
    http.expectOne('/api/profile').flush({});
    await settle();
    expect(navigate).toHaveBeenCalledWith('/ask');
  });

  it('saves the profile on the server when Update is chosen', async () => {
    await typeEmail('billy@example.com');
    await submit();
    const request = http.expectOne('/api/profile');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ ...defaults, email: 'billy@example.com' });
    request.flush({});
    await settle();
  });

  it('shows the saved profile when it is opened again', async () => {
    // The profile belongs to the app, so a new dialog starts from it without asking the server.
    TestBed.inject(ProfileStore).remember({
      about: 'Hi',
      email: 'saved@example.com',
      showdead: 'yes',
      noprocrast: 'no',
      maxvisit: 33,
      minaway: 44,
      delay: 5,
    });
    fixture.destroy();
    fixture = TestBed.createComponent(UserProfile);
    await settle();

    expect(page().querySelector<HTMLInputElement>('input#email')?.value).toBe('saved@example.com');
    expect(page().querySelector<HTMLTextAreaElement>('textarea#about')?.value).toBe('Hi');
    expect(page().querySelector<HTMLSelectElement>('select#showdead')?.value).toBe('yes');
    expect(page().querySelector<HTMLInputElement>('input#maxvisit')?.value).toBe('33');
    expect(page().querySelector<HTMLInputElement>('input#minaway')?.value).toBe('44');
    expect(page().querySelector<HTMLInputElement>('input#delay')?.value).toBe('5');
  });

  it('forgets the story pages remembered in this browser when the profile is saved, as Show Dead may have changed them', async () => {
    const clear = vi.spyOn(TestBed.inject(HnApi), 'clearStoryPageCache');
    await typeEmail('billy@example.com');
    await submit();
    http.expectOne('/api/profile').flush({});
    await settle();
    expect(clear).toHaveBeenCalledOnce();
  });

  it('does not forget them when the profile could not be saved', async () => {
    const clear = vi.spyOn(TestBed.inject(HnApi), 'clearStoryPageCache');
    await typeEmail('billy@example.com');
    await submit();
    http.expectOne('/api/profile').flush({}, { status: 500, statusText: 'Error' });
    await settle();
    expect(clear).not.toHaveBeenCalled();
  });

  it('never says "Profile updated."', async () => {
    await typeEmail('billy@example.com');
    await submit();
    http.expectOne('/api/profile').flush({});
    await settle();
    expect(page().textContent).not.toContain('Profile updated');
  });

  it('stays open and says why when the profile could not be saved', async () => {
    await typeEmail('billy@example.com');
    await submit();
    http.expectOne('/api/profile').flush({ message: 'No' }, { status: 500, statusText: 'Error' });
    await settle();
    expect(navigate).not.toHaveBeenCalled();
    expect(page().querySelector('app-banner [role="alert"]')?.textContent).toContain('Something went wrong');
  });

  it('asks the user to log in again when the session has ended', async () => {
    await typeEmail('billy@example.com');
    await submit();
    http.expectOne('/api/profile').flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();
    expect(page().querySelector('app-banner [role="alert"]')?.textContent).toContain('Log in again');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not close, and shows what is wrong, when the email is not valid', async () => {
    await typeEmail('not-an-email');
    await submit();
    expect(navigate).not.toHaveBeenCalled();
    expect(page().querySelector('#email-error')?.textContent?.trim()).toBe('Enter a valid email address');
    expect(updateButton().disabled).toBe(false);
    expect(document.activeElement?.id).toBe('email');
  });
});
